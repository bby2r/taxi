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
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DriverColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import ActionButton from '../../components/ActionButton';
import { useDriverOrder } from '../../hooks/useDriverOrder';
import { useLocation } from '../../hooks/useLocation';
import { useRoute as useNavigationRoute } from '../../hooks/useRoute';
import type { DriverStackParamList } from '../../navigation/types';
import type { Order, DriverCancellationReason } from '../../api/types';
import type { Route } from '../../api/routing';

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
}: {
  order: Order;
  onMarkArrived: () => void;
  loading: boolean;
  route: Route | null;
  routeLoading: boolean;
  routeError: string | null;
  locationError: string | null;
}): React.ReactNode {
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

      <ActionButton
        title="Я на месте"
        onPress={onMarkArrived}
        loading={loading}
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
  const mapRef = useRef<MapView>(null);
  const driverLocation = useLocation();
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);

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

  const pickupPoint = order
    ? { latitude: order.pickup_latitude, longitude: order.pickup_longitude }
    : null;

  const dropoffPoint =
    order && order.dropoff_latitude !== null && order.dropoff_longitude !== null
      ? { latitude: order.dropoff_latitude, longitude: order.dropoff_longitude }
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
    loading: routeLoading,
    error: routeError,
  } = useNavigationRoute(routeOrigin, routeDestination);

  // Fit map to route bounds (or pickup + driver, or pickup alone)
  useEffect(() => {
    if (!mapRef.current || !order) {
      return;
    }
    const coords =
      route && route.coordinates.length > 0
        ? route.coordinates
        : [
            { latitude: order.pickup_latitude, longitude: order.pickup_longitude },
            ...(driverPoint ? [driverPoint] : []),
          ];
    if (coords.length === 0) {
      return;
    }
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }, [order, route, driverPoint?.latitude, driverPoint?.longitude]);

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
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: order.pickup_latitude,
          longitude: order.pickup_longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation
        showsMyLocationButton
        mapPadding={{ top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 40) + 8 : 0, right: 0, bottom: 0, left: 0 }}
      >
        <Marker
          coordinate={{
            latitude: order.pickup_latitude,
            longitude: order.pickup_longitude,
          }}
          title={order.pickup_address || 'Клиент'}
          pinColor={DriverColors.primary}
        />
        {dropoffPoint && (
          <Marker
            coordinate={dropoffPoint}
            title={order.dropoff_address || order.region?.name || 'Пункт Б'}
            pinColor={DriverColors.success}
            testID="dropoff-marker"
          />
        )}
        {driverPoint && (state.phase === 'active' || state.phase === 'in_progress') && (
          <Marker
            coordinate={driverPoint}
            title="Вы"
            anchor={{ x: 0.5, y: 0.5 }}
            testID="driver-marker"
          >
            <View style={styles.driverDot} />
          </Marker>
        )}
        {route && route.coordinates.length > 1 && (
          <Polyline
            coordinates={route.coordinates}
            strokeColor={DriverColors.primary}
            strokeWidth={5}
            testID="route-polyline"
          />
        )}
      </MapView>

      <View style={styles.bottomCard}>
        {state.phase === 'active' && (
          <EnRouteCard
            order={order}
            onMarkArrived={markArrived}
            loading={loading}
            route={route}
            routeLoading={routeLoading}
            routeError={routeError}
            locationError={driverLocation.error}
          />
        )}
        {state.phase === 'arrived' && (
          <ArrivedCard
            order={order}
            onMarkStarted={markStarted}
            onCancelRequest={() => setCancelSheetOpen(true)}
            loading={loading}
          />
        )}
        {state.phase === 'in_progress' && (
          <InProgressCard
            order={order}
            onMarkCompleted={markCompleted}
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
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: DriverColors.primary,
    borderWidth: 3,
    borderColor: '#fff',
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
