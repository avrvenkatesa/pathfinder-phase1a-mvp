// server/routes/instances.progress.ts
import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { errors } from "../errors";

const router = Router();

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
        return next(
          errors.validation({
            issues: [
              {
                path: ["id"],
                code: "invalid_uuid",
                message: "Invalid id (expected UUID v4)",
              },
            ],
          })
        );
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
        return next(errors.notFound("Instance"));
      }

      // Steps — only columns that surely exist on step_instances
      const stepsRes: any = await db.execute(sql`
        select
          id,
          step_id,
          status,
          assigned_to,
          payload,
          created_at,
          updated_at,
          started_at,
          completed_at,
          workflow_instance_id
        from step_instances
        where workflow_instance_id = ${id}
        order by created_at asc
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

      // Enrich steps with expected fields
      const steps = (stepsRaw as any[]).map((s, i) => {
        const status: string = s.status;
        const isReady = status === "ready";
        const isBlocked = status === "blocked";
        const isTerminal = ["completed", "failed", "cancelled", "skipped"].includes(
          status
        );
        return {
          // original ids
          id: s.id,
          stepId: s.step_id ?? null,
          definitionStepId: s.step_id ?? s.id, // fall back to id if step_id missing
          // derived
          index: i, // 0-based, ordered by created_at asc
          status,
          isReady,
          isBlocked,
          isTerminal,
          blockedBy: [] as string[], // no dependency graph yet
          // keep a few timestamps for UI if needed
          created_at: s.created_at,
          updated_at: s.updated_at,
          started_at: s.started_at,
          completed_at: s.completed_at,
        };
      });

      return res.json({
        instanceId: instance.id,
        summary: { total, running, completed, pending },
        instance,
        steps,
      });
    } catch (err) {
      console.error("GET /api/instances/:id/progress failed:", err);
      next(err);
    }
  }
);

export default router;
