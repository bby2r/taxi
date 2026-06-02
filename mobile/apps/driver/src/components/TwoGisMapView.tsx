import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, ActivityIndicator, Text, AppState } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { DriverColors, Typography } from '@taxi/shared';
import {
  TWOGIS_API_KEY,
  TWOGIS_DEFAULT_CENTER,
  TWOGIS_DEFAULT_ZOOM,
} from '../lib/twoGisConfig';

export type LatLng = { latitude: number; longitude: number };

export type TwoGisMapHandle = {
  setDriver: (loc: LatLng & { heading?: number | null }) => void;
  setMarkers: (markers: { pickup?: LatLng | null; dropoff?: LatLng | null }) => void;
  setRoute: (coordinates: Array<[number, number]>) => void;
  setCenter: (loc: LatLng, opts?: { zoom?: number; bearing?: number; pitch?: number }) => void;
  setPitch: (pitch: number) => void;
  fitBounds: (coordinates: Array<[number, number]>, paddingPx?: number) => void;
};

type Props = {
  initialCenter?: [number, number];
  initialZoom?: number;
  onReady?: () => void;
  onUserGesture?: () => void;
  style?: object;
};

// HTML+JS payload rendered inside the WebView. The MapGL JS lib is
// loaded from the 2GIS CDN at runtime — keeps the bundle small but
// requires network on cold start. The page exposes a tiny message
// bridge: `window.applyCommand({type, ...})` dispatched from RN via
// injectJavaScript, and posts events back via
// `window.ReactNativeWebView.postMessage(...)`.
//
// The API key is templated in at render time so we don't have to ship
// it as a JS string anywhere else. It's a public client key — same as
// Mapbox pk-tokens — so being in the HTML is fine.
function buildHtml(apiKey: string, center: [number, number], zoom: number): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
    <style>
      html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #1F2937; }
      .driver-pin {
        width: 40px; height: 40px;
        display: flex; align-items: center; justify-content: center;
        transform-origin: center;
        will-change: transform;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
      }
      .driver-pin svg { width: 100%; height: 100%; }
      .pickup-pin {
        width: 36px; height: 36px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
      }
      .pickup-pin svg { width: 100%; height: 100%; }
      .dropoff-pin {
        width: 22px; height: 22px;
        border-radius: 50%;
        border: 4px solid #fff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        background: ${DriverColors.success};
      }
    </style>
    <script>
      // Перехват fetch / XHR ДО загрузки mapgl, чтобы поймать реальный
      // failing URL и HTTP-код. Без этого MapGL глотает причину и
      // эмитит styleloaderror без полезных полей. Логируем только
      // запросы к 2GIS — чтобы не светить чужой трафик в overlay.
      (function () {
        function post(payload) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        }
        window.__twoGisNetLog = [];
        function logNet(entry) {
          window.__twoGisNetLog.push(entry);
          if (window.__twoGisNetLog.length > 40) window.__twoGisNetLog.shift();
          if (entry.failed) {
            post({ type: 'error', message: 'net ' + (entry.status || 'fail') + ' ' + entry.url + (entry.body ? ' :: ' + entry.body.slice(0, 200) : '') });
          }
        }
        var origFetch = window.fetch;
        window.fetch = function (input, init) {
          var url = typeof input === 'string' ? input : (input && input.url) || '';
          var is2gis = /2gis\\.|2gis\\.com/.test(url);
          return origFetch.apply(this, arguments).then(function (resp) {
            if (is2gis && !resp.ok) {
              resp.clone().text().then(function (body) {
                logNet({ url: url, status: resp.status, failed: true, body: body });
              }).catch(function () {
                logNet({ url: url, status: resp.status, failed: true });
              });
            }
            return resp;
          }).catch(function (err) {
            if (is2gis) {
              logNet({ url: url, failed: true, body: 'throw: ' + (err && err.message) });
            }
            throw err;
          });
        };
        var origOpen = XMLHttpRequest.prototype.open;
        var origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function (method, url) {
          this.__url = url;
          return origOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function () {
          var xhr = this;
          var url = xhr.__url || '';
          var is2gis = /2gis\\.|2gis\\.com/.test(url);
          xhr.addEventListener('loadend', function () {
            if (is2gis && (xhr.status === 0 || xhr.status >= 400)) {
              logNet({
                url: url,
                status: xhr.status,
                failed: true,
                body: (xhr.responseText || '').slice(0, 200),
              });
            }
          });
          return origSend.apply(this, arguments);
        };
      })();
    </script>
    <script src="https://mapgl.2gis.com/api/js/v1"></script>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var __map = null;
      var __driverMarker = null;
      var __pickupMarker = null;
      var __dropoffMarker = null;
      var __routePolyline = null;
      var __gestureSent = false;

      function post(payload) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function makeDriverHtml(heading) {
        var rot = (heading == null || isNaN(heading)) ? 0 : heading;
        // Чистый 3D-индикатор направления как в 2GIS Navigator —
        // объёмная синяя стрелка с двумя гранями (тёмная справа,
        // светлая слева), белым контуром и эллиптической «тенью под
        // машиной». Без мультяшных деталей — водителю важно понять
        // направление с одного взгляда, а не разглядывать колёса.
        return '<div class="driver-pin" style="transform: rotate(' + rot + 'deg)">' +
          '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
            '<ellipse cx="24" cy="34" rx="16" ry="4" fill="#3B82F6" opacity="0.18"/>' +
            '<path d="M24 6 L36 34 L24 28 Z" fill="#1D4ED8"/>' +
            '<path d="M24 6 L12 34 L24 28 Z" fill="#3B82F6"/>' +
            '<path d="M24 6 L24 28" stroke="#fff" stroke-width="1.2" opacity="0.85"/>' +
            '<circle cx="24" cy="6" r="2.2" fill="#fff"/>' +
          '</svg>' +
        '</div>';
      }

      function makePickupHtml() {
        // Фигурка человека-клиента — водитель сразу видит «здесь меня
        // ждут», а не безликий жёлтый кружок.
        return '<div class="pickup-pin">' +
          '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="16" cy="16" r="14" fill="${DriverColors.primary}" stroke="#fff" stroke-width="2.5"/>' +
            '<circle cx="16" cy="12" r="3.2" fill="#1F2937"/>' +
            '<path d="M9 24 Q9 17 16 17 Q23 17 23 24 Z" fill="#1F2937"/>' +
          '</svg>' +
        '</div>';
      }

      function setDriver(loc) {
        if (!__map) return;
        // Recreate the marker each time — MapGL HtmlMarker doesn't
        // expose a stable way to mutate the inner DOM after creation,
        // and at ~1Hz GPS updates the destroy/create cycle is cheap.
        if (__driverMarker) {
          __driverMarker.destroy();
          __driverMarker = null;
        }
        __driverMarker = new mapgl.HtmlMarker(__map, {
          coordinates: [loc.longitude, loc.latitude],
          html: makeDriverHtml(loc.heading),
          anchor: [18, 18],
        });
      }

      function setMarkers(m) {
        if (!__map) return;
        // Pickup
        if (m.pickup) {
          var p = [m.pickup.longitude, m.pickup.latitude];
          if (__pickupMarker) {
            __pickupMarker.setCoordinates(p);
          } else {
            __pickupMarker = new mapgl.HtmlMarker(__map, {
              coordinates: p,
              html: makePickupHtml(),
              anchor: [18, 18],
            });
          }
        } else if (__pickupMarker) {
          __pickupMarker.destroy();
          __pickupMarker = null;
        }
        // Dropoff
        if (m.dropoff) {
          var d = [m.dropoff.longitude, m.dropoff.latitude];
          if (__dropoffMarker) {
            __dropoffMarker.setCoordinates(d);
          } else {
            __dropoffMarker = new mapgl.HtmlMarker(__map, {
              coordinates: d,
              html: '<div class="dropoff-pin"></div>',
              anchor: [11, 11],
            });
          }
        } else if (__dropoffMarker) {
          __dropoffMarker.destroy();
          __dropoffMarker = null;
        }
      }

      function setRoute(coords) {
        if (!__map) return;
        if (__routePolyline) {
          __routePolyline.destroy();
          __routePolyline = null;
        }
        if (coords && coords.length > 1) {
          __routePolyline = new mapgl.Polyline(__map, {
            coordinates: coords,
            width: 9,
            color: '${DriverColors.primary}',
          });
        }
      }

      function setCenter(loc, opts) {
        if (!__map) return;
        __map.setCenter([loc.longitude, loc.latitude]);
        if (opts && typeof opts.zoom === 'number') __map.setZoom(opts.zoom);
        if (opts && typeof opts.bearing === 'number') __map.setRotation(opts.bearing);
        if (opts && typeof opts.pitch === 'number') __map.setPitch(opts.pitch);
      }

      function fitBounds(coords, padding) {
        if (!__map || !coords || coords.length < 1) return;
        var minLng = coords[0][0], maxLng = coords[0][0];
        var minLat = coords[0][1], maxLat = coords[0][1];
        for (var i = 1; i < coords.length; i++) {
          var c = coords[i];
          if (c[0] < minLng) minLng = c[0];
          if (c[0] > maxLng) maxLng = c[0];
          if (c[1] < minLat) minLat = c[1];
          if (c[1] > maxLat) maxLat = c[1];
        }
        var pad = typeof padding === 'number' ? padding : 60;
        __map.fitBounds({
          southWest: [minLng, minLat],
          northEast: [maxLng, maxLat],
        }, { padding: { top: pad, right: pad, bottom: pad, left: pad } });
      }

      // RN side dispatches commands via injectJavaScript that calls this.
      window.applyCommand = function (cmd) {
        try {
          switch (cmd.type) {
            case 'setDriver': setDriver(cmd); break;
            case 'setMarkers': setMarkers(cmd); break;
            case 'setRoute': setRoute(cmd.coordinates); break;
            case 'setCenter': setCenter(cmd, cmd.opts); break;
            case 'setPitch':
              if (__map && typeof cmd.pitch === 'number') __map.setPitch(cmd.pitch);
              break;
            case 'fitBounds': fitBounds(cmd.coordinates, cmd.padding); break;
          }
        } catch (e) {
          post({ type: 'error', message: String(e && e.message ? e.message : e) });
        }
      };

      function init() {
        try {
          if (!'${apiKey}' || '${apiKey}'.length === 0) {
            post({ type: 'error', message: 'API-ключ 2GIS не передан в WebView (EXPO_PUBLIC_TWOGIS_KEY пустой)' });
            return;
          }
          __map = new mapgl.Map('map', {
            center: ${JSON.stringify(center)},
            zoom: ${zoom},
            key: '${apiKey}',
            // 3D-вид как стартовое состояние карты во всём приложении.
            // На zoom 16+ 2GIS экструдирует здания, на меньшем зуме
            // получается просто наклонная плоскость — оба варианта
            // ощущаются «трёхмерными» вместо плоской бумажной карты.
            pitch: 45,
            // Hide 2GIS native UI controls — RN side draws its own.
            zoomControl: false,
            keyControl: false,
          });
          // 'ready' постим сразу после успешного конструктора. Раньше
          // была попытка дождаться 'idle', но MapGL v1 такого события
          // не эмитит — ready никогда не отправлялся, очередь команд
          // (setDriver, setRoute, setMarkers) копилась бесконечно, и
          // на карте не было ни водителя, ни маршрута.
          post({ type: 'ready' });
          // MapGL v1 эмитит 'error' при невалидном ключе / отказе тайлов —
          // отдельно подписываемся для диагностики, но это уже не
          // блокирует ready-сигнал.
          if (typeof __map.on === 'function') {
            __map.on('error', function (e) {
              // styleloaderror — самый частый тип. MapGL глотает
              // детали внутри Error/Promise, поэтому глубоко
              // сериализуем event + берём последние failed-запросы
              // из network-перехватчика наверху.
              var parts = [];
              try {
                var seen = [];
                var flat = JSON.stringify(e, function (k, v) {
                  if (typeof v === 'object' && v !== null) {
                    if (seen.indexOf(v) >= 0) return '[circular]';
                    seen.push(v);
                  }
                  if (v instanceof Error) return { name: v.name, message: v.message, stack: (v.stack || '').slice(0, 200) };
                  return v;
                });
                if (flat && flat !== '{}') parts.push('evt=' + flat.slice(0, 300));
              } catch (_) {}
              if (e && e.type) parts.push('type=' + e.type);
              if (e && e.message) parts.push('msg=' + e.message);
              var net = window.__twoGisNetLog || [];
              for (var i = net.length - 1; i >= 0 && i >= net.length - 3; i--) {
                if (net[i].failed) {
                  parts.push('net=' + (net[i].status || 'fail') + ' ' + net[i].url.slice(0, 80));
                }
              }
              post({ type: 'error', message: 'MapGL: ' + parts.join(' | ') });
            });
          }
          // Any user gesture breaks follow-camera on the RN side. We
          // detect via 'movestart' triggered with 'isUserInteraction'.
          // MapGL doesn't expose that reason directly, so we listen for
          // touchstart on the canvas — fires only on real user input.
          var mapEl = document.getElementById('map');
          if (mapEl) {
            mapEl.addEventListener('touchstart', function () {
              if (!__gestureSent) {
                __gestureSent = true;
                post({ type: 'gesture' });
                // Reset shortly so subsequent gestures fire again.
                setTimeout(function () { __gestureSent = false; }, 400);
              }
            }, { passive: true });
          }
        } catch (e) {
          post({ type: 'error', message: String(e && e.message ? e.message : e) });
        }
      }

      // mapgl is loaded async — poll briefly until it's defined.
      var __tries = 0;
      function waitForMapgl() {
        if (typeof mapgl !== 'undefined') {
          init();
          return;
        }
        __tries++;
        if (__tries > 80) {
          post({ type: 'error', message: 'mapgl failed to load' });
          return;
        }
        setTimeout(waitForMapgl, 100);
      }
      waitForMapgl();
    </script>
  </body>
