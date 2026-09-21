/** Kalenderhelfer für Wochenband und Wochenplaner. */

const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** ISO-8601-Kalenderwoche */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** „22.–28. September" bzw. „29. September – 5. Oktober" */
export function formatDaySpan(weekStart: Date, language: 'de' | 'en'): string {
  const weekEnd = addDays(weekStart, 6);
  const months = language === 'de' ? MONTHS_DE : MONTHS_EN;
  const startMonth = months[weekStart.getMonth()];
  const endMonth = months[weekEnd.getMonth()];

  if (language === 'en') {
    return startMonth === endMonth
      ? `${startMonth} ${weekStart.getDate()}–${weekEnd.getDate()}`
      : `${startMonth} ${weekStart.getDate()} – ${endMonth} ${weekEnd.getDate()}`;
  }
  return startMonth === endMonth
    ? `${weekStart.getDate()}.–${weekEnd.getDate()}. ${startMonth}`
    : `${weekStart.getDate()}. ${startMonth} – ${weekEnd.getDate()}. ${endMonth}`;
}

/** „22.09." */
export function formatShortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.`;
}

/** 0 = Montag … 6 = Sonntag */
export function mondayBasedDayIndex(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}
