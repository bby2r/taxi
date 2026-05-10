import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { Alert, Platform, Vibration } from 'react-native';
import { Order, DeclineReason, DriverCancellationReason } from '../api/types';

// Optional dependency — only available once expo-audio is installed and the
// APK is rebuilt. Until then we degrade silently to vibration-only alerts.
let ExpoAudio: typeof import('expo-audio') | null = null;
let LocalNotifications: typeof import('expo-notifications') | null = null;
if (Platform.OS !== 'web') {
  try {
    ExpoAudio = require('expo-audio');
  } catch {
    ExpoAudio = null;
  }
  try {
    LocalNotifications = require('expo-notifications');
  } catch {
    LocalNotifications = null;
  }
}

const VIBRATION_PATTERN = [0, 400, 250, 400, 250, 400];
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
import { consumePendingDriverAction } from '../utils/pendingNotificationAction';

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

// Internal state machine. Wrapped in a Context below so HomeScreen and
// OrderActiveScreen share a single instance — without this, the second
// component spins up its own state initialized to `offline` and the
// OrderActiveScreen's goBack-on-non-active effect bounces the driver
// straight back to the home tab the moment the active order screen mounts.
function useDriverOrderState(): UseDriverOrderReturn {
  const { user } = useAuth();
  const [state, setState] = useState<DriverOrderState>({ phase: 'offline', order: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Track which order we've already alerted about, so the Pusher event and
  // the polling fallback don't both pop an alert for the same cancellation.
  const alertedCancelOrderRef = useRef<number | null>(null);
  // Set by cancelByDriver / declineOffer — suppresses the cancellation alert
  // when the driver themselves caused the state change.
  const suppressNextCancelAlertRef = useRef(false);

  function showCancelledAlert(orderId: number, byClient: boolean): void {
    if (alertedCancelOrderRef.current === orderId) return;
    if (suppressNextCancelAlertRef.current) {
      suppressNextCancelAlertRef.current = false;
      alertedCancelOrderRef.current = orderId;
      return;
    }
    alertedCancelOrderRef.current = orderId;
    Alert.alert(
      'Заказ отменён',
      byClient ? 'Клиент отменил заказ' : 'Заказ отменён',
    );
  }

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
    // Sound + vibration are now driven by phase-tied effects below — they
    // start when phase becomes 'offer' and stop the moment it leaves.
    // No more local notification: the OrderOfferCard is the in-app surface,
    // and the server-side Expo push covers the case when the app is in
    // the background. That removes the duplicate notification the driver
    // saw when the app was already foregrounded.
  }, []);

  const handleOrderCancelled = useCallback((data: unknown) => {
    const current = stateRef.current;
    const wasActive =
      current.phase === 'offer' ||
      current.phase === 'active' ||
      current.phase === 'arrived' ||
      current.phase === 'in_progress';

    if (current.phase !== 'offline') {
      setState({ phase: 'online_idle', order: null });
    }

    if (!wasActive) {
      return;
    }

    const payload = data as { order_id?: number; cancelled_by?: string } | undefined;
    const orderId = payload?.order_id ?? current.order?.id;
    if (orderId === undefined) {
      return;
    }
    showCancelledAlert(orderId, payload?.cancelled_by === 'client');
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

  // When an offer enters state, sweep any matching server push out of the
  // notification shade — the OrderOfferCard is now the source of truth for
  // this offer, and leaving the shade entry there causes a confusing
  // duplicate ("there's a card AND a notification with buttons").
  useEffect(() => {
    if (state.phase !== 'offer') return;
    if (!LocalNotifications || Platform.OS === 'web') return;
    LocalNotifications.dismissAllNotificationsAsync().catch(() => {
      // best-effort cleanup
    });
  }, [state.phase]);

  // Loop the vibration the entire time an offer is on screen — stops the
  // moment the driver accepts/declines, the offer is cancelled by client,
  // or the in-card 20-second timer auto-declines. Android-only repeat;
  // iOS only buzzes once per cycle but still re-fires on each pattern.
  useEffect(() => {
    if (state.phase !== 'offer') {
      return;
    }
    Vibration.vibrate(VIBRATION_PATTERN, true);
    return () => {
      Vibration.cancel();
    };
  }, [state.phase]);

  // Loop the offer sound for the entire offer window. Behaviour is tuned
  // for the worst case — driver listening to music in a noisy car:
  //
  //   - Plays even when the phone is on silent (`playsInSilentMode: true`)
  //   - Ducks any background audio so the alert is audible over music
  //     (`interruptionMode: 'duckOthers'`)
  //   - Doesn't play in background — once the offer card disappears,
  //     audio stops
  //   - Volume forced to 1.0 — Android caps notification volume per
  //     channel, but in-app playback respects this directly
  //
  // The cleanup runs the moment phase leaves 'offer' (accept, decline,
  // 20-second auto-timeout, server-side cancel). Degrades gracefully to
  // vibration-only if expo-audio isn't bundled (older APK).
  useEffect(() => {
    if (state.phase !== 'offer' || !ExpoAudio) {
      return;
    }
    let player: ReturnType<typeof ExpoAudio.createAudioPlayer> | null = null;
    let active = true;

    (async () => {
      try {
        await ExpoAudio!.setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: 'duckOthers',
          interruptionModeAndroid: 'duckOthers',
          allowsRecording: false,
        });
      } catch {
        // setAudioModeAsync isn't critical — proceed even if it fails.
      }

      if (!active) return;

      try {
        const p = ExpoAudio!.createAudioPlayer(
          require('../../assets/sounds/order_arrived.wav'),
        );
        if (!active) {
          p.remove();
          return;
        }
        p.loop = true;
        p.volume = 1.0;
        p.play();
        player = p;
      } catch {
        // file not bundled / module mismatch — fall back to vibration only
      }
    })();

    return () => {
      active = false;
      if (player) {
        try {
          player.pause();
          player.remove();
        } catch {
          // ignore — already torn down
        }
      }
    };
  }, [state.phase]);

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
          const previousOrderId = stateRef.current.order?.id;
          setState({ phase: 'online_idle', order: null });
          if (previousOrderId !== undefined) {
            showCancelledAlert(previousOrderId, true);
          }
          return;
        }
        if (fresh.status === 'cancelled') {
          setState({ phase: 'online_idle', order: null });
          showCancelledAlert(fresh.id, true);
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
      // 422 = order is no longer offered to us (server-side timeout fired,
      // another driver took it, or the client cancelled while we were
      // tapping). Drop back to online_idle and tell the driver, instead
      // of leaving them stuck on a stale offer card.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 422) {
        setState({ phase: 'online_idle', order: null });
        Alert.alert('Заказ уже недоступен', 'Заказ уже принял другой водитель или истекло время.');
      } else {
        const message = err instanceof Error ? err.message : 'Ошибка при принятии заказа';
        setError(message);
      }
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
      // Even if the decline POST fails (e.g. 5xx from a stale order chain),
      // the offer is no longer relevant to this driver — clear the card
      // and let polling / Pusher resync state. Otherwise the card stays
      // stuck and we keep the looping vibration on forever.
      setState({ phase: 'online_idle', order: null });
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 422 && status !== 500) {
        const message = err instanceof Error ? err.message : 'Ошибка при отклонении заказа';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // If the driver tapped "Принять" or "Отказаться" directly inside the
  // notification shade, the action button queued a pending decision in the
  // pendingNotificationAction module. As soon as we have the corresponding
  // offer in state (via Pusher event or polling fallback), consume the
  // queued action and fire the matching API call. The offer card never
  // gets a chance to render — the driver moves straight to the active
  // ride screen (accept) or back to online_idle (decline).
  useEffect(() => {
    if (state.phase !== 'offer') return;
    const queued = consumePendingDriverAction(state.order.id);
    if (queued === 'accept') {
      void acceptOffer();
    } else if (queued === 'decline') {
      void declineOffer('personal');
    }
  }, [state.phase, acceptOffer, declineOffer]);

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
    suppressNextCancelAlertRef.current = true;
    try {
      await cancelOrderByDriver(current.order.id, reason);
      setState({ phase: 'online_idle', order: null });
    } catch (err: unknown) {
      suppressNextCancelAlertRef.current = false;
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

const DriverOrderContext = createContext<UseDriverOrderReturn | null>(null);

export function DriverOrderProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const value = useDriverOrderState();
  return (
    <DriverOrderContext.Provider value={value}>
      {children}
    </DriverOrderContext.Provider>
  );
}

export function useDriverOrder(): UseDriverOrderReturn {
  const ctx = useContext(DriverOrderContext);
  if (!ctx) {
    throw new Error(
      'useDriverOrder must be used within <DriverOrderProvider>',
    );
  }
  return ctx;
}
