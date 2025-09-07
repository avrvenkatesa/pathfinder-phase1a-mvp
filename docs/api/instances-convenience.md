# API: Convenience Step Mutations (Issue #14)

## POST /api/instances/:id/steps/:stepId/advance
Wraps a safe “advance” transition (e.g., `PENDING|BLOCKED -> IN_PROGRESS`), enforcing dependency readiness.

**Request**: `POST` (no body)  
**Responses**
- `200 OK` `{ stepInstance, changed: true }`
- `409 Conflict` `{ code: "DEP_NOT_READY", blockingDeps: [...] }`
- `422 UnprocessableEntity` `{ code: "INVALID_TRANSITION" }`
- `404 NotFound`

---

## POST /api/instances/:id/steps/:stepId/complete
Marks a step as `COMPLETED` if valid from current status and all deps satisfied.

**Request**: `POST` (no body)  
**Responses**
- `200 OK` `{ stepInstance, changed: true }`
- `409 Conflict` `{ code: "DEP_NOT_READY", blockingDeps: [...] }`
- `422 UnprocessableEntity` `{ code: "INVALID_TRANSITION" }`
- `404 NotFound`
