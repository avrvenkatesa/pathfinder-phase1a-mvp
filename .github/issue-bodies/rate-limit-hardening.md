# M1: Rate limiting & input hardening

## Rationale
- Protect mutation endpoints; predictable failure modes.

## Scope
- Add `express-rate-limit` to mutation routes (PATCH/POST).
- Verify Zod validations and body size limits.
- Return `{ error: "TooManyRequests", message }` with 429.

## Acceptance
- Tests for 429 behavior; docs listing limits and headers.
