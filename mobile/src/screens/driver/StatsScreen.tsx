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
import { DriverStats } from '../../api/types';
import { getDriverStats } from '../../api/driver';
import ActionButton from '../../components/ActionButton';
import StatCard from '../../components/StatCard';

export default function StatsScreen(): React.ReactNode {
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (isRefresh: boolean): Promise<void> => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await getDriverStats();
      setStats(data);
    } catch {
      setError('Не удалось загрузить статистику');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(false);
  }, [fetchStats]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={DriverColors.primary} />
      </SafeAreaView>
    );
  }

  if (error && !stats) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={[Typography.body, { color: DriverColors.textSecondary, marginBottom: 16 }]}>
          {error}
        </Text>
        <ActionButton title="Повторить" onPress={() => fetchStats(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={[Typography.h1, styles.header]}>Статистика</Text>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchStats(true)}
            tintColor={DriverColors.primary}
          />
        }
      >
        <View style={styles.row}>
          <StatCard title="Сегодня" orders={stats!.today.orders} earnings={stats!.today.earnings} />
          <StatCard title="Неделя" orders={stats!.week.orders} earnings={stats!.week.earnings} />
        </View>
        <View style={[styles.row, { marginTop: 12 }]}>
          <StatCard title="Месяц" orders={stats!.month.orders} earnings={stats!.month.earnings} />
          <StatCard title="Всего" orders={stats!.total.orders} earnings={stats!.total.earnings} />
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
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});
