import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import {
  useLocation,
  ClientColors,
  EmptyState,
  ErrorPill,
  Radius,
  Spacing,
  Typography,
  formatDeparture,
  getApiErrorMessage,
} from '@taxi/shared';
import Icon from '../components/Icon';
import {
  cancelIntercityBooking,
  createIntercityBooking,
  getActiveIntercityBooking,
  getIntercitySlots,
  type IntercityBooking,
  type IntercitySlot,
} from '../api/intercity';

const formatDepartureWithWeekday = (iso: string): string =>
  formatDeparture(iso, { weekday: true });

export default function IntercityScreen(): React.ReactNode {
  const location = useLocation();
  const [slots, setSlots] = useState<IntercitySlot[]>([]);
  const [booking, setBooking] = useState<IntercityBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<IntercitySlot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const lat = location.hasRealFix ? location.latitude : undefined;
      const lng = location.hasRealFix ? location.longitude : undefined;
      const [s, b] = await Promise.all([
        getIntercitySlots(lat, lng),
        getActiveIntercityBooking(),
      ]);
      setSlots((prev) => {
        if (
          prev.length === s.length &&
          prev.every(
            (p, i) =>
              p.trip_id === s[i].trip_id &&
              p.booked_seats === s[i].booked_seats &&
              p.has_driver === s[i].has_driver,
          )
        ) {
          return prev;
        }
        return s;
      });
      setBooking((prev) => {
        if (!b && !prev) return prev;
        if (
          b &&
          prev &&
          b.id === prev.id &&
          b.status === prev.status &&
          (b.trip?.status ?? null) === (prev.trip?.status ?? null) &&
          b.seats_booked_total === prev.seats_booked_total
        ) {
          return prev;
        }
        return b;
      });
    } catch {
      // ignore — пользователь увидит пустой список и сможет потянуть
      // вниз чтобы перезагрузить
    }
  }, [location.hasRealFix, location.latitude, location.longitude]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Поллинг бронирования — без пушей ловим момент когда водитель
  // claim'нет slot или выедет. Slot list скрыт пока есть booking,
  // фетчить его в тике — пустая работа.
  const bookingId = booking?.id ?? null;
  const bookingStatus = booking?.status ?? null;
  useEffect(() => {
    if (bookingId === null || bookingStatus === 'completed' || bookingStatus === 'cancelled') {
      return;
    }
    const tick = async (): Promise<void> => {
      try {
        const fresh = await getActiveIntercityBooking();
        setBooking((prev) => {
          if (!fresh && !prev) return prev;
          if (
            fresh &&
            prev &&
            fresh.id === prev.id &&
            fresh.status === prev.status &&
            (fresh.trip?.status ?? null) === (prev.trip?.status ?? null) &&
            fresh.seats_booked_total === prev.seats_booked_total
          ) {
            return prev;
          }
          return fresh;
        });
      } catch {
        // next tick retries
      }
    };
    const interval = setInterval(tick, 8000);
    return () => clearInterval(interval);
  }, [bookingId, bookingStatus]);

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const handleBook = async (slot: IntercitySlot, seats: number): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const b = await createIntercityBooking({
        trip_id: slot.trip_id,
        seats_count: seats,
      });
      setBooking(b);
      setSelectedSlot(null);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Не удалось забронировать'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (): Promise<void> => {
    if (!booking) return;
    Alert.alert(
      'Отменить бронь?',
      'Если водитель уже принял — он получит уведомление, в машине освободится место.',
      [
        { text: 'Нет', style: 'cancel' },
        {
          text: 'Да, отменить',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await cancelIntercityBooking(booking.id);
              setBooking(null);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Межгород</Text>
        <Text style={styles.headerSubtitle}>Рейсы из вашего района</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ClientColors.primary} />}
      >
        {error && (
          <ErrorPill
            message={error}
            leading={
              <Icon name="alert" size={18} color={ClientColors.danger} strokeWidth={2.2} />
            }
          />
        )}

        {booking && <ActiveBookingCard booking={booking} onCancel={handleCancel} loading={loading} />}

        {!booking && slots.length === 0 && (
          <EmptyState
            icon={<Icon name="route" size={36} color={ClientColors.primary} strokeWidth={1.8} />}
            title="Рейсов из вашего села пока нет"
            subtitle="Потяните вниз, чтобы обновить список."
          />
        )}

        {!booking && slots.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Ближайшие рейсы</Text>
            {slots.map((s) => (
              <SlotCard key={s.trip_id} slot={s} onPress={() => setSelectedSlot(s)} />
            ))}
          </>
        )}
      </ScrollView>

      <BookingModal
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
        onBook={handleBook}
        loading={loading}
      />
    </View>
  );
}

