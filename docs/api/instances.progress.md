# GET `/api/instances/:id/progress` — per-step progress & topology

Returns all definition steps for the instance’s workflow with runtime status, simple dependency topology, and a summary.

## Request
`GET /api/instances/{id}/progress`

## Response — 200 OK
```json
{
  "instanceId": "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  "steps": [
    {
      "stepId": "…",                     // may be null if not materialized
      "definitionStepId": "…",
      "name": "Approve Request",
      "type": "approval",
      "index": 0,
      "status": "in_progress",
      "updatedAt": "2025-09-05T12:34:56.789Z",
      "completedAt": null,
      "blockedBy": ["<definitionStepId>"],
      "isBlocked": false,
      "isReady": false,
      "isTerminal": false
    }
  ],
  "summary": { "total": 5, "completed": 2, "running": 1, "pending": 2 }
Errors
400 Bad Request — invalid UUID

404 Not Found — instance missing

500 Internal Server Error — unexpected

Notes
blockedBy lists definition step ids; isBlocked becomes true if any dependent step instance is not completed.

isReady = !isBlocked && status in {pending,ready,blocked}.

Summary uses: running = in_progress + ready, pending = pending + blocked + skipped.
