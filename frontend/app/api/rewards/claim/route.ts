import 'server-only'
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols'
import { ChainId, ALL_CHAINS } from '@/types/shared'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const ClaimBodySchema = z.object({
  protocol: z.string().min(1),
  chain: z.enum(ALL_CHAINS),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM wallet address'),
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
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = ClaimBodySchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    )
  }

  const { protocol, chain, address } = result.data

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
