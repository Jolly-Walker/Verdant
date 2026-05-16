import { fetchZerionPositions } from '@/lib/data/zerion'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const PositionsQuerySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = {
    address: searchParams.get('address'),
  }

  const result = PositionsQuerySchema.safeParse(query)

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    )
  }

  const { address } = result.data

  try {
    const positions = await fetchZerionPositions(address)
    return NextResponse.json(
      { positions },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  } catch (err) {
    console.error('[positions] Zerion fetch failed:', err)
    return NextResponse.json(
      { error: 'Could not load positions. Please try again.' },
      { status: 502 }
    )
  }
}
