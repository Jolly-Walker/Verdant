import 'server-only'
import { createClient } from '@supabase/supabase-js';

let _client: any = null

/**
 * Lazy-initialized public client.
 */
export function getSupabase(): any {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not configured')
  _client = createClient(url, key)
  return _client
}

let _adminClient: any = null

/**
 * Lazy-initialized admin client for server-side write operations.
 * Throws if required environment variables are missing.
 */
export function getSupabaseAdmin(): any {
  if (_adminClient) return _adminClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase admin env vars not configured')
  _adminClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _adminClient
}

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
  const { data, error } = await getSupabase()
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
  const { error } = await getSupabase()
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
  const { error } = await getSupabase()
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
  const { error } = await getSupabase()
    .from('execution_history')
    .update({ status: 'failed' })
    .eq('id', id);

  if (error) {
    console.error('Error marking execution failed:', error);
  }
}
