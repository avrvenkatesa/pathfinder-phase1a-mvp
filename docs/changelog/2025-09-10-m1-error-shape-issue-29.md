# Changelog — 2025-09-10 — M1: Error shape conformance audit (#29)

### Added
- Standardized error contract across runtime endpoints: `{ error: { code, message, details?, traceId? } }`.
- Middleware to normalize Zod validation, auth, precondition, rate-limit, and server errors.
- OpenAPI shared responses (401/404/429/500) pointing to a single `Error` schema; Spectral rules enforce usage.
- Tests verifying error shape for 401/400/404/429 on representative routes.

### Impact
- Improves developer velocity, observability, and supportability; reduces error-handling drift.
