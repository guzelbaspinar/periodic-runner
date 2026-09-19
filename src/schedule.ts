import type { ActiveHours, WeekDay } from './types.js';

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatDateString(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns true when activeHours is not defined.
 * If start > end, the window wraps past midnight (e.g. 22:00-06:00).
 */
export function isWithinActiveHours(now: Date, activeHours: ActiveHours | null): boolean {
  if (!activeHours) return true;

  const startMin = toMinutes(activeHours.start);
  const endMin = toMinutes(activeHours.end);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  return nowMin >= startMin || nowMin < endMin;
}

export function isAllowedWeekDay(now: Date, weekDays: Set<WeekDay> | null): boolean {
  if (!weekDays) return true;
  return weekDays.has(now.getDay() as WeekDay);
}

export function isHoliday(now: Date, holidays: Set<string>): boolean {
  if (holidays.size === 0) return false;
  return holidays.has(formatDateString(now));
}

export interface RunConstraintsInput {
  activeHours: ActiveHours | null;
  weekDays: Set<WeekDay> | null;
  holidays: Set<string>;
}

export function evaluateRunConstraints(
  now: Date,
  { activeHours, weekDays, holidays }: RunConstraintsInput
): { allowed: boolean; reason?: string } {
  if (!isAllowedWeekDay(now, weekDays)) {
    return { allowed: false, reason: `weekDay ${now.getDay()} is not among the allowed days` };
  }

  if (isHoliday(now, holidays)) {
    return { allowed: false, reason: `${formatDateString(now)} is marked as a holiday` };
  }

  if (!isWithinActiveHours(now, activeHours)) {
    return {
      allowed: false,
      reason: `outside active hours (${activeHours!.start}-${activeHours!.end})`,
    };
  }

  return { allowed: true };
}
