/**
 * periodic-runner usage examples.
 *
 * Copy-paste reference only — functions are not invoked when you run this file.
 *   npx tsx examples/usage.ts
 */
import { PeriodicRunner } from '../src/index.js';

/** CommonJS: const { PeriodicRunner } = require('@guzelbaspinar/periodic-runner'); */
function example01_commonjsStyle() {
  const runner = new PeriodicRunner({
    name: 'CjsExample',
    period: 5000,
    task: async () => {
      console.log('CJS task ran:', new Date().toISOString());
    },
    weekDays: [1, 2, 3, 4, 5],
    holidays: ['2026-01-01', '2026-04-23'],
    timezone: 'Europe/Istanbul',
  });
  void runner.start();
}

/** ESM with active hours and runtime holiday updates */
async function example02_esmActiveHoursAndHolidays() {
  const runner = new PeriodicRunner({
    name: 'EsmExample',
    period: 5000,
    activeHours: { start: '09:00', end: '18:00' },
    task: async () => {
      console.log('ESM task ran:', new Date().toISOString());
    },
    onError: (err) => console.error('Task failed:', err),
  });

  await runner.start();
  runner.setHolidays(new Set(['2026-05-01', '2026-05-19']));
  runner.addHoliday('2026-08-30');
  console.log('Current holidays:', runner.getHolidays());
}

/** Active window that wraps past midnight (22:00–06:00) */
async function example03_overnightActiveHours() {
  const runner = new PeriodicRunner({
    name: 'NightShift',
    period: 10_000,
    activeHours: { start: '22:00', end: '06:00' },
    task: async () => {
      /* runs only during the overnight window */
    },
  });
  await runner.start();
  runner.stop();
}
