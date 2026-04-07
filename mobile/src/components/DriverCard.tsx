import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Driver } from '../api/types';
import { ClientColors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface DriverCardProps {
  driver: Driver;
  status: 'accepted' | 'arrived' | 'in_progress';
}

function getStatusText(status: DriverCardProps['status']): { label: string; color: string; bold: boolean } {
  switch (status) {
    case 'accepted':
      return { label: 'В пути к вам', color: ClientColors.primary, bold: false };
    case 'arrived':
      return { label: 'Водитель прибыл!', color: ClientColors.success, bold: true };
    case 'in_progress':
      return { label: 'Поездка...', color: ClientColors.dark, bold: false };
  }
}

export default function DriverCard({ driver, status }: DriverCardProps): React.ReactNode {
  const statusInfo = getStatusText(status);
  const initial = driver.name.charAt(0).toUpperCase();

  const handleCall = (): void => {
    Linking.openURL(`tel:${driver.phone}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.info}>
          <Text style={[Typography.bodyBold, { color: ClientColors.dark }]}>{driver.name}</Text>
          <Text style={[Typography.caption, { color: ClientColors.textSecondary }]}>
            {driver.car_model} · {driver.car_number}
          </Text>
          <Text
            style={[
              Typography.caption,
              { color: statusInfo.color, fontWeight: statusInfo.bold ? '700' : '400' },
            ]}
          >
            {statusInfo.label}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleCall}
          style={styles.phoneButton}
          accessibilityRole="button"
          accessibilityLabel="Позвонить водителю"
        >
          <Text style={styles.phoneIcon}>📞</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ClientColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: ClientColors.dark,
  },
  info: {
    flex: 1,
  },
  phoneButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ClientColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  phoneIcon: {
    fontSize: 20,
  },
});
