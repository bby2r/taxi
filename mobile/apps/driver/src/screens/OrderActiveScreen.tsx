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
  addActiveOrderListener,
  hasOverlayPermission,
  hideActiveOrderOverlay,
  openOverlaySettings,
  showActiveOrderOverlay,
  updateActiveOrderOverlay,
  type ActiveOrderPayload,
} from '../../modules/offer-overlay/src';
import { Icon } from '@taxi/shared';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  DriverColors,
  Typography,
  ActionButton,
  ConfirmModal,
  formatDistance,
  formatDuration,
  useLocation,
  useMapRemountRestoration,
  useRoute as useNavigationRoute,
  haversineMeters,
  snapToPolyline,
  bearingBetween,
  GeoKalmanFilter,
} from '@taxi/shared';
import type { Order, DriverCancellationReason, Route } from '@taxi/shared';
import { useDriverOrder } from '../hooks/useDriverOrder';
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

// Перпендикулярный порог принятия snap'а. Под порогом — водителя считаем «на
// маршруте» и привязываем точку к polyline (убирает GPS-смещение тротуар/двор
// в плотной застройке). Над порогом — настоящее отклонение, оставляем
// Kalman-позицию как есть, до следующего перерасчёта маршрута бэкендом.
const SNAP_REJECT_METERS = 25;
// Дропаем fix'ы с неопределённостью выше этого порога (тоннель / двор-колодец).
// Kalman формально весит fix по accuracy, но один выброс ~80 м всё равно дёргает
// state на десятки метров — глаз ловит как телепорт.
const MAX_ACCURACY_METERS = 50;
// Навигационный камера preset. Один и тот же в follow-loop'е и в recenterTo,
// чтобы переход «жест → возврат» не менял зум/наклон.
const NAV_ZOOM = 17;
const NAV_PITCH = 50;
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


