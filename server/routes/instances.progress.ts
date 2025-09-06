// server/routes/instances.progress.ts
import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

// UUID v4
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Convert any bigint(s) to numbers so JSON serialization won't 500
function sanitizeJson<T>(input: T): T {
  return JSON.parse(
    JSON.stringify(input, (_k, v) => (typeof v === "bigint" ? Number(v) : v))
  );
}

router.get(
  "/:id/progress",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // 400 — invalid id
      if (!UUID_V4.test(id)) {
        return res.status(400).json({ error: "BadRequest", message: "Invalid id" });
      }

      // Instance
      const instRes: any = await db.execute(sql`
        select
          id,
          status,
          workflow_definition_id,
          created_at,
          updated_at,
          started_at,
          completed_at
        from workflow_instances
        where id = ${id}
        limit 1
      `);
      const instanceRaw = instRes?.rows?.[0] ?? instRes?.[0] ?? null;
      if (!instanceRaw) {
        return res
          .status(404)
          .json({ error: "NotFound", message: "Instance not found" });
      }

      // Steps
      const stepsRes: any = await db.execute(sql`
        select
          id,
          step_id,
          name,
          type,
          sequence,
          status,
          assigned_to,
          payload,
          created_at,
          updated_at,
          started_at,
          completed_at
        from step_instances
        where workflow_instance_id = ${id}
        order by sequence asc, created_at asc
      `);
      const stepsRaw = stepsRes?.rows ?? stepsRes ?? [];

      // Rollup
      let total = 0,
        completed = 0,
        running = 0,
        pending = 0;

      const runningSet = new Set(["in_progress", "ready"]);
      const pendingSet = new Set(["pending", "blocked", "skipped"]);

      for (const s of stepsRaw) {
        total += 1;
        const st = s.status as string;
        if (st === "completed") completed += 1;
        else if (runningSet.has(st)) running += 1;
        else if (pendingSet.has(st)) pending += 1;
      }

      // Sanitize rows to avoid bigint -> JSON issues
      const instance = sanitizeJson(instanceRaw);
      const steps = sanitizeJson(stepsRaw);

      return res.json({
        instanceId: instance.id,
        summary: { total, running, completed, pending },
        instance,
        steps,
      });
    } catch (err) {
      // helpful in CI
      console.error("GET /api/instances/:id/progress failed:", err);
      next(err);
    }
  }
);

export default router;
