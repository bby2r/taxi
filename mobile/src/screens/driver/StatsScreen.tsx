import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DriverColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { DriverBalance, DriverPeriodEarnings, DriverSettlement } from '../../api/types';
import { getDriverBalance } from '../../api/driver';
import ActionButton from '../../components/ActionButton';

function formatMoney(amount: number): string {
  return amount.toLocaleString('ru-RU') + ' сом';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface PeriodCardProps {
  title: string;
  data: DriverPeriodEarnings;
}

function PeriodCard({ title, data }: PeriodCardProps): React.ReactNode {
  return (
    <View style={styles.periodCard}>
      <Text style={[Typography.caption, styles.periodTitle]}>{title}</Text>
      <Text style={[Typography.h2, styles.periodEarnings]}>
        {formatMoney(data.earnings)}
      </Text>
      <View style={styles.periodMeta}>
        <Text style={[Typography.caption, { color: DriverColors.textMuted }]}>
          {data.orders} поездок
        </Text>
        <Text style={[Typography.caption, { color: DriverColors.primary }]}>
          комиссия: {formatMoney(data.commission)}
        </Text>
      </View>
    </View>
  );
}

interface SettlementRowProps {
  settlement: DriverSettlement;
}

function SettlementRow({ settlement }: SettlementRowProps): React.ReactNode {
  return (
    <View style={styles.settlementRow}>
      <View style={{ flex: 1 }}>
        <Text style={[Typography.bodyBold, { color: DriverColors.textPrimary }]}>
          {formatMoney(settlement.amount)}
        </Text>
        {settlement.notes ? (
          <Text style={[Typography.caption, { color: DriverColors.textMuted, marginTop: 2 }]}>
            {settlement.notes}
          </Text>
        ) : null}
      </View>
      <Text style={[Typography.caption, { color: DriverColors.textMuted }]}>
        {formatDate(settlement.paid_at)}
      </Text>
    </View>
  );
}

export default function StatsScreen(): React.ReactNode {
  const [data, setData] = useState<DriverBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (isRefresh: boolean): Promise<void> => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const fresh = await getDriverBalance();
      setData(fresh);
    } catch {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetch(false);
  }, [fetch]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={DriverColors.primary} />
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={[Typography.body, { color: DriverColors.textSecondary, marginBottom: 16 }]}>
          {error}
        </Text>
        <ActionButton title="Повторить" onPress={() => fetch(false)} />
      </SafeAreaView>
    );
  }

  const balance = data!.balance;
  const owesMoney = balance > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={[Typography.h1, styles.header]}>Финансы</Text>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetch(true)}
            tintColor={DriverColors.primary}
          />
        }
      >
        <View
          style={[
            styles.balanceCard,
            owesMoney ? styles.balanceCardOwes : styles.balanceCardClear,
          ]}
        >
          <Text style={[Typography.caption, styles.balanceLabel]}>
            {owesMoney ? 'К оплате оператору' : 'Долг закрыт'}
          </Text>
          <Text style={[Typography.h1, styles.balanceAmount]}>
            {formatMoney(balance)}
          </Text>
          {data!.last_settlement_at ? (
            <Text style={[Typography.caption, styles.balanceMeta]}>
              Последний платёж: {formatDate(data!.last_settlement_at)}
            </Text>
          ) : (
            <Text style={[Typography.caption, styles.balanceMeta]}>
              Платежей ещё не было
            </Text>
          )}
          <Text style={[Typography.caption, styles.balanceMeta]}>
            Расчёты — еженедельно
          </Text>
        </View>

        <PeriodCard title="Сегодня" data={data!.today} />
        <PeriodCard title="Эта неделя" data={data!.week} />
        <PeriodCard title="Месяц" data={data!.month} />
        <PeriodCard title="Всего" data={data!.total} />

        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Платежи</Text>
          {data!.recent_settlements.length === 0 ? (
            <Text style={[Typography.body, { color: DriverColors.textMuted }]}>
              Пока пусто. Когда оператор зафиксирует ваш платёж — он появится здесь.
            </Text>
          ) : (
            data!.recent_settlements.map((s) => (
              <SettlementRow key={s.id} settlement={s} />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DriverColors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: DriverColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  header: {
    color: DriverColors.textPrimary,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  balanceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  balanceCardOwes: {
    backgroundColor: '#3B1F22',
    borderWidth: 1,
    borderColor: DriverColors.danger,
  },
  balanceCardClear: {
    backgroundColor: '#0F2A22',
    borderWidth: 1,
    borderColor: DriverColors.success,
  },
  balanceLabel: {
    color: DriverColors.textMuted,
    marginBottom: 6,
  },
  balanceAmount: {
    color: DriverColors.textPrimary,
    marginBottom: 8,
  },
  balanceMeta: {
    color: DriverColors.textMuted,
  },
  periodCard: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  periodTitle: {
    color: DriverColors.textMuted,
    marginBottom: 4,
  },
  periodEarnings: {
    color: DriverColors.textPrimary,
    marginBottom: 6,
  },
  periodMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    color: DriverColors.textPrimary,
    marginBottom: 10,
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DriverColors.border,
  },
});
