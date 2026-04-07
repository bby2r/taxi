import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { Order } from '../api/types';
import { DriverColors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface OrderOfferCardProps {
  order: Order;
  onAccept: () => void;
  onDecline: () => void;
  countdownSeconds?: number;
}

export default function OrderOfferCard({
  order,
  onAccept,
  onDecline,
  countdownSeconds = 10,
}: OrderOfferCardProps): React.ReactNode {
  const [remaining, setRemaining] = useState(countdownSeconds);
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const declineCalledRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!declineCalledRef.current) {
            declineCalledRef.current = true;
            onDecline();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onDecline]);

  useEffect(() => {
    opacityAnim.setValue(remaining / countdownSeconds);
  }, [remaining, countdownSeconds, opacityAnim]);

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.countdownCircle, { opacity: opacityAnim }]}>
        <Text style={[Typography.h2, { color: DriverColors.primary }]}>{remaining}</Text>
      </Animated.View>

      <Text style={[Typography.caption, { color: DriverColors.textMuted, marginBottom: 4 }]}>
        Адрес подачи
      </Text>
      <Text style={[Typography.body, { color: DriverColors.textPrimary, marginBottom: 16 }]}>
        {order.pickup_address || 'Геолокация клиента'}
      </Text>

      <Text style={[Typography.h1, { color: DriverColors.primary, marginBottom: 20 }]}>
        {order.price} сом
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton]}
          onPress={onAccept}
          activeOpacity={0.8}
        >
          <Text style={[Typography.button, { color: DriverColors.white }]}>Принять</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.declineButton]}
          onPress={onDecline}
          activeOpacity={0.8}
        >
          <Text style={[Typography.button, { color: DriverColors.textSecondary }]}>Пропустить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 20,
    padding: 20,
    position: 'relative',
  },
  countdownCircle: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: DriverColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    flex: 2,
    backgroundColor: DriverColors.success,
  },
  declineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: DriverColors.border,
  },
});
