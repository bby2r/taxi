import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
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
import MapView, { Region } from 'react-native-maps';
import { useLocation, ActionButton, ClientColors, Typography, reverseGeocode } from '@taxi/shared';
import { useOrder } from '../hooks/useOrder';
import DriverCard from '../components/DriverCard';
import RegionSelector from '../components/RegionSelector';
import AnimatedDriverMarker from '../components/AnimatedDriverMarker';
import Icon from '../components/Icon';
import { getTariff } from '../api/regions';

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
  // Surcharge fetched alongside base price so the toggle preview is
  // instant — no API call per checkbox tap. Default 70 % matches the
  // server-side default seeded into Settings.
  const [roundTripPct, setRoundTripPct] = useState<number>(70);
  // District detected server-side from current GPS (Гео-A+). null when
  // GPS isn't ready or no region has centre coords configured —
  // hiding the badge in that case is intentional; falling back to
  // "Талас" would mislead a client physically in another village.
  const [district, setDistrict] = useState<{ id: number; name: string } | null>(null);
  // Геозабор: false ⇒ клиент вне радиуса 2 км от любого района.
  // Скрываем кнопку «Заказ внутри села» полностью — без неё сервер
  // всё равно отклонит создание, а спрятанная кнопка честнее, чем
  // дать тапнуть и показать ошибку.
  const [inVillageAvailable, setInVillageAvailable] = useState(true);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const cardAnim = useRef(new Animated.Value(0)).current;

  // Re-fetch the in-village price every time the home tab regains
  // focus (and on first mount). Previously this was a one-shot
  // useEffect — operator would change the price in /admin/settings,
  // but every client app with HomeScreen already mounted kept the
  // stale value forever. Now the fresh value lands when the user
  // switches back from another tab, returns from background, or
  // simply taps the tab bar.
  useFocusEffect(
    useCallback(() => {
      // Pass GPS only when we have a real fix — without it the server
      // can't resolve a district and we'd burn a request on the global
      // fallback that returns the same answer.
      const lat = location.hasRealFix ? location.latitude : undefined;
      const lng = location.hasRealFix ? location.longitude : undefined;
      getTariff(lat, lng)
        .then((t) => {
          setCurrentPrice(t.price);
          setRoundTripPct(t.roundTripSurchargePercent);
          setDistrict(t.district);
          setInVillageAvailable(t.inVillageAvailable);
        })
        .catch(() => undefined);
    }, [location.hasRealFix, location.latitude, location.longitude]),
  );

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

  // Wraps the actual order call in a "wait time" confirmation when
  // round-trip is on. Drivers won't sit at the destination for 2-3
  // hours — the surcharge prices in ~15-20 min, not a half-day. We
  // surface this expectation BEFORE the order goes out so neither
  // side ends up surprised. Returns a promise that resolves to true
  // if the user wants to proceed.
  const confirmRoundTripIfNeeded = (): Promise<boolean> => {
    if (!isRoundTrip) return Promise.resolve(true);
    return new Promise((resolve) => {
      Alert.alert(
        'Туда и обратно',
        'Водитель довозит вас до места, ждёт и привозит обратно.\n\n' +
          'Постарайтесь уложиться в 15-20 минут на месте — водитель не может ждать 2-3 часа.\n\n' +
          'Если задержитесь дольше — водитель уедет на другие заказы, и вам придётся заказывать новое такси обратно.',
        [
          { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Понятно, заказать', style: 'default', onPress: () => resolve(true) },
        ],
        { cancelable: false },
      );
    });
  };

  const handleCallTaxi = async (): Promise<void> => {
    if (!(await confirmRoundTripIfNeeded())) return;
    const address = await reverseGeocode(location.latitude, location.longitude);
    await callTaxi(location.latitude, location.longitude, address, undefined, isRoundTrip);
  };

  const handleRegionSelect = async (regionId: number): Promise<void> => {
    setRegionSelectorVisible(false);
    if (!(await confirmRoundTripIfNeeded())) return;
    const address = await reverseGeocode(location.latitude, location.longitude);
    await callRegionalTaxi(
      location.latitude,
      location.longitude,
      regionId,
      address,
      undefined,
      isRoundTrip,
    );
  };

  // Live preview price including the round-trip surcharge when toggled.
  // Math runs locally so the chip updates the moment the user taps the
  // checkbox; final price the server records uses the same formula so
  // there's no mismatch between displayed and charged amounts.
  const displayedPrice = isRoundTrip
    ? Math.round(currentPrice * (1 + roundTripPct / 100))
    : currentPrice;

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
          <AnimatedDriverMarker coordinate={driverCoords} title="Водитель" />
        )}
      </MapView>

      {/* Floating cancelled banner — slides from the top, replaces the
          previous raw red toast. */}
      {state.phase === 'cancelled' && (
        <View style={styles.cancelledToast}>
          <Icon name="ban" size={20} color={ClientColors.white} strokeWidth={2.2} />
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
            <Icon name="alert" size={18} color={ClientColors.danger} strokeWidth={2.2} />
            <Text style={[Typography.caption, styles.errorText]}>{error}</Text>
          </View>
        )}

        {state.phase === 'idle' && (
          <>
            {district && (
              <View style={styles.districtBadge}>
                <Icon name="pin" size={14} color={ClientColors.primaryDark} strokeWidth={2.2} />
                <Text style={styles.districtBadgeLabel}>Вы сейчас в:</Text>
                <Text style={styles.districtBadgeValue}>{district.name}</Text>
              </View>
            )}
            <Text style={styles.greeting}>Куда поедем?</Text>
            {!inVillageAvailable && (
              <View style={styles.outOfZoneNotice}>
                <Icon name="alert" size={18} color={ClientColors.secondaryDark} strokeWidth={2.2} />
                <Text style={styles.outOfZoneText}>
                  Вы вне зон обслуживания внутри села. Выберите направление через «Межсёлами».
                </Text>
              </View>
            )}
            <View style={styles.priceRow}>
              {inVillageAvailable && (
                <View style={styles.priceChip}>
                  <Text style={styles.priceChipLabel}>в селе</Text>
                  <Text style={styles.priceChipValue}>{displayedPrice} сом</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.regionChip}
                onPress={() => setRegionSelectorVisible(true)}
                activeOpacity={0.85}
              >
                <Icon name="route" size={20} color={ClientColors.secondaryDark} strokeWidth={2.2} />
                <Text style={styles.regionChipText}>Межсёлами</Text>
              </TouchableOpacity>
            </View>

            {/* Round-trip toggle. Tapping flips isRoundTrip → displayedPrice
                re-renders with the surcharge applied immediately. State
                travels into both callTaxi / callRegionalTaxi so the order
                lands on the server with the matching is_round_trip flag
                and final price. */}
            <TouchableOpacity
              style={[styles.roundTripRow, isRoundTrip && styles.roundTripRowActive]}
              onPress={() => setIsRoundTrip((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, isRoundTrip && styles.checkboxActive]}>
                {isRoundTrip && (
                  <Icon name="check" size={16} color={ClientColors.white} strokeWidth={3} />
                )}
              </View>
              <Text style={styles.roundTripLabel}>Туда и обратно</Text>
              {isRoundTrip && (
                <View style={styles.roundTripBadge}>
                  <Text style={styles.roundTripBadgeText}>+{roundTripPct}%</Text>
                </View>
              )}
            </TouchableOpacity>
            {isRoundTrip && (
              <Text style={styles.roundTripHint}>
                Водитель ждёт на месте 15-20 минут и везёт обратно
              </Text>
            )}

            {/* Hero call button — large, primary teal, pill-shaped.
                Скрыт когда клиент вне геозабора: сервер отклонит создание,
                межсёлами остаётся единственным вариантом. */}
            {inVillageAvailable && (
              <TouchableOpacity
                style={[
                  styles.heroButton,
                  (location.loading || loading || !location.hasRealFix) && styles.heroButtonDisabled,
                ]}
                onPress={handleCallTaxi}
                disabled={location.loading || loading || !location.hasRealFix}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={ClientColors.white} />
                ) : (
                  <>
                    <Icon name="car" size={22} color={ClientColors.white} strokeWidth={2} />
                    <Text style={styles.heroButtonText}>Заказ внутри села</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <View style={styles.helperRow}>
              <Icon
                name={location.hasRealFix ? 'pin' : 'alert'}
                size={13}
                color={location.hasRealFix ? ClientColors.textMuted : ClientColors.danger}
                strokeWidth={2}
              />
              <Text
                style={[
                  styles.helperText,
                  !location.hasRealFix && { color: ClientColors.danger },
                ]}
              >
                {location.hasRealFix
                  ? 'Подача — ваше текущее местоположение'
                  : location.error ?? 'Определяем ваше местоположение…'}
              </Text>
            </View>
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

      {/* Completed Modal — refined card with checkmark badge */}
      <Modal visible={state.phase === 'completed'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.completedBadge}>
              <Icon name="check" size={40} color={ClientColors.white} strokeWidth={2.5} />
            </View>
            <Text style={styles.completedTitle}>Поездка завершена</Text>
            <Text style={styles.completedSubtitle}>Спасибо, что выбрали AIYL Taxi</Text>
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
              <Text style={styles.modalButtonText}>Готово</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <RegionSelector
        visible={regionSelectorVisible}
        onSelect={handleRegionSelect}
        onClose={() => setRegionSelectorVisible(false)}
        latitude={location.hasRealFix ? location.latitude : undefined}
        longitude={location.hasRealFix ? location.longitude : undefined}
      />
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
  districtBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: ClientColors.primaryTint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  districtBadgeLabel: {
    fontSize: 12,
    color: ClientColors.primaryDark,
    fontWeight: '500' as const,
  },
  districtBadgeValue: {
    fontSize: 13,
    color: ClientColors.primaryDark,
    fontWeight: '700' as const,
  },
  outOfZoneNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: ClientColors.secondaryTint,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  outOfZoneText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: ClientColors.secondaryDark,
    fontWeight: '500' as const,
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
    gap: 10,
  },
  regionChipText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: ClientColors.secondaryDark,
  },
  roundTripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ClientColors.border,
    marginBottom: 14,
  },
  roundTripRowActive: {
    borderColor: ClientColors.primary,
    backgroundColor: ClientColors.primaryTint,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: ClientColors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxActive: {
    borderColor: ClientColors.primary,
    backgroundColor: ClientColors.primary,
  },
  roundTripLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: ClientColors.dark,
  },
  roundTripBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: ClientColors.primary,
  },
  roundTripBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: ClientColors.white,
  },
  roundTripHint: {
    fontSize: 12,
    color: ClientColors.primaryDark,
    marginTop: -6,
    marginBottom: 14,
    paddingHorizontal: 4,
    lineHeight: 16,
  },
  heroButton: {
    backgroundColor: ClientColors.primary,
    borderRadius: 28,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: ClientColors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  heroButtonDisabled: {
    opacity: 0.6,
  },
  heroButtonText: {
    color: ClientColors.white,
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  helperText: {
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
    gap: 10,
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
    borderRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 28,
    width: '100%',
    alignItems: 'center',
  },
  completedBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: ClientColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    shadowColor: ClientColors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: ClientColors.dark,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  completedSubtitle: {
    fontSize: 14,
    color: ClientColors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 22,
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
  cancelledToastText: {
    color: ClientColors.white,
    flex: 1,
  },
});
