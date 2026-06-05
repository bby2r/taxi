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
  MAPTILER_KEY,
  MAPTILER_STYLE,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
} from '../lib/mapLibreConfig';

export type LatLng = { latitude: number; longitude: number };

export type MapLibreMapHandle = {
  setDriver: (loc: LatLng & { heading?: number | null }) => void;
  setMarkers: (markers: { pickup?: LatLng | null; dropoff?: LatLng | null }) => void;
  setRoute: (coordinates: Array<[number, number]>) => void;
  setCenter: (
    loc: LatLng,
    opts?: { zoom?: number; bearing?: number; pitch?: number; duration?: number },
  ) => void;
  setPitch: (pitch: number) => void;
  fitBounds: (coordinates: Array<[number, number]>, paddingPx?: number) => void;
  // Снимает override-lock который ставится при тач-жесте: пока он
  // активен, setCenter/setPitch/fitBounds — no-op'ы. Вызывается RN
  // при тапе «Вернуться к маршруту», чтобы камера снова следовала.
  clearOverride: () => void;
};

type Props = {
  initialCenter?: [number, number];
  initialZoom?: number;
  onReady?: () => void;
  onUserGesture?: () => void;
  style?: object;
};

// HTML+JS payload, рендерится внутри WebView. MapLibre GL JS грузится
// из unpkg CDN (open-source форк Mapbox GL — практически 1-в-1 API).
// Тайлы и стиль приходят с MapTiler по ключу. Page exposes the same
// тонкий мост: `window.applyCommand({type, ...})` от RN через
// injectJavaScript, обратно — `window.ReactNativeWebView.postMessage`.
function buildHtml(apiKey: string, styleName: string, center: [number, number], zoom: number): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
    <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
    <style>
      html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #1F2937; }
      .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right,
      .maplibregl-ctrl-top-left, .maplibregl-ctrl-top-right { display: none !important; }
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
      // Перехват fetch / XHR ДО загрузки maplibre, чтобы поймать
      // реальный failing URL и HTTP-код. Без этого MapLibre глотает
      // причину провала загрузки стиля/тайла и эмитит просто 'error'.
      // Логируем только запросы к MapTiler/OSM — чтобы не светить
      // чужой трафик в overlay.
      (function () {
        function post(payload) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        }
        window.__mapNetLog = [];
        function logNet(entry) {
          window.__mapNetLog.push(entry);
          if (window.__mapNetLog.length > 40) window.__mapNetLog.shift();
          if (entry.failed) {
            post({ type: 'error', message: 'net ' + (entry.status || 'fail') + ' ' + entry.url + (entry.body ? ' :: ' + entry.body.slice(0, 200) : '') });
          }
        }
        var origFetch = window.fetch;
        window.fetch = function (input) {
          var url = typeof input === 'string' ? input : (input && input.url) || '';
          var isMap = /maptiler\\.com|openstreetmap\\.org|unpkg\\.com\\/maplibre/.test(url);
          return origFetch.apply(this, arguments).then(function (resp) {
            if (isMap && !resp.ok) {
              resp.clone().text().then(function (body) {
                logNet({ url: url, status: resp.status, failed: true, body: body });
              }).catch(function () {
                logNet({ url: url, status: resp.status, failed: true });
              });
            }
            return resp;
          }).catch(function (err) {
            if (isMap) {
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
          var isMap = /maptiler\\.com|openstreetmap\\.org/.test(url);
          xhr.addEventListener('loadend', function () {
            if (isMap && (xhr.status === 0 || xhr.status >= 400)) {
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
    <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var __map = null;
      var __driverMarker = null;
      var __driverTweenRaf = null;
      var __pickupMarker = null;
      var __dropoffMarker = null;
      var __gestureSent = false;
      var __styleLoaded = false;
      // Override lock: после реального user-touch'а программные
      // setCenter становятся no-op'ами, чтобы GPS/compass-апдейты не
      // отрывали камеру от того места куда водитель её отпанил. Сбрасы-
      // вается через applyCommand({type:'clearOverride'}) с RN-стороны
      // (когда водитель тапает «Вернуться к маршруту»).
      var __userOverride = false;

      function post(payload) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function makeDriverEl(heading) {
        // 3D-индикатор направления, поворот через CSS transform на
        // этом div'е (MapLibre Marker ставит translate на свой wrapper).
        var rot = (heading == null || isNaN(heading)) ? 0 : heading;
        var el = document.createElement('div');
        el.className = 'driver-pin';
        el.style.transform = 'rotate(' + rot + 'deg)';
        el.innerHTML =
          '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
            '<ellipse cx="24" cy="34" rx="16" ry="4" fill="#3B82F6" opacity="0.18"/>' +
            '<path d="M24 6 L36 34 L24 28 Z" fill="#1D4ED8"/>' +
            '<path d="M24 6 L12 34 L24 28 Z" fill="#3B82F6"/>' +
            '<path d="M24 6 L24 28" stroke="#fff" stroke-width="1.2" opacity="0.85"/>' +
            '<circle cx="24" cy="6" r="2.2" fill="#fff"/>' +
          '</svg>';
        return el;
      }

      function makePickupEl() {
        // Фигурка человека-клиента — водитель сразу видит «здесь меня
        // ждут», а не безликий жёлтый кружок.
        var el = document.createElement('div');
        el.className = 'pickup-pin';
        el.innerHTML =
          '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="16" cy="16" r="14" fill="${DriverColors.primary}" stroke="#fff" stroke-width="2.5"/>' +
            '<circle cx="16" cy="12" r="3.2" fill="#1F2937"/>' +
            '<path d="M9 24 Q9 17 16 17 Q23 17 23 24 Z" fill="#1F2937"/>' +
          '</svg>';
        return el;
      }

      function makeDropoffEl() {
        var el = document.createElement('div');
        el.className = 'dropoff-pin';
        return el;
      }

      function setDriver(loc) {
        if (!__map) return;
        // Мутируем существующий маркер вместо destroy/create — компас
        // тикает ~5Hz после 8°-порога, DOM-rebuild на каждый тик
        // ощутимо лагал на слабых WebView'ях.
        var rot = (loc.heading == null || isNaN(loc.heading)) ? 0 : loc.heading;
        if (!__driverMarker) {
          __driverMarker = new maplibregl.Marker({
            element: makeDriverEl(loc.heading),
            anchor: 'center',
          })
            .setLngLat([loc.longitude, loc.latitude])
            .addTo(__map);
          return;
        }
        // Поворот применяем сразу (CSS-трансформ дешёвый) — глаз ловит
        // изменение курса быстрее, чем сдвиг точки.
        __driverMarker.getElement().style.transform = 'rotate(' + rot + 'deg)';
        // Плавный tween к новой точке вместо телепорта. Без него на
        // скорости 60 км/ч маркер прыгал на ~17м каждый GPS-тик
        // (1с при BestForNavigation) и поездка ощущалась рваной.
        if (__driverTweenRaf) cancelAnimationFrame(__driverTweenRaf);
        var start = __driverMarker.getLngLat();
        var startTs = null;
        var duration = 900;
        function step(ts) {
          if (startTs === null) startTs = ts;
          var t = Math.min(1, (ts - startTs) / duration);
          // Лёгкий ease-out — в начале tween быстрый (догоняет реальную
          // позицию), к концу замедляется.
          var e = 1 - Math.pow(1 - t, 2);
          var lng = start.lng + (loc.longitude - start.lng) * e;
          var lat = start.lat + (loc.latitude - start.lat) * e;
          __driverMarker.setLngLat([lng, lat]);
          if (t < 1) {
            __driverTweenRaf = requestAnimationFrame(step);
          } else {
            __driverTweenRaf = null;
          }
        }
        __driverTweenRaf = requestAnimationFrame(step);
      }

      function setMarkers(m) {
        if (!__map) return;
        if (m.pickup) {
          var p = [m.pickup.longitude, m.pickup.latitude];
          if (__pickupMarker) {
            __pickupMarker.setLngLat(p);
          } else {
            __pickupMarker = new maplibregl.Marker({
              element: makePickupEl(),
              anchor: 'center',
            })
              .setLngLat(p)
              .addTo(__map);
          }
        } else if (__pickupMarker) {
          __pickupMarker.remove();
          __pickupMarker = null;
        }
        if (m.dropoff) {
          var d = [m.dropoff.longitude, m.dropoff.latitude];
          if (__dropoffMarker) {
            __dropoffMarker.setLngLat(d);
          } else {
            __dropoffMarker = new maplibregl.Marker({
              element: makeDropoffEl(),
              anchor: 'center',
            })
              .setLngLat(d)
              .addTo(__map);
          }
        } else if (__dropoffMarker) {
          __dropoffMarker.remove();
          __dropoffMarker = null;
        }
      }

      function ensureRouteLayer() {
        // Источник и слой добавляются один раз после style.load. До
        // этого setRoute складывает данные в pending, и они применяются
        // как только стиль загрузился.
        if (!__map || !__styleLoaded || __map.getSource('route')) return;
        __map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        });
        __map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '${DriverColors.primary}', 'line-width': 9 },
        });
      }

      var __pendingRoute = null;
      function setRoute(coords) {
        if (!__map) return;
        if (!__styleLoaded) {
          __pendingRoute = coords;
          return;
        }
        ensureRouteLayer();
        var data = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords && coords.length > 1 ? coords : [] },
        };
        var src = __map.getSource('route');
        if (src) src.setData(data);
      }

      function setCenter(loc, opts) {
        if (!__map) return;
        // Override lock: водитель отпанил карту, GPS/compass-тики не
        // должны её ёрзать обратно. Lock снимается только по явной
        // команде clearOverride (тап «Вернуться к маршруту»).
        if (__userOverride) return;
        // easeTo вместо setCenter+setZoom+setBearing — навигационная
        // камера плавно интерполируется (~600мс по умолчанию) вместо
        // дёрганых jump'ов на каждый GPS-апдейт. duration в opts
        // переопределяет; 0 = instant (для первого центрирования или
        // resync после ремаунта).
        var animOpts = { center: [loc.longitude, loc.latitude], essential: true };
        if (opts && typeof opts.zoom === 'number') animOpts.zoom = opts.zoom;
        if (opts && typeof opts.bearing === 'number') animOpts.bearing = opts.bearing;
        if (opts && typeof opts.pitch === 'number') animOpts.pitch = opts.pitch;
        animOpts.duration = (opts && typeof opts.duration === 'number') ? opts.duration : 600;
        __map.easeTo(animOpts);
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
        __map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
          padding: { top: pad, right: pad, bottom: pad, left: pad },
          duration: 600,
        });
      }

      window.applyCommand = function (cmd) {
        try {
          switch (cmd.type) {
            case 'setDriver': setDriver(cmd); break;
            case 'setMarkers': setMarkers(cmd); break;
            case 'setRoute': setRoute(cmd.coordinates); break;
            case 'setCenter': setCenter(cmd, cmd.opts); break;
            case 'setPitch':
              if (__userOverride) break;
              if (__map && typeof cmd.pitch === 'number') __map.setPitch(cmd.pitch);
              break;
            case 'fitBounds':
              if (__userOverride) break;
              fitBounds(cmd.coordinates, cmd.padding);
              break;
            case 'clearOverride': __userOverride = false; break;
          }
        } catch (e) {
          post({ type: 'error', message: String(e && e.message ? e.message : e) });
        }
      };

      function init() {
        try {
          if (!'${apiKey}' || '${apiKey}'.length === 0) {
            post({ type: 'error', message: 'MapTiler key пустой (EXPO_PUBLIC_MAPTILER_KEY не попал в сборку)' });
            return;
          }
          var styleUrl = 'https://api.maptiler.com/maps/${styleName}/style.json?key=${apiKey}';
          __map = new maplibregl.Map({
            container: 'map',
            style: styleUrl,
            center: ${JSON.stringify(center)},
            zoom: ${zoom},
            // 3D-вид как стартовое состояние карты во всём приложении.
            // На zoom 15+ MapTiler streets-v2 экструдирует здания.
            pitch: 45,
            attributionControl: false,
            // Тачи: позволяем pinch/pan/rotate. Стандартный набор
            // MapLibre — то что и было в 2GIS.
          });
          // ready постим на 'load' (стиль и все sources загружены) —
          // только после этого можно безопасно addSource/addLayer для
          // маршрута. setDriver работает раньше через Marker, но route
          // нуждается в стилях.
          __map.on('load', function () {
            __styleLoaded = true;
            ensureRouteLayer();
            if (__pendingRoute) {
              setRoute(__pendingRoute);
              __pendingRoute = null;
            }
            post({ type: 'ready' });
          });
          __map.on('error', function (e) {
            // MapLibre 'error' event приходит с полем .error — Error
            // объектом с message/stack. Сериализуем глубже и добавляем
            // последние failed-сетевые вызовы из перехватчика выше.
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
            if (e && e.error && e.error.message) parts.push('msg=' + e.error.message);
            var net = window.__mapNetLog || [];
            for (var i = net.length - 1; i >= 0 && i >= net.length - 3; i--) {
              if (net[i].failed) {
                parts.push('net=' + (net[i].status || 'fail') + ' ' + net[i].url.slice(0, 80));
              }
            }
            post({ type: 'error', message: 'MapLibre: ' + parts.join(' | ') });
          });
          // Реальные user-жесты (drag/rotate/pitch). touchstart не
          // нужен — он фаерится и на простые тапы (на маркер, мимо
          // карты), из-за чего override-lock защёлкивался даже когда
          // водитель карту не двигал, и камера переставала следовать.
          ['dragstart', 'rotatestart', 'pitchstart'].forEach(function (ev) {
            __map.on(ev, function (e) {
              if (!e || !e.originalEvent) return;
              __userOverride = true;
              if (!__gestureSent) {
                __gestureSent = true;
                post({ type: 'gesture' });
                setTimeout(function () { __gestureSent = false; }, 400);
              }
            });
          });
        } catch (e) {
          post({ type: 'error', message: String(e && e.message ? e.message : e) });
        }
      }

      // maplibregl грузится async — poll коротко пока не появится.
      var __tries = 0;
      function waitForLib() {
        if (typeof maplibregl !== 'undefined') {
          init();
          return;
        }
        __tries++;
        if (__tries > 80) {
          post({ type: 'error', message: 'maplibregl failed to load' });
          return;
        }
        setTimeout(waitForLib, 100);
      }
      waitForLib();
    </script>
  </body>
