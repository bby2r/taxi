import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  AppState,
  Platform,
  StatusBar,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Icon } from '@taxi/shared';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  useAuth,
  useLocation,
  useCompassBearing,
  advanceCourseUp,
  type CourseUpState,
  DriverColors,
  Typography,
  DEFAULT_MAP_REGION,
} from '@taxi/shared';
import { DriverStackParamList, DriverTabParamList } from '../navigation/types';
import { useDriverOrder } from '../hooks/useDriverOrder';
import { useDriverLocation } from '../hooks/useDriverLocation';
import { getActiveIntercityTrip } from '../api/intercity';
import { usePushStatus, registerToken } from '../hooks/useNotifications';
import {
  checkFullScreenIntentPermission,
  openFullScreenIntentSettings,
  type FullScreenIntentStatus,
} from '../lib/notifee';
import {
  isOfferOverlayAvailable,
  hasOverlayPermission,
  openOverlaySettings,
  isIgnoringBatteryOptimizations,
  getManufacturer,
  openOemPowerSettings,
} from '../../modules/offer-overlay/src';
import OrderOfferCard from '../components/OrderOfferCard';
import PermissionGate from '../components/PermissionGate';
import OemSetupWizard, { PROBLEMATIC_OEMS } from '../components/OemSetupWizard';
import MapLibreMapView, { type MapLibreMapHandle } from '../components/MapLibreMapView';

// Lazy — SecureStore lives in the client too but the driver app may
// have an older bundle without it; degrade to in-memory so we don't
// crash, accepting that the wizard will re-show on every cold start
// for that user (still better than throwing).
let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  SecureStore = require('expo-secure-store');
} catch {
  SecureStore = null;
}

const OEM_WIZARD_SEEN_KEY = 'oem_wizard_seen_v1';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<DriverTabParamList, 'DriverHome'>,
  NativeStackNavigationProp<DriverStackParamList>
>;

