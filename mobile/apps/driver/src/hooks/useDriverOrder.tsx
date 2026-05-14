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
import { Order, DeclineReason, DriverCancellationReason, useAuth, usePusher } from '@taxi/shared';
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
import {
  consumePendingDriverAction,
  setPendingDriverAction,
} from '../utils/pendingNotificationAction';
import {
  displayOfferNotification,
  dismissOfferNotification,
  ensureNotifeeChannel,
  isNotifeeAvailable,
  subscribeForegroundEvents,
} from '../lib/notifee';
import {
  raiseVolumeForOffer,
  restoreVolumeAfterOffer,
} from '../lib/volumeGuard';
import {
  startShiftForegroundService,
  stopShiftForegroundService,
} from '../lib/foregroundService';
import { AppState as RNAppState } from 'react-native';

// Locally-resolved overlay module — same lazy-require pattern as the rest
// of /lib/. Old APKs without the native module fall through to the
// existing notifee fullScreenAction path.
let OfferOverlay: typeof import('../../modules/offer-overlay/src') | null = null;
if (Platform.OS === 'android') {
  try {
    OfferOverlay = require('../../modules/offer-overlay/src');
  } catch {
    OfferOverlay = null;
  }
}

// Optional native modules — degrade to vibration-only if the APK was built
// before they were added (require() throws → we just stay silent).
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

