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
import { ClientColors, Typography } from '@taxi/shared';
import {
  MAPTILER_KEY,
  MAPTILER_STYLE,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
} from '../lib/mapLibreConfig';

export type LatLng = { latitude: number; longitude: number };

export type MapLibreMapHandle = {
  // Аналог react-native-maps animateToRegion — летим к точке с
  // плавной анимацией. Принимает deltaApprox (~latitudeDelta из старой
  // прошивки) и конвертирует в zoom: при delta=0.005 → zoom ~16.
  animateToRegion: (
    center: LatLng,
    durationMs?: number,
    deltaApprox?: number,
  ) => void;
};

type Props = {
  initialCenter?: [number, number];
  initialZoom?: number;
  paddingBottom?: number;
  paddingTop?: number;
  // GPS клиента — отдельная синяя точка с пульсом, как showsUserLocation
  // в react-native-maps. null = не показывать (нет fix'а).
  userLocation?: LatLng | null;
  // Pickup-метка, контролируемая снаружи (родитель хранит state).
  pickup?: LatLng | null;
  pickupDraggable?: boolean;
  onPickupDragEnd?: (coord: LatLng) => void;
  // Координаты водителя + опциональный heading из Pusher-broadcast'а
  // (driver-app шлёт GPS-курс). Если heading отсутствует — WebView
  // вычисляет bearing локально из двух последних позиций. Маркер
  // плавно интерполируется (~1200мс) между фиксами.
  driver?: (LatLng & { heading?: number | null }) | null;
  style?: object;
  onReady?: () => void;
};

