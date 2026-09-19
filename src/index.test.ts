import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import PeriodicRunnerDefault, { PeriodicRunner } from './index.js';
import type { Logger } from './types.js';

function silentLogger(): Logger {
  return { debug: () => {}, error: () => {} };
}

function noopTask() {}

describe('PeriodicRunner constructor', () => {
  it('requires a task function', () => {
    assert.throws(
      () => new PeriodicRunner({ task: undefined as unknown as () => void }),
      /task.*required/
    );
  });

  it('throws on invalid activeHours', () => {
    assert.throws(
      () =>
        new PeriodicRunner({
          task: noopTask,
          activeHours: { start: 'bad', end: '18:00' },
        }),
      /HH:mm/
    );
  });

  it('throws on invalid weekDays', () => {
    assert.throws(
      () =>
        new PeriodicRunner({
          task: noopTask,
          weekDays: [8 as never],
        }),
      /weekDays/
    );
  });

  it('throws on invalid holidays', () => {
    assert.throws(
      () =>
        new PeriodicRunner({
          task: noopTask,
          holidays: ['2026-1-1'],
        }),
      /YYYY-MM-DD/
    );
  });

  it('accepts an empty holidays array', () => {
    const runner = new PeriodicRunner({ task: noopTask, holidays: [] });
    assert.equal(runner.getHolidays().size, 0);
  });

  it('accepts an empty weekDays array', () => {
    const runner = new PeriodicRunner({ task: noopTask, weekDays: [] });
    assert.deepEqual(runner.getWeekDays(), []);
  });

  it('falls back to the default logger when logger is null', async () => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const errorMock = mock.method(console, 'error', () => {});
    try {
      const runner = new PeriodicRunner({
        period: 100,
        task: () => {
          throw new Error('task failed');
        },
        logger: null as unknown as Logger,
      });
      await runner.start();
      assert.equal(errorMock.mock.callCount(), 1);
      runner.stop();
    } finally {
      errorMock.mock.restore();
      mock.timers.reset();
    }
  });

  it('applies default name and period', () => {
    const runner = new PeriodicRunner({ task: noopTask });
    assert.equal(runner.name, 'PeriodicRunner');
    assert.equal(runner.period, 7000);
    assert.equal(runner.isStopped, true);
  });

  it('honors an explicit period of 0 instead of falling back to the default', () => {
    const runner = new PeriodicRunner({ task: noopTask, period: 0 });
    assert.equal(runner.period, 0);
  });

  it('honors an explicit empty name instead of falling back to the default', () => {
    const runner = new PeriodicRunner({ task: noopTask, name: '' });
    assert.equal(runner.name, '');
  });

  it('throws on a negative period', () => {
    assert.throws(() => new PeriodicRunner({ task: noopTask, period: -100 }), /non-negative/);
  });

  it('throws on a NaN period', () => {
    assert.throws(() => new PeriodicRunner({ task: noopTask, period: NaN }), /non-negative/);
  });

  it('throws on a non-finite period', () => {
    assert.throws(
      () => new PeriodicRunner({ task: noopTask, period: Infinity }),
      /non-negative/
    );
  });

  it('throws on a string period', () => {
    assert.throws(
      () => new PeriodicRunner({ task: noopTask, period: '2000' as unknown as number }),
      /non-negative/
    );
  });

  it('throws on an invalid IANA timezone', () => {
    assert.throws(
      () => new PeriodicRunner({ task: noopTask, timezone: 'Europe/Instabul' }),
      /invalid IANA timezone/
    );
  });

  it('throws on activeHours with equal start and end', () => {
    assert.throws(
      () =>
        new PeriodicRunner({
          task: noopTask,
          activeHours: { start: '10:00', end: '10:00' },
        }),
      /cannot be equal/
    );
  });

  it('throws on holidays with an out-of-range calendar date', () => {
    assert.throws(
      () => new PeriodicRunner({ task: noopTask, holidays: ['2026-13-40'] }),
      /valid.*calendar dates/
    );
    assert.throws(
      () => new PeriodicRunner({ task: noopTask, holidays: ['2026-02-30'] }),
      /valid.*calendar dates/
    );
  });

  it('keeps a custom name when provided', () => {
    const runner = new PeriodicRunner({ task: noopTask, name: 'CacheWarmer' });
    assert.equal(runner.name, 'CacheWarmer');
  });

  it('default export matches named export', () => {
    assert.equal(PeriodicRunnerDefault, PeriodicRunner);
  });
});

