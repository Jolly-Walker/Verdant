import { deduplicatePositions } from '@/lib/data/aggregation'
import { fetchSolanaTokenBalances } from '@/lib/data/solana'
import { fetchZerionPositions } from '@/lib/data/zerion'
import { isValidAddress } from '@/lib/utils/chains'
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols'
import { RawPosition } from '@/types/shared'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { evmAddressSchema } from '@/lib/validation/primitives'
import { parse } from '@/lib/validation/http'
import { enforceRateLimit } from '@/lib/server/rateLimit'

const PositionsQuerySchema = z.object({
  address: evmAddressSchema.optional(),
  solana: z.string().refine(
    addr => isValidAddress(addr, 'solana'),
    { message: 'Invalid Solana address' }
  ).optional(),
})

export async function GET(req: NextRequest) {
  // SPECS §19: 60 req/min per IP for position fetches.
  const limited = await enforceRateLimit(req, { bucket: 'positions', limit: 60 })
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const parsed = parse(PositionsQuerySchema, {
    address: searchParams.get('address') || undefined,
    solana: searchParams.get('solana') || undefined,
  })

  if (!parsed.ok) return parsed.response

  const { address, solana } = parsed.data

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
