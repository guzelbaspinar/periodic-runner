import type { ActiveHours, WeekDay } from './types.js';

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Wall-clock date/time components, already resolved for a given timezone (or local time). */
export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: WeekDay; // 0-6, Sunday=0
}

const WEEKDAY_INDEX: Record<string, WeekDay> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Resolves the wall-clock date/time components of `date` for `timeZone` (or local time
 * when `timeZone` is null), using `Intl.DateTimeFormat.formatToParts`. This avoids the
 * "toLocaleString round-trip" pattern: no string is re-parsed by the `Date` constructor,
 * so behavior stays spec-compliant regardless of JS engine/ICU data, and the numeric
 * components (hour, minute, weekday) are read directly.
 */
export function getZonedParts(date: Date, timeZone: string | null): ZonedParts {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      weekday: date.getDay() as WeekDay,
    };
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // hour12:false with some ICU implementations can output "24"; normalize to 0-23.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday],
  };
}

export function formatDateString(parts: ZonedParts): string {
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

/**
 * Returns true when activeHours is not defined.
 * If start > end, the window wraps past midnight (e.g. 22:00-06:00).
 */
export function isWithinActiveHours(parts: ZonedParts, activeHours: ActiveHours | null): boolean {
  if (!activeHours) return true;

  const startMin = toMinutes(activeHours.start);
  const endMin = toMinutes(activeHours.end);
  const nowMin = parts.hour * 60 + parts.minute;

  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  return nowMin >= startMin || nowMin < endMin;
}

export function isAllowedWeekDay(parts: ZonedParts, weekDays: Set<WeekDay> | null): boolean {
  if (!weekDays) return true;
  return weekDays.has(parts.weekday);
}

export function isHoliday(parts: ZonedParts, holidays: Set<string>): boolean {
  if (holidays.size === 0) return false;
  return holidays.has(formatDateString(parts));
}

export interface RunConstraintsInput {
  activeHours: ActiveHours | null;
  weekDays: Set<WeekDay> | null;
  holidays: Set<string>;
}

export function evaluateRunConstraints(
  parts: ZonedParts,
  { activeHours, weekDays, holidays }: RunConstraintsInput
): { allowed: boolean; reason?: string } {
  if (!isAllowedWeekDay(parts, weekDays)) {
    return { allowed: false, reason: `weekDay ${parts.weekday} is not among the allowed days` };
  }

  if (isHoliday(parts, holidays)) {
    return { allowed: false, reason: `${formatDateString(parts)} is marked as a holiday` };
  }

  if (!isWithinActiveHours(parts, activeHours)) {
    return {
      allowed: false,
      reason: `outside active hours (${activeHours!.start}-${activeHours!.end})`,
    };
  }

  return { allowed: true };
}