describe('PeriodicRunner lifecycle', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('runs task on start and on each period tick', async () => {
    let calls = 0;
    const runner = new PeriodicRunner({
      period: 100,
      task: () => {
        calls++;
      },
      logger: silentLogger(),
    });

    await runner.start();
    assert.equal(calls, 1);
    assert.equal(runner.isStopped, false);

    mock.timers.tick(100);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(calls, 2);

    runner.stop();
    assert.equal(runner.isStopped, true);

    runner.stop();

    mock.timers.tick(100);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(calls, 2);
  });

  it('ignores duplicate start calls', async () => {
    const debug = mock.fn();
    const runner = new PeriodicRunner({
      period: 100,
      task: noopTask,
      logger: { debug, error: () => {} },
    });

    await runner.start();
    await runner.start();

    assert.equal(debug.mock.calls.length, 1);
    assert.match(String(debug.mock.calls[0].arguments[0]), /start already running/);
    runner.stop();
  });

  it('ignores nested start while the first loop is active', async () => {
    const debug = mock.fn();
    const runner = new PeriodicRunner({
      period: 100,
      task: () => {
        void runner.start();
      },
      logger: { debug, error: () => {} },
    });

    await runner.start();
    assert.ok(
      debug.mock.calls.some((call) => String(call.arguments[0]).includes('start already running'))
    );
    runner.stop();
  });

  it('does not schedule another tick after stop during task execution', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const runner = new PeriodicRunner({
      period: 100,
      task: async () => {
        calls++;
        await gate;
      },
      logger: silentLogger(),
    });

    const startPromise = runner.start();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
    runner.stop();
    release();
    await startPromise;

    mock.timers.tick(100);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
  });

  it('stop before start is a no-op on the timer', () => {
    const runner = new PeriodicRunner({ period: 100, task: noopTask, logger: silentLogger() });
    runner.stop();
    assert.equal(runner.isStopped, true);
  });

  it('does not run again after stop when a pending timer fires', async () => {
    let calls = 0;
    const runner = new PeriodicRunner({
      period: 100,
      task: () => {
        calls++;
      },
      logger: silentLogger(),
    });

    await runner.start();
    assert.equal(calls, 1);
    runner.stop();
    mock.timers.tick(100);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
  });

  it('loop returns immediately when invoked after stop', async () => {
    let loopRef: (() => void) | undefined;
    const scheduledSetTimeout = globalThis.setTimeout.bind(globalThis);
    const setTimeoutSpy = mock.method(
      globalThis,
      'setTimeout',
      (fn: (...args: unknown[]) => void, ms?: number) => {
        loopRef = fn as () => void;
        return scheduledSetTimeout(fn, ms);
      }
    );

    try {
      let calls = 0;
      const runner = new PeriodicRunner({
        period: 100,
        task: () => {
          calls++;
        },
        logger: silentLogger(),
      });

      await runner.start();
      assert.equal(calls, 1);
      runner.stop();
      loopRef!();
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(calls, 1);
    } finally {
      setTimeoutSpy.mock.restore();
    }
  });

  it('skips reentrant loop while a task is still running', async () => {
    let pass = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const debug = mock.fn();
    let loopRef: (() => void) | undefined;

    const scheduledSetTimeout = globalThis.setTimeout.bind(globalThis);
    const setTimeoutSpy = mock.method(
      globalThis,
      'setTimeout',
      (fn: (...args: unknown[]) => void, ms?: number) => {
        loopRef = fn as () => void;
        return scheduledSetTimeout(fn, ms);
      }
    );

    try {
      const runner = new PeriodicRunner({
        period: 100,
        task: async () => {
          pass++;
          if (pass > 1) {
            await gate;
          }
        },
        logger: { debug, error: () => {} },
      });

      await runner.start();
      assert.equal(pass, 1);

      mock.timers.tick(100);
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(pass, 2);
      assert.equal(runner.isRunning, true);

      loopRef!();
      await new Promise<void>((resolve) => setImmediate(resolve));

      assert.ok(
        debug.mock.calls.some((call) =>
          String(call.arguments[0]).includes('task already running, skipping this tick')
        )
      );
      assert.equal(pass, 2);

      release();
      runner.stop();
    } finally {
      setTimeoutSpy.mock.restore();
    }
  });

  it('does not overlap task execution', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const runner = new PeriodicRunner({
      period: 50,
      task: async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await gate;
        concurrent--;
      },
      logger: silentLogger(),
    });

    const startPromise = runner.start();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(maxConcurrent, 1);

    release();
    await startPromise;
    mock.timers.tick(50);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(maxConcurrent, 1);

    runner.stop();
  });
});

