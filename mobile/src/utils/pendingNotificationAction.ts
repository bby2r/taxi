/**
 * Holds an action a driver tapped from a notification's action button
 * (Принять / Отказаться) until the JS side has hydrated enough to
 * actually execute it. Useful both for warm-app taps (notification
 * arrives while app is in background) and cold-start taps (app was
 * killed; OS launched it from the notification).
 */

interface PendingDriverAction {
  orderId: number;
  kind: 'accept' | 'decline';
}

let pending: PendingDriverAction | null = null;

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
