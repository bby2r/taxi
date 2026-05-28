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