describe('PeriodicRunner constraints', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('skips ticks outside activeHours', async () => {
    mock.timers.setTime(new Date('2026-03-16T20:00:00').getTime());
    let calls = 0;
    const debug = mock.fn();
    const runner = new PeriodicRunner({
      period: 100,
      activeHours: { start: '09:00', end: '18:00' },
      task: () => {
        calls++;
      },
      logger: { debug, error: () => {} },
    });

    await runner.start();
    assert.equal(calls, 0);
    assert.match(String(debug.mock.calls[0]?.arguments[0]), /skipping this tick/);
    runner.stop();
  });

  it('runs ticks inside activeHours', async () => {
    mock.timers.setTime(new Date('2026-03-16T10:00:00').getTime());
    let calls = 0;
    const runner = new PeriodicRunner({
      period: 100,
      activeHours: { start: '09:00', end: '18:00' },
      task: () => {
        calls++;
      },
      logger: silentLogger(),
    });

    await runner.start();
    assert.equal(calls, 1);
    runner.stop();
  });

  it('skips ticks on disallowed weekDays', async () => {
    mock.timers.setTime(new Date('2026-03-15T10:00:00').getTime());
    let calls = 0;
    const runner = new PeriodicRunner({
      period: 100,
      weekDays: [1, 2, 3, 4, 5],
      task: () => {
        calls++;
      },
      logger: silentLogger(),
    });

    await runner.start();
    assert.equal(calls, 0);
    runner.stop();
  });

  it('skips ticks on holidays', async () => {
    mock.timers.setTime(new Date('2026-01-01T10:00:00').getTime());
    let calls = 0;
    const runner = new PeriodicRunner({
      period: 100,
      holidays: ['2026-01-01'],
      task: () => {
        calls++;
      },
      logger: silentLogger(),
    });

    await runner.start();
    assert.equal(calls, 0);
    runner.stop();
  });

  it('uses default logger debug when skipping a tick', async () => {
    mock.timers.setTime(new Date('2026-01-01T10:00:00').getTime());
    const debugMock = mock.method(console, 'debug', () => {});
    try {
      const runner = new PeriodicRunner({
        period: 100,
        holidays: ['2026-01-01'],
        task: noopTask,
      });
      await runner.start();
      assert.ok(debugMock.mock.calls.some((call) => String(call.arguments[0]).includes('skipping this tick')));
      runner.stop();
    } finally {
      debugMock.mock.restore();
    }
  });

  it('evaluates schedule constraints in a configured timezone', async () => {
    mock.timers.setTime(new Date('2026-03-16T10:00:00').getTime());
    let calls = 0;
    const runner = new PeriodicRunner({
      period: 100,
      timezone: 'Europe/Istanbul',
      task: () => {
        calls++;
      },
      logger: silentLogger(),
    });

    await runner.start();
    assert.equal(calls, 1);
    runner.stop();
  });

  it('treats empty timezone as unset', async () => {
    mock.timers.setTime(new Date('2026-03-16T10:00:00').getTime());
    const runner = new PeriodicRunner({
      period: 100,
      timezone: '',
      task: noopTask,
      logger: silentLogger(),
    });
    assert.equal(runner.timezone, null);
    await runner.start();
    runner.stop();
  });
});

