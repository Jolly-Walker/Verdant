import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BRIDGE_REGISTRY } from '@/lib/plugins/bridges'
import { ALL_BRIDGES } from '@/types/shared'
import { SerializedUnsignedTx } from '@/types/sequencer'

const BuildBridgeTxSchema = z.object({
  bridgeId: z.enum(ALL_BRIDGES),
  quote: z.any(), // We trust the quote from the client for now
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = BuildBridgeTxSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { bridgeId, quote } = result.data
    const bridge = BRIDGE_REGISTRY[bridgeId]
    
    if (!bridge) {
      return NextResponse.json({ error: 'Invalid bridge ID' }, { status: 400 })
    }

    const unsignedTx = await bridge.buildBridgeTx(quote)
    
    // Serialize BigInt for JSON response
    const serializedTx: SerializedUnsignedTx = {
      ...unsignedTx,
      value: unsignedTx.value.toString(),
      gasLimit: unsignedTx.gasLimit?.toString(),
    }

    return NextResponse.json({ unsignedTx: serializedTx })
  } catch (err) {
    console.error('[bridges/build] Failed to build bridge tx:', err)
    return NextResponse.json({ error: 'Failed to build bridge transaction' }, { status: 500 })
  }
}
