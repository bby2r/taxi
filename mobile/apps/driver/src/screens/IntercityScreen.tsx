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
  formatHumanDate,
  getApiErrorMessage,
} from '@taxi/shared';
import {
  acceptIntercityOffer,
  completeIntercityTrip,
  getActiveIntercityTrip,
  getAvailableIntercityOffers,
  startIntercityTrip,
  type IntercityOffer,
  type IntercityTrip,
} from '../api/intercity';

export default function IntercityScreen(): React.ReactNode {
  const [offers, setOffers] = useState<IntercityOffer[]>([]);
  const [activeTrip, setActiveTrip] = useState<IntercityTrip | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const [t, o] = await Promise.all([
        getActiveIntercityTrip(),
        getAvailableIntercityOffers(),
      ]);
      setActiveTrip((prev) => {
        if (!t && !prev) return prev;
        if (t && prev && t.id === prev.id && t.status === prev.status) return prev;
        return t;
      });
      setOffers((prev) => {
        if (prev.length === o.length && prev.every((p, i) =>
          p.route_id === o[i].route_id &&
          p.departure_date === o[i].departure_date &&
          p.passengers_count === o[i].passengers_count,
        )) {
          return prev;
        }
        return o;
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

  // Авто-обновление списка офферов когда трипа нет — новые «полные
  // машины» появляются сами без pull-to-refresh. Депендим только на
  // activeTrip?.id чтобы тик не пересоздавался на каждом ответе.
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

  const handleAccept = async (offer: IntercityOffer): Promise<void> => {
    Alert.alert(
      'Принять рейс?',
      `${offer.from_region} → ${offer.to_region}\n` +
        `${offer.max_seats} пассажиров · ${offer.total_revenue} сом всего\n` +
        `Выезд: ${formatHumanDate(offer.departure_date)}`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Принимаю',
          onPress: async () => {
            setLoading(true);
            setError(null);
            try {
              const trip = await acceptIntercityOffer(
                offer.route_id,
                offer.departure_date,
              );
              setActiveTrip(trip);
              setOffers([]);
            } catch (e: unknown) {
              setError(getApiErrorMessage(e, 'Не удалось принять рейс'));
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

  const handleComplete = async (): Promise<void> => {
    if (!activeTrip) return;
    Alert.alert(
      'Завершить рейс?',
      'Подтверждайте только когда довезли всех пассажиров.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Завершить',
          onPress: async () => {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Межгород</Text>
        <Text style={styles.headerSubtitle}>Готовые к выезду машины</Text>
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
          <ActiveTripCard trip={activeTrip} onStart={handleStart} onComplete={handleComplete} loading={loading} />
        )}

        {!activeTrip && offers.length === 0 && (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyIcon}>🚌</Text>
            <Text style={styles.emptyTitle}>Готовых рейсов пока нет</Text>
            <Text style={styles.emptyText}>
              Как только пассажиры наберутся на полную машину — рейс появится здесь.
              Список обновляется каждые 15 сек.
            </Text>
          </View>
        )}

        {!activeTrip && offers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Доступные рейсы ({offers.length})</Text>
            {offers.map((offer) => (
              <OfferCard
                key={`${offer.route_id}_${offer.departure_date}`}
                offer={offer}
                onAccept={() => handleAccept(offer)}
                loading={loading}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function OfferCard({
  offer,
  onAccept,
  loading,
}: {
  offer: IntercityOffer;
  onAccept: () => void;
  loading: boolean;
}): React.ReactNode {
  return (
    <View style={styles.offerCard}>
      <View style={styles.offerHeader}>
        <Text style={styles.offerRoute}>
          {offer.from_region} → {offer.to_region}
        </Text>
        <View style={styles.offerBadge}>
          <Text style={styles.offerBadgeText}>{formatHumanDate(offer.departure_date)}</Text>
        </View>
      </View>

      <View style={styles.offerMetaRow}>
        <View style={styles.offerMetaCell}>
          <Text style={styles.offerMetaLabel}>Пассажиров</Text>
          <Text style={styles.offerMetaValue}>{offer.max_seats}</Text>
        </View>
        <View style={styles.offerMetaCell}>
          <Text style={styles.offerMetaLabel}>Цена/место</Text>
          <Text style={styles.offerMetaValue}>{offer.price_per_seat} сом</Text>
        </View>
        <View style={[styles.offerMetaCell, styles.offerMetaTotal]}>
          <Text style={styles.offerMetaLabel}>Заработок</Text>
          <Text style={[styles.offerMetaValue, styles.offerMetaTotalValue]}>
            {offer.total_revenue} сом
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.acceptButton, loading && { opacity: 0.5 }]}
        onPress={onAccept}
        disabled={loading}
        activeOpacity={0.9}
      >
        <Text style={styles.acceptButtonText}>Принять рейс</Text>
      </TouchableOpacity>
    </View>
  );
}

function ActiveTripCard({
  trip,
  onStart,
  onComplete,
  loading,
}: {
  trip: IntercityTrip;
  onStart: () => void;
  onComplete: () => void;
  loading: boolean;
}): React.ReactNode {
  const isMatched = trip.status === 'matched';
  const isEnRoute = trip.status === 'en_route';

  return (
    <View style={styles.activeCard}>
      <View style={styles.activeHeader}>
        <Text style={styles.activeRoute}>
          {trip.route?.from_region} → {trip.route?.to_region}
        </Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>
            {isMatched ? 'Принято — соберите пассажиров' : 'В пути'}
          </Text>
        </View>
      </View>

      <Text style={styles.activeMeta}>
        {formatHumanDate(trip.departure_date)} · {trip.max_seats} мест × {trip.price_per_seat} сом · всего{' '}
        {(trip.total_revenue ?? trip.max_seats * trip.price_per_seat).toLocaleString()} сом
      </Text>

      <Text style={styles.passengersTitle}>Пассажиры ({trip.passengers?.length ?? 0})</Text>

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
        </View>
      ))}

      {isMatched && (
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

  // Offer card
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
    marginBottom: 14,
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

  // Active trip
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
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: DriverColors.border,
    gap: 12,
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
  actionButton: {
    marginTop: 16,
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
});
