# Runtime Error Handling & Contract (M1)

**Scope:** Runtime endpoints under `/api/instances/**` and `/api/workflows/**`  
**Status:** Shipped in M1 via Issue #29 (Error shape conformance audit)

## Business Rationale

**Why now.** M1 focuses on runtime reliability & security. With auth gates and rate limits in place, inconsistent error payloads were the next biggest source of UI/integration friction and incident pain. Standardizing error JSON unlocks faster UI work, safer deploys, and clearer observability.

**What we deliver.**
- **Stable API contract:** One canonical error envelope for all 4xx/5xx.
- **Fewer regressions:** Middleware normalization + OpenAPI shared responses + Spectral rules.
- **Better debuggability:** Machine-friendly `error.code`, optional `traceId` for log correlation.
- **Security:** Central control of what we expose on 5xx to avoid accidental leakage.
- **Faster UI/SDK:** Uniform handling of validation/auth/preconditions/rate limits.
- **Analytics/SLA:** Consistent codes make error dashboards trivial.

**Success criteria.**
- All runtime endpoints return the canonical envelope for 4xx/5xx.
- Spectral & OpenAPI CI enforce 401/429 and the shared `Error` schema on runtime errors.
- Contract tests cover 401/400/404/429.

---

## Canonical Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-friendly summary",
    "details": { "issues": [ { "path": ["field"], "code": "too_small", "message": "..." } ] },
    "traceId": "req-uuid-or-requestId"
  }
}
code (string) – machine-stable identifier (see table below).

message (string) – safe to show to end users.

details (object, optional) – structured context (e.g., Zod issues).

traceId (string, optional) – echo of request id to speed support/ops.

Standard Codes (HTTP → code)
HTTP	Code	Notes
400	VALIDATION_FAILED	Zod/body/query/param validation.
401	AUTH_MISSING/AUTH_INVALID	Auth gate failures.
403	FORBIDDEN	Authenticated but not allowed.
404	NOT_FOUND	Route or resource missing.
405	METHOD_NOT_ALLOWED	Standard Express mapping.
409	CONFLICT	Unique/semantic conflicts.
412	PRECONDITION_FAILED	Stale ETag (If-Match).
428	PRECONDITION_REQUIRED	Missing precondition header.
429	RATE_LIMITED	Rate limit exceeded.
500	INTERNAL_ERROR	Unexpected server error.

Server Implementation (where this happens)
Middleware: server/middleware/error-handler.ts
Maps Zod → VALIDATION_FAILED; normalizes AppError & generic errors; adds traceId.

Auth gate: server/middleware/isAuthenticated.ts
Emits AUTH_MISSING/AUTH_INVALID (test bypass via X-Test-Auth: 1).

Rate limits: server/middleware/rate-limit.ts
Custom 429 handler returns RATE_LIMITED envelope.

Tests: server/routes/__tests__/errors.shape.spec.ts
Locks 401/400/404/429 shape on representative runtime routes.

API Documentation Guardrails
OpenAPI shared responses (401/404/429/500) point to #/components/schemas/Error.

Spectral rules enforce:

401 and 429 present on /api/instances/** and /api/workflows/**

Operation-level security on runtime routes

All runtime 4xx/5xx JSON responses reference the Error schema.

This is enforced in CI via the OpenAPI CI workflow.

Client Integration Playbook
Always branch on error.code, not on message.

401 AUTH_* – redirect to login/refresh token; preserve return URL.

412/428 – show “stale copy / needs refresh”; re-GET resource and re-apply edits.

429 – exponential backoff; show a gentle “please try again” banner.

400 VALIDATION_FAILED – surface details.issues[] next to fields.

404 – for direct navigations: show a “not found” view; for background fetches: silent fallback.

traceId – include in user-facing error modals and attach to support tickets.

Do/Don’t

✅ Log error.code, include traceId in logs/telemetry.

✅ Localize message on the client if needed; do not change server codes.

❌ Don’t parse server message for logic; it may change without notice.

Backward Compatibility
Contacts API is already aligned; runtime endpoints converge here in M1.
If a legacy shape is encountered, it’s considered a bug—covered by tests and Spectral rules.

Changelog (excerpt)
Standardized error contract: { error: { code, message, details?, traceId? } }

Middleware normalization for Zod/auth/preconditions/rate limits/server errors

Shared OpenAPI responses + Spectral rules

Tests for 401/400/404/429 on runtime routes
