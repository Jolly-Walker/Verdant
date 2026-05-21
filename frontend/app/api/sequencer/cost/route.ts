import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSequencePlan } from '@/lib/data/sequencePlans'
import { calculateCostPreview } from '@/lib/costPreview/calculator'

const CostRequestSchema = z.object({
  planId: z.string().uuid(),
  walletAddress: z.string(),
  currentApy: z.number().optional(),
  targetApy: z.number().optional(),
  borrowApy: z.number().optional(),
  supplyApy: z.number().optional(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const result = CostRequestSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: result.error.format() },
        { status: 400 }
      )
    }

    const { planId, walletAddress, currentApy, targetApy, borrowApy, supplyApy } = result.data

    const plan = await getSequencePlan(planId)
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Auth check
    if (plan.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const costResult = await calculateCostPreview({
      plan,
      currentApy,
      targetApy,
      borrowApy,
      supplyApy,
    })

    return NextResponse.json({
      ...costResult,
      quoteFetchedAt: costResult.quoteFetchedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error in /api/sequencer/cost:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
