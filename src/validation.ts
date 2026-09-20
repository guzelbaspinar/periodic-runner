import type { ActiveHours, HolidayList, WeekDay } from './types.js';

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Rejects strings that match the "YYYY-MM-DD" shape but are not real calendar dates (e.g. "2026-02-30"). */
function isValidCalendarDate(str: string): boolean {
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function validateActiveHours({ start, end }: ActiveHours): void {
  if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
    throw new Error(
      'PeriodicRunner: activeHours.start and activeHours.end must be in "HH:mm" format (e.g. "09:50")'
    );
  }

  if (start === end) {
    throw new Error(
      'PeriodicRunner: activeHours.start and activeHours.end cannot be equal (results in a zero-length window that never runs); omit activeHours for a full 24h window'
    );
  }
}

export function validateWeekDays(weekDays: WeekDay[]): void {
  const isValid =
    Array.isArray(weekDays) &&
    weekDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (!isValid) {
    throw new Error(
      'PeriodicRunner: weekDays must be an array of numbers between 0 (Sunday) and 6 (Saturday)'
    );
  }
}

export function validateHolidays(holidays: HolidayList): void {
  const isValid =
    (Array.isArray(holidays) || holidays instanceof Set) &&
    Array.from(holidays).every((d) => DATE_PATTERN.test(d) && isValidCalendarDate(d));
  if (!isValid) {
    throw new Error(
      'PeriodicRunner: holidays must be an array or a Set of valid "YYYY-MM-DD" calendar dates (e.g. "2026-01-01")'
    );
  }
}

export function validatePeriod(period: number): void {
  if (typeof period !== 'number' || !Number.isFinite(period) || period < 0) {
    throw new Error('PeriodicRunner: "period" must be a non-negative finite number (ms)');
  }
}

export function validateTaskTimeoutMs(taskTimeoutMs: number): void {
  if (typeof taskTimeoutMs !== 'number' || !Number.isFinite(taskTimeoutMs) || taskTimeoutMs <= 0) {
    throw new Error('PeriodicRunner: "taskTimeoutMs" must be a positive finite number (ms)');
  }
}

export function validateTimezone(timezone: string): void {
  try {
    new Date().toLocaleString('en-US', { timeZone: timezone });
  } catch {
    throw new Error(`PeriodicRunner: invalid IANA timezone: "${timezone}"`);
  }
}
