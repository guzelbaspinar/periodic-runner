export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday ... 6 = Saturday

export interface ActiveHours {
  /** Start time in "HH:mm" format, e.g. "09:50" */
  start: string;
  /** End time in "HH:mm" format, e.g. "18:30" */
  end: string;
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/** Accepts either an array or a Set of "YYYY-MM-DD" date strings. */
export type HolidayList = string[] | Set<string>;

export interface PeriodicRunnerOptions {
  /** Name shown in logs. Default: "PeriodicRunner" */
  name?: string;
  /** Delay between runs in ms. Default: 7000 */
  period?: number;
  /** Function executed on every period */
  task: () => Promise<void> | void;
  /** Called when task throws */
  onError?: (error: unknown) => void;
  /** Active time window in "HH:mm" format. If omitted, always considered active. */
  activeHours?: ActiveHours;
  /** IANA timezone (e.g. "Europe/Istanbul"). If omitted, server local time is used. */
  timezone?: string;
  /** Week days the task is allowed to run on: 0 (Sunday) - 6 (Saturday). If omitted, runs every day. */
  weekDays?: WeekDay[];
  /** Holiday dates in "YYYY-MM-DD" format (array or Set). The task will not run on these dates. */
  holidays?: HolidayList;
  /** Custom logger. Defaults to console. */
  logger?: Logger;
  /**
   * Optional watchdog, in ms. If `task` doesn't settle within this time, the runner
   * stops waiting on it (reports the timeout via `onError`) and unlocks `isRunning`
   * so the next tick isn't skipped forever. The task itself is NOT cancelled — a
   * hung Promise may still be running/leaking in the background. If omitted, the
   * runner waits for `task` indefinitely (previous behavior).
   */
  taskTimeoutMs?: number;
}
