import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateCostPreview } from '@/lib/costPreview/calculator';
import { getSequencePlan } from '@/lib/data/sequencePlans';
import { parseJson } from '@/lib/validation/http';

const CostRequestSchema = z.object({
  planId: z.uuid(),
  walletAddress: z.string(),
  currentApy: z.number().optional(),
  targetApy: z.number().optional(),
  borrowApy: z.number().optional(),
  supplyApy: z.number().optional(),
  totalCollateralUsd: z.number().optional(),
});

export async function POST(req: Request) {
  const parsed = await parseJson(req, CostRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { planId, walletAddress, currentApy, targetApy, borrowApy, supplyApy, totalCollateralUsd } =
    parsed.data;

  try {
    const plan = await getSequencePlan(planId);
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Auth check
    if (plan.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const costResult = await calculateCostPreview({
      plan,
      currentApy,
      targetApy,
      borrowApy,
      supplyApy,
      totalCollateralUsd,
    });

    return NextResponse.json({
      ...costResult,
      quoteFetchedAt: costResult.quoteFetchedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error in /api/sequencer/cost:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