</html>`;
}

const TwoGisMapView = forwardRef<TwoGisMapHandle, Props>(function TwoGisMapView(
  {
    initialCenter = TWOGIS_DEFAULT_CENTER,
    initialZoom = TWOGIS_DEFAULT_ZOOM,
    onReady,
    onUserGesture,
    style,
  },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  // Commands issued before the WebView finishes loading are queued and
  // replayed on 'ready'. Otherwise a fast-mounted parent that calls
  // setDriver immediately would see the call silently dropped.
  const queueRef = useRef<object[]>([]);
  // Видимая диагностика — иначе при пустом TWOGIS_API_KEY или
  // ошибках init у пользователя просто чёрный квадрат без понимания
  // что не так.
  const keyMissing = TWOGIS_API_KEY.length === 0;
  const [initError, setInitError] = useState<string | null>(null);
  // MIUI / Doze регулярно убивают WebView render-процесс когда app в
  // фоне. Без авто-рекавери водитель видел overlay «WebView убит,
  // перезапустите приложение». Теперь меняем remountKey → WebView
  // целиком пересоздаётся, новый рендер-процесс стартует, init() в
  // HTML отрабатывает заново. UI-overlay показываем только если
  // ремаунт случился больше 2-х раз подряд за короткое время.
  const [remountKey, setRemountKey] = useState(0);
  const recoveryAttemptsRef = useRef(0);

  // initialCenter обычно передаётся inline-массивом из родителя — на
  // каждый GPS-апдейт это новый референс, useMemo пересоздавал html,
  // WebView получал новый source и перезагружал страницу целиком (с
  // повторным скачиванием MapGL JS из CDN). Замораживаем значения,
  // увиденные на маунте — это и есть смысл слова "initial".
  const frozenCenterRef = useRef<[number, number]>(initialCenter);
  const frozenZoomRef = useRef<number>(initialZoom);
  const html = useMemo(
    () => buildHtml(TWOGIS_API_KEY, frozenCenterRef.current, frozenZoomRef.current),
    [],
  );

  const dispatch = useCallback((cmd: object): void => {
    if (!readyRef.current) {
      queueRef.current.push(cmd);
      return;
    }
    const payload = JSON.stringify(cmd).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webRef.current?.injectJavaScript(
      `window.applyCommand && window.applyCommand(JSON.parse('${payload}')); true;`,
    );
  }, []);

  // Авто-рекавери WebView при render-process-gone (MIUI/Doze убивают
  // в фоне). До 3-х попыток подряд — тихий ремаунт; четвёртая показывает
  // overlay чтобы водитель знал что нужно вручную перезайти.
  const attemptRemount = useCallback((reason: string): void => {
    recoveryAttemptsRef.current += 1;
    if (recoveryAttemptsRef.current > 3) {
      setInitError(
        `WebView постоянно падает (${reason}). Перезапустите приложение.`,
      );
      return;
    }
    readyRef.current = false;
    queueRef.current = [];
    setInitError(null);
    setRemountKey((k) => k + 1);
    // Если ремаунт прошёл успешно и карта не падает 20 сек — считаем
    // что рекавери сработала, сбрасываем счётчик. Иначе следующее
    // падение опять накапливает, и на 4-м идёт overlay.
    setTimeout(() => {
      recoveryAttemptsRef.current = 0;
    }, 20000);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      setDriver: (loc) => dispatch({ type: 'setDriver', ...loc }),
      setMarkers: (m) => dispatch({ type: 'setMarkers', ...m }),
      setRoute: (coordinates) => dispatch({ type: 'setRoute', coordinates }),
      setCenter: (loc, opts) => dispatch({ type: 'setCenter', ...loc, opts }),
      setPitch: (pitch) => dispatch({ type: 'setPitch', pitch }),
      fitBounds: (coordinates, padding) => dispatch({ type: 'fitBounds', coordinates, padding }),
    }),
    [dispatch],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent): void => {
      lastMessageRef.current = Date.now();
      try {
        const data = JSON.parse(event.nativeEvent.data) as { type: string; message?: string };
        if (data.type === 'ready') {
          readyRef.current = true;
          // Drain queued commands.
          const queue = queueRef.current;
          queueRef.current = [];
          for (const cmd of queue) {
            const payload = JSON.stringify(cmd)
              .replace(/\\/g, '\\\\')
              .replace(/'/g, "\\'");
            webRef.current?.injectJavaScript(
              `window.applyCommand && window.applyCommand(JSON.parse('${payload}')); true;`,
            );
          }
          onReady?.();
        } else if (data.type === 'gesture') {
          onUserGesture?.();
        } else if (data.type === 'error') {
          // eslint-disable-next-line no-console
          console.warn('[TwoGisMapView] map error:', data.message);
          setInitError(data.message ?? 'Не удалось загрузить карту');
        }
      } catch {
        // Malformed message — ignore.
      }
    },
    [onReady, onUserGesture],
  );

  useEffect(() => {
    return () => {
      readyRef.current = false;
      queueRef.current = [];
    };
  }, []);

  // На MIUI возврат из background после Doze иногда оставляет WebView
  // живым по виду, но без активного рендера — render-process-gone
  // callback при этом не всегда срабатывает. Отслеживаем последнюю
  // активность из WebView; если после foreground'а >2 сек тишина и
  // не пришёл pong на инжекту — ремаунтим.
  const lastMessageRef = useRef<number>(Date.now());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || !readyRef.current) return;
      const sentAt = Date.now();
      webRef.current?.injectJavaScript(
        `if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'pong'})); true;`,
      );
      setTimeout(() => {
        if (lastMessageRef.current < sentAt) {
          attemptRemount('foreground ping no response');
        }
      }, 2000);
    });
    return () => sub.remove();
  }, [attemptRemount]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        key={remountKey}
        ref={webRef}
        originWhitelist={['*']}
        // baseUrl был 'https://mapgl.2gis.com' — это заставляло WebView
        // выглядеть для MapGL-сервера как запрос с самого себя, и его
        // анти-abuse защита резала загрузку стиля (styleloaderror).
        // В обычном браузере с тем же ключом всё работает с localhost-
        // origin'ом, поэтому копируем это поведение здесь.
        source={{ html, baseUrl: 'https://localhost/' }}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        thirdPartyCookiesEnabled
        cacheEnabled
        // LOAD_CACHE_ELSE_NETWORK заставляет Android WebView сначала
        // взять MapGL JS из дискового кеша, и обращаться к CDN только
        // если в кеше пусто. Без этого каждый remount тянул ~500КБ
        // скрипта по сети — на 3G это секунды чёрного экрана.
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        onMessage={handleMessage}
        onError={(e) => {
          const { code, description, domain } = e.nativeEvent;
          setInitError(`WebView error ${code}: ${description}${domain ? ' (' + domain + ')' : ''}`);
        }}
        onHttpError={(e) => {
          const { statusCode, url } = e.nativeEvent;
          setInitError(`WebView HTTP ${statusCode}: ${url}`);
        }}
        onContentProcessDidTerminate={() => {
          // iOS-only — на Android этот колбэк не вызывается. На всякий
          // случай тоже делаем remount.
          attemptRemount('content process terminated');
        }}
        onRenderProcessGone={() => {
          // Android: рендер-процесс убит OS (MIUI / Doze / OOM-killer).
          // Автоматически пересоздаём WebView вместо ругани в overlay.
          attemptRemount('renderer gone');
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={DriverColors.primary} />
          </View>
        )}
        style={styles.webview}
        // MapGL рендерится в WebGL canvas — это требует hardware layer.
        // Раньше тут было "software" с комментарием про «чёрный квадрат
        // на Xiaomi», но настоящий симптом был другой: HtmlMarker'ы
        // (DOM) видны, а тайлы чёрные — это ровно software-режим, где
        // WebGL не работает. Hardware возвращает рендер тайлов.
        androidLayerType="hardware"
        bounces={false}
        scrollEnabled={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
      />
      {(keyMissing || initError) && (
        <View style={styles.errorOverlay} pointerEvents="none">
          <Text style={[Typography.bodyBold, styles.errorTitle]}>
            {keyMissing ? 'Карта не настроена' : 'Карта недоступна'}
          </Text>
          <Text style={[Typography.caption, styles.errorBody]}>
            {keyMissing
              ? 'EXPO_PUBLIC_TWOGIS_KEY не попал в сборку. Пересоберите APK с ключом в .env (см. apps/driver/src/lib/twoGisConfig.ts).'
              : initError}
          </Text>
          {!keyMissing && (
            <Text style={[Typography.caption, styles.errorBody, { marginTop: 8, opacity: 0.6 }]}>
              key …{TWOGIS_API_KEY.slice(-4)} (len {TWOGIS_API_KEY.length})
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

export default TwoGisMapView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DriverColors.background,
  },
  webview: {
    flex: 1,
    backgroundColor: DriverColors.background,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DriverColors.background,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: DriverColors.background,
  },
  errorTitle: {
    color: DriverColors.danger,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    color: DriverColors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
