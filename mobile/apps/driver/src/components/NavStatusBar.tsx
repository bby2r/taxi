import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DriverColors, Typography } from '@taxi/shared';

interface NavStatusBarProps {
  // Секунд до прибытия (из OSRM).
  durationSeconds: number;
  // Метров до точки назначения.
  distanceMeters: number;
}

// Статусная пилюля поверх карты, как нижний бар навигатора:
// «6 мин / 19:46 прибытие / 2.8 км». Видна даже когда BottomSheet
// свёрнут — водитель в навигаторе хочет видеть ETA постоянно, а не
// тянуть лист каждый раз.
export default function NavStatusBar({
  durationSeconds,
  distanceMeters,
}: NavStatusBarProps): React.ReactElement {
  const etaMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const arrival = new Date(Date.now() + durationSeconds * 1000);
  const arrivalText = `${String(arrival.getHours()).padStart(2, '0')}:${String(
    arrival.getMinutes(),
  ).padStart(2, '0')}`;
  const distanceText =
    distanceMeters < 1000
      ? `${Math.round(distanceMeters)} м`
      : `${(distanceMeters / 1000).toFixed(1)} км`;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.cell}>
        <Text style={styles.value}>{etaMinutes}</Text>
        <Text style={styles.unit}>мин</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.cell}>
        <Text style={styles.value}>{arrivalText}</Text>
        <Text style={styles.unit}>прибытие</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.cell}>
        <Text style={styles.value}>{distanceText}</Text>
        <Text style={styles.unit}>{' '}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: DriverColors.border,
    marginHorizontal: 4,
  },
  value: {
    ...Typography.h3,
    color: DriverColors.textPrimary,
    fontWeight: '800' as const,
    lineHeight: 22,
  },
  unit: {
    ...Typography.caption,
    color: DriverColors.textMuted,
    marginTop: 2,
  },
});
