import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Modal,
  StyleSheet,
} from 'react-native';
import { Order, DeclineReason } from '../api/types';
import { DriverColors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface OrderOfferCardProps {
  order: Order;
  onAccept: () => void;
  onDecline: (reason: DeclineReason) => void;
  // Length of the on-card countdown before auto-decline. 20 s gives the
  // driver enough breathing room to glance at price + address; the
  // server-side OfferTimeoutJob still fires at 30 s (intra) / 45 s
  // (inter-district), so this stays under the server limit.
  countdownSeconds?: number;
}

const REASON_OPTIONS: { value: DeclineReason; label: string }[] = [
  { value: 'too_far', label: 'Слишком далеко' },
  { value: 'wrong_district', label: 'Не мой район' },
  { value: 'client_no_answer', label: 'Клиент не отвечает' },
  { value: 'personal', label: 'Личная причина' },
];

export default function OrderOfferCard({
  order,
  onAccept,
  onDecline,
  countdownSeconds = 20,
}: OrderOfferCardProps): React.ReactNode {
  const [remaining, setRemaining] = useState(countdownSeconds);
  const [reasonSheetOpen, setReasonSheetOpen] = useState(false);
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const declineCalledRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!declineCalledRef.current) {
            declineCalledRef.current = true;
            // Auto-timeout uses a personal reason on the client;
            // server-side timeouts are handled separately and excluded from penalty.
            onDecline('personal');
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

  const handlePickReason = (reason: DeclineReason): void => {
    if (declineCalledRef.current) {
      return;
    }
    declineCalledRef.current = true;
    setReasonSheetOpen(false);
    onDecline(reason);
  };

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.countdownCircle, { opacity: opacityAnim }]}>
        <Text style={[Typography.h2, { color: DriverColors.primary }]}>{remaining}</Text>
      </Animated.View>

      <View style={styles.badgeRow}>
        <View
          style={[
            styles.badge,
            order.is_inter_district ? styles.badgeRegional : styles.badgeVillage,
          ]}
        >
          <Text style={[Typography.caption, styles.badgeText]}>
            {order.is_inter_district
              ? `Межрайон${order.region ? ` · ${order.region.name}` : ''}`
              : 'В селе'}
          </Text>
        </View>
      </View>

      <Text style={[Typography.caption, { color: DriverColors.textMuted, marginBottom: 4 }]}>
        Адрес подачи
      </Text>
      <Text style={[Typography.body, { color: DriverColors.textPrimary, marginBottom: 12 }]}>
        {order.pickup_address || 'Геолокация клиента'}
      </Text>

      {order.is_inter_district && (
        <>
          <Text style={[Typography.caption, { color: DriverColors.textMuted, marginBottom: 4 }]}>
            Куда
          </Text>
          <Text style={[Typography.body, { color: DriverColors.textPrimary, marginBottom: 12 }]}>
            {order.dropoff_address || order.region?.name || '—'}
          </Text>
        </>
      )}

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
          onPress={() => setReasonSheetOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={[Typography.button, { color: DriverColors.textSecondary }]}>
            Отказаться
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={reasonSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReasonSheetOpen(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setReasonSheetOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <Text style={[Typography.h3, styles.sheetTitle]}>Причина отказа</Text>
            {REASON_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={styles.sheetItem}
                onPress={() => handlePickReason(opt.value)}
                activeOpacity={0.7}
              >
                <Text style={[Typography.body, { color: DriverColors.textPrimary }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setReasonSheetOpen(false)}
              activeOpacity={0.7}
            >
              <Text style={[Typography.button, { color: DriverColors.textMuted }]}>
                Отмена
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeVillage: {
    backgroundColor: `${DriverColors.primary}22`,
  },
  badgeRegional: {
    backgroundColor: `${DriverColors.success}22`,
  },
  badgeText: {
    color: DriverColors.textPrimary,
    fontWeight: '600',
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
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: DriverColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 34,
  },
  sheetTitle: {
    color: DriverColors.textPrimary,
    marginBottom: 12,
  },
  sheetItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: DriverColors.border,
  },
  sheetCancel: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
});
