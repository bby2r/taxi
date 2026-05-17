/**
 * Holds an action a driver tapped from a notification's action button
 * (Принять / Отказаться) until the JS side has hydrated enough to
 * actually execute it. Useful both for warm-app taps (notification
 * arrives while app is in background) and cold-start taps (app was
 * killed; OS launched it from the notification).
 */

import { Linking } from 'react-native';

interface PendingDriverAction {
  orderId: number;
  kind: 'accept' | 'decline';
}

let pending: PendingDriverAction | null = null;

// Cold-start race fix: useDriverOrder.syncFromServer effect would fire
// before useNotifications had a chance to resolve Linking.getInitialURL,
// so peekPendingDriverAction returned null and sync put state into
// phase='offer'. The OrderOfferCard would flash for the duration of
// the subsequent acceptOrder round-trip before phase='active' settled.
//
// Drain the launch URL eagerly as a module-level promise on first
// import; syncFromServer awaits it so the queue is hydrated before
// the peek check runs.
let launchActionPromise: Promise<void> | null = null;

export function ensureLaunchActionConsumed(): Promise<void> {
  if (launchActionPromise) return launchActionPromise;
  launchActionPromise = (async () => {
    try {
      const url = await Linking.getInitialURL();
      const parsed = parseOfferDeepLink(url);
      if (parsed) pending = parsed;
    } catch {
      // ignore
    }
  })();
  return launchActionPromise;
}

function parseOfferDeepLink(url: string | null): PendingDriverAction | null {
  if (!url || !url.startsWith('aiyltaxidriver://offer')) return null;
  try {
    const parsed = new URL(url);
    const action = parsed.searchParams.get('action');
    const orderIdRaw = parsed.searchParams.get('order_id');
    const orderId = orderIdRaw ? parseInt(orderIdRaw, 10) : NaN;
    if (Number.isFinite(orderId) && (action === 'accept' || action === 'decline')) {
      return { orderId, kind: action };
    }
  } catch {
    // malformed URL — ignore
  }
  return null;
}

export function setPendingDriverAction(action: PendingDriverAction): void {
  pending = action;
}

/**
 * Returns + clears the queued action only if it targets the order we just
 * received. Returns null otherwise so we don't accidentally accept the
 * wrong order if the driver opened a stale notification.
 */
export function consumePendingDriverAction(orderId: number): 'accept' | 'decline' | null {
  if (!pending) {
    return null;
  }
  if (pending.orderId !== orderId) {
    return null;
  }
  const kind = pending.kind;
  pending = null;
  return kind;
}

export function clearPendingDriverAction(): void {
  pending = null;
}

/**
 * Non-destructive variant. Returns the queued kind for an order without
 * clearing the queue — useful when sync code wants to short-circuit
 * showing the offer card (since the driver already chose) but lets the
 * regular drainer actually consume + dispatch.
 */
export function peekPendingDriverAction(orderId: number): 'accept' | 'decline' | null {
  if (!pending) return null;
  if (pending.orderId !== orderId) return null;
  return pending.kind;
}
