// server/controllers/steps.ts
import type { Request, Response } from "express";
import { advanceStepService, completeStepService, ApiError } from "../services/steps";
import { getEventPublisher, createEvent } from "../events/publisher";
import { logger } from "../logger";

export async function advanceStepController(req: Request, res: Response) {
  const { id, stepId } = req.params;
  
  try {
    const result = await advanceStepService(id, stepId, req);
    
    // Publish WebSocket event
    try {
      const eventPublisher = getEventPublisher();
      const event = createEvent.stepAdvanced(id, stepId, result.status, 'pending');
      await eventPublisher.publish(event);
      await eventPublisher.publishToRoom(`instance:${id}`, event);
    } catch (eventError) {
      logger.warn('Failed to publish step advanced event', { 
        instanceId: id, 
        stepId, 
        error: eventError 
      });
    }
    
    return res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof ApiError) {
      if (err.code === "NOT_FOUND") return res.status(404).json({ error: "Not found" });
      if (err.code === "DEP_NOT_READY")
        return res.status(409).json({ code: err.code, blockingDeps: err.blockingDeps ?? [] });
      if (err.code === "INVALID_TRANSITION")
        return res.status(422).json({ code: err.code, detail: err.detail });
    }
    console.error("advanceStepController error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

export async function completeStepController(req: Request, res: Response) {
  const { id, stepId } = req.params;
  
  try {
    const result = await completeStepService(id, stepId, req);
    
    // Publish WebSocket event
    try {
      const eventPublisher = getEventPublisher();
      const event = createEvent.stepCompleted(id, stepId, new Date());
      await eventPublisher.publish(event);
      await eventPublisher.publishToRoom(`instance:${id}`, event);
    } catch (eventError) {
      logger.warn('Failed to publish step completed event', { 
        instanceId: id, 
        stepId, 
        error: eventError 
      });
    }
    
    return res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof ApiError) {
      if (err.code === "NOT_FOUND") return res.status(404).json({ error: "Not found" });
      if (err.code === "DEP_NOT_READY")
        return res.status(409).json({ code: err.code, blockingDeps: err.blockingDeps ?? [] });
      if (err.code === "INVALID_TRANSITION")
        return res.status(422).json({ code: err.code, detail: err.detail });
    }
    console.error("completeStepController error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
