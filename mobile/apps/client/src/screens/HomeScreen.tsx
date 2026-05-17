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
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useLocation, ActionButton, ClientColors, Typography, reverseGeocode } from '@taxi/shared';
import { useOrder } from '../hooks/useOrder';
import DriverCard from '../components/DriverCard';
import RegionSelector from '../components/RegionSelector';
import { getCurrentPrice } from '../api/regions';

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
      style={[styles.pulsingDot, { transform: [{ scale }], opacity }]}
    />
  );
}

export default function HomeScreen(): React.ReactNode {
  const location = useLocation();
  const { state, callTaxi, callRegionalTaxi, cancelOrder, dismissCompleted, loading, error } = useOrder();
  const mapRef = useRef<MapView>(null);
  const [regionSelectorVisible, setRegionSelectorVisible] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(80);
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getCurrentPrice()
      .then(setCurrentPrice)
      .catch(() => setCurrentPrice(80));
  }, []);

  // Slide the bottom card up on first mount for a more "alive" feel.
  useEffect(() => {
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [cardAnim]);

  const initialRegion: Region = {
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  const handleCallTaxi = async (): Promise<void> => {
    const address = await reverseGeocode(location.latitude, location.longitude);
    await callTaxi(location.latitude, location.longitude, address);
  };

  const handleRegionSelect = async (regionId: number): Promise<void> => {
    setRegionSelectorVisible(false);
    const address = await reverseGeocode(location.latitude, location.longitude);
    await callRegionalTaxi(location.latitude, location.longitude, regionId, address);
  };

  const driverCoords =
    state.phase !== 'idle' &&
    state.phase !== 'cancelled' &&
    state.order?.driver &&
    typeof state.order.driver.latitude === 'number' &&
    typeof state.order.driver.longitude === 'number' &&
    Number.isFinite(state.order.driver.latitude) &&
    Number.isFinite(state.order.driver.longitude)
      ? { latitude: state.order.driver.latitude, longitude: state.order.driver.longitude }
      : null;

  const cardTranslate = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 0],
  });

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
        mapPadding={{
          top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 40) + 8 : 0,
          right: 0,
          bottom: 0,
          left: 0,
        }}
      >
        {driverCoords && (
          <Marker coordinate={driverCoords} title="Водитель">
            <View style={styles.carBadge}>
              <Text style={styles.carEmoji}>🚗</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Floating cancelled banner — slides from the top, replaces the
          previous raw red toast. */}
      {state.phase === 'cancelled' && (
        <View style={styles.cancelledToast}>
          <Text style={styles.cancelledToastEmoji}>🚫</Text>
          <Text style={[Typography.bodyBold, styles.cancelledToastText]}>
            {state.reason === 'no_drivers'
              ? 'Свободных водителей сейчас нет'
              : 'Заказ отменён'}
          </Text>
        </View>
      )}

      {/* Bottom card */}
      <Animated.View
        style={[styles.bottomCard, { transform: [{ translateY: cardTranslate }] }]}
      >
        {/* Pull tab */}
        <View style={styles.handle} />

        {error && (
          <View style={styles.errorPill}>
            <Text style={styles.errorEmoji}>⚠️</Text>
            <Text style={[Typography.caption, styles.errorText]}>{error}</Text>
          </View>
        )}

        {state.phase === 'idle' && (
          <>
            <Text style={styles.greeting}>Куда поедем?</Text>
            <View style={styles.priceRow}>
              <View style={styles.priceChip}>
                <Text style={styles.priceChipLabel}>в селе</Text>
                <Text style={styles.priceChipValue}>{currentPrice} сом</Text>
              </View>
              <TouchableOpacity
                style={styles.regionChip}
                onPress={() => setRegionSelectorVisible(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.regionChipEmoji}>🌍</Text>
                <Text style={styles.regionChipText}>Межгород</Text>
              </TouchableOpacity>
            </View>

            {/* Hero call button — large, primary teal, pill-shaped */}
            <TouchableOpacity
              style={[
                styles.heroButton,
                (location.loading || loading) && styles.heroButtonDisabled,
              ]}
              onPress={handleCallTaxi}
              disabled={location.loading || loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color={ClientColors.white} />
              ) : (
                <>
                  <Text style={styles.heroButtonEmoji}>🚕</Text>
                  <Text style={styles.heroButtonText}>Вызвать такси</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.helperText}>
              Подача — ваше текущее местоположение
            </Text>
          </>
        )}

        {state.phase === 'searching' && (
          <>
            <View style={styles.searchingRow}>
              <PulsingDot />
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={styles.searchingTitle}>Ищем водителя</Text>
                <Text style={styles.searchingSubtitle}>
                  Обычно занимает 1-2 минуты
                </Text>
              </View>
            </View>
            <ActionButton
              title="Отменить"
              onPress={cancelOrder}
              loading={loading}
              variant="outline"
              style={{ marginTop: 18 }}
            />
          </>
        )}

        {(state.phase === 'accepted' || state.phase === 'arrived' || state.phase === 'in_progress') &&
          state.order.driver && (
            <>
              <DriverCard driver={state.order.driver} status={state.phase} />
              {(state.phase === 'accepted' || state.phase === 'arrived') && (
                <ActionButton
                  title="Отменить"
                  onPress={cancelOrder}
                  loading={loading}
                  variant="outline"
                  style={{ marginTop: 8 }}
                />
              )}
            </>
          )}

        {(state.phase === 'accepted' || state.phase === 'arrived' || state.phase === 'in_progress') &&
          !state.order.driver && (
            <ActivityIndicator color={ClientColors.primary} />
          )}
      </Animated.View>

      {/* Completed Modal — slightly festive */}
      <Modal visible={state.phase === 'completed'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.completedEmoji}>🎉</Text>
            <Text style={styles.completedTitle}>Поездка завершена!</Text>
            {state.phase === 'completed' && (
              <View style={styles.completedPriceBlock}>
                <Text style={styles.completedPriceLabel}>К оплате водителю</Text>
                <Text style={styles.completedPriceValue}>
                  {state.order.price} <Text style={styles.completedPriceCurrency}>сом</Text>
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.modalButton}
              onPress={dismissCompleted}
              activeOpacity={0.9}
            >
              <Text style={styles.modalButtonText}>Спасибо!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <RegionSelector
        visible={regionSelectorVisible}
        onSelect={handleRegionSelect}
        onClose={() => setRegionSelectorVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  carBadge: {
    backgroundColor: ClientColors.white,
    borderRadius: 18,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  carEmoji: {
    fontSize: 28,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: ClientColors.cardBackground,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: ClientColors.border,
    alignSelf: 'center',
    marginBottom: 18,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  priceChip: {
    flex: 1,
    backgroundColor: ClientColors.primaryTint,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  priceChipLabel: {
    fontSize: 12,
    color: ClientColors.primaryDark,
    fontWeight: '500' as const,
  },
  priceChipValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: ClientColors.primaryDark,
    marginTop: 2,
  },
  regionChip: {
    flex: 1,
    backgroundColor: ClientColors.secondaryTint,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  regionChipEmoji: {
    fontSize: 22,
  },
  regionChipText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: ClientColors.secondaryDark,
  },
  heroButton: {
    backgroundColor: ClientColors.primary,
    borderRadius: 28,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: ClientColors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  heroButtonDisabled: {
    opacity: 0.6,
  },
  heroButtonEmoji: {
    fontSize: 22,
  },
  heroButtonText: {
    color: ClientColors.white,
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  helperText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 12,
    color: ClientColors.textMuted,
  },
  errorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F1',
    borderColor: '#FFD4D4',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  errorEmoji: {
    fontSize: 16,
  },
  errorText: {
    color: ClientColors.danger,
    flex: 1,
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  searchingTitle: {
    fontSize: 19,
    fontWeight: '700' as const,
    color: ClientColors.dark,
  },
  searchingSubtitle: {
    fontSize: 13,
    color: ClientColors.textSecondary,
    marginTop: 2,
  },
  pulsingDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: ClientColors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 46, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  modalContent: {
    backgroundColor: ClientColors.white,
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
    width: '100%',
    alignItems: 'center',
  },
  completedEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  completedTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    textAlign: 'center',
    marginBottom: 18,
  },
  completedPriceBlock: {
    alignItems: 'center',
    marginBottom: 26,
  },
  completedPriceLabel: {
    fontSize: 13,
    color: ClientColors.textSecondary,
    marginBottom: 4,
  },
  completedPriceValue: {
    fontSize: 38,
    fontWeight: '800' as const,
    color: ClientColors.primaryDark,
  },
  completedPriceCurrency: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  modalButton: {
    backgroundColor: ClientColors.primary,
    borderRadius: 24,
    paddingHorizontal: 40,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalButtonText: {
    color: ClientColors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  cancelledToast: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 40) + 12 : 56,
    left: 16,
    right: 16,
    backgroundColor: ClientColors.dark,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cancelledToastEmoji: {
    fontSize: 22,
  },
  cancelledToastText: {
    color: ClientColors.white,
    flex: 1,
  },
});
