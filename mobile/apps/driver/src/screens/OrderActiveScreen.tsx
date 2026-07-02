import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  Platform,
  Linking,
  TouchableOpacity,
  StatusBar,
  Modal,
} from 'react-native';
import {
  hasOverlayPermission,
  hideActiveOrderOverlay,
  showActiveOrderOverlay,
  updateActiveOrderOverlay,
  type ActiveOrderPayload,
} from '../../modules/offer-overlay/src';
import { subscribeOverlayAction } from '../utils/overlayActionBus';
import { Icon } from '@taxi/shared';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  DriverColors,
  Typography,
  ConfirmModal,
  formatDistance,
  formatDuration,
  useLocation,
  useMapRemountRestoration,
  useRoute as useNavigationRoute,
  haversineMeters,
  snapToPolyline,
  bearingBetween,
  angularGapDeg,
  lookAheadBearing,
  GeoKalmanFilter,
} from '@taxi/shared';
import type { DriverCancellationReason } from '@taxi/shared';
import { useDriverOrder } from '../hooks/useDriverOrder';
import { reportEta } from '../api/driver';
import MapLibreMapView, { type MapLibreMapHandle } from '../components/MapLibreMapView';
import type { DriverStackParamList } from '../navigation/types';

// Driver must be within this distance of the pickup point before they can
// confirm "Прибыл к клиенту". Stops them from tapping the button while still
// driving and triggering an early "Водитель ожидает вас" push to the client.
const ARRIVED_THRESHOLD_METERS = 150;

// --- Follow-camera pipeline (navigation phases) -------------------------
// Every raw GPS fix is fed to a constant-velocity Kalman filter
// (GeoKalmanFilter). It fuses the noisy ~1Hz fixes into a SMOOTH position +
// velocity vector; the camera heading comes from that velocity — never the
// magnetometer, never a single-fix point-to-point bearing (which swings
// ±30-100° on GPS noise and is what made the map shake). The filtered
// position + velocity (deg/ms) go to the WebView's 60fps loop, which
// dead-reckons between fixes and eases toward the target — so turns don't lag
// and the world doesn't spin around the car. When the car is nearly stopped
// the filter returns no heading and we hold the last one (no red-light spin).
//
// Snap-to-route: after Kalman, the position is projected onto the routed
// polyline (snapToPolyline). Kalman removes high-frequency jitter, but it
// can't correct the SYSTEMATIC GPS bias that puts the fix 10-20m off the real
// street in dense blocks. Snap pins the marker to the route line so it
// actually drives down the street instead of along the sidewalk. Snap is
// rejected past SNAP_REJECT_METERS — that's a real divergence (wrong turn,
// stale route), keep the raw filtered position and let the backend reroute.

// Перпендикулярный порог принятия snap'а. Под SNAP_FULL_METERS — водителя
// считаем строго «на маршруте» и привязываем точку к polyline (убирает GPS-
// смещение тротуар/двор в плотной застройке). Между SNAP_FULL и SNAP_REJECT —
// плавный blend snap↔raw (см. ниже): на повороте GPS на 0.5-1 сек прыгает
// на 30-35м, и бинарный reject раньше выкидывал точку с маршрута в кювет —
// driver-pin визуально «ехал сбоку от дороги». Линейный fade оставляет точку
// прижатой к улице пока перп растёт, и плавно отпускает на off-route.
// Над SNAP_REJECT — настоящее отклонение, рисуем чистую Kalman-позицию,
// useRoute сам перестроит маршрут (порог 50м, см. useRoute.ts).
const SNAP_FULL_METERS = 18;
const SNAP_REJECT_METERS = 45;
// Дропаем fix'ы с неопределённостью выше этого порога (тоннель / двор-колодец).
// Kalman формально весит fix по accuracy, но один выброс ~80 м всё равно дёргает
// state на десятки метров — глаз ловит как телепорт.
const MAX_ACCURACY_METERS = 50;
// Навигационный камера preset. Один и тот же в follow-loop'е и в recenterTo,
// чтобы переход «жест → возврат» не менял зум/наклон. Pitch — базовый;
// на низкой скорости снижается до PITCH_SLOW (см. pickPitch ниже), чтобы
// в узких улицах посёлка водителю было видно ближайший поворот, а не
// только пятиметровый клочок перед капотом.
const NAV_ZOOM = 17;
const NAV_PITCH = 50;
const PITCH_SLOW = 35;
const PITCH_CRUISE = 45;
// Пороги скорости (m/s). 3 ≈ 11 км/ч (пешеход / двор), 12 ≈ 43 км/ч.
function pickPitch(speedMs: number | null): number {
  if (speedMs === null || speedMs < 3) return PITCH_SLOW;
  if (speedMs < 12) return PITCH_CRUISE;
  return NAV_PITCH;
}
// Heartbeat для native overlay. ActiveOrderOverlayManager.scheduleAutoHide
// гасит окно через 60 сек без update'а; шлём update каждые 25 сек, чтобы
// payload-стабильность (canArrive/route/phase минуту не меняются) не убивала
// карточку.
const OVERLAY_HEARTBEAT_MS = 25_000;

// expo-location отдаёт `heading: -1` когда курс не определён (стоим / ещё не
// успело сойтись). Возвращаем number когда есть осмысленное значение, иначе
// null — null лучше «магической» -1 для chain'а fallback'ов.
function rawHeading(heading: number | null | undefined): number | null {
  return typeof heading === 'number' && heading >= 0 ? heading : null;
}

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

