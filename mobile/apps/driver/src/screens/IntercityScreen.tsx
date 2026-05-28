import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  DriverColors,
  Typography,
  getApiErrorMessage,
} from '@taxi/shared';
import {
  cancelIntercityTrip,
  claimIntercitySlot,
  closeIntercitySlot,
  completeIntercityTrip,
  getActiveIntercityTrip,
  getAvailableIntercitySlots,
  markPassengerNoShow,
  startIntercityTrip,
  type IntercityPassenger,
  type IntercitySlotOffer,
  type IntercityTrip,
} from '../api/intercity';

function formatDeparture(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const day = d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
    return `${day}, ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

export default function IntercityScreen(): React.ReactNode {
  const [slots, setSlots] = useState<IntercitySlotOffer[]>([]);
  const [activeTrip, setActiveTrip] = useState<IntercityTrip | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [t, s] = await Promise.all([
        getActiveIntercityTrip(),
        getAvailableIntercitySlots(),
      ]);
      setActiveTrip((prev) => {
        if (!t && !prev) return prev;
        if (
          t &&
          prev &&
          t.id === prev.id &&
          t.status === prev.status &&
          t.is_closed === prev.is_closed &&
          (t.seats_booked ?? 0) === (prev.seats_booked ?? 0)
        ) {
          return prev;
        }
        return t;
      });
      setSlots((prev) => {
        if (
          prev.length === s.length &&
          prev.every(
            (p, i) =>
              p.trip_id === s[i].trip_id &&
              p.booked_seats === s[i].booked_seats &&
              p.departure_at === s[i].departure_at,
          )
        ) {
          return prev;
        }
        return s;
      });
    } catch {
      // next tick retries
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const activeTripId = activeTrip?.id ?? null;
  useEffect(() => {
    if (activeTripId !== null) return;
    const interval = setInterval(reload, 15000);
    return () => clearInterval(interval);
  }, [activeTripId, reload]);

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const handleClaim = (slot: IntercitySlotOffer): void => {
    const free = slot.max_seats - slot.booked_seats;
    Alert.alert(
      'Взять этот рейс?',
      `${slot.from_region} → ${slot.to_region}\n` +
        `Выезд: ${formatDeparture(slot.departure_at)}\n` +
        `${slot.max_seats} мест × ${slot.price_per_seat} сом\n` +
        `Сейчас занято: ${slot.booked_seats}, свободно: ${free}`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Беру',
          onPress: async () => {
            setLoading(true);
            setError(null);
            try {
              const trip = await claimIntercitySlot(slot.trip_id);
              setActiveTrip(trip);
              setSlots([]);
            } catch (e: unknown) {
              setError(getApiErrorMessage(e, 'Не удалось взять рейс'));
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleClose = (): void => {
    if (!activeTrip) return;
    Alert.alert(
      'Закрыть слот?',
      'Подтверждайте если посадили пассажира вне приложения и машина уже полная — клиенты перестанут видеть этот рейс.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Закрыть',
          onPress: async () => {
            setLoading(true);
            try {
              const t = await closeIntercitySlot(activeTrip.id);
              setActiveTrip(t);
            } catch (e: unknown) {
              setError(getApiErrorMessage(e, 'Не удалось закрыть слот'));
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleStart = async (): Promise<void> => {
    if (!activeTrip) return;
    setLoading(true);
    try {
      const t = await startIntercityTrip(activeTrip.id);
      setActiveTrip(t);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Не удалось начать рейс'));
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = (): void => {
    if (!activeTrip) return;
    Alert.alert(
      'Завершить рейс?',
      'Подтверждайте только когда довезли всех пассажиров.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Завершить',
          onPress: async () => {
            if (!activeTrip) return;
            setLoading(true);
            try {
              const t = await completeIntercityTrip(activeTrip.id);
              setActiveTrip(t.status === 'completed' ? null : t);
            } catch (e: unknown) {
              setError(getApiErrorMessage(e, 'Не удалось завершить'));
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleCancel = (): void => {
    if (!activeTrip) return;
    Alert.alert(
      'Отменить рейс?',
      'Пассажиры получат уведомление об отмене. Используйте только если действительно не сможете выехать.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отменить рейс',
          style: 'destructive',
          onPress: async () => {
            if (!activeTrip) return;
            setLoading(true);
            try {
              const t = await cancelIntercityTrip(activeTrip.id);
              setActiveTrip(t.status === 'cancelled' ? null : t);
            } catch (e: unknown) {
              setError(getApiErrorMessage(e, 'Не удалось отменить'));
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleNoShow = (passenger: IntercityPassenger): void => {
    Alert.alert(
      'Пассажир не пришёл?',
      `Отметить ${passenger.name ?? 'пассажира'} как не пришёл — место освободится для других.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Не пришёл',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await markPassengerNoShow(passenger.id);
              await reload();
            } catch (e: unknown) {
              setError(getApiErrorMessage(e, 'Не удалось обновить'));
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Межгород</Text>
        <Text style={styles.headerSubtitle}>Открытые slot'ы из вашего района</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DriverColors.primary} />
        }
      >
        {error && (
          <View style={styles.errorPill}>
            <Text style={[Typography.caption, styles.errorText]}>⚠ {error}</Text>
          </View>
        )}

        {activeTrip && (
          <ActiveTripCard
            trip={activeTrip}
            loading={loading}
            onClose={handleClose}
            onStart={handleStart}
            onComplete={handleComplete}
            onCancel={handleCancel}
            onNoShow={handleNoShow}
          />
        )}

        {!activeTrip && slots.length === 0 && (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyIcon}>🚌</Text>
            <Text style={styles.emptyTitle}>Открытых рейсов сейчас нет</Text>
            <Text style={styles.emptyText}>
              Утренний cron создаёт slot'ы по активным расписаниям. Список обновляется каждые 15 сек.
            </Text>
          </View>
        )}

        {!activeTrip && slots.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Доступные slot'ы ({slots.length})</Text>
            {slots.map((slot) => (
              <SlotCard
                key={slot.trip_id}
                slot={slot}
                onClaim={() => handleClaim(slot)}
                loading={loading}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SlotCard({
  slot,
  onClaim,
  loading,
}: {
  slot: IntercitySlotOffer;
  onClaim: () => void;
  loading: boolean;
}): React.ReactNode {
  const free = slot.max_seats - slot.booked_seats;
  return (
    <View style={styles.offerCard}>
      <View style={styles.offerHeader}>
        <Text style={styles.offerRoute}>
          {slot.from_region} → {slot.to_region}
        </Text>
        <View style={styles.offerBadge}>
          <Text style={styles.offerBadgeText}>{formatDeparture(slot.departure_at)}</Text>
        </View>
      </View>

      <View style={styles.offerMetaRow}>
        <View style={styles.offerMetaCell}>
          <Text style={styles.offerMetaLabel}>Мест всего</Text>
          <Text style={styles.offerMetaValue}>{slot.max_seats}</Text>
        </View>
        <View style={styles.offerMetaCell}>
          <Text style={styles.offerMetaLabel}>Уже занято</Text>
          <Text style={styles.offerMetaValue}>{slot.booked_seats}</Text>
        </View>
        <View style={[styles.offerMetaCell, styles.offerMetaTotal]}>
          <Text style={styles.offerMetaLabel}>Свободно</Text>
          <Text style={[styles.offerMetaValue, styles.offerMetaTotalValue]}>{free}</Text>
        </View>
      </View>

      <Text style={styles.priceLine}>
        {slot.price_per_seat} сом за место · максимум {slot.total_revenue.toLocaleString()} сом
      </Text>

      <TouchableOpacity
        style={[styles.acceptButton, loading && { opacity: 0.5 }]}
        onPress={onClaim}
        disabled={loading}
        activeOpacity={0.9}
      >
        <Text style={styles.acceptButtonText}>Беру этот рейс</Text>
      </TouchableOpacity>
    </View>
  );
}

function ActiveTripCard({
  trip,
  loading,
  onClose,
  onStart,
  onComplete,
  onCancel,
  onNoShow,
}: {
  trip: IntercityTrip;
  loading: boolean;
  onClose: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onNoShow: (p: IntercityPassenger) => void;
}): React.ReactNode {
  const isClaimed = trip.status === 'claimed';
  const isReady = trip.status === 'ready';
  const isEnRoute = trip.status === 'en_route';
  const seatsBooked = trip.seats_booked ?? 0;
  const seatsFree = trip.max_seats - seatsBooked;

  let statusLabel = '';
  if (isClaimed) statusLabel = trip.is_closed ? 'Слот закрыт' : 'Принят — ждём пассажиров';
  else if (isReady) statusLabel = 'Готов — все места заняты';
  else if (isEnRoute) statusLabel = 'В пути';

  return (
    <View style={styles.activeCard}>
      <View style={styles.activeHeader}>
        <Text style={styles.activeRoute}>
          {trip.route?.from_region} → {trip.route?.to_region}
        </Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{statusLabel}</Text>
        </View>
      </View>

      <Text style={styles.activeMeta}>
        Выезд: {formatDeparture(trip.departure_at)} · занято {seatsBooked}/{trip.max_seats} · свободно{' '}
        {seatsFree} · {trip.price_per_seat} сом/место
      </Text>

      <Text style={styles.passengersTitle}>Пассажиры ({trip.passengers?.length ?? 0})</Text>

      {(!trip.passengers || trip.passengers.length === 0) && (
        <Text style={styles.passengersEmpty}>Пока никто не забронировал.</Text>
      )}

      {trip.passengers?.map((p) => (
        <View key={p.id} style={styles.passengerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.passengerName}>
              {p.name ?? '—'} {p.seats_count > 1 ? `(${p.seats_count} мест)` : ''}
            </Text>
            {p.pickup_address && (
              <Text style={styles.passengerAddress}>📍 {p.pickup_address}</Text>
            )}
          </View>
          {p.phone && (
            <TouchableOpacity
              style={styles.passengerCallButton}
              onPress={() => Linking.openURL(`tel:${p.phone}`)}
              activeOpacity={0.85}
            >
              <Text style={styles.passengerCallText}>📞</Text>
            </TouchableOpacity>
          )}
          {(isClaimed || isReady) && (
            <TouchableOpacity
              style={styles.passengerNoShowButton}
              onPress={() => onNoShow(p)}
              activeOpacity={0.85}
            >
              <Text style={styles.passengerNoShowText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* Action row: close (when there's room) + start (when ready) +
          complete (when en_route) + cancel (any pre-departure phase). */}
      {isClaimed && !trip.is_closed && seatsFree > 0 && (
        <TouchableOpacity
          style={[styles.secondaryButton, loading && { opacity: 0.5 }]}
          onPress={onClose}
          disabled={loading}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryButtonText}>Закрыть слот (машина полная)</Text>
        </TouchableOpacity>
      )}

      {(isClaimed || isReady) && (
        <TouchableOpacity
          style={[styles.actionButton, loading && { opacity: 0.5 }]}
          onPress={onStart}
          disabled={loading}
          activeOpacity={0.9}
        >
          <Text style={styles.actionButtonText}>Выехал за пассажирами</Text>
        </TouchableOpacity>
      )}

      {isEnRoute && (
        <TouchableOpacity
          style={[styles.actionButton, loading && { opacity: 0.5 }]}
          onPress={onComplete}
          disabled={loading}
          activeOpacity={0.9}
        >
          <Text style={styles.actionButtonText}>Завершить рейс</Text>
        </TouchableOpacity>
      )}

      {(isClaimed || isReady) && (
        <TouchableOpacity
          style={[styles.dangerButton, loading && { opacity: 0.5 }]}
          onPress={onCancel}
          disabled={loading}
          activeOpacity={0.9}
        >
          <Text style={styles.dangerButtonText}>Отменить рейс</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DriverColors.background },
  header: {
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 50) + 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: DriverColors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: DriverColors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: DriverColors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: DriverColors.textSecondary,
    marginTop: 2,
  },
  scrollContent: { padding: 16, paddingBottom: 80 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: DriverColors.textSecondary,
    marginBottom: 10,
    paddingLeft: 4,
  },
  errorPill: {
    backgroundColor: '#FFF1F1',
    borderColor: '#FFD4D4',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: { color: DriverColors.danger },
  emptyBlock: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: DriverColors.textPrimary,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: DriverColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  offerCard: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: DriverColors.primary,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  offerRoute: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800' as const,
    color: DriverColors.textPrimary,
  },
  offerBadge: {
    backgroundColor: DriverColors.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  offerBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: DriverColors.primaryDark,
  },
  offerMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  offerMetaCell: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: DriverColors.background,
    alignItems: 'center',
  },
  offerMetaTotal: {
    backgroundColor: DriverColors.backgroundSecondary,
  },
  offerMetaLabel: {
    fontSize: 11,
    color: DriverColors.textSecondary,
    fontWeight: '600' as const,
  },
  offerMetaValue: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: DriverColors.textPrimary,
    marginTop: 4,
  },
  offerMetaTotalValue: {
    color: DriverColors.primaryDark,
  },
  priceLine: {
    fontSize: 13,
    color: DriverColors.textSecondary,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  acceptButton: {
    height: 50,
    borderRadius: 24,
    backgroundColor: DriverColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: DriverColors.white,
    letterSpacing: 0.2,
  },
  activeCard: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: DriverColors.primary,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  activeRoute: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800' as const,
    color: DriverColors.textPrimary,
  },
  statusPill: {
    backgroundColor: DriverColors.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: DriverColors.primaryDark,
  },
  activeMeta: {
    fontSize: 13,
    color: DriverColors.textSecondary,
    marginBottom: 14,
  },
  passengersTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: DriverColors.textSecondary,
    marginBottom: 8,
  },
  passengersEmpty: {
    fontSize: 13,
    color: DriverColors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DriverColors.border,
    gap: 8,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: DriverColors.textPrimary,
  },
  passengerAddress: {
    fontSize: 12,
    color: DriverColors.textSecondary,
    marginTop: 2,
  },
  passengerCallButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DriverColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerCallText: {
    fontSize: 18,
  },
  passengerNoShowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE4E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerNoShowText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: DriverColors.danger,
  },
  actionButton: {
    marginTop: 14,
    height: 54,
    borderRadius: 27,
    backgroundColor: DriverColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: DriverColors.white,
    letterSpacing: 0.2,
  },
  secondaryButton: {
    marginTop: 14,
    height: 48,
    borderRadius: 24,
    backgroundColor: DriverColors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: DriverColors.primaryDark,
  },
  dangerButton: {
    marginTop: 10,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD4D4',
    backgroundColor: '#FFF8F8',
  },
  dangerButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: DriverColors.danger,
  },
});