</html>`;
}

const MapLibreMapView = forwardRef<MapLibreMapHandle, Props>(function MapLibreMapView(
  {
    initialCenter = MAP_DEFAULT_CENTER,
    initialZoom = MAP_DEFAULT_ZOOM,
    onReady,
    onUserGesture,
    style,
  },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  // Commands, выданные до 'ready', складываются в очередь и
  // воспроизводятся когда страница загрузится.
  const queueRef = useRef<object[]>([]);
  // Видимая диагностика — иначе при пустом MAPTILER_KEY или ошибках
  // init у пользователя был бы просто чёрный квадрат без понимания.
  const keyMissing = MAPTILER_KEY.length === 0;
  const [initError, setInitError] = useState<string | null>(null);
  // MIUI / Doze регулярно убивают WebView render-процесс когда app в
  // фоне. Меняем remountKey → WebView пересоздаётся, новый рендер-
  // процесс стартует, init() в HTML отрабатывает заново. Overlay
  // показываем только если ремаунт случился больше 3-х раз подряд.
  const [remountKey, setRemountKey] = useState(0);
  const recoveryAttemptsRef = useRef(0);

  // initialCenter обычно передаётся inline-массивом из родителя — на
  // каждый GPS-апдейт это новый референс, useMemo пересоздавал бы html,
  // WebView получал бы новый source и перезагружал страницу целиком (с
  // повторным скачиванием MapLibre из CDN). Замораживаем значения,
  // увиденные на маунте — это и есть смысл слова "initial".
  const frozenCenterRef = useRef<[number, number]>(initialCenter);
  const frozenZoomRef = useRef<number>(initialZoom);
  const html = useMemo(
    () =>
      buildHtml(
        MAPTILER_KEY,
        MAPTILER_STYLE,
        frozenCenterRef.current,
        frozenZoomRef.current,
      ),
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
      clearOverride: () => dispatch({ type: 'clearOverride' }),
    }),
    [dispatch],
  );

  const lastMessageRef = useRef<number>(Date.now());
  const handleMessage = useCallback(
    (event: WebViewMessageEvent): void => {
      lastMessageRef.current = Date.now();
      try {
        const data = JSON.parse(event.nativeEvent.data) as { type: string; message?: string };
        if (data.type === 'ready') {
          readyRef.current = true;
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
          console.warn('[MapLibreMapView] map error:', data.message);
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
        source={{ html, baseUrl: 'https://localhost/' }}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        thirdPartyCookiesEnabled
        cacheEnabled
        // LOAD_CACHE_ELSE_NETWORK заставляет Android WebView сначала
        // взять MapLibre JS и тайлы из дискового кеша, и обращаться к
        // CDN только если в кеше пусто.
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
          attemptRemount('content process terminated');
        }}
        onRenderProcessGone={() => {
          attemptRemount('renderer gone');
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={DriverColors.primary} />
          </View>
        )}
        style={styles.webview}
        // MapLibre рендерится в WebGL canvas — нужен hardware layer.
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
              ? 'EXPO_PUBLIC_MAPTILER_KEY не попал в сборку. Получите ключ на https://cloud.maptiler.com/account/keys/ (бесплатный tier 100k загрузок/мес) и положите в mobile/.env, затем пересоберите APK.'
              : initError}
          </Text>
          {!keyMissing && (
            <Text style={[Typography.caption, styles.errorBody, { marginTop: 8, opacity: 0.6 }]}>
              key …{MAPTILER_KEY.slice(-4)} (len {MAPTILER_KEY.length})
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

export default MapLibreMapView;

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
