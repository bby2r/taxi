import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DriverColors, ManeuverType, Typography } from '@taxi/shared';

interface NavigationBannerProps {
  maneuver: ManeuverType;
  distanceMeters: number;
  instruction: string;
}

// Юникод-стрелка для каждого типа манёвра. Альтернатива — отрисовать
// нормальный SVG, но для MVP юникод читается мгновенно и не требует
// иконок в ассетах. На зум-старте водитель в любом случае видит
// сначала текст, потом стрелку.
const ARROW: Record<ManeuverType, string> = {
  left: '↰',
  right: '↱',
  'slight-left': '↖',
  'slight-right': '↗',
  'sharp-left': '⤴',
  'sharp-right': '⤵',
  straight: '↑',
  uturn: '↺',
  arrive: '🏁',
  depart: '↑',
};

function formatDistance(meters: number): string {
  if (meters < 50) return 'Сейчас';
  if (meters < 1000) {
    const rounded = Math.round(meters / 10) * 10;
    return `Через ${rounded} м`;
  }
  return `Через ${(meters / 1000).toFixed(1)} км`;
}

export default function NavigationBanner({
  maneuver,
  distanceMeters,
  instruction,
}: NavigationBannerProps): React.ReactElement {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.arrowBox}>
        <Text style={styles.arrow}>{ARROW[maneuver]}</Text>
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.distance}>{formatDistance(distanceMeters)}</Text>
        <Text style={styles.instruction} numberOfLines={2}>
          {instruction}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    gap: 14,
  },
  arrowBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: DriverColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: 36,
    color: DriverColors.background,
    fontWeight: '900' as const,
    lineHeight: 40,
  },
  textBlock: {
    flex: 1,
  },
  distance: {
    ...Typography.h3,
    color: DriverColors.textPrimary,
    fontWeight: '800' as const,
  },
  instruction: {
    ...Typography.caption,
    color: DriverColors.textSecondary,
    marginTop: 2,
  },
});
