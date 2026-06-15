import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Animated,
  Easing,
} from 'react-native';
import { Driver, ClientColors, FadeInView, PopInView, Radius, RatingBadge, Spacing, Haptics } from '@taxi/shared';
import Icon, { IconName } from './Icon';

interface DriverCardProps {
  driver: Driver;
  status: 'accepted' | 'arrived' | 'in_progress';
}

function getStatusText(status: DriverCardProps['status']): {
  label: string;
  color: string;
  bg: string;
  icon: IconName;
} {
  switch (status) {
    case 'accepted':
      return {
        label: 'В пути к вам',
        color: ClientColors.primaryDark,
        bg: ClientColors.primaryTint,
        icon: 'route',
      };
    case 'arrived':
      return {
        label: 'Водитель ожидает',
        color: ClientColors.secondaryDark,
        bg: ClientColors.secondaryTint,
        icon: 'pin',
      };
    case 'in_progress':
      return {
        label: 'В поездке',
        color: ClientColors.accent,
        bg: ClientColors.accentTint,
        icon: 'car',
      };
  }
}

// Декоративная машина справа — медленный slide-in справа-налево.
// useNativeDriver на translateX даёт плавность даже на дешёвых Android.
function CarIllustration(): React.ReactNode {
  const tx = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(tx, {
        toValue: 0,
        duration: 620,
        delay: 120,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 480,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [tx, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.carIllustration, { opacity, transform: [{ translateX: tx }] }]}
    >
      <Icon name="car-side" size={130} color={ClientColors.primary} />
    </Animated.View>
  );
}

export default function DriverCard({ driver, status }: DriverCardProps): React.ReactNode {
  const statusInfo = getStatusText(status);
  const initial = driver.name.charAt(0).toUpperCase();

  // Форматируем номер в группы как на реальном номерном знаке: «01KG123ABC»
  // → «01 KG 123 ABC». Если формат не парсится — оставляем как есть.
  const formatPlate = (plate: string): string => {
    const clean = plate.replace(/\s+/g, '').toUpperCase();
    const m = clean.match(/^(\d{2})([A-ZА-Я]{2})(\d{3})([A-ZА-Я]{2,3})$/);
    return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : plate;
  };

  const handleCall = (): void => {
    Haptics.light();
    Linking.openURL(`tel:${driver.phone}`);
  };

  return (
    <FadeInView style={styles.outer}>
      <View style={styles.card}>
        <CarIllustration />

        <FadeInView
          key={status}
          translateY={6}
          duration={280}
          style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}
        >
          <Icon name={statusInfo.icon} size={14} color={statusInfo.color} strokeWidth={2.4} />
          <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </FadeInView>

        <View style={styles.row}>
          <PopInView fromScale={0.85} duration={340}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            </View>
          </PopInView>

          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {driver.name}
            </Text>

            <View style={styles.metaRow}>
              <RatingBadge
                avg={driver.rating_avg ?? null}
                count={driver.rating_count ?? 0}
                size="compact"
                pillBackground={ClientColors.surfaceMuted}
                textColor={ClientColors.dark}
                emptyLabel="Новый"
              />
            </View>

            <Text style={styles.carModel} numberOfLines={1}>
              {driver.car_model}
            </Text>

            <FadeInView translateY={4} duration={280} delay={100}>
              <View style={styles.plate}>
                <View style={styles.plateFlag}>
                  <View style={styles.plateFlagBar} />
                  <Text style={styles.plateFlagText}>KG</Text>
                </View>
                <Text style={styles.plateNumber} numberOfLines={1}>
                  {formatPlate(driver.car_number)}
                </Text>
              </View>
            </FadeInView>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleCall}
          style={styles.phoneButton}
          accessibilityRole="button"
          accessibilityLabel={`Позвонить водителю ${driver.name}`}
          activeOpacity={0.88}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="phone" size={22} color={ClientColors.white} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: ClientColors.white,
    borderRadius: 22,
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: ClientColors.border,
    shadowColor: '#1a1a2e',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    overflow: 'hidden',
  },
  carIllustration: {
    position: 'absolute',
    right: -18,
    bottom: -10,
    opacity: 0.12,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.round,
    marginBottom: 14,
    gap: 6,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ClientColors.primaryTint,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: ClientColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ClientColors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: ClientColors.white,
    letterSpacing: -0.5,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 19,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  carModel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: ClientColors.textSecondary,
    marginTop: 8,
  },
  // Лицензионная плашка — белый фон, тонкая чёрная рамка, синий
  // KG-флаг слева как на реальных KG-номерах, моноширинный look
  // через letterSpacing + tabular-feel.
  plate: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1a1a1a',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  plateFlag: {
    backgroundColor: '#1B4FA0',
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 26,
  },
  plateFlagBar: {
    width: 14,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFD400',
    marginBottom: 2,
  },
  plateFlagText: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  plateNumber: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#1a1a1a',
    letterSpacing: 1.2,
  },
  phoneButton: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: ClientColors.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ClientColors.success,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
