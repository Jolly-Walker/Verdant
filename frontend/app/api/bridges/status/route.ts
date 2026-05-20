import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BRIDGE_REGISTRY } from '@/lib/plugins/bridges'
import { ALL_CHAINS, ALL_BRIDGES } from '@/types/shared'

const BridgeStatusQuerySchema = z.object({
  txHash: z.string(),
  fromChain: z.enum(ALL_CHAINS),
  bridgeId: z.enum(ALL_BRIDGES),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = {
    txHash: searchParams.get('txHash'),
    fromChain: searchParams.get('fromChain'),
    bridgeId: searchParams.get('bridgeId'),
  }

  const result = BridgeStatusQuerySchema.safeParse(query)

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    )
  }

  const { txHash, fromChain, bridgeId } = result.data

  try {
    const bridge = BRIDGE_REGISTRY[bridgeId]
    if (!bridge) {
      return NextResponse.json({ error: 'Invalid bridge ID' }, { status: 400 })
    }

    const status = await bridge.pollStatus(txHash, fromChain)
    return NextResponse.json(status)
  } catch (err) {
    console.error('[bridges/status] Failed to poll status:', err)
    return NextResponse.json({ error: 'Failed to poll bridge status' }, { status: 502 })
  }
}
