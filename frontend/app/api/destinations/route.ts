import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchDepositDestinations } from '@/lib/data/destinationsFetcher'
import { ChainId } from '@/types/shared'
import { chainSchema } from '@/lib/validation/primitives'
import { parseQuery } from '@/lib/validation/http'

const QuerySchema = z.object({
  token: z.string().optional(),
  chain: chainSchema.optional(),
})

export async function GET(request: NextRequest) {
  const parsed = parseQuery(request.nextUrl.searchParams, QuerySchema)

  if (!parsed.ok) return parsed.response

  const { token, chain } = parsed.data

  try {
    const destinations = await fetchDepositDestinations(token, chain as ChainId | undefined)
    return NextResponse.json(
      { destinations },
      {
        headers: {
          // Cache at CDN/edge for 5 min, serve stale for up to 15 min while revalidating
          'Cache-Control': 's-maxage=300, stale-while-revalidate=900',
        },
      }
    )
  } catch (error) {
    console.error('Destinations fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deposit destinations' },
      { status: 500 }
    )
  }
}
