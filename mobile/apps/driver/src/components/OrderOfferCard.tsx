import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Modal,
  Platform,
  StyleSheet,
  AppState,
} from 'react-native';
import { Order, DeclineReason, DriverColors, Typography } from '@taxi/shared';

// Lazy-required so iOS / older builds without these modules still render.
let OfferOverlay: typeof import('../../modules/offer-overlay/src') | null = null;
if (Platform.OS === 'android') {
  try {
    OfferOverlay = require('../../modules/offer-overlay/src');
  } catch {
    OfferOverlay = null;
  }
}

interface OrderOfferCardProps {
  order: Order;
  onAccept: () => void;
  onDecline: (reason: DeclineReason) => void;
  // Defaults to 30 s to match the server-side OfferTimeoutJob (45 s for
  // inter-district orders). Caller can override; the actual countdown
  // is also adjusted down by the elapsed time since order.offered_at so
  // the in-card timer never goes longer than what the server still
  // accepts.
  countdownSeconds?: number;
  // Optimistic UI: parent passes true between tap and API resolution so
  // the buttons render disabled with "Принимаю..." / "Отказываю..."
  // instead of a spinner. Removes the awkward "did my tap register"
  // pause on flaky networks.
  loading?: boolean;
}

const REASON_OPTIONS: { value: DeclineReason; label: string }[] = [
  { value: 'too_far', label: 'Слишком далеко' },
  { value: 'wrong_district', label: 'Не мой район' },
  { value: 'client_no_answer', label: 'Клиент не отвечает' },
  { value: 'personal', label: 'Личная причина' },
];

// Window at which the "hurry up" red pulse kicks in.
const WARNING_THRESHOLD = 5;

