# M1: Advance/Complete convenience endpoints

## Rationale
- Simpler client calls vs. PATCH status payloads.
- Ops can one-shot advance/complete a step without crafting transitions.

## Scope
- `POST /api/instances/:id/steps/:stepId/advance`
- `POST /api/instances/:id/steps/:stepId/complete`
- UUIDv4 validation; 404 if pair not found; 409 if invalid due to dependencies/terminal state.
- Idempotent on repeated calls in terminal state.
- No orchestration/side-effects beyond status change (follow-up ticket).

## Acceptance
- Tests: 400 invalid IDs, 404 unknown pair, 409 invalid, 200 success.
- Docs + OpenAPI fragment; curl examples.
- Error shape `{ error, message }` consistent.

## Out of scope
- Auto-unblock next steps; audit events; bulk ops.