// 401 here means the Sanctum token is stale (backend was restarted with a
// fresh DB, or token was revoked); 5xx + ECONNABORTED cover Render cold
// starts and ngrok HTML auth-walls. Raw axios messages aren't useful to a
// driver mid-ride, so we map to Russian hints.
function describeDriverActionError(err: unknown): string {
  const response = (err as { response?: { status?: number } })?.response;
  const status = response?.status;
  if (status === 401) {
    return 'Сессия истекла. Войдите в приложение заново.';
  }
  if (status === 503 || status === 502 || status === 504) {
    return 'Сервер временно недоступен, попробуйте ещё раз через минуту.';
  }
  if (status === 408 || (err as { code?: string })?.code === 'ECONNABORTED') {
    return 'Нет связи с сервером. Проверьте интернет и попробуйте снова.';
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Ошибка';
}

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

  // Subscribe to notifee shade-button presses while the app is alive.
  // When the driver taps Принять / Отказаться directly in the
  // heads-up / full-screen notification, the action id + order id come
  // through here. We queue them via pendingDriverAction so the existing
  // offer-arrival effect (below) picks them up the moment Pusher
  // delivers the matching offer.
  useEffect(() => {
    const unsub = subscribeForegroundEvents(({ actionId, orderId }) => {
      if (orderId === null) return;
      if (actionId === 'accept' || actionId === 'decline') {
        setPendingDriverAction({ orderId, kind: actionId });
      }
    });
    return () => {
      unsub();
    };
  }, []);

  // Overlay buttons fire *after* phase becomes 'offer', so a phase-only
  // effect would miss them. The tick bumps on every tap to re-run the
  // pending-action drainer below.
  const [overlayActionTick, setOverlayActionTick] = useState(0);
  useEffect(() => {
    if (!OfferOverlay) return;
    const sub = OfferOverlay.addOfferOverlayListener((event) => {
      if (event.orderId < 0) return;
      if (event.action !== 'accept' && event.action !== 'decline') return;
      setPendingDriverAction({ orderId: event.orderId, kind: event.action });
      setOverlayActionTick((t) => t + 1);
    });
    return () => {
      sub.remove();
    };
  }, []);

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

  // When an offer enters state, fire the Yandex-style notifee notification:
  // full-screen on lock screen, looping ringtone via the alarm stream,
  // Принять / Отказаться buttons. Notifee handles the alarm bypass,
  // looping sound, and timeout. We dismiss it the moment the offer leaves
  // state so the loop stops immediately on accept / decline / cancel.
  //
  // If notifee isn't bundled (older APK), we fall back to the previous
  // expo-notifications local schedule so the driver still gets *something*.
  useEffect(() => {
    if (state.phase !== 'offer') return;
    if (Platform.OS === 'web') return;

    const orderId = state.order.id;
    const body = state.order.pickup_address
      ? `Подача: ${state.order.pickup_address} · ${state.order.price} сом`
      : `Новый заказ · ${state.order.price} сом`;

    // Clear any leftover entries before showing the fresh one.
    LocalNotifications?.dismissAllNotificationsAsync().catch(() => {});

    let notifeeId: string | null = null;

    if (isNotifeeAvailable()) {
      // Notifee path — full Yandex Pro UX.
      (async () => {
        await ensureNotifeeChannel();
        notifeeId = await displayOfferNotification({
          orderId,
          title: 'Новый заказ',
          body,
          expiresInSeconds: 30,
        });
      })();
    } else if (LocalNotifications) {
      // Fallback path for APKs built before notifee landed.
      LocalNotifications.scheduleNotificationAsync({
        content: {
          title: 'Новый заказ',
          body,
          data: { type: 'new_order_silent', order_id: orderId },
        } as Parameters<typeof LocalNotifications.scheduleNotificationAsync>[0]['content'],
        trigger:
          Platform.OS === 'android'
            ? ({ channelId: 'driver_offers_v3' } as unknown as Parameters<
                typeof LocalNotifications.scheduleNotificationAsync
              >[0]['trigger'])
            : null,
      })
        .then((id) => {
          notifeeId = id; // reused var, expo-notifications also returns string id
        })
        .catch(() => {
          // vibration + in-app audio loop still alert
        });
    }

    return () => {
      if (isNotifeeAvailable()) {
        dismissOfferNotification(notifeeId).catch(() => {});
      } else if (notifeeId && LocalNotifications) {
        LocalNotifications.cancelScheduledNotificationAsync(notifeeId).catch(() => {});
      }
      LocalNotifications?.dismissAllNotificationsAsync().catch(() => {});
    };
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

  // Bottom-sheet overlay on top of any other app while the offer is live
  // AND the driver is currently in another app (background AppState).
  // While the app is in the foreground, the in-app OrderOfferCard is
  // already visible — we hide the overlay so the driver doesn't see two
  // copies of the same offer. The overlay's own accept/decline button
  // presses route through the subscribeForegroundEvents above and end
  // up firing the existing acceptOffer / declineOffer flow.
  useEffect(() => {
    if (state.phase !== 'offer' || !OfferOverlay) return;
    if (!OfferOverlay.isOfferOverlayAvailable()) return;

    let active = true;

    const showIfNeeded = (appState: string): void => {
      if (!active) return;
      if (!OfferOverlay!.hasOverlayPermission()) return;
      if (appState === 'active') {
        OfferOverlay!.hideOfferOverlay();
        return;
      }
      OfferOverlay!.showOfferOverlay({
        orderId: state.order.id,
        address: state.order.pickup_address ?? 'Геолокация клиента',
        price: state.order.price,
        durationSeconds: 20,
      });
    };

    showIfNeeded(RNAppState.currentState);
    const sub = RNAppState.addEventListener('change', (next) => {
      showIfNeeded(next);
    });

    return () => {
      active = false;
      sub.remove();
      OfferOverlay?.hideOfferOverlay();
    };
  }, [state.phase, state.phase === 'offer' ? state.order.id : null]);

  // Yandex-style aggressive volume management: when an offer lands we
  // snapshot the driver's current volume, raise it to ~95%, and listen
  // for manual changes — if the driver tries to lower it while the offer
  // card is on screen, the listener clamps it back up. When the offer
  // leaves state (accept / decline / timeout / cancel) we restore the
  // original volume the driver had set. Android-only via native
  // AudioManager hooks; silent no-op on iOS or older APKs.
  useEffect(() => {
    if (state.phase !== 'offer') return;
    void raiseVolumeForOffer();
    return () => {
      void restoreVolumeAfterOffer();
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
        // Foreground service keeps the JS process alive so Pusher stays
        // connected and notifee can fire full-screen incoming-call
        // notifications even when the app is swiped away or the screen
        // is locked. No-op on iOS / older APKs.
        void startShiftForegroundService();
      } else {
        await goOffline();
        setState({ phase: 'offline', order: null });
        void stopShiftForegroundService();
      }
    } catch (err: unknown) {
      const response = (err as {
        response?: { status?: number; data?: { message?: string; blocked_until?: string } };
      })?.response;

      // Driver hit the 5-decline shift block. The server returns 423 with
      // the Russian message and `blocked_until`. Show a friendly alert
      // with the wall-clock time instead of a raw HTTP error.
      if (response?.status === 423) {
        const until = response.data?.blocked_until
          ? new Date(response.data.blocked_until)
          : null;
        const untilText = until
          ? until.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
          : null;
        Alert.alert(
          'Вы временно заблокированы',
          untilText
            ? `За частые отказы выход на линию закрыт до ${untilText}. После этого времени откройте приложение заново.`
            : (response.data?.message ?? 'За частые отказы выход на линию временно закрыт.'),
        );
        return;
      }

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

  // Drain a queued accept/decline from the notifee shade button or the
  // system-alert-window overlay. Phase change covers shade taps that
  // arrive before the offer Pusher event; overlayActionTick covers
  // overlay taps that happen after phase is already 'offer'.
  useEffect(() => {
    if (state.phase !== 'offer') return;
    const queued = consumePendingDriverAction(state.order.id);
    if (queued === 'accept') {
      void acceptOffer();
    } else if (queued === 'decline') {
      void declineOffer('personal');
    }
  }, [state.phase, overlayActionTick, acceptOffer, declineOffer]);

  const markArrived = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    if (current.phase !== 'active') return;
    setError(null);
    setLoading(true);
    try {
      const order = await arriveAtPickup(current.order.id);
      setState({ phase: 'arrived', order });
    } catch (err: unknown) {
      setError(describeDriverActionError(err));
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
      setError(describeDriverActionError(err));
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
      setError(describeDriverActionError(err));
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
      setError(describeDriverActionError(err));
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
