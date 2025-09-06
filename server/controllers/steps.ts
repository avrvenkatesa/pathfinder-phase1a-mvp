import type { Request, Response } from "express";
import { advanceStepService, completeStepService } from "../services/steps";

export async function advanceStepController(req: Request, res: Response) {
  const { id, stepId } = req.params;
  try {
    const result = await advanceStepService(id, stepId, req);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.code === "NOT_FOUND") return res.status(404).json({ error: "Not found" });
    if (err?.code === "DEP_NOT_READY") return res.status(409).json({ code: err.code, blockingDeps: err.blockingDeps });
    if (err?.code === "INVALID_TRANSITION") return res.status(422).json({ code: err.code, detail: err.detail });
    console.error("advanceStepController error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function completeStepController(req: Request, res: Response) {
  const { id, stepId } = req.params;
  try {
    const result = await completeStepService(id, stepId, req);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.code === "NOT_FOUND") return res.status(404).json({ error: "Not found" });
    if (err?.code === "DEP_NOT_READY") return res.status(409).json({ code: err.code, blockingDeps: err.blockingDeps });
    if (err?.code === "INVALID_TRANSITION") return res.status(422).json({ code: err.code, detail: err.detail });
    console.error("completeStepController error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
