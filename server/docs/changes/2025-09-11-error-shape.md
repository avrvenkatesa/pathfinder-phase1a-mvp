
Added

Standardized error contract across runtime endpoints: { error: { code, message, details?, traceId? } }.

Middleware normalizes Zod validation, auth, precondition, conflict, rate-limit, and server errors.

OpenAPI shared responses (400/500) pointing to a single Error schema; Spectral rules enforce usage.

Tests verifying error shape for 400/401/404/409/429 on representative routes.

Impact

Improves developer velocity, observability, and supportability; reduces error-handling drift.