type NavigationProp = NativeStackNavigationProp<DriverStackParamList, 'OrderActive'>;

const CANCEL_REASONS: { value: DriverCancellationReason; label: string }[] = [
  { value: 'client_no_show', label: 'Клиент не пришёл' },
  { value: 'client_no_answer', label: 'Не отвечает на звонок' },
  { value: 'long_wait', label: 'Долгое ожидание' },
];

function openNavigation(lat: number, lng: number): void {
  const url = Platform.select({
    ios: `maps://app?daddr=${lat},${lng}&dirflg=d`,
    android: `google.navigation:q=${lat},${lng}&mode=d`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
  });
  if (url) {
    Linking.openURL(url);
  }
}

function callPhone(phone: string): void {
  Linking.openURL(`tel:${phone}`);
}


function CancelSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (reason: DriverCancellationReason) => void;
}): React.ReactNode {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <Text style={[Typography.h3, styles.sheetTitle]}>Причина отмены</Text>
          {CANCEL_REASONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={styles.sheetItem}
              onPress={() => onPick(opt.value)}
              activeOpacity={0.7}
              testID={`cancel-reason-${opt.value}`}
            >
              <Text style={[Typography.body, { color: DriverColors.textPrimary }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.sheetCancel}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[Typography.button, { color: DriverColors.textMuted }]}>
              Отмена
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function OrderActiveScreen(): React.ReactNode {
  const navigation = useNavigation<NavigationProp>();
  const {
    state,
    markArrived,
    markStarted,
    markCompleted,
    cancelByDriver,
    dismissCompleted,
    loading,
  } = useDriverOrder();
  const mapRef = useRef<MapLibreMapHandle>(null);
  // Follow-target state (refs so updates never re-render). kalmanRef: the
  // navigation filter for the current leg (re-seeded per phase / on recenter).
  // lastFedTsRef: timestamp of the last fix fed to the filter, so the effect
  // re-running on unrelated deps doesn't double-feed the same fix.
  // targetBearingRef: last heading we sent — held while the car is stopped
  // (filter returns null) so the map doesn't spin in place.
  const kalmanRef = useRef<GeoKalmanFilter | null>(null);
  const lastFedTsRef = useRef<number | null>(null);
  const targetBearingRef = useRef<number | null>(null);
  // handleMapReady — стабильный useCallback, не видит свежий state напрямую,
  // поэтому держим зеркало через ref.
  const followingRef = useRef(true);
  const { lastRef: lastNavRef, handleMapReady } = useMapRemountRestoration((p) => {
    if (followingRef.current) {
      mapRef.current?.recenterTo({
        latitude: p.latitude,
        longitude: p.longitude,
        bearing: p.heading,
        zoom: NAV_ZOOM,
        pitch: NAV_PITCH,
      });
    } else {
      mapRef.current?.setDriver({
        latitude: p.latitude,
        longitude: p.longitude,
        heading: p.heading,
      });
    }
  });
  const driverLocation = useLocation({ navigation: true });
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | {
    message: string;
    confirmLabel: string;
    run: () => void | Promise<void>;
  }>(null);

  const requestArrived = (): void => {
    setPendingAction({
      message: 'Подтвердите, что вы прибыли к клиенту',
      confirmLabel: 'Прибыл',
      run: markArrived,
    });
  };
  const requestStart = (): void => {
    setPendingAction({
      message: 'Подтвердите начало поездки',
      confirmLabel: 'Начать',
      run: markStarted,
    });
  };
  const requestComplete = (): void => {
    // Round-trip orders branch into "fulfilled" vs "client didn't
    // come back" — the latter strips the surcharge off the price +
    // commission so the driver doesn't pay full commission on a fare
    // they only earned half of. One-way orders go straight to confirm.
    if (state.phase === 'in_progress' && state.order.is_round_trip) {
      Alert.alert(
        'Завершение поездки',
        'Клиент вернулся с вами обратно?',
        [
          {
            text: 'Клиент не вернулся',
            style: 'destructive',
            onPress: () => void markCompleted(true),
          },
          {
            text: 'Да, туда-обратно',
            style: 'default',
            onPress: () => void markCompleted(false),
          },
          { text: 'Отмена', style: 'cancel' },
        ],
        { cancelable: true },
      );
      return;
    }
    setPendingAction({
      message: 'Подтвердите завершение поездки',
      confirmLabel: 'Завершить',
      run: () => markCompleted(false),
    });
  };

  // Go back if phase is not relevant to this screen
  useEffect(() => {
    if (
      state.phase !== 'active' &&
      state.phase !== 'arrived' &&
      state.phase !== 'in_progress' &&
      state.phase !== 'completed'
    ) {
      navigation.goBack();
    }
  }, [state.phase, navigation]);


  // Block the Android hardware back button + swipe-back gesture while
  // there's an active order. Previously the driver could press back,
  // land on the home map, and lose access to the order management UI —
  // the order was still active server-side but invisible until they
  // killed and reopened the app.
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      const phase = state.phase;
      const isActive =
        phase === 'active' ||
        phase === 'arrived' ||
        phase === 'in_progress';
      if (isActive) {
        e.preventDefault();
        return;
      }
      // На completed back-кнопка обычно не вызывается (модалка перекрывает),
      // но если водитель всё-таки уходит без тапа «Готово» — корректно
      // финализируем фазу, иначе экран размонтируется, а DriverOrderState
      // зависнет в 'completed' до следующего ремаунта.
      if (phase === 'completed') {
        dismissCompleted();
      }
    });
    return sub;
  }, [navigation, state.phase, dismissCompleted]);

  const order =
    state.phase === 'active' ||
    state.phase === 'arrived' ||
    state.phase === 'in_progress' ||
    state.phase === 'completed'
      ? state.order
      : null;

  const driverPoint =
    !driverLocation.loading && !driverLocation.error
      ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
      : null;

  // Defensive: react-native-maps silently ignores Marker / Polyline coords
  // that come in as strings. The API now serializes lat/lng as floats, but
  // older deploys may still hand us strings — coerce here so the screen
  // works regardless of backend version.
  const pickupLat = order ? Number(order.pickup_latitude) : NaN;
  const pickupLng = order ? Number(order.pickup_longitude) : NaN;
  const dropoffLat =
    order?.dropoff_latitude !== null && order?.dropoff_latitude !== undefined
      ? Number(order.dropoff_latitude)
      : null;
  const dropoffLng =
    order?.dropoff_longitude !== null && order?.dropoff_longitude !== undefined
      ? Number(order.dropoff_longitude)
      : null;

  const pickupPoint =
    order && Number.isFinite(pickupLat) && Number.isFinite(pickupLng)
      ? { latitude: pickupLat, longitude: pickupLng }
      : null;

  const dropoffPoint =
    dropoffLat !== null &&
    dropoffLng !== null &&
    Number.isFinite(dropoffLat) &&
    Number.isFinite(dropoffLng)
      ? { latitude: dropoffLat, longitude: dropoffLng }
      : null;

  // Route is shown:
  // - active / arrived → линия к pickup (на arrived НЕ схлопываем — клиент
  //   может быть в 80м между домов, обзор без линии — лотерея)
  // - in_progress → линия к dropoff
  const shouldRouteToPickup = state.phase === 'active' || state.phase === 'arrived';
  const shouldRouteToDropoff = state.phase === 'in_progress' && dropoffPoint !== null;
  // Smoothed driver position для useRoute: raw GPS-фикс прыгает на ±5-10м
  // в плотной застройке, и trimRouteFromPosition мог зашкаливать offRouteMeters
  // > 50м из-за шума → лишний refetch. Smoothed точка обновляется ниже в
  // Kalman-эффекте (setSmoothedDriverPoint).
  const [smoothedDriverPoint, setSmoothedDriverPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const routeFrom = smoothedDriverPoint ?? driverPoint;
  const routeOrigin = shouldRouteToPickup || shouldRouteToDropoff ? routeFrom : null;
  const routeDestination = shouldRouteToPickup
    ? pickupPoint
    : shouldRouteToDropoff
      ? dropoffPoint
      : null;
  const {
    route,
    trimmedCoordinates,
    loading: routeLoading,
    error: routeError,
  } = useNavigationRoute(routeOrigin, routeDestination);

  // ETA reporting: один раз после accept'а, когда у нас появляется первый
  // route к pickup'у, отправляем durationSeconds на сервер — он зафиксирует
  // expected_arrival_at. Сервер игнорирует повторные вызовы (rerouting не
  // должен сбрасывать дедлайн). reportedEtaRef защищает от двойной отправки
  // внутри одного маунта при ререндерах.
  const reportedEtaRef = useRef<number | null>(null);
  useEffect(() => {
    if (state.phase !== 'active' || !order) return;
    if (!route) return;
    // Защита от 0-длительности: если ORS/OSRM ответил быстро, но
    // маршрут ещё не свернулся (промежуточное состояние), duration может
    // быть 0 или отрицательное. Не отправляем — сервер сохранит
    // expected_arrival_at=now() и клиент увидит «опоздание» через
    // секунду. Ждём валидное значение >= 30 сек.
    if (!Number.isFinite(route.durationSeconds) || route.durationSeconds < 30) return;
    if (order.expected_arrival_at) return; // уже зафиксирован сервером
    if (reportedEtaRef.current === order.id) return;
    reportedEtaRef.current = order.id;
    reportEta(order.id, route.durationSeconds).catch(() => {
      // best-effort: сервер сам индемпотентен, если не дошло — пошлём в
      // следующем маунте экрана. Молча игнорим сеть, чтобы не пугать
      // водителя alert'ом из-за вспомогательного запроса.
      reportedEtaRef.current = null;
    });
  }, [state.phase, order, route]);

  // Локальный тикер для обратного отсчёта: каждую секунду пересчитываем
  // оставшееся время до expected_arrival_at. Тикает только пока экран
  // mounted и есть дедлайн — на arrived/in_progress дедлайн уже не важен.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    if (state.phase !== 'active' || !order?.expected_arrival_at) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.phase, order?.expected_arrival_at]);

  // Положительное число — секунд осталось; отрицательное — на сколько опаздываем.
  const arrivalDeltaSeconds = useMemo(() => {
    if (state.phase !== 'active' || !order?.expected_arrival_at) return null;
    const deadline = new Date(order.expected_arrival_at).getTime();
    return Math.round((deadline - nowMs) / 1000);
  }, [state.phase, order?.expected_arrival_at, nowMs]);

  // Floating glass-card overlay — единственный UI заказа. Показывается
  // и в foreground, и в background (поверх внешнего навигатора).
  // Шторка внизу убрана: карта на весь экран + glass-карточка сверху.
  const distanceToPickup = useMemo(
    () =>
      driverPoint && pickupPoint
        ? haversineMeters(driverPoint, pickupPoint)
        : null,
    [driverPoint, pickupPoint],
  );
  const canArrive =
    distanceToPickup !== null && distanceToPickup <= ARRIVED_THRESHOLD_METERS;

  const buildOverlayPayload = useCallback((): ActiveOrderPayload | null => {
    if (!order) return null;
    if (state.phase !== 'active' && state.phase !== 'arrived' && state.phase !== 'in_progress') {
      return null;
    }
    const phaseLabel = {
      active: 'Еду к клиенту',
      arrived: 'Жду клиента',
      in_progress: 'В поездке',
    } as const;
    const primaryLabel = {
      active: 'Прибыл',
      arrived: 'Начать',
      in_progress: 'Завершить',
    } as const;
    // На фазе active показываем в overlay «живой» обратный отсчёт до
    // клиента (mm:ss) или «Опозд» — этого раньше не было на прозрачной
    // карточке, только в fullscreen'e экрана. Раз в секунду шлём
    // updateActiveOrderOverlay ниже, чтобы native-текст тикал live.
    let etaText: string;
    if (state.phase === 'active' && arrivalDeltaSeconds !== null) {
      etaText = arrivalDeltaSeconds < 0
        ? `Опозд ${formatMmSs(Math.abs(arrivalDeltaSeconds))}`
        : `До вас ${formatMmSs(arrivalDeltaSeconds)}`;
    } else if (route) {
      etaText = `${formatDuration(route.durationSeconds)} · ${formatDistance(route.distanceMeters)}`;
    } else {
      etaText = '';
    }
    return {
      orderId: order.id,
      clientName: order.client.name ?? 'Клиент',
      ratingText: undefined,
      statusText: phaseLabel[state.phase],
      etaText,
      pickupAddress: order.pickup_address ?? '',
      dropoffAddress: order.dropoff_address ?? undefined,
      priceText: `${order.price} сом`,
      primaryLabel: primaryLabel[state.phase],
      // «Прибыл» доступна только когда водитель в радиусе ARRIVED_THRESHOLD_METERS.
      // На overlay это рендерится как полупрозрачная неактивная кнопка.
      primaryDisabled: state.phase === 'active' && !canArrive,
    };
  }, [order, state.phase, route, canArrive, arrivalDeltaSeconds]);

  // Дедуп идентичных payload'ов: RN bridge не диффает аргументы и сериализует
  // каждый вызов. Около границы canArrive (150м) рендеры идут ~1Hz с тем же
  // payload'ом — пропускаем такие через JSON-сравнение, чтобы не гонять bridge.
  const lastOverlayJsonRef = useRef<string | null>(null);

  useEffect(() => {
    const payload = buildOverlayPayload();
    if (!payload) {
      if (lastOverlayJsonRef.current !== null) {
        hideActiveOrderOverlay();
        lastOverlayJsonRef.current = null;
      }
      return;
    }
    if (!hasOverlayPermission()) return;
    const json = JSON.stringify(payload);
    if (json === lastOverlayJsonRef.current) return;
    lastOverlayJsonRef.current = json;
    showActiveOrderOverlay(payload);
  }, [buildOverlayPayload]);

  useEffect(() => {
    // Native ActiveOrderOverlayManager гасит окно через 60 сек без update'а —
    // защита от зомби-overlay при крашнутом JS. На стабильном payload'е bridge
    // ничего не пишет (см. lastOverlayJsonRef), но сам вызов сбрасывает native-
    // таймер, поэтому шлём с запасом OVERLAY_HEARTBEAT_MS.
    const id = setInterval(() => {
      const payload = buildOverlayPayload();
      if (!payload || !hasOverlayPermission()) return;
      updateActiveOrderOverlay(payload);
    }, OVERLAY_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [buildOverlayPayload]);

  useEffect(() => {
    if (!order) return undefined;
    // Клики по overlay-карточке уходят через deep-link из native-слоя
    // (см. ActiveOrderOverlayManager.launchAppForOverlayAction);
    // useNotifications.handleDeepLink парсит URL и стреляет в bus,
    // а здесь мы выполняем действие с полным контекстом (phone, phase).
    const unsub = subscribeOverlayAction((event) => {
      if (event.orderId !== order.id) return;
      switch (event.action) {
        case 'open':
          // App уже поднят deep-link'ом — просто на этом экране.
          break;
        case 'call':
          if (order.client.phone) Linking.openURL(`tel:${order.client.phone}`);
          break;
        case 'primary':
          if (state.phase === 'active') requestArrived();
          else if (state.phase === 'arrived') requestStart();
          else if (state.phase === 'in_progress') requestComplete();
          break;
        case 'open-maps':
          openNavigation(order.pickup_latitude, order.pickup_longitude);
          break;
      }
    });
    return unsub;
    // requestArrived/Start/Complete стабильны по ref в этом сетапе.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, state.phase]);

  useEffect(() => () => hideActiveOrderOverlay(), []);

  const isNavigating =
    (state.phase === 'active' || state.phase === 'in_progress') && driverPoint !== null;

  // following=false когда водитель сам отпанил карту — тогда показываем
  // «Вернуться к маршруту» и не дёргаем камеру до явного тапа. Не боремся с
  // жестом — это Yandex/2GIS-style.
  const [following, setFollowing] = useState(true);
  followingRef.current = following;

  // useCallback нужен, чтобы React.memo на MapLibreMapView не пересоздавал
  // WebView на каждый рендер OrderActiveScreen.
  const handleUserGesture = useCallback(() => {
    if (followingRef.current) {
      setFollowing(false);
    }
  }, []);

  // Re-enable follow whenever the screen transitions into a new phase
  // (newly accepted, freshly in-progress). Driver expects auto-follow
  // again after a state change even if they had panned away.
  useEffect(() => {
    mapRef.current?.clearOverride();
    kalmanRef.current = null;
    lastFedTsRef.current = null;
    targetBearingRef.current = null;
    setSmoothedDriverPoint(null);
    setFollowing(true);
  }, [state.phase]);

  useEffect(() => {
    if (!order) return;
    if (isNavigating && driverPoint) {
      if (!following) return; // user panned — WebView keeps their view (override lock)

      if (!kalmanRef.current) {
        // minBearingSpeed 1.5 m/s (~5 km/h). Раньше было 2.5 — фильтр
        // молчал когда водитель тормозил под поворот (5-8 км/ч), стрелка
        // зависала в направлении ДО поворота, и камера показывала
        // «прямо», когда машина уже шла в дуге. 1.5 m/s даёт меньше
        // стабильности на самой остановке, но WebView lerp + dead-zone
        // 4° глушит остаточный wobble.
        kalmanRef.current = new GeoKalmanFilter({ minBearingSpeed: 1.5 });
      }
      // Feed each fix to the filter exactly once. The effect can re-run on
      // unrelated deps (route refetch, sheet state) with no new fix — skip
      // those so we neither perturb the filter nor restart dead-reckoning.
      const ts = driverLocation.timestamp ?? Date.now();
      if (ts === lastFedTsRef.current) {
        return;
      }
      lastFedTsRef.current = ts;

      // Бросать плохие fix'ы лучше, чем кормить ими Kalman: WebView dead-reckon'ит
      // по последней velocity (см. PREDICT_MAX_MS) и плавно догонит на следующем
      // нормальном fix'е, иначе глаз ловит выброс accuracy~80м как телепорт.
      if (
        typeof driverLocation.accuracy === 'number' &&
        driverLocation.accuracy > MAX_ACCURACY_METERS
      ) {
        return;
      }

      const filtered = kalmanRef.current.update({
        latitude: driverPoint.latitude,
        longitude: driverPoint.longitude,
        timestamp: ts,
        accuracy: driverLocation.accuracy,
      });

      // Smoothed позиция → useRoute (см. routeFrom). Threshold 5м — реальное
      // перемещение, не GPS-шум; иначе на каждом фикс'е useRoute-эффект
      // дёргается впустую (его кулдаун всё равно отсечёт, но лишних ререндеров
      // лучше избежать).
      setSmoothedDriverPoint((prev) => {
        if (
          prev &&
          haversineMeters(prev, { latitude: filtered.latitude, longitude: filtered.longitude }) < 5
        ) {
          return prev;
        }
        return { latitude: filtered.latitude, longitude: filtered.longitude };
      });

      // Snap-to-route: pin position to the routed polyline when we're close
      // enough to it. Kalman уже сгладил GPS noise; snap корректирует
      // СИСТЕМНОЕ смещение, которое GPS даёт в плотной застройке (отражения
      // от зданий). Velocity намеренно НЕ снапается — она кормит WebView
      // dead-reckoning между фиксами; снап velocity заставил бы карту
      // двигаться вдоль polyline, а не вдоль реального движения.
      const snap =
        trimmedCoordinates.length >= 2
          ? snapToPolyline(
              { latitude: filtered.latitude, longitude: filtered.longitude },
              trimmedCoordinates,
            )
          : null;
      // Плавный blend snap↔raw на 18..45м. Это лечит «навигатор едет сбоку
      // от дороги» на поворотах: GPS ~1с прыгает на 30-35м когда выходишь
      // из-под зданий, бинарный reject выкидывал точку с маршрута → pin
      // плыл по тротуару. snapWeight=1 на perp≤18м, 0 на ≥45м.
      let snapWeight = 0;
      if (snap !== null) {
        if (snap.perpMeters <= SNAP_FULL_METERS) {
          snapWeight = 1;
        } else if (snap.perpMeters < SNAP_REJECT_METERS) {
          snapWeight =
            1 - (snap.perpMeters - SNAP_FULL_METERS) /
              (SNAP_REJECT_METERS - SNAP_FULL_METERS);
        }
      }
      const useSnap = snapWeight > 0 && snap !== null;
      const posLat = useSnap
        ? snap.latitude * snapWeight + filtered.latitude * (1 - snapWeight)
        : filtered.latitude;
      const posLng = useSnap
        ? snap.longitude * snapWeight + filtered.longitude * (1 - snapWeight)
        : filtered.longitude;

      // Bearing — теперь ДВА разных значения:
      //
      // 1. cameraBearing — куда смотрит камера. С УПРЕЖДЕНИЕМ: tangent
      //    маршрута в точке `s + L` впереди, где L растёт со скоростью.
      //    Яндекс/2GIS делают именно это — начинают доворот в поворот за
      //    несколько метров ДО самого поворота, потому что «читают»
      //    форму дороги впереди. Раньше у нас был чисто реактивный
      //    fallback на velocity при angularGap>35° — камера ждала пока
      //    машина въедет в дугу и только тогда докручивалась.
      //
      // 2. markerBearing — куда смотрит стрелка. БЕЗ упреждения, по
      //    касательной СЕГМЕНТА ПОД МАШИНОЙ. Pin должен стоять «по
      //    дороге под капотом», камера — слегка ведёт вперёд. С
      //    rotationAlignment='map' разность углов даёт правильный
      //    визуальный наклон стрелки в кадре.
      //
      // Velocity-fallback оставлен ТОЛЬКО для краевых случаев:
      //  - snap слабый/потерянный (snapWeight < SNAP_TRUST_THRESHOLD) →
      //    мы не на дороге, доверять route-геометрии нельзя;
      //  - look-ahead упёрся в конец маршрута (короткий хвост перед
      //    pickup'ом) — tangent текущего сегмента + velocity-fallback.
      // На нормальном повороте по маршруту переключения tangent↔velocity
      // больше не происходит — есть плавный look-ahead.
      const SNAP_TRUST_THRESHOLD = 0.6;
      const LOOKAHEAD_MIN_M = 12;
      const LOOKAHEAD_MAX_M = 55;
      const lookaheadDist = Math.max(
        LOOKAHEAD_MIN_M,
        Math.min(LOOKAHEAD_MAX_M, filtered.speed * 1.4),
      );

      let cameraBearing: number | null = null;
      let markerBearing: number | null = null;

      if (
        useSnap &&
        snap !== null &&
        snap.segmentIndex < trimmedCoordinates.length - 1
      ) {
        const segA = trimmedCoordinates[snap.segmentIndex];
        const segB = trimmedCoordinates[snap.segmentIndex + 1];
        const tangentHere = bearingBetween(segA, segB);
        markerBearing = tangentHere;

        if (snapWeight >= SNAP_TRUST_THRESHOLD) {
          // Уверенно на маршруте → look-ahead tangent ведёт камеру.
          const ahead = lookAheadBearing(trimmedCoordinates, snap, lookaheadDist);
          if (ahead !== null) {
            cameraBearing = ahead;
          } else {
            // Look-ahead вылез за конец маршрута — едем к pickup'у в
            // упор. Tangent текущего сегмента + velocity-fallback на
            // случай если водитель уже отворачивает к парковке.
            cameraBearing =
              filtered.bearing !== null &&
              angularGapDeg(tangentHere, filtered.bearing) > 35
                ? filtered.bearing
                : tangentHere;
          }
        } else if (filtered.bearing !== null) {
          // Слабый snap (perp близко к 45м) — route-геометрии не
          // доверяем, камеру ведёт velocity.
          cameraBearing = filtered.bearing;
        } else {
          cameraBearing = tangentHere;
        }
      } else if (filtered.bearing !== null) {
        // Снап потерян (off-route, ждём refetch) — обе цели по velocity.
        cameraBearing = filtered.bearing;
        markerBearing = filtered.bearing;
      }

      const nextBearing = cameraBearing;
      const seedHeading = rawHeading(driverLocation.heading);
      if (nextBearing !== null) {
        targetBearingRef.current = nextBearing;
      } else if (targetBearingRef.current === null && seedHeading !== null) {
        // Cold-start: до сходимости Kalman'а (2-3 fix'а) bearing у фильтра null —
        // подставляем сырой coords.heading, иначе карта стоит north-up даже на
        // полной скорости. На остановке (всё null) ничего не делаем — держим
        // предыдущий курс, чтобы стрелку не крутило от GPS-шума.
        targetBearingRef.current = seedHeading;
      }

      // 60fps follow-loop в WebView dead-reckonит по velocity между fix'ами.
      // Pitch адаптивный: на скорости пешехода 50° даёт слишком узкий
      // горизонт (видно метры перед капотом), на трассе наоборот — нужен
      // более «нависающий» вид. pickPitch выбирает по filtered.speed.
      const adaptivePitch = pickPitch(filtered.speed);
      lastNavRef.current = {
        latitude: posLat,
        longitude: posLng,
        heading: targetBearingRef.current ?? 0,
      };
      mapRef.current?.setFollowTarget({
        latitude: posLat,
        longitude: posLng,
        bearing: targetBearingRef.current ?? undefined,
        // markerBearing — отдельный угол для pin'а (касательная под
        // машиной, без look-ahead). Если null — WebView крутит маркер
        // на bearing камеры (старое поведение для off-route).
        markerBearing: markerBearing ?? undefined,
        velLng: filtered.velLngPerMs,
        velLat: filtered.velLatPerMs,
        zoom: NAV_ZOOM,
        pitch: adaptivePitch,
      });
      return;
    }

    // Overview (arrived / completed / no driver fix yet): stop the follow
    // loop, drop target state, and fit the whole trip in view. Keep a slight
    // 30° tilt — the 3D look is on permanently, but navigator-grade 55° on a
    // zoomed-out view distorts ugly.
    mapRef.current?.stopFollow();
    kalmanRef.current = null;
    lastFedTsRef.current = null;
    targetBearingRef.current = null;
    // Не навигируем (прибыл / завершён / ещё нет фикса) — гасим точку
    // восстановления, чтобы ремаунт в этой фазе не зумил камеру на водителя
    // вместо обзора.
    lastNavRef.current = null;
    mapRef.current?.setPitch(30);
    const coords: Array<[number, number]> =
      route && route.coordinates.length > 0
        ? route.coordinates.map((c) => [c.longitude, c.latitude])
        : [
            ...(pickupPoint ? [[pickupPoint.longitude, pickupPoint.latitude]] : []),
            ...(dropoffPoint ? [[dropoffPoint.longitude, dropoffPoint.latitude]] : []),
            ...(driverPoint ? [[driverPoint.longitude, driverPoint.latitude]] : []),
          ] as Array<[number, number]>;
    if (coords.length === 0) return;
    mapRef.current?.fitBounds(coords, 80);
  }, [
    isNavigating,
    order,
    route,
    driverPoint?.latitude,
    driverPoint?.longitude,
    driverLocation.timestamp,
    driverLocation.accuracy,
    following,
  ]);

  // Marker placement OUTSIDE the follow loop. While navigating-and-following,
  // the WebView loop owns the marker (pins it at centre, perfectly synced
  // with the camera). This effect only covers the panned-away case and the
  // arrived phase, so the pin still tracks GPS there.
  useEffect(() => {
    if (!driverPoint) return;
    if (isNavigating && following) return; // loop owns the marker
    if (
      state.phase === 'active' ||
      state.phase === 'in_progress' ||
      state.phase === 'arrived'
    ) {
      mapRef.current?.setDriver({
        latitude: driverPoint.latitude,
        longitude: driverPoint.longitude,
        heading: targetBearingRef.current ?? 0,
      });
    }
  }, [driverPoint?.latitude, driverPoint?.longitude, isNavigating, following, state.phase]);

  // Push pickup + dropoff markers. The set is recomputed whenever any
  // of the coords change; passing null clears.
  useEffect(() => {
    mapRef.current?.setMarkers({
      pickup: pickupPoint,
      dropoff: dropoffPoint,
    });
  }, [
    pickupPoint?.latitude,
    pickupPoint?.longitude,
    dropoffPoint?.latitude,
    dropoffPoint?.longitude,
  ]);

  // Push route polyline coords. Empty array clears the line.
  useEffect(() => {
    const coords: Array<[number, number]> = trimmedCoordinates.map((c) => [
      c.longitude,
      c.latitude,
    ]);
    mapRef.current?.setRoute(coords);
  }, [trimmedCoordinates]);

  if (!order) {
    return null;
  }

  const handleDismiss = (): void => {
    dismissCompleted();
    navigation.goBack();
  };

  const handlePickCancelReason = (reason: DriverCancellationReason): void => {
    setCancelSheetOpen(false);
    cancelByDriver(reason);
  };

  return (
    <View style={styles.container}>
      <MapLibreMapView
        ref={mapRef}
        style={styles.map}
        initialCenter={
          driverPoint
            ? [driverPoint.longitude, driverPoint.latitude]
            : pickupPoint
              ? [pickupPoint.longitude, pickupPoint.latitude]
              : undefined
        }
        initialZoom={14}
        onReady={handleMapReady}
        onUserGesture={handleUserGesture}
      />

      {/* Индикатор пересчёта маршрута: ORS/OSRM может уходить на 4-6 сек
          (cooldown + fetch), и без подсказки водитель думает, что
          навигатор завис. Показываем только когда route УЖЕ был и его
          пересчитывают (routeLoading + route !== null) — на первом фетче
          линии всё равно нет, нечему «моргать». */}
      {routeLoading && route !== null && (
        <View style={styles.rerouteChip} pointerEvents="none">
          <Icon name="navigation" size={14} color={DriverColors.textPrimary} />
          <Text style={styles.rerouteChipText}>Пересчёт маршрута…</Text>
        </View>
      )}

      {/* Обратный отсчёт живёт теперь на прозрачной карточке overlay
          (etaText в payload'e), убран отсюда чтобы не дублировать
          информацию и не тратить место на full-screen карте. */}

      {/* Re-engage follow camera. Shows only when driver opted out of
          follow by panning the map mid-navigation. Tap snaps back to
          the tilted heading-locked view. */}
      {isNavigating && !following && (
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={() => {
            if (driverPoint) {
              // Передаём явный bearing — иначе WebView подставит __map.getBearing()
              // (угол, в котором водитель оставил карту жестом) и камера встанет
              // «сбоку». Kalman/refs НЕ обнуляем: они валидны и нужны, чтобы
              // курс не сбрасывался в 0 пока фильтр сходится заново.
              const bearing =
                targetBearingRef.current ?? rawHeading(driverLocation.heading) ?? undefined;
              mapRef.current?.recenterTo({
                latitude: driverPoint.latitude,
                longitude: driverPoint.longitude,
                bearing,
                zoom: NAV_ZOOM,
                pitch: NAV_PITCH,
              });
              // Сразу обновляем точку восстановления — если WebView ремаунтится
              // (MIUI/Doze) ДО следующего GPS-фикса, handleMapReady должен
              // вернуть камеру именно сюда, а не к до-жестовой позиции.
              lastNavRef.current = {
                latitude: driverPoint.latitude,
                longitude: driverPoint.longitude,
                heading: bearing ?? 0,
              };
            }
            setFollowing(true);
          }}
          activeOpacity={0.85}
        >
          <Icon name="navigation" size={16} color={DriverColors.primary} />
          <Text style={styles.recenterText}>Вернуться к маршруту</Text>
        </TouchableOpacity>
      )}

      {/* Если ORS/OSRM упали (нет route, есть error), у водителя пустая карта
          без линии — без этой кнопки он не сможет понять, как ехать. Точка
          назначения: pickup на active/arrived, dropoff на in_progress. */}
      {!routeLoading && routeError && (state.phase === 'active' || state.phase === 'arrived' || state.phase === 'in_progress') && (
        <TouchableOpacity
          style={styles.externalNavButton}
          onPress={() => {
            const target = state.phase === 'in_progress' ? dropoffPoint : pickupPoint;
            if (target) {
              openNavigation(target.latitude, target.longitude);
            }
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Icon name="navigation" size={16} color={DriverColors.background} />
          <Text style={styles.externalNavText}>Открыть в Картах</Text>
        </TouchableOpacity>
      )}

      {state.phase === 'completed' && (
        <Modal visible transparent animationType="fade">
          <View style={styles.completedOverlay}>
            <View style={styles.completedCard}>
              <View style={styles.completedBadge}>
                <Icon name="check-circle" size={42} color={DriverColors.background} />
              </View>
              <Text style={styles.completedTitle}>Заказ завершён</Text>
              <Text style={styles.completedSubtitle}>Спасибо за поездку</Text>

              <View style={styles.completedPriceBlock}>
                <Text style={styles.completedPriceLabel}>Заработали</Text>
                <Text style={styles.completedPriceValue}>
                  + {order.price} <Text style={styles.completedPriceUnit}>сом</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.completedDoneBtn}
                onPress={handleDismiss}
                activeOpacity={0.88}
                accessibilityRole="button"
              >
                <Text style={styles.completedDoneText}>Готово</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <CancelSheet
        visible={cancelSheetOpen}
        onClose={() => setCancelSheetOpen(false)}
        onPick={handlePickCancelReason}
      />

      <ConfirmModal
        visible={pendingAction !== null}
        message={pendingAction?.message ?? ''}
        confirmLabel={pendingAction?.confirmLabel ?? 'Подтвердить'}
        onConfirm={() => {
          const action = pendingAction?.run;
          setPendingAction(null);
          if (action) {
            void action();
          }
        }}
        onCancel={() => setPendingAction(null)}
        loading={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DriverColors.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  completedOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  completedCard: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  completedBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: DriverColors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: DriverColors.success,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  completedTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: DriverColors.textPrimary,
    letterSpacing: -0.4,
  },
  completedSubtitle: {
    fontSize: 14,
    color: DriverColors.textMuted,
    marginTop: 6,
    marginBottom: 24,
  },
  completedPriceBlock: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: DriverColors.background,
    borderRadius: 18,
    marginBottom: 24,
    width: '100%',
  },
  completedPriceLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: DriverColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  completedPriceValue: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: DriverColors.primary,
    letterSpacing: -0.6,
  },
  completedPriceUnit: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: DriverColors.textSecondary,
  },
  completedDoneBtn: {
    height: 54,
    width: '100%',
    borderRadius: 27,
    backgroundColor: DriverColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DriverColors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  completedDoneText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: DriverColors.background,
    letterSpacing: 0.4,
  },
  recenterButton: {
    // Раньше была в правом-верхнем — нативный glass-overlay «Еду к
    // клиенту» (~60-220px от верха) её закрывал, и водитель не мог её
    // нажать чтобы вернуть камеру в course-up режим. Перенесли в
    // нижний-правый: место свободно, по высоте не пересекается с
    // карточкой.
    position: 'absolute',
    bottom: 32,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: DriverColors.cardBackground,
    borderWidth: 1,
    borderColor: DriverColors.border,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  recenterText: {
    color: DriverColors.textPrimary,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  rerouteChip: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 60 : 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: DriverColors.cardBackground,
    borderWidth: 1,
    borderColor: DriverColors.border,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  rerouteChipText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: DriverColors.textPrimary,
  },
  etaChip: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 100 : 140,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  etaChipOk: {
    backgroundColor: DriverColors.cardBackground,
    borderWidth: 1,
    borderColor: DriverColors.border,
  },
  etaChipLate: {
    backgroundColor: DriverColors.danger,
    shadowColor: DriverColors.danger,
    shadowOpacity: 0.45,
  },
  etaChipText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: DriverColors.textPrimary,
    letterSpacing: 0.2,
  },
  etaChipTextLate: {
    color: DriverColors.background,
  },
  externalNavButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 16 : 60,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: DriverColors.primary,
    shadowColor: DriverColors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  externalNavText: {
    color: DriverColors.background,
    fontSize: 14,
    fontWeight: '800' as const,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: DriverColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 34,
  },
  sheetTitle: {
    color: DriverColors.textPrimary,
    marginBottom: 12,
  },
  sheetItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: DriverColors.border,
  },
  sheetCancel: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
});
