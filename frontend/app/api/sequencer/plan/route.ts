import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildBridgeAndDepositPlan } from '@/lib/sequencer/templates/bridgeAndDeposit'
import { buildRepayAndWithdrawPlan } from '@/lib/sequencer/templates/repayAndWithdraw'
import { buildCrossChainRebalancePlan } from '@/lib/sequencer/templates/crossChainRebalance'
import { buildDeleverageAavePlan } from '@/lib/sequencer/templates/deleverageAave'
import { buildExitPendlePlan } from '@/lib/sequencer/templates/exitPendle'
import { createSequencePlan } from '@/lib/data/sequencePlans'
import { serializeSequencePlan } from '@/lib/sequencer/engine'
import { ALL_CHAINS, ALL_BRIDGES, ALL_PROTOCOLS } from '@/types/shared'
import { SUPPORTED_TOKENS } from '@/constants/tokens'
import { fetchTokenPrices } from '@/lib/data/prices'
import { DEFAULT_MIN_USD_THRESHOLD } from '@/constants/settings'

import { isValidAddress } from '@/lib/utils/chains'

const BridgeAndDepositParamsSchema = z.object({
  asset: z.string(),
  amount: z.string(),
  fromChain: z.enum(ALL_CHAINS),
  toChain: z.enum(ALL_CHAINS),
  fromProtocol: z.string(),
  toProtocol: z.string(),
  preferredBridgeId: z.enum(ALL_BRIDGES).optional(),
  slippagePercent: z.number().min(0).max(100).default(0.5)
});

const RepayAndWithdrawParamsSchema = z.object({
  borrowAsset: z.string(),
  borrowAmount: z.string(),
  collateralAsset: z.string(),
  collateralAmount: z.string(),
  protocol: z.enum([...ALL_PROTOCOLS]),
  chain: z.enum(ALL_CHAINS)
});

const CrossChainRebalanceParamsSchema = z.object({
  asset: z.string(),
  amount: z.string(),
  fromProtocol: z.string(),
  fromChain: z.enum(ALL_CHAINS),
  toProtocol: z.string(),
  toChain: z.enum(ALL_CHAINS),
  preferredBridgeId: z.enum(ALL_BRIDGES).optional(),
  slippagePercent: z.number().min(0).max(100).default(0.5)
});

const DeleverageAaveParamsSchema = z.object({
  borrowAsset: z.string(),
  collateralAsset: z.string(),
  totalDebt: z.string(),
  totalCollateral: z.string(),
  totalDebtUsd: z.number().optional(),
  totalCollateralUsd: z.number().optional(),
  initialHealthFactor: z.number(),
  cycles: z.number(),
  protocol: z.enum([...ALL_PROTOCOLS]),
  chain: z.enum(ALL_CHAINS)
});

const ExitPendleParamsSchema = z.object({
  ptAsset: z.string(),
  ptAddress: z.string(),
  amount: z.string(),
  underlyingAsset: z.string(),
  fromChain: z.enum(ALL_CHAINS),
  toChain: z.enum(ALL_CHAINS),
  toProtocol: z.enum([...ALL_PROTOCOLS]),
  preferredBridgeId: z.enum(ALL_BRIDGES).optional(),
  slippagePercent: z.number().min(0).max(100).default(0.5)
});

const CreatePlanSchema = z.object({
  templateId: z.enum(['bridgeAndDeposit', 'repayAndWithdraw', 'crossChainRebalance', 'deleverageAave', 'exitPendle']),
  params: z.record(z.string(), z.unknown()),
  walletAddress: z.string().refine(val => isValidAddress(val), {
    message: 'Invalid wallet address format for supported chains'
  })
})

