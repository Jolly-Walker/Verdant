import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BRIDGE_REGISTRY } from '@/lib/plugins/bridges'
import { ALL_BRIDGES } from '@/types/shared'
import { chainSchema } from '@/lib/validation/primitives'
import { parse } from '@/lib/validation/http'

const BridgeStatusQuerySchema = z.object({
  txHash: z.string(),
  fromChain: chainSchema,
  bridgeId: z.enum(ALL_BRIDGES),
  // Optional — some bridges (NEAR Intents) track delivery by deposit address.
  depositAddress: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const parsed = parse(BridgeStatusQuerySchema, {
    txHash: searchParams.get('txHash'),
    fromChain: searchParams.get('fromChain'),
    bridgeId: searchParams.get('bridgeId'),
    depositAddress: searchParams.get('depositAddress') ?? undefined,
  })

  if (!parsed.ok) return parsed.response

  const { txHash, fromChain, bridgeId, depositAddress } = parsed.data

  try {
    const bridge = BRIDGE_REGISTRY[bridgeId]
    if (!bridge) {
      return NextResponse.json({ error: 'Invalid bridge ID' }, { status: 400 })
    }

    const status = await bridge.pollStatus(txHash, fromChain, { depositAddress })
    return NextResponse.json(status)
  } catch (err) {
    console.error('[bridges/status] Failed to poll status:', err)
    return NextResponse.json({ error: 'Failed to poll bridge status' }, { status: 502 })
  }
}
