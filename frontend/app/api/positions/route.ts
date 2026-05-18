import { deduplicatePositions } from '@/lib/data/aggregation'
import { fetchSolanaTokenBalances } from '@/lib/data/solana'
import { fetchZerionPositions } from '@/lib/data/zerion'
import { isValidAddress } from '@/lib/utils/chains'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const PositionsQuerySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM wallet address').optional(),
  solana: z.string().refine(
    addr => isValidAddress(addr, 'solana'),
    { message: 'Invalid Solana address' }
  ).optional(),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = {
    address: searchParams.get('address') || undefined,
    solana: searchParams.get('solana') || undefined,
  }

  const result = PositionsQuerySchema.safeParse(query)

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    )
  }

  const { address, solana } = result.data

  try {
    const [evmPositions, solanaPositions] = await Promise.all([
      address ? fetchZerionPositions(address) : Promise.resolve([]),
      solana ? fetchSolanaTokenBalances(solana) : Promise.resolve([]),
    ])

    const allPositions = deduplicatePositions([...evmPositions, ...solanaPositions])

    return NextResponse.json(
      { positions: allPositions },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  } catch (err) {
    console.error('[positions] fetch failed:', err)
    return NextResponse.json(
      { error: 'Could not load positions. Please try again.' },
      { status: 502 }
    )
  }
}
