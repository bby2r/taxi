import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DriverColors, Typography } from '@taxi/shared';

interface StatCardProps {
  title: string;
  orders: number;
  earnings: number;
}

export default function StatCard({ title, orders, earnings }: StatCardProps): React.ReactNode {
  const ordersLabel = orders === 1 ? 'заказ' : orders < 5 ? 'заказа' : 'заказов';
  const earningsLabel = earnings.toLocaleString('ru-RU');

  return (
    <View
      style={styles.card}
      accessibilityLabel={`${title}: ${orders} ${ordersLabel}, ${earningsLabel} сом`}
    >
      <Text style={[Typography.caption, { color: DriverColors.textMuted }]}>{title}</Text>
      <Text style={[Typography.h2, { color: DriverColors.primary, marginTop: 8 }]}>
        {earningsLabel} сом
      </Text>
      <Text style={[Typography.body, { color: DriverColors.textSecondary, marginTop: 4 }]}>
        {orders} {ordersLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 16,
    padding: 16,
  },
});
