// server/observability/metrics.ts
import client from "prom-client";
import type { Request, Response, NextFunction } from "express";

export const registry = new client.Registry();
client.collectDefaultMetrics({
  register: registry,
  prefix: "pf_",
});

// HTTP metrics
export const httpRequestsTotal = new client.Counter({
  name: "pf_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["route", "method", "status"] as const,
  registers: [registry],
});

export const httpRequestDurationMs = new client.Histogram({
  name: "pf_http_request_duration_ms",
  help: "HTTP request duration in ms",
  labelNames: ["route", "method"] as const,
  buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1600, 3200],
  registers: [registry],
});

// Error/ratelimit counters (wire from your error/rate-limit middlewares)
export const errorsTotal = new client.Counter({
  name: "pf_errors_total",
  help: "Total number of errors by canonical error code",
  labelNames: ["code"] as const, // matches your error.error.code
  registers: [registry],
});

export const rateLimitedTotal = new client.Counter({
  name: "pf_rate_limited_total",
  help: "Total number of rate limited responses",
  registers: [registry],
});

// DB metrics (optional placeholders—export and record from your DB layer)
export const dbPoolInUse = new client.Gauge({
  name: "pf_db_pool_in_use",
  help: "Current DB pool connections in use",
  registers: [registry],
});

export const dbPoolWaitMs = new client.Histogram({
  name: "pf_db_pool_wait_ms",
  help: "Time spent waiting for a DB connection (ms)",
  buckets: [1, 2, 5, 10, 20, 50, 100, 200, 500],
  registers: [registry],
});

export const dbQueryDurationMs = new client.Histogram({
  name: "pf_db_query_duration_ms",
  help: "DB query duration in ms",
  buckets: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000],
  registers: [registry],
});

/**
 * Per-request timing: start a timer, observe on finish.
 * Use req.route?.path if available; otherwise 'unknown'.
 */
export function httpMetrics() {
  return (req: Request, res: Response, next: NextFunction) => {
    const endTimer = httpRequestDurationMs.startTimer({
      method: req.method,
    });

    res.on("finish", () => {
      const route = (req.route && (req.route.path as string)) || "unknown";
      const status = String(res.statusCode);
      endTimer({ route });

      httpRequestsTotal.inc({ route, method: req.method, status });
    });

    next();
  };
}

/** Express handler for GET /metrics */
export async function metricsHandler(_: Request, res: Response) {
  res.setHeader("Content-Type", registry.contentType);
  res.status(200).send(await registry.metrics());
}
