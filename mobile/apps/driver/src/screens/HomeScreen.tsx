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
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth, useLocation, DriverColors, Typography, DEFAULT_MAP_REGION } from '@taxi/shared';
import { DriverStackParamList, DriverTabParamList } from '../navigation/types';
import { useDriverOrder } from '../hooks/useDriverOrder';
import { useDriverLocation } from '../hooks/useDriverLocation';
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
import DriverArrow from '../components/DriverArrow';

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
  const cameraRef = useRef<Mapbox.Camera>(null);
  const pushStatus = usePushStatus();
  const [fsiStatus, setFsiStatus] = useState<FullScreenIntentStatus>('unknown');
  const [overlayGranted, setOverlayGranted] = useState<boolean>(true);
  const [permissionGateVisible, setPermissionGateVisible] = useState(false);
  const [batteryWhitelisted, setBatteryWhitelisted] = useState<boolean>(true);
  const [oemWizardVisible, setOemWizardVisible] = useState(false);
  const [manufacturer, setManufacturer] = useState<string>('');

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

  // Navigate to OrderActive when in any active phase
  useEffect(() => {
    if (
      state.phase === 'active' ||
      state.phase === 'arrived' ||
      state.phase === 'in_progress'
    ) {
      navigation.navigate('OrderActive', { orderId: state.order.id });
    }
  }, [
    state.phase,
    state.phase === 'active' || state.phase === 'arrived' || state.phase === 'in_progress'
      ? state.order.id
      : null,
    navigation,
  ]);

  // Re-center map when the driver actually moves, not only on
  // loading / error transitions. The previous effect read `latitude` and
  // `longitude` but didn't list them as deps, so once we got our first
  // fix the camera never followed the driver. Camera updates are cheap;
  // the upstream useLocation hook already throttles location pushes to
  // ~5 s / 10 m, so this only fires on meaningful movement.
  useEffect(() => {
    if (driverLocation.loading || driverLocation.error || !cameraRef.current) {
      return;
    }
    cameraRef.current.setCamera({
      centerCoordinate: [driverLocation.longitude, driverLocation.latitude],
      zoomLevel: 15,
      animationDuration: 600,
    });
  }, [
    driverLocation.loading,
    driverLocation.error,
    driverLocation.latitude,
    driverLocation.longitude,
  ]);

  const performToggle = async (): Promise<void> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ошибка', 'Необходим доступ к геолокации');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await toggleOnline(loc.coords.latitude, loc.coords.longitude);
  };

  const handleToggle = async (): Promise<void> => {
    // Going OFFLINE — skip the permission gate; revoking shift doesn't
    // need overlay/notification grants.
    if (isOnline) {
      await performToggle();
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
    if (driverLocation.loading || driverLocation.error || !cameraRef.current) {
      return;
    }
    cameraRef.current.setCamera({
      centerCoordinate: [driverLocation.longitude, driverLocation.latitude],
      zoomLevel: 16,
      animationDuration: 400,
    });
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

      <Mapbox.MapView
        style={StyleSheet.absoluteFill}
        styleURL={Mapbox.StyleURL.TrafficDay}
        compassEnabled={false}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: initialCenter,
            zoomLevel: 14,
          }}
        />

        {driverPoint && (
          <Mapbox.PointAnnotation
            id="driver-self"
            coordinate={[driverPoint.longitude, driverPoint.latitude]}
          >
            <DriverArrow heading={driverLocation.heading} online={isOnline} />
          </Mapbox.PointAnnotation>
        )}
      </Mapbox.MapView>

      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.topPill}>
          <Text style={[Typography.caption, { color: DriverColors.textSecondary }]}>
            {auth.user?.name ?? 'Водитель'}
          </Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Stats')}
            activeOpacity={0.7}
            style={styles.iconButton}
            accessibilityLabel="Статистика"
          >
            <Text style={styles.iconText}>📊</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={auth.logout}
            activeOpacity={0.7}
            style={styles.iconButton}
            accessibilityLabel="Выйти"
          >
            <Text style={styles.iconText}>⏏</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.rightControls} pointerEvents="box-none">
        <TouchableOpacity
          onPress={handleRecenter}
          activeOpacity={0.7}
          style={styles.iconButton}
          accessibilityLabel="Центрировать на мне"
        >
          <Text style={styles.iconText}>🎯</Text>
        </TouchableOpacity>
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
          <Text style={[Typography.bodyBold, { color: DriverColors.danger }]}>
            ⚠ Push-уведомления не настроены
          </Text>
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
          <Text style={[Typography.bodyBold, { color: DriverColors.danger }]}>
            ⚠ Заказ не открывается на экране
          </Text>
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
          <Text style={[Typography.bodyBold, { color: DriverColors.danger }]}>
            ⚠ Поверх других приложений выключено
          </Text>
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
          <Text style={[Typography.bodyBold, { color: DriverColors.danger }]}>
            ⚠ Приложение может вылетать в фоне
          </Text>
          <Text style={[Typography.caption, styles.pushBannerHint]}>
            {PROBLEMATIC_OEMS.has(manufacturer)
              ? 'На этом телефоне система жёстко контролирует фоновые приложения. Откройте настройки и разрешите автозапуск + отключите оптимизацию батареи — иначе заказы перестанут приходить через 5-10 минут.'
              : 'Отключите оптимизацию батареи для AIYL Taxi — иначе система может выгрузить приложение в фоне и заказы перестанут приходить.'}
          </Text>
          <Text style={[Typography.caption, styles.pushBannerCta]}>
            Нажмите чтобы открыть настройки →
          </Text>
        </TouchableOpacity>
      )}

      {state.phase !== 'offer' && (
        <View style={styles.bottomPanel}>
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
          disabled={loading}
          activeOpacity={0.85}
          style={[
            styles.shiftButton,
            isOnline ? styles.shiftButtonOnline : styles.shiftButtonOffline,
          ]}
        >
          {loading ? (
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
        </View>
      )}

      {state.phase === 'offer' && (
        <View style={styles.offerOverlay}>
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
    paddingVertical: 8,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rightControls: {
    position: 'absolute',
    right: 16,
    bottom: 220,
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: DriverColors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  iconText: {
    fontSize: 20,
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
  driverDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  driverDotOnline: {
    backgroundColor: DriverColors.primary,
  },
  driverDotOffline: {
    backgroundColor: DriverColors.textMuted,
  },
  driverDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
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
  offerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
