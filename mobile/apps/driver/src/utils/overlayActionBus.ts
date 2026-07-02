/**
 * Module-level bus для деплинков активного заказа. Native overlay
 * (ActiveOrderOverlayManager.kt) стреляет startActivity с
 * `aliftaxidriver://active-order/<action>?order_id=<id>`;
 * useNotifications.handleDeepLink парсит URL и вызывает emit().
 * Единственный подписчик — OrderActiveScreen (у него есть order.phone,
 * pickup-координаты и текущая фаза для решения primary → arrived/start/
 * complete). Если тап пришёл до того как экран смонтирован
 * (cold-start), action буферизуется и доставляется на первую подписку.
 */

export type OverlayAction = 'open' | 'call' | 'primary' | 'open-maps';

const OVERLAY_ACTIONS: readonly OverlayAction[] = ['open', 'call', 'primary', 'open-maps'];

export function isOverlayAction(value: string): value is OverlayAction {
  return (OVERLAY_ACTIONS as readonly string[]).includes(value);
}

export interface OverlayActionEvent {
  action: OverlayAction;
  orderId: number;
}

type Handler = (e: OverlayActionEvent) => void;

const listeners = new Set<Handler>();
// Очередь, а не single slot: если пользователь тапнет две кнопки подряд
// пока экран монтируется (cold-start ~1-2с), обе действия сохранятся.
// Cap 8 — параноидальный лимит: overlay не может выстрелить сотнями
// событий (только пользовательские тапы), но без cap багованный
// источник теоретически мог бы выесть память.
const MAX_QUEUE = 8;
const queued: OverlayActionEvent[] = [];

export function emitOverlayAction(event: OverlayActionEvent): void {
  if (listeners.size === 0) {
    if (queued.length < MAX_QUEUE) queued.push(event);
    return;
  }
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // one bad listener не должен блокировать остальные
    }
  }
}

export function subscribeOverlayAction(handler: Handler): () => void {
  listeners.add(handler);
  if (queued.length > 0) {
    const drained = queued.splice(0);
    for (const event of drained) {
      try {
        handler(event);
      } catch {
        // ignore
      }
    }
  }
  return () => {
    listeners.delete(handler);
  };
}
