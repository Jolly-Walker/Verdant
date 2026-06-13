import 'server-only'
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols'
import { ChainId } from '@/types/shared'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { chainSchema, evmAddressSchema } from '@/lib/validation/primitives'
import { parseJson } from '@/lib/validation/http'

const ClaimBodySchema = z.object({
  protocol: z.string().min(1),
  chain: chainSchema,
  address: evmAddressSchema,
})

/**
 * POST /api/rewards/claim
 *
 * Builds unsigned claim transactions for a given protocol+chain.
 *
 * Body:
 *   {
 *     protocol: string,     // e.g. "aave"
 *     chain: ChainId,       // e.g. "ethereum"
 *     address: string       // EVM wallet address
 *   }
 *
 * Returns:
 *   { txs: UnsignedTx[] }
 */
export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, ClaimBodySchema)
  if (!parsed.ok) return parsed.response

  const { protocol, chain, address } = parsed.data

  const plugin = PROTOCOL_REGISTRY[protocol as keyof typeof PROTOCOL_REGISTRY]
  if (!plugin) {
    return NextResponse.json({ error: `Unknown protocol: ${protocol}` }, { status: 404 })
  }

  if (!plugin.rewards) {
    return NextResponse.json(
      { error: `Protocol ${protocol} does not support reward claiming` },
      { status: 400 }
    )
  }

  if (!plugin.supportedChains.includes(chain as ChainId)) {
    return NextResponse.json(
      { error: `Protocol ${protocol} is not supported on ${chain}` },
      { status: 400 }
    )
  }

  try {
    const txs = await plugin.rewards.buildClaimTx({ address, chain: chain as ChainId })
    return NextResponse.json({ txs })
  } catch (err) {
    console.error(`[rewards/claim] buildClaimTx failed for ${protocol} on ${chain}:`, err)
    return NextResponse.json(
      { error: 'Failed to build claim transaction. Please try again.' },
      { status: 502 }
    )
  }
}
