import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../../app";

describe("GET /api/instances rate limit", () => {
  it(
    "429 after many rapid calls",
    async () => {
      let got429 = false;
      for (let i = 0; i < 65; i++) {
        const res = await request(app)
          .get("/api/instances")
          .set("X-Test-Auth", "1")
          .set("Accept", "application/json");

        if (res.status === 429) {
          got429 = true;
          break;
        }
      }
      expect(got429).toBe(true);
    },
    15000 // allow a bit more time
  );
});
