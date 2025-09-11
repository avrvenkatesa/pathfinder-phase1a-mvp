import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../../app";

describe("GET /metrics", () => {
  it("exposes Prometheus metrics with pf_ prefix", async () => {
    const res = await request(app).get("/metrics").expect(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.text).toContain("pf_http_requests_total");
    expect(res.text).toContain("pf_http_request_duration_ms");
  });
});
