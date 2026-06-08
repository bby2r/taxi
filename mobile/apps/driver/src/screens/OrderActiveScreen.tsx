import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  DriverColors,
  Typography,
  ActionButton,
  ConfirmModal,
  useLocation,
  useRoute as useNavigationRoute,
  haversineMeters,
  bearingBetween,
  smoothBearing,
  angularGapDeg,
} from '@taxi/shared';
import type { Order, DriverCancellationReason, Route } from '@taxi/shared';
import { useDriverOrder } from '../hooks/useDriverOrder';
import MapLibreMapView, { type MapLibreMapHandle } from '../components/MapLibreMapView';
import type { DriverStackParamList } from '../navigation/types';

// Driver must be within this distance of the pickup point before they can
// confirm "Прибыл к клиенту". Stops them from tapping the button while still
// driving and triggering an early "Водитель ожидает вас" push to the client.
const ARRIVED_THRESHOLD_METERS = 150;

// --- Follow-camera target tuning (navigation phases) --------------------
// The camera is driven by a continuous 60fps loop inside the WebView
// (MapLibreMapView.setFollowTarget) that eases toward a target we push here
// at GPS rate. This screen's only job is to compute a STABLE target:
// position snapped to the route (map matching), bearing from the route /
// GPS travel-direction — never the magnetometer — low-passed and deadzoned.
const ON_ROUTE_SNAP_M = 30; // snap the camera onto the route within this distance
const POS_EMA_ALPHA = 0.5; // light low-pass on the raw GPS position
const MOVE_FOR_BEARING_M = 5; // need this much travel to trust a GPS-derived bearing
const BEARING_DEADZONE_DEG = 4; // ignore target-bearing changes smaller than this
const TARGET_BEARING_ALPHA = 0.5; // low-pass the target bearing (on top of the deadzone)
const MIN_TARGET_SEND_MS = 150; // cap how often we cross the RN→WebView bridge

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

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} м`;
  }
  return `${(meters / 1000).toFixed(1)} км`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes} мин`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
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
        <Text style={styles.callIcon}>📞</Text>
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
  onMarkArrived,
  loading,
  route,
  routeLoading,
  routeError,
  locationError,
  distanceToPickup,
}: {
  order: Order;
  onMarkArrived: () => void;
  loading: boolean;
  route: Route | null;
  routeLoading: boolean;
  routeError: string | null;
  locationError: string | null;
  distanceToPickup: number | null;
}): React.ReactNode {
  const canArrive =
    distanceToPickup !== null && distanceToPickup <= ARRIVED_THRESHOLD_METERS;
  return (
    <View style={styles.cardContent}>
      {route && (
        <View style={styles.etaRow}>
          <Text
            style={[Typography.h2, { color: DriverColors.primary }]}
            testID="route-eta"
          >
            {formatDuration(route.durationSeconds)}
          </Text>
          <Text
            style={[Typography.body, { color: DriverColors.textMuted, marginLeft: 12 }]}
            testID="route-distance"
          >
            {formatDistance(route.distanceMeters)}
          </Text>
        </View>
      )}
      {!route && routeLoading && (
        <Text
          style={[Typography.caption, { color: DriverColors.textMuted }]}
          testID="route-loading"
        >
          Строим маршрут...
        </Text>
      )}
      {!route && !routeLoading && (routeError || locationError) && (
        <Text
          style={[Typography.caption, { color: DriverColors.danger }]}
          testID="route-error"
        >
          {locationError
            ? 'Включите геолокацию для маршрута'
            : 'Маршрут недоступен'}
        </Text>
      )}

      <Text
        style={[Typography.caption, { color: DriverColors.textMuted, marginTop: 8 }]}
      >
        Адрес подачи
      </Text>
      <Text
        style={[Typography.bodyBold, { color: DriverColors.textPrimary, marginTop: 4 }]}
        numberOfLines={2}
      >
        {order.pickup_address || 'Геолокация клиента'}
      </Text>

      {order.is_inter_district && (
        <>
          <Text
            style={[Typography.caption, { color: DriverColors.textMuted, marginTop: 12 }]}
          >
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

      <ClientContact order={order} />

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

      <View style={styles.spacer} />

      {!canArrive && distanceToPickup !== null && (
        <Text
          style={[Typography.caption, styles.distanceHint]}
          testID="distance-to-pickup"
        >
          До клиента: {Math.round(distanceToPickup)} м · кнопка станет
          активной в радиусе {ARRIVED_THRESHOLD_METERS} м
        </Text>
      )}
      {!canArrive && distanceToPickup === null && (
        <Text style={[Typography.caption, styles.distanceHint]}>
          Ждём геолокацию...
        </Text>
      )}
      <ActionButton
        title="Прибыл к клиенту"
        onPress={onMarkArrived}
        loading={loading}
        disabled={!canArrive}
        style={styles.actionButton}
      />
    </View>
  );
}

function ArrivedCard({
  order,
  onMarkStarted,
  onCancelRequest,
  loading,
}: {
  order: Order;
  onMarkStarted: () => void;
  onCancelRequest: () => void;
  loading: boolean;
}): React.ReactNode {
  return (
    <View style={styles.cardContent}>
      <Text style={[Typography.h3, { color: DriverColors.success }]}>
        ✅ Вы на месте
      </Text>
      <Text
        style={[Typography.caption, { color: DriverColors.textMuted, marginTop: 4 }]}
      >
        Клиент уведомлён
      </Text>

      <Text
        style={[
          Typography.body,
          { color: DriverColors.textSecondary, marginTop: 16 },
        ]}
        numberOfLines={2}
      >
        {order.pickup_address || 'Геолокация клиента'}
      </Text>

      <ClientContact order={order} />

      <View style={styles.spacer} />

      <ActionButton
        title="Начать поездку"
        onPress={onMarkStarted}
        loading={loading}
        style={styles.actionButton}
      />
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
  onMarkCompleted,
  loading,
  route,
  routeLoading,
  routeError,
}: {
  order: Order;
  onMarkCompleted: () => void;
  loading: boolean;
  route: Route | null;
  routeLoading: boolean;
  routeError: string | null;
}): React.ReactNode {
  return (
    <View style={styles.cardContent}>
      <Text style={[Typography.h3, { color: DriverColors.primary }]}>В поездке</Text>

      {route && (
        <View style={[styles.etaRow, { marginTop: 8 }]}>
          <Text style={[Typography.h2, { color: DriverColors.primary }]}>
            {formatDuration(route.durationSeconds)}
          </Text>
          <Text style={[Typography.body, { color: DriverColors.textMuted, marginLeft: 12 }]}>
            {formatDistance(route.distanceMeters)}
          </Text>
        </View>
      )}
      {!route && routeLoading && (
        <Text style={[Typography.caption, { color: DriverColors.textMuted, marginTop: 8 }]}>
          Строим маршрут...
        </Text>
      )}
      {!route && !routeLoading && routeError && (
        <Text style={[Typography.caption, { color: DriverColors.danger, marginTop: 8 }]}>
          Маршрут недоступен
        </Text>
      )}

      {order.is_inter_district && (
        <>
          <Text style={[Typography.caption, { color: DriverColors.textMuted, marginTop: 12 }]}>
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

      <View style={styles.spacer} />

      <ActionButton
        title="Завершить поездку"
        onPress={onMarkCompleted}
        loading={loading}
        style={styles.actionButton}
      />
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
      <Text style={{ fontSize: 48 }}>✅</Text>
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
  // Follow-target state (refs so updates never re-render). lastGpsRef: last
  // raw fix, for the travel-direction bearing. emaPosRef: low-passed
  // position. targetBearingRef: smoothed + deadzoned target bearing.
  // lastSendRef: throttle timestamp for the RN→WebView bridge.
  const lastGpsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const emaPosRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const targetBearingRef = useRef<number | null>(null);
  const lastSendRef = useRef<number>(0);
  const bottomSheetRef = useRef<BottomSheet>(null);
  // Three positions like Yandex Taxi driver: barely visible (just handle
  // + ETA peek), default (all key info + main action), expanded (full
  // details, room for future content). Driver swipes between them.
  const snapPoints = useMemo(() => ['18%', '48%', '88%'], []);
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

  // CompletedCard is centered and needs the full sheet to render
  // correctly — auto-expand on completion so the driver sees the
  // payout summary without having to swipe.
  useEffect(() => {
    if (state.phase === 'completed') {
      bottomSheetRef.current?.snapToIndex(2);
    }
  }, [state.phase]);

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


  // Two camera modes for the active screen:
  //
  //   - "Navigation" — driving phases (active / in_progress). Camera
  //     locks onto the driver, tilts to 55°, rotates to follow heading.
  //     Yandex-style "you're inside the trip", not "you're looking down
  //     at a map". Updated on every coord/heading change.
  //
  //   - "Overview" — arrived / completed / no route yet. Fit to bounds
  //     (driver + pickup or full route line) so the operator can see
  //     the whole situation at a glance.
  //
  const isNavigating =
    (state.phase === 'active' || state.phase === 'in_progress') && driverPoint !== null;

  // Camera follow toggle. Defaults on; the driver pinching/panning the
  // map sets it to false (handled by onCameraChanged below) — that's
  // when the "Вернуться к маршруту" button appears so they can opt back
  // in. Same pattern Yandex uses: never fight the user's gesture.
  const [following, setFollowing] = useState(true);

  // Re-enable follow whenever the screen transitions into a new phase
  // (newly accepted, freshly in-progress). Driver expects auto-follow
  // again after a state change even if they had panned away.
  useEffect(() => {
    mapRef.current?.clearOverride();
    emaPosRef.current = null;
    lastGpsRef.current = null;
    targetBearingRef.current = null;
    setFollowing(true);
  }, [state.phase]);

  useEffect(() => {
    if (!order) return;
    if (isNavigating && driverPoint) {
      if (!following) return; // user panned — WebView keeps their view (override lock)

      // 1. Low-pass the raw GPS position — kills per-fix coordinate jitter
      //    before it can shimmer the camera.
      const prevEma = emaPosRef.current;
      const ema = prevEma
        ? {
            latitude: prevEma.latitude + (driverPoint.latitude - prevEma.latitude) * POS_EMA_ALPHA,
            longitude:
              prevEma.longitude + (driverPoint.longitude - prevEma.longitude) * POS_EMA_ALPHA,
          }
        : driverPoint;
      emaPosRef.current = ema;

      // 2. Map matching: snap onto the route when close to it and take the
      //    bearing from the road tangent (the smoothest possible source).
      //    trimmedCoordinates[0] is the driver projected onto the route.
      let center = ema;
      let rawBearing: number | null = null;
      if (trimmedCoordinates.length >= 2) {
        const snapped = trimmedCoordinates[0];
        if (haversineMeters(ema, snapped) <= ON_ROUTE_SNAP_M) {
          center = snapped;
          rawBearing = bearingBetween(trimmedCoordinates[0], trimmedCoordinates[1]);
        }
      }

      // 3. Off-route fallback: GPS course if the device reports one, else the
      //    travel direction between consecutive fixes (trusted once moved).
      if (rawBearing === null) {
        const gpsHeading = driverLocation.heading;
        if (typeof gpsHeading === 'number' && gpsHeading > 0) {
          rawBearing = gpsHeading;
        } else if (
          lastGpsRef.current &&
          haversineMeters(lastGpsRef.current, driverPoint) >= MOVE_FOR_BEARING_M
        ) {
          rawBearing = bearingBetween(lastGpsRef.current, driverPoint);
        }
      }
      lastGpsRef.current = driverPoint;

      // 4. Deadzone + low-pass the target bearing: ignore tiny changes (phone
      //    shake / sensor noise), and let real turns arrive already smoothed.
      let targetBearing = targetBearingRef.current;
      if (rawBearing !== null) {
        if (targetBearing === null) {
          targetBearing = rawBearing;
        } else if (angularGapDeg(targetBearing, rawBearing) >= BEARING_DEADZONE_DEG) {
          targetBearing = smoothBearing(targetBearing, rawBearing, TARGET_BEARING_ALPHA);
        }
      }
      targetBearingRef.current = targetBearing;

      // 5. Throttle the bridge crossing — the 60fps smoothing lives inside the
      //    WebView loop, so we only need to refresh its target at GPS rate.
      const now = Date.now();
      if (now - lastSendRef.current < MIN_TARGET_SEND_MS) return;
      lastSendRef.current = now;

      mapRef.current?.setFollowTarget({
        latitude: center.latitude,
        longitude: center.longitude,
        bearing: targetBearing ?? undefined,
        zoom: 17,
        pitch: 55,
      });
      return;
    }

    // Overview (arrived / completed / no driver fix yet): stop the follow
    // loop, drop target state, and fit the whole trip in view. Keep a slight
    // 30° tilt — the 3D look is on permanently, but navigator-grade 55° on a
    // zoomed-out view distorts ugly.
    mapRef.current?.stopFollow();
    emaPosRef.current = null;
    lastGpsRef.current = null;
    targetBearingRef.current = null;
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
    trimmedCoordinates,
    driverPoint?.latitude,
    driverPoint?.longitude,
    driverLocation.heading,
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
        onUserGesture={() => {
          // Driver panned/pinched — drop follow so our camera effect
          // stops fighting their view. "Вернуться к маршруту" button
          // below re-engages it.
          if (following && isNavigating) {
            setFollowing(false);
          }
        }}
      />

      {/* Re-engage follow camera. Shows only when driver opted out of
          follow by panning the map mid-navigation. Tap snaps back to
          the tilted heading-locked view. */}
      {isNavigating && !following && (
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={() => {
            mapRef.current?.clearOverride();
            emaPosRef.current = null;
            lastGpsRef.current = null;
            targetBearingRef.current = null;
            setFollowing(true);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.recenterIcon}>🎯</Text>
          <Text style={styles.recenterText}>Вернуться к маршруту</Text>
        </TouchableOpacity>
      )}

      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={styles.sheetInner}>
          {state.phase === 'active' && (
            <EnRouteCard
              order={order}
              onMarkArrived={requestArrived}
              loading={loading}
              route={route}
              routeLoading={routeLoading}
              routeError={routeError}
              locationError={driverLocation.error}
              distanceToPickup={
                driverPoint && pickupPoint
                  ? haversineMeters(driverPoint, pickupPoint)
                  : null
              }
            />
          )}
          {state.phase === 'arrived' && (
            <ArrivedCard
              order={order}
              onMarkStarted={requestStart}
              onCancelRequest={() => setCancelSheetOpen(true)}
              loading={loading}
            />
          )}
          {state.phase === 'in_progress' && (
            <InProgressCard
              order={order}
              onMarkCompleted={requestComplete}
              loading={loading}
              route={route}
              routeLoading={routeLoading}
              routeError={routeError}
            />
          )}
          {state.phase === 'completed' && (
            <CompletedCard order={order} onDismiss={handleDismiss} />
          )}
        </BottomSheetView>
      </BottomSheet>

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
  sheetBackground: {
    backgroundColor: DriverColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHandle: {
    backgroundColor: DriverColors.border,
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  sheetInner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 34,
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
  recenterIcon: {
    fontSize: 16,
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
  callIcon: {
    fontSize: 18,
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
