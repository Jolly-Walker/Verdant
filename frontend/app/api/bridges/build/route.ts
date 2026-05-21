import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BRIDGE_REGISTRY } from '@/lib/plugins/bridges'
import { ALL_BRIDGES, ALL_CHAINS, ChainId, BridgeQuote } from '@/types/shared'
import { SerializedUnsignedTx } from '@/types/sequencer'
import { simulateTransaction } from '@/lib/simulation/simulate'

const BuildBridgeTxSchema = z.object({
  bridgeId: z.enum(ALL_BRIDGES),
  quote: z.any(),
  walletAddress: z.string(),
})

function getChainIdFromRawQuote(bridgeId: string, rawQuote: Record<string, unknown>): string {
  if (bridgeId === 'across') {
    const originChainId = rawQuote.originChainId
    if (originChainId === 1) return 'ethereum'
    if (originChainId === 42161) return 'arbitrum'
    if (originChainId === 8453) return 'base'
    return `unknown-chain-id-${originChainId}`
  }
  return (rawQuote.fromChain as string) || ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = BuildBridgeTxSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body: ' + result.error.message }, { status: 400 })
    }

    const { bridgeId, quote, walletAddress } = result.data

    const rawQuote = quote.rawQuote as Record<string, unknown>
    if (!rawQuote) {
      return NextResponse.json({ error: 'Missing rawQuote in quote payload' }, { status: 400 })
    }

    const recipientAddress = rawQuote.recipientAddress
    if (!recipientAddress || typeof recipientAddress !== 'string') {
      return NextResponse.json({ error: 'Missing recipientAddress in rawQuote' }, { status: 400 })
    }

    if (recipientAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'walletAddress does not match recipientAddress' }, { status: 400 })
    }

    const fromChain = getChainIdFromRawQuote(bridgeId, rawQuote)
    if (!fromChain || !ALL_CHAINS.includes(fromChain as ChainId)) {
      return NextResponse.json({ error: `Unsupported origin chain: ${fromChain}` }, { status: 400 })
    }

    const bridge = BRIDGE_REGISTRY[bridgeId]
    if (!bridge) {
      return NextResponse.json({ error: 'Invalid bridge ID' }, { status: 400 })
    }

    const unsignedTx = await bridge.buildBridgeTx(quote as unknown as BridgeQuote) // BridgeQuote cast needed because of Date type mismatch in JSON

    // Simulate transaction
    const simResult = await simulateTransaction({
      chain: fromChain as ChainId,
      to: unsignedTx.to,
      from: walletAddress,
      data: unsignedTx.data,
      value: unsignedTx.value.toString(),
    })

    if (!simResult.success) {
      return NextResponse.json(
        { error: simResult.revertReason || 'Transaction simulation failed' },
        { status: 400 }
      )
    }
    
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

