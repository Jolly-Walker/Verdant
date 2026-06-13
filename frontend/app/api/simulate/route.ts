import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { simulateTransaction } from '@/lib/simulation/simulate'
import { chainSchema } from '@/lib/validation/primitives'
import { parseJson } from '@/lib/validation/http'
import { enforceRateLimit } from '@/lib/server/rateLimit'

const SimulateSchema = z.object({
  chain: chainSchema,
  to: z.string(),
  from: z.string(),
  data: z.string().optional(),
  value: z.string().optional(),
})

export async function POST(request: NextRequest) {
  // SPECS §19: 10 req/min per IP for simulation.
  const limited = enforceRateLimit(request, { bucket: 'simulate', limit: 10 })
  if (limited) return limited

  const parsed = await parseJson(request, SimulateSchema)
  if (!parsed.ok) return parsed.response

  const { chain, to, from, data, value } = parsed.data

  try {
    const simResult = await simulateTransaction({
      chain,
      to,
      from,
      data: data || '0x',
      value: value || '0',
    })

    return NextResponse.json({
      success: simResult.success,
      revertReason: simResult.revertReason,
      gasEstimate: simResult.gasEstimate?.toString(),
      stateChanges: simResult.stateChanges,
      simulatedAt: (simResult.simulatedAt || new Date()).toISOString(),
    })
  } catch (error) {
    console.error('Simulation error:', error)
    return NextResponse.json(
      { error: 'Failed to simulate transaction' },
      { status: 500 }
    )
  }
}
