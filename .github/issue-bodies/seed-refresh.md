# M1: Seed refresh

## Rationale
- Tests and manual QA need consistent steps + dependencies.

## Scope
- Ensure every seeded instance has at least one `step_instance`.
- Ensure `step_dependencies` consistent and produce blocked/ready states.

## Acceptance
- `npm run seed:workflow` idempotent; tests pass on clean DB.
- Docs: describe seed graph and expected states.
