import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import { Order, OrderStatus, usePusher, useAuth, Haptics } from '@taxi/shared';
import * as ordersApi from '../api/orders';

// Lazy-required so a build without expo-speech still works (it just
// stays silent instead of failing to render).
let Speech: typeof import('expo-speech') | null = null;
try {
  Speech = require('expo-speech');
} catch {
  Speech = null;
}

let ExpoAudio: typeof import('expo-audio') | null = null;
try {
  ExpoAudio = require('expo-audio');
} catch {
  ExpoAudio = null;
}

import { displayClientNotification } from '../lib/notifee';

function showLocalNotification(title: string, body: string): void {
  displayClientNotification({ title, body });
}

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
  callTaxi: (
    latitude: number,
    longitude: number,
    toRegionId: number,
    address?: string,
    comment?: string,
    isRoundTrip?: boolean,
  ) => Promise<void>;
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

  const handleOrderAccepted = useCallback(
    (data: unknown) => {
      // Сразу применяем координаты из payload (latitude/longitude
      // прокинуты сервером в OrderAccepted) — не ждём пока refetch
      // вернётся. Иначе на 1-3 секунды после «Принято» клиент видит
      // карту без машины: маркер AnimatedDriverMarker рендерится
      // только когда driver.latitude число, а refetch может тормозить.
      const payload = data as {
        latitude?: number | null;
        longitude?: number | null;
        driver_id?: number;
        driver_name?: string;
        car_model?: string;
        car_number?: string;
      };
      // Дедуп повторных Pusher-broadcast'ов: если водитель уже прописан
      // на текущем заказе и order.status уже 'accepted' — это retry
      // сокета/бекенда, не дёргаем notification+getOrder+setState снова.
      const alreadyAssigned =
        orderRef.current?.driver != null &&
        orderRef.current.status === 'accepted';
      if (alreadyAssigned) return;
      // Звуковая шторка идёт БЕЗ условия на координаты — раньше при
      // отсутствии coords в payload клиент вообще не получал алерт про
      // назначение водителя. Optimistic-заполнение driver'а под if:
      // без coords маркер на карте не построишь.
      Haptics.success();
      showLocalNotification(
        'Водитель найден',
        payload.driver_name
          ? `${payload.driver_name} едет к вам`
          : 'Ваш водитель в пути',
      );
      if (orderRef.current && typeof payload.latitude === 'number' && typeof payload.longitude === 'number') {
        const prevDriver = orderRef.current.driver;
        const optimistic: Order = {
          ...orderRef.current,
          driver: {
            name: payload.driver_name ?? prevDriver?.name ?? '',
            phone: prevDriver?.phone ?? '',
            car_model: payload.car_model ?? prevDriver?.car_model ?? '',
            car_number: payload.car_number ?? prevDriver?.car_number ?? '',
            latitude: payload.latitude,
            longitude: payload.longitude,
            heading: prevDriver?.heading ?? null,
            // Рейтинг + photo придут с refetch — пока заполняем из
            // prevDriver или null, чтобы тип Driver был полным.
            rating_avg: prevDriver?.rating_avg ?? null,
            rating_count: prevDriver?.rating_count ?? 0,
            photo_url: prevDriver?.photo_url ?? null,
          },
        };
        orderRef.current = optimistic;
        setState(buildState('accepted', optimistic));
      }
      // Refetch всё равно зовём — он принесёт полные car_model/car_number
      // и любые поля которые в Pusher payload могут быть устаревшими.
      refreshAndSetPhase('accepted');
    },
    [refreshAndSetPhase],
  );

  const handleDriverArrived = useCallback(() => {
    // Раньше был 3-слойный alert (длинная вибрация + TTS «ваш водитель
    // прибыл» + audio-mode bump), задумано чтобы клиент не пропустил
    // прибытие даже на беззвучном. По UX это оказалось слишком громко:
    // клиент попросил «звук как смски». Короткая вибрация + системный
    // шторка со звуком уведомления делают то же самое, но не срывают
    // разговор в аудио-приложении и не звучат как тревога.
    Vibration.vibrate([0, 200]);

    const driverName = orderRef.current?.driver?.name;
    showLocalNotification(
      'Водитель ожидает вас',
      driverName ? `${driverName} прибыл в точку подачи` : 'Водитель прибыл',
    );

    refreshAndSetPhase('arrived');
  }, [refreshAndSetPhase]);

  const handleOrderInProgress = useCallback(() => {
    // Клиент мог убрать телефон в карман после посадки — короткое
    // уведомление помогает не пропустить момент старта поездки
    // (запускается отсчёт стоимости, включается таймер и т.д.).
    Haptics.success();
    Vibration.vibrate([0, 200]);
    const driverName = orderRef.current?.driver?.name;
    showLocalNotification(
      'Поездка началась',
      driverName ? `${driverName} везёт вас к точке назначения` : 'Мы в пути',
    );
    refreshAndSetPhase('in_progress');
  }, [refreshAndSetPhase]);

  const handleOrderCompleted = useCallback(() => {
    Haptics.success();
    showLocalNotification('Поездка завершена', 'Спасибо, что выбрали Alif Taxi');
    refreshAndSetPhase('completed');
  }, [refreshAndSetPhase]);

  const handleDriverLocation = useCallback((data: unknown) => {
    const payload = data as { latitude?: number; longitude?: number; heading?: number | null };
    if (
      typeof payload.latitude !== 'number' ||
      typeof payload.longitude !== 'number'
    ) {
      return;
    }
    const lat = payload.latitude;
    const lng = payload.longitude;
    const heading = typeof payload.heading === 'number' ? payload.heading : null;
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
          latitude: lat,
          longitude: lng,
          heading,
        },
      };
      orderRef.current = nextOrder;
      return { ...prev, order: nextOrder };
    });
  }, []);

  const handleOrderCancelled = useCallback(async () => {
    Haptics.warning();
    Vibration.vibrate([0, 200]);
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
    showLocalNotification(
      reason === 'no_drivers' ? 'Свободных водителей нет' : 'Заказ отменён',
      reason === 'no_drivers'
        ? 'Попробуйте вызвать такси чуть позже'
        : 'Мы вернём вас на главный экран',
    );
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

  // Foreground resync: RN замораживает JS-timer'ы и Pusher-socket когда
  // app в background. Если водитель нажал «Прибыл» / клиент отменил заказ
  // пока клиент был вне app'a — событие теряется. При возврате в
  // foreground тянем актуальный order с сервера и синхронизируем phase.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active') return;
      const currentPhase = state.phase;
      if (currentPhase === 'idle' || currentPhase === 'completed' || currentPhase === 'cancelled') {
        try {
          const current = await ordersApi.getCurrentOrder();
          if (current) {
            orderRef.current = current;
            setState(buildState(statusToPhase(current.status), current));
          }
        } catch {
          // network flake — polling подхватит
        }
        return;
      }
      const orderId = 'order' in state ? state.order.id : null;
      if (!orderId) return;
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
        }
        setState(buildState(phase, fresh));
      } catch {
        // сеть моргнула — периодический polling выше подберёт
      }
    });
    return () => sub.remove();
  }, [state]);

  const callTaxi = useCallback(
    async (
      latitude: number,
      longitude: number,
      toRegionId: number,
      address?: string,
      comment?: string,
      isRoundTrip?: boolean,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const order = await ordersApi.createOrder(
          latitude,
          longitude,
          toRegionId,
          address,
          comment,
          isRoundTrip,
        );
        Haptics.medium();
        orderRef.current = order;
        setState({ phase: 'searching', order });
      } catch (e: unknown) {
        const axiosError = e as { response?: { data?: { message?: string } } };
        setError(axiosError.response?.data?.message || 'Не удалось создать заказ');
      } finally {
        setLoading(false);
      }
    },
    [],
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

  return { state, callTaxi, cancelOrder, dismissCompleted, loading, error };
}
