# M1: Drizzle refactor (optional)

## Rationale
- Consistent query style; type-safety; easier maintenance.

## Scope
- Migrate raw `sql\`` in services to Drizzle query builders where practical.
- Keep SQL for complex CTEs if readability is better.

## Acceptance
- No behavioral changes; tests remain green.
- Lint rules updated if needed.

## Out of scope
- Schema changes; perf tuning beyond parity.
