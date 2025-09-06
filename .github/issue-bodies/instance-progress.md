# M1: GET `/api/instances/:id/progress`

## Business rationale
- **Runtime UI:** render a per-step timeline/graph for an instance without multiple client round-trips.
- **Ops & Support:** quickly see which steps are blocked and by whom (dependencies), with timestamps.
- **Analytics & SLA:** enable lightweight progress/duration metrics for dashboards.

## Scope
- New endpoint **GET `/api/instances/:id/progress`** returning:
  - **Identity:** `stepId`, `definitionStepId`, `name`, `type`
  - **Runtime:** `status`, `startedAt`, `completedAt`, `updatedAt`
  - **Topology:** `index` (position), `blockedBy` (IDs this step depends on)
  - **Derived:** `isBlocked` (has unmet deps), `isReady` (all deps completed; not started), `isTerminal`
  - **Summary:** `{ total, completed, running, pending }`
- **Validation:** `:id` must be UUIDv4 → `400` if invalid; `404` if instance not found.
- **Performance:** 1–2 compact queries joining `workflow_steps`, `step_dependencies`, and `step_instances`.

## API (draft)

### Request
`GET /api/instances/{id}/progress`

### Response `200 OK` (example)
```json
{
  "instanceId": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  "steps": [
    {
      "stepId": "…",
      "definitionStepId": "…",
      "name": "Approve Request",
      "type": "approval",
      "index": 2,
      "status": "in_progress",
      "startedAt": "…",
      "completedAt": null,
      "updatedAt": "…",
      "blockedBy": ["<stepId>", "..."],
      "isBlocked": false,
      "isReady": false,
      "isTerminal": false
    }
  ],
  "summary": { "total": 5, "completed": 2, "running": 1, "pending": 2 }
}
Errors
400 Bad Request — invalid UUID

404 Not Found — instance missing

500 Internal Server Error — unexpected

Design notes
Join workflow_steps ↔ step_dependencies to compute blockedBy, left-join step_instances for runtime fields.

isBlocked = blockedBy.some(depStepId not completed)

isReady = !isBlocked && status in {"pending","blocked","ready"} && !startedAt

Use existing enums: step_type, step_status.

Test plan (Vitest + Supertest)
400 invalid id

404 unknown instance

200 happy path: array length matches definition; flags (isBlocked, isReady) correct for seed graph

Stable snapshot of response shape

Acceptance criteria
Endpoint implemented and mounted.

Tests pass locally/CI.

Docs & OpenAPI updated (new section + fragment).

Works against seed data.

Out of scope
Critical-path/ETA computation

Orchestration/side-effects

Graph layout

Pagination
