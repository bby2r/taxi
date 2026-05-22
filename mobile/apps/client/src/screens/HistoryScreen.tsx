import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Order, ClientColors, Typography } from '@taxi/shared';
import { getOrderHistory } from '../api/orders';
import OrderHistoryItem from '../components/OrderHistoryItem';
import Icon from '../components/Icon';

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
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={ClientColors.primary} />
      </SafeAreaView>
    );
  }

  if (error && orders.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={[Typography.body, { color: ClientColors.textSecondary, marginBottom: 16 }]}>
          {error}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchOrders(1)}>
          <Text style={[Typography.button, { color: ClientColors.white }]}>Повторить</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.header}>История поездок</Text>
      <FlatList
        data={orders}
        renderItem={({ item }) => <OrderHistoryItem order={item} />}
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
              style={{ paddingVertical: 16 }}
            />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Icon name="clock" size={36} color={ClientColors.primary} strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>Здесь будет история ваших поездок</Text>
            <Text style={styles.emptySubtitle}>
              После первой поездки увидите её на этом экране — куда ездили, кто
              был водителем, сколько заплатили.
            </Text>
          </View>
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
    paddingHorizontal: 32,
  },
  header: {
    ...Typography.h2,
    color: ClientColors.dark,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingTop: 64,
  },
  emptyIconBox: {
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: ClientColors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 14,
    color: ClientColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: ClientColors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
});