async function validateMinimumSize(asset: string, amount: string): Promise<{ ok: boolean; amountUsd: number; error?: string }> {
  const tokenConfig = SUPPORTED_TOKENS[asset];
  if (!tokenConfig) return { ok: false, amountUsd: 0, error: 'unsupported_asset' };

  const priceId = `coingecko:${tokenConfig.coingeckoId}`;
  const prices = await fetchTokenPrices([priceId]);
  const price = prices[priceId];
  
  if (!price) return { ok: false, amountUsd: 0, error: 'price_fetch_failed' };

  // Properly normalize the amount using token decimals before multiplying by price.
  // amount is expected to be in base atomic units (Wei).
  const normalizedAmount = Number(amount) / Math.pow(10, tokenConfig.decimals);
  const amountUsd = normalizedAmount * price;
  
  // Handle NaN and minimum size check
  const ok = !isNaN(amountUsd) && amountUsd >= DEFAULT_MIN_USD_THRESHOLD;
  return { ok, amountUsd: isNaN(amountUsd) ? 0 : amountUsd };
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
    let amountUsd = 0

    if (templateId === 'deleverageAave') {
      const result = DeleverageAaveParamsSchema.safeParse(params);
      if (!result.success) {
        return NextResponse.json({ 
          error: 'Invalid parameters for deleverageAave', 
          details: result.error.format() 
        }, { status: 400 });
      }
      const parsedParams = result.data;
      
      const borrowToken = SUPPORTED_TOKENS[parsedParams.borrowAsset];
      const collateralToken = SUPPORTED_TOKENS[parsedParams.collateralAsset];
      
      if (!borrowToken || !collateralToken) {
        return NextResponse.json({ error: 'Unsupported asset for de-leveraging' }, { status: 400 });
      }

      const prices = await fetchTokenPrices([
        `coingecko:${borrowToken.coingeckoId}`,
        `coingecko:${collateralToken.coingeckoId}`
      ]);
      
      const borrowPrice = prices[`coingecko:${borrowToken.coingeckoId}`];
      const collateralPrice = prices[`coingecko:${collateralToken.coingeckoId}`];

      if (borrowPrice === undefined || collateralPrice === undefined) {
        return NextResponse.json({ error: 'Could not fetch asset prices for de-leveraging' }, { status: 500 });
      }

      const totalDebtUsd = (Number(parsedParams.totalDebt) / Math.pow(10, borrowToken.decimals)) * borrowPrice;
      const totalCollateralUsd = (Number(parsedParams.totalCollateral) / Math.pow(10, collateralToken.decimals)) * collateralPrice;
      amountUsd = totalDebtUsd; // for minimum size check

      if (isNaN(amountUsd) || amountUsd < DEFAULT_MIN_USD_THRESHOLD) {
        return NextResponse.json({ 
          error: `Minimum transaction size of $${DEFAULT_MIN_USD_THRESHOLD.toLocaleString()} USD required. Current: $${(isNaN(amountUsd) ? 0 : amountUsd).toFixed(2)}` 
        }, { status: 400 });
      }

      plan = buildDeleverageAavePlan({
        ...parsedParams,
        totalDebtUsd,
        totalCollateralUsd,
        amountUsd,
        walletAddress
      });
    } else {
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
      } else if (templateId === 'exitPendle') {
        const parsedParams = ExitPendleParamsSchema.safeParse(params);
        if (!parsedParams.success) return NextResponse.json({ error: 'Invalid parameters for exitPendle' }, { status: 400 });
        assetToValidate = parsedParams.data.underlyingAsset;
        amountToValidate = parsedParams.data.amount;
      }

      // Minimum transaction size validation (Server-side)
      const validation = await validateMinimumSize(assetToValidate, amountToValidate);
      if (!validation.ok) {
        if (validation.error === 'unsupported_asset') {
          return NextResponse.json({ error: `Asset '${assetToValidate}' is not currently supported.` }, { status: 400 });
        }
        if (validation.error === 'price_fetch_failed') {
          return NextResponse.json({ error: `Could not fetch price for asset '${assetToValidate}'. Please try again.` }, { status: 500 });
        }
        return NextResponse.json({ 
          error: `Minimum transaction size of $1,000 USD required. Current: $${validation.amountUsd.toFixed(2)}` 
        }, { status: 400 });
      }

      amountUsd = validation.amountUsd;

      if (templateId === 'bridgeAndDeposit') {
        plan = buildBridgeAndDepositPlan({ ...BridgeAndDepositParamsSchema.parse(params), walletAddress, amountUsd });
      } else if (templateId === 'repayAndWithdraw') {
        plan = buildRepayAndWithdrawPlan({ ...RepayAndWithdrawParamsSchema.parse(params), walletAddress, amountUsd });
      } else if (templateId === 'crossChainRebalance') {
        plan = buildCrossChainRebalancePlan({ ...CrossChainRebalanceParamsSchema.parse(params), walletAddress, amountUsd });
      } else if (templateId === 'exitPendle') {
        plan = buildExitPendlePlan({ ...ExitPendleParamsSchema.parse(params), walletAddress, amountUsd });
      }
    }

    if (!plan) {
      return NextResponse.json({ error: 'Failed to construct sequence plan' }, { status: 400 });
    }

    const savedPlan = await createSequencePlan(plan, templateId)
    if (!savedPlan) {
      return NextResponse.json({ error: 'Failed to save plan to database' }, { status: 500 })
    }

    return NextResponse.json({ plan: serializeSequencePlan(savedPlan) })
  } catch (error) {
    console.error('Error in /api/sequencer/plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
