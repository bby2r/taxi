import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ActionButton, DriverColors, Typography } from '@taxi/shared';
import {
  hasOverlayPermission,
  isIgnoringBatteryOptimizations,
  isOfferOverlayAvailable,
  openOverlaySettings,
  requestIgnoreBatteryOptimizations,
} from '../../modules/offer-overlay/src';

// expo-notifications might not be in older bundles
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

interface PermissionStatus {
  overlay: boolean;
  notifications: boolean;
  battery: boolean;
}

/**
 * Driver-side permission gate. Shown before "На линию" engages so the
 * driver doesn't sit on shift with the overlay grant missing (offer
 * invisible) or with battery optimisation killing the foreground
 * service (offers silently dropped while the OS thinks the app is
 * sleeping).
 *
 * Three checks:
 *   - Display over other apps (SYSTEM_ALERT_WINDOW)
 *   - Notifications permission (Android 13+ POST_NOTIFICATIONS)
 *   - Battery optimisation excluded
 *
 * On iOS the overlay check no-ops to true (no SYSTEM_ALERT_WINDOW
 * concept on iOS) and battery check is irrelevant — the gate stays
 * transparent there.
 */
interface PermissionGateProps {
  visible: boolean;
  onResolved: () => void;
  onDismiss: () => void;
}

export default function PermissionGate({
  visible,
  onResolved,
  onDismiss,
}: PermissionGateProps): React.ReactElement | null {
  const [status, setStatus] = useState<PermissionStatus>({
    overlay: true,
    notifications: true,
    battery: true,
  });

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setStatus({ overlay: true, notifications: true, battery: true });
      return;
    }
    const overlay = isOfferOverlayAvailable() ? hasOverlayPermission() : true;
    const battery = isIgnoringBatteryOptimizations();
    let notifications = true;
    if (Notifications) {
      try {
        const perm = await Notifications.getPermissionsAsync();
        notifications = perm.granted || perm.ios?.status === 3;
      } catch {
        // ignore — assume granted
      }
    }
    setStatus({ overlay, notifications, battery });
  }, []);

  useEffect(() => {
    if (visible) {
      void refresh();
    }
  }, [visible, refresh]);

  // If user returns from system settings, re-check so the row turns green.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [visible, refresh]);

  const allGranted = status.overlay && status.notifications && status.battery;

  // Auto-dismiss + proceed once everything is green.
  // Ref guard: callers pass an inline arrow as onResolved, so its
  // identity changes every parent render. Without the ref, this effect
  // re-fired on every render while the gate stayed mounted → onResolved
  // → performToggle → multiple back-to-back POSTs to /driver/go-online,
  // which the server rate-limited and the driver saw as flash errors.
  const resolvedRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      resolvedRef.current = false;
      return;
    }
    if (allGranted && !resolvedRef.current) {
      resolvedRef.current = true;
      onResolved();
    }
  }, [visible, allGranted, onResolved]);

  const requestNotifications = useCallback(async () => {
    if (!Notifications) return;
    try {
      await Notifications.requestPermissionsAsync();
    } catch {
      // ignore
    }
    await refresh();
  }, [refresh]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={[Typography.h2, styles.title]}>Нужны разрешения</Text>
          <Text style={[Typography.body, styles.subtitle]}>
            Без них заказы не будут приходить, когда приложение свёрнуто
          </Text>

          <PermissionRow
            label="Показывать поверх других приложений"
            description="Чтобы карточка заказа всплывала даже когда ты в другом приложении"
            granted={status.overlay}
            onFix={openOverlaySettings}
          />

          <PermissionRow
            label="Уведомления"
            description="Чтобы получать оффер когда экран заблокирован"
            granted={status.notifications}
            onFix={requestNotifications}
          />

          <PermissionRow
            label="Не оптимизировать батарею"
            description="Чтобы система не убивала приложение в фоне"
            granted={status.battery}
            onFix={requestIgnoreBatteryOptimizations}
          />

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onDismiss}
              style={styles.skipButton}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={[Typography.body, { color: DriverColors.textMuted }]}>Позже</Text>
            </TouchableOpacity>
            <ActionButton
              title={allGranted ? 'Готово' : 'Проверить'}
              onPress={() => {
                void refresh();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface PermissionRowProps {
  label: string;
  description: string;
  granted: boolean;
  onFix: () => void;
}

function PermissionRow({ label, description, granted, onFix }: PermissionRowProps): React.ReactElement {
  return (
    <View style={styles.row}>
      <View style={[styles.statusBadge, granted ? styles.statusBadgeOk : styles.statusBadgeWarn]}>
        <Feather
          name={granted ? 'check' : 'alert-triangle'}
          size={15}
          color={granted ? DriverColors.success : DriverColors.danger}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={[Typography.bodyBold, { color: DriverColors.textPrimary }]}>{label}</Text>
        <Text style={[Typography.caption, { color: DriverColors.textMuted, marginTop: 2 }]}>
          {description}
        </Text>
      </View>
      {!granted && (
        <TouchableOpacity
          onPress={onFix}
          style={styles.fixButton}
          activeOpacity={0.7}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Открыть настройки: ${label}`}
        >
          <Text style={[Typography.caption, { color: DriverColors.primary, fontWeight: '700' }]}>
            Открыть
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 20,
    padding: 20,
  },
  title: {
    color: DriverColors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    color: DriverColors.textMuted,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: DriverColors.border,
  },
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DriverColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusBadgeOk: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
  },
  statusBadgeWarn: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
  },
  rowText: {
    flex: 1,
  },
  fixButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: DriverColors.background,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
