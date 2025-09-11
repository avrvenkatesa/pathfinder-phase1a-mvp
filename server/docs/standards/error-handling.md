# Error Handling Standard (M1)

**Envelope**
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Human-friendly summary", "details": {}, "traceId": "..." } }
Why

Consistent client handling

Faster debugging (stable codes + traceId)

Guardrails against drift

Sources

Validation (Zod) → VALIDATION_FAILED (400)

Auth → AUTH_REQUIRED (401)

Conflict/sequence → CONFLICT / DEP_NOT_READY (409)

Rate limit → RATE_LIMIT_EXCEEDED (429)

Server errors → INTERNAL_SERVER_ERROR (500)
