
ADR-0001: Seek Pagination for Instances Listing

Date: 2025-09-04

Status: Accepted

Related: PR #22, Issue #6

Context

We need a scalable listing for /api/instances that:

Works efficiently on large tables (Neon Postgres).

Maintains stable ordering without duplicates/skips.

Produces an opaque, safe cursor for clients.

Decision

Use seek (keyset) pagination ordered by:

updated_at (DESC)

id (DESC, tiebreaker)

The cursor encodes the last row’s updated_at|id as Base64.
“Next page” query uses:

WHERE
  (i.updated_at < $cursor_ts) OR
  (i.updated_at = $cursor_ts AND i.id < $cursor_id)


…alongside optional filters (definitionId, status) and LIMIT.

Rationale

Performance: Avoids large OFFSET scans.

Correctness: No duplicates or gaps under concurrent writes; tiebreaker prevents clumps on identical timestamps.

Simplicity: Opaque cursor without exposing internals.

Consequences

Clients must pass nextCursor to fetch the next page.

Cursor is filter-specific; changing filters invalidates it (we return 400 for malformed/invalid cursors).

"cursor=null" is treated as “no cursor” (first page) for ergonomics.

Implementation Notes

Cursor format: base64(ISO-8601-updated_at + "|" + uuid).

Filters:

definitionId (uuid, optional)

status in {pending,running,completed,cancelled,failed,paused}

Default limit = 20 (bounded to 100).

Testing

Verified page-to-page iteration produces no duplicates and halts with nextCursor: null.

Verified status validation (400), bad cursor (400), "cursor=null" (first page).
