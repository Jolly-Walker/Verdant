import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BRIDGE_REGISTRY } from '@/lib/plugins/bridges'
import { BridgeQuote } from '@/types/shared'
import { sortBridgeQuotes } from '@/lib/utils/quotes'
import { isValidAddress } from '@/lib/utils/chains'
import { chainSchema } from '@/lib/validation/primitives'
import { parse } from '@/lib/validation/http'
import { cacheBridgeQuotes, getCachedBridgeQuotes } from '@/lib/data/bridgeQuotesCache'

const QUOTE_FETCH_TIMEOUT_MS = 10000

const BridgeQuoteQuerySchema = z
  .object({
    fromChain: chainSchema,
    toChain: chainSchema,
    token: z.string(),
    amount: z.string(),
    recipientAddress: z.string(),
    slippagePercent: z.string().optional().default('0.5').transform((v) => parseFloat(v)),
  })
  .superRefine((data, ctx) => {
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
  const parsed = parse(BridgeQuoteQuerySchema, {
    fromChain: searchParams.get('fromChain'),
    toChain: searchParams.get('toChain'),
    token: searchParams.get('token'),
    amount: searchParams.get('amount'),
    recipientAddress: searchParams.get('recipientAddress'),
    slippagePercent: searchParams.get('slippagePercent') || undefined,
  })
  if (!parsed.ok) return parsed.response

  const { fromChain, toChain, token, amount, recipientAddress, slippagePercent } = parsed.data
  const cacheKey = { fromChain, toChain, token, amount, recipientAddress }

  try {
    // 1. Check cache first
    const cached = await getCachedBridgeQuotes(cacheKey)
    if (cached) {
      return NextResponse.json({ quotes: cached, recommended: cached[0] })
    }

    // 2. Fetch new quotes if no cache hit
    const eligible = Object.values(BRIDGE_REGISTRY).filter(
      (b) =>
        b.supportedTokens.includes(token) &&
        b.supportedRoutes.some((r) => r.from === fromChain && r.to === toChain)
    )

    if (eligible.length === 0) {
      return NextResponse.json({ error: 'No bridge supports this route' }, { status: 404 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), QUOTE_FETCH_TIMEOUT_MS)

    try {
      const quotesResults = await Promise.allSettled(
        eligible.map((b) =>
          b.getQuote({ fromChain, toChain, token, amount, recipientAddress, slippagePercent })
        )
      )

      clearTimeout(timeoutId)

      const validQuotes = sortBridgeQuotes(
        quotesResults
          .filter(
            (r): r is PromiseFulfilledResult<BridgeQuote> =>
              r.status === 'fulfilled' && r.value !== null
          )
          .map((r) => r.value)
      )

      if (validQuotes.length === 0) {
        return NextResponse.json(
          { error: 'Failed to fetch quotes from any bridge' },
          { status: 502 }
        )
      }

      // 3. Store in cache
      await cacheBridgeQuotes(cacheKey, validQuotes)

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
