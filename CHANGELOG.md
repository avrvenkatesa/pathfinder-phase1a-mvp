# Changelog

## Unreleased
- feat: convenience step endpoints (advance/complete) with sequence guard
- test: add convenience spec and align 409 payload to { error: , code:  }

## 2025-09-05 — M1: Instances list/filter (PR #22)

### Added
- `GET /api/instances` with filtering and **seek (keyset) pagination**.
  - Filters: `definitionId` (uuid), `status` in {pending,running,completed,cancelled,failed,paused}
  - Ordering: `updated_at DESC, id DESC` (tiebreaker)
  - Opaque `nextCursor` (Base64 of `updated_at|id`); changing filters invalidates the cursor

### Why it matters
- **Operational visibility** for runtime dashboard and support triage
- **Scales with growth** on Neon/Postgres; avoids slow OFFSET scans
- **Unblocks frontend** list views and infinite scroll in M2

### Developer notes
- `"null"` cursor is treated as no cursor (first page)
- Invalid cursor returns **400**; unknown status returns **400**
- Dev-only contacts stubs available with `CONTACTS_STUB=true`