function SlotCard({
  slot,
  onPress,
}: {
  slot: IntercitySlot;
  onPress: () => void;
}): React.ReactNode {
  const free = slot.max_seats - slot.booked_seats;
  const isFull = free <= 0;
  const progress = Math.min(100, (slot.booked_seats / slot.max_seats) * 100);
  return (
    <TouchableOpacity
      style={[styles.slotCard, isFull && styles.slotCardDisabled]}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isFull}
    >
      <View style={styles.slotHeaderRow}>
        <Text style={styles.slotRoute}>
          {slot.from_region} → {slot.to_region}
        </Text>
        <Text style={styles.slotTime}>{formatDepartureWithWeekday(slot.departure_at)}</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.slotMetaRow}>
        <Text style={styles.slotSeats}>
          {isFull ? 'Машина заполнена' : `Свободно ${free} из ${slot.max_seats}`}
        </Text>
        <Text style={styles.slotPrice}>{slot.price_per_seat} сом/место</Text>
      </View>

      {slot.has_driver && slot.driver_name && (
        <View style={styles.driverRow}>
          <Icon name="car" size={14} color={ClientColors.primary} strokeWidth={2.2} />
          <Text style={styles.driverRowText}>
            {slot.driver_name}
            {slot.car_model && ` · ${slot.car_model}`}
            {slot.car_number && ` ${slot.car_number}`}
          </Text>
        </View>
      )}
      {!slot.has_driver && (
        <Text style={styles.noDriverHint}>
          Водитель пока не назначен — первое бронирование ускорит выезд.
        </Text>
      )}
    </TouchableOpacity>
  );
}

