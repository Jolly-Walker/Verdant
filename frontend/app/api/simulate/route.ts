import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ALL_CHAINS } from '@/types/shared'
import { simulateTransaction } from '@/lib/simulation/simulate'

const SimulateSchema = z.object({
  chain: z.enum(ALL_CHAINS),
  to: z.string(),
  from: z.string(),
  data: z.string().optional(),
  value: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = SimulateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: result.error.format() },
        { status: 400 }
      )
    }

    const { chain, to, from, data, value } = result.data

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
