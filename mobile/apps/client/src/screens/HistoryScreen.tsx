import React, { useState, useEffect, useCallback } from 'react';
import {
  Text,
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Order, ClientColors, EmptyState, ErrorPill, Skeleton, Spacing, Typography } from '@taxi/shared';
import { getOrderHistory } from '../api/orders';
import OrderHistoryItem from '../components/OrderHistoryItem';
import Icon from '../components/Icon';

function HistorySkeletonCard(): React.ReactNode {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonRow}>
        <Skeleton width={120} height={12} />
        <Skeleton width={70} height={20} radius={8} />
      </View>
      <View style={[styles.skeletonRow, { marginTop: Spacing.sm }]}>
        <Skeleton width="60%" height={16} />
        <Skeleton width={60} height={16} />
      </View>
    </View>
  );
}

export default function HistoryScreen(): React.ReactNode {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState<number>(1);
  const [lastPage, setLastPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (pageNum: number, isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const response = await getOrderHistory(pageNum);
      if (isRefresh || pageNum === 1) {
        setOrders(response.data);
      } else {
        setOrders((prev) => [...prev, ...response.data]);
      }
      setPage(response.meta.current_page);
      setLastPage(response.meta.last_page);
      setError(null);
    } catch {
      setError('Не удалось загрузить историю');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  const handleRefresh = useCallback(() => {
    fetchOrders(1, true);
  }, [fetchOrders]);

  const handleEndReached = useCallback(() => {
    if (!loadingMore && page < lastPage) {
      fetchOrders(page + 1);
    }
  }, [loadingMore, page, lastPage, fetchOrders]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.header}>История поездок</Text>
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3].map((i) => (
            <HistorySkeletonCard key={i} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (error && orders.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <ErrorPill
          message={error}
          leading={
            <Icon name="alert" size={18} color={ClientColors.danger} strokeWidth={2.2} />
          }
          onRetry={() => fetchOrders(1)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.header}>История поездок</Text>
      <FlatList
        data={orders}
        renderItem={({ item, index }) => <OrderHistoryItem order={item} index={index} />}
        keyExtractor={(item) => item.id.toString()}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ flexGrow: 1 }}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              size="small"
              color={ClientColors.primary}
              style={{ paddingVertical: Spacing.lg }}
            />
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Icon name="clock" size={36} color={ClientColors.primary} strokeWidth={1.8} />}
            title="Здесь будет история ваших поездок"
            subtitle="После первой поездки увидите её на этом экране — куда ездили, кто был водителем, сколько заплатили."
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ClientColors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: ClientColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  header: {
    ...Typography.h2,
    color: ClientColors.dark,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  skeletonList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  skeletonCard: {
    backgroundColor: ClientColors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
