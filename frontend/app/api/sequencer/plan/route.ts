import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildBridgeAndDepositPlan } from '@/lib/sequencer/templates/bridgeAndDeposit'
import { buildRepayAndWithdrawPlan } from '@/lib/sequencer/templates/repayAndWithdraw'
import { buildCrossChainRebalancePlan } from '@/lib/sequencer/templates/crossChainRebalance'
import { buildDeleverageAavePlan } from '@/lib/sequencer/templates/deleverageAave'
import { createSequencePlan } from '@/lib/data/sequencePlans'
import { ALL_CHAINS, ALL_BRIDGES, ALL_PROTOCOLS } from '@/lib/plugins/types/shared'
import { SUPPORTED_TOKENS } from '@/lib/plugins/tokens'
import { fetchTokenPrices } from '@/lib/data/prices'

const BridgeAndDepositParamsSchema = z.object({
  asset: z.string(),
  amount: z.string(),
  fromChain: z.enum(ALL_CHAINS),
  toChain: z.enum(ALL_CHAINS),
  fromProtocol: z.string(),
  toProtocol: z.string(),
  preferredBridgeId: z.enum(ALL_BRIDGES).optional()
});

const RepayAndWithdrawParamsSchema = z.object({
  borrowAsset: z.string(),
  borrowAmount: z.string(),
  collateralAsset: z.string(),
  collateralAmount: z.string(),
  protocol: z.enum(ALL_PROTOCOLS as unknown as [string, ...string[]]),
  chain: z.enum(ALL_CHAINS)
});

const CrossChainRebalanceParamsSchema = z.object({
  asset: z.string(),
  amount: z.string(),
  fromProtocol: z.string(),
  fromChain: z.enum(ALL_CHAINS),
  toProtocol: z.string(),
  toChain: z.enum(ALL_CHAINS),
  preferredBridgeId: z.enum(ALL_BRIDGES).optional()
});

const DeleverageAaveParamsSchema = z.object({
  borrowAsset: z.string(),
  collateralAsset: z.string(),
  totalDebt: z.string(),
  totalCollateral: z.string(),
  initialHealthFactor: z.number(),
  cycles: z.number(),
  protocol: z.enum(ALL_PROTOCOLS as unknown as [string, ...string[]]),
  chain: z.enum(ALL_CHAINS)
});

const CreatePlanSchema = z.object({
  templateId: z.enum(['bridgeAndDeposit', 'repayAndWithdraw', 'crossChainRebalance', 'deleverageAave']),
  params: z.record(z.string(), z.unknown()),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
})

async function validateMinimumSize(asset: string, amount: string): Promise<{ ok: boolean; amountUsd: number }> {
  const tokenConfig = SUPPORTED_TOKENS[asset];
  if (!tokenConfig) return { ok: false, amountUsd: 0 };

  const priceId = `coingecko:${tokenConfig.coingeckoId}`;
  const prices = await fetchTokenPrices([priceId]);
  const price = prices[priceId];
  
  if (!price) return { ok: false, amountUsd: 0 };

  const amountUsd = Number(amount) * price;
  return { ok: amountUsd >= 1000, amountUsd };
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const result = CreatePlanSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body', details: result.error.format() }, { status: 400 })
    }

    const { templateId, params, walletAddress } = result.data
    let plan
    let assetToValidate = ''
    let amountToValidate = ''

    if (templateId === 'bridgeAndDeposit') {
      const parsedParams = BridgeAndDepositParamsSchema.safeParse(params);
      if (!parsedParams.success) return NextResponse.json({ error: 'Invalid parameters for bridgeAndDeposit' }, { status: 400 });
      assetToValidate = parsedParams.data.asset;
      amountToValidate = parsedParams.data.amount;
    } else if (templateId === 'repayAndWithdraw') {
      const parsedParams = RepayAndWithdrawParamsSchema.safeParse(params);
      if (!parsedParams.success) return NextResponse.json({ error: 'Invalid parameters for repayAndWithdraw' }, { status: 400 });
      assetToValidate = parsedParams.data.borrowAsset;
      amountToValidate = parsedParams.data.borrowAmount;
    } else if (templateId === 'crossChainRebalance') {
      const parsedParams = CrossChainRebalanceParamsSchema.safeParse(params);
      if (!parsedParams.success) return NextResponse.json({ error: 'Invalid parameters for crossChainRebalance' }, { status: 400 });
      assetToValidate = parsedParams.data.asset;
      amountToValidate = parsedParams.data.amount;
    } else if (templateId === 'deleverageAave') {
      const parsedParams = DeleverageAaveParamsSchema.safeParse(params);
      if (!parsedParams.success) return NextResponse.json({ error: 'Invalid parameters for deleverageAave' }, { status: 400 });
      assetToValidate = parsedParams.data.borrowAsset;
      amountToValidate = parsedParams.data.totalDebt;
    }

    // Minimum transaction size validation (Server-side)
    const validation = await validateMinimumSize(assetToValidate, amountToValidate);
    if (!validation.ok) {
      return NextResponse.json({ 
        error: `Minimum transaction size of $1,000 USD required. Current: $${validation.amountUsd.toFixed(2)}` 
      }, { status: 400 });
    }

    const { amountUsd } = validation;

    if (templateId === 'bridgeAndDeposit') {
      plan = buildBridgeAndDepositPlan({ ...BridgeAndDepositParamsSchema.parse(params), walletAddress, amountUsd });
    } else if (templateId === 'repayAndWithdraw') {
      plan = buildRepayAndWithdrawPlan({ ...RepayAndWithdrawParamsSchema.parse(params), walletAddress, amountUsd });
    } else if (templateId === 'crossChainRebalance') {
      plan = buildCrossChainRebalancePlan({ ...CrossChainRebalanceParamsSchema.parse(params), walletAddress, amountUsd });
    } else if (templateId === 'deleverageAave') {
      plan = buildDeleverageAavePlan({ ...DeleverageAaveParamsSchema.parse(params), walletAddress, amountUsd });
    }

    if (!plan) {
      return NextResponse.json({ error: 'Failed to construct sequence plan' }, { status: 400 });
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
