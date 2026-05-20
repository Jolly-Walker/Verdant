import 'server-only'
import { getSupabaseAdmin } from '@/lib/data/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const QuerySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM wallet address'),
})

/**
 * GET /api/harvest/history?address={address}
 *
 * Returns the most recent 50 harvest events for a wallet address.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const result = QuerySchema.safeParse({ address: searchParams.get('address') })

  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
  }

  const { address } = result.data

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('harvest_history')
      .select('id, protocol, chain, reward_token, reward_amount_usd, tx_hash, created_at')
      .eq('wallet_address', address)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ records: data ?? [] })
  } catch (err) {
    console.error('[harvest/history] fetch failed:', err)
    return NextResponse.json({ error: 'Could not load harvest history' }, { status: 502 })
  }
}