export default function HomeScreen(): React.ReactNode {
  const navigation = useNavigation<NavigationProp>();
  const auth = useAuth();
  // Высота нижнего таб-бара — нужна чтобы поднять bottomPanel
  // (кнопка «Выйти на линию») над таб-баром, иначе её закрывает.
  const tabBarHeight = useBottomTabBarHeight();
  const {
    state,
    isOnline,
    toggleOnline,
    acceptOffer,
    declineOffer,
    loading,
    error,
  } = useDriverOrder();

  const driverLocation = useLocation();
  useDriverLocation({ enabled: isOnline });
  const [hasActiveIntercity, setHasActiveIntercity] = useState(false);
  const mapRef = useRef<MapLibreMapHandle>(null);
  const pushStatus = usePushStatus();
  const [fsiStatus, setFsiStatus] = useState<FullScreenIntentStatus>('unknown');
  const [overlayGranted, setOverlayGranted] = useState<boolean>(true);
  const [permissionGateVisible, setPermissionGateVisible] = useState(false);
  const [batteryWhitelisted, setBatteryWhitelisted] = useState<boolean>(true);
  const [oemWizardVisible, setOemWizardVisible] = useState(false);
  const [manufacturer, setManufacturer] = useState<string>('');
  // Локальный pending до того как loading из useDriverOrder поднимется —
  // спиннер должен крутиться с самого тапа, иначе пока GPS фиксируется
  // (10-30с в помещении), водитель думает что кнопка не сработала.
  const [togglePending, setTogglePending] = useState(false);

  // Android 14+ requires a separate manual grant for full-screen
  // notifications. Without it the offer notification falls back to a
  // plain heads-up in the shade instead of taking over the lock screen.
  // Re-check every time the screen mounts (driver might have just
  // returned from settings) plus once when push status flips to success.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const status = await checkFullScreenIntentPermission();
      if (!cancelled) setFsiStatus(status);
    })();
    return () => {
      cancelled = true;
    };
  }, [pushStatus.kind]);

  // Check the SYSTEM_ALERT_WINDOW grant for the bottom-sheet overlay each
  // time the home screen mounts (driver might have just returned from
  // settings). No-op on builds without the native overlay module.
  useEffect(() => {
    if (!isOfferOverlayAvailable()) {
      setOverlayGranted(true); // hide the banner — feature absent
      setBatteryWhitelisted(true);
      return;
    }
    setOverlayGranted(hasOverlayPermission());
    setBatteryWhitelisted(isIgnoringBatteryOptimizations());
    setManufacturer(getManufacturer());
  }, []);

  // First-launch OEM onboarding — only for known-aggressive OEMs
  // (Xiaomi/Huawei/Vivo/Oppo/Realme) where the standard battery toggle
  // isn't enough. Flag persists in SecureStore so we don't re-prompt
  // on every cold start. The persistent battery banner below still
  // catches cases where the OS later drops us out of the whitelist.
  useEffect(() => {
    if (Platform.OS !== 'android' || !isOfferOverlayAvailable()) return;
    const oem = getManufacturer();
    if (!PROBLEMATIC_OEMS.has(oem)) return;

    let cancelled = false;
    void (async () => {
      try {
        const seen = SecureStore ? await SecureStore.getItemAsync(OEM_WIZARD_SEEN_KEY) : null;
        if (!cancelled && !seen) {
          setOemWizardVisible(true);
        }
      } catch {
        // SecureStore failed — show wizard once per session anyway,
        // user can dismiss it with "Не сейчас".
        if (!cancelled) setOemWizardVisible(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Re-check battery whitelist each time the driver returns from a
  // potential settings deep-link — the AppState 'active' transition
  // fires when they tap the back gesture. Without this the banner
  // would persist even after the driver actually fixed it.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && isOfferOverlayAvailable()) {
        setBatteryWhitelisted(isIgnoringBatteryOptimizations());
        setOverlayGranted(hasOverlayPermission());
      }
    });
    return () => sub.remove();
  }, []);

  const dismissOemWizard = async (markSeen: boolean): Promise<void> => {
    setOemWizardVisible(false);
    if (markSeen && SecureStore) {
      try {
        await SecureStore.setItemAsync(OEM_WIZARD_SEEN_KEY, '1');
      } catch {
        // ignore — worst case wizard shows again next cold start
      }
    }
  };

  // If an offer lands while the wizard is open, force-dismiss it so the
  // driver actually sees the offer card. Without this the wizard's
  // grey backdrop hid the offer entirely on fresh installs (Xiaomi
  // first-launch + incoming order = "грейзз экран, ничего не открывается").
  useEffect(() => {
    if (state.phase === 'offer' && oemWizardVisible) {
      void dismissOemWizard(false);
    }
  }, [state.phase, oemWizardVisible]);

  // Navigate to OrderActive when we transition INTO an active phase.
  // Keyed on phase only, not on order.id, because:
  //   1. Order updates from Pusher (driver location, ETA tweaks) used
  //      to re-fire this effect and re-navigate, building up a stack
  //      of duplicate OrderActive screens — back button then had to
  //      tap through them one at a time.
  //   2. The active-phase order.id can only change by going through
  //      online_idle first, which retriggers phase change anyway.
  useEffect(() => {
    if (
      state.phase === 'active' ||
      state.phase === 'arrived' ||
      state.phase === 'in_progress'
    ) {
      navigation.navigate('OrderActive', { orderId: state.order.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Компас (магнитометр) крутит ТОЛЬКО иконку-стрелку водителя — куда
  // физически «смотрит» телефон. Камеру карты он больше НЕ трогает: раньше
  // малейший поворот телефона в руке разворачивал всю карту (магнитометр в
  // машине шумит — металл, динамики, держатель), и ориентироваться было
  // невозможно. Курс карты теперь берётся из GPS-движения (advanceCourseUp).
  const compassBearing = useCompassBearing();

  // Скругляем до 5 знаков (~1.1м) — отрезает sub-метровый GPS-jitter,
  // который иначе фигачил setDriver/setCenter в WebView на каждом
  // незначимом тике и грел WebGL-камеру лишними еasе'ами.
  const roundedLat =
    !driverLocation.loading && !driverLocation.error
      ? Math.round(driverLocation.latitude * 1e5) / 1e5
      : null;
  const roundedLng =
    !driverLocation.loading && !driverLocation.error
      ? Math.round(driverLocation.longitude * 1e5) / 1e5
      : null;

  // «Course-up» трекер: курс карты считается из реального GPS-движения, а не
  // из магнитометра. Объявлен до эффектов, которые его читают.
  const courseRef = useRef<CourseUpState>({
    anchor: { latitude: 0, longitude: 0 },
    bearing: 0,
  });
  const initialCenteredRef = useRef(false);

  // Иконка водителя показывает направление телефона (компас). Если
  // магнитометра нет — падаем на текущий курс карты, чтобы стрелка всё
  // равно смотрела по ходу движения. Лёгкий CSS-transform — можно часто.
  useEffect(() => {
    if (roundedLat === null || roundedLng === null) return;
    mapRef.current?.setDriver({
      latitude: roundedLat,
      longitude: roundedLng,
      heading: compassBearing ?? courseRef.current.bearing,
    });
  }, [roundedLat, roundedLng, compassBearing]);

  // Камера «course-up» по GPS: карта повёрнута по ходу движения, но
  // вращается только когда водитель реально едет (advanceCourseUp гейтит по
  // пройденному расстоянию и сглаживает курс), а на месте стоит неподвижно.
  // Поворот телефона в руке карту больше не двигает. Первый тик — с
  // zoom/pitch (защёлкнуть 3D-вид), дальше только center+bearing: zoom/pitch
  // на каждом тике зря гоняли easeTo и грели WebGL.
  useEffect(() => {
    if (roundedLat === null || roundedLng === null) return;
    const fix = { latitude: roundedLat, longitude: roundedLng };
    if (!initialCenteredRef.current) {
      initialCenteredRef.current = true;
      // Стартуем север-вверх и поворачиваемся только после реального
      // смещения — не угадываем курс по первому фиксу.
      courseRef.current = { anchor: fix, bearing: 0 };
      mapRef.current?.setCenter(fix, { zoom: 15, pitch: 45, bearing: 0 });
      return;
    }
    courseRef.current = advanceCourseUp(courseRef.current, fix);
    mapRef.current?.setCenter(fix, { bearing: courseRef.current.bearing });
  }, [roundedLat, roundedLng]);

  const performToggle = async (): Promise<void> => {
    setTogglePending(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Ошибка', 'Необходим доступ к геолокации');
        return;
      }
      // GPS-фикс может зависнуть на 30+ секунд в помещении / при слабом
      // сигнале. Параллельно берём last-known (мгновенно) и гоняем
      // current с таймаутом 6с — что вернётся первым, то и шлём в
      // toggleOnline. Если оба пусто — показываем понятную ошибку
      // вместо вечного спиннера.
      const coords = await resolveCoordsFast();
      if (!coords) {
        Alert.alert(
          'Не удалось определить местоположение',
          'Проверьте, включён ли GPS, и попробуйте выйти на улицу или к окну.',
        );
        return;
      }
      await toggleOnline(coords.latitude, coords.longitude);
    } finally {
      setTogglePending(false);
    }
  };

  // Подтягиваем активный межгород чтобы скрыть «Выйти на линию» —
  // на линию пускаем только когда нет активного рейса. Поллинг
  // каждые 15с (мирор IntercityScreen) ловит claim'ы из другой
  // вкладки без рестарта.
  useEffect(() => {
    let cancelled = false;
    const fetchTrip = async (): Promise<void> => {
      try {
        const trip = await getActiveIntercityTrip();
        if (cancelled) return;
        setHasActiveIntercity((prev) => {
          const next = trip !== null;
          return next === prev ? prev : next;
        });
      } catch {
        // 401/network — игнорим, следующий тик повторит
      }
    };
    fetchTrip();
    const interval = setInterval(fetchTrip, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleToggle = async (): Promise<void> => {
    // Going OFFLINE — skip the permission gate; revoking shift doesn't
    // need overlay/notification grants.
    if (isOnline) {
      await performToggle();
      return;
    }
    if (hasActiveIntercity) {
      Alert.alert(
        'Активный межгород-рейс',
        'Завершите рейс перед выходом на городскую линию.',
      );
      return;
    }
    // Going ONLINE — block until critical permissions are in place,
    // otherwise the driver sits on shift with offers silently dropping.
    if (Platform.OS === 'android') {
      const overlayOk = isOfferOverlayAvailable() ? hasOverlayPermission() : true;
      const batteryOk = isIgnoringBatteryOptimizations();
      if (!overlayOk || !batteryOk) {
        setPermissionGateVisible(true);
        return;
      }
    }
    await performToggle();
  };

  const handleRecenter = (): void => {
    if (driverLocation.loading || driverLocation.error) {
      return;
    }
    // clearOverride снимает WebView-side lock который встаёт на любом
    // тач-жесте — без этого setCenter был бы no-op после того как
    // водитель сам подвинул карту пальцем.
    mapRef.current?.clearOverride();
    mapRef.current?.setCenter(
      { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
      { zoom: 16, pitch: 45, bearing: courseRef.current.bearing },
    );
  };

  const driverPoint =
    !driverLocation.loading && !driverLocation.error
      ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
      : null;

  const initialCenter: [number, number] = driverPoint
    ? [driverPoint.longitude, driverPoint.latitude]
    : [DEFAULT_MAP_REGION.longitude, DEFAULT_MAP_REGION.latitude];

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <MapLibreMapView
        ref={mapRef}
        initialCenter={initialCenter}
        initialZoom={14}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.topPill}>
          <Text style={[Typography.caption, { color: DriverColors.textSecondary }]}>
            {auth.user?.name ?? 'Водитель'}
          </Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity
            onPress={handleRecenter}
            activeOpacity={0.75}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Центрировать на мне"
          >
            <Icon name="crosshair" size={20} color={DriverColors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Stats')}
            activeOpacity={0.75}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Статистика"
          >
            <Icon name="bar-chart-2" size={20} color={DriverColors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={[Typography.caption, { color: DriverColors.danger }]}>
            {error}
          </Text>
        </View>
      )}

      {pushStatus.kind !== 'success' && pushStatus.kind !== 'starting' && (
        <View style={styles.pushBanner}>
          <View style={styles.bannerTitleRow}>
            <Icon name="alert-triangle" size={16} color={DriverColors.danger} />
            <Text style={[Typography.bodyBold, styles.bannerTitleText]}>
              Push-уведомления не настроены
            </Text>
          </View>
          <Text
            style={[Typography.caption, styles.pushBannerHint]}
            testID="push-banner-reason"
          >
            {pushStatus.kind === 'idle' &&
              'Регистрация не запускалась — модуль уведомлений недоступен в этой сборке APK. Нужна пересборка через EAS Build.'}
            {pushStatus.kind === 'permission-denied' &&
              'Разрешите уведомления в настройках телефона. Без этого заказы не придут когда приложение свернуто.'}
            {pushStatus.kind === 'no-module' &&
              'Модуль expo-notifications не загрузился. Скорее всего APK собран без него — нужна пересборка через EAS Build.' +
                (pushStatus.error ? ' Детали: ' + pushStatus.error : '')}
            {pushStatus.kind === 'fetch-failed' &&
              'Не удалось получить токен от Expo: ' + pushStatus.error}
            {pushStatus.kind === 'register-failed' &&
              (pushStatus.error.includes('401')
                ? 'Сессия устарела. Выйдите из аккаунта и зайдите заново — после этого заказы начнут поступать.'
                : 'Токен получен, но не дошёл до сервера: ' + pushStatus.error)}
          </Text>
          <View style={styles.pushBannerActions}>
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              style={[styles.pushBannerButton, styles.pushBannerButtonOutline]}
              activeOpacity={0.7}
            >
              <Text style={[Typography.caption, { color: DriverColors.primary }]}>
                Настройки
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => registerToken()}
              style={[styles.pushBannerButton, styles.pushBannerButtonFilled]}
              activeOpacity={0.7}
              testID="push-retry"
            >
              <Text style={[Typography.caption, { color: DriverColors.background }]}>
                Повторить
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {fsiStatus === 'denied' && pushStatus.kind === 'success' && overlayGranted && (
        <TouchableOpacity
          style={styles.fsiBanner}
          onPress={async () => {
            await openFullScreenIntentSettings();
            // Fallback if notifee doesn't ship the deep-link helper.
            Linking.openSettings().catch(() => undefined);
          }}
          activeOpacity={0.85}
          testID="fsi-banner"
        >
          <View style={styles.bannerTitleRow}>
            <Icon name="alert-triangle" size={16} color={DriverColors.danger} />
            <Text style={[Typography.bodyBold, styles.bannerTitleText]}>
              Заказ не открывается на экране
            </Text>
          </View>
          <Text style={[Typography.caption, styles.pushBannerHint]}>
            Включите «Уведомления на весь экран» в настройках телефона. Без этого заказы будут приходить только маленькой шторкой сверху, без таймера и кнопки «Принять».
          </Text>
          <Text style={[Typography.caption, styles.pushBannerCta]}>
            Нажмите чтобы открыть настройки →
          </Text>
        </TouchableOpacity>
      )}

      {!overlayGranted && (
        <TouchableOpacity
          style={styles.fsiBanner}
          onPress={() => {
            openOverlaySettings();
            setTimeout(() => setOverlayGranted(hasOverlayPermission()), 1500);
          }}
          activeOpacity={0.85}
          testID="overlay-banner"
        >
          <View style={styles.bannerTitleRow}>
            <Icon name="alert-triangle" size={16} color={DriverColors.danger} />
            <Text style={[Typography.bodyBold, styles.bannerTitleText]}>
              Поверх других приложений выключено
            </Text>
          </View>
          <Text style={[Typography.caption, styles.pushBannerHint]}>
            Включите «Поверх других приложений», чтобы заказ всплывал карточкой снизу прямо когда вы в WhatsApp или браузере, без открытия приложения.
          </Text>
          <Text style={[Typography.caption, styles.pushBannerCta]}>
            Нажмите чтобы открыть настройки →
          </Text>
        </TouchableOpacity>
      )}

      {!batteryWhitelisted && (
        <TouchableOpacity
          style={styles.fsiBanner}
          onPress={() => {
            // Vendor-specific intent on Xiaomi/Huawei/Vivo/Oppo/Realme
            // (their autostart screen is what actually fixes it);
            // standard battery toggle elsewhere. The AppState 'active'
            // listener above refreshes the banner when the driver
            // returns from settings.
            openOemPowerSettings();
          }}
          activeOpacity={0.85}
          testID="battery-banner"
        >
          <View style={styles.bannerTitleRow}>
            <Icon name="alert-triangle" size={16} color={DriverColors.danger} />
            <Text style={[Typography.bodyBold, styles.bannerTitleText]}>
              Приложение может вылетать в фоне
            </Text>
          </View>
          <Text style={[Typography.caption, styles.pushBannerHint]}>
            {PROBLEMATIC_OEMS.has(manufacturer)
              ? 'На этом телефоне система жёстко контролирует фоновые приложения. Откройте настройки и разрешите автозапуск + отключите оптимизацию батареи — иначе заказы перестанут приходить через 5-10 минут.'
              : 'Отключите оптимизацию батареи для Alif Taxi — иначе система может выгрузить приложение в фоне и заказы перестанут приходить.'}
          </Text>
          <Text style={[Typography.caption, styles.pushBannerCta]}>
            Нажмите чтобы открыть настройки →
          </Text>
        </TouchableOpacity>
      )}

      {state.phase !== 'offer' && (
        <View style={[styles.bottomPanel, { bottom: tabBarHeight }]}>
          {hasActiveIntercity && !isOnline ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.navigate('DriverIntercity')}
              style={styles.intercityBanner}
            >
              <Text style={styles.intercityBannerTitle}>
                Активный межгород-рейс
              </Text>
              <Text style={styles.intercityBannerSubtitle}>
                Городская линия недоступна. Тап → перейти к рейсу
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              {isOnline && state.phase === 'online_idle' && (
                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={[Typography.body, styles.statusText]}>
                    Ожидаем заказ...
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleToggle}
                disabled={loading || togglePending}
                activeOpacity={0.85}
                style={[
                  styles.shiftButton,
                  isOnline ? styles.shiftButtonOnline : styles.shiftButtonOffline,
                ]}
              >
                {loading || togglePending ? (
                  <ActivityIndicator
                    color={isOnline ? DriverColors.textPrimary : DriverColors.background}
                  />
                ) : (
                  <Text
                    style={[
                      Typography.button,
                      {
                        color: isOnline
                          ? DriverColors.textPrimary
                          : DriverColors.background,
                      },
                    ]}
                  >
                    {isOnline ? 'Завершить смену' : 'Выйти на линию'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {state.phase === 'offer' && (
        <View style={[styles.offerOverlay, { bottom: tabBarHeight }]}>
          <OrderOfferCard
            order={state.order}
            onAccept={acceptOffer}
            onDecline={declineOffer}
            loading={loading}
          />
        </View>
      )}

      <PermissionGate
        visible={permissionGateVisible}
        onResolved={() => {
          setPermissionGateVisible(false);
          void performToggle();
        }}
        onDismiss={() => setPermissionGateVisible(false)}
      />

      <OemSetupWizard
        visible={oemWizardVisible}
        manufacturer={manufacturer}
        onDone={() => void dismissOemWizard(true)}
        onSkip={() => void dismissOemWizard(true)}
      />
    </View>
  );
}

const TOP_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 56;

interface Coords {
  latitude: number;
  longitude: number;
}

// Берём last-known (мгновенно из системного кэша) параллельно с
// current (свежий fix). Что первое вернёт валидные координаты — то и
// используем. Current ограничиваем 6 секундами; если и он и cache
// пустые — возвращаем null, чтобы вызвавший показал понятную ошибку
// вместо вечного спиннера на кнопке «Выйти на линию».
async function resolveCoordsFast(): Promise<Coords | null> {
  const lastKnown = Location.getLastKnownPositionAsync({
    maxAge: 60_000,
    requiredAccuracy: 200,
  }).then((p) =>
    p ? { latitude: p.coords.latitude, longitude: p.coords.longitude } : null,
  );

  const current = Promise.race<Coords | null>([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((p) => ({
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
    })),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
  ]);

  try {
    const cached = await lastKnown;
    if (cached) return cached;
  } catch {
    // ignore — fall through to current
  }
  try {
    return await current;
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DriverColors.background,
  },
  topBar: {
    position: 'absolute',
    top: TOP_INSET,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topPill: {
    backgroundColor: DriverColors.cardBackground,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DriverColors.border,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: DriverColors.cardBackground,
    borderWidth: 1,
    borderColor: DriverColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerTitleText: {
    color: DriverColors.danger,
    flex: 1,
  },
  errorBanner: {
    position: 'absolute',
    top: TOP_INSET + 56,
    left: 16,
    right: 16,
    backgroundColor: DriverColors.cardBackground,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DriverColors.danger,
  },
  pushBanner: {
    position: 'absolute',
    top: TOP_INSET + 56,
    left: 16,
    right: 16,
    backgroundColor: '#3B1F22',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DriverColors.danger,
  },
  fsiBanner: {
    position: 'absolute',
    top: TOP_INSET + 56,
    left: 16,
    right: 16,
    backgroundColor: '#3B1F22',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DriverColors.danger,
  },
  pushBannerCta: {
    color: DriverColors.primary,
    marginTop: 8,
    fontWeight: '600' as const,
  },
  pushBannerHint: {
    color: DriverColors.textSecondary,
    marginTop: 4,
  },
  pushBannerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  pushBannerButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pushBannerButtonOutline: {
    borderWidth: 1,
    borderColor: DriverColors.primary,
  },
  pushBannerButtonFilled: {
    backgroundColor: DriverColors.primary,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: DriverColors.cardBackground,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DriverColors.success,
    marginRight: 8,
  },
  statusText: {
    color: DriverColors.textPrimary,
  },
  shiftButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  shiftButtonOffline: {
    backgroundColor: DriverColors.primary,
  },
  shiftButtonOnline: {
    backgroundColor: DriverColors.cardBackground,
    borderWidth: 1,
    borderColor: DriverColors.border,
  },
  intercityBanner: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: DriverColors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  intercityBannerTitle: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: DriverColors.textPrimary,
  },
  intercityBannerSubtitle: {
    fontSize: 12,
    color: DriverColors.textSecondary,
    marginTop: 4,
  },
  offerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
