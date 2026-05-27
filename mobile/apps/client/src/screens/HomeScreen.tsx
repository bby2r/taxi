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
import MapView, { Region as MapRegion, Marker, MarkerDragStartEndEvent } from 'react-native-maps';

// Снап-константы шторки. Вынесены за компонент — иначе пересчёт на
// каждый рендер делает их новые reference identity, useCallback вокруг
// snapTo каждый раз новый, и useEffect авто-разворота фигачит animation
// на каждый ререндер → видимый дёрг при свайпе.
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PEEK_HEIGHT = 90;
// EXPANDED_HEIGHT под реальный контент idle-фазы + небольшой запас:
// peek header (63) + greeting (38) + priceCard (78) + roundTrip (54) +
// hero button (60) + межсёлами (62) + paddingBottom (24) ≈ 380px +
// ~45px воздуха снизу чтобы кнопки не упирались в край шторки.
const EXPANDED_HEIGHT = Math.min(SCREEN_HEIGHT * 0.52, 425);
const COLLAPSE_OFFSET = EXPANDED_HEIGHT - PEEK_HEIGHT;

// Тёмная карта в стиле WB Такси / Yandex Go night mode. Чёрно-серый
// фон, контуры улиц приглушённые — наша бирюзовая метка подачи
// и водительский маркер сразу выделяются. Стиль сжатый, ровно
// столько что нужно — без оверкила с десятками featureType.
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1e1b2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1e1b2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8c879d' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2a2640' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b6680' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2820' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2f2a45' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e1b2e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9c97b0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3658' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1e1b2e' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2a2640' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#13111f' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3658' }] },
];
import { useLocation, ActionButton, ClientColors, Typography, reverseGeocode, Region } from '@taxi/shared';
import { useOrder } from '../hooks/useOrder';
import DriverCard from '../components/DriverCard';
import AnimatedDriverMarker from '../components/AnimatedDriverMarker';
import Icon from '../components/Icon';
import IntervillageModal from '../components/IntervillageModal';
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

/**
 * Метка подачи такси в стиле Яндекс Go — жёлтый закруглённый
 * квадрат с тёмной фигуркой человека («тут стоит пассажир»).
 * Стержень снизу указывает точно на координату подачи. Drag-friendly:
 * фиксированный размер, без анимаций, hit-target ~50px.
 */
function PickupPinMarker(): React.ReactNode {
  return (
    <View style={pickupPinStyles.wrapper}>
      <View style={pickupPinStyles.badge}>
        <Icon name="user" size={26} color={pickupPinStyles.iconColor.color} strokeWidth={2.4} />
      </View>
      <View style={pickupPinStyles.stem} />
    </View>
  );
}

const PICKUP_YELLOW = '#FFCE2B';
const PICKUP_DARK = '#1E1B2E';

const pickupPinStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: PICKUP_YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  stem: {
    width: 2,
    height: 14,
    backgroundColor: PICKUP_DARK,
    opacity: 0.65,
    marginTop: -1,
  },
  iconColor: {
    color: PICKUP_DARK,
  },
});

