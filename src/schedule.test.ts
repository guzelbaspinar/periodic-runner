import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRunConstraints,
  formatDateString,
  getZonedParts,
  isAllowedWeekDay,
  isHoliday,
  isWithinActiveHours,
  toMinutes,
  type ZonedParts,
} from './schedule.js';

function at(iso: string): Date {
  return new Date(iso);
}

function parts(overrides: Partial<ZonedParts>): ZonedParts {
  return {
    year: 2026,
    month: 3,
    day: 16,
    hour: 10,
    minute: 0,
    weekday: 1,
    ...overrides,
  };
}

describe('toMinutes', () => {
  it('converts HH:mm to minutes since midnight', () => {
    assert.equal(toMinutes('00:00'), 0);
    assert.equal(toMinutes('09:30'), 9 * 60 + 30);
    assert.equal(toMinutes('23:59'), 23 * 60 + 59);
  });
});

describe('getZonedParts', () => {
  it('reads local wall-clock components when timeZone is null', () => {
    const date = at('2026-03-16T15:30:00');
    const result = getZonedParts(date, null);
    assert.equal(result.year, date.getFullYear());
    assert.equal(result.month, date.getMonth() + 1);
    assert.equal(result.day, date.getDate());
    assert.equal(result.hour, date.getHours());
    assert.equal(result.minute, date.getMinutes());
    assert.equal(result.weekday, date.getDay());
  });

  it('resolves components for a configured IANA timezone', () => {
    // 2026-03-16T10:00:00Z -> Europe/Istanbul is UTC+3 in March (no DST there since 2016).
    const date = new Date('2026-03-16T10:00:00Z');
    const result = getZonedParts(date, 'Europe/Istanbul');
    assert.equal(result.year, 2026);
    assert.equal(result.month, 3);
    assert.equal(result.day, 16);
    assert.equal(result.hour, 13);
    assert.equal(result.minute, 0);
    assert.equal(result.weekday, 1); // Monday
  });

  it('resolves a different weekday/date when the timezone crosses midnight', () => {
    // 2026-03-16T23:30:00Z is already 2026-03-17 in UTC+something zones ahead of UTC.
    const date = new Date('2026-03-16T23:30:00Z');
    const result = getZonedParts(date, 'Europe/Istanbul'); // UTC+3
    assert.equal(result.day, 17);
    assert.equal(result.hour, 2);
    assert.equal(result.weekday, 2); // Tuesday
  });

  it('resolves UTC consistently', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const result = getZonedParts(date, 'UTC');
    assert.equal(result.year, 2026);
    assert.equal(result.month, 1);
    assert.equal(result.day, 1);
    assert.equal(result.hour, 0);
    assert.equal(result.minute, 0);
    assert.equal(result.weekday, 4); // Thursday
  });
});

describe('formatDateString', () => {
  it('formats ZonedParts as YYYY-MM-DD, zero-padded', () => {
    assert.equal(formatDateString(parts({ year: 2026, month: 3, day: 16 })), '2026-03-16');
    assert.equal(formatDateString(parts({ year: 2026, month: 1, day: 1 })), '2026-01-01');
  });
});

describe('isWithinActiveHours', () => {
  const dayWindow = { start: '09:00', end: '18:00' };

  it('returns true when activeHours is null', () => {
    assert.equal(isWithinActiveHours(parts({ hour: 3, minute: 0 }), null), true);
  });

  it('respects a same-day window', () => {
    assert.equal(isWithinActiveHours(parts({ hour: 9, minute: 0 }), dayWindow), true);
    assert.equal(isWithinActiveHours(parts({ hour: 17, minute: 59 }), dayWindow), true);
    assert.equal(isWithinActiveHours(parts({ hour: 8, minute: 59 }), dayWindow), false);
    assert.equal(isWithinActiveHours(parts({ hour: 18, minute: 0 }), dayWindow), false);
  });

  it('supports overnight windows that wrap past midnight', () => {
    const overnight = { start: '22:00', end: '06:00' };
    assert.equal(isWithinActiveHours(parts({ hour: 23, minute: 0 }), overnight), true);
    assert.equal(isWithinActiveHours(parts({ hour: 5, minute: 30 }), overnight), true);
    assert.equal(isWithinActiveHours(parts({ hour: 12, minute: 0 }), overnight), false);
  });
});

describe('isAllowedWeekDay', () => {
  it('allows all days when weekDays is null', () => {
    assert.equal(isAllowedWeekDay(parts({ weekday: 0 }), null), true); // Sunday
  });

  it('checks day-of-week membership', () => {
    const weekdays = new Set([1, 2, 3, 4, 5] as const);
    assert.equal(isAllowedWeekDay(parts({ weekday: 1 }), weekdays), true); // Monday
    assert.equal(isAllowedWeekDay(parts({ weekday: 0 }), weekdays), false); // Sunday
  });
});

describe('isHoliday', () => {
  it('returns false when holiday set is empty', () => {
    assert.equal(isHoliday(parts({ year: 2026, month: 1, day: 1 }), new Set()), false);
  });

  it('matches formatted calendar date', () => {
    const holidays = new Set(['2026-01-01']);
    assert.equal(isHoliday(parts({ year: 2026, month: 1, day: 1 }), holidays), true);
    assert.equal(isHoliday(parts({ year: 2026, month: 1, day: 2 }), holidays), false);
  });
});

describe('evaluateRunConstraints', () => {
  it('returns allowed when all constraints pass', () => {
    const result = evaluateRunConstraints(parts({ weekday: 1, hour: 10, minute: 0 }), {
      activeHours: { start: '09:00', end: '18:00' },
      weekDays: new Set([1, 2, 3, 4, 5]),
      holidays: new Set(),
    });
    assert.equal(result.allowed, true);
    assert.equal(result.reason, undefined);
  });

  it('reports weekday violations first', () => {
    const result = evaluateRunConstraints(parts({ weekday: 0 }), {
      activeHours: null,
      weekDays: new Set([1]),
      holidays: new Set(),
    });
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /weekDay 0/);
  });

  it('reports holidays before active hours', () => {
    const result = evaluateRunConstraints(parts({ year: 2026, month: 1, day: 1, weekday: 4 }), {
      activeHours: { start: '09:00', end: '18:00' },
      weekDays: null,
      holidays: new Set(['2026-01-01']),
    });
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /holiday/);
  });

  it('reports active hours when weekday and holiday pass', () => {
    const result = evaluateRunConstraints(parts({ hour: 20, minute: 0 }), {
      activeHours: { start: '09:00', end: '18:00' },
      weekDays: null,
      holidays: new Set(),
    });
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /outside active hours/);
  });
});
