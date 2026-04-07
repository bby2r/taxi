import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Linking,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DriverColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import ActionButton from '../../components/ActionButton';
import { useDriverOrder } from '../../hooks/useDriverOrder';
import type { DriverStackParamList } from '../../navigation/types';
import type { Order } from '../../api/types';

type NavigationProp = NativeStackNavigationProp<DriverStackParamList, 'OrderActive'>;

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

function EnRouteCard({
  order,
  onMarkArrived,
  loading,
}: {
  order: Order;
  onMarkArrived: () => void;
  loading: boolean;
}): React.ReactNode {
  return (
    <View style={styles.cardContent}>
      <Text style={[Typography.caption, { color: DriverColors.textMuted }]}>
        Адрес подачи
      </Text>
      <Text
        style={[Typography.bodyBold, { color: DriverColors.textPrimary, marginTop: 4 }]}
        numberOfLines={2}
      >
        {order.pickup_address || 'Геолокация клиента'}
      </Text>

      <TouchableOpacity
        onPress={() => openNavigation(order.pickup_latitude, order.pickup_longitude)}
        style={styles.navigationLink}
        accessibilityRole="button"
        accessibilityLabel="Навигация"
      >
        <Text style={[Typography.bodyBold, { color: DriverColors.primary }]}>
          Навигация →
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
  onMarkCompleted,
  loading,
}: {
  order: Order;
  onMarkCompleted: () => void;
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
  const { state, markArrived, markCompleted, dismissCompleted, loading } =
    useDriverOrder();
  const mapRef = useRef<MapView>(null);

  // Go back if phase is not relevant to this screen
  useEffect(() => {
    if (
      state.phase !== 'active' &&
      state.phase !== 'arrived' &&
      state.phase !== 'completed'
    ) {
      navigation.goBack();
    }
  }, [state.phase, navigation]);

  const order =
    state.phase === 'active' || state.phase === 'arrived' || state.phase === 'completed'
      ? state.order
      : null;

  // Fit map to pickup coordinate
  useEffect(() => {
    if (mapRef.current && order) {
      mapRef.current.fitToCoordinates(
        [{ latitude: order.pickup_latitude, longitude: order.pickup_longitude }],
        {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        },
      );
    }
  }, [order]);

  if (!order) {
    return null;
  }

  const handleDismiss = (): void => {
    dismissCompleted();
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation
        showsMyLocationButton
      >
        <Marker
          coordinate={{
            latitude: order.pickup_latitude,
            longitude: order.pickup_longitude,
          }}
          title={order.pickup_address || 'Клиент'}
        />
      </MapView>

      <View style={styles.bottomCard}>
        {state.phase === 'active' && (
          <EnRouteCard
            order={order}
            onMarkArrived={markArrived}
            loading={loading}
          />
        )}
        {state.phase === 'arrived' && (
          <ArrivedCard
            order={order}
            onMarkCompleted={markCompleted}
            loading={loading}
          />
        )}
        {state.phase === 'completed' && (
          <CompletedCard order={order} onDismiss={handleDismiss} />
        )}
      </View>
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
  navigationLink: {
    marginTop: 16,
    paddingVertical: 8,
  },
  spacer: {
    flex: 1,
  },
  actionButton: {
    marginTop: 16,
  },
});
