export type {
  WeekDay,
  ActiveHours,
  Logger,
  HolidayList,
  PeriodicRunnerOptions,
} from './types.js';

import type {
  ActiveHours,
  HolidayList,
  Logger,
  PeriodicRunnerOptions,
  WeekDay,
} from './types.js';
import { evaluateRunConstraints } from './schedule.js';
import {
  validateActiveHours,
  validateHolidays,
  validatePeriod,
  validateTimezone,
  validateWeekDays,
} from './validation.js';

const defaultLogger: Logger = {
  // eslint-disable-next-line no-console
  debug: (...args: unknown[]) => console.debug(...args),
  // eslint-disable-next-line no-console
  error: (...args: unknown[]) => console.error(...args),
};

/**
 * PeriodicRunner
 *
 * Implements a self-rescheduling loop based on `setTimeout`. Unlike `setInterval`,
 * the next run is never triggered before the previous one finishes (no overlap),
 * because the next `setTimeout` is scheduled only AFTER the task has been awaited.
 *
 * Supported constraints (all optional, can be combined):
 *  - activeHours: run only within a given time window (including windows that wrap past midnight)
 *  - weekDays: run only on specific days of the week
 *  - holidays: skip specific "YYYY-MM-DD" dates (can be updated at runtime)
 *
 * @example
 * ```ts
 * import { PeriodicRunner } from "@guzelbaspinar/periodic-runner";
 *
 * const runner = new PeriodicRunner({
 *   name: "InitialCache",
 *   period: 7000,
 *   task: async () => { ... },
 *   activeHours: { start: "09:50", end: "18:30" },
 *   weekDays: [1, 2, 3, 4, 5], // weekdays only
 *   holidays: new Set(["2026-01-01", "2026-04-23"]),
 *   timezone: "Europe/Istanbul",
 * });
 *
 * await runner.start();
 * runner.stop();
 *
 * // Updating the holiday list later:
 * runner.setHolidays(["2026-01-01", "2026-05-01", "2026-05-19"]);
 * runner.addHoliday("2026-08-30");
 * runner.removeHoliday("2026-08-30");
 * ```
 */
export class PeriodicRunner {
  #timer: ReturnType<typeof setTimeout> | null = null;
  #isRunning = false;
  #stopped = true;

  readonly name: string;
  readonly period: number;
  readonly task: () => Promise<void> | void;
  readonly onError?: (error: unknown) => void;
  readonly activeHours: ActiveHours | null;
  readonly timezone: string | null;
  readonly #weekDays: Set<WeekDay> | null;
  #holidays: Set<string>;
  readonly #logger: Logger;

  constructor(options: PeriodicRunnerOptions) {
    const {
      name,
      period,
      task,
      onError,
      activeHours,
      timezone,
      weekDays,
      holidays,
      logger,
    } = options;

    if (typeof task !== 'function') {
      throw new Error('PeriodicRunner: "task" function is required');
    }

    if (period !== undefined) {
      validatePeriod(period);
    }

    if (activeHours) {
      validateActiveHours(activeHours);
    }

    if (weekDays) {
      validateWeekDays(weekDays);
    }

    if (holidays) {
      validateHolidays(holidays);
    }

    if (timezone) {
      validateTimezone(timezone);
    }

    this.name = typeof name === 'string' ? name : 'PeriodicRunner';
    this.period = typeof period === 'number' ? period : 7000;
    this.task = task;
    this.onError = onError;
    this.activeHours = activeHours || null;
    this.timezone = timezone || null;
    this.#weekDays = weekDays ? new Set(weekDays) : null;
    this.#holidays = holidays ? new Set(holidays) : new Set();
    this.#logger = logger || defaultLogger;
  }

  /** Returns the "wall clock" Date converted to the configured timezone, if any. */
  #getNow(): Date {
    return this.timezone
      ? new Date(new Date().toLocaleString('en-US', { timeZone: this.timezone }))
      : new Date();
  }

  #shouldRun(): { allowed: boolean; reason?: string } {
    return evaluateRunConstraints(this.#getNow(), {
      activeHours: this.activeHours,
      weekDays: this.#weekDays,
      holidays: this.#holidays,
    });
  }

  #runTask = async (): Promise<void> => {
    if (this.#isRunning) {
      this.#logger.debug(`${this.name} - task already running, skipping this tick`);
      return;
    }

    let decision: { allowed: boolean; reason?: string };
    try {
      decision = this.#shouldRun();
    } catch (error) {
      this.#logger.error(`${this.name} - schedule evaluation error:`, error);
      if (typeof this.onError === 'function') {
        try {
          this.onError(error);
        } catch (handlerError) {
          this.#logger.error(`${this.name} - onError handler threw:`, handlerError);
        }
      }
      return;
    }

    if (!decision.allowed) {
      this.#logger.debug(`${this.name} - skipping this tick: ${decision.reason}`);
      return;
    }

    this.#isRunning = true;
    try {
      await this.task();
    } catch (error) {
      this.#logger.error(`${this.name} - task error:`, error);
      if (typeof this.onError === 'function') {
        try {
          this.onError(error);
        } catch (handlerError) {
          this.#logger.error(`${this.name} - onError handler threw:`, handlerError);
        }
      }
    } finally {
      this.#isRunning = false;
    }
  };

  start = async (): Promise<void> => {
    if (this.#timer || this.#stopped === false) {
      this.#logger.debug(`${this.name} - start already running, skipping this call`);
      return;
    }
    this.#stopped = false;

    const loop = async (): Promise<void> => {
      if (this.#stopped) return;
      await this.#runTask();
      if (this.#stopped) return;
      this.#timer = setTimeout(loop, this.period);
    };

    await loop();
  };

  stop = (): void => {
    this.#stopped = true;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  };

  get isRunning(): boolean {
    return this.#isRunning;
  }

  get isStopped(): boolean {
    return this.#stopped;
  }

  // ---- Holidays: runtime management ----

  /** Replaces the current holiday list entirely. Accepts an array or a Set. */
  setHolidays(holidays: HolidayList): void {
    validateHolidays(holidays);
    this.#holidays = new Set(holidays);
  }

  /** Adds a single holiday date ("YYYY-MM-DD"). */
  addHoliday(date: string): void {
    validateHolidays([date]);
    this.#holidays.add(date);
  }

  /** Removes a single holiday date from the list. */
  removeHoliday(date: string): void {
    this.#holidays.delete(date);
  }

  /** Returns the current holiday list as a Set. */
  getHolidays(): Set<string> {
    return new Set(this.#holidays);
  }

  /** Returns the week days the runner is allowed to run on (0=Sunday..6=Saturday), or null if unrestricted. */
  getWeekDays(): WeekDay[] | null {
    return this.#weekDays ? Array.from(this.#weekDays).sort() : null;
  }
}

export default PeriodicRunner;
