# M1: Rate Limiting & Input Hardening (Issue #35)

## Business rationale

- **Protect availability & UX:** Stop request floods early with **429** instead of cascading 5xx.
- **Control costs:** Guard hot endpoints to prevent accidental spikes (DB/CPU/egress).
- **Security posture:** Aligns with **OWASP API Top 10 – API4: Lack of Resources & Rate Limiting**; strict input validation shrinks injection surface.
- **Contract-first behavior:** Turn ambiguous server errors into clear **400** with field-level messages.
- **SLO protection:** Backpressure keeps P95/P99 stable and preserves error budgets.

---

## Scope (initial)

**Enabled in M1**

- `GET /api/instances` — per-route limiter + strict query validation.

**Planned / policy defined (wire up in follow-ups)**

- `GET /api/instances/{id}`
- `PATCH /api/instances/{id}/steps/{stepId}/status`
- `POST /api/instances/{id}/steps/{stepId}/advance`
- `POST /api/instances/{id}/steps/{stepId}/complete`

> We ship the list endpoint now; the others reuse the same limiter utilities and validation patterns.

---

## Defaults & profiles

| Endpoint             | Default limit (prod/stage) | Window | Test/CI profile\* |
| -------------------- | -------------------------- | ------ | ----------------- |
| `GET /api/instances` | 60 req/min                 | 60s    | 20 req / 10s      |

\* The test profile uses a tighter window to make 429 specs deterministic.

### Standard response headers

We emit **RFC standard** rate limit headers:

- `RateLimit-Limit` – total requests allowed in the window
- `RateLimit-Remaining` – requests left in the current window
- `RateLimit-Reset` – seconds until the window resets

(“X-RateLimit-\*” legacy headers are disabled.)

---

## Input validation (list endpoint)

**Query parameters**

- `definitionId` — UUID (optional)
- `status` — enum: `pending|running|completed|cancelled|failed|paused` (optional)
- `limit` — integer **1–100** (default **20**)
- `cursor` — opaque string (≤ 512 chars)

**Failure** → **400 Bad Request** with a structured error.

### Example 400 (validation)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": [
      { "path": "limit", "message": "Must be between 1 and 100" }
    ]
  }
}

Rate limit behavior
Example 429
{
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "Too many requests, please try again later",
    "status_code": 429
  }
}


Client guidance

On 429, apply exponential backoff with jitter and respect RateLimit-Reset.

Prefer seek/cursor pagination; treat cursors as opaque.

Avoid tight polling loops.

Observability

KPIs

< 1% requests classified as 5xx due to malformed input (shifted to 4xx)

Stable P95/P99 under controlled 10× burst

100% runtime endpoints covered by validation + tests

Metrics to watch

429 rate by route/principal

Validation error rate by field/enum

DB saturation vs. rejected traffic (to confirm successful backpressure)

Configuration (env)

These keys are read by the limiter factory; values shown are typical defaults.

# Global window
RATE_WINDOW_MS=60000

# Per-route caps
RATE_LIST_LIMIT=60            # GET /api/instances
# (Reserved for follow-ups)
RATE_DETAIL_LIMIT=120         # GET /api/instances/:id
RATE_STEP_WRITE_LIMIT=60      # PATCH status
RATE_CONVENIENCE_LIMIT=30     # POST advance/complete

# Test/CI profile (overrides)
TEST_RATE_WINDOW_MS=10000
TEST_RATE_LIST_LIMIT=20

OpenAPI notes

Add 429 responses with the error envelope and document the RateLimit-* headers on affected endpoints.

Document parameter constraints (ranges, enums, formats) for the list endpoint.

Include example payloads for 400 and 429.
```
