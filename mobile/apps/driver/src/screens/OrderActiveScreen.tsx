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
import * as Speech from 'expo-speech';
import {
  DriverColors,
  Typography,
  ActionButton,
  ConfirmModal,
  useLocation,
  useRoute as useNavigationRoute,
  useNavigationStep,
  haversineMeters,
} from '@taxi/shared';
import type { Order, DriverCancellationReason, Route } from '@taxi/shared';
import { useDriverOrder } from '../hooks/useDriverOrder';
import MapLibreMapView, { type MapLibreMapHandle } from '../components/MapLibreMapView';
import NavigationHud from '../components/NavigationHud';
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
  const mapRef = useRef<MapLibreMapHandle>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  // Three positions like Yandex Taxi driver: barely visible (just handle
  // + ETA peek), default (all key info + main action), expanded (full
  // details, room for future content). Driver swipes between them.
  const snapPoints = useMemo(() => ['18%', '48%', '88%'], []);
  // navigation: true — переключает useLocation в BestForNavigation +
  // 1Hz апдейты + 2м distanceInterval. Без этого heading приходит
  // null (network-based fix'ы heading не отдают), и follow-камера
  // зависает на bearing=0 пока водитель не сделает резкий разворот.
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

  // Локально вычисляемый bearing — на случай когда GPS отдаёт
  // heading=null. Так делает Яндекс/Google: между двумя последними
  // фиксами считаем azimuth, кешируем; если водитель не двигался
  // (порог 3-4м чтобы шумы GPS не крутили камеру в припаркованном
  // состоянии) — оставляем предыдущий bearing. Реальный GPS-heading,
  // если приходит, имеет приоритет (он точнее на скорости 30+ км/ч).
  const prevDriverPointRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const computedBearingRef = useRef<number>(0);
  useEffect(() => {
    if (!driverPoint) return;
    const prev = prevDriverPointRef.current;
    if (prev) {
      const dLat = driverPoint.latitude - prev.latitude;
      const dLng = driverPoint.longitude - prev.longitude;
      // Порог ~3-4м на широте Бишкека: ниже — GPS-джиттер крутит
      // иконку в стоячем состоянии.
      if (Math.abs(dLat) > 0.00003 || Math.abs(dLng) > 0.00003) {
        const toRad = (d: number): number => (d * Math.PI) / 180;
        const lat1 = toRad(prev.latitude);
        const lat2 = toRad(driverPoint.latitude);
        const dLngR = toRad(driverPoint.longitude - prev.longitude);
        const y = Math.sin(dLngR) * Math.cos(lat2);
        const x =
          Math.cos(lat1) * Math.sin(lat2) -
          Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLngR);
        const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
        computedBearingRef.current = bearing;
      }
    }
    prevDriverPointRef.current = driverPoint;
  }, [driverPoint?.latitude, driverPoint?.longitude]);

  // GPS-heading приоритет если есть и валидный (> 0 означает что
  // GPS действительно посчитал курс), иначе локально-вычисленный.
  const effectiveBearing =
    typeof driverLocation.heading === 'number' && driverLocation.heading >= 0
      ? driverLocation.heading
      : computedBearingRef.current;

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

  // Turn-by-turn — текущий поворот + голос. Подключаем только когда
  // едем (active / in_progress). На обзорных фазах баннер и голос
  // выключены, лишний шум диспетчеру не нужен.
  const isNavigatingForCues =
    (state.phase === 'active' || state.phase === 'in_progress');
  const { current: navStep, voiceCue, consumeVoiceCue } = useNavigationStep(
    isNavigatingForCues ? route : null,
    driverPoint,
  );

  // Голос через expo-speech. По прочтении сбрасываем cue в hook'е,
  // чтобы один и тот же манёвр не озвучивался повторно при ререндерах.
  useEffect(() => {
    if (!voiceCue) return;
    Speech.stop();
    Speech.speak(voiceCue, { language: 'ru', rate: 1.0, pitch: 1.0 });
    consumeVoiceCue();
  }, [voiceCue, consumeVoiceCue]);

  // Останавливаем голос при размонтировании / уходе с активной поездки —
  // иначе TTS добивает фразу пока водитель уже в HomeScreen.
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

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
    if (!order) return;
    if (!following) return; // user panned away — respect their view
    if (isNavigating && driverPoint) {
      // Navigation cam (3D): центр на водителе, поворот по heading +
      // наклон 55° = вид «из-под лобового стекла». На MapTiler streets-v2
      // на zoom 17+ автоматически рендерятся экструдированные здания.
      // pitch 55° — улица впереди видна, объём есть.
      //
      // Зум адаптируется к расстоянию до следующего манёвра:
      //   < 80м  → 19    (close-up, чтобы увидеть точную геометрию поворота)
      //   < 150м → 18    (приближаемся к манёвру)
      //   иначе  → 17    (cruise — обзор улицы впереди)
      // Так Yandex Navigator / Google Maps делают: камера буквально
      // «приседает» к асфальту перед поворотом.
      var zoom = 17;
      if (navStep) {
        if (navStep.distanceMeters < 80) zoom = 19;
        else if (navStep.distanceMeters < 150) zoom = 18;
      }
      mapRef.current?.setCenter(driverPoint, {
        zoom,
        pitch: 55,
        bearing: effectiveBearing,
        // Длиннее duration на zoom-in перед поворотом — без этого камера
        // дёргается. 800мс хватает чтобы плавно перейти на close-up.
        duration: 800,
      });
      return;
    }
    // Overview: fit bounds across route + key points so the operator
    // sees the whole trip. Сохраняем небольшой наклон даже в обзорном
    // режиме — пользователь хочет 3D-стиль на постоянной основе. 30°
    // компромисс: меньше навигаторских 55°, но не плоская бумажная
    // карта. На зуме обзора (12-14) сильный наклон даёт уродливую
    // перспективную дисторсию, поэтому именно 30°.
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
    effectiveBearing,
    following,
    // Без navStep.distanceMeters камера не подстраивает zoom при
    // подъезде к повороту — пересчёт только на GPS-апдейт водителя.
    navStep?.distanceMeters,
  ]);

  // Push current driver position into the WebView pin (independent of
  // the camera-follow loop above — we always want the pin to track GPS
  // even when the user has panned away).
  useEffect(() => {
    if (!driverPoint) return;
    if (!(state.phase === 'active' || state.phase === 'in_progress')) return;
    mapRef.current?.setDriver({
      latitude: driverPoint.latitude,
      longitude: driverPoint.longitude,
      heading: effectiveBearing,
    });
  }, [
    driverPoint?.latitude,
    driverPoint?.longitude,
    effectiveBearing,
    state.phase,
  ]);

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

      {/* Turn-by-turn баннер — стрелка манёвра + «Через 100 м поверните
          направо». Видим только в нав-фазах (едет к клиенту / в поездке)
          и только если есть текущий шаг от useNavigationStep.
          HUD объединяет манёвр + ETA-полоску в одну карточку — раньше
          было два разнесённых элемента, плавающая пилюля ETA на 50%
          экрана не свайпалась и выглядела «второй шторкой». */}
      {isNavigatingForCues && navStep && (
        <View style={styles.navHudWrap} pointerEvents="none">
          <NavigationHud
            maneuver={navStep.step.maneuver}
            distanceToManeuverMeters={navStep.distanceMeters}
            instruction={navStep.step.instruction}
            durationSeconds={route?.durationSeconds}
            distanceTotalMeters={route?.distanceMeters}
          />
        </View>
      )}

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
  driverDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: DriverColors.primary,
    borderWidth: 3,
    borderColor: '#fff',
  },
  navHudWrap: {
    // HUD едет под status-bar'ом с подушкой 8px и захватывает всю
    // ширину минус 12px по краям (от внутреннего marginHorizontal в
    // NavigationHud). Высота карточки ~165px (манёвр 84 + divider 1 +
    // ETA 60 + LED 8 + paddings).
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 56,
    left: 0,
    right: 0,
  },
  recenterButton: {
    // Под HUD-карточкой справа. HUD занимает ~32-200px по вертикали
    // (status bar ~32 + card ~165), recenter садится ниже на ~220px
    // чтобы не перекрывать ни манёвр-блок, ни ETA-полоску.
    position: 'absolute',
    top: 220,
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