export default function OrderOfferCard({
  order,
  onAccept,
  onDecline,
  countdownSeconds = 30,
  loading = false,
}: OrderOfferCardProps): React.ReactNode {
  // Compute the initial countdown from the server's offered_at — if a
  // few seconds elapsed in flight (push delivery, app cold-start), the
  // in-card timer starts at the actual remaining window instead of a
  // fresh 30 s. Without this the driver could accept at "5 s left" on
  // their card while the server already cancelled the offer 5 s ago.
  const initialRemaining = React.useMemo(() => {
    if (!order.offered_at) return countdownSeconds;
    const offeredMs = new Date(order.offered_at).getTime();
    if (!Number.isFinite(offeredMs)) return countdownSeconds;
    const elapsed = Math.max(0, Math.floor((Date.now() - offeredMs) / 1000));
    return Math.max(1, countdownSeconds - elapsed);
  }, [order.offered_at, countdownSeconds]);

  const [remaining, setRemaining] = useState(initialRemaining);
  const [reasonSheetOpen, setReasonSheetOpen] = useState(false);
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const declineCalledRef = useRef(false);

  // Hide the SYSTEM_ALERT_WINDOW overlay ONLY if the driver is actively
  // looking at this in-app card (foreground). React keeps the in-app
  // card mounted in the tree even when the app is in background, so an
  // unconditional hide here was killing the freshly-shown overlay every
  // time a new offer arrived while the driver was in social media —
  // the user-visible "every other order disappears immediately" bug.
  useEffect(() => {
    if (AppState.currentState === 'active') {
      OfferOverlay?.hideOfferOverlay();
    }
  }, []);

  // Note: TTS announcement for new offers was removed — it competed
  // with the alarm sound + visual card in a way that intermittently
  // suppressed both (every-other-offer the card would skip and only
  // the voice would play). Cancellation and arrival announcements
  // stay because they fire in isolation, no competing surfaces.

  // Auto-decline at 0 with a "last 5 s" red-pulse warning so the
  // driver can see the deadline closing and react instead of having
  // the card vanish silently. Matches Yandex/Bolt UX: predictable
  // expiry, not a phantom offer left dangling.
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!declineCalledRef.current) {
            declineCalledRef.current = true;
            // Auto-timeout uses 'personal' on the client; server-side
            // timeouts (OfferTimeoutJob) are excluded from penalty.
            onDecline('personal');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onDecline]);

  useEffect(() => {
    opacityAnim.setValue(remaining > 0 ? remaining / countdownSeconds : 0);
  }, [remaining, countdownSeconds, opacityAnim]);

  // "Hurry up" red border pulse in the final 5 seconds.
  useEffect(() => {
    if (remaining > WARNING_THRESHOLD || remaining <= 0) {
      pulseAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [remaining, pulseAnim]);

  const warningOpacity = pulseAnim;
  const inWarning = remaining > 0 && remaining <= WARNING_THRESHOLD;

  const handlePickReason = (reason: DeclineReason): void => {
    setReasonSheetOpen(false);
    if (!declineCalledRef.current) {
      declineCalledRef.current = true;
      onDecline(reason);
    }
  };

  return (
    <View style={styles.container}>
      {inWarning && (
        <Animated.View
          pointerEvents="none"
          style={[styles.warningOutline, { opacity: warningOpacity }]}
        />
      )}
      <Animated.View
        style={[
          styles.countdownCircle,
          { opacity: opacityAnim },
          inWarning && styles.countdownCircleWarning,
        ]}
      >
        <Text
          style={[
            Typography.h2,
            { color: inWarning ? DriverColors.danger : DriverColors.primary },
          ]}
        >
          {remaining}
        </Text>
      </Animated.View>

      <View style={styles.badgeRow}>
        <View
          style={[
            styles.badge,
            order.is_inter_district ? styles.badgeRegional : styles.badgeVillage,
          ]}
        >
          <Text style={[Typography.caption, styles.badgeText]}>
            {order.is_inter_district
              ? `Межрайон${order.region ? ` · ${order.region.name}` : ''}`
              : 'В селе'}
          </Text>
        </View>
        {typeof order.eta_minutes === 'number' && (
          <View style={[styles.badge, styles.badgeEta]}>
            <Text style={[Typography.caption, styles.badgeText]}>
              ~{order.eta_minutes} мин до клиента
            </Text>
          </View>
        )}
      </View>

      <Text style={[Typography.caption, { color: DriverColors.textMuted, marginBottom: 4 }]}>
        Адрес подачи
      </Text>
      <Text style={[Typography.body, { color: DriverColors.textPrimary, marginBottom: 12 }]}>
        {order.pickup_address || 'Геолокация клиента'}
      </Text>

      {order.is_inter_district && (
        <>
          <Text style={[Typography.caption, { color: DriverColors.textMuted, marginBottom: 4 }]}>
            Куда
          </Text>
          <Text style={[Typography.body, { color: DriverColors.textPrimary, marginBottom: 12 }]}>
            {order.dropoff_address || order.region?.name || '—'}
          </Text>
        </>
      )}

      {order.client_comment && (
        <View style={styles.commentBox}>
          <Text style={styles.commentEmoji}>💬</Text>
          <Text style={[Typography.body, styles.commentText]}>
            {order.client_comment}
          </Text>
        </View>
      )}

      <Text style={[Typography.h1, { color: DriverColors.primary, marginBottom: 20 }]}>
        {order.price} сом
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton, loading && styles.buttonLoading]}
          onPress={onAccept}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={[Typography.button, { color: DriverColors.white }]}>
            {loading ? 'Принимаю...' : 'Принять'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.declineButton, loading && styles.buttonLoading]}
          onPress={() => setReasonSheetOpen(true)}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={[Typography.button, { color: DriverColors.textSecondary }]}>
            Отказаться
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={reasonSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReasonSheetOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.sheetBackdrop}
          onPress={() => setReasonSheetOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <Text style={[Typography.h3, { marginBottom: 16, color: DriverColors.textPrimary }]}>
              Причина отказа
            </Text>
            {REASON_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={styles.reasonOption}
                onPress={() => handlePickReason(opt.value)}
              >
                <Text style={[Typography.body, { color: DriverColors.textPrimary }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
  },
  // Absolute, positioned over the whole card; pointerEvents="none" on
  // the Animated.View so taps still reach the buttons underneath.
  warningOutline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: DriverColors.danger,
  },
  countdownCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: DriverColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  countdownCircleWarning: {
    borderWidth: 2,
    borderColor: DriverColors.danger,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeVillage: {
    backgroundColor: DriverColors.primary,
  },
  badgeRegional: {
    backgroundColor: DriverColors.success,
  },
  badgeEta: {
    backgroundColor: DriverColors.cardBackground,
    borderWidth: 1,
    borderColor: DriverColors.border,
  },
  badgeText: {
    color: DriverColors.textPrimary,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  commentBox: {
    flexDirection: 'row',
    backgroundColor: DriverColors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  commentEmoji: {
    fontSize: 16,
  },
  commentText: {
    color: DriverColors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: DriverColors.primary,
  },
  declineButton: {
    backgroundColor: DriverColors.cardBackground,
    borderWidth: 1,
    borderColor: DriverColors.border,
  },
  buttonLoading: {
    opacity: 0.6,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: DriverColors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  reasonOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: DriverColors.border,
  },
});
