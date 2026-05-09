import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BRIDGE_REGISTRY } from '@/lib/plugins/bridges'
import { ChainId, BridgeQuote } from '@/lib/plugins/types/shared'

const BridgeQuoteQuerySchema = z.object({
  fromChain: z.string() as z.ZodType<ChainId>,
  toChain: z.string() as z.ZodType<ChainId>,
  token: z.string(),
  amount: z.string(),
  recipientAddress: z.string(),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = {
    fromChain: searchParams.get('fromChain'),
    toChain: searchParams.get('toChain'),
    token: searchParams.get('token'),
    amount: searchParams.get('amount'),
    recipientAddress: searchParams.get('recipientAddress'),
  }

  const result = BridgeQuoteQuerySchema.safeParse(query)

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0].message },
      { status: 400 }
    )
  }

  const { fromChain, toChain, token, amount, recipientAddress } = result.data

  try {
    // For MVP, we're focusing on NEAR Intents and Across
    // This proxy will try to find the best quote among registered bridges
    const eligible = Object.values(BRIDGE_REGISTRY).filter(b =>
      b.supportedTokens.includes(token) &&
      b.supportedRoutes.some(r => r.from === fromChain && r.to === toChain)
    )

    if (eligible.length === 0) {
      return NextResponse.json({ error: 'No bridge supports this route' }, { status: 404 })
    }

    const quotes = await Promise.allSettled(eligible.map(b => b.getQuote({
      fromChain,
      toChain,
      token,
      amount,
      recipientAddress
    })))

    const validQuotes = quotes
      .filter((r): r is PromiseFulfilledResult<BridgeQuote> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value)
      .sort((a, b) => Number(b.expectedOutputAmount) - Number(a.expectedOutputAmount))

    if (validQuotes.length === 0) {
      return NextResponse.json({ error: 'Failed to fetch quotes from any bridge' }, { status: 502 })
    }

    return NextResponse.json({ quotes: validQuotes, recommended: validQuotes[0] })
  } catch (err) {
    console.error('[bridges/quote] Failed to fetch quotes:', err)
    return NextResponse.json({ error: 'Failed to fetch bridge quotes' }, { status: 502 })
  }
}
