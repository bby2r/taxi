import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  PanResponder,
} from 'react-native';
import MapLibreMapView, { type MapLibreMapHandle } from '../components/MapLibreMapView';

// Снап-константы шторки. Вынесены за компонент — иначе пересчёт на
// каждый рендер делает их новые reference identity, useCallback вокруг
// snapTo каждый раз новый, и useEffect авто-разворота фигачит animation
// на каждый ререндер → видимый дёрг при свайпе.
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PEEK_HEIGHT = 90;
// Премиум-композиция: компактная нижняя карточка, карта занимает
// ~70% экрана — как Yandex Go / GreenNow.
const HEIGHT_IDLE = 340;
const HEIGHT_SEARCHING = 260;
const HEIGHT_ACTIVE = 340;

import { useLocation, ActionButton, ClientColors, ErrorPill, FadeInView, Haptics, Radius, Skeleton, Spacing, Typography, reverseGeocode, Region } from '@taxi/shared';
import { Shadow } from '../theme/tokens';
import { useOrder } from '../hooks/useOrder';
import DriverCard from '../components/DriverCard';
import Icon from '../components/Icon';
import IntervillageModal from '../components/IntervillageModal';
import RatingModal from '../components/RatingModal';
import TariffCarIllustration from '../components/TariffCarIllustration';
import { getRegions, getTariffs, priceFor, type TariffRoute } from '../api/regions';

function PulsingDot({ size = 14 }: { size?: number }): React.ReactNode {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.6, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: ClientColors.primary,
        },
        { transform: [{ scale }], opacity },
      ]}
    />
  );
}

