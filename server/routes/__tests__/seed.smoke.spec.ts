import { describe, it, expect } from 'vitest';
import { db } from '../../db';
import { workflowInstances, stepInstances, stepDependencies } from '../../db/schema';

// Known deterministic IDs from scripts/seed.ts
const IDs = {
  wfAlpha: '11111111-1111-4111-8111-111111111111',
  wfBeta:  '22222222-2222-4222-8222-222222222222',
  sA1: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  sA2: 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  sA3: 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  sA4: 'aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  sB1: 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  sB2: 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  sB3: 'bbbbbbb3-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
} as const;

// Helper: does any field in an object equal a given value?
function rowHasValue<T extends Record<string, any>>(row: T, value: any) {
  return Object.values(row).some(v => v === value);
}

// Helper: read a string field if present, else undefined
function maybeString<T extends Record<string, any>>(row: T, key: string): string | undefined {
  const v = (row as any)[key];
  return typeof v === 'string' ? v : undefined;
}

describe('Seed smoke (schema-agnostic)', () => {
  it('contains both workflow instances (by IDs) and names (order-fulfillment / kyc-onboarding)', async () => {
    const rows = await db.select().from(workflowInstances);

    // By IDs
    expect(rows.some(r => rowHasValue(r, IDs.wfAlpha))).toBe(true);
    expect(rows.some(r => rowHasValue(r, IDs.wfBeta))).toBe(true);

    // By definition keys (whatever the column is called, we scan values)
    const allValues = new Set(rows.flatMap(r => Object.values(r)));
    expect(allValues.has('order-fulfillment')).toBe(true);
    expect(allValues.has('kyc-onboarding')).toBe(true);
  });

  it('order-fulfillment has 4 completed steps (by known step IDs)', async () => {
    const steps = await db.select().from(stepInstances);
    const alphaSteps = steps.filter(s =>
      rowHasValue(s, IDs.sA1) ||
      rowHasValue(s, IDs.sA2) ||
      rowHasValue(s, IDs.sA3) ||
      rowHasValue(s, IDs.sA4)
    );
    expect(alphaSteps.length).toBe(4);

    // Status field is usually "status"
    const allDone = alphaSteps.every(s => ((s as any).completedAt != null) || (typeof (s as any).status === "string" && ((s as any).status).toLowerCase() === "completed")); expect(allDone).toBe(true);
  });

  it('kyc review step is gated by 2 dependencies (fan-in to review)', async () => {
    const steps = await db.select().from(stepInstances);
    // Find the review step by its known ID or by its key/name if present
    const review = steps.find(s =>
      rowHasValue(s, IDs.sB3) ||
      maybeString(s, 'stepKey') === 'review' ||
      maybeString(s, 'key') === 'review' ||
      maybeString(s, 'name')?.toLowerCase() === 'analyst review'
    );
    expect(review).toBeTruthy();

    const deps = await db.select().from(stepDependencies);
    // Count dependencies that reference the review step anywhere in the row
    const intoReview = deps.filter(d => rowHasValue(d, IDs.sB3));
    // Fallback: if your dep columns are something like "toStepId"/"successorStepId", the above will match.
    expect(intoReview.length).toBeGreaterThanOrEqual(2);
  });
});
