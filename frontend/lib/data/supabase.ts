import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-project.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Creating a single supabase client instance
export const supabase = createClient(supabaseUrl, supabaseKey);

// Server-only admin client for write operations
export const supabaseAdmin = serviceRoleKey 
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : supabase;

export interface ExecutionRecord {
  wallet_address: string;
  source_protocol: string;
  source_chain: string;
  dest_protocol: string;
  dest_chain: string;
  asset: string;
  amount_usd: number;
  bridge_fee_usd: number;
  slippage_usd: number;
  gas_usd: number;
}

/**
 * Creates a new execution history row in pending state.
 */
export async function createExecutionHistory(record: ExecutionRecord) {
  const { data, error } = await supabase
    .from('execution_history')
    .insert([{ ...record, status: 'pending' }])
    .select()
    .single();

  if (error) {
    console.error('Error creating execution history:', error);
    // Silent fail to not block the user's execution flow if telemetry fails
    return null;
  }
  return data;
}

/**
 * Updates the execution history row after step 1 (Bridge) is signed.
 */
export async function updateExecutionStep1(id: string, txHash: string) {
  const { error } = await supabase
    .from('execution_history')
    .update({ tx_hash_step1: txHash, status: 'step1_complete' })
    .eq('id', id);

  if (error) {
    console.error('Error updating execution step 1:', error);
  }
}

/**
 * Updates the execution history row after step 2 (Deposit) is complete.
 */
export async function updateExecutionStep2(id: string, txHash: string) {
  const { error } = await supabase
    .from('execution_history')
    .update({ 
      tx_hash_step2: txHash, 
      status: 'complete',
      completed_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating execution step 2:', error);
  }
}

/**
 * Marks the execution as failed.
 */
export async function markExecutionFailed(id: string) {
  const { error } = await supabase
    .from('execution_history')
    .update({ status: 'failed' })
    .eq('id', id);

  if (error) {
    console.error('Error marking execution failed:', error);
  }
}
