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
  Typography,
  todayDateString,
  tomorrowDateString,
  formatHumanDate,
  getApiErrorMessage,
} from '@taxi/shared';
import Icon from '../components/Icon';
import {
  cancelIntercityBooking,
  createIntercityBooking,
  getActiveIntercityBooking,
  getIntercityRoutes,
  type IntercityBooking,
  type IntercityRoute,
} from '../api/intercity';

export default function IntercityScreen(): React.ReactNode {
  const location = useLocation();
  const [routes, setRoutes] = useState<IntercityRoute[]>([]);
  const [booking, setBooking] = useState<IntercityBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<IntercityRoute | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const lat = location.hasRealFix ? location.latitude : undefined;
      const lng = location.hasRealFix ? location.longitude : undefined;
      const [r, b] = await Promise.all([
        getIntercityRoutes(lat, lng),
        getActiveIntercityBooking(),
      ]);
      setRoutes(r);
      setBooking(b);
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

  // Поллинг статуса — без пушей ловим момент когда водитель примет.
  // Зависим только от id+status, чтобы поллинг не пересоздавался
  // на каждую новую booking-копию из setBooking. setBooking защищён
  // от no-op'ов сравнением ключевых полей.
  const bookingId = booking?.id ?? null;
  const bookingStatus = booking?.status ?? null;
  useEffect(() => {
    if (bookingId === null || bookingStatus === 'completed' || bookingStatus === 'cancelled') {
      return;
    }
    const interval = setInterval(async () => {
      try {
        const fresh = await getActiveIntercityBooking();
        setBooking((prev) => {
          if (!fresh && !prev) return prev;
          if (
            fresh &&
            prev &&
            fresh.id === prev.id &&
            fresh.status === prev.status &&
            fresh.seats_booked_total === prev.seats_booked_total &&
            (fresh.trip?.id ?? null) === (prev.trip?.id ?? null)
          ) {
            return prev;
          }
          return fresh;
        });
      } catch {
        // next tick retries
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [bookingId, bookingStatus]);

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const handleBook = async (route: IntercityRoute, seats: number, dateStr: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const b = await createIntercityBooking({
        route_id: route.id,
        departure_date: dateStr,
        seats_count: seats,
      });
      setBooking(b);
      setSelectedRoute(null);
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
        <Text style={styles.headerSubtitle}>Места в машине между сёлами</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ClientColors.primary} />}
      >
        {error && (
          <View style={styles.errorPill}>
            <Icon name="alert" size={18} color={ClientColors.danger} strokeWidth={2.2} />
            <Text style={[Typography.caption, styles.errorText]}>{error}</Text>
          </View>
        )}

        {booking && <ActiveBookingCard booking={booking} onCancel={handleCancel} loading={loading} />}

        {!booking && routes.length === 0 && (
          <View style={styles.emptyBlock}>
            <Icon name="route" size={44} color={ClientColors.textMuted} strokeWidth={2} />
            <Text style={styles.emptyText}>
              Маршрутов из вашего села пока нет. Потяните вниз чтобы обновить.
            </Text>
          </View>
        )}

        {!booking && routes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Доступные направления</Text>
            {routes.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.routeCard}
                activeOpacity={0.85}
                onPress={() => setSelectedRoute(r)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeName}>
                    {r.from_region.name} → {r.to_region.name}
                  </Text>
                  <Text style={styles.routeMeta}>
                    {r.max_seats} мест · {r.price_per_seat} сом/место
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={ClientColors.textMuted} strokeWidth={2.4} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      <BookingModal
        route={selectedRoute}
        onClose={() => setSelectedRoute(null)}
        onBook={handleBook}
        loading={loading}
      />
    </View>
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
  const remaining = r ? r.max_seats - booking.seats_booked_total : 0;
  const isWaiting = booking.status === 'pending';
  const isMatched = booking.status === 'matched' || booking.status === 'en_route';

  return (
    <View style={styles.activeCard}>
      <View style={styles.activeHeader}>
        <Text style={styles.activeRouteName}>
          {r?.from_region} → {r?.to_region}
        </Text>
        <View style={[styles.statusPill, isMatched && styles.statusPillSuccess]}>
          <Text style={[styles.statusPillText, isMatched && styles.statusPillTextSuccess]}>
            {booking.status === 'pending' && 'Ждём пассажиров'}
            {booking.status === 'matched' && 'Водитель найден'}
            {booking.status === 'en_route' && 'Водитель в пути'}
            {booking.status === 'completed' && 'Завершено'}
            {booking.status === 'cancelled' && 'Отменено'}
          </Text>
        </View>
      </View>

      <View style={styles.activeRow}>
        <Icon name="clock" size={16} color={ClientColors.textSecondary} strokeWidth={2.2} />
        <Text style={styles.activeRowText}>
          {formatHumanDate(booking.departure_date)} · {booking.seats_count} {booking.seats_count === 1 ? 'место' : 'места'} · {booking.total_price} сом
        </Text>
      </View>

      {isWaiting && r && (
        <View style={styles.waitingBlock}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, (booking.seats_booked_total / r.max_seats) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.waitingText}>
            {booking.seats_booked_total} из {r.max_seats} мест занято
          </Text>
          <Text style={styles.waitingHint}>
            Как только машина заполнится — пришлём уведомление или водитель сам позвонит вам.
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

      {(isWaiting || isMatched) && booking.status !== 'en_route' && (
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
  route,
  onClose,
  onBook,
  loading,
}: {
  route: IntercityRoute | null;
  onClose: () => void;
  onBook: (r: IntercityRoute, seats: number, dateStr: string) => Promise<void>;
  loading: boolean;
}): React.ReactNode {
  const [seats, setSeats] = useState(1);
  const [date, setDate] = useState(todayDateString());

  useEffect(() => {
    if (route) {
      setSeats(1);
      setDate(todayDateString());
    }
  }, [route]);

  if (!route) return null;

  const total = route.price_per_seat * seats;
  const dates = [
    { value: todayDateString(), label: 'Сегодня' },
    { value: tomorrowDateString(), label: 'Завтра' },
  ];

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton} activeOpacity={0.7}>
            <Icon name="arrow-right" size={22} color={ClientColors.dark} strokeWidth={2.4} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {route.from_region.name} → {route.to_region.name}
          </Text>
          <View style={styles.modalCloseButton} />
        </View>

        <View style={styles.modalBody}>
          <Text style={styles.modalLabel}>Когда едете?</Text>
          <View style={styles.dateRow}>
            {dates.map((d) => (
              <TouchableOpacity
                key={d.value}
                style={[styles.dateChip, date === d.value && styles.dateChipActive]}
                onPress={() => setDate(d.value)}
                activeOpacity={0.85}
              >
                <Text style={[styles.dateChipText, date === d.value && styles.dateChipTextActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.waitingHintModal}>
            Как только машина заполнится ({route.max_seats} мест) — пришлём
            уведомление, либо водитель сам вам позвонит.
          </Text>

          <Text style={[styles.modalLabel, { marginTop: 24 }]}>Сколько мест?</Text>
          <View style={styles.seatsRow}>
            {[1, 2, 3].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.seatChip, seats === n && styles.seatChipActive]}
                onPress={() => setSeats(n)}
                activeOpacity={0.85}
              >
                <Text style={[styles.seatChipText, seats === n && styles.seatChipTextActive]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.priceCardLabel}>К оплате водителю наличными</Text>
            <Text style={styles.priceCardValue}>{total} сом</Text>
            <Text style={styles.priceCardMeta}>
              {seats} × {route.price_per_seat} сом
            </Text>
          </View>
        </View>

        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={[styles.modalConfirm, loading && { opacity: 0.5 }]}
            onPress={() => onBook(route, seats, date)}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={ClientColors.white} />
            ) : (
              <Text style={styles.modalConfirmText}>Забронировать</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: ClientColors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: ClientColors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: ClientColors.dark,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: ClientColors.textSecondary,
    marginTop: 2,
  },
  scrollContent: { padding: 16, paddingBottom: 80 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: ClientColors.textSecondary,
    marginBottom: 10,
    paddingLeft: 4,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ClientColors.cardBackground,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: ClientColors.border,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: ClientColors.dark,
  },
  routeMeta: {
    fontSize: 13,
    color: ClientColors.textSecondary,
    marginTop: 4,
  },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    marginTop: 14,
    fontSize: 14,
    color: ClientColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F1',
    borderColor: '#FFD4D4',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
  },
  errorText: { color: ClientColors.danger, flex: 1 },
  activeCard: {
    backgroundColor: ClientColors.cardBackground,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1.5,
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
    fontWeight: '800' as const,
    color: ClientColors.dark,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: ClientColors.secondaryTint,
  },
  statusPillSuccess: {
    backgroundColor: ClientColors.primaryTint,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: ClientColors.secondaryDark,
  },
  statusPillTextSuccess: {
    color: ClientColors.primaryDark,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  activeRowText: {
    fontSize: 14,
    color: ClientColors.textSecondary,
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
  waitingHint: {
    fontSize: 12,
    color: ClientColors.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  driverBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ClientColors.primaryTint,
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
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
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFD4D4',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 17,
    fontWeight: '800' as const,
    color: ClientColors.dark,
    flex: 1,
    textAlign: 'center',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: ClientColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ClientColors.border,
    backgroundColor: ClientColors.cardBackground,
    alignItems: 'center',
  },
  dateChipActive: {
    borderColor: ClientColors.primary,
    backgroundColor: ClientColors.primaryTint,
  },
  dateChipText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: ClientColors.dark,
  },
  dateChipTextActive: {
    color: ClientColors.primaryDark,
  },
  waitingHintModal: {
    fontSize: 12,
    color: ClientColors.textSecondary,
    marginTop: 10,
    lineHeight: 16,
    paddingHorizontal: 2,
  },
  seatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  seatChip: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ClientColors.border,
    backgroundColor: ClientColors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatChipActive: {
    borderColor: ClientColors.primary,
    backgroundColor: ClientColors.primaryTint,
  },
  seatChipText: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: ClientColors.dark,
  },
  seatChipTextActive: {
    color: ClientColors.primaryDark,
  },
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
    fontWeight: '800' as const,
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 24 : 34,
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
