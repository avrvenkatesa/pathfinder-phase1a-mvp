type TransitionResult = { stepInstance: any; changed: boolean };

function notFound() { const e: any = new Error("Not found"); e.code = "NOT_FOUND"; return e; }
function depNotReady() { const e: any = new Error("Dependencies not ready"); e.code = "DEP_NOT_READY"; e.blockingDeps = []; return e; }
function invalidTransition(detail: string) { const e: any = new Error("Invalid transition"); e.code = "INVALID_TRANSITION"; e.detail = detail; return e; }

/**
 * NOTE: These are scaffolds to enable PR + discussion.
 * They will be replaced by real implementations that call the validated
 * transition layer used by PATCH /status and enforce dependency checks.
 */
export async function advanceStepService(instanceId: string, stepId: string, _req: any): Promise<TransitionResult> {
  if (!instanceId || !stepId) throw notFound();
  // placeholder return to keep build green
  return { stepInstance: { instanceId, stepId, status: "IN_PROGRESS" }, changed: true };
}

export async function completeStepService(instanceId: string, stepId: string, _req: any): Promise<TransitionResult> {
  if (!instanceId || !stepId) throw notFound();
  // placeholder return to keep build green
  return { stepInstance: { instanceId, stepId, status: "COMPLETED" }, changed: true };
}
