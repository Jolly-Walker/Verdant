import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSequencePlan, updateSequencePlanStep } from '@/lib/data/sequencePlans'
import { applyStepUpdate, computePlanStatus, serializeSequencePlan } from '@/lib/sequencer/engine'
import { SequenceStep } from '@/types/sequencer'
import { parseJson } from '@/lib/validation/http'

const UpdateStepSchema = z.object({
  status: z.enum(['simulating', 'ready', 'signing', 'confirmed', 'failed']),
  walletAddress: z.string(),
  txHash: z.string().optional(),
  simulation: z.object({
    success: z.boolean(),
    revertReason: z.string().optional(),
    gasEstimate: z.string().optional(),
    gasCostUsd: z.number().optional(),
  }).optional(),
  acknowledged: z.boolean().optional(),
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
  const parsed = await parseJson(req, UpdateStepSchema)
  if (!parsed.ok) return parsed.response
  const data = parsed.data

  try {
    const plan = await getSequencePlan(params.planId)
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Verify ownership
    if (plan.walletAddress.toLowerCase() !== data.walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const step = plan.steps.find(s => s.id === params.stepId)
    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }

    const { status: newStatus } = data
    
    // Validate status transition
    if (!VALID_TRANSITIONS[step.status]?.includes(newStatus)) {
      return NextResponse.json({ error: `Invalid status transition from ${step.status} to ${newStatus}` }, { status: 400 })
    }

    // Enforce simulation acknowledgment for ready -> signing
    if (newStatus === 'signing' && step.status === 'ready') {
      if (!data.acknowledged) {
        return NextResponse.json(
          { error: 'Simulation must be acknowledged before signing' },
          { status: 400 }
        )
      }
    }

    // Apply update to plan using pure engine functions
    const updateData: Partial<SequenceStep> = { status: newStatus };
    if (data.txHash) updateData.txHash = data.txHash;
    if (data.simulation) {
      updateData.simulation = {
        ...data.simulation,
        gasEstimate: data.simulation.gasEstimate ? BigInt(data.simulation.gasEstimate) : undefined,
        simulatedAt: new Date()
      };
    }

    const updatedPlan = applyStepUpdate(plan, params.stepId, updateData);
    const newPlanStatus = computePlanStatus(updatedPlan);

    const success = await updateSequencePlanStep(params.planId, params.stepId, updatedPlan.steps, newPlanStatus);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to update plan in database' }, { status: 500 })
    }

    return NextResponse.json({ success: true, plan: serializeSequencePlan(updatedPlan) })
  } catch (error) {
    console.error('Error updating step:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
