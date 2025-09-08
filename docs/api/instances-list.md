# GET /api/instances — List runtime instances

## Summary

Returns a paginated list of runtime instances. Uses forward-only, opaque **seek** pagination.  
Authentication is required (session or bearer).

## Endpoint

`GET /api/instances`

## Query parameters

| Name  | Type    | Required | Description                                                 |
| ----- | ------- | -------- | ----------------------------------------------------------- |
| limit | integer | no       | Max items to return (default **25**, max **100**).          |
| seek  | string  | no       | Opaque cursor to fetch the next page (from prior response). |

> The `seek` value is **opaque**—treat it as a token and echo it back to continue.

## Response (200)

```json
{
  "items": [
    {
      "id": "76678f3d-61f0-4e4e-a97e-99a07e38d2b2",
      "workflowId": "b2e6b6c0-9d87-4a33-8c5f-fb2dcb7e3f91",
      "status": "active",
      "createdAt": "2025-09-01T12:34:56.000Z",
      "updatedAt": "2025-09-06T09:12:33.000Z"
    }
  ],
  "next": "eyJjdHIiOiIxMjM0...opaque..."
}
Fields
items[]: array of instance summaries.

next: nullable string; pass this as seek to fetch the next page.

Status codes
200 OK – list returned

400 Bad Request – invalid limit or malformed seek

401 Unauthorized – missing/invalid auth

429 Too Many Requests – rate limit (see issue #35)

Error shape
Follows the platform error envelope (see shared Error schema). Example:

json
Copy code
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid seek token",
    "status_code": 400,
    "timestamp": "2025-09-07T12:00:00Z",
    "path": "/api/instances",
    "method": "GET",
    "request_id": "abc-123"
  }
}
Examples
cURL — first page
bash
Copy code
curl -sS -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/instances?limit=25"
cURL — next page
bash
Copy code
SEEK="eyJjdHIiOiIxMjM0...opaque..."
curl -sS -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/instances?seek=${SEEK}"
Notes
Sorting is implementation-defined but stable within a window.

The seek token is opaque; don’t parse or modify it.

Pagination is forward-only: omit seek to start; use returned next to continue; stop when next is null.

See also
GET /api/instances/:id — instance detail

GET /api/instances/:id/progress — progress summary

PATCH /api/instances/:id/steps/:stepId/status — explicit status transition

POST /api/instances/:id/steps/:stepId/advance — convenience: advance

POST /api/instances/:id/steps/:stepId/complete — convenience: complete
```
