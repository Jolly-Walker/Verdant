import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { simulateTransaction } from '@/lib/simulation/simulate'

const SimulateSchema = z.object({
  chain: z.enum(['ethereum', 'arbitrum', 'base', 'solana']),
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  from: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
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

    if (chain === 'solana') {
       // Solana simulation is handled in lib/simulation/simulate.ts but for now let's focus on EVM
       // as simulateTransaction in simulate.ts currently only handles EVM.
       return NextResponse.json(
         { error: 'Solana simulation not yet implemented' },
         { status: 501 }
       )
    }

    const simResult = await simulateTransaction({
      chain,
      to,
      from,
      data: data || '0x',
      value: value || '0',
    })

    return NextResponse.json({
      success: simResult.success,
      revertReason: simResult.error,
      gasEstimate: simResult.gasEstimate?.toString(),
      simulatedAt: simResult.simulatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Simulation error:', error)
    return NextResponse.json(
      { error: 'Failed to simulate transaction' },
      { status: 500 }
    )
  }
}
