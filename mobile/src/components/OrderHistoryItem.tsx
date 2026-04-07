import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { Order, OrderStatus } from '../api/types';
import { ClientColors } from '../theme/colors';
import { Typography } from '../theme/typography';

dayjs.locale('ru');

interface OrderHistoryItemProps {
  order: Order;
}

interface StatusBadgeConfig {
  label: string;
  backgroundColor: string;
  color: string;
}

function getStatusBadge(status: OrderStatus): StatusBadgeConfig {
  switch (status) {
    case 'completed':
      return { label: 'Завершён', backgroundColor: '#D1FAE5', color: '#065F46' };
    case 'cancelled':
      return { label: 'Отменён', backgroundColor: '#FEE2E2', color: '#991B1B' };
    default:
      return { label: 'В процессе', backgroundColor: '#FEF3C7', color: '#92400E' };
  }
}

export default function OrderHistoryItem({ order }: OrderHistoryItemProps): React.ReactNode {
  const formattedDate = dayjs(order.created_at).format('D MMM YYYY, HH:mm');
  const badge = getStatusBadge(order.status);
  const address = order.pickup_address || 'Без адреса';

  return (
    <View
      style={styles.container}
      accessibilityLabel={`${formattedDate}, ${address}, ${order.price} сом, ${badge.label}`}
    >
      <View style={styles.topRow}>
        <Text style={[Typography.caption, { color: ClientColors.textSecondary }]}>
          {formattedDate}
        </Text>
        <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
          <Text style={[Typography.caption, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
      </View>
      <View style={styles.bottomRow}>
        <Text
          style={[Typography.body, { color: ClientColors.textPrimary, flex: 1 }]}
          numberOfLines={1}
        >
          {address}
        </Text>
        <Text style={[Typography.bodyBold, { color: ClientColors.dark }]}>
          {order.price} сом
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: ClientColors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});
