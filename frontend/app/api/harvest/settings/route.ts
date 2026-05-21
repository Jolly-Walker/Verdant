import 'server-only'
import { getSupabaseAdmin } from '@/lib/data/supabase'
import { ALL_CHAINS } from '@/types/shared'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const GetQuerySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM wallet address'),
})

const PostBodySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM wallet address'),
  protocol: z.string().min(1),
  chain: z.enum(ALL_CHAINS),
  asset: z.string().min(1),
  enabled: z.boolean(),
  min_threshold_usd: z.number().min(0).optional(),
})

/**
 * GET /api/harvest/settings?address={address}
 *
 * Returns auto-compound settings for all positions belonging to the wallet.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const result = GetQuerySchema.safeParse({ address: searchParams.get('address') })

  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
  }

  const { address } = result.data

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('auto_compound_settings')
      .select('protocol, chain, asset, enabled, min_threshold_usd')
      .eq('wallet_address', address)

    if (error) throw error

    return NextResponse.json({ settings: data ?? [] })
  } catch (err) {
    console.error('[harvest/settings] GET failed:', err)
    return NextResponse.json({ error: 'Could not load settings' }, { status: 502 })
  }
}

/**
 * POST /api/harvest/settings
 *
 * Upserts an auto-compound setting for a wallet+protocol+chain+asset combination.
 */
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = PostBodySchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 })
  }

  const { address, protocol, chain, asset, enabled, min_threshold_usd } = result.data

  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('auto_compound_settings')
      .upsert(
        {
          wallet_address: address,
          protocol,
          chain,
          asset,
          enabled,
          ...(min_threshold_usd !== undefined ? { min_threshold_usd } : {}),
        },
        { onConflict: 'wallet_address,protocol,chain,asset' }
      )

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[harvest/settings] POST failed:', err)
    return NextResponse.json({ error: 'Could not save settings' }, { status: 502 })
  }
}
