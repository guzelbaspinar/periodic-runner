# periodic-runner

A `setTimeout`-based, **non-overlapping** self-rescheduling periodic task runner. Unlike `setInterval`, the next run is never triggered before the previous one finishes, because the next `setTimeout` is scheduled only after the task has been awaited.

Fully compatible with CommonJS, ESM, and TypeScript.

Published on npm as [`@guzelbaspinar/periodic-runner`](https://www.npmjs.com/package/@guzelbaspinar/periodic-runner).

## Features

- ✅ Overlap protection (a new run never starts before the previous one finishes)
- ✅ Active time window support (`activeHours`) — including windows that wrap past midnight (e.g. `22:00-06:00`)
- ✅ Restrict to specific days of the week (`weekDays`)
- ✅ Skip holiday dates (`holidays`), **updatable at runtime**, accepts an array or a `Set`
- ✅ IANA timezone support
- ✅ Custom error handling (`onError`) and custom logger injection
- ✅ CJS + ESM + TypeScript types in a single package (`dist/index.cjs`, `dist/index.js`, `dist/index.d.ts`)

## Installation

```bash
npm install @guzelbaspinar/periodic-runner
```

## Usage

### TypeScript / ESM

```ts
import { PeriodicRunner } from '@guzelbaspinar/periodic-runner';

const runner = new PeriodicRunner({
  name: 'InitialCache',
  period: 7000,
  task: async () => {
    // work to run periodically
  },
  activeHours: { start: '09:50', end: '18:30' },
  weekDays: [1, 2, 3, 4, 5], // weekdays only (0=Sunday ... 6=Saturday)
  holidays: new Set(['2026-01-01', '2026-04-23']),
  timezone: 'Europe/Istanbul',
  onError: (err) => console.error('task failed:', err),
});

await runner.start();

// ... later
runner.stop();
```

### CommonJS

```js
const { PeriodicRunner } = require('@guzelbaspinar/periodic-runner');

const runner = new PeriodicRunner({
  period: 5000,
  task: async () => { /* ... */ },
});

runner.start();
```

See [EXAMPLES.md](./EXAMPLES.md) for full CJS, ESM, and TypeScript examples.

## Managing holidays dynamically

The holiday list is not static; it can be updated at any time from an external source (e.g. data fetched periodically from a public holiday API). It accepts either an `Array` or a `Set` of `"YYYY-MM-DD"` strings:

```ts
runner.setHolidays(['2026-01-01', '2026-05-01', '2026-05-19']); // replaces the whole list, array or Set
runner.addHoliday('2026-08-30');                                 // adds a single day
runner.removeHoliday('2026-08-30');                              // removes a single day
runner.getHolidays();                                            // -> Set<string>
```

> Note: the holiday check is evaluated against the **current date** (computed according to the `timezone` option) on every tick, so simply keeping the list up to date is enough — no extra "valid from/to" logic is needed.

## API

### `new PeriodicRunner(options)`

| Field | Type | Required | Description |
|---|---|---|---|
| `task` | `() => Promise<void> \| void` | ✅ | Function executed on every period |
| `name` | `string` | ❌ | Name shown in logs (default: `"PeriodicRunner"`) |
| `period` | `number` | ❌ | Delay between runs in ms (default: `7000`) |
| `onError` | `(error: unknown) => void` | ❌ | Called when `task` throws |
| `activeHours` | `{ start: string; end: string }` | ❌ | Active window in `"HH:mm"` format |
| `weekDays` | `number[]` (0-6) | ❌ | Days of the week the task is allowed to run on (0=Sunday) |
| `holidays` | `string[] \| Set<string>` (`"YYYY-MM-DD"`) | ❌ | Dates the task must not run on |
| `timezone` | `string` | ❌ | IANA timezone, e.g. `"Europe/Istanbul"` |
| `logger` | `{ debug, error }` | ❌ | Custom logger (default: `console`) |

### Methods

- `start(): Promise<void>` — starts the loop
- `stop(): void` — stops the loop
- `setHolidays(holidays: string[] | Set<string>): void`
- `addHoliday(date: string): void`
- `removeHoliday(date: string): void`
- `getHolidays(): Set<string>`
- `getWeekDays(): number[] | null`

### Getters

- `isRunning: boolean` — whether a task is currently executing
- `isStopped: boolean` — whether the runner has been stopped

## Development

```bash
npm install
npm run typecheck
npm run typecheck:examples
npm test
npm run test:coverage
npm run build       # generates cjs + esm + d.ts into dist/
```

## License

MIT
