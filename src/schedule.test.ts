import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRunConstraints,
  formatDateString,
  isAllowedWeekDay,
  isHoliday,
  isWithinActiveHours,
  toMinutes,
} from './schedule.js';

function at(iso: string): Date {
  return new Date(iso);
}

describe('toMinutes', () => {
  it('converts HH:mm to minutes since midnight', () => {
    assert.equal(toMinutes('00:00'), 0);
    assert.equal(toMinutes('09:30'), 9 * 60 + 30);
    assert.equal(toMinutes('23:59'), 23 * 60 + 59);
  });
});

describe('formatDateString', () => {
  it('formats as YYYY-MM-DD in local calendar fields', () => {
    assert.equal(formatDateString(at('2026-03-16T15:00:00')), '2026-03-16');
  });
});

describe('isWithinActiveHours', () => {
  const dayWindow = { start: '09:00', end: '18:00' };

  it('returns true when activeHours is null', () => {
    assert.equal(isWithinActiveHours(at('2026-03-16T03:00:00'), null), true);
  });

  it('respects a same-day window', () => {
    assert.equal(isWithinActiveHours(at('2026-03-16T09:00:00'), dayWindow), true);
    assert.equal(isWithinActiveHours(at('2026-03-16T17:59:00'), dayWindow), true);
    assert.equal(isWithinActiveHours(at('2026-03-16T08:59:00'), dayWindow), false);
    assert.equal(isWithinActiveHours(at('2026-03-16T18:00:00'), dayWindow), false);
  });

  it('supports overnight windows that wrap past midnight', () => {
    const overnight = { start: '22:00', end: '06:00' };
    assert.equal(isWithinActiveHours(at('2026-03-16T23:00:00'), overnight), true);
    assert.equal(isWithinActiveHours(at('2026-03-16T05:30:00'), overnight), true);
    assert.equal(isWithinActiveHours(at('2026-03-16T12:00:00'), overnight), false);
  });
});

describe('isAllowedWeekDay', () => {
  it('allows all days when weekDays is null', () => {
    assert.equal(isAllowedWeekDay(at('2026-03-15T10:00:00'), null), true); // Sunday
  });

  it('checks day-of-week membership', () => {
    const weekdays = new Set([1, 2, 3, 4, 5] as const);
    assert.equal(isAllowedWeekDay(at('2026-03-16T10:00:00'), weekdays), true); // Monday
    assert.equal(isAllowedWeekDay(at('2026-03-15T10:00:00'), weekdays), false); // Sunday
  });
});

describe('isHoliday', () => {
  it('returns false when holiday set is empty', () => {
    assert.equal(isHoliday(at('2026-01-01T10:00:00'), new Set()), false);
  });

  it('matches formatted calendar date', () => {
    const holidays = new Set(['2026-01-01']);
    assert.equal(isHoliday(at('2026-01-01T23:59:00'), holidays), true);
    assert.equal(isHoliday(at('2026-01-02T00:00:00'), holidays), false);
  });
});

describe('evaluateRunConstraints', () => {
  it('returns allowed when all constraints pass', () => {
    const result = evaluateRunConstraints(at('2026-03-16T10:00:00'), {
      activeHours: { start: '09:00', end: '18:00' },
      weekDays: new Set([1, 2, 3, 4, 5]),
      holidays: new Set(),
    });
    assert.equal(result.allowed, true);
    assert.equal(result.reason, undefined);
  });

  it('reports weekday violations first', () => {
    const result = evaluateRunConstraints(at('2026-03-15T10:00:00'), {
      activeHours: null,
      weekDays: new Set([1]),
      holidays: new Set(),
    });
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /weekDay 0/);
  });

  it('reports holidays before active hours', () => {
    const result = evaluateRunConstraints(at('2026-01-01T10:00:00'), {
      activeHours: { start: '09:00', end: '18:00' },
      weekDays: null,
      holidays: new Set(['2026-01-01']),
    });
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /holiday/);
  });

  it('reports active hours when weekday and holiday pass', () => {
    const result = evaluateRunConstraints(at('2026-03-16T20:00:00'), {
      activeHours: { start: '09:00', end: '18:00' },
      weekDays: null,
      holidays: new Set(),
    });
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /outside active hours/);
  });
});
