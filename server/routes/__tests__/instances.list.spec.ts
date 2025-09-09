import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { app } from "../../app";

describe("GET /api/instances (list)", () => {
  it("returns 200 and an array payload", async () => {
    const res = await request(app)
      .get("/api/instances")
      .expect(200);

    // Accept common shapes: array, {items:[...]}, {instances:[...]}, {data:{items|instances}}
    const payload =
      Array.isArray(res.body)
        ? res.body
        : res.body.items ??
          res.body.instances ??
          res.body.data?.items ??
          res.body.data?.instances;

    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBeGreaterThan(0);

    // Sanity: each item has an id (uuid-ish) and a workflow/createdAt if present
    const first = payload[0];
    expect(first).toHaveProperty("id");
  });

  it("supports limit (pagination first page)", async () => {
    const limit = 2;
    const res = await request(app)
      .get(`/api/instances?limit=${limit}`)
      .expect(200);

    const items =
      Array.isArray(res.body)
        ? res.body
        : res.body.items ??
          res.body.instances ??
          res.body.data?.items ??
          res.body.data?.instances;

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeLessThanOrEqual(limit);

    // Try to detect a cursor/seek token (adjust key if your API uses a different name)
    const cursor =
      res.body.next ??
      res.body.nextCursor ??
      res.body.seek?.next ??
      res.body.data?.next ??
      res.body.data?.nextCursor ??
      res.body.data?.seek?.next;

    // If your API returns a cursor, fetch the next page and ensure no overlap
    if (cursor) {
      const res2 = await request(app)
        .get(`/api/instances?cursor=${encodeURIComponent(cursor)}&limit=${limit}`)
        .expect(200);

      const items2 =
        Array.isArray(res2.body)
          ? res2.body
          : res2.body.items ??
            res2.body.instances ??
            res2.body.data?.items ??
            res2.body.data?.instances;

      const ids1 = new Set(items.map((i: any) => i.id));
      const overlap = items2.filter((i: any) => ids1.has(i.id));
      expect(overlap.length).toBe(0);
    }
  });

  it("rejects absurd limits (if validation exists)", async () => {
    // If you enforce validation (e.g., max=100), expect 400. If not, change to expect(200).
    const res = await request(app)
      .get("/api/instances?limit=100000")
      .expect((r) => {
        // allow either behavior, but prefer 400 if you have validation
        if (![200, 400].includes(r.status)) {
          throw new Error(`Expected 200 or 400, got ${r.status}`);
        }
      });

    if (res.status === 400) {
      const msg = JSON.stringify(res.body);
      expect(msg).toMatch(/(invalid|limit|range|validation)/i);
    }
  });

  it("is stable and deterministic by default (ordering hint)", async () => {
    const a = await request(app).get("/api/instances?limit=5").expect(200);
    const b = await request(app).get("/api/instances?limit=5").expect(200);

    const itemsA =
      Array.isArray(a.body) ? a.body :
      a.body.items ?? a.body.instances ?? a.body.data?.items ?? a.body.data?.instances;

    const itemsB =
      Array.isArray(b.body) ? b.body :
      b.body.items ?? b.body.instances ?? b.body.data?.items ?? b.body.data?.instances;

    expect(itemsA.map((i: any) => i.id)).toEqual(itemsB.map((i: any) => i.id));
  });
});
