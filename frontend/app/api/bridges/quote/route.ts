import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BRIDGE_REGISTRY } from '@/lib/plugins/bridges'
import { ALL_CHAINS, BridgeQuote } from '@/types/shared'
import { getSupabaseAdmin } from '@/lib/data/supabase'
import { sortBridgeQuotes } from '@/lib/utils/quotes'
import { isValidAddress } from '@/lib/utils/chains'

const BridgeQuoteQuerySchema = z.object({
  fromChain: z.enum(ALL_CHAINS),
  toChain: z.enum(ALL_CHAINS),
  token: z.string(),
  amount: z.string(),
  recipientAddress: z.string(),
  slippagePercent: z.string().optional().default('0.5').transform(v => parseFloat(v)),
}).superRefine((data, ctx) => {
  if (!isValidAddress(data.recipientAddress, data.toChain)) {
    ctx.addIssue({
      code: 'custom',
      path: ['recipientAddress'],
      message: `Invalid recipient address for ${data.toChain}`,
    })
  }
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = {
    fromChain: searchParams.get('fromChain'),
    toChain: searchParams.get('toChain'),
    token: searchParams.get('token'),
    amount: searchParams.get('amount'),
    recipientAddress: searchParams.get('recipientAddress'),
    slippagePercent: searchParams.get('slippagePercent') || undefined,
  }

  const result = BridgeQuoteQuerySchema.safeParse(query)

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    )
  }

  const { fromChain, toChain, token, amount, recipientAddress, slippagePercent } = result.data

  try {
    // 1. Check cache first
    const { data: cached } = await getSupabaseAdmin()
      .from('bridge_quotes_cache')
      .select('quotes')
      .eq('from_chain', fromChain)
      .eq('to_chain', toChain)
      .eq('token', token)
      .eq('amount_wei', amount)
      .eq('recipient', recipientAddress)
      .gt('expires_at', new Date().toISOString())
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached) {
      const quotes = cached.quotes as BridgeQuote[]
      return NextResponse.json({ quotes, recommended: quotes[0] })
    }

    // 2. Fetch new quotes if no cache hit
    const eligible = Object.values(BRIDGE_REGISTRY).filter(b =>
      b.supportedTokens.includes(token) &&
      b.supportedRoutes.some(r => r.from === fromChain && r.to === toChain)
    )

    if (eligible.length === 0) {
      return NextResponse.json({ error: 'No bridge supports this route' }, { status: 404 })
    }

    // Set a 10s timeout for fetching quotes
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const quotesResults = await Promise.allSettled(eligible.map(async b => {
        return b.getQuote({
          fromChain,
          toChain,
          token,
          amount,
          recipientAddress,
          slippagePercent
        })
      }))

      clearTimeout(timeoutId)

      const validQuotes = sortBridgeQuotes(
        quotesResults
          .filter((r): r is PromiseFulfilledResult<BridgeQuote> => r.status === 'fulfilled' && r.value !== null)
          .map(r => r.value)
      )

      if (validQuotes.length === 0) {
        return NextResponse.json({ error: 'Failed to fetch quotes from any bridge' }, { status: 502 })
      }

      // 3. Store in cache (30s TTL)
      const expiresAt = new Date(Date.now() + 30 * 1000).toISOString()
      await getSupabaseAdmin()
        .from('bridge_quotes_cache')
        .insert({
          from_chain: fromChain,
          to_chain: toChain,
          token,
          amount_wei: amount,
          recipient: recipientAddress,
          quotes: validQuotes,
          expires_at: expiresAt
        })

      return NextResponse.json({ quotes: validQuotes, recommended: validQuotes[0] })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return NextResponse.json({ error: 'Bridge quote fetch timed out' }, { status: 504 })
      }
      throw err
    }
  } catch (err) {
    console.error('[bridges/quote] Failed to fetch quotes:', err)
    return NextResponse.json({ error: 'Failed to fetch bridge quotes' }, { status: 502 })
  }
}
