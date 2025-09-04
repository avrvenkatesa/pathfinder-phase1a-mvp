import { Router } from "express";
import {
    listWorkflowDefs,
    getWorkflowDef,
    createWorkflowDef,
    updateWorkflowDef,
    deleteWorkflowDef,
    addStep,
    updateStep,
    deleteStep,
    addDependency,
    deleteDependency,
} from "../services/workflows";

const r = Router();

// definitions
r.get("/", async (_req, res, next) => { try { res.json(await listWorkflowDefs()); } catch (e) { next(e); } });
r.get("/:defId", async (req, res, next) => { try { res.json(await getWorkflowDef(req.params.defId)); } catch (e) { next(e); } });
r.post("/", async (req, res, next) => { try { res.status(201).json(await createWorkflowDef(req.body)); } catch (e) { next(e); } });
r.patch("/:defId", async (req, res, next) => { try { res.json(await updateWorkflowDef(req.params.defId, req.body)); } catch (e) { next(e); } });
r.delete("/:defId", async (req, res, next) => { try { res.json(await deleteWorkflowDef(req.params.defId)); } catch (e) { next(e); } });

// steps
r.post("/:defId/steps", async (req, res, next) => { try { res.status(201).json(await addStep(req.params.defId, req.body)); } catch (e) { next(e); } });
r.patch("/steps/:stepId", async (req, res, next) => { try { res.json(await updateStep(req.params.stepId, req.body)); } catch (e) { next(e); } });
r.delete("/steps/:stepId", async (req, res, next) => { try { res.json(await deleteStep(req.params.stepId)); } catch (e) { next(e); } });

// dependencies
r.post("/dependencies", async (req, res, next) => { try { res.status(201).json(await addDependency(req.body)); } catch (e) { next(e); } });
r.delete("/dependencies/:id", async (req, res, next) => { try { res.json(await deleteDependency(req.params.id)); } catch (e) { next(e); } });

export default r;
