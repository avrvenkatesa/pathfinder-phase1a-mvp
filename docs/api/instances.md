# API: Workflow Instances

**Status:** Shipped via PR #22 (M1)  
**Routes mounted at:** `/api/instances`  
**Auth:** Unprotected (for M1); may move behind `isAuthenticated` later.

---

## GET `/api/instances`

List workflow instances with filtering and **seek pagination** (keyset).

### Query params

| Name           | Type     | Required | Notes |
|----------------|----------|----------|------|
| `definitionId` | `uuid`   | no       | Filter by workflow definition ID. |
| `status`       | enum     | no       | One of: `pending`, `running`, `completed`, `cancelled`, `failed`, `paused`. |
| `limit`        | integer  | no       | Page size. Default: `20`. Min: `1`. Max: `100`. |
| `cursor`       | string   | no       | Opaque cursor from previous page (`nextCursor`). The literal string `"null"` is ignored. |

### Ordering

Sorted by **`updated_at` DESC**, then **`id`** DESC as a tiebreaker.  
The cursor encodes the last item’s `updated_at|id` (Base64).

### Responses

#### 200 OK
```json
{
  "items": [
    {
      "id": "76678f3d-61f0-4e4e-a97e-99a07e38d2b2",
      "workflow_definition_id": "f3199689-4b6d-4711-8a83-13e2e0ba65f9",
      "status": "running",
      "started_at": "2025-09-04T00:49:10.309Z",
      "completed_at": null,
      "created_at": "2025-09-04T00:49:10.309Z",
      "updated_at": "2025-09-04T00:49:10.309Z"
    }
  ],
  "nextCursor": "MjAyNS0wOS0wNFQwMDo0OToxMC4zMDlafDc2Njc4ZjNkLTYxZjAtNGU0ZS1hOTdlLTk5YTA3ZTM4ZDJiMg=="
}
400 Bad Request
json
Copy code
{ "message": "Invalid status 'bogus'" }
json
Copy code
{ "message": "Invalid cursor" }
500 Internal Server Error
json
Copy code
{ "message": "Internal Server Error" }
cURL examples
bash
Copy code
# First page (default limit=20)
curl -s "http://localhost:5000/api/instances" | jq .

# Limit + filtering
DEF_ID=f3199689-4b6d-4711-8a83-13e2e0ba65f9
curl -s "http://localhost:5000/api/instances?definitionId=$DEF_ID&limit=2" | jq .

# Seek pagination
FIRST=$(curl -s "http://localhost:5000/api/instances?limit=1")
CURSOR=$(echo "$FIRST" | jq -r '.nextCursor // empty')
[ -n "$CURSOR" ] && curl -s "http://localhost:5000/api/instances?limit=1&cursor=$CURSOR" | jq .

# Bad status
curl -s -o /tmp/r.json -w "HTTP %{http_code}\n" \
  "http://localhost:5000/api/instances?status=bogus"
cat /tmp/r.json; echo

# Cursor explicitly "null" is ignored
curl -s "http://localhost:5000/api/instances?limit=2&cursor=null" | jq .
OpenAPI (excerpt)
yaml
Copy code
paths:
  /api/instances:
    get:
      summary: List workflow instances
      parameters:
        - in: query
          name: definitionId
          schema: { type: string, format: uuid }
        - in: query
          name: status
          schema:
            type: string
            enum: [pending, running, completed, cancelled, failed, paused]
        - in: query
          name: limit
          schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
        - in: query
          name: cursor
          schema: { type: string }
      responses:
        '200': { description: Paged list of workflow instances }
        '400': { description: Invalid request (status/cursor) }
        '500': { description: Server error }
Dev Notes
Contacts stubs (dev only): To avoid DB errors until contacts schema lands, enable:

bash
Copy code
CONTACTS_STUB=true
Mount points: Routers mounted in server/appRoutes.ts:

ts
Copy code
app.use("/api/workflows", workflows);
app.use("/api/instances", instances);
Performance: Seek pagination scales well on Neon/Postgres.

Links
Issue: #6 — M1: GET /api/instances (list/filter)

PR: #22 — M1: instances list/filter + seek pagination

---

## Business Rationale

**Why:** Provide fast, reliable visibility into workflow runs so Ops and Product can track progress, triage issues, and make decisions.  
**Outcomes:**
- Operational visibility for the Runtime Dashboard and support workflows
- Faster triage of stuck or long-running instances
- Pagination that scales with data growth (lower infra costs, better UX)
- Stable API contract to unblock frontend delivery in M2
