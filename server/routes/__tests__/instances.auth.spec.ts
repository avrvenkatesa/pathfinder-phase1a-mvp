import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../../app";

describe("Auth gate for runtime endpoints", () => {
  it("GET /api/instances returns 401 without auth", async () => {
    await request(app).get("/api/instances").expect(401);
  });

  it("GET /api/instances returns 200 with test auth header", async () => {
    await request(app).get("/api/instances").set("X-Test-Auth", "1").expect(200);
  });

  it("POST /api/instances/:id/steps/:stepId/advance returns 401 without auth", async () => {
    await request(app)
      .post(
        "/api/instances/00000000-0000-4000-8000-000000000000/steps/00000000-0000-4000-8000-000000000000/advance"
      )
      .expect(401);
  });
});
