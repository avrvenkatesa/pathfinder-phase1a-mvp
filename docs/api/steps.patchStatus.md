# M1: PATCH step status (wrapper)

## What the issue is about
### Title
**M1: PATCH step status (wrapper)**

### Business rationale
- **Runtime UI:** Let operators change a step’s state (e.g., unblock, mark completed/failed) without bespoke scripts.
- **Ops & Support:** One-call remediation to resolve stuck flows during triage.
- **Consistency:** Centralizes status rules/validation on the server so clients don’t reimplement them.

### Scope
- Add **PATCH** endpoint to update a single **step instance** status within a workflow instance.
- Enforce **allowed status transitions** and return clear errors when invalid.
- Make it **idempotent** when setting to the same status.
- No workflow engine orchestration yet (this is a **wrapper** over DB state with validation).

### Out of scope (follow-ups)
- Orchestration/side effects (e.g., auto-advance next steps).
- Bulk status changes.
- Audit/event streaming.
- Detailed progress endpoint (separate issue).

---

## API Contract
`PATCH /api/instances/:id/steps/:stepId/status`

Body:
```json
{ "status": "in_progress", "reason": "manual override", "metadata": { "ticket": "INC-1234" } }
Status transition rules (M1)

Idempotent if unchanged.

Disallow transitions from terminal states: completed | cancelled | skipped | failed.

Responses

200 updated step

400 invalid uuid/body

404 step not found for instance

409 invalid transition
