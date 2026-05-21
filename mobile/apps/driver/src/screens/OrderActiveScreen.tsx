import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Linking,
  TouchableOpacity,
  StatusBar,
  Modal,
} from 'react-native';
import Mapbox from '@rnmapbox/maps';
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
} from '@taxi/shared';
import type { Order, DriverCancellationReason, Route } from '@taxi/shared';
import { useDriverOrder } from '../hooks/useDriverOrder';
import DriverArrow from '../components/DriverArrow';
import type { DriverStackParamList } from '../navigation/types';

// Driver must be within this distance of the pickup point before they can
// confirm "Прибыл к клиенту". Stops them from tapping the button while still
// driving and triggering an early "Водитель ожидает вас" push to the client.
const ARRIVED_THRESHOLD_METERS = 150;

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
  const cameraRef = useRef<Mapbox.Camera>(null);
  const driverLocation = useLocation();
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
    setPendingAction({
      message: 'Подтвердите завершение поездки',
      confirmLabel: 'Завершить',
      run: markCompleted,
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
    setFollowing(true);
  }, [state.phase]);

  useEffect(() => {
    if (!cameraRef.current || !order) return;
    if (!following) return; // user panned away — respect their view
    if (isNavigating && driverPoint) {
      // Tilt + bearing + zoom. Heading comes from expo-location's
      // `useLocation` hook (degrees, 0 = north) — Mapbox uses the same
      // convention. animationDuration = 1000ms keeps the camera glide
      // smooth rather than snapping per fix.
      //
      // padding shifts where in the viewport the centerCoordinate lands.
      // Big paddingBottom pushes the visual center upward, so the driver
      // arrow sits in the lower-third of the screen — leaves room to
      // see the road ahead, matching navigation-app convention.
      cameraRef.current.setCamera({
        centerCoordinate: [driverPoint.longitude, driverPoint.latitude],
        zoomLevel: 17,
        pitch: 55,
        heading:
          typeof driverLocation.heading === 'number' && driverLocation.heading >= 0
            ? driverLocation.heading
            : 0,
        padding: { paddingTop: 60, paddingBottom: 380, paddingLeft: 0, paddingRight: 0 },
        animationDuration: 1000,
      });
      return;
    }
    // Overview: compute lat/lng bounds from route or available points.
    const coords =
      route && route.coordinates.length > 0
        ? route.coordinates
        : [
            ...(pickupPoint ? [pickupPoint] : []),
            ...(dropoffPoint ? [dropoffPoint] : []),
            ...(driverPoint ? [driverPoint] : []),
          ];
    if (coords.length === 0) return;
    let minLat = coords[0].latitude;
    let maxLat = coords[0].latitude;
    let minLng = coords[0].longitude;
    let maxLng = coords[0].longitude;
    for (const c of coords) {
      if (c.latitude < minLat) minLat = c.latitude;
      if (c.latitude > maxLat) maxLat = c.latitude;
      if (c.longitude < minLng) minLng = c.longitude;
      if (c.longitude > maxLng) maxLng = c.longitude;
    }
    cameraRef.current.fitBounds(
      [maxLng, maxLat], // NE
      [minLng, minLat], // SW
      [80, 60, 60, 60], // padding: top, right, bottom, left
      800,
    );
  }, [
    isNavigating,
    order,
    route,
    driverPoint?.latitude,
    driverPoint?.longitude,
    driverLocation.heading,
    following,
  ]);

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
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.TrafficDay}
        compassEnabled={false}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onCameraChanged={(state) => {
          // reason === 'gesture' fires only when the driver pans/pinches
          // — we never trigger gestures from code. Break follow so our
          // useEffect stops fighting the driver's view. They'll get a
          // "Вернуться к маршруту" button to opt back in.
          if (
            following &&
            isNavigating &&
            (state as { gestures?: { isGestureActive?: boolean } }).gestures
              ?.isGestureActive
          ) {
            setFollowing(false);
          }
        }}
      >
        <Mapbox.Camera ref={cameraRef} />

        {/* Thick highlighted route polyline — drawn first so markers
            sit on top. Style stays the same in both navigation and
            overview camera modes. */}
        {trimmedCoordinates.length > 1 && (
          <Mapbox.ShapeSource
            id="route-source"
            shape={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: trimmedCoordinates.map((c) => [c.longitude, c.latitude]),
              },
            }}
          >
            <Mapbox.LineLayer
              id="route-line"
              style={{
                lineColor: DriverColors.primary,
                lineWidth: 9,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.95,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {pickupPoint && (
          <Mapbox.PointAnnotation
            id="pickup"
            coordinate={[pickupPoint.longitude, pickupPoint.latitude]}
            title={order.pickup_address || 'Клиент'}
          >
            <View style={styles.pickupPin} />
          </Mapbox.PointAnnotation>
        )}

        {dropoffPoint && (
          <Mapbox.PointAnnotation
            id="dropoff"
            coordinate={[dropoffPoint.longitude, dropoffPoint.latitude]}
            title={order.dropoff_address || order.region?.name || 'Пункт Б'}
          >
            <View style={styles.dropoffPin} />
          </Mapbox.PointAnnotation>
        )}

        {driverPoint && (state.phase === 'active' || state.phase === 'in_progress') && (
          <Mapbox.PointAnnotation
            id="driver"
            coordinate={[driverPoint.longitude, driverPoint.latitude]}
          >
            <DriverArrow heading={driverLocation.heading} online />
          </Mapbox.PointAnnotation>
        )}
      </Mapbox.MapView>

      {/* Re-engage follow camera. Shows only when driver opted out of
          follow by panning the map mid-navigation. Tap snaps back to
          the tilted heading-locked view. */}
      {isNavigating && !following && (
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={() => setFollowing(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.recenterIcon}>🎯</Text>
          <Text style={styles.recenterText}>Вернуться к маршруту</Text>
        </TouchableOpacity>
      )}

      <View style={styles.bottomCard}>
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
      </View>

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
    flex: 0.6,
  },
  bottomCard: {
    flex: 0.4,
    backgroundColor: DriverColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 34,
    marginTop: -24,
  },
  cardContent: {
    flex: 1,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  driverDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: DriverColors.primary,
    borderWidth: 3,
    borderColor: '#fff',
  },
  recenterButton: {
    position: 'absolute',
    bottom: 320,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
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
  pickupPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: DriverColors.primary,
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dropoffPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: DriverColors.success,
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
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