function ClientContact({ order }: { order: Order }): React.ReactNode {
  return (
    <TouchableOpacity
      style={styles.contactRow}
      onPress={() => callPhone(order.client.phone)}
      activeOpacity={0.7}
      accessibilityLabel="Позвонить клиенту"
      testID="call-client"
    >
      <View style={styles.contactInfo}>
        <Text style={[Typography.bodyBold, { color: DriverColors.textPrimary }]}>
          {order.client.name}
        </Text>
        <Text style={[Typography.caption, { color: DriverColors.textMuted }]}>
          {order.client.phone}
        </Text>
      </View>
      <View style={styles.callButton}>
        <Icon name="phone" size={18} color={DriverColors.white} />
      </View>
    </TouchableOpacity>
  );
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

function EnRouteCard({
  order,
}: {
  order: Order;
}): React.ReactNode {
  return (
    <View style={styles.cardContent}>
      <Text style={[Typography.caption, { color: DriverColors.textMuted }]}>
        Адрес подачи
      </Text>
      <Text
        style={[Typography.bodyBold, { color: DriverColors.textPrimary, marginTop: 4 }]}
        numberOfLines={3}
      >
        {order.pickup_address || 'Геолокация клиента'}
      </Text>

      {order.is_inter_district && (
        <>
          <Text style={[Typography.caption, { color: DriverColors.textMuted, marginTop: 16 }]}>
            Куда
          </Text>
          <Text
            style={[Typography.bodyBold, { color: DriverColors.textPrimary, marginTop: 4 }]}
            numberOfLines={2}
          >
            {order.dropoff_address || order.region?.name || '—'}
          </Text>
        </>
      )}

      <TouchableOpacity
        onPress={() => openNavigation(order.pickup_latitude, order.pickup_longitude)}
        style={styles.navigationLink}
        accessibilityRole="button"
        accessibilityLabel="Навигация"
      >
        <Text style={[Typography.bodyBold, { color: DriverColors.primary }]}>
          Открыть в Картах →
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ArrivedCard({
  order,
  onCancelRequest,
}: {
  order: Order;
  onCancelRequest: () => void;
}): React.ReactNode {
  return (
    <View style={styles.cardContent}>
      <Text style={[Typography.caption, { color: DriverColors.textMuted }]}>
        Адрес подачи
      </Text>
      <Text
        style={[Typography.bodyBold, { color: DriverColors.textPrimary, marginTop: 4 }]}
        numberOfLines={3}
      >
        {order.pickup_address || 'Геолокация клиента'}
      </Text>

      <TouchableOpacity
        onPress={onCancelRequest}
        style={styles.cancelLink}
        accessibilityRole="button"
        testID="driver-cancel-button"
      >
        <Text style={[Typography.bodyBold, { color: DriverColors.danger }]}>
          Клиент не пришёл — отменить
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function InProgressCard({
  order,
}: {
  order: Order;
}): React.ReactNode {
  return (
    <View style={styles.cardContent}>
      {order.is_inter_district ? (
        <>
          <Text style={[Typography.caption, { color: DriverColors.textMuted }]}>
            Куда
          </Text>
          <Text
            style={[Typography.bodyBold, { color: DriverColors.textPrimary, marginTop: 4 }]}
            numberOfLines={3}
          >
            {order.dropoff_address || order.region?.name || '—'}
          </Text>
        </>
      ) : (
        <Text style={[Typography.caption, { color: DriverColors.textMuted }]}>
          Поездка идёт. Сумма: {order.price} сом
        </Text>
      )}
    </View>
  );
}

function CompletedCard({
  order,
  onDismiss,
}: {
  order: Order;
  onDismiss: () => void;
}): React.ReactNode {
  return (
    <View style={[styles.cardContent, { alignItems: 'center', justifyContent: 'center' }]}>
      <Icon name="check-circle" size={48} color={DriverColors.success} />
      <Text
        style={[Typography.h2, { color: DriverColors.textPrimary, marginTop: 12 }]}
      >
        Заказ завершён!
      </Text>
      <Text
        style={[
          Typography.h1,
          { color: DriverColors.primary, marginTop: 16 },
        ]}
      >
        + {order.price} сом
      </Text>

      <ActionButton
        title="Готово"
        onPress={onDismiss}
        style={{ ...styles.actionButton, marginTop: 24 }}
      />
    </View>
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
      }
    });
    return sub;
  }, [navigation, state.phase]);

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

  // Route to pickup while en-route; route to dropoff once ride is in progress.
  const shouldRouteToPickup = state.phase === 'active';
  const shouldRouteToDropoff = state.phase === 'in_progress' && dropoffPoint !== null;
  const routeOrigin = shouldRouteToPickup
    ? driverPoint
    : shouldRouteToDropoff
      ? driverPoint
      : null;
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
    return {
      orderId: order.id,
      clientName: order.client.name ?? 'Клиент',
      ratingText: undefined,
      statusText: phaseLabel[state.phase],
      etaText: route
        ? `${formatDuration(route.durationSeconds)} · ${formatDistance(route.distanceMeters)}`
        : '',
      pickupAddress: order.pickup_address ?? '',
      dropoffAddress: order.dropoff_address ?? undefined,
      priceText: `${order.price} сом`,
      primaryLabel: primaryLabel[state.phase],
      // «Прибыл» доступна только когда водитель в радиусе ARRIVED_THRESHOLD_METERS.
      // На overlay это рендерится как полупрозрачная неактивная кнопка.
      primaryDisabled: state.phase === 'active' && !canArrive,
    };
  }, [order, state.phase, route, canArrive]);

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
    const sub = addActiveOrderListener((event) => {
      if (event.orderId !== order.id) return;
      switch (event.action) {
        case 'call':
          if (order.client.phone) Linking.openURL(`tel:${order.client.phone}`);
          break;
        case 'primary':
          if (state.phase === 'active') requestArrived();
          else if (state.phase === 'arrived') requestStart();
          else if (state.phase === 'in_progress') requestComplete();
          break;
        case 'openMaps':
          openNavigation(order.pickup_latitude, order.pickup_longitude);
          break;
        case 'hide':
          hideActiveOrderOverlay();
          break;
      }
    });
    return () => sub.remove();
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
    setFollowing(true);
  }, [state.phase]);

  useEffect(() => {
    if (!order) return;
    if (isNavigating && driverPoint) {
      if (!following) return; // user panned — WebView keeps their view (override lock)

      if (!kalmanRef.current) {
        // minBearingSpeed 2.5 m/s (~9 km/h): below this the filter returns no
        // heading and we hold the last one. Default 2.0 let the map still
        // swing while crawling/turning slowly on village streets (velocity
        // direction is noise-dominated at low speed) — раздражало водителя.
        kalmanRef.current = new GeoKalmanFilter({ minBearingSpeed: 2.5 });
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
      const useSnap = snap !== null && snap.perpMeters <= SNAP_REJECT_METERS;
      const posLat = useSnap ? snap.latitude : filtered.latitude;
      const posLng = useSnap ? snap.longitude : filtered.longitude;

      // Bearing: вдоль линии маршрута, не вдоль velocity-вектора. Velocity от
      // Kalman'а — это «куда сейчас смотрит машина», route tangent — это «куда
      // идёт дорога». На прямой это одно и то же, но в повороте/перекрёстке
      // velocity размазана по дуге (машина едет по кривой), а tangent чётко
      // следует за улицей. Так делает Яндекс.Навигатор — поэтому камера у него
      // не «съезжает» в стену на повороте.
      //
      // Берём tangent ТОЛЬКО когда мы реально на маршруте (useSnap) и есть
      // следующий сегмент — это значит у нас валидная улица под колёсами.
      // Иначе откатываемся на velocity-bearing от Kalman'а (стабильный, но
      // следует за машиной, а не за дорогой). Сглаживание целевого bearing'а
      // на 60fps делает WebView (FOLLOW_BRG_A=0.12 + dead-zone 4°), так что
      // переход с одного сегмента на другой не «прыгает» — лерпится мягко.
      let nextBearing: number | null = null;
      if (
        useSnap &&
        snap !== null &&
        snap.segmentIndex < trimmedCoordinates.length - 1 &&
        filtered.bearing !== null
      ) {
        const segA = trimmedCoordinates[snap.segmentIndex];
        const segB = trimmedCoordinates[snap.segmentIndex + 1];
        nextBearing = bearingBetween(segA, segB);
      } else if (filtered.bearing !== null) {
        nextBearing = filtered.bearing;
      }
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
      // NAV_PITCH=50° — на 55° горизонт уходит к верху экрана и ближняя
      // дорога растягивается; 50° даёт Яндекс-style 3D без искажения.
      lastNavRef.current = {
        latitude: posLat,
        longitude: posLng,
        heading: targetBearingRef.current ?? 0,
      };
      mapRef.current?.setFollowTarget({
        latitude: posLat,
        longitude: posLng,
        bearing: targetBearingRef.current ?? undefined,
        velLng: filtered.velLngPerMs,
        velLat: filtered.velLatPerMs,
        zoom: NAV_ZOOM,
        pitch: NAV_PITCH,
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
            }
            setFollowing(true);
          }}
          activeOpacity={0.85}
        >
          <Icon name="navigation" size={16} color={DriverColors.primary} />
          <Text style={styles.recenterText}>Вернуться к маршруту</Text>
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
  cardContent: {
    flex: 1,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  recenterButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 16 : 60,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: DriverColors.cardBackground,
    borderWidth: 1,
    borderColor: DriverColors.border,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  statusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recenterText: {
    color: DriverColors.textPrimary,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  distanceHint: {
    color: DriverColors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  navigationLink: {
    marginTop: 12,
    paddingVertical: 8,
  },
  cancelLink: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  spacer: {
    flex: 1,
  },
  actionButton: {
    marginTop: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: DriverColors.cardBackground,
  },
  contactInfo: {
    flex: 1,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DriverColors.success,
    justifyContent: 'center',
    alignItems: 'center',
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
