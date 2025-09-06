# M1: Error shape conformance audit

## Rationale
- Consistent `{ error, message }` improves client/simple logs and tests.

## Scope
- Ensure all routes (workflows/instances/steps) return documented error shape.
- Centralize error handler; standardize 400/404/409/500.

## Acceptance
- Tests asserting error payload and status codes.
- Docs “Errors” page updated with canonical shapes.
