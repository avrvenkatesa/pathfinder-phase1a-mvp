# GET `/api/instances/:id` — instance detail with step summary

## Business Rationale
Teams need a fast, reliable way to retrieve an instance’s current state for:

- **Runtime UI:** driving the instance detail panel without multiple round-trips.  
- **Ops & Support:** quick triage (e.g., “why is this flow stuck?”) via step summaries.  
- **Analytics & SLA:** basic progress indicators (completed vs. running vs. pending/blocked) support dashboards and alerting.

This endpoint reduces client complexity and DB chatter by computing summarized step counts server-side.

---

## Summary of Changes
- **New endpoint:** `GET /api/instances/:id`
  - Validates UUIDv4, returns **404** if not found, **400** if invalid.
  - Returns base instance fields + a **summary** block aggregated from `step_instances`.
- **Router:** `server/routes/instances.byId.ts` mounted under `/api/instances` (alongside list route).
- **Service:** `server/services/instancesById.ts` performs a single query with `LEFT JOIN` + `COUNT … FILTER`.
- **Tests (Vitest + Supertest):** `server/routes/__tests__/instances.byId.spec.ts`
  - `400` invalid UUID, `404` not found, `200` happy path (with seed).
- **Infra/Test setup:**
  - `server/index.ts` now exports `app` and doesn’t listen in `NODE_ENV=test`.
  - `vitest.config.ts` + `server/test.setup.ts` load `server/.env`, mock auth, and resolve TS path aliases.

_No DB migrations._ Contact stubs still available via `CONTACTS_STUB=true`.

---

## API Contract

### Request
GET /api/instances/:id

bash
Copy code

**Path params**
- `id` — UUIDv4 (required)

### Response — 200 OK
```json
{
  "id": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  "definitionId": "11111111-2222-4ccc-8ddd-333333333333",
  "status": "running",
  "createdAt": "2025-09-03T10:11:12.345Z",
  "updatedAt": "2025-09-03T11:22:33.456Z",
  "summary": {
    "totalSteps": 5,
    "completedSteps": 2,
    "runningSteps": 1,
    "failedSteps": 0,
    "pendingSteps": 2
  }
}
Notes:
runningSteps = in_progress + ready
pendingSteps = pending + blocked + skipped

Errors
400 Bad Request — invalid UUID

json
Copy code
{"error":"BadRequest","message":"Invalid id"}
404 Not Found — instance not found

json
Copy code
{"error":"NotFound","message":"Instance not found"}
500 Internal Server Error — unexpected failures (logged)

Enums
status ∈ pending | running | completed | cancelled | failed | paused

Step rollups use step_status:

running → in_progress, ready

pending → pending, blocked, skipped

Design & Implementation Details
Query shape: workflow_instances LEFT JOIN step_instances ON instance_id with PostgreSQL COUNT(*) FILTER (WHERE ...) to compute rollups in one round-trip.

Column compatibility: service handles common schema variants (definition_id/instance_id vs workflow_definition_id/workflow_instance_id) and aliases to a unified response shape.

Ordering: N/A (single row).

Idempotency: Read-only.

Security & Validation
UUIDv4 validated in the router before DB access.

(Future) add auth middleware once auth for workflow/instance routes lands.

Performance
Expected O(steps) aggregation; typical lat ~50–100ms on Neon for moderate step counts.

Recommended indexes

workflow_instances (id) — PK

step_instances (instance_id) — FK index

Optional partial index on (status) if step counts grow large and you add filtered queries later.

Observability
Existing lightweight JSON logger logs path, status code, duration, truncated response.

(Follow-up) add per-route metrics and 5xx alerts.

Security considerations
Current implementation relies on router UUID validation; later harden with parameterized SQL throughout (Drizzle sql\`` still parameterizes), though UUID validation already limits injection risk.

Test Plan
Automated (Vitest + Supertest)
400 invalid UUID

404 valid-but-nonexistent UUID

200 happy path with shape checks

Manual QA
bash
Copy code
# List one
curl -s "http://localhost:5000/api/instances?limit=1" | jq .

# Detail (replace with real id)
curl -s "http://localhost:5000/api/instances/<id>" | jq .
Seeding
bash
Copy code
npm run seed:workflow
Risks & Mitigations
Schema name differences (snake_case variants) → service normalizes via aliases and dual-shape queries.

Empty datasets → tests insert or reuse seed data; route returns 404 if id missing.

Auth not yet enforced → defer to later milestone; route shape stable.

Rollback
Safe to revert: read-only endpoint with no schema changes.

If rolled back, UI should degrade to list view without detail.

Documentation & OpenAPI
Docs: this page.
OpenAPI: add the following under paths: (see fragment file below).

yaml
Copy code
/api/instances/{id}:
  get:
    summary: Get a workflow instance by id
    tags: [instances]
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: string, format: uuid }
    responses:
      "200":
        description: Instance found
        content:
          application/json:
            schema:
              type: object
              required: [id, definitionId, status, createdAt, updatedAt, summary]
              properties:
                id: { type: string, format: uuid }
                definitionId: { type: string, format: uuid }
                status:
                  type: string
                  enum: [pending, running, completed, cancelled, failed, paused]
                createdAt: { type: string, format: date-time }
                updatedAt: { type: string, format: date-time }
                summary:
                  type: object
                  properties:
                    totalSteps: { type: integer }
                    completedSteps: { type: integer }
                    runningSteps: { type: integer }
                    failedSteps: { type: integer }
                    pendingSteps: { type: integer }
      "400":
        description: Invalid id
        content:
          application/json:
            schema:
              type: object
              properties:
                error: { type: string, example: BadRequest }
                message: { type: string, example: Invalid id }
      "404":
        description: Instance not found
        content:
          application/json:
            schema:
              type: object
              properties:
                error: { type: string, example: NotFound }
                message: { type: string, example: Instance not found }
Acceptance Criteria
GET /api/instances/:id returns 200 with the documented shape for seeded ids.

Invalid UUID returns 400; non-existent UUID returns 404.

Unit tests cover 400/404/200 and pass in CI.

Docs & OpenAPI updated.

Out of Scope / Follow-ups
GET /api/instances/:id/progress endpoint

Step mutation endpoints (advance/complete)

Auth protection on workflow/instance routes

Metrics/alerts for route latency and 5xx rate

Refactor service to Drizzle query builders once schema naming is finalized

Implementation Checklist
 Router: /api/instances/:id with UUID validation

 Service: instance detail with step summary

 Tests (Vitest + Supertest) 400/404/200

 Mount routes in server/appRoutes.ts

 Export app for tests; guard listener in server/index.ts

 Docs updated; OpenAPI patched

 PR links to Issue #9 and includes Business Rationale
