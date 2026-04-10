import { NextRequest, NextResponse } from 'next/server'
import { findPoolApy } from '@/lib/data/defillama'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const protocol = searchParams.get('protocol')
  const chain = searchParams.get('chain')
  const asset = searchParams.get('asset')

  if (!protocol || !chain || !asset) {
    return NextResponse.json(
      { error: 'Missing required params: protocol, chain, asset' },
      { status: 400 }
    )
  }

  try {
    const result = await findPoolApy(protocol, chain, asset)

    if (!result) {
      return NextResponse.json(
        { error: `No APY data found for ${protocol}/${chain}/${asset}` },
        { status: 404 }
      )
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('APY fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch APY data' },
      { status: 500 }
    )
  }
}