describe('PeriodicRunner errors', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('invokes onError when task throws', async () => {
    const onError = mock.fn();
    const runner = new PeriodicRunner({
      period: 100,
      task: () => {
        throw new Error('task failed');
      },
      onError,
      logger: silentLogger(),
    });

    await runner.start();
    assert.equal(onError.mock.calls.length, 1);
    assert.equal((onError.mock.calls[0].arguments[0] as Error).message, 'task failed');
    assert.equal(runner.isRunning, false);

    runner.stop();
  });

  it('logs when onError handler throws', async () => {
    const errorLog = mock.fn();
    const runner = new PeriodicRunner({
      period: 100,
      task: () => {
        throw new Error('task failed');
      },
      onError: () => {
        throw new Error('handler failed');
      },
      logger: { debug: () => {}, error: errorLog },
    });

    await runner.start();
    assert.ok(errorLog.mock.calls.some((call) => String(call.arguments[0]).includes('onError handler threw')));
    runner.stop();
  });

  it('logs task errors with the default logger when onError is omitted', async () => {
    const errorMock = mock.method(console, 'error', () => {});
    try {
      const runner = new PeriodicRunner({
        period: 100,
        task: () => {
          throw new Error('task failed');
        },
      });
      await runner.start();
      assert.ok(
        errorMock.mock.calls.some((call) => String(call.arguments[0]).includes('task error'))
      );
      runner.stop();
    } finally {
      errorMock.mock.restore();
    }
  });

  it('logs handler failures with the default logger', async () => {
    const errorMock = mock.method(console, 'error', () => {});
    try {
      const runner = new PeriodicRunner({
        period: 100,
        task: () => {
          throw new Error('task failed');
        },
        onError: () => {
          throw new Error('handler failed');
        },
      });
      await runner.start();
      assert.ok(
        errorMock.mock.calls.some((call) => String(call.arguments[0]).includes('onError handler threw'))
      );
      runner.stop();
    } finally {
      errorMock.mock.restore();
    }
  });

  it('invokes onError and skips the tick when schedule evaluation throws at runtime', async () => {
    const onError = mock.fn();
    let calls = 0;
    const runner = new PeriodicRunner({
      period: 100,
      timezone: 'Europe/Istanbul',
      task: () => {
        calls++;
      },
      onError,
      logger: silentLogger(),
    });

    const toLocaleStringSpy = mock.method(Date.prototype, 'toLocaleString', () => {
      throw new RangeError('simulated ICU failure');
    });
    try {
      await runner.start();
      assert.equal(calls, 0);
      assert.equal(onError.mock.calls.length, 1);
      assert.ok(onError.mock.calls[0].arguments[0] instanceof RangeError);
      runner.stop();
    } finally {
      toLocaleStringSpy.mock.restore();
    }
  });

  it('logs and swallows onError handler failures during schedule evaluation errors', async () => {
    const errorLog = mock.fn();
    const runner = new PeriodicRunner({
      period: 100,
      timezone: 'Europe/Istanbul',
      task: noopTask,
      onError: () => {
        throw new Error('handler failed');
      },
      logger: { debug: () => {}, error: errorLog },
    });

    const toLocaleStringSpy = mock.method(Date.prototype, 'toLocaleString', () => {
      throw new RangeError('simulated ICU failure');
    });
    try {
      await runner.start();
      assert.ok(
        errorLog.mock.calls.some((call) =>
          String(call.arguments[0]).includes('schedule evaluation error')
        )
      );
      assert.ok(
        errorLog.mock.calls.some((call) =>
          String(call.arguments[0]).includes('onError handler threw')
        )
      );
      runner.stop();
    } finally {
      toLocaleStringSpy.mock.restore();
    }
  });

  it('logs schedule evaluation errors with the default logger when onError is omitted', async () => {
    const errorMock = mock.method(console, 'error', () => {});
    const runner = new PeriodicRunner({
      period: 100,
      timezone: 'Europe/Istanbul',
      task: noopTask,
    });
    const toLocaleStringSpy = mock.method(Date.prototype, 'toLocaleString', () => {
      throw new RangeError('simulated ICU failure');
    });
    try {
      await runner.start();
      assert.ok(
        errorMock.mock.calls.some((call) =>
          String(call.arguments[0]).includes('schedule evaluation error')
        )
      );
      runner.stop();
    } finally {
      errorMock.mock.restore();
      toLocaleStringSpy.mock.restore();
    }
  });

  it('uses default logger debug when duplicate start is ignored', async () => {
    const debugMock = mock.method(console, 'debug', () => {});
    try {
      const runner = new PeriodicRunner({ period: 100, task: noopTask });
      await runner.start();
      await runner.start();
      assert.ok(
        debugMock.mock.calls.some((call) => String(call.arguments[0]).includes('start already running'))
      );
      runner.stop();
    } finally {
      debugMock.mock.restore();
    }
  });
});

describe('PeriodicRunner holidays API', () => {
  it('setHolidays replaces the list', () => {
    const runner = new PeriodicRunner({ task: noopTask, holidays: ['2026-01-01'] });
    runner.setHolidays(['2026-05-01', '2026-05-19']);
    assert.deepEqual([...runner.getHolidays()].sort(), ['2026-05-01', '2026-05-19']);
  });

  it('addHoliday and removeHoliday mutate the list', () => {
    const runner = new PeriodicRunner({ task: noopTask });
    runner.addHoliday('2026-08-30');
    assert.ok(runner.getHolidays().has('2026-08-30'));
    runner.removeHoliday('2026-08-30');
    assert.equal(runner.getHolidays().has('2026-08-30'), false);
  });

  it('getHolidays returns a copy', () => {
    const runner = new PeriodicRunner({ task: noopTask, holidays: ['2026-01-01'] });
    const copy = runner.getHolidays();
    copy.add('2026-02-02');
    assert.equal(runner.getHolidays().has('2026-02-02'), false);
  });

  it('getWeekDays returns sorted days or null', () => {
    const unrestricted = new PeriodicRunner({ task: noopTask });
    assert.equal(unrestricted.getWeekDays(), null);

    const runner = new PeriodicRunner({ task: noopTask, weekDays: [5, 1, 3] });
    assert.deepEqual(runner.getWeekDays(), [1, 3, 5]);
  });
});
