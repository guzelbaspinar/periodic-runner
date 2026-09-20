# Usage Examples

## CommonJS

```js
const { PeriodicRunner } = require('@guzelbaspinar/periodic-runner');

const runner = new PeriodicRunner({
  name: 'CjsExample',
  period: 5000,
  task: async () => {
    console.log('CJS task ran:', new Date().toISOString());
  },
  weekDays: [1, 2, 3, 4, 5], // weekdays only (Mon-Fri)
  holidays: ['2026-01-01', '2026-04-23'],
  timezone: 'Europe/Istanbul',
});

runner.start();

// stop after 30 seconds (for demo purposes)
setTimeout(() => runner.stop(), 30000);
```

## ESM

```js
import { PeriodicRunner } from '@guzelbaspinar/periodic-runner';

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

// Updating the holiday list at runtime
runner.setHolidays(new Set(['2026-05-01', '2026-05-19']));
runner.addHoliday('2026-08-30');
console.log('Current holidays:', runner.getHolidays());
```

## TypeScript

```ts
import { PeriodicRunner, type PeriodicRunnerOptions } from '@guzelbaspinar/periodic-runner';

const options: PeriodicRunnerOptions = {
  name: 'TypedExample',
  period: 10_000,
  taskTimeoutMs: 5000, // if task() hangs past 5s, report it via onError instead of locking up
  task: async () => {
    // ... sync or async work here
  },
  weekDays: [1, 2, 3, 4, 5],
  holidays: new Set(['2026-01-01']),
  timezone: 'Europe/Istanbul',
  logger: {
    debug: (...args) => console.debug('[debug]', ...args),
    error: (...args) => console.error('[error]', ...args),
  },
};

const runner = new PeriodicRunner(options);

async function main(): Promise<void> {
  await runner.start();

  // Dynamic holiday update - e.g. after fetching from a holiday API on a schedule
  const freshHolidays = await fetchHolidaysFromSomewhere();
  runner.setHolidays(freshHolidays);
}

async function fetchHolidaysFromSomewhere(): Promise<Set<string>> {
  return new Set(['2026-01-01', '2026-04-23', '2026-05-01', '2026-05-19', '2026-08-30']);
}

main();
```
