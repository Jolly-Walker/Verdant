import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { SequencePlan } from '../plugins/types/sequencer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function createSequencePlan(plan: SequencePlan, templateId: string): Promise<SequencePlan | null> {
  try {
    const { data, error } = await supabase
      .from('sequence_plans')
      .insert({
        wallet_address: plan.walletAddress,
        template_id: templateId,
        description: plan.description,
        status: plan.status,
        total_cost_usd: plan.totalCostUsd,
        steps: plan.steps
      })
      .select()
      .single()

    if (error) throw error

    return {
      ...plan,
      id: data.id,
      createdAt: new Date(data.created_at)
    }
  } catch (error) {
    console.error('Error creating sequence plan:', error)
    return null
  }
}

export async function getSequencePlan(id: string): Promise<SequencePlan | null> {
  try {
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
      steps: data.steps,
      status: data.status,
      totalCostUsd: Number(data.total_cost_usd || 0),
      description: data.description
    } as SequencePlan
  } catch (error) {
    console.error('Error getting sequence plan:', error)
    return null
  }
}

export async function updateSequencePlanStep(planId: string, stepId: string, steps: SequencePlan['steps'], newStatus: SequencePlan['status']): Promise<boolean> {
  try {
    const updates: Record<string, unknown> = { steps, status: newStatus }
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
