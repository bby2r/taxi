import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Driver, ClientColors, Radius, Spacing } from '@taxi/shared';

interface DriverCardProps {
  driver: Driver;
  status: 'accepted' | 'arrived' | 'in_progress';
}

function getStatusText(status: DriverCardProps['status']): {
  label: string;
  color: string;
  bg: string;
  emoji: string;
} {
  switch (status) {
    case 'accepted':
      return {
        label: 'В пути к вам',
        color: ClientColors.primaryDark,
        bg: ClientColors.primaryTint,
        emoji: '🛣️',
      };
    case 'arrived':
      return {
        label: 'Водитель ожидает',
        color: ClientColors.secondaryDark,
        bg: ClientColors.secondaryTint,
        emoji: '📍',
      };
    case 'in_progress':
      return {
        label: 'В поездке',
        color: ClientColors.accent,
        bg: ClientColors.accentTint,
        emoji: '🚕',
      };
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
      <View style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}>
        <Text style={styles.statusEmoji}>{statusInfo.emoji}</Text>
        <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
          {statusInfo.label}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{driver.name}</Text>
          <Text style={styles.car}>
            {driver.car_model} · {driver.car_number}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleCall}
          style={styles.phoneButton}
          accessibilityRole="button"
          accessibilityLabel="Позвонить водителю"
          activeOpacity={0.8}
        >
          <Text style={styles.phoneIcon}>📞</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.round,
    marginBottom: 14,
    gap: 6,
  },
  statusEmoji: {
    fontSize: 14,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ClientColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: ClientColors.white,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: ClientColors.dark,
  },
  car: {
    fontSize: 13,
    color: ClientColors.textSecondary,
    marginTop: 2,
  },
  phoneButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ClientColors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
    shadowColor: ClientColors.success,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  phoneIcon: {
    fontSize: 22,
  },
});
