# M1: Auth Gates on Runtime Endpoints (Issue #31)

## Why
- Protect workflow runtime operations (instances/steps) from unauthenticated access.
- Aligns with OpenAPI: affected routes now return **401 Unauthorized** when no valid auth.

## Scope
- All `/api/instances/**` and `/api/workflows/**` are guarded by authentication.
- Health & metrics remain public:
  - `GET /api/health`
  - `GET /metrics`

## Testing
- In tests, add this header to simulate an authenticated request:
.set("X-Test-Auth", "1")

css
Copy code
Example:
```ts
await request(app).get("/api/instances").set("X-Test-Auth", "1").expect(200);
OpenAPI
server/docs/openapi.yaml now documents 401 and 429 on runtime routes.

Runtime paths are under the unversioned base /api/*, while v1 resources like Contacts remain under /api/v1.

Client Guidance
On 401, re-authenticate (session/JWT) before retrying runtime operations.

Continue to respect 429 Retry-After headers for rate-limited routes.
