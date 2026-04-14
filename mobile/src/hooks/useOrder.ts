import { useState, useEffect, useCallback, useRef } from 'react';
import { Order, OrderStatus } from '../api/types';
import * as ordersApi from '../api/orders';
import { usePusher } from './usePusher';
import { useAuth } from '../context/AuthContext';

type ClientOrderState =
  | { phase: 'idle' }
  | { phase: 'searching'; order: Order }
  | { phase: 'accepted'; order: Order }
  | { phase: 'arrived'; order: Order }
  | { phase: 'in_progress'; order: Order }
  | { phase: 'completed'; order: Order }
  | { phase: 'cancelled'; reason: 'no_drivers' | 'other' };

export interface UseOrderReturn {
  state: ClientOrderState;
  callTaxi: (latitude: number, longitude: number, address?: string) => Promise<void>;
  callRegionalTaxi: (latitude: number, longitude: number, regionId: number, address?: string) => Promise<void>;
  cancelOrder: () => Promise<void>;
  dismissCompleted: () => void;
  loading: boolean;
  error: string | null;
}

function statusToPhase(status: OrderStatus): ClientOrderState['phase'] {
  switch (status) {
    case 'searching':
      return 'searching';
    case 'accepted':
      return 'accepted';
    case 'arrived':
      return 'arrived';
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
  }
}

function buildState(phase: ClientOrderState['phase'], order: Order): ClientOrderState {
  if (phase === 'idle') {
    return { phase: 'idle' };
  }
  if (phase === 'cancelled') {
    return { phase: 'cancelled', reason: 'other' };
  }
  return { phase, order } as ClientOrderState;
}

export function useOrder(): UseOrderReturn {
  const { user } = useAuth();
  const [state, setState] = useState<ClientOrderState>({ phase: 'idle' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orderRef = useRef<Order | null>(null);

  // Check for existing active order on mount
  useEffect(() => {
    (async () => {
      try {
        const current = await ordersApi.getCurrentOrder();
        if (current) {
          orderRef.current = current;
          const phase = statusToPhase(current.status);
          setState(buildState(phase, current));
        }
      } catch {
        // No active order — stay idle
      }
    })();
  }, []);

  // Pusher event handlers
  const refreshAndSetPhase = useCallback((targetPhase: ClientOrderState['phase']) => {
    if (orderRef.current) {
      ordersApi
        .getOrder(orderRef.current.id)
        .then((fresh) => {
          orderRef.current = fresh;
          setState(buildState(targetPhase, fresh));
        })
        .catch(() => {});
    }
  }, []);

  const handleOrderAccepted = useCallback(() => {
    refreshAndSetPhase('accepted');
  }, [refreshAndSetPhase]);

  const handleDriverArrived = useCallback(() => {
    refreshAndSetPhase('arrived');
  }, [refreshAndSetPhase]);

  const handleOrderInProgress = useCallback(() => {
    refreshAndSetPhase('in_progress');
  }, [refreshAndSetPhase]);

  const handleOrderCompleted = useCallback(() => {
    refreshAndSetPhase('completed');
  }, [refreshAndSetPhase]);

  const handleDriverLocation = useCallback((data: unknown) => {
    const payload = data as { latitude?: number; longitude?: number };
    if (
      typeof payload.latitude !== 'number' ||
      typeof payload.longitude !== 'number'
    ) {
      return;
    }
    setState((prev) => {
      if (
        prev.phase !== 'accepted' &&
        prev.phase !== 'arrived' &&
        prev.phase !== 'in_progress'
      ) {
        return prev;
      }
      if (!prev.order.driver) {
        return prev;
      }
      const nextOrder: Order = {
        ...prev.order,
        driver: {
          ...prev.order.driver,
          latitude: payload.latitude,
          longitude: payload.longitude,
        },
      };
      orderRef.current = nextOrder;
      return { ...prev, order: nextOrder };
    });
  }, []);

  const handleOrderCancelled = useCallback(async () => {
    let reason: 'no_drivers' | 'other' = 'other';
    const orderId = orderRef.current?.id;
    if (orderId) {
      try {
        const fresh = await ordersApi.getOrder(orderId);
        reason = fresh.cancelled_by === 'system' ? 'no_drivers' : 'other';
      } catch {
        // ignore, default 'other'
      }
    }
    orderRef.current = null;
    setState({ phase: 'cancelled', reason });
    setTimeout(() => {
      setState((prev) => (prev.phase === 'cancelled' ? { phase: 'idle' } : prev));
    }, 3000);
  }, []);

  usePusher({
    channelName: user ? `private-client.${user.id}` : null,
    events: {
      'order.accepted': handleOrderAccepted,
      'order.driver_arrived': handleDriverArrived,
      'order.in_progress': handleOrderInProgress,
      'order.completed': handleOrderCompleted,
      'order.cancelled': handleOrderCancelled,
      'driver.location': handleDriverLocation,
    },
    enabled: state.phase !== 'idle' && state.phase !== 'completed' && state.phase !== 'cancelled',
  });

  // Periodic refresh fallback (every 10s when active)
  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'completed' || state.phase === 'cancelled') {
      return;
    }
    const orderId = 'order' in state ? state.order.id : null;
    if (!orderId) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const fresh = await ordersApi.getOrder(orderId);
        orderRef.current = fresh;
        const phase = statusToPhase(fresh.status);
        if (phase === 'cancelled') {
          const reason = fresh.cancelled_by === 'system' ? 'no_drivers' : 'other';
          orderRef.current = null;
          setState({ phase: 'cancelled', reason });
          setTimeout(() => {
            setState((prev) => (prev.phase === 'cancelled' ? { phase: 'idle' } : prev));
          }, 3000);
          return;
        } else {
          setState(buildState(phase, fresh));
        }
      } catch {
        // Ignore — Pusher is primary
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [state.phase]);

  const callTaxi = useCallback(async (latitude: number, longitude: number, address?: string) => {
    setLoading(true);
    setError(null);
    try {
      const order = await ordersApi.createOrder(latitude, longitude, address);
      orderRef.current = order;
      setState({ phase: 'searching', order });
    } catch (e: unknown) {
      const axiosError = e as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message || 'Не удалось создать заказ');
    } finally {
      setLoading(false);
    }
  }, []);

  const callRegionalTaxi = useCallback(
    async (latitude: number, longitude: number, regionId: number, address?: string) => {
      setLoading(true);
      setError(null);
      try {
        const order = await ordersApi.createRegionalOrder(latitude, longitude, regionId, address);
        orderRef.current = order;
        setState({ phase: 'searching', order });
      } catch (e: unknown) {
        const axiosError = e as { response?: { data?: { message?: string } } };
        setError(axiosError.response?.data?.message || 'Не удалось создать заказ');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const cancelOrder = useCallback(async () => {
    const order = orderRef.current;
    if (!order) {
      return;
    }
    setLoading(true);
    try {
      await ordersApi.cancelOrder(order.id);
      orderRef.current = null;
      setState({ phase: 'cancelled', reason: 'other' });
      setTimeout(() => {
        setState((prev) => (prev.phase === 'cancelled' ? { phase: 'idle' } : prev));
      }, 3000);
    } catch (e: unknown) {
      const axiosError = e as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message || 'Не удалось отменить заказ');
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissCompleted = useCallback(() => {
    orderRef.current = null;
    setState({ phase: 'idle' });
  }, []);

  return { state, callTaxi, callRegionalTaxi, cancelOrder, dismissCompleted, loading, error };
}
