import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Dimensions,
  PanResponder,
} from 'react-native';
import MapView, { Region as MapRegion } from 'react-native-maps';
import { useLocation, ActionButton, ClientColors, Typography, reverseGeocode, Region } from '@taxi/shared';
import { useOrder } from '../hooks/useOrder';
import DriverCard from '../components/DriverCard';
import AnimatedDriverMarker from '../components/AnimatedDriverMarker';
import Icon from '../components/Icon';
import IntervillageModal from '../components/IntervillageModal';
import { getRegions, getTariffs, priceFor, type TariffRoute } from '../api/regions';

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
  const { state, callTaxi, cancelOrder, dismissCompleted, loading, error } = useOrder();
  const mapRef = useRef<MapView>(null);

  const [regions, setRegions] = useState<Region[]>([]);
  const [tariffs, setTariffs] = useState<TariffRoute[]>([]);
  const [roundTripPct, setRoundTripPct] = useState<number>(70);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [intervillageOpen, setIntervillageOpen] = useState(false);
  // Район определённый сервером по GPS (geofence ~5 км). null пока
  // ещё не запрашивали или GPS не готов.
  const [detectedVillage, setDetectedVillage] = useState<{ id: number; name: string } | null>(null);
  // null = ещё не определились (показываем лоадер). true = в зоне,
  // показываем нормальный заказ. false = вне зоны, показываем
  // экран «Сервис недоступен».
  const [inServiceArea, setInServiceArea] = useState<boolean | null>(null);

  // Bottom-sheet с двумя снап-позициями.
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const PEEK_HEIGHT = 130;
  const EXPANDED_HEIGHT = Math.min(SCREEN_HEIGHT * 0.62, 560);
  const COLLAPSE_OFFSET = EXPANDED_HEIGHT - PEEK_HEIGHT;
  const translateY = useRef(new Animated.Value(COLLAPSE_OFFSET)).current;
  const lastSnapRef = useRef<'peek' | 'expanded'>('peek');

  const snapTo = useCallback(
    (target: 'peek' | 'expanded') => {
      lastSnapRef.current = target;
      Animated.spring(translateY, {
        toValue: target === 'peek' ? COLLAPSE_OFFSET : 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 200,
        mass: 0.9,
      }).start();
    },
    [translateY, COLLAPSE_OFFSET],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          translateY.stopAnimation((current) => {
            translateY.setOffset(current);
            translateY.setValue(0);
          });
        },
        onPanResponderMove: (_, g) => {
          const offset = (translateY as Animated.Value & { _offset?: number })._offset ?? 0;
          const target = Math.max(-offset, Math.min(COLLAPSE_OFFSET - offset, g.dy));
          translateY.setValue(target);
        },
        onPanResponderRelease: (_, g) => {
          translateY.flattenOffset();
          const current = (translateY as Animated.Value & { _value: number })._value;
          let target: 'peek' | 'expanded';
          if (Math.abs(g.vy) > 0.5) {
            target = g.vy > 0 ? 'peek' : 'expanded';
          } else {
            target = current > COLLAPSE_OFFSET / 2 ? 'peek' : 'expanded';
          }
          snapTo(target);
        },
        onPanResponderTerminate: () => {
          translateY.flattenOffset();
          snapTo(lastSnapRef.current);
        },
      }),
    [translateY, COLLAPSE_OFFSET, snapTo],
  );

  // Загружаем регионы + тарифы с GPS на каждом фокусе. Сервер
  // определяет район клиента (geofence) — клиент решает что показать:
  // нормальный экран заказа или «Сервис недоступен».
  useFocusEffect(
    useCallback(() => {
      const lat = location.hasRealFix ? location.latitude : undefined;
      const lng = location.hasRealFix ? location.longitude : undefined;
      Promise.all([getRegions(), getTariffs(lat, lng)])
        .then(([rs, t]) => {
          setRegions(rs);
          setTariffs(t.routes);
          setRoundTripPct(t.roundTripSurchargePercent);
          setDetectedVillage(t.detectedVillage);
          // Если GPS не передан — оставляем null (лоадер); сервер
          // ничего не сказал про зону, без координат не определить.
          setInServiceArea(t.inServiceArea);
        })
        .catch(() => undefined);
    }, [location.hasRealFix, location.latitude, location.longitude]),
  );

  useEffect(() => {
    snapTo('expanded');
  }, [snapTo]);

  useEffect(() => {
    if (state.phase !== 'idle') {
      snapTo('expanded');
    }
  }, [state.phase, snapTo]);

  const initialRegion: MapRegion = {
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  const confirmRoundTripIfNeeded = (): Promise<boolean> => {
    if (!isRoundTrip) return Promise.resolve(true);
    return new Promise((resolve) => {
      Alert.alert(
        'Туда и обратно',
        'Водитель довозит вас до места, ждёт и привозит обратно.\n\n' +
          'Постарайтесь уложиться в 15-20 минут на месте — водитель не может ждать 2-3 часа.\n\n' +
          'Если задержитесь дольше — водитель уедет на другие заказы.',
        [
          { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Понятно, заказать', style: 'default', onPress: () => resolve(true) },
        ],
        { cancelable: false },
      );
    });
  };

  const handleInVillageCallTaxi = async (): Promise<void> => {
    if (detectedVillage === null) return;
    if (!(await confirmRoundTripIfNeeded())) return;
    const address = await reverseGeocode(location.latitude, location.longitude);
    await callTaxi(
      location.latitude,
      location.longitude,
      detectedVillage.id, // to == from = заказ внутри села
      address,
      undefined,
      isRoundTrip,
    );
  };

  const handleIntervillageOrder = async (
    _fromId: number,
    toId: number,
    rt: boolean,
  ): Promise<boolean> => {
    // from_region_id игнорируется — сервер определяет по GPS.
    const address = await reverseGeocode(location.latitude, location.longitude);
    const before = error;
    await callTaxi(location.latitude, location.longitude, toId, address, undefined, rt);
    return error === before;
  };

  const inVillagePrice = detectedVillage
    ? priceFor(tariffs, detectedVillage.id, detectedVillage.id)
    : 0;
  const displayedPrice = isRoundTrip
    ? Math.round(inVillagePrice * (1 + roundTripPct / 100))
    : inVillagePrice;
  const inVillageTariffMissing =
    inServiceArea === true && detectedVillage !== null && inVillagePrice <= 0;

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

      <Animated.View
        style={[
          styles.bottomCard,
          { height: EXPANDED_HEIGHT, transform: [{ translateY }] },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.handleZone}>
          <View style={styles.handle} />
        </View>

        {error && (
          <View style={styles.errorPill}>
            <Icon name="alert" size={18} color={ClientColors.danger} strokeWidth={2.2} />
            <Text style={[Typography.caption, styles.errorText]}>{error}</Text>
          </View>
        )}

        {state.phase === 'idle' && (
          <>
            {/* Лоадер: ждём либо GPS, либо ответа /tariffs */}
            {(!location.hasRealFix || inServiceArea === null || regions.length === 0) && (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={ClientColors.primary} />
                <Text style={styles.loadingText}>
                  {!location.hasRealFix
                    ? (location.error ?? 'Определяем ваше местоположение…')
                    : 'Загружаем тарифы…'}
                </Text>
              </View>
            )}

            {/* Вне зоны обслуживания: запрещаем заказ, показываем
                понятное объяснение. */}
            {location.hasRealFix && inServiceArea === false && (
              <View style={styles.serviceUnavailable}>
                <View style={styles.serviceUnavailableIcon}>
                  <Icon name="pin" size={28} color={ClientColors.secondaryDark} strokeWidth={2.2} />
                </View>
                <Text style={styles.serviceUnavailableTitle}>
                  Сервис пока недоступен в вашем районе
                </Text>
                <Text style={styles.serviceUnavailableBody}>
                  Мы работаем в Таласе, Кировке и Покровке.
                  Если вы в одном из этих сёл — проверьте GPS.
                </Text>
              </View>
            )}

            {/* В зоне: основной экран заказа */}
            {location.hasRealFix && inServiceArea === true && detectedVillage && (
              <>
                <View style={styles.villageBadge}>
                  <Icon name="pin" size={14} color={ClientColors.primaryDark} strokeWidth={2.4} />
                  <Text style={styles.villageBadgeLabel}>Вы в:</Text>
                  <Text style={styles.villageBadgeValue}>{detectedVillage.name}</Text>
                </View>

                <Text style={styles.greeting}>Куда поедем?</Text>

                <View style={styles.priceCard}>
                  <Text style={styles.priceCardLabel}>Внутри села</Text>
                  {inVillageTariffMissing ? (
                    <Text style={styles.priceCardMissing}>Тариф не настроен</Text>
                  ) : (
                    <Text style={styles.priceCardValue}>{displayedPrice} сом</Text>
                  )}
                </View>

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

                <TouchableOpacity
                  style={[
                    styles.heroButton,
                    (loading || inVillageTariffMissing) && styles.heroButtonDisabled,
                  ]}
                  onPress={handleInVillageCallTaxi}
                  disabled={loading || inVillageTariffMissing}
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

                <TouchableOpacity
                  style={styles.intervillageButton}
                  onPress={() => setIntervillageOpen(true)}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  <Icon name="route" size={20} color={ClientColors.secondaryDark} strokeWidth={2.2} />
                  <Text style={styles.intervillageButtonText}>Межсёлами</Text>
                  <Icon
                    name="arrow-right"
                    size={18}
                    color={ClientColors.secondaryDark}
                    strokeWidth={2.2}
                  />
                </TouchableOpacity>
              </>
            )}
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

      <IntervillageModal
        visible={intervillageOpen}
        onClose={() => setIntervillageOpen(false)}
        regions={regions}
        tariffs={tariffs}
        roundTripPct={roundTripPct}
        defaultFromId={detectedVillage?.id ?? null}
        loading={loading}
        onOrder={handleIntervillageOrder}
      />

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
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  handleZone: {
    paddingTop: 10,
    paddingBottom: 8,
    marginHorizontal: -24,
    alignItems: 'center',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: ClientColors.border,
  },
  loadingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 36,
  },
  loadingText: {
    fontSize: 14,
    color: ClientColors.textSecondary,
  },
  serviceUnavailable: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 4,
  },
  serviceUnavailableIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ClientColors.secondaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  serviceUnavailableTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: ClientColors.dark,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  serviceUnavailableBody: {
    fontSize: 14,
    color: ClientColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  villageBadge: {
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
  villageBadgeLabel: {
    fontSize: 12,
    color: ClientColors.primaryDark,
    fontWeight: '500' as const,
  },
  villageBadgeValue: {
    fontSize: 13,
    color: ClientColors.primaryDark,
    fontWeight: '700' as const,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  priceCard: {
    backgroundColor: ClientColors.primaryTint,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 14,
  },
  priceCardLabel: {
    fontSize: 13,
    color: ClientColors.primaryDark,
    fontWeight: '600' as const,
  },
  priceCardValue: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: ClientColors.primaryDark,
    marginTop: 4,
    letterSpacing: -0.4,
  },
  priceCardMissing: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: ClientColors.danger,
    marginTop: 6,
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
    opacity: 0.5,
  },
  heroButtonText: {
    color: ClientColors.white,
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  intervillageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
    height: 50,
    borderRadius: 24,
    backgroundColor: ClientColors.secondaryTint,
  },
  intervillageButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: ClientColors.secondaryDark,
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
