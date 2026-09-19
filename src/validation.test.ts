import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateActiveHours, validateHolidays, validateWeekDays } from './validation.js';

describe('validateActiveHours', () => {
  it('accepts valid HH:mm values', () => {
    assert.doesNotThrow(() => validateActiveHours({ start: '09:50', end: '18:30' }));
    assert.doesNotThrow(() => validateActiveHours({ start: '00:00', end: '23:59' }));
  });

  it('rejects invalid time formats', () => {
    assert.throws(
      () => validateActiveHours({ start: '24:00', end: '18:00' }),
      /HH:mm/
    );
    assert.throws(
      () => validateActiveHours({ start: '9:00', end: '18:00' }),
      /HH:mm/
    );
    assert.throws(
      () => validateActiveHours({ start: '09:60', end: '18:00' }),
      /HH:mm/
    );
  });
});

describe('validateWeekDays', () => {
  it('accepts integers 0 through 6', () => {
    assert.doesNotThrow(() => validateWeekDays([0, 1, 2, 3, 4, 5, 6]));
    assert.doesNotThrow(() => validateWeekDays([1, 3, 5]));
  });

  it('rejects out-of-range or non-integer values', () => {
    assert.throws(() => validateWeekDays([7] as never), /weekDays/);
    assert.throws(() => validateWeekDays([-1] as never), /weekDays/);
    assert.throws(() => validateWeekDays([1.5] as never), /weekDays/);
  });
});

describe('validateHolidays', () => {
  it('accepts arrays and Sets of YYYY-MM-DD strings', () => {
    assert.doesNotThrow(() => validateHolidays(['2026-01-01']));
    assert.doesNotThrow(() => validateHolidays(new Set(['2026-04-23', '2026-05-01'])));
  });

  it('rejects invalid date strings', () => {
    assert.throws(() => validateHolidays(['2026-1-1']), /YYYY-MM-DD/);
    assert.throws(() => validateHolidays(['01-01-2026']), /YYYY-MM-DD/);
    assert.throws(() => validateHolidays(new Set(['not-a-date'])), /YYYY-MM-DD/);
  });
});
