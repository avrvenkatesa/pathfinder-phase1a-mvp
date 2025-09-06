import { Router } from "express";
import {
    startInstance,
    getProgress,
    advanceStep,
    completeStep,
    listInstances,
} from "../services/instances";

const r = Router();

// LIST: GET /api/instances?definitionId=&status=&limit=&cursor=
r.get("/", async (req, res, next) => {
    try {
        const { definitionId, status, limit, cursor } = req.query as Record<
            string,
            string | undefined
        >;

        const data = await listInstances({
            definitionId: definitionId?.trim() || undefined,
            status: status?.trim() || undefined,
            limit: limit ? Number(limit) : undefined,
            cursor: cursor?.trim() || undefined,
        });

        res.json(data);
    } catch (err) {
        next(err);
    }
});

// START: POST /api/instances
r.post("/", async (req, res, next) => {
    try {
        res.status(201).json(await startInstance(req.body.definitionId));
    } catch (e) {
        next(e);
    }
});

// PROGRESS: GET /api/instances/:instanceId/progress_DEPRECATED
r.get("/:instanceId/progress_DEPRECATED", async (req, res, next) => {
    try {
        res.json(await getProgress(req.params.instanceId));
    } catch (e) {
        next(e);
    }
});

// ADVANCE: POST /api/instances/:instanceId/steps/:stepId/advance
r.post("/:instanceId/steps/:stepId/advance", async (req, res, next) => {
    try {
        res.json(await advanceStep(req.params.instanceId, req.params.stepId));
    } catch (e) {
        next(e);
    }
});

// COMPLETE: POST /api/instances/:instanceId/steps/:stepId/complete
r.post("/:instanceId/steps/:stepId/complete", async (req, res, next) => {
    try {
        res.json(await completeStep(req.params.instanceId, req.params.stepId));
    } catch (e) {
        next(e);
    }
});

export default r;
