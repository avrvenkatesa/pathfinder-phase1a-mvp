# GET `/api/instances/:id/progress`

Returns a workflow instance’s progress (rollup counts + per-step flags).

## Path params
- `id` — UUIDv4 (required)

## Response — 200 OK
```json
{
  "instanceId": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  "summary": {
    "total": 5,
    "running": 2,
    "completed": 1,
    "pending": 2,
    "failed": 0
  },
  "steps": [
    {
      "stepId": "11111111-2222-4ccc-8ddd-333333333333",   // may be null if not materialized
      "definitionStepId": "44444444-5555-4ccc-8ddd-666666666666",
      "index": 0,
      "status": "in_progress",
      "isReady": true,
      "isBlocked": false,
      "isTerminal": false,
      "blockedBy": []
    }
  ]
}
Errors
400 Bad Request — invalid UUID
{"error":"BadRequest","message":"Invalid id"}

404 Not Found — instance not found
{"error":"NotFound","message":"Instance not found"}

Notes
running rollup covers ready + in_progress.

pending rollup covers pending + blocked + skipped.

Additional timestamp fields on steps may be present and should be treated as optional.
