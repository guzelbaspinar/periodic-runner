import type { ActiveHours, HolidayList, WeekDay } from './types.js';

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateActiveHours({ start, end }: ActiveHours): void {
  if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
    throw new Error(
      'PeriodicRunner: activeHours.start and activeHours.end must be in "HH:mm" format (e.g. "09:50")'
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
    Array.from(holidays).every((d) => DATE_PATTERN.test(d));
  if (!isValid) {
    throw new Error(
      'PeriodicRunner: holidays must be an array or a Set of "YYYY-MM-DD" strings (e.g. "2026-01-01")'
    );
  }
}
