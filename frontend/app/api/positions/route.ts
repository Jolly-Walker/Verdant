import { deduplicatePositions } from '@/lib/data/aggregation'
import { fetchSolanaTokenBalances } from '@/lib/data/solana'
import { fetchZerionPositions } from '@/lib/data/zerion'
import { isValidAddress } from '@/lib/utils/chains'
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols'
import { RawPosition } from '@/types/shared'
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
    const protocolPositionsPromises: Promise<RawPosition[]>[] = []
    if (address) {
      for (const [pluginId, plugin] of Object.entries(PROTOCOL_REGISTRY)) {
        for (const chain of plugin.supportedChains) {
          if (chain === 'solana') continue
          protocolPositionsPromises.push(
            plugin.fetcher.fetchPositions(address, chain)
              .catch((err) => {
                console.error(`[positions] failed to fetch positions for ${pluginId} on ${chain}:`, err)
                return []
              })
          )
        }
      }
    }

    const [evmPositions, solanaPositions, ...protocolPositionsArrays] = await Promise.all([
      address ? fetchZerionPositions(address) : Promise.resolve([]),
      solana ? fetchSolanaTokenBalances(solana) : Promise.resolve([]),
      ...protocolPositionsPromises,
    ])

    const flatProtocolPositions = protocolPositionsArrays.flat()
    const allPositions = deduplicatePositions([...evmPositions, ...solanaPositions, ...flatProtocolPositions])

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
