import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../../app";

describe("GET /api/instances validation", () => {
  it("400 on invalid limit", async () => {
    const r = await request(app)
      .get("/api/instances?limit=0")
      .set("X-Test-Auth", "1")
      .expect(400);
    expect(r.body?.error?.code).toBe("VALIDATION_ERROR");
  });

  it("400 on bad UUID", async () => {
    const r = await request(app)
      .get("/api/instances?definitionId=not-a-uuid")
      .set("X-Test-Auth", "1")
      .expect(400);
    expect(r.body?.error?.code).toBe("VALIDATION_ERROR");
  });
});
