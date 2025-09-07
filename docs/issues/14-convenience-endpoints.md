# Issue 14 — Convenience Endpoints for Steps (advance/complete)

**Status:** Merged to feature branch  
**Owner:** @you  
**Related tests:** `server/routes/__tests__/instances.convenience.spec.ts`, `steps.patchStatus.spec.ts`

## Summary
Adds two convenience endpoints to progress a step forward without the client hand-crafting status transitions:
- `POST /api/instances/:instanceId/steps/:stepInstanceId/advance` → `in_progress`
- `POST /api/instances/:instanceId/steps/:stepInstanceId/complete` → `completed`

Endpoints enforce **sequence dependencies**: a step cannot advance/complete until all earlier sequence steps for the same workflow instance are `completed`.

## Context
- DB uses `snake_case`; step statuses are lower-case enum values: `pending | ready | blocked | in_progress | completed`.
- Tests import the Express app from `server/app.ts`.
- Route mounting happens in `server/appRoutes.ts`.

## What changed
- Implemented the convenience routes inside `server/routes/instances.steps.ts` (co-located with the PATCH status route).
- Standardized 409 responses for dependency violations to:
  ```json
  { "error": "NotReady", "code": "NotReady" }
(The test expects /NotReady|DEP|blocked|sequence/i to match one of error or code.)

Ensured mounting order in server/appRoutes.ts so the convenience routes are reachable.

Cleaned up old server/routes/instances.convenience.ts (no longer needed).

Endpoints
Advance
POST /api/instances/:instanceId/steps/:stepInstanceId/advance

200 OK

json
Copy code
{ "step": { "id": "<uuid>", "instanceId": "<uuid>", "status": "in_progress", "updatedAt": "...", "completedAt": null } }
409 Conflict (dependencies not satisfied)

json
Copy code
{ "error": "NotReady", "code": "NotReady" }
400 Bad Request if either UUID is invalid.

Complete
POST /api/instances/:instanceId/steps/:stepInstanceId/complete

200 OK

json
Copy code
{ "step": { "id": "<uuid>", "instanceId": "<uuid>", "status": "completed", "updatedAt": "...", "completedAt": "..." } }
409 Conflict (dependencies not satisfied)

json
Copy code
{ "error": "NotReady", "code": "NotReady" }
400 Bad Request if either UUID is invalid.

Tests
Run just the API route tests:

bash
Copy code
npm run test:api
Result:
Test Files 4 passed (4) / Tests 11 passed (11)

Troubleshooting
404 on convenience endpoints: confirm server/appRoutes.ts mounts instances.steps before instances.byId and that server/app.ts calls registerRoutes(app).

409 body shows "Conflict" only: you’re probably hitting an older handler. Search for error.*Conflict|code.*NotReady and replace with { error: "NotReady", code: "NotReady" }.

Follow-ups
When real dependency graph logic (beyond simple sequence) arrives, extend the guard to include step_dependencies.

Add auditing/events for step state changes if required by analytics.

