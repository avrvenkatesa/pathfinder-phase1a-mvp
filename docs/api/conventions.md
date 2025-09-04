
API Conventions
Content Type

All endpoints return application/json.

Authentication

For M1, workflow routes are unprotected. Future phases may require Authorization: Bearer <token>.

Errors

Standard error envelope:

{ "message": "Human-readable text", "code": "OPTIONAL_MACHINE_CODE", "details": { } }


Typical statuses:

400 — Validation/parse error (e.g., invalid status, invalid UUID, bad cursor)

404 — Resource not found

409 — Conflict (e.g., referential integrity, optimistic concurrency)

500 — Server error

See also: Errors Catalog
.

Pagination

Seek (keyset) pagination, not offset/limit.

Cursor is opaque (Base64 of updated_at|id).

Change of filters invalidates the cursor.

First page if cursor is omitted or the literal string "null".

Filtering

definitionId — UUID

status — enum: pending, running, completed, cancelled, failed, paused

Timestamps

All timestamps are ISO-8601 in UTC (e.g., 2025-09-04T00:49:10.309Z).
