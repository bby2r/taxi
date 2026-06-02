import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
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
        width: 36px; height: 36px;
        display: flex; align-items: center; justify-content: center;
        transform-origin: center;
        will-change: transform;
      }
      .driver-pin svg { width: 100%; height: 100%; }
      .pickup-pin, .dropoff-pin {
        width: 22px; height: 22px;
        border-radius: 50%;
        border: 4px solid #fff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      }
      .pickup-pin { background: ${DriverColors.primary}; }
      .dropoff-pin { background: ${DriverColors.success}; }
    </style>
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
        return '<div class="driver-pin" style="transform: rotate(' + rot + 'deg)">' +
          '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M12 2 L20 22 L12 18 L4 22 Z" fill="${DriverColors.primary}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>' +
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
              html: '<div class="pickup-pin"></div>',
              anchor: [11, 11],
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
              var msg = e && (e.message || e.type) ? (e.message || e.type) : 'mapgl error';
              post({ type: 'error', message: 'MapGL: ' + msg });
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

  const html = useMemo(
    () => buildHtml(TWOGIS_API_KEY, initialCenter, initialZoom),
    [initialCenter, initialZoom],
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

  useImperativeHandle(
    ref,
    () => ({
      setDriver: (loc) => dispatch({ type: 'setDriver', ...loc }),
      setMarkers: (m) => dispatch({ type: 'setMarkers', ...m }),
      setRoute: (coordinates) => dispatch({ type: 'setRoute', coordinates }),
      setCenter: (loc, opts) => dispatch({ type: 'setCenter', ...loc, opts }),
      fitBounds: (coordinates, padding) => dispatch({ type: 'fitBounds', coordinates, padding }),
    }),
    [dispatch],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent): void => {
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

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://mapgl.2gis.com' }}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        thirdPartyCookiesEnabled
        cacheEnabled
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
          setInitError('WebView рендер-процесс упал (MIUI / OOM). Перезапустите приложение.');
        }}
        onRenderProcessGone={() => {
          setInitError('WebView рендер убит системой (MIUI/Doze). Перезапустите приложение.');
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={DriverColors.primary} />
          </View>
        )}
        style={styles.webview}
        // androidLayerType="hardware" даёт чёрный квадрат на Xiaomi/MIUI
        // вместо HTML контента — GPU-сёрфейс WebView не композитится.
        // Software-режим стабильнее, потеря fps пренебрежимо мала для
        // статической карты с редкими ререндерами.
        androidLayerType="software"
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
