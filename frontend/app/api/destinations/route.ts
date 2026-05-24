import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchDepositDestinations } from '@/lib/data/destinationsFetcher'
import { ALL_CHAINS, ChainId } from '@/types/shared'

const QuerySchema = z.object({
  token: z.string().optional(),
  chain: z.enum(ALL_CHAINS).optional(),
})

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const result = QuerySchema.safeParse(params)

  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid query params', details: result.error.format() },
      { status: 400 }
    )
  }

  const { token, chain } = result.data

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
