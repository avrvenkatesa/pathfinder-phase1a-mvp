import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import { app } from "../../app";

describe("GET /api/instances (list)", () => {
  it("returns 200 and an array payload", async () => {
    const r = await request(app)
      .get("/api/instances")
      .set("X-Test-Auth", "1")
      .expect(200);

    expect(Array.isArray(r.body?.items)).toBe(true);
    // next is optional/nullable string
    if ("next" in r.body) {
      expect(typeof r.body.next === "string" || r.body.next === null).toBe(true);
    }
  });

  it("respects limit", async () => {
    const r = await request(app)
      .get("/api/instances?limit=5")
      .set("X-Test-Auth", "1")
      .expect(200);

    expect(Array.isArray(r.body?.items)).toBe(true);
    expect(r.body.items.length <= 5).toBe(true);
  });
});
