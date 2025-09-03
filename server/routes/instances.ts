import { Router } from "express";
import {
    startInstance,
    getProgress,
    advanceStep,
    completeStep,
} from "../services/instances";

const r = Router();

r.post("/", async (req, res, next) => {
    try { res.status(201).json(await startInstance(req.body.definitionId)); }
    catch (e) { next(e); }
});

r.get("/:instanceId/progress", async (req, res, next) => {
    try { res.json(await getProgress(req.params.instanceId)); }
    catch (e) { next(e); }
});

r.post("/:instanceId/steps/:stepId/advance", async (req, res, next) => {
    try { res.json(await advanceStep(req.params.instanceId, req.params.stepId)); }
    catch (e) { next(e); }
});

r.post("/:instanceId/steps/:stepId/complete", async (req, res, next) => {
    try { res.json(await completeStep(req.params.instanceId, req.params.stepId)); }
    catch (e) { next(e); }
});

export default r;
