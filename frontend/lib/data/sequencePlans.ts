import 'server-only'
import { getSupabaseAdmin } from '@/lib/data/supabase'
import { SequencePlan, SerializedSequenceStep } from '@/types/sequencer'
import { serializeSequenceStep, deserializeSequenceStep } from '@/lib/sequencer/engine'

export async function createSequencePlan(plan: SequencePlan, templateId: string): Promise<SequencePlan | null> {
  try {
    const supabase = getSupabaseAdmin()
    const serializedSteps = plan.steps.map(serializeSequenceStep)
    const { data, error } = await supabase
      .from('sequence_plans')
      .insert({
        wallet_address: plan.walletAddress,
        template_id: templateId,
        description: plan.description,
        status: plan.status,
        total_cost_usd: plan.totalCostUsd,
        steps: serializedSteps
      })
      .select()
      .single()

    if (error) throw error

    return {
      ...plan,
      id: data.id,
      createdAt: new Date(data.created_at),
      steps: (data.steps as SerializedSequenceStep[]).map(deserializeSequenceStep),
      templateId: data.template_id as any
    }
  } catch (error) {
    console.error('Error creating sequence plan:', error)
    return null
  }
}

export async function getSequencePlan(id: string): Promise<SequencePlan | null> {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('sequence_plans')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    return {
      id: data.id,
      walletAddress: data.wallet_address,
      createdAt: new Date(data.created_at),
      steps: (data.steps as SerializedSequenceStep[]).map(deserializeSequenceStep),
      status: data.status,
      totalCostUsd: Number(data.total_cost_usd || 0),
      description: data.description,
      templateId: data.template_id as any
    } as SequencePlan
  } catch (error) {
    console.error('Error getting sequence plan:', error)
    return null
  }
}

export async function updateSequencePlanStep(planId: string, stepId: string, steps: SequencePlan['steps'], newStatus: SequencePlan['status']): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin()
    const serializedSteps = steps.map(serializeSequenceStep)
    const updates: Record<string, unknown> = { steps: serializedSteps, status: newStatus }
    if (newStatus === 'complete') {
      updates.completed_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('sequence_plans')
      .update(updates)
      .eq('id', planId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error updating sequence plan step:', error)
    return false
  }
}

export async function markPlanComplete(id: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('sequence_plans')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error marking plan complete:', error)
    return false
  }
}

export async function markPlanFailed(id: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('sequence_plans')
      .update({
        status: 'failed'
      })
      .eq('id', id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error marking plan failed:', error)
    return false
  }
}
