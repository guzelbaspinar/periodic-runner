# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-09-20

### Added

- Optional `taskTimeoutMs` watchdog: if `task()` doesn't settle within the given time, the runner stops waiting on it, reports the timeout via `onError`, and unlocks `isRunning` so subsequent ticks aren't skipped forever. The task itself is not cancelled (Promises can't be aborted from the outside) — pair this with your own cancellation (e.g. `AbortSignal.timeout`) inside `task` for full cleanup.

### Changed

- The timezone-aware scheduling calculation no longer relies on the `new Date(date.toLocaleString(...))` round-trip hack. It now uses `Intl.DateTimeFormat.formatToParts` to read year/month/day/hour/minute/weekday directly, which is spec-compliant across JS engines/ICU builds, avoids DST round-trip ambiguity, and is more efficient. This is an internal refactor; scheduling behavior (activeHours/weekDays/holidays evaluation) is unchanged.

## [0.1.2] - 2026-09-20

### Fixed

- **Critical:** an invalid `timezone` value (e.g. a mistyped or deprecated IANA zone) could throw an unhandled promise rejection on every tick and crash the whole Node.js process. `timezone` is now validated eagerly in the constructor, and schedule evaluation is also guarded at runtime (routed through `onError` / the logger instead of crashing).
- `period: 0` was silently replaced with the default `7000`; an explicit `0` is now honored (falsy-value bug fix via `typeof` checks instead of `||`).
- `name: ''` was silently replaced with the default `"PeriodicRunner"`; an explicit empty string is now honored.
- `period` now validates as a non-negative finite number; negative, `NaN`, `Infinity`, or non-number values now throw instead of causing a tight setTimeout loop (self-DoS).
- `holidays` dates are now validated against the real calendar (not just the `YYYY-MM-DD` shape), so non-existent dates like `"2026-02-30"` or `"2026-13-40"` are rejected instead of being silently accepted and never matching.
- `activeHours` with `start === end` (a zero-length window that would never run) now throws instead of silently blocking the task forever.

> **Note:** these fixes make several previously-silent misconfigurations throw at construction time. If you relied on `period: 0`/`name: ''` being replaced with defaults, or on invalid dates/timezones being silently ignored, update your configuration accordingly.

## [0.1.1] - 2026-09-20

### Documentation

- README: link to the npm package page.

## [0.1.0] - 2026-09-20

### Added

- Initial public release of `@guzelbaspinar/periodic-runner`.
- Non-overlapping `setTimeout`-based periodic runner with optional active hours, weekdays, holidays, and IANA timezone.
- CJS, ESM, and TypeScript types via `dist/`.
- CI (typecheck, examples, tests, build) and OIDC npm stage publish workflow.
