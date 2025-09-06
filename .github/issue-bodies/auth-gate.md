# M1: Auth gate for workflow/instance routes (toggleable)

## Rationale
- Protect sensitive data; align with later product auth.

## Scope
- Wire `isAuthenticated` on `/api/workflows` and `/api/instances` (feature flag/env toggle).
- Update tests to mock auth or set flag off in CI.

## Acceptance
- When enabled, 401/403 for unauthenticated.
- Dev/test path documented; curl examples.
