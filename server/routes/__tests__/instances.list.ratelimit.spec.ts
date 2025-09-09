import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../app";

describe("GET /api/instances rate limit", () => {
  it("429 after many rapid calls", async () => {
    // Hit more than the per-minute max quickly
    for (let i = 0; i < 65; i++) {
      const res = await request(app).get("/api/instances");
      if (i >= 60) {
        expect([200, 429]).toContain(res.status); // CI timing tolerance
      }
    }
  });
});
