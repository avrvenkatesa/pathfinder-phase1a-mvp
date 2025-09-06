# M1: Observability baseline

## Rationale
- See route latency + 5xx rate; troubleshoot regressions.

## Scope
- Add per-route latency and 5xx counters (simple middleware or prom-client).
- Keep existing lightweight JSON logs; document how to scrape/inspect.

## Acceptance
- Metrics exposed at a toggleable endpoint or stdout summary.
- Basic dashboard screenshot or instructions included.

## Out of scope
- Full tracing; external APM integration.
