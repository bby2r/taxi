import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Pressable,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { DriverColors, Icon, Typography } from '@taxi/shared';
import type { Order, Route } from '@taxi/shared';

interface DriverNavigationBarProps {
  phase: 'active' | 'arrived' | 'in_progress' | 'completed';
  order: Order;
  route: Route | null;
  distanceToPickupMeters?: number | null;
  canArrive?: boolean;
  loading: boolean;
  onPrimary: () => void;
  onExpand: () => void;
  // Завершённая фаза показывает «Готово» — кнопка просто закрывает sheet.
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} мин`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} м`;
  }
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} км`;
}

function PrimaryButton({
  title,
  disabled,
  loading,
  onPress,
}: {
  title: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}): React.ReactNode {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={() => {
        if (disabled || loading) return;
        Vibration.vibrate(Platform.OS === 'android' ? 25 : undefined);
        onPress();
      }}
      onPressIn={() => {
        Animated.spring(scale, {
          toValue: 0.96,
          useNativeDriver: true,
          damping: 18,
          stiffness: 240,
        }).start();
      }}
      onPressOut={() => {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 16,
          stiffness: 200,
        }).start();
      }}
      android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[styles.primaryWrap, disabled && styles.primaryWrapDisabled]}
    >
      <Animated.View
        style={[styles.primary, { transform: [{ scale }] }]}
      >
        <Text style={styles.primaryText} numberOfLines={1}>
          {loading ? '...' : title}
        </Text>
        {!loading && (
          <Icon name="navigation" size={16} color={DriverColors.background} />
        )}
      </Animated.View>
    </Pressable>
  );
}

function CircleIconButton({
  iconName,
  color,
  onPress,
  accessibilityLabel,
}: {
  iconName: 'phone';
  color: string;
  onPress: () => void;
  accessibilityLabel: string;
}): React.ReactNode {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={() => {
        Vibration.vibrate(Platform.OS === 'android' ? 20 : undefined);
        onPress();
      }}
      onPressIn={() => {
        Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }).start();
      }}
      onPressOut={() => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
      }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[styles.circleBtn, { backgroundColor: color, transform: [{ scale }] }]}
      >
        <Icon name={iconName} size={18} color={DriverColors.white} />
      </Animated.View>
    </Pressable>
  );
}

export default function DriverNavigationBar({
  phase,
  order,
  route,
  distanceToPickupMeters,
  canArrive,
  loading,
  onPrimary,
  onExpand,
}: DriverNavigationBarProps): React.ReactNode {
  const eta = route && (phase === 'active' || phase === 'in_progress')
    ? formatDuration(route.durationSeconds)
    : null;
  const distance = route && (phase === 'active' || phase === 'in_progress')
    ? formatDistance(route.distanceMeters)
    : null;

  const primaryLabel =
    phase === 'active' ? 'Прибыл'
      : phase === 'arrived' ? 'Начать'
        : phase === 'in_progress' ? 'Завершить'
          : 'Готово';

  const primaryDisabled = phase === 'active' && !canArrive;

  const subtitle =
    phase === 'active' ? (order.pickup_address ?? 'Точка подачи')
      : phase === 'arrived' ? 'Клиент уведомлён'
        : phase === 'in_progress' ? (order.dropoff_address ?? 'В пути')
          : `${order.price} сом`;

  const showCallButton = phase === 'active' || phase === 'arrived';

  // Pulse-ring у status-точки рядом с именем клиента — лёгкое движение
  // даёт ощущение «живой» панели в навигации.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase === 'completed') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  return (
    <View style={styles.container}>
      {/* Tap-target для разворота sheet'а — занимает левую/центральную часть,
          кнопки справа имеют свои pressable'ы. */}
      <TouchableOpacity
        onPress={onExpand}
        activeOpacity={0.85}
        style={styles.infoBlock}
        accessibilityRole="button"
        accessibilityLabel="Подробности заказа"
      >
        <View style={styles.statusDotWrap}>
          <Animated.View
            style={[
              styles.statusDot,
              { backgroundColor: DriverColors.primary, opacity: pulse },
            ]}
          />
        </View>

        <View style={styles.textBlock}>
          {eta ? (
            <View style={styles.etaRow}>
              <Text style={styles.eta} numberOfLines={1}>{eta}</Text>
              {distance && (
                <Text style={styles.distance} numberOfLines={1}>· {distance}</Text>
              )}
            </View>
          ) : (
            <Text style={styles.eta} numberOfLines={1}>
              {phase === 'arrived' ? 'Вы на месте' : phase === 'completed' ? 'Завершено' : ''}
            </Text>
          )}
          <Text style={styles.subtitle} numberOfLines={1}>
            {phase === 'active' ? (order.client.name ?? 'Клиент') : subtitle}
          </Text>
        </View>
      </TouchableOpacity>

      {showCallButton && order.client.phone && (
        <CircleIconButton
          iconName="phone"
          color={DriverColors.success}
          onPress={() => Linking.openURL(`tel:${order.client.phone}`)}
          accessibilityLabel={`Позвонить клиенту ${order.client.name}`}
        />
      )}

      <PrimaryButton
        title={primaryLabel}
        disabled={primaryDisabled}
        loading={loading}
        onPress={onPrimary}
      />

      {phase === 'active' && distanceToPickupMeters !== null && distanceToPickupMeters !== undefined && !canArrive && (
        <View style={styles.distanceTooltip} pointerEvents="none">
          <Text style={styles.distanceTooltipText}>
            {Math.round(distanceToPickupMeters)} м до клиента
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  infoBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingRight: 4,
  },
  statusDotWrap: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  eta: {
    ...Typography.h3,
    color: DriverColors.primary,
    letterSpacing: -0.3,
  },
  distance: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: DriverColors.textMuted,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: DriverColors.textSecondary,
    marginTop: 2,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  primaryWrap: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  primaryWrapDisabled: {
    opacity: 0.4,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: DriverColors.primary,
    shadowColor: DriverColors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  primaryText: {
    ...Typography.button,
    color: DriverColors.background,
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
  },
  distanceTooltip: {
    position: 'absolute',
    top: -22,
    right: 12,
    backgroundColor: DriverColors.background,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: DriverColors.border,
  },
  distanceTooltipText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: DriverColors.textPrimary,
  },
});
