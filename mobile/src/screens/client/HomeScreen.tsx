import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Animated,
  Easing,
  Platform,
  StatusBar,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useLocation } from '../../hooks/useLocation';
import { useOrder } from '../../hooks/useOrder';
import ActionButton from '../../components/ActionButton';
import DriverCard from '../../components/DriverCard';
import RegionSelector from '../../components/RegionSelector';
import { ClientColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { getCurrentPrice } from '../../api/regions';

function PulsingDot(): React.ReactNode {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.6,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.pulsingDot,
        { transform: [{ scale }], opacity },
      ]}
    />
  );
}

export default function HomeScreen(): React.ReactNode {
  const location = useLocation();
  const { state, callTaxi, callRegionalTaxi, cancelOrder, dismissCompleted, loading, error } = useOrder();
  const mapRef = useRef<MapView>(null);
  const [regionSelectorVisible, setRegionSelectorVisible] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(80);

  useEffect(() => {
    getCurrentPrice()
      .then(setCurrentPrice)
      .catch(() => setCurrentPrice(80));
  }, []);

  const initialRegion: Region = {
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  const handleCallTaxi = (): void => {
    callTaxi(location.latitude, location.longitude);
  };

  const handleRegionSelect = (regionId: number): void => {
    setRegionSelectorVisible(false);
    callRegionalTaxi(location.latitude, location.longitude, regionId);
  };

  const driverCoords =
    state.phase !== 'idle' && state.phase !== 'cancelled' && state.order?.driver
      ? { latitude: state.order.driver.latitude, longitude: state.order.driver.longitude }
      : null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
        mapPadding={{ top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 40) + 8 : 0, right: 0, bottom: 0, left: 0 }}
      >
        {driverCoords && (
          <Marker coordinate={driverCoords} title="Водитель">
            <Text style={styles.carEmoji}>🚗</Text>
          </Marker>
        )}
      </MapView>

      {/* Bottom Card */}
      <View style={styles.bottomCard}>
        {error && (
          <Text style={[Typography.caption, { color: ClientColors.danger, marginBottom: 8 }]}>
            {error}
          </Text>
        )}

        {state.phase === 'idle' && (
          <>
            <Text style={[Typography.body, { color: ClientColors.textSecondary, marginBottom: 4 }]}>
              Текущее местоположение
            </Text>
            <Text style={[Typography.h2, { color: ClientColors.dark, marginBottom: 16 }]}>
              {currentPrice} сом
            </Text>
            <ActionButton
              title="Вызвать такси"
              onPress={handleCallTaxi}
              loading={loading}
              disabled={location.loading}
            />
            <ActionButton
              title="Межгород"
              onPress={() => setRegionSelectorVisible(true)}
              variant="outline"
              disabled={location.loading}
              style={{ marginTop: 12 }}
            />
          </>
        )}

        {state.phase === 'searching' && (
          <>
            <View style={styles.searchingRow}>
              <PulsingDot />
              <Text style={[Typography.h3, { color: ClientColors.dark, marginLeft: 12 }]}>
                Ищем водителя...
              </Text>
            </View>
            <ActionButton
              title="Отменить"
              onPress={cancelOrder}
              loading={loading}
              variant="outline"
              style={{ marginTop: 16 }}
            />
          </>
        )}

        {(state.phase === 'accepted' || state.phase === 'arrived' || state.phase === 'in_progress') &&
          state.order.driver && (
            <>
              <DriverCard driver={state.order.driver} status={state.phase} />
              {state.phase === 'accepted' && (
                <ActionButton
                  title="Отменить"
                  onPress={cancelOrder}
                  loading={loading}
                  variant="outline"
                />
              )}
            </>
          )}

        {(state.phase === 'accepted' || state.phase === 'arrived' || state.phase === 'in_progress') &&
          !state.order.driver && (
            <ActivityIndicator color={ClientColors.primary} />
          )}
      </View>

      {/* Completed Modal */}
      <Modal visible={state.phase === 'completed'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[Typography.h2, { color: ClientColors.dark, textAlign: 'center', marginBottom: 8 }]}>
              Поездка завершена!
            </Text>
            {state.phase === 'completed' && (
              <Text
                style={[Typography.h3, { color: ClientColors.primaryDark, textAlign: 'center', marginBottom: 20 }]}
              >
                {state.order.price} сом
              </Text>
            )}
            <ActionButton title="Готово" onPress={dismissCompleted} />
          </View>
        </View>
      </Modal>

      <RegionSelector
        visible={regionSelectorVisible}
        onSelect={handleRegionSelect}
        onClose={() => setRegionSelectorVisible(false)}
      />

      {/* Cancelled Toast */}
      {state.phase === 'cancelled' && (
        <View style={styles.cancelledToast}>
          <Text style={[Typography.bodyBold, { color: ClientColors.white }]}>
            {state.reason === 'no_drivers'
              ? 'Нет свободных водителей'
              : 'Заказ отменён'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: ClientColors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulsingDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: ClientColors.primary,
  },
  carEmoji: {
    fontSize: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalContent: {
    backgroundColor: ClientColors.white,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: '100%',
  },
  cancelledToast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: ClientColors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
