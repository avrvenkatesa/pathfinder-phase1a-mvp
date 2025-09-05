# 0002 — Instance Detail Endpoint (`GET /api/instances/:id`)

- **Status:** Accepted
- **Date:** 2025-09-05
- **Owner:** Backend (Node/Express + Neon Postgres + Drizzle)
- **Related:** Issue #9, PR: “feat(instances): GET /api/instances/:id”
- **Supersedes / Depends on:** 0001 — Seek Pagination for Instances (list endpoint)

## Context

We need a fast, single-call way to show the **current state** of a workflow instance for:
- **Runtime UI:** the instance details drawer/page.
- **Ops/Support:** quick triage (“is this stuck, failing, or progressing?”).
- **Analytics/SLA:** high-level progress metrics.

Previously only a list endpoint existed (`GET /api/instances`) with seek pagination (ADR-0001). The UI still had to make extra calls to compute progress per instance (N+1), which increases latency and DB load.

## Decision

Introduce **`GET /api/instances/:id`** to return:
- Core instance fields: `id`, `definitionId`, `status`, `createdAt`, `updatedAt`
- **Step summary** computed server-side from `step_instances`:
  - `totalSteps`
  - `completedSteps` (`status = 'completed'`)
  - `runningSteps` (`status IN ('in_progress','ready')`)
  - `failedSteps` (`status = 'failed'`)
  - `pendingSteps` (`status IN ('pending','blocked','skipped')`)

**Validation & errors**
- Invalid UUID → **400**
- Missing id → **404**
- Unexpected error → **500**

**Implementation notes**
- Use a **single SQL query** with `LEFT JOIN` and `COUNT(*) FILTER (WHERE ...)`.
- For robustness against schema naming variants observed during migration/seed work, the current service uses a **raw SQL implementation with safe aliases** and dual-shape fallback (e.g., `definition_id/instance_id` vs `workflow_definition_id/workflow_instance_id`).  
  - This avoids Drizzle field-name mismatches while the schema stabilizes.
  - We keep JSON response **camelCased**.

## Alternatives Considered

1. **Client-side aggregation** — ❌ More round-trips, higher latency, heavier DB load.
2. **Multiple server calls** — ❌ Overhead and consistency issues.
3. **Materialized summaries** — ➖ Good later, premature now.
4. **Drizzle-only aggregation** — ➖ Feasible once schema naming is fully standardized.

## Consequences

**Pros**
- One call per instance detail → simpler UI + lower latency.
- Server-side rollups reduce client & DB chatter (no N+1).
- Clear, documented semantics for step status categories.

**Cons / Risks**
- Raw SQL in service (temporary) while schema stabilizes.
- Aggregation cost grows with step volume (acceptable for M1).

**Mitigations**
- Ensure indexes:
  - `workflow_instances(id)` (PK)
  - `step_instances(instance_id)` (FK index)
- Consider partial indexes/materialized summaries if needed.

## Security / Auth

- UUID validation guards malformed input.
- Endpoint is currently **unprotected** per M1 scope; add auth later.

## Observability

- Lightweight JSON logger logs path, status, duration, truncated response.
- Future: route metrics + 5xx alerts.

## Testing

- Vitest + Supertest:
  - **400** invalid UUID
  - **404** valid-but-missing UUID
  - **200** happy path with shape checks
- Test harness loads `server/.env`, mocks auth, ensures at least one instance.

## Rollback

- Safe: read-only endpoint; no schema changes.
- UI degrades to list-only behavior.

## Follow-ups

- Add auth to workflow/instance routes.
- Consider Drizzle implementation once naming is standardized.
- Add `/api/instances/:id/progress` and step mutations.
- Metrics & alerting for latency and error rate.

## Business Rationale

Teams need a fast, reliable way to retrieve an instance’s current state for:

- **Runtime UI:** driving the instance detail panel without multiple round-trips.
- **Ops & Support:** quick triage (e.g., “why is this flow stuck?”) via step summaries.
- **Analytics & SLA:** basic progress indicators (completed vs. running vs. pending/blocked) support dashboards and alerting.

This endpoint reduces client complexity and DB chatter by computing summarized step counts server-side.
