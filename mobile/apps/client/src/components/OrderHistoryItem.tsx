import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { Order, OrderStatus, ClientColors, FadeInView, Radius, Spacing, Typography } from '@taxi/shared';

dayjs.locale('ru');

interface OrderHistoryItemProps {
  order: Order;
  index?: number;
}

interface StatusBadgeConfig {
  label: string;
  backgroundColor: string;
  color: string;
}

function getStatusBadge(status: OrderStatus): StatusBadgeConfig {
  switch (status) {
    case 'completed':
      return { label: 'Завершён', backgroundColor: ClientColors.primaryTint, color: ClientColors.primaryDark };
    case 'cancelled':
      return { label: 'Отменён', backgroundColor: ClientColors.dangerTint, color: ClientColors.danger };
    default:
      return { label: 'В процессе', backgroundColor: ClientColors.secondaryTint, color: ClientColors.secondaryDark };
  }
}

export default function OrderHistoryItem({ order, index = 0 }: OrderHistoryItemProps): React.ReactNode {
  const formattedDate = dayjs(order.created_at).format('D MMM YYYY, HH:mm');
  const badge = getStatusBadge(order.status);
  const address = order.pickup_address || 'Без адреса';

  return (
    <FadeInView
      delay={Math.min(index, 7) * 55}
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
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: ClientColors.cardBackground,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    marginHorizontal: Spacing.lg,
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
    marginBottom: Spacing.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});
