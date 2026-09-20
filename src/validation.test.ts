import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateActiveHours,
  validateHolidays,
  validatePeriod,
  validateTaskTimeoutMs,
  validateTimezone,
  validateWeekDays,
} from './validation.js';

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

  it('rejects equal start and end (zero-length window)', () => {
    assert.throws(
      () => validateActiveHours({ start: '10:00', end: '10:00' }),
      /cannot be equal/
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

  it('rejects dates that match the shape but do not exist on the calendar', () => {
    assert.throws(() => validateHolidays(['2026-13-40']), /calendar dates/);
    assert.throws(() => validateHolidays(['2026-02-30']), /calendar dates/);
    assert.throws(() => validateHolidays(['2026-04-31']), /calendar dates/);
  });

  it('accepts real edge-case calendar dates', () => {
    assert.doesNotThrow(() => validateHolidays(['2026-02-28']));
    assert.doesNotThrow(() => validateHolidays(['2024-02-29'])); // leap year
  });
});

describe('validatePeriod', () => {
  it('accepts zero and positive finite numbers', () => {
    assert.doesNotThrow(() => validatePeriod(0));
    assert.doesNotThrow(() => validatePeriod(5000));
  });

  it('rejects negative numbers', () => {
    assert.throws(() => validatePeriod(-100), /non-negative/);
  });

  it('rejects NaN and non-finite numbers', () => {
    assert.throws(() => validatePeriod(NaN), /non-negative/);
    assert.throws(() => validatePeriod(Infinity), /non-negative/);
  });

  it('rejects non-number types', () => {
    assert.throws(() => validatePeriod('2000' as unknown as number), /non-negative/);
  });
});

describe('validateTaskTimeoutMs', () => {
  it('accepts positive finite numbers', () => {
    assert.doesNotThrow(() => validateTaskTimeoutMs(1));
    assert.doesNotThrow(() => validateTaskTimeoutMs(5000));
  });

  it('rejects zero and negative numbers', () => {
    assert.throws(() => validateTaskTimeoutMs(0), /positive/);
    assert.throws(() => validateTaskTimeoutMs(-100), /positive/);
  });

  it('rejects NaN and non-finite numbers', () => {
    assert.throws(() => validateTaskTimeoutMs(NaN), /positive/);
    assert.throws(() => validateTaskTimeoutMs(Infinity), /positive/);
  });

  it('rejects non-number types', () => {
    assert.throws(() => validateTaskTimeoutMs('1000' as unknown as number), /positive/);
  });
});

describe('validateTimezone', () => {
  it('accepts valid IANA timezones', () => {
    assert.doesNotThrow(() => validateTimezone('Europe/Istanbul'));
    assert.doesNotThrow(() => validateTimezone('UTC'));
  });

  it('rejects invalid IANA timezones', () => {
    assert.throws(() => validateTimezone('Europe/Instabul'), /invalid IANA timezone/);
  });
});
