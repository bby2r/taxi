import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { DriverStackParamList, DriverTabParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useDriverOrder } from '../../hooks/useDriverOrder';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useLocation } from '../../hooks/useLocation';
import OrderOfferCard from '../../components/OrderOfferCard';
import { DriverColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { DEFAULT_MAP_REGION } from '../../utils/constants';

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
  const mapRef = useRef<MapView>(null);

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

  // Re-center map when driver location changes significantly
  useEffect(() => {
    if (driverLocation.loading || driverLocation.error || !mapRef.current) {
      return;
    }
    mapRef.current.animateCamera(
      {
        center: {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
        },
        zoom: 15,
      },
      { duration: 600 },
    );
  }, [driverLocation.loading, driverLocation.error]);

  const handleToggle = async (): Promise<void> => {
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

  const handleRecenter = (): void => {
    if (driverLocation.loading || driverLocation.error || !mapRef.current) {
      return;
    }
    mapRef.current.animateCamera(
      {
        center: {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
        },
        zoom: 16,
      },
      { duration: 400 },
    );
  };

  const driverPoint =
    !driverLocation.loading && !driverLocation.error
      ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
      : null;

  const initialRegion = driverPoint
    ? {
        latitude: driverPoint.latitude,
        longitude: driverPoint.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : DEFAULT_MAP_REGION;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {driverPoint && (
          <Marker
            coordinate={driverPoint}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
          >
            <View
              style={[
                styles.driverDot,
                isOnline ? styles.driverDotOnline : styles.driverDotOffline,
              ]}
            >
              <View style={styles.driverDotInner} />
            </View>
          </Marker>
        )}
      </MapView>

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
          />
        </View>
      )}
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
