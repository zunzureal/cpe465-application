/**
 * Date utilities anchored to Asia/Bangkok (UTC+7).
 *
 * Business "day" (e.g., "today's sessions", calendar dot grouping) must be
 * calculated in Bangkok time, never in the device's local timezone or UTC —
 * otherwise users near midnight or backends running in UTC drift by 1 day.
 *
 * Implementation note: we use a fixed +7h offset (Thailand has no DST) instead
 * of Intl.DateTimeFormat to keep this dependency-free and reliable on all RN
 * runtimes (Hermes/JSC, Android/iOS, web).
 */

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Returns a YYYY-MM-DD key in Asia/Bangkok timezone.
 * Accepts a Date or any ISO string that `new Date()` can parse.
 */
export function toBangkokDateKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  // Shift to Bangkok wall-clock by adding the offset, then use UTC getters.
  const shifted = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** YYYY-MM-DD for "today" in Bangkok. */
export function todayBangkokKey(): string {
  return toBangkokDateKey(new Date());
}

/**
 * Calendar parts ({ year, month0, day, weekday }) of a Date as observed in Bangkok.
 * `month0` is 0-indexed to match JS Date conventions. `weekday` is 0=Sun..6=Sat.
 */
export interface BangkokParts {
  year: number;
  month0: number;
  day: number;
  weekday: number;
}

export function bangkokParts(d: Date | string = new Date()): BangkokParts {
  const date = typeof d === 'string' ? new Date(d) : d;
  const shifted = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month0: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * Builds a date key from Bangkok-style calendar parts (year, 0-indexed month, day).
 * Useful when iterating a calendar grid without ever leaving Bangkok semantics.
 */
export function bangkokKeyFromParts(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Number of days in a month, by Bangkok calendar. */
export function daysInBangkokMonth(year: number, month0: number): number {
  // The last day of month is day 0 of next month — standard JS trick, no TZ ambiguity for day count.
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Weekday (0=Sun..6=Sat) of the 1st of given month in Bangkok. */
export function firstDayWeekdayBangkok(year: number, month0: number): number {
  // 1st of month at 00:00 Bangkok = (year-month0-1)T00:00+07:00 → that instant's UTC day.
  return new Date(`${bangkokKeyFromParts(year, month0, 1)}T00:00:00+07:00`).getUTCDay();
}
