import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getAutoCompoundSettings,
  upsertAutoCompoundSetting,
} from '@/lib/data/autoCompoundSettings'
import { chainSchema, evmAddressSchema } from '@/lib/validation/primitives'
import { parseJson, parseQuery } from '@/lib/validation/http'

const GetQuerySchema = z.object({
  address: evmAddressSchema,
})

const PostBodySchema = z.object({
  address: evmAddressSchema,
  protocol: z.string().min(1),
  chain: chainSchema,
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
  const parsed = parseQuery(new URL(req.url).searchParams, GetQuerySchema)
  if (!parsed.ok) return parsed.response

  try {
    const settings = await getAutoCompoundSettings(parsed.data.address)
    return NextResponse.json({ settings })
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
  const parsed = await parseJson(req, PostBodySchema)
  if (!parsed.ok) return parsed.response

  const { address, protocol, chain, asset, enabled, min_threshold_usd } = parsed.data

  try {
    await upsertAutoCompoundSetting({
      address,
      protocol,
      chain,
      asset,
      enabled,
      minThresholdUsd: min_threshold_usd,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[harvest/settings] POST failed:', err)
    return NextResponse.json({ error: 'Could not save settings' }, { status: 502 })
  }
}
