import { fetchZerionPositions } from '@/lib/data/zerion'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: 'Invalid or missing wallet address' },
      { status: 400 }
    )
  }

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
