import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Order, DeclineReason, DriverCancellationReason } from '../api/types';
import {
  goOnline,
  goOffline,
  acceptOrder,
  declineOrder,
  arriveAtPickup,
  startRide,
  completeOrder,
  cancelOrderByDriver,
  getCurrentDriverOrder,
  getPendingOffer,
} from '../api/driver';
import { useAuth } from '../context/AuthContext';
import { usePusher } from './usePusher';

export type DriverPhase =
  | 'offline'
  | 'online_idle'
  | 'offer'
  | 'active'
  | 'arrived'
  | 'in_progress'
  | 'completed';

interface OfflineState {
  phase: 'offline';
  order: null;
}

interface OnlineIdleState {
  phase: 'online_idle';
  order: null;
}

interface OfferState {
  phase: 'offer';
  order: Order;
}

interface ActiveState {
  phase: 'active';
  order: Order;
}

interface ArrivedState {
  phase: 'arrived';
  order: Order;
}

interface InProgressState {
  phase: 'in_progress';
  order: Order;
}

interface CompletedState {
  phase: 'completed';
  order: Order;
}

export type DriverOrderState =
  | OfflineState
  | OnlineIdleState
  | OfferState
  | ActiveState
  | ArrivedState
  | InProgressState
  | CompletedState;

interface UseDriverOrderReturn {
  state: DriverOrderState;
  isOnline: boolean;
  toggleOnline: (latitude: number, longitude: number) => Promise<void>;
  acceptOffer: () => Promise<void>;
  declineOffer: (reason: DeclineReason) => Promise<void>;
  markArrived: () => Promise<void>;
  markStarted: () => Promise<void>;
  markCompleted: () => Promise<void>;
  cancelByDriver: (reason: DriverCancellationReason) => Promise<void>;
  dismissCompleted: () => void;
  loading: boolean;
  error: string | null;
}

export function useDriverOrder(): UseDriverOrderReturn {
  const { user } = useAuth();
  const [state, setState] = useState<DriverOrderState>({ phase: 'offline', order: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const isOnline = state.phase !== 'offline';

  // Check for existing active order on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const activeOrder = await getCurrentDriverOrder();
        if (cancelled) return;
        if (activeOrder) {
          if (activeOrder.status === 'accepted') {
            setState({ phase: 'active', order: activeOrder });
          } else if (activeOrder.status === 'arrived') {
            setState({ phase: 'arrived', order: activeOrder });
          } else if (activeOrder.status === 'in_progress') {
            setState({ phase: 'in_progress', order: activeOrder });
          } else if (activeOrder.status === 'completed') {
            setState({ phase: 'completed', order: activeOrder });
          }
        }
      } catch {
        // No active order — stay offline
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Pusher events
  const channelName = user && isOnline ? `private-driver.${user.id}` : null;

  const handleDriverOffered = useCallback((data: unknown) => {
    const orderData = data as { order: Order } | Order;
    const order = 'order' in orderData ? orderData.order : orderData;
    setState({ phase: 'offer', order });
  }, []);

  const handleOrderCancelled = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'offline') {
      setState({ phase: 'online_idle', order: null });
    }
  }, []);

  const events = useMemo(
    () => ({
      'order.offered': handleDriverOffered,
      'order.cancelled': handleOrderCancelled,
    }),
    [handleDriverOffered, handleOrderCancelled]
  );

  usePusher({
    channelName,
    events,
    enabled: isOnline,
  });

  // Poll for pending offers when online and idle (fallback if Pusher is down)
  useEffect(() => {
    if (state.phase !== 'online_idle') return;

    let cancelled = false;

    const poll = async () => {
      try {
        const offer = await getPendingOffer();
        if (cancelled) return;
        if (offer) {
          setState({ phase: 'offer', order: offer });
        }
      } catch {
        // Ignore polling errors
      }
    };

    // Poll immediately, then every 5 seconds
    poll();
    const interval = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [state.phase]);

  // Fallback polling for active phases — Pusher is the primary path for the
  // `order.cancelled` event, but if it ever drops (Pusher creds missing,
  // socket disconnects, network blip) the driver could be stuck on a
  // cancelled order forever. Re-fetch every 7s; if the server says there's
  // no active order, assume it was cancelled and reset to online_idle.
  useEffect(() => {
    if (
      state.phase !== 'active' &&
      state.phase !== 'arrived' &&
      state.phase !== 'in_progress'
    ) {
      return;
    }

    let cancelled = false;

    const poll = async (): Promise<void> => {
      try {
        const fresh = await getCurrentDriverOrder();
        if (cancelled) return;
        if (!fresh) {
          // Active-order endpoint returned 404 — order is no longer active
          setState({ phase: 'online_idle', order: null });
          return;
        }
        if (fresh.status === 'cancelled') {
          setState({ phase: 'online_idle', order: null });
        }
      } catch {
        // Ignore network errors — next tick retries
      }
    };

    const interval = setInterval(poll, 7000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [state.phase]);

  const toggleOnline = useCallback(async (latitude: number, longitude: number): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      if (stateRef.current.phase === 'offline') {
        await goOnline(latitude, longitude);
        setState({ phase: 'online_idle', order: null });
      } else {
        await goOffline();
        setState({ phase: 'offline', order: null });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка при переключении';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const acceptOffer = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    if (current.phase !== 'offer') return;
    setError(null);
    setLoading(true);
    try {
      const order = await acceptOrder(current.order.id);
      setState({ phase: 'active', order });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка при принятии заказа';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const declineOffer = useCallback(async (reason: DeclineReason): Promise<void> => {
    const current = stateRef.current;
    if (current.phase !== 'offer') return;
    setError(null);
    setLoading(true);
    try {
      await declineOrder(current.order.id, reason);
      setState({ phase: 'online_idle', order: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка при отклонении заказа';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const markArrived = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    if (current.phase !== 'active') return;
    setError(null);
    setLoading(true);
    try {
      const order = await arriveAtPickup(current.order.id);
      setState({ phase: 'arrived', order });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const markStarted = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    if (current.phase !== 'arrived') return;
    setError(null);
    setLoading(true);
    try {
      const order = await startRide(current.order.id);
      setState({ phase: 'in_progress', order });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const markCompleted = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    if (current.phase !== 'in_progress') return;
    setError(null);
    setLoading(true);
    try {
      const order = await completeOrder(current.order.id);
      setState({ phase: 'completed', order });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelByDriver = useCallback(async (reason: DriverCancellationReason): Promise<void> => {
    const current = stateRef.current;
    if (current.phase !== 'active' && current.phase !== 'arrived') return;
    setError(null);
    setLoading(true);
    try {
      await cancelOrderByDriver(current.order.id, reason);
      setState({ phase: 'online_idle', order: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка отмены';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissCompleted = useCallback((): void => {
    setState({ phase: 'online_idle', order: null });
  }, []);

  return {
    state,
    isOnline,
    toggleOnline,
    acceptOffer,
    declineOffer,
    markArrived,
    markStarted,
    markCompleted,
    cancelByDriver,
    dismissCompleted,
    loading,
    error,
  };
}
