import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildBridgeAndDepositPlan } from '@/lib/sequencer/templates/bridgeAndDeposit'
import { buildRepayAndWithdrawPlan } from '@/lib/sequencer/templates/repayAndWithdraw'
import { buildCrossChainRebalancePlan } from '@/lib/sequencer/templates/crossChainRebalance'
import { buildDeleverageAavePlan } from '@/lib/sequencer/templates/deleverageAave'
import { createSequencePlan } from '@/lib/data/sequencePlans'

const BridgeAndDepositParamsSchema = z.object({
  asset: z.string(),
  amount: z.string(),
  amountUsd: z.number(),
  fromChain: z.enum(['ethereum', 'arbitrum', 'base', 'solana']),
  toChain: z.enum(['ethereum', 'arbitrum', 'base', 'solana']),
  fromProtocol: z.string(),
  toProtocol: z.string(),
  preferredBridgeId: z.enum(['across', 'layerzero', 'nearIntents']).optional()
});

const RepayAndWithdrawParamsSchema = z.object({
  borrowAsset: z.string(),
  borrowAmount: z.string(),
  amountUsd: z.number(),
  collateralAsset: z.string(),
  collateralAmount: z.string(),
  protocol: z.enum(['aave', 'euler']),
  chain: z.enum(['ethereum', 'arbitrum', 'base', 'solana'])
});

const CrossChainRebalanceParamsSchema = z.object({
  asset: z.string(),
  amount: z.string(),
  amountUsd: z.number(),
  fromProtocol: z.string(),
  fromChain: z.enum(['ethereum', 'arbitrum', 'base', 'solana']),
  toProtocol: z.string(),
  toChain: z.enum(['ethereum', 'arbitrum', 'base', 'solana']),
  preferredBridgeId: z.enum(['across', 'layerzero', 'nearIntents']).optional()
});

const DeleverageAaveParamsSchema = z.object({
  borrowAsset: z.string(),
  collateralAsset: z.string(),
  amountUsd: z.number(),
  totalDebt: z.string(),
  totalCollateral: z.string(),
  cycles: z.number(),
  protocol: z.enum(['aave', 'euler']),
  chain: z.enum(['ethereum', 'arbitrum', 'base', 'solana'])
});

const CreatePlanSchema = z.object({
  templateId: z.enum(['bridgeAndDeposit', 'repayAndWithdraw', 'crossChainRebalance', 'deleverageAave']),
  params: z.record(z.string(), z.unknown()),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const result = CreatePlanSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body', details: result.error.format() }, { status: 400 })
    }

    const { templateId, params, walletAddress } = result.data
    let plan
    let amountUsd = 0

    if (templateId === 'bridgeAndDeposit') {
      const parsedParams = BridgeAndDepositParamsSchema.safeParse(params);
      if (!parsedParams.success) return NextResponse.json({ error: 'Invalid parameters for bridgeAndDeposit' }, { status: 400 });
      amountUsd = parsedParams.data.amountUsd;
      plan = buildBridgeAndDepositPlan({ ...parsedParams.data, walletAddress });
    } else if (templateId === 'repayAndWithdraw') {
      const parsedParams = RepayAndWithdrawParamsSchema.safeParse(params);
      if (!parsedParams.success) return NextResponse.json({ error: 'Invalid parameters for repayAndWithdraw' }, { status: 400 });
      amountUsd = parsedParams.data.amountUsd;
      plan = buildRepayAndWithdrawPlan({ ...parsedParams.data, walletAddress });
    } else if (templateId === 'crossChainRebalance') {
      const parsedParams = CrossChainRebalanceParamsSchema.safeParse(params);
      if (!parsedParams.success) return NextResponse.json({ error: 'Invalid parameters for crossChainRebalance' }, { status: 400 });
      amountUsd = parsedParams.data.amountUsd;
      plan = buildCrossChainRebalancePlan({ ...parsedParams.data, walletAddress });
    } else if (templateId === 'deleverageAave') {
      const parsedParams = DeleverageAaveParamsSchema.safeParse(params);
      if (!parsedParams.success) return NextResponse.json({ error: 'Invalid parameters for deleverageAave' }, { status: 400 });
      amountUsd = parsedParams.data.amountUsd;
      plan = buildDeleverageAavePlan({ ...parsedParams.data, walletAddress });
    } else {
      return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 });
    }

    // Minimum transaction size validation
    if (amountUsd < 1000) {
      return NextResponse.json({ error: 'Minimum transaction size of $1,000 USD required' }, { status: 400 });
    }

    const savedPlan = await createSequencePlan(plan, templateId)
    if (!savedPlan) {
      return NextResponse.json({ error: 'Failed to save plan to database' }, { status: 500 })
    }

    return NextResponse.json({ plan: savedPlan })
  } catch (error) {
    console.error('Error in /api/sequencer/plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
