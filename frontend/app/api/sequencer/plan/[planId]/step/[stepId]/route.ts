import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSequencePlan, updateSequencePlanStep } from '@/lib/data/sequencePlans'
import { applyStepUpdate, computePlanStatus } from '@/lib/sequencer/engine'
import { SequenceStep } from '@/lib/plugins/types/sequencer'

const UpdateStepSchema = z.object({
  status: z.enum(['simulating', 'ready', 'signing', 'confirmed', 'failed']),
  txHash: z.string().optional(),
  simulation: z.object({
    success: z.boolean(),
    revertReason: z.string().optional(),
    gasEstimate: z.string().optional(),
    gasCostUsd: z.number().optional(),
  }).optional()
})

const VALID_TRANSITIONS: Record<string, string[]> = {
  'pending': ['simulating', 'failed'],
  'simulating': ['ready', 'failed'],
  'ready': ['signing', 'failed'],
  'signing': ['confirmed', 'failed'],
  'failed': ['simulating', 'signing', 'pending'], // Allow retry
  'confirmed': []
};

export async function PATCH(
  req: Request,
  { params }: { params: { planId: string; stepId: string } }
) {
  try {
    const body = await req.json()
    const result = UpdateStepSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const plan = await getSequencePlan(params.planId)
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const step = plan.steps.find(s => s.id === params.stepId)
    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }

    const { status: newStatus } = result.data
    
    // Validate status transition
    if (!VALID_TRANSITIONS[step.status]?.includes(newStatus)) {
      return NextResponse.json({ error: `Invalid status transition from ${step.status} to ${newStatus}` }, { status: 400 })
    }

    // Apply update to plan using pure engine functions
    const updateData: Partial<SequenceStep> = { status: newStatus };
    if (result.data.txHash) updateData.txHash = result.data.txHash;
    if (result.data.simulation) {
      updateData.simulation = {
        ...result.data.simulation,
        gasEstimate: result.data.simulation.gasEstimate ? BigInt(result.data.simulation.gasEstimate) : undefined,
        simulatedAt: new Date()
      };
    }

    const updatedPlan = applyStepUpdate(plan, params.stepId, updateData);
    const newPlanStatus = computePlanStatus(updatedPlan);

    const success = await updateSequencePlanStep(params.planId, params.stepId, updatedPlan.steps, newPlanStatus);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to update plan in database' }, { status: 500 })
    }

    return NextResponse.json({ success: true, plan: updatedPlan })
  } catch (error) {
    console.error('Error updating step:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
