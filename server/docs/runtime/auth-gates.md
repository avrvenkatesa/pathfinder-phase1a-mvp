# M1: Auth Gate for Runtime Endpoints (Issue #31)

## Why
- Protect instance/step operations from unauthenticated access.
- Align runtime endpoints with security posture & OpenAPI (401 on missing/invalid auth).
- Prepare for role-based scopes in later milestones.

## Scope (Phase 1)
- Require auth for:
  - `GET /api/instances`, `GET /api/instances/:id`, `GET /api/instances/:id/progress`
  - `PATCH /api/instances/:id/steps/:stepId/status`
  - `POST /api/instances/:id/steps/:stepId/{advance,complete}`
  - `GET /api/workflows/**` (as applicable)
- Exempt:
  - `/health`, `/metrics`, `/api-docs` (and OpenAPI file), and **dev stubs** if enabled.

## Behavior
- Missing/invalid session/JWT → **401 Unauthorized** with platform error envelope.
- No 403 in this phase (authorization/roles are future work).
- Keep rate limits and validation from Issue #35 unchanged.

## Config & Rollout
- Gate enabled by default in non-test environments.
- In tests, auth middleware should be bypassed or receive a test stub token.
- Feature flag (if needed later): `AUTH_GATE_ENABLED=true`.

## OpenAPI Notes
- Add `401` responses to the runtime/workflow paths.
- Ensure global security schemes remain declared.

## Monitoring
- Track 401s per route and principal once roles land.
- Watch P95/P99 to confirm no regressions.

