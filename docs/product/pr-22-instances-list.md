# Product Note — PR #22: Instances List & Filtering (M1)

**Date:** 2025-09-05  
**Status:** Shipped (M1)  
**API:** `GET /api/instances` with filtering & seek pagination

## Summary
We delivered a scalable API to list workflow instances with filters (by workflow and status) and reliable pagination. This powers the Runtime Dashboard and reduces time-to-triage for stuck or long-running workflows.

## Business Value
- **Operational visibility:** Answer “what’s running / stuck / done?” quickly.
- **Faster support:** Filter by workflow and status to zero in on issues.
- **Scales with adoption:** Keyset pagination keeps response times low as data grows.
- **Unblocks frontend:** Enables list views and infinite scroll for M2 dashboard.

## Who benefits
- **Customer Support / Ops:** Faster triage and status answers.
- **Engineering:** Stable, performant list pattern across services.
- **Product / Leadership:** Throughput and reliability metrics baseline.

## What shipped
- `GET /api/instances`
  - Filters: `definitionId` (uuid), `status` (pending, running, completed, cancelled, failed, paused)
  - Pagination: `limit` + opaque `nextCursor` (Base64 of `updated_at|id`)
  - Ordering: `updated_at DESC, id DESC` for stability

## Success Criteria
- Returns consistent pages without duplicates/skips
- Works efficiently on Neon/Postgres at scale
- Clear 400s for invalid status/cursor

## What’s next
- **Instance detail** (`GET /api/instances/:id`) including step counts & timestamps
- **Progress view** and **task assignment** endpoints
- Frontend **Runtime Dashboard** (M2) built on this API

## Links
- PR: #22
- Issue: #6
- Docs: `docs/api/instances.md`