// HTML+JS для клиентского WebView. Отличия от драйверского:
// - тёмный стиль (streets-v2-dark)
// - draggable pickup pin с onDragEnd
// - пульсирующая синяя точка пользователя (отдельный Marker)
// - smooth-tween для маркера водителя через requestAnimationFrame
function buildHtml(apiKey: string, styleName: string, center: [number, number], zoom: number): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
    <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
    <style>
      html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #13111f; }
      .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right,
      .maplibregl-ctrl-top-left, .maplibregl-ctrl-top-right { display: none !important; }
      /* Pickup pin: классический teardrop (Google-Maps style). Острый
         кончик внизу — анкор 'bottom' ставит его прямо на координату
         подачи. Раньше был triangle-up + stem, визуально неотличимый
         от nav-стрелки направления → клиент видел свой user-dot и
         pickup в одном месте как «двойной навигатор». */
      .pickup-pin {
        width: 32px; height: 44px;
        filter: drop-shadow(0 3px 5px rgba(0,0,0,0.5));
      }
      .pickup-pin svg { width: 32px; height: 44px; display: block; }
      /* Синяя точка пользователя с пульсирующим ореолом —
         showsUserLocation эквивалент. */
      .user-dot { position: relative; width: 24px; height: 24px; }
      .user-dot-core {
        position: absolute; left: 50%; top: 50%;
        width: 14px; height: 14px; margin: -7px 0 0 -7px;
        border-radius: 50%;
        background: #1E40AF;
        border: 2.5px solid #fff;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .user-dot-pulse {
        position: absolute; left: 50%; top: 50%;
        width: 14px; height: 14px; margin: -7px 0 0 -7px;
        border-radius: 50%;
        background: rgba(30, 64, 175, 0.4);
        animation: pulse 2s ease-out infinite;
      }
      @keyframes pulse {
        0% { transform: scale(1); opacity: 0.7; }
        100% { transform: scale(3); opacity: 0; }
      }
      /* Маркер водителя — стилизованное такси. SVG взят из бывшего
         AnimatedDriverMarker.tsx, переведён в inline-HTML. Поворот
         через CSS rotate(deg) у внутреннего div'a. */
      .driver-marker {
        width: 56px; height: 56px;
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));
      }
      .driver-marker svg { width: 100%; height: 100%; }
    </style>
    <script>
      // Сетевой перехватчик — диагностика MapTiler / unpkg сбоев,
      // та же логика что в driver-приложении.
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
          var isMap = /maptiler\\.com|unpkg\\.com\\/maplibre/.test(url);
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
      })();
    </script>
    <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var __map = null;
      var __pickupMarker = null;
      var __userMarker = null;
      var __driverMarker = null;
      var __driverPrev = null;
      var __driverTweenRaf = null;
      var __styleLoaded = false;
      var __padding = { top: 0, bottom: 0, left: 0, right: 0 };

      function post(payload) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function makePickupEl() {
        // Teardrop pin — голова сверху, остриё снизу (anchor='bottom'
        // ставит остриё точно на координату подачи). Визуально это
        // явный «pin», не путается с user-dot и не выглядит как
        // навигаторская стрелка-направление.
        var el = document.createElement('div');
        el.className = 'pickup-pin';
        el.innerHTML =
          '<svg viewBox="0 0 32 44" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M16 2 C 8 2 2 8 2 16 C 2 24 16 42 16 42 C 16 42 30 24 30 16 C 30 8 24 2 16 2 Z" ' +
              'fill="${ClientColors.pickupBadge}" stroke="#fff" stroke-width="2.5"/>' +
            '<circle cx="16" cy="16" r="5.5" fill="#fff"/>' +
            '<circle cx="16" cy="16" r="3" fill="${ClientColors.pickupDark}"/>' +
          '</svg>';
        return el;
      }

      function makeUserDotEl() {
        var el = document.createElement('div');
        el.className = 'user-dot';
        el.innerHTML = '<div class="user-dot-pulse"></div><div class="user-dot-core"></div>';
        return el;
      }

      function makeDriverEl(rotationDeg) {
        // Top-down sedan SVG. Перед машины — наверх (направление движения).
        var rot = (rotationDeg == null || isNaN(rotationDeg)) ? 0 : rotationDeg;
        var el = document.createElement('div');
        el.className = 'driver-marker';
        el.innerHTML =
          '<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(' + rot + 'deg)">' +
            '<defs>' +
              '<linearGradient id="bodyG" x1="0.5" y1="0" x2="0.5" y2="1">' +
                '<stop offset="0" stop-color="#FCD34D"/>' +
                '<stop offset="0.45" stop-color="#F59E0B"/>' +
                '<stop offset="1" stop-color="#92400E"/>' +
              '</linearGradient>' +
              '<linearGradient id="glassG" x1="0.5" y1="0" x2="0.5" y2="1">' +
                '<stop offset="0" stop-color="#0B1220" stop-opacity="0.95"/>' +
                '<stop offset="1" stop-color="#1E3A8A" stop-opacity="0.7"/>' +
              '</linearGradient>' +
              '<linearGradient id="hiG" x1="0" y1="0" x2="1" y2="0">' +
                '<stop offset="0" stop-color="#fff" stop-opacity="0.0"/>' +
                '<stop offset="0.5" stop-color="#fff" stop-opacity="0.18"/>' +
                '<stop offset="1" stop-color="#fff" stop-opacity="0.0"/>' +
              '</linearGradient>' +
            '</defs>' +
            // Тень под машиной
            '<ellipse cx="28" cy="52" rx="16" ry="2.5" fill="#000" opacity="0.32"/>' +
            // Колёса (чёрные прямоугольники в углах)
            '<rect x="12" y="11" width="4" height="8" rx="1.2" fill="#0F172A"/>' +
            '<rect x="40" y="11" width="4" height="8" rx="1.2" fill="#0F172A"/>' +
            '<rect x="12" y="37" width="4" height="8" rx="1.2" fill="#0F172A"/>' +
            '<rect x="40" y="37" width="4" height="8" rx="1.2" fill="#0F172A"/>' +
            // Кузов седана с амбер-градиентом, плавные front/rear обводы
            '<path d="M17 8 Q17 4 22 4 L34 4 Q39 4 39 8 L40 26 L40 32 L39 48 Q39 52 34 52 L22 52 Q17 52 17 48 L16 32 L16 26 Z" fill="url(#bodyG)" stroke="#451A03" stroke-width="0.8"/>' +
            // Боковые зеркала — маленькие выступы по бортам
            '<path d="M15 14 Q12 14 13 17 Q15 17 16 16 Z" fill="#451A03"/>' +
            '<path d="M41 14 Q44 14 43 17 Q41 17 40 16 Z" fill="#451A03"/>' +
            // Лобовое стекло (трапеция к капоту)
            '<path d="M19 10 L37 10 L35 22 L21 22 Z" fill="url(#glassG)" stroke="#0B1220" stroke-width="0.4"/>' +
            // Заднее стекло
            '<path d="M21 38 L35 38 L37 50 L19 50 Z" fill="url(#glassG)" stroke="#0B1220" stroke-width="0.4" opacity="0.92"/>' +
            // Roof — тонкая темная панель между стёклами
            '<rect x="21" y="22" width="14" height="16" rx="1" fill="#92400E" opacity="0.55"/>' +
            // Reflection highlight на крыше
            '<rect x="22" y="24" width="12" height="2" rx="1" fill="url(#hiG)"/>' +
            // Хром-line по борту (тонкий блик)
            '<rect x="16.5" y="28" width="0.6" height="6" fill="#FEF3C7" opacity="0.7"/>' +
            '<rect x="38.9" y="28" width="0.6" height="6" fill="#FEF3C7" opacity="0.7"/>' +
            // LED-фары спереди (тёплый белый, лёгкое свечение через rx)
            '<rect x="18.5" y="4.5" width="4" height="1.6" rx="0.6" fill="#FEF9C3"/>' +
            '<rect x="33.5" y="4.5" width="4" height="1.6" rx="0.6" fill="#FEF9C3"/>' +
            // Стоп-сигналы сзади (красно-оранжевые)
            '<rect x="18.5" y="50.5" width="4" height="1.4" rx="0.6" fill="#EF4444"/>' +
            '<rect x="33.5" y="50.5" width="4" height="1.4" rx="0.6" fill="#EF4444"/>' +
          '</svg>';
        return el;
      }

      function setPickup(loc, draggable) {
        if (!__map) return;
        if (!loc) {
          if (__pickupMarker) { __pickupMarker.remove(); __pickupMarker = null; }
          return;
        }
        var coord = [loc.longitude, loc.latitude];
        if (__pickupMarker) {
          __pickupMarker.setLngLat(coord);
          // setDraggable не существует, drag-флаг ставится при создании.
          // Если меняется — пересоздаём.
          if (__pickupMarker._draggable !== !!draggable) {
            __pickupMarker.remove();
            __pickupMarker = null;
          } else {
            return;
          }
        }
        __pickupMarker = new maplibregl.Marker({
          element: makePickupEl(),
          anchor: 'bottom',
          draggable: !!draggable,
        }).setLngLat(coord).addTo(__map);
        __pickupMarker._draggable = !!draggable;
        if (draggable) {
          __pickupMarker.on('dragend', function () {
            var ll = __pickupMarker.getLngLat();
            post({ type: 'pickup-drag', latitude: ll.lat, longitude: ll.lng });
          });
        }
      }

      function setUser(loc) {
        if (!__map) return;
        if (!loc) {
          if (__userMarker) { __userMarker.remove(); __userMarker = null; }
          return;
        }
        var coord = [loc.longitude, loc.latitude];
        if (__userMarker) {
          __userMarker.setLngLat(coord);
        } else {
          __userMarker = new maplibregl.Marker({
            element: makeUserDotEl(),
            anchor: 'center',
          }).setLngLat(coord).addTo(__map);
        }
      }

      function computeBearing(from, to) {
        var toRad = function (d) { return d * Math.PI / 180; };
        var lat1 = toRad(from.latitude);
        var lat2 = toRad(to.latitude);
        var dLng = toRad(to.longitude - from.longitude);
        var y = Math.sin(dLng) * Math.cos(lat2);
        var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        var b = Math.atan2(y, x) * 180 / Math.PI;
        return (b + 360) % 360;
      }

      function setDriver(loc) {
        if (!__map) return;
        if (!loc) {
          if (__driverMarker) { __driverMarker.remove(); __driverMarker = null; }
          __driverPrev = null;
          if (__driverTweenRaf) cancelAnimationFrame(__driverTweenRaf);
          __driverTweenRaf = null;
          return;
        }
        var from = __driverPrev;
        var to = { latitude: loc.latitude, longitude: loc.longitude };
        // Bearing: приоритет heading из payload (это GPS-курс с самого
        // устройства водителя, точнее чем наш local-compute). Если null
        // — fallback на азимут между двумя последними фиксами с порогом
        // ~3м чтобы GPS-джиттер не крутил иконку в стоячем состоянии.
        var bearing = (__driverMarker && __driverMarker._lastBearing) || 0;
        if (typeof loc.heading === 'number' && loc.heading >= 0) {
          bearing = loc.heading;
        } else if (from) {
          var dLat = Math.abs(to.latitude - from.latitude);
          var dLng = Math.abs(to.longitude - from.longitude);
          if (dLat > 0.00003 || dLng > 0.00003) {
            bearing = computeBearing(from, to);
          }
        }
        if (!__driverMarker) {
          __driverMarker = new maplibregl.Marker({
            element: makeDriverEl(bearing),
            anchor: 'center',
          }).setLngLat([to.longitude, to.latitude]).addTo(__map);
          __driverMarker._lastBearing = bearing;
          __driverPrev = to;
          return;
        }
        __driverMarker._lastBearing = bearing;
        // Обновляем rotation у внутреннего svg.
        var svg = __driverMarker.getElement().querySelector('svg');
        if (svg) svg.style.transform = 'rotate(' + bearing + 'deg)';
        // Smooth-tween от текущей позиции к новой за 700мс. Раньше было
        // 1200мс при апдейтах раз в ~2с — RAF был активен большую часть
        // времени и грел WebView. 700мс хватает чтобы глаз воспринял как
        // плавное движение, и оставляет 1.3с «отдыха» между апдейтами.
        if (__driverTweenRaf) cancelAnimationFrame(__driverTweenRaf);
        var start = __driverMarker.getLngLat();
        var startTs = null;
        var duration = 700;
        function step(ts) {
          if (startTs === null) startTs = ts;
          var t = Math.min(1, (ts - startTs) / duration);
          var lng = start.lng + (to.longitude - start.lng) * t;
          var lat = start.lat + (to.latitude - start.lat) * t;
          __driverMarker.setLngLat([lng, lat]);
          if (t < 1) {
            __driverTweenRaf = requestAnimationFrame(step);
          } else {
            __driverTweenRaf = null;
            __driverPrev = to;
          }
        }
        __driverTweenRaf = requestAnimationFrame(step);
      }

      function setPadding(p) {
        __padding = {
          top: p.top || 0,
          bottom: p.bottom || 0,
          left: p.left || 0,
          right: p.right || 0,
        };
        if (__map && __map.setPadding) {
          __map.setPadding(__padding);
        }
      }

      function deltaToZoom(delta) {
        // react-native-maps delta → MapLibre zoom: latitudeDelta 0.005 ≈ zoom 16,
        // 0.01 ≈ 15, 0.05 ≈ 13. Логарифмический закон, эмпирический.
        if (!delta || delta <= 0) return 14;
        return Math.max(2, Math.min(20, Math.log2(360 / delta) - 1));
      }

      function animateToRegion(loc, durationMs, deltaApprox) {
        if (!__map) return;
        var opts = {
          center: [loc.longitude, loc.latitude],
          duration: typeof durationMs === 'number' ? durationMs : 400,
          essential: true,
        };
        if (typeof deltaApprox === 'number') {
          opts.zoom = deltaToZoom(deltaApprox);
        }
        __map.easeTo(opts);
      }

      window.applyCommand = function (cmd) {
        try {
          switch (cmd.type) {
            case 'setPickup': setPickup(cmd.coord, cmd.draggable); break;
            case 'setUser': setUser(cmd.coord); break;
            case 'setDriver': setDriver(cmd.coord); break;
            case 'setPadding': setPadding(cmd.padding); break;
            case 'animateToRegion': animateToRegion(cmd.coord, cmd.duration, cmd.delta); break;
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
            attributionControl: false,
          });
          __map.on('load', function () {
            __styleLoaded = true;
            post({ type: 'ready' });
          });
          __map.on('error', function (e) {
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
            post({ type: 'error', message: 'MapLibre: ' + parts.join(' | ') });
          });
        } catch (e) {
          post({ type: 'error', message: String(e && e.message ? e.message : e) });
        }
      }

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
    paddingBottom = 0,
    paddingTop = 0,
    userLocation = null,
    pickup = null,
    pickupDraggable = false,
    onPickupDragEnd,
    driver = null,
    style,
    onReady,
  },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const queueRef = useRef<object[]>([]);
  const keyMissing = MAPTILER_KEY.length === 0;
  const [initError, setInitError] = useState<string | null>(null);
  const [remountKey, setRemountKey] = useState(0);
  const recoveryAttemptsRef = useRef(0);

  // Замораживаем initial — родитель передаёт inline-объект на каждый
  // GPS-апдейт; без заморозки useMemo пересчитывал бы html и WebView
  // перезагружал страницу полностью.
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

  const attemptRemount = useCallback((reason: string): void => {
    recoveryAttemptsRef.current += 1;
    if (recoveryAttemptsRef.current > 3) {
      setInitError(`WebView постоянно падает (${reason}). Перезапустите приложение.`);
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
      animateToRegion: (center, durationMs, deltaApprox) =>
        dispatch({
          type: 'animateToRegion',
          coord: center,
          duration: durationMs,
          delta: deltaApprox,
        }),
    }),
    [dispatch],
  );

  // Прокидываем все controlled-props в WebView. Каждое изменение
  // → один command. Команды выданные до ready копятся и
  // воспроизводятся на ready-сигнале.
  useEffect(() => {
    dispatch({ type: 'setUser', coord: userLocation });
  }, [userLocation, dispatch]);

  useEffect(() => {
    dispatch({ type: 'setPickup', coord: pickup, draggable: pickupDraggable });
  }, [pickup, pickupDraggable, dispatch]);

  useEffect(() => {
    dispatch({ type: 'setDriver', coord: driver });
  }, [driver, dispatch]);

  useEffect(() => {
    dispatch({
      type: 'setPadding',
      padding: { top: paddingTop, bottom: paddingBottom, left: 0, right: 0 },
    });
  }, [paddingTop, paddingBottom, dispatch]);

  const lastMessageRef = useRef<number>(Date.now());
  const handleMessage = useCallback(
    (event: WebViewMessageEvent): void => {
      lastMessageRef.current = Date.now();
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type: string;
          message?: string;
          latitude?: number;
          longitude?: number;
        };
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
        } else if (data.type === 'pickup-drag') {
          if (
            typeof data.latitude === 'number' &&
            typeof data.longitude === 'number' &&
            onPickupDragEnd
          ) {
            onPickupDragEnd({ latitude: data.latitude, longitude: data.longitude });
          }
        } else if (data.type === 'error') {
          // eslint-disable-next-line no-console
          console.warn('[client/MapLibreMapView] map error:', data.message);
          setInitError(data.message ?? 'Не удалось загрузить карту');
        }
      } catch {
        // Malformed — ignore.
      }
    },
    [onReady, onPickupDragEnd],
  );

  useEffect(() => {
    return () => {
      readyRef.current = false;
      queueRef.current = [];
    };
  }, []);

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
        onContentProcessDidTerminate={() => attemptRemount('content process terminated')}
        onRenderProcessGone={() => attemptRemount('renderer gone')}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={ClientColors.primary} />
          </View>
        )}
        style={styles.webview}
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
              ? 'EXPO_PUBLIC_MAPTILER_KEY не попал в сборку. Получите ключ на https://cloud.maptiler.com/account/keys/ и положите в mobile/.env, затем пересоберите APK.'
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
    backgroundColor: '#13111f',
  },
  webview: {
    flex: 1,
    backgroundColor: '#13111f',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#13111f',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#13111f',
  },
  errorTitle: {
    color: ClientColors.danger,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    color: ClientColors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
