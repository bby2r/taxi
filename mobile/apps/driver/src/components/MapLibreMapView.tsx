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
    opts?: {
      zoom?: number;
      bearing?: number;
      pitch?: number;
      duration?: number;
      // linear: constant-speed easing so back-to-back follow updates chain
      // into one continuous glide instead of easing-in/out (and pausing) at
      // every GPS fix.
      linear?: boolean;
    },
  ) => void;
  // Feed the continuous follow loop a new target. The loop interpolates the
  // camera + driver marker toward it every frame (smooth, Yandex-style)
  // instead of animating per GPS fix. Call ~1Hz; the loop renders at 60fps.
  // velLng/velLat are the Kalman-filtered velocity (degrees per millisecond)
  // used to dead-reckon the camera between fixes — pass them so the loop
  // doesn't have to re-derive a (noisier) velocity from target deltas.
  setFollowTarget: (
    target: LatLng & {
      bearing?: number;
      zoom?: number;
      pitch?: number;
      velLng?: number;
      velLat?: number;
    },
  ) => void;
  // Stop the follow loop (overview / arrived / unmount).
  stopFollow: () => void;
  setPitch: (pitch: number) => void;
  fitBounds: (coordinates: Array<[number, number]>, paddingPx?: number) => void;
  // Снимает override-lock который ставится при тач-жесте: пока он
  // активен, setCenter/setPitch/fitBounds — no-op'ы. Вызывается RN
  // при тапе «Вернуться к маршруту», чтобы камера снова следовала.
  clearOverride: () => void;
  // Атомарный recenter — один диспатч, который внутри WebView
  // в одной синхронной операции: сбрасывает __userOverride и __follow,
  // делает jumpTo + placeDriver на цель, переинициализирует follow loop.
  // Чтобы избежать race condition: между отдельными командами
  // (stopFollow + clearOverride + setCenter + setFollowTarget) случайный
  // touch-event мог снова поднять __userOverride=true, блокируя setCenter
  // и оставляя камеру висеть в углу. Здесь это невозможно.
  recenterTo: (
    target: LatLng & {
      bearing?: number;
      zoom?: number;
      pitch?: number;
    },
  ) => void;
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
      // Continuous follow loop state. __follow holds the smoothed CURRENT
      // camera (cc/cb) and the latest TARGET (tc/tb) coming from RN at GPS
      // rate; followStep() lerps current→target every animation frame so the
      // map glides like a real navigator instead of lurching per GPS fix.
      var __follow = null;
      var __followRaf = null;

      function post(payload) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function makeDriverEl(heading) {
        // Яндекс-style стрелка: яркий синий конус с белой обводкой
        // (читается на любой подложке), мягкая тень-эллипс под ним
        // имитирует поднятие над картой. Поворот — CSS transform на
        // div'е (MapLibre ставит translate на wrapper Marker'а).
        var rot = (heading == null || isNaN(heading)) ? 0 : heading;
        var el = document.createElement('div');
        el.className = 'driver-pin';
        el.style.transform = 'rotate(' + rot + 'deg)';
        el.innerHTML =
          '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
            // Контактная тень-эллипс — отрывает стрелку от карты
            '<ellipse cx="24" cy="36" rx="12" ry="3" fill="#000" opacity="0.22"/>' +
            // Белая обводка конуса (рисуется чуть шире контура)
            '<path d="M24 4 L37 34 L24 28 L11 34 Z" fill="#fff"/>' +
            // Правая грань — затемнённая, даёт объём
            '<path d="M24 7 L35 33 L24 28 Z" fill="#1E40AF"/>' +
            // Левая грань — основной синий
            '<path d="M24 7 L13 33 L24 28 Z" fill="#3B82F6"/>' +
            // Световой блик по килю — добавляет «3D»
            '<path d="M24 7 L24 28" stroke="#fff" stroke-width="1.2" opacity="0.6"/>' +
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
        // Источник и два слоя — casing (тёмная обводка) + main (яркая
        // середина). Двухслойная линия = «трамвайный путь» как в Яндекс/
        // 2GIS: дорога читается на любом фоне и при любом наклоне камеры,
        // потому что край и середина контрастируют независимо от подложки.
        // Слои добавляются один раз после style.load. До этого setRoute
        // складывает данные в __pendingRoute и применяет их когда стиль
        // загрузится.
        if (!__map || !__styleLoaded || __map.getSource('route')) return;
        __map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        });
        __map.addLayer({
          id: 'route-casing',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#0B3B82', 'line-width': 12, 'line-opacity': 0.9 },
        });
        __map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '${DriverColors.primary}', 'line-width': 7 },
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
        // Linear (constant-speed) easing for the follow camera: with the
        // duration set just above the ~1s GPS interval, each fix's easeTo
        // takes over the previous one mid-flight, so the map glides
        // continuously instead of easing-in, stopping, and lurching again
        // every second (the default ease-out does exactly that).
        if (opts && opts.linear) {
          animOpts.easing = function (t) { return t; };
        }
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

      // Shared driver-marker placement, used by both the follow loop (nav)
      // and setDriver (overview). Creates on first use, otherwise just
      // moves/rotates — no DOM rebuild.
      function placeDriver(lng, lat, rotDeg) {
        if (!__map) return;
        var rot = (rotDeg == null || isNaN(rotDeg)) ? 0 : rotDeg;
        if (!__driverMarker) {
          __driverMarker = new maplibregl.Marker({ element: makeDriverEl(rot), anchor: 'center' })
            .setLngLat([lng, lat]).addTo(__map);
          return;
        }
        __driverMarker.setLngLat([lng, lat]);
        __driverMarker.getElement().style.transform = 'rotate(' + rot + 'deg)';
      }

      // Per-frame lerp factors. POS is deliberately gentle: the camera never
      // snaps to the ~1Hz target, it eases toward it continuously, so the map
      // flows at a steady speed with no per-fix hard stop. The lerp itself IS
      // the low-pass filter on position + bearing. DEAD ignores sub-threshold
      // heading changes so the map doesn't shimmer on tiny direction noise.
      // Per-frame chase factors. Because the target is dead-reckoned forward
      // (below) it moves continuously, so these can be tight — low lag AND
      // smooth. DEAD ignores sub-threshold heading noise so the map never
      // shimmers on a jittery bearing.
      var FOLLOW_POS_A = 0.10;
      var FOLLOW_BRG_A = 0.12;
      var FOLLOW_DEAD_DEG = 4; // ignore sub-4° heading wobble so the map doesn't shimmer on low-speed GPS noise
      var PREDICT_MAX_MS = 1500; // clamp dead-reckoning so a dropped fix can't run away
      var VEL_EMA = 0.4; // legacy fallback only (used when RN sends no velocity)
      // Padding смещает логический центр камеры вверх, чтобы driver-маркер
      // оказывался НАД bottom sheet'ом (~48% экрана). Без padding center
      // оказывается ровно посреди экрана — под sheet'ом, маркер не виден
      // и визуально кажется, что он «пропал в угол».
      var NAV_PADDING = { top: 80, bottom: 380, left: 0, right: 0 };

      function perfNow() {
        return (window.performance && performance.now) ? performance.now() : Date.now();
      }

      function followStep() {
        __followRaf = null;
        if (!__follow || !__map || __userOverride) return;
        var f = __follow;
        // Dead-reckoning: extrapolate the last real target forward along the
        // measured velocity so the camera tracks where the car *is now*
        // between 1Hz fixes — this is what removes turn/lag without the map
        // reacting to every sensor tick.
        var dt = perfNow() - f.baseTs;
        if (dt < 0) dt = 0;
        if (dt > PREDICT_MAX_MS) dt = PREDICT_MAX_MS;
        var ex0 = f.baseTc[0] + (f.vel ? f.vel[0] * dt : 0);
        var ex1 = f.baseTc[1] + (f.vel ? f.vel[1] * dt : 0);
        f.cc[0] += (ex0 - f.cc[0]) * FOLLOW_POS_A;
        f.cc[1] += (ex1 - f.cc[1]) * FOLLOW_POS_A;
        if (f.tb != null) {
          var d = ((f.tb - f.cb + 540) % 360) - 180;
          if (Math.abs(d) > FOLLOW_DEAD_DEG) {
            f.cb = ((f.cb + d * FOLLOW_BRG_A) % 360 + 360) % 360;
          }
        }
        __map.jumpTo({ center: [f.cc[0], f.cc[1]], bearing: f.cb, zoom: f.zoom, pitch: f.pitch, padding: NAV_PADDING });
        placeDriver(f.cc[0], f.cc[1], f.cb);
        // Keep the 60fps loop alive while moving (velocity) or not yet
        // converged; idle out only when genuinely stopped + settled.
        var velMag = f.vel ? (Math.abs(f.vel[0]) + Math.abs(f.vel[1])) : 0;
        var dcx = ex0 - f.cc[0], dcy = ex1 - f.cc[1];
        var bd = (f.tb == null) ? 0 : Math.abs(((f.tb - f.cb + 540) % 360) - 180);
        if (velMag < 1e-9 && (dcx * dcx + dcy * dcy) < 1e-12 && bd <= FOLLOW_DEAD_DEG) return;
        __followRaf = requestAnimationFrame(followStep);
      }

      function setFollowTarget(cmd) {
        if (!__map) return;
        var tc = [cmd.longitude, cmd.latitude];
        var tb = (typeof cmd.bearing === 'number') ? cmd.bearing : (__follow ? __follow.tb : null);
        var zoom = (typeof cmd.zoom === 'number') ? cmd.zoom : (__follow ? __follow.zoom : __map.getZoom());
        var pitch = (typeof cmd.pitch === 'number') ? cmd.pitch : (__follow ? __follow.pitch : __map.getPitch());
        var hasVel = (typeof cmd.velLng === 'number' && typeof cmd.velLat === 'number');
        var nowTs = perfNow();
        if (!__follow) {
          // Cancel any leftover overview marker tween — the loop owns the
          // marker now. First target snaps current=target so we don't sweep
          // across the map from the initial center.
          if (__driverTweenRaf) { cancelAnimationFrame(__driverTweenRaf); __driverTweenRaf = null; }
          __follow = {
            baseTc: [tc[0], tc[1]], baseTs: nowTs,
            vel: hasVel ? [cmd.velLng, cmd.velLat] : null, skipVel: false,
            tb: tb, cc: [tc[0], tc[1]], cb: (tb == null ? __map.getBearing() : tb),
            zoom: zoom, pitch: pitch,
          };
          if (!__userOverride) {
            __map.jumpTo({ center: [tc[0], tc[1]], bearing: __follow.cb, zoom: zoom, pitch: pitch, padding: NAV_PADDING });
            placeDriver(tc[0], tc[1], __follow.cb);
          }
        } else {
          var f = __follow;
          // Prefer the Kalman velocity from RN (already smooth). Fall back to an
          // EMA of target deltas only when no velocity was supplied. skipVel is
          // set right after a re-seed (clearOverride) so the pan gap doesn't
          // manufacture a bogus velocity spike.
          if (hasVel) {
            f.vel = [cmd.velLng, cmd.velLat];
            f.skipVel = false;
          } else if (f.skipVel) {
            f.skipVel = false;
          } else {
            var ddt = nowTs - f.baseTs;
            if (ddt >= 60 && ddt <= 4000) {
              var mv0 = (tc[0] - f.baseTc[0]) / ddt;
              var mv1 = (tc[1] - f.baseTc[1]) / ddt;
              f.vel = f.vel
                ? [f.vel[0] * (1 - VEL_EMA) + mv0 * VEL_EMA, f.vel[1] * (1 - VEL_EMA) + mv1 * VEL_EMA]
                : [mv0, mv1];
            } else if (ddt > 4000) {
              f.vel = null; // long gap — stop predicting until movement resumes
            }
          }
          f.baseTc = [tc[0], tc[1]];
          f.baseTs = nowTs;
          if (tb != null) f.tb = tb;
          f.zoom = zoom;
          f.pitch = pitch;
        }
        if (!__followRaf && !__userOverride) __followRaf = requestAnimationFrame(followStep);
      }

      function stopFollow() {
        if (__followRaf) cancelAnimationFrame(__followRaf);
        __followRaf = null;
        __follow = null;
      }

      // Атомарный recenter: всё в одной синхронной функции.
      // 1) Снимает override (даже если только что был set'ом случайным
      //    тачем — потому что мы здесь явно по нажатию «Вернуться»),
      // 2) Останавливает текущий follow loop и обнуляет __follow,
      // 3) Делает прямой jumpTo и placeDriver на target — БЕЗ guard'ов,
      // 4) Через setFollowTarget перезапускает loop со свежим состоянием.
      function recenterTo(cmd) {
        if (!__map) return;
        __userOverride = false;
        if (__followRaf) cancelAnimationFrame(__followRaf);
        __followRaf = null;
        __follow = null;
        if (__driverTweenRaf) { cancelAnimationFrame(__driverTweenRaf); __driverTweenRaf = null; }
        var lng = cmd.longitude;
        var lat = cmd.latitude;
        var bearing = (typeof cmd.bearing === 'number') ? cmd.bearing : __map.getBearing();
        var zoom = (typeof cmd.zoom === 'number') ? cmd.zoom : 17;
        var pitch = (typeof cmd.pitch === 'number') ? cmd.pitch : 50;
        __map.jumpTo({ center: [lng, lat], bearing: bearing, zoom: zoom, pitch: pitch, padding: NAV_PADDING });
        placeDriver(lng, lat, bearing);
        // Запустим follow loop с этой же точки — поведение продолжится
        // как раньше, но с гарантированно правильным начальным __follow.
        setFollowTarget({
          longitude: lng, latitude: lat,
          bearing: bearing, zoom: zoom, pitch: pitch,
        });
        post({ type: 'log', message: 'recenterTo lng=' + lng.toFixed(6) + ' lat=' + lat.toFixed(6) + ' brg=' + bearing.toFixed(1) });
      }

      window.applyCommand = function (cmd) {
        try {
          switch (cmd.type) {
            case 'setDriver': setDriver(cmd); break;
            case 'setMarkers': setMarkers(cmd); break;
            case 'setRoute': setRoute(cmd.coordinates); break;
            case 'setCenter': setCenter(cmd, cmd.opts); break;
            case 'setFollowTarget': setFollowTarget(cmd); break;
            case 'stopFollow': stopFollow(); break;
            case 'recenterTo': recenterTo(cmd); break;
            case 'setPitch':
              if (__userOverride) break;
              if (__map && typeof cmd.pitch === 'number') __map.setPitch(cmd.pitch);
              break;
            case 'fitBounds':
              if (__userOverride) break;
              fitBounds(cmd.coordinates, cmd.padding);
              break;
            case 'clearOverride':
              __userOverride = false;
              // Re-seed the loop from where the user left the map and resume,
              // so it glides back instead of teleporting. Reset the
              // dead-reckoning base + skip the next velocity sample (the pan
              // gap would otherwise spike the prediction).
              if (__follow && __map) {
                var c = __map.getCenter();
                __follow.cc = [c.lng, c.lat];
                __follow.cb = __map.getBearing();
                __follow.baseTc = [c.lng, c.lat];
                __follow.baseTs = perfNow();
                __follow.vel = null;
                __follow.skipVel = true;
                if (!__followRaf) __followRaf = requestAnimationFrame(followStep);
              }
              break;
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
      setFollowTarget: (target) => dispatch({ type: 'setFollowTarget', ...target }),
      stopFollow: () => dispatch({ type: 'stopFollow' }),
      setPitch: (pitch) => dispatch({ type: 'setPitch', pitch }),
      fitBounds: (coordinates, padding) => dispatch({ type: 'fitBounds', coordinates, padding }),
      clearOverride: () => dispatch({ type: 'clearOverride' }),
      recenterTo: (target) => dispatch({ type: 'recenterTo', ...target }),
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
        } else if (data.type === 'log') {
          // eslint-disable-next-line no-console
          console.log('[MapLibreMapView]', data.message);
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