function ActiveBookingCard({
  booking,
  onCancel,
  loading,
}: {
  booking: IntercityBooking;
  onCancel: () => void;
  loading: boolean;
}): React.ReactNode {
  const r = booking.route;
  const tripDeparture = booking.trip?.departure_at ?? null;
  const isPending = booking.status === 'pending';
  const isMatched = booking.status === 'matched' || booking.status === 'en_route';
  const seatsCap = r?.max_seats ?? 0;

  // Status pill keeps the same neutral tonal scale across states so the
  // user reads it as "status", not "mood". A coloured dot up front
  // carries the semantic — amber = waiting, teal = ready, grey = ended.
  let statusLabel = '';
  let dotColor: string = ClientColors.textMuted;
  if (booking.status === 'pending') {
    statusLabel = 'Ждём водителя';
    dotColor = ClientColors.secondary;
  } else if (booking.status === 'matched') {
    statusLabel = 'Водитель назначен';
    dotColor = ClientColors.primary;
  } else if (booking.status === 'en_route') {
    statusLabel = 'Водитель в пути';
    dotColor = ClientColors.primary;
  } else if (booking.status === 'completed') {
    statusLabel = 'Завершено';
    dotColor = ClientColors.success;
  } else if (booking.status === 'cancelled') {
    statusLabel = 'Отменено';
    dotColor = ClientColors.danger;
  } else if (booking.status === 'no_show') {
    statusLabel = 'Вы не пришли';
    dotColor = ClientColors.danger;
  }

  return (
    <View style={styles.activeCard}>
      <View style={styles.activeHeader}>
        <Text style={styles.activeRouteName}>
          {r?.from_region} → {r?.to_region}
        </Text>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={styles.statusPillText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.activeRow}>
        <Icon name="clock" size={16} color={ClientColors.textSecondary} strokeWidth={2.2} />
        <Text style={styles.activeRowText}>
          {tripDeparture ? formatDeparture(tripDeparture) : booking.departure_date} ·{' '}
          {booking.seats_count} {booking.seats_count === 1 ? 'место' : 'места'} · {booking.total_price} сом
        </Text>
      </View>

      {(isPending || isMatched) && seatsCap > 0 && (
        <View style={styles.waitingBlock}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, (booking.seats_booked_total / seatsCap) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.waitingText}>
            {booking.seats_booked_total} из {seatsCap} мест занято
          </Text>
        </View>
      )}

      {isMatched && booking.trip && (
        <View style={styles.driverBlock}>
          <Icon name="car" size={20} color={ClientColors.primary} strokeWidth={2.2} />
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{booking.trip.driver_name ?? 'Водитель'}</Text>
            <Text style={styles.driverCar}>
              {booking.trip.car_model} {booking.trip.car_number}
            </Text>
          </View>
          {booking.trip.driver_phone && (
            <TouchableOpacity
              style={styles.callButton}
              onPress={() => Linking.openURL(`tel:${booking.trip!.driver_phone}`)}
              activeOpacity={0.85}
            >
              <Icon name="phone" size={18} color={ClientColors.white} strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {(isPending || isMatched) && booking.status !== 'en_route' && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={ClientColors.danger} />
          ) : (
            <Text style={styles.cancelButtonText}>Отменить бронь</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function BookingModal({
  slot,
  onClose,
  onBook,
  loading,
}: {
  slot: IntercitySlot | null;
  onClose: () => void;
  onBook: (s: IntercitySlot, seats: number) => Promise<void>;
  loading: boolean;
}): React.ReactNode {
  const [seats, setSeats] = useState(1);

  useEffect(() => {
    if (slot) setSeats(1);
  }, [slot]);

  if (!slot) return null;

  const free = slot.max_seats - slot.booked_seats;
  const maxBookable = Math.min(3, free);
  const total = slot.price_per_seat * seats;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton} activeOpacity={0.7}>
            <Icon name="arrow-right" size={22} color={ClientColors.dark} strokeWidth={2.4} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {slot.from_region} → {slot.to_region}
          </Text>
          <View style={styles.modalCloseButton} />
        </View>

        <View style={styles.modalBody}>
          <View style={styles.modalSummary}>
            <Text style={styles.modalSummaryLabel}>Выезд</Text>
            <Text style={styles.modalSummaryValue}>{formatDepartureWithWeekday(slot.departure_at)}</Text>
            <Text style={styles.modalSummaryMeta}>
              Свободно {free} из {slot.max_seats} мест
            </Text>
            {slot.has_driver && slot.driver_name && (
              <Text style={styles.modalSummaryMeta}>
                Водитель: {slot.driver_name}
                {slot.car_model && ` · ${slot.car_model}`}
                {slot.car_number && ` ${slot.car_number}`}
              </Text>
            )}
          </View>

          <Text style={[styles.modalLabel, { marginTop: Spacing.xxl }]}>Сколько мест?</Text>
          <View style={styles.seatsRow}>
            {[1, 2, 3].map((n) => {
              const disabled = n > maxBookable;
              const active = seats === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.seatChip,
                    active && styles.seatChipActive,
                    disabled && styles.seatChipDisabled,
                  ]}
                  onPress={() => !disabled && setSeats(n)}
                  disabled={disabled}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.seatChipText,
                      active && styles.seatChipTextActive,
                      disabled && styles.seatChipTextDisabled,
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.priceCardLabel}>К оплате водителю наличными</Text>
            <Text style={styles.priceCardValue}>{total} сом</Text>
            <Text style={styles.priceCardMeta}>
              {seats} × {slot.price_per_seat} сом
            </Text>
          </View>
        </View>

        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={[styles.modalConfirm, (loading || free <= 0) && { opacity: 0.5 }]}
            onPress={() => onBook(slot, seats)}
            disabled={loading || free <= 0}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={ClientColors.white} />
            ) : (
              <Text style={styles.modalConfirmText}>
                {free <= 0 ? 'Мест нет' : 'Забронировать'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ClientColors.background },
  header: {
    paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 50) + 12,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: ClientColors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: ClientColors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: ClientColors.textSecondary,
    marginTop: 2,
  },
  scrollContent: { padding: Spacing.lg, paddingBottom: 80 },
  sectionTitle: {
    ...Typography.overline,
    textTransform: 'uppercase',
    color: ClientColors.textSecondary,
    marginBottom: 10,
    paddingLeft: Spacing.xs,
  },

  slotCard: {
    backgroundColor: ClientColors.cardBackground,
    borderRadius: Radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: ClientColors.border,
  },
  slotCardDisabled: { opacity: 0.55 },
  slotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  slotRoute: {
    ...Typography.h4,
    flex: 1,
    color: ClientColors.dark,
  },
  slotTime: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: ClientColors.primaryDark,
    backgroundColor: ClientColors.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  slotMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  slotSeats: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: ClientColors.dark,
  },
  slotPrice: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: ClientColors.primaryDark,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  driverRowText: {
    fontSize: 12,
    color: ClientColors.textSecondary,
    flex: 1,
  },
  noDriverHint: {
    fontSize: 12,
    color: ClientColors.textMuted,
    marginTop: 8,
    fontStyle: 'italic',
  },

  activeCard: {
    backgroundColor: ClientColors.cardBackground,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: ClientColors.primary,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  activeRouteName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    flex: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.round,
    backgroundColor: ClientColors.surfaceMuted,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.round,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: ClientColors.textPrimary,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  activeRowText: {
    fontSize: 14,
    color: ClientColors.textSecondary,
    flex: 1,
  },
  waitingBlock: { marginTop: 6 },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: ClientColors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ClientColors.primary,
    borderRadius: 3,
  },
  waitingText: {
    fontSize: 13,
    color: ClientColors.dark,
    fontWeight: '600' as const,
    marginTop: 8,
  },
  driverBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: ClientColors.primaryTint,
    borderRadius: 14,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: ClientColors.dark,
  },
  driverCar: {
    fontSize: 13,
    color: ClientColors.textSecondary,
    marginTop: 2,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ClientColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: ClientColors.dangerBorder,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: ClientColors.danger,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: ClientColors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: ClientColors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: ClientColors.border,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '180deg' }],
  },
  modalTitle: {
    ...Typography.h4,
    fontSize: 17,
    color: ClientColors.dark,
    flex: 1,
    textAlign: 'center',
  },
  modalBody: {
    flex: 1,
    padding: Spacing.xl,
  },
  modalSummary: {
    backgroundColor: ClientColors.cardBackground,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: ClientColors.border,
  },
  modalSummaryLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: ClientColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalSummaryValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    marginTop: 6,
  },
  modalSummaryMeta: {
    fontSize: 13,
    color: ClientColors.textSecondary,
    marginTop: 6,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: ClientColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  seatsRow: { flexDirection: 'row', gap: 10 },
  seatChip: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ClientColors.border,
    backgroundColor: ClientColors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatChipActive: {
    borderColor: ClientColors.primary,
    backgroundColor: ClientColors.primaryTint,
  },
  seatChipDisabled: { opacity: 0.4 },
  seatChipText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: ClientColors.dark,
  },
  seatChipTextActive: { color: ClientColors.primaryDark },
  seatChipTextDisabled: { color: ClientColors.textMuted },
  priceCard: {
    marginTop: 28,
    padding: 18,
    backgroundColor: ClientColors.primaryTint,
    borderRadius: 18,
  },
  priceCardLabel: {
    fontSize: 13,
    color: ClientColors.primaryDark,
    fontWeight: '600' as const,
  },
  priceCardValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: ClientColors.primaryDark,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  priceCardMeta: {
    fontSize: 12,
    color: ClientColors.primaryDark,
    marginTop: 4,
    opacity: 0.7,
  },
  modalFooter: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Platform.OS === 'android' ? Spacing.xxl : 34,
    borderTopWidth: 1,
    borderTopColor: ClientColors.border,
    backgroundColor: ClientColors.cardBackground,
  },
  modalConfirm: {
    height: 60,
    borderRadius: 28,
    backgroundColor: ClientColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ClientColors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  modalConfirmText: {
    color: ClientColors.white,
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
});
