import { useEffect, useRef } from 'react';
import Pusher from 'pusher-js/react-native';
import { PUSHER_KEY, PUSHER_CLUSTER, API_BASE_URL } from '../utils/constants';
import { getToken } from '../utils/storage';

type EventCallback = (data: unknown) => void;

interface UsePusherOptions {
  channelName: string | null;
  events: Record<string, EventCallback>;
  enabled?: boolean;
}

export function usePusher({ channelName, events, enabled = true }: UsePusherOptions): void {
  const pusherRef = useRef<Pusher | null>(null);

  useEffect(() => {
    if (!channelName || !enabled) {
      return;
    }

    let cancelled = false;

    (async () => {
      const token = await getToken();
      if (cancelled) {
        return;
      }

      const pusher = new Pusher(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER,
        authEndpoint: `${API_BASE_URL}/broadcasting/auth`,
        auth: {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      });

      pusherRef.current = pusher;
      const channel = pusher.subscribe(channelName);

      Object.entries(events).forEach(([eventName, callback]) => {
        channel.bind(eventName, callback);
      });
    })();

    return () => {
      cancelled = true;
      if (pusherRef.current) {
        pusherRef.current.unsubscribe(channelName);
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
    };
  }, [channelName, enabled]);
}