export default function HomeScreen(): React.ReactNode {
  const location = useLocation();
  const { state, callTaxi, cancelOrder, dismissCompleted, loading, error } = useOrder();
  const mapRef = useRef<MapLibreMapHandle>(null);

  const [regions, setRegions] = useState<Region[]>([]);
  const [tariffs, setTariffs] = useState<TariffRoute[]>([]);
  const [roundTripPct, setRoundTripPct] = useState<number>(70);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [intervillageOpen, setIntervillageOpen] = useState(false);
  const [detectedVillage, setDetectedVillage] = useState<{ id: number; name: string } | null>(null);
  const [inServiceArea, setInServiceArea] = useState<boolean | null>(null);

  // Pickup-метка может быть перетащена пользователем — отдельно от
  // его реального GPS. Пока pin не двигали — следует за GPS. После
  // драга — стоит на месте до сброса (кнопкой «К моему GPS»).
  const [pickupCoord, setPickupCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [pinDragged, setPinDragged] = useState(false);

  // GPS → pickup, если клиент ещё не двигал метку.
  useEffect(() => {
    if (!pinDragged && location.hasRealFix) {
      setPickupCoord({ lat: location.latitude, lng: location.longitude });
    }
  }, [pinDragged, location.hasRealFix, location.latitude, location.longitude]);

  // На первом реальном GPS-fix центрируем карту на пользователе.
  // initialRegion — статика, ставится один раз с дефолтным Бишкеком
  // (42.87/74.59). Без этого эффекта карта остаётся на Бишкеке,
  // а маркер пользователя оказывается за пределами видимой области.
  // Retry-цикл нужен потому что mapRef.current может быть null когда
  // эффект первый раз срабатывает (MapView ещё не отмонтировался) —
  // повторяем попытку до 10 раз с интервалом 200ms.
  const initialCenterDoneRef = useRef(false);
  useEffect(() => {
    if (!location.hasRealFix || initialCenterDoneRef.current) {
      return;
    }
    let attempts = 0;
    const tryCenter = (): void => {
      if (mapRef.current) {
        initialCenterDoneRef.current = true;
        mapRef.current.animateToRegion(
          { latitude: location.latitude, longitude: location.longitude },
          400,
          0.005,
        );
      } else if (attempts < 10) {
        attempts += 1;
        setTimeout(tryCenter, 200);
      }
    };
    tryCenter();
  }, [location.hasRealFix, location.latitude, location.longitude]);

  const resetPinToGps = useCallback(() => {
    if (location.hasRealFix) {
      setPickupCoord({ lat: location.latitude, lng: location.longitude });
      setPinDragged(false);
      // Street-level zoom (delta 0.004 ≈ ~400-500 м). mapPadding.bottom
      // уже учитывает шторку, поэтому центрирование автоматически
      // ставит точку в видимой части экрана выше peek-области.
      mapRef.current?.animateToRegion(
        { latitude: location.latitude, longitude: location.longitude },
        400,
        0.004,
      );
    }
  }, [location.hasRealFix, location.latitude, location.longitude]);

  // Высота шторки + offset для snap-к-peek — пересчитываются при
  // смене фазы. translateY анимируется через useEffect ниже.
  const expandedHeight = useMemo(() => {
    if (state.phase === 'searching') return HEIGHT_SEARCHING;
    if (state.phase === 'accepted' || state.phase === 'arrived' || state.phase === 'in_progress') {
      return HEIGHT_ACTIVE;
    }
    return HEIGHT_IDLE;
  }, [state.phase]);
  const collapseOffset = expandedHeight - PEEK_HEIGHT;

  const translateY = useRef(new Animated.Value(collapseOffset)).current;
  const lastSnapRef = useRef<'peek' | 'expanded'>('peek');

  const snapTo = useCallback(
    (target: 'peek' | 'expanded') => {
      lastSnapRef.current = target;
      Animated.spring(translateY, {
        toValue: target === 'peek' ? collapseOffset : 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 200,
        mass: 0.9,
      }).start();
    },
    [translateY, collapseOffset],
  );

  const togglePeek = useCallback(() => {
    snapTo(lastSnapRef.current === 'peek' ? 'expanded' : 'peek');
  }, [snapTo]);

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
          const target = Math.max(-offset, Math.min(collapseOffset - offset, g.dy));
          translateY.setValue(target);
        },
        onPanResponderRelease: (_, g) => {
          translateY.flattenOffset();
          const current = (translateY as Animated.Value & { _value: number })._value;
          let target: 'peek' | 'expanded';
          if (Math.abs(g.vy) > 0.5) {
            target = g.vy > 0 ? 'peek' : 'expanded';
          } else {
            target = current > collapseOffset / 2 ? 'peek' : 'expanded';
          }
          snapTo(target);
        },
        onPanResponderTerminate: () => {
          translateY.flattenOffset();
          snapTo(lastSnapRef.current);
        },
      }),
    [translateY, snapTo, collapseOffset],
  );

  // Регионы статичны в рамках сессии — фетчим один раз, а не на каждый
  // фокус/GPS-tick.
  useEffect(() => {
    getRegions().then(setRegions).catch(() => undefined);
  }, []);

  // Тарифы зависят от pickup-координат, но координаты обновляются на
  // каждый GPS-tick (~1Hz) когда юзер ещё не перетянул pin. Раньше это
  // бомбило сервер ~60 раз/мин, и каждый ответ триггерил setState →
  // полный ре-рендер HomeScreen + всех детей. Debounce 800ms + distance
  // 80м: запрос уходит только когда позиция реально сменилась.
  const lastTariffRequestRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  useEffect(() => {
    const lat = pickupCoord?.lat;
    const lng = pickupCoord?.lng;
    if (lat === undefined || lng === undefined) return;

    const last = lastTariffRequestRef.current;
    if (last) {
      const dLat = lat - last.lat;
      const dLng = lng - last.lng;
      const movedDeg = Math.sqrt(dLat * dLat + dLng * dLng);
      // ~0.0007° ≈ 80m на широте Бишкека/Таласа
      if (movedDeg < 0.0007 && Date.now() - last.ts < 30_000) return;
    }

    const t = setTimeout(() => {
      lastTariffRequestRef.current = { lat, lng, ts: Date.now() };
      getTariffs(lat, lng)
        .then((data) => {
          setTariffs(data.routes);
          setRoundTripPct(data.roundTripSurchargePercent);
          setDetectedVillage(data.detectedVillage);
          setInServiceArea(data.inServiceArea);
        })
        .catch(() => undefined);
    }, 800);

    return () => clearTimeout(t);
  }, [pickupCoord?.lat, pickupCoord?.lng]);

  useEffect(() => {
    snapTo('expanded');
  }, [snapTo]);

  useEffect(() => {
    if (state.phase !== 'idle') {
      snapTo('expanded');
    }
  }, [state.phase, snapTo]);

  // initialCenter — снимок один раз на маунте (заморожен внутри
  // MapLibreMapView через ref), затем animateToRegion двигает камеру
  // на реальный GPS, когда он зафиксируется.
  const initialCenter: [number, number] = [location.longitude, location.latitude];

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
    if (detectedVillage === null || pickupCoord === null) return;
    // Тап ощущается СРАЗУ — до сетевого round-trip. Без этого юзер
    // на 1-2 сек видит просто белую кнопку и не понимает «нажалось ли».
    Haptics.light();
    if (!(await confirmRoundTripIfNeeded())) return;
    const address = await reverseGeocode(pickupCoord.lat, pickupCoord.lng);
    await callTaxi(
      pickupCoord.lat,
      pickupCoord.lng,
      detectedVillage.id,
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
    if (pickupCoord === null) return false;
    Haptics.light();
    const address = await reverseGeocode(pickupCoord.lat, pickupCoord.lng);
    const before = error;
    await callTaxi(pickupCoord.lat, pickupCoord.lng, toId, address, undefined, rt);
    return error === before;
  };

  const handlePinDragEnd = useCallback(
    (coord: { latitude: number; longitude: number }): void => {
      setPickupCoord({ lat: coord.latitude, lng: coord.longitude });
      setPinDragged(true);
    },
    [],
  );

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
      ? {
          latitude: state.order.driver.latitude,
          longitude: state.order.driver.longitude,
          heading: state.order.driver.heading,
        }
      : null;

  // Содержимое peek-бара зависит от фазы заказа и состояния детекции.
  // Делаем компактным — в свёрнутом виде шторки видна только эта часть.
  const renderPeekContent = (): React.ReactNode => {
    if (state.phase === 'searching') {
      return (
        <View style={styles.peekRow}>
          <PulsingDot size={10} />
          <Text style={styles.peekTitle}>Ищем водителя…</Text>
          <Icon name="chevron-down" size={18} color={ClientColors.textMuted} strokeWidth={2.4} />
        </View>
      );
    }

    if (state.phase === 'accepted' || state.phase === 'arrived' || state.phase === 'in_progress') {
      const phaseLabel: Record<string, string> = {
        accepted: 'Водитель в пути',
        arrived: 'Водитель прибыл',
        in_progress: 'В пути',
      };
      return (
        <View style={styles.peekRow}>
          <Icon name="car" size={18} color={ClientColors.primary} strokeWidth={2.2} />
          <Text style={styles.peekTitle}>{phaseLabel[state.phase]}</Text>
          <Icon name="chevron-up" size={18} color={ClientColors.textMuted} strokeWidth={2.4} />
        </View>
      );
    }

    // idle phase
    if (!pickupCoord || regions.length === 0 || inServiceArea === null) {
      return (
        <View style={styles.peekRow}>
          <ActivityIndicator size="small" color={ClientColors.primary} />
          <Text style={styles.peekTitle}>Определяем местоположение…</Text>
        </View>
      );
    }

    if (inServiceArea === false) {
      return (
        <View style={styles.peekRow}>
          <Icon name="alert" size={18} color={ClientColors.secondaryDark} strokeWidth={2.4} />
          <Text style={[styles.peekTitle, { color: ClientColors.secondaryDark }]}>
            Вне зоны обслуживания
          </Text>
          <Icon name="chevron-up" size={18} color={ClientColors.textMuted} strokeWidth={2.4} />
        </View>
      );
    }

    if (inVillageTariffMissing) {
      return (
        <View style={styles.peekRow}>
          <Icon name="alert" size={18} color={ClientColors.danger} strokeWidth={2.4} />
          <Text style={[styles.peekTitle, { color: ClientColors.danger }]}>
            Тариф не настроен
          </Text>
        </View>
      );
    }

    // Главный happy path: «В Кировке · 80 сом · →»
    return (
      <View style={styles.peekRow}>
        <View style={styles.peekVillagePill}>
          <Icon name="pin" size={12} color={ClientColors.primaryDark} strokeWidth={2.4} />
          <Text style={styles.peekVillageText}>В {detectedVillage?.name}</Text>
        </View>
        <Text style={styles.peekPrice}>{displayedPrice} сом</Text>
        <Icon name="chevron-up" size={18} color={ClientColors.textMuted} strokeWidth={2.4} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Карта (MapLibre + MapTiler через WebView). Юзер видит:
          - синюю точку — где он реально (по GPS)
          - синюю стрелку-pickup — куда подать такси (draggable)
          - такси-маркер — водитель, плавно тваится между GPS-фиксами
          PaddingBottom резервируем под пик-шторку, чтобы animateToRegion
          центрировал точку в видимой части экрана. */}
      <MapLibreMapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialCenter={initialCenter}
        initialZoom={15}
        paddingTop={Platform.OS === 'android' ? (StatusBar.currentHeight ?? 40) + 8 : 0}
        paddingBottom={PEEK_HEIGHT}
        userLocation={
          location.hasRealFix
            ? { latitude: location.latitude, longitude: location.longitude }
            : null
        }
        pickup={
          pickupCoord
            ? { latitude: pickupCoord.lat, longitude: pickupCoord.lng }
            : null
        }
        pickupDraggable={state.phase === 'idle' && location.hasRealFix}
        onPickupDragEnd={handlePinDragEnd}
        driver={driverCoords}
      />

      {/* «Моя локация» FAB — приклеен к верхнему краю шторки. Тот
          же translateY двигает кнопку вместе со шторкой при свайпе,
          поэтому она всегда сидит чуть выше границы. Тап = центрирует
          карту на GPS + возвращает метку подачи на GPS. */}
      {location.hasRealFix && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.myLocationFab,
            { bottom: expandedHeight + 16, transform: [{ translateY }] },
          ]}
        >
          <TouchableOpacity
            style={styles.myLocationFabInner}
            onPress={resetPinToGps}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Показать моё местоположение"
          >
            <Icon name="pin" size={22} color={ClientColors.primary} strokeWidth={2.4} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {state.phase === 'cancelled' && (
        <FadeInView translateY={-12} duration={300} style={styles.cancelledToast}>
          <Icon name="ban" size={20} color={ClientColors.white} strokeWidth={2.2} />
          <Text style={[Typography.bodyBold, styles.cancelledToastText]}>
            {state.reason === 'no_drivers'
              ? 'Свободных водителей сейчас нет'
              : 'Заказ отменён'}
          </Text>
        </FadeInView>
      )}

      <Animated.View
        style={[
          styles.bottomCard,
          { height: expandedHeight, transform: [{ translateY }] },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Peek-header — всегда виден, тапается для разворота/свёртки */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={togglePeek}
          style={styles.peekHeader}
          accessibilityRole="button"
          accessibilityLabel="Развернуть или свернуть панель заказа"
        >
          <View style={styles.handle} />
          {renderPeekContent()}
        </TouchableOpacity>

        {error && (
          <ErrorPill
            message={error}
            leading={
              <Icon name="alert" size={18} color={ClientColors.danger} strokeWidth={2.2} />
            }
          />
        )}

        {state.phase === 'idle' && (
          <>
            {/* Skeleton-loader пока ждём GPS или ответа /tariffs.
                Структура сохраняется — юзер сразу видит «контент уже едет»,
                а не пустоту с спиннером. */}
            {(!pickupCoord || inServiceArea === null || regions.length === 0)
              && !location.error && (
              <>
                <View style={styles.tariffSkeleton}>
                  <Skeleton width={56} height={40} radius={10} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Skeleton width="60%" height={16} radius={6} />
                    <View style={{ height: 6 }} />
                    <Skeleton width="40%" height={12} radius={6} />
                  </View>
                  <Skeleton width={64} height={22} radius={6} />
                </View>
                <View style={[styles.inlineRow, { marginTop: 14 }]}>
                  <Skeleton width="48%" height={40} radius={999} />
                  <Skeleton width="48%" height={40} radius={999} />
                </View>
                <Skeleton width="100%" height={56} radius={28} style={{ marginTop: 14 }} />
              </>
            )}

            {/* Permission denied / GPS error — карточка с действием.
                Раньше показывался один спиннер навечно — юзер не понимал
                что делать. */}
            {location.error && !pickupCoord && (
              <View style={styles.permissionCard}>
                <View style={styles.permissionIcon}>
                  <Icon name="pin" size={26} color={ClientColors.primary} strokeWidth={2.2} />
                </View>
                <Text style={styles.permissionTitle}>Нужен доступ к геолокации</Text>
                <Text style={styles.permissionBody}>
                  Без GPS мы не сможем подать такси к вам. Откройте настройки и
                  разрешите доступ к местоположению для Alif Taxi.
                </Text>
                <TouchableOpacity
                  style={styles.permissionButton}
                  onPress={() => Linking.openSettings()}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.permissionButtonText}>Открыть настройки</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Вне зоны обслуживания — мягкая карточка с CTA */}
            {pickupCoord && inServiceArea === false && (
              <View style={styles.permissionCard}>
                <View style={[styles.permissionIcon, { backgroundColor: ClientColors.secondaryTint }]}>
                  <Icon name="pin" size={26} color={ClientColors.secondaryDark} strokeWidth={2.2} />
                </View>
                <Text style={styles.permissionTitle}>Вне зоны обслуживания</Text>
                <Text style={styles.permissionBody}>
                  Мы работаем в Таласе, Кировке и Покровке.
                  {pinDragged
                    ? ' Перетащите метку обратно или вернитесь к GPS.'
                    : ' Проверьте GPS — может быть, у нас расходятся данные.'}
                </Text>
                {pinDragged && (
                  <TouchableOpacity
                    style={styles.permissionButton}
                    onPress={resetPinToGps}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.permissionButtonText}>К моему GPS</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* В зоне — премиум-композиция Bolt / Yandex Go стиль */}
            {pickupCoord && inServiceArea === true && detectedVillage && (
              <>
                <View style={styles.tariffCard}>
                  <TariffCarIllustration size={56} style={styles.tariffCar} />
                  <View style={styles.tariffInfo}>
                    <Text style={styles.tariffName} numberOfLines={1}>
                      В {detectedVillage.name}
                    </Text>
                    <Text style={styles.tariffMeta} numberOfLines={1}>
                      {isRoundTrip ? `Туда и обратно · +${roundTripPct}%` : 'Эконом · до 4 мест'}
                    </Text>
                  </View>
                  <View style={styles.tariffPriceBlock}>
                    {inVillageTariffMissing ? (
                      <Text style={styles.tariffPriceMissing}>—</Text>
                    ) : (
                      <>
                        <Text style={styles.tariffPrice}>{displayedPrice}</Text>
                        <Text style={styles.tariffCurrency}>сом</Text>
                      </>
                    )}
                  </View>
                </View>

                <View style={styles.inlineRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.chip,
                      isRoundTrip && styles.chipActive,
                      pressed && styles.chipPressed,
                    ]}
                    onPress={() => {
                      Haptics.light();
                      setIsRoundTrip((v) => !v);
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isRoundTrip }}
                    accessibilityLabel={`Туда и обратно, наценка ${roundTripPct} процентов`}
                  >
                    <Icon
                      name="route"
                      size={14}
                      color={isRoundTrip ? ClientColors.white : ClientColors.primaryDark}
                      strokeWidth={2.4}
                    />
                    <Text style={[styles.chipText, isRoundTrip && styles.chipTextActive]}>
                      Туда-обратно
                    </Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                    onPress={() => setIntervillageOpen(true)}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Заказать такси между сёлами"
                  >
                    <Icon name="pin" size={14} color={ClientColors.primaryDark} strokeWidth={2.4} />
                    <Text style={styles.chipText}>Межсёлами</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.heroButton,
                    pressed && styles.heroButtonPressed,
                    (loading || inVillageTariffMissing) && styles.heroButtonDisabled,
                  ]}
                  onPress={handleInVillageCallTaxi}
                  disabled={loading || inVillageTariffMissing}
                  accessibilityRole="button"
                  accessibilityLabel={`Заказать такси, ${displayedPrice} сом`}
                  accessibilityState={{ disabled: loading || inVillageTariffMissing, busy: loading }}
                >
                  {loading ? (
                    <ActivityIndicator color={ClientColors.white} />
                  ) : (
                    <Text style={styles.heroButtonText}>Заказать такси</Text>
                  )}
                </Pressable>
              </>
            )}
          </>
        )}

        {state.phase === 'searching' && (
          <ActionButton
            title="Отменить"
            onPress={cancelOrder}
            loading={loading}
            variant="outline"
            style={{ marginTop: 18 }}
          />
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

      {state.phase === 'completed' && (
        <RatingModal
          visible
          orderId={state.order.id}
          price={state.order.price}
          driverName={state.order.driver?.name ?? 'водитель'}
          onDismiss={dismissCompleted}
        />
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
    backgroundColor: ClientColors.cardBackground,
    borderTopLeftRadius: Radius.xxxl,
    borderTopRightRadius: Radius.xxxl,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  peekHeader: {
    paddingTop: 10,
    paddingBottom: 14,
    marginHorizontal: -Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: ClientColors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  peekVillagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ClientColors.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.round,
  },
  peekVillageText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: ClientColors.primaryDark,
  },
  peekTitle: {
    ...Typography.bodyMedium,
    flex: 1,
    color: ClientColors.dark,
  },
  peekPrice: {
    flex: 1,
    textAlign: 'right',
    fontSize: 18,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    letterSpacing: -0.2,
  },
  // Skeleton tariff-row: те же пропорции что финальная карточка —
  // когда контент догрузится, разница в layout не дёрнет глаз.
  tariffSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ClientColors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ClientColors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 4,
    ...Shadow.surface,
  },
  // Permission / service-unavailable — единая premium-карточка с CTA.
  permissionCard: {
    alignItems: 'center',
    backgroundColor: ClientColors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ClientColors.border,
    paddingVertical: 24,
    paddingHorizontal: 22,
    marginTop: 4,
    ...Shadow.surface,
  },
  permissionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ClientColors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  permissionBody: {
    fontSize: 13,
    color: ClientColors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 22,
    height: 44,
    borderRadius: 22,
    backgroundColor: ClientColors.primary,
    ...Shadow.brandGlow,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: ClientColors.white,
    letterSpacing: 0.2,
  },
  // Tariff card Bolt-style: иллюстрация авто слева, название/мета посередине,
  // цена справа крупно. Active state имеет brand-glow.
  tariffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ClientColors.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ClientColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 4,
    ...Shadow.brandGlow,
  },
  tariffCar: {
    marginLeft: -4,
  },
  tariffInfo: {
    flex: 1,
    minWidth: 0,
  },
  tariffName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    letterSpacing: -0.2,
  },
  tariffMeta: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: ClientColors.textMuted,
    marginTop: 2,
  },
  tariffPriceBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  tariffPrice: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: ClientColors.primaryDark,
    letterSpacing: -0.6,
  },
  tariffCurrency: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: ClientColors.textMuted,
  },
  tariffPriceMissing: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: ClientColors.textMuted,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 14,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: ClientColors.surfaceMuted,
    borderWidth: 1,
    borderColor: ClientColors.border,
  },
  chipPressed: {
    transform: [{ scale: 0.97 }],
  },
  chipActive: {
    backgroundColor: ClientColors.primary,
    borderColor: ClientColors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: ClientColors.primaryDark,
    letterSpacing: 0.1,
  },
  chipTextActive: {
    color: ClientColors.white,
  },
  heroButton: {
    backgroundColor: ClientColors.primary,
    borderRadius: 28,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.brandGlow,
  },
  heroButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  heroButtonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
  },
  heroButtonText: {
    color: ClientColors.white,
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  // «Моя локация» FAB — приклеен к верхней грани шторки
  myLocationFab: {
    position: 'absolute',
    right: Spacing.lg,
    alignItems: 'flex-end',
  },
  myLocationFabInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ClientColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  cancelledToast: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 40) + 12 : 56,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: ClientColors.dark,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
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
