import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DriverColors, ManeuverType, Typography } from '@taxi/shared';

interface NavigationBannerProps {
  maneuver: ManeuverType;
  distanceMeters: number;
  instruction: string;
}

// Cleaner SVG-glyph icons вместо юникод-arrow'ов. Стиль навигатора:
// яркая цветная стрелка манёвра поверх белой подложки,
// крупная дистанция, имя улицы под ней.
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICON: Record<ManeuverType, IconName> = {
  left: 'arrow-top-left',
  right: 'arrow-top-right',
  'slight-left': 'arrow-up-left',
  'slight-right': 'arrow-up-right',
  'sharp-left': 'arrow-u-down-left',
  'sharp-right': 'arrow-u-down-right',
  straight: 'arrow-up-bold',
  uturn: 'restore',
  arrive: 'flag-checkered',
  depart: 'arrow-up-bold',
};

function formatDistance(meters: number): string {
  if (meters < 50) return 'Сейчас';
  if (meters < 1000) {
    const rounded = Math.round(meters / 10) * 10;
    return `${rounded} м`;
  }
  return `${(meters / 1000).toFixed(1)} км`;
}

export default function NavigationBanner({
  maneuver,
  distanceMeters,
  instruction,
}: NavigationBannerProps): React.ReactElement {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.arrowBox}>
        <MaterialCommunityIcons
          name={ICON[maneuver]}
          size={42}
          color={DriverColors.background}
        />
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
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    gap: 12,
  },
  arrowBox: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: DriverColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  distance: {
    ...Typography.h2,
    color: DriverColors.textPrimary,
    fontWeight: '800' as const,
    lineHeight: 28,
  },
  instruction: {
    ...Typography.body,
    color: DriverColors.textSecondary,
    marginTop: 2,
  },
});
