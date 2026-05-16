import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSequencePlan, updateSequencePlanStep } from '@/lib/data/sequencePlans'
import { simulateTransaction } from '@/lib/simulation/simulate'
import { applyStepUpdate, computePlanStatus } from '@/lib/sequencer/engine'

const SimulateStepSchema = z.object({
  planId: z.string().uuid(),
  stepId: z.string(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const result = SimulateStepSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { planId, stepId } = result.data

    const plan = await getSequencePlan(planId)
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const step = plan.steps.find(s => s.id === stepId)
    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 })
    }

    if (!step.unsignedTx) {
      return NextResponse.json({ error: 'Step has no transaction to simulate' }, { status: 400 })
    }

    // Perform simulation
    const simResult = await simulateTransaction({
      chain: step.chain,
      to: step.unsignedTx.to,
      from: plan.walletAddress,
      data: step.unsignedTx.data,
      value: step.unsignedTx.value.toString(),
    })

    const newStatus = simResult.success ? 'ready' : 'failed'
    
    const updateData = {
      status: newStatus,
      simulation: {
        success: simResult.success,
        revertReason: simResult.error,
        gasEstimate: simResult.gasEstimate,
        simulatedAt: simResult.simulatedAt || new Date()
      }
    }

    const updatedPlan = applyStepUpdate(plan, stepId, updateData)
    const newPlanStatus = computePlanStatus(updatedPlan)

    const success = await updateSequencePlanStep(planId, stepId, updatedPlan.steps, newPlanStatus)
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to save simulation result to database' }, { status: 500 })
    }

    return NextResponse.json({ 
      simulation: updateData.simulation,
      updatedStep: updatedPlan.steps.find(s => s.id === stepId)
    })
  } catch (error) {
    console.error('Error in /api/sequencer/simulate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
