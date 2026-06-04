import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DriverColors, ManeuverType, Route, Typography, formatMeters } from '@taxi/shared';

interface NavigationHudProps {
  maneuver: ManeuverType;
  distanceToManeuverMeters: number;
  instruction: string;
  // route опционален — пока маршрут не построился, ETA-секция не
  // рендерится. Один объект вместо двух скаляров, чтобы пара
  // duration+distance не разъезжалась.
  route?: Route | null;
}

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

function formatDistanceManeuver(meters: number): string {
  // Round to 10м и "Сейчас" <50м — навигатор-специфично, в отличие
  // от общего formatMeters в shared.
  if (meters < 50) return 'Сейчас';
  if (meters < 1000) return `${Math.round(meters / 10) * 10} м`;
  return formatMeters(meters);
}

function formatArrival(durationSeconds: number): string {
  const arrival = new Date(Date.now() + durationSeconds * 1000);
  return `${String(arrival.getHours()).padStart(2, '0')}:${String(
    arrival.getMinutes(),
  ).padStart(2, '0')}`;
}

export default function NavigationHud({
  maneuver,
  distanceToManeuverMeters,
  instruction,
  route,
}: NavigationHudProps): React.ReactElement {
  const showEta = route != null && route.durationSeconds > 0;

  return (
    <View style={styles.card} pointerEvents="none">
      <View style={styles.maneuverRow}>
        <View style={styles.arrowBox}>
          <MaterialCommunityIcons
            name={ICON[maneuver]}
            size={42}
            color={DriverColors.background}
          />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.distance}>
            {formatDistanceManeuver(distanceToManeuverMeters)}
          </Text>
          <Text style={styles.instruction} numberOfLines={2}>
            {instruction}
          </Text>
        </View>
      </View>

      {showEta && (
        <>
          <View style={styles.divider} />
          <View style={styles.etaRow}>
            <View style={styles.etaCell}>
              <Text style={styles.etaValue}>
                {Math.max(1, Math.round(route.durationSeconds / 60))}
              </Text>
              <Text style={styles.etaUnit}>мин</Text>
            </View>
            <View style={styles.etaVDivider} />
            <View style={styles.etaCell}>
              <Text style={styles.etaValue}>{formatArrival(route.durationSeconds)}</Text>
              <Text style={styles.etaUnit}>прибытие</Text>
            </View>
            <View style={styles.etaVDivider} />
            <View style={styles.etaCell}>
              <Text style={styles.etaValue}>{formatMeters(route.distanceMeters)}</Text>
              <Text style={styles.etaUnit}> </Text>
            </View>
          </View>
        </>
      )}

      <View style={styles.ledAccent} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 20,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    overflow: 'hidden',
  },
  maneuverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DriverColors.border,
    marginHorizontal: 14,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  etaCell: {
    flex: 1,
    alignItems: 'center',
  },
  etaValue: {
    ...Typography.h3,
    color: DriverColors.textPrimary,
    fontWeight: '800' as const,
    lineHeight: 22,
    // tabular nums — цифры не «прыгают» когда минута меняется с
    // одного знака на два (особенно заметно на 9→10).
    fontVariant: ['tabular-nums'] as const,
  },
  etaUnit: {
    ...Typography.caption,
    color: DriverColors.textMuted,
    marginTop: 2,
  },
  etaVDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: DriverColors.border,
    marginHorizontal: 4,
  },
  ledAccent: {
    height: 2,
    width: '70%',
    alignSelf: 'center',
    backgroundColor: DriverColors.primary,
    opacity: 0.55,
    borderRadius: 1,
    marginBottom: 6,
  },
});