export default function HomeScreen(): React.ReactNode {
  const location = useLocation();
  const { state, callTaxi, cancelOrder, dismissCompleted, loading, error } = useOrder();
  const mapRef = useRef<MapView>(null);

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
          {
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          400,
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
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        },
        400,
      );
    }
  }, [location.hasRealFix, location.latitude, location.longitude]);

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
    [translateY],
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
    [translateY, snapTo],
  );

  // Тарифы + определение района по pickupCoord (а не location).
  // Перетянул метку → запрос ушёл с новыми координатами → бейдж и
  // цена обновились автоматически.
  useFocusEffect(
    useCallback(() => {
      const lat = pickupCoord?.lat;
      const lng = pickupCoord?.lng;
      Promise.all([getRegions(), getTariffs(lat, lng)])
        .then(([rs, t]) => {
          setRegions(rs);
          setTariffs(t.routes);
          setRoundTripPct(t.roundTripSurchargePercent);
          setDetectedVillage(t.detectedVillage);
          setInServiceArea(t.inServiceArea);
        })
        .catch(() => undefined);
    }, [pickupCoord?.lat, pickupCoord?.lng]),
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
    latitudeDelta: 0.006,
    longitudeDelta: 0.006,
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
    if (detectedVillage === null || pickupCoord === null) return;
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
    const address = await reverseGeocode(pickupCoord.lat, pickupCoord.lng);
    const before = error;
    await callTaxi(pickupCoord.lat, pickupCoord.lng, toId, address, undefined, rt);
    return error === before;
  };

  const handlePinDragEnd = (e: MarkerDragStartEndEvent): void => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPickupCoord({ lat: latitude, lng: longitude });
    setPinDragged(true);
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
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={DARK_MAP_STYLE}
        mapPadding={{
          top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 40) + 8 : 0,
          right: 0,
          // Резервируем PEEK_HEIGHT снизу — map центрирует точку
          // пользователя в видимой части (над пик-шторкой), а не в
          // геометрическом центре экрана где её закрывает шторка.
          bottom: PEEK_HEIGHT,
          left: 0,
        }}
      >
        {/* Метка подачи (pickup pin) — отдельно от пользовательской
            точки. Юзер видит:
            - синюю точку OS-native (showsUserLocation) — где он реально
            - бирюзовую метку (наш Marker) — куда подать такси
            Это позволяет перетащить pickup в другое место (например на
            угол улицы) не путая «где я» и «куда подать».
            Pin рендерится после реального GPS-fix чтобы не падать в
            дефолтном Бишкеке. */}
        {pickupCoord && (
          <Marker
            coordinate={{ latitude: pickupCoord.lat, longitude: pickupCoord.lng }}
            // Anchor в самом низу стержня — координата подачи приходится
            // ровно на кончик «иголки» под жёлтым бейджем.
            anchor={{ x: 0.5, y: 1 }}
            draggable={state.phase === 'idle' && location.hasRealFix}
            onDragEnd={handlePinDragEnd}
            tracksViewChanges={false}
          >
            <PickupPinMarker />
          </Marker>
        )}
        {driverCoords && (
          <AnimatedDriverMarker coordinate={driverCoords} title="Водитель" />
        )}
      </MapView>

      {/* «Моя локация» FAB — приклеен к верхнему краю шторки. Тот
          же translateY двигает кнопку вместе со шторкой при свайпе,
          поэтому она всегда сидит чуть выше границы. Тап = центрирует
          карту на GPS + возвращает метку подачи на GPS. */}
      {location.hasRealFix && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.myLocationFab,
            { bottom: EXPANDED_HEIGHT + 16, transform: [{ translateY }] },
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
        {/* Peek-header — всегда виден, тапается для разворота/свёртки */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={togglePeek}
          style={styles.peekHeader}
        >
          <View style={styles.handle} />
          {renderPeekContent()}
        </TouchableOpacity>

        {error && (
          <View style={styles.errorPill}>
            <Icon name="alert" size={18} color={ClientColors.danger} strokeWidth={2.2} />
            <Text style={[Typography.caption, styles.errorText]}>{error}</Text>
          </View>
        )}

        {state.phase === 'idle' && (
          <>
            {/* Лоадер: ждём GPS или ответа /tariffs */}
            {(!pickupCoord || inServiceArea === null || regions.length === 0) && (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={ClientColors.primary} />
                <Text style={styles.loadingText}>
                  {!location.hasRealFix
                    ? (location.error ?? 'Определяем ваше местоположение…')
                    : 'Загружаем тарифы…'}
                </Text>
              </View>
            )}

            {/* Вне зоны — большая плашка с объяснением */}
            {pickupCoord && inServiceArea === false && (
              <View style={styles.serviceUnavailable}>
                <View style={styles.serviceUnavailableIcon}>
                  <Icon name="pin" size={28} color={ClientColors.secondaryDark} strokeWidth={2.2} />
                </View>
                <Text style={styles.serviceUnavailableTitle}>
                  Сервис пока недоступен в вашем районе
                </Text>
                <Text style={styles.serviceUnavailableBody}>
                  Мы работаем в Таласе, Кировке и Покровке.
                  {pinDragged
                    ? ' Перетащите метку обратно или вернитесь к GPS.'
                    : ' Если вы в одном из этих сёл — проверьте GPS.'}
                </Text>
                {pinDragged && (
                  <TouchableOpacity
                    style={styles.serviceUnavailableButton}
                    onPress={resetPinToGps}
                    activeOpacity={0.85}
                  >
                    <Icon name="pin" size={18} color={ClientColors.primary} strokeWidth={2.4} />
                    <Text style={styles.serviceUnavailableButtonText}>К моему GPS</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* В зоне — основной экран заказа */}
            {pickupCoord && inServiceArea === true && detectedVillage && (
              <>
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
    paddingBottom: 24,
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
    marginHorizontal: -24,
    paddingHorizontal: 24,
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
    borderRadius: 999,
  },
  peekVillageText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: ClientColors.primaryDark,
  },
  peekTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: ClientColors.dark,
  },
  peekPrice: {
    flex: 1,
    textAlign: 'right',
    fontSize: 18,
    fontWeight: '800' as const,
    color: ClientColors.dark,
    letterSpacing: -0.2,
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
  serviceUnavailableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: ClientColors.primary,
  },
  serviceUnavailableButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: ClientColors.primary,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    marginTop: 4,
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
  // «Моя локация» FAB — приклеен к верхней грани шторки
  myLocationFab: {
    position: 'absolute',
    right: 16,
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
