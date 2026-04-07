import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DriverStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useDriverOrder } from '../../hooks/useDriverOrder';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import OnlineToggle from '../../components/OnlineToggle';
import OrderOfferCard from '../../components/OrderOfferCard';
import { DriverColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';

type NavigationProp = NativeStackNavigationProp<DriverStackParamList, 'DriverHome'>;

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

  useDriverLocation({ enabled: isOnline });

  // Navigate to OrderActive when in active/arrived phase
  useEffect(() => {
    if (state.phase === 'active' || state.phase === 'arrived') {
      navigation.navigate('OrderActive', { orderId: state.order.id });
    }
  }, [state.phase, state.phase === 'active' || state.phase === 'arrived' ? state.order.id : null, navigation]);

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={[Typography.h2, { color: DriverColors.textPrimary }]}>
          Привет, {auth.user?.name}
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Stats')}
            activeOpacity={0.7}
            style={styles.statsButton}
          >
            <Text style={{ fontSize: 22 }}>📊</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={auth.logout} activeOpacity={0.7}>
            <Text style={[Typography.body, { color: DriverColors.danger }]}>Выйти</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={[Typography.caption, { color: DriverColors.danger }]}>{error}</Text>
        </View>
      )}

      <View style={styles.center}>
        <OnlineToggle isOnline={isOnline} onToggle={handleToggle} loading={loading} />
        {isOnline && state.phase === 'online_idle' && (
          <Text
            style={[Typography.body, { color: DriverColors.textMuted, marginTop: 24 }]}
          >
            Ожидаем заказ...
          </Text>
        )}
      </View>

      {state.phase === 'offer' && (
        <View style={styles.offerOverlay}>
          <OrderOfferCard
            order={state.order}
            onAccept={acceptOffer}
            onDecline={declineOffer}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DriverColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statsButton: {
    padding: 4,
  },
  errorBanner: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
});
