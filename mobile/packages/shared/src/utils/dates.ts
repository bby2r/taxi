/**
 * "Сегодня" / "Завтра" / "5 апреля" — единое русское оформление для
 * meeting-times через все экраны (intercity, history, etc.).
 */
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function tomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function formatHumanDate(ymd: string): string {
  const d = new Date(ymd);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const toYmd = (x: Date): string => x.toISOString().slice(0, 10);
  if (toYmd(d) === toYmd(today)) return 'сегодня';
  if (toYmd(d) === toYmd(tomorrow)) return 'завтра';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/**
 * "Чт, 28 мая, 07:00" из ISO timestamp. Используется в межгород-карточках
 * у клиента (с днём недели) и водителя (без).
 */
export function formatDeparture(iso: string, opts?: { weekday?: boolean }): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const dateOpts: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      ...(opts?.weekday ? { weekday: 'short' } : {}),
    };
    return `${d.toLocaleDateString('ru-RU', dateOpts)}, ${hh}:${mm}`;
  } catch {
    return iso;
  }
}
