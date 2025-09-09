import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../app";

describe("GET /api/instances validation", () => {
  it("400 on invalid limit", async () => {
    const r = await request(app).get("/api/instances?limit=0").expect(400);
    expect(r.body?.error?.code).toBe("VALIDATION_ERROR");
  });

  it("400 on bad UUID", async () => {
    const r = await request(app).get("/api/instances?definitionId=not-a-uuid").expect(400);
    expect(r.body?.error?.code).toBe("VALIDATION_ERROR");
  });
});
