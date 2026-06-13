import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { sequencePlans } from '@/lib/db/schema';
import { deserializeSequenceStep, serializeSequenceStep } from '@/lib/sequencer/engine';
import type { SequencePlan, TemplateId } from '@/types/sequencer';

type SequencePlanRow = typeof sequencePlans.$inferSelect;

/** Maps a persisted row back into the domain `SequencePlan` shape. */
function rowToPlan(row: SequencePlanRow): SequencePlan {
  return {
    id: row.id,
    walletAddress: row.walletAddress,
    createdAt: row.createdAt,
    steps: row.steps.map(deserializeSequenceStep),
    status: row.status,
    totalCostUsd: Number(row.totalCostUsd ?? 0),
    positionSizeUsd: row.positionSizeUsd != null ? Number(row.positionSizeUsd) : undefined,
    description: row.description,
    templateId: row.templateId as TemplateId,
  };
}

export async function createSequencePlan(
  plan: SequencePlan,
  templateId: string,
): Promise<SequencePlan | null> {
  try {
    const [row] = await getDb()
      .insert(sequencePlans)
      .values({
        walletAddress: plan.walletAddress,
        templateId,
        description: plan.description,
        status: plan.status,
        totalCostUsd: plan.totalCostUsd != null ? String(plan.totalCostUsd) : null,
        positionSizeUsd: plan.positionSizeUsd != null ? String(plan.positionSizeUsd) : null,
        steps: plan.steps.map(serializeSequenceStep),
      })
      .returning();

    return rowToPlan(row);
  } catch (error) {
    console.error('Error creating sequence plan:', error);
    return null;
  }
}

export async function getSequencePlan(id: string): Promise<SequencePlan | null> {
  try {
    const [row] = await getDb()
      .select()
      .from(sequencePlans)
      .where(eq(sequencePlans.id, id))
      .limit(1);

    return row ? rowToPlan(row) : null;
  } catch (error) {
    console.error('Error getting sequence plan:', error);
    return null;
  }
}

export async function updateSequencePlanStep(
  planId: string,
  _stepId: string,
  steps: SequencePlan['steps'],
  newStatus: SequencePlan['status'],
): Promise<boolean> {
  try {
    await getDb()
      .update(sequencePlans)
      .set({
        steps: steps.map(serializeSequenceStep),
        status: newStatus,
        ...(newStatus === 'complete' ? { completedAt: new Date() } : {}),
      })
      .where(eq(sequencePlans.id, planId));

    return true;
  } catch (error) {
    console.error('Error updating sequence plan step:', error);
    return false;
  }
}

export async function markPlanComplete(id: string): Promise<boolean> {
  try {
    await getDb()
      .update(sequencePlans)
      .set({ status: 'complete', completedAt: new Date() })
      .where(eq(sequencePlans.id, id));

    return true;
  } catch (error) {
    console.error('Error marking plan complete:', error);
    return false;
  }
}

export async function markPlanFailed(id: string): Promise<boolean> {
  try {
    await getDb().update(sequencePlans).set({ status: 'failed' }).where(eq(sequencePlans.id, id));

    return true;
  } catch (error) {
    console.error('Error marking plan failed:', error);
    return false;
  }
}
