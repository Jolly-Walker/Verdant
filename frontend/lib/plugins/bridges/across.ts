import 'server-only';
import { encodeFunctionData, formatUnits } from 'viem';
import { BRIDGE_QUOTE_TTL_MS } from '@/constants/bridges';
import { SUPPORTED_TOKENS } from '@/constants/tokens';
import { fetchTokenPrices } from '@/lib/data/prices';
import { fetchWithTimeout } from '@/lib/utils/fetch';
import { applySlippageFloor } from '@/lib/utils/slippage';
import type {
  BridgeQuote,
  BridgeQuoteParams,
  BridgeStatus,
  ChainId,
  UnsignedTx,
} from '@/types/shared';
import type { BridgePlugin } from '../types/bridge-plugin';

const CHAIN_ID_MAP: Record<ChainId, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  solana: 0,
};

const REVERSE_CHAIN_ID_MAP: Record<number, ChainId> = {
  1: 'ethereum',
  42161: 'arbitrum',
  8453: 'base',
};

const SPOKE_POOL_ADDRESSES: Record<number, string> = {
  1: '0x59728544B08AB483533076417FbBB2fD0B17CE3a',
  42161: '0xe35e90606014e36ce7752fe314d19af0c7e0c7e9',
  8453: '0x09aea4b2242abec37395018139bd7529c29d3388',
};

const SPOKE_POOL_ABI = [
  {
    inputs: [
      { name: 'depositor', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'inputToken', type: 'address' },
      { name: 'outputToken', type: 'address' },
      { name: 'inputAmount', type: 'uint256' },
      { name: 'outputAmount', type: 'uint256' },
      { name: 'destinationChainId', type: 'uint256' },
      { name: 'exclusiveRelayer', type: 'address' },
      { name: 'quoteTimestamp', type: 'uint32' },
      { name: 'fillDeadline', type: 'uint32' },
      { name: 'exclusivityDeadline', type: 'uint32' },
      { name: 'message', type: 'bytes' },
    ],
    name: 'depositV3',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

interface AcrossRawQuote {
  inputAmount: string;
  inputToken: `0x${string}`;
  outputToken: `0x${string}`;
  originChainId: number;
  destinationChainId: number;
  recipientAddress: `0x${string}`;
  tokenSymbol: string;
  decimals: number;
  timestamp: string | number;
  exclusiveRelayer?: `0x${string}`;
  exclusivityDeadline?: string | number;
}

/** A single fee component in the Across `/suggested-fees` response. */
interface AcrossFeeDetail {
  pct: string;
  total: string;
}

/**
 * Shape of the Across v3 `/suggested-fees` response (the fields Verdant reads).
 * Fees are NESTED objects with a `total` (atomic units) — `totalRelayFee.total`
 * already includes gas + capital + LP, so it is the single amount deducted from
 * the input to size the relayer's `outputAmount`. The sub-fees are read only as a
 * fallback when `totalRelayFee` is absent (see `getQuote`).
 */
interface AcrossSuggestedFeesResponse {
  totalRelayFee?: AcrossFeeDetail;
  relayerGasFee?: AcrossFeeDetail;
  relayerCapitalFee?: AcrossFeeDetail;
  lpFee?: AcrossFeeDetail;
  timestamp?: string | number;
  expectedFillTimeSec?: number;
  exclusiveRelayer?: `0x${string}`;
  exclusivityDeadline?: string | number;
}

export const acrossBridgePlugin: BridgePlugin = {
  id: 'across',
  displayName: 'Across Protocol',
  supportedTokens: ['ETH', 'USDC', 'USDT', 'WBTC'],
  supportedRoutes: [
    { from: 'ethereum', to: 'arbitrum' },
    { from: 'arbitrum', to: 'ethereum' },
    { from: 'ethereum', to: 'base' },
    { from: 'base', to: 'ethereum' },
    { from: 'arbitrum', to: 'base' },
    { from: 'base', to: 'arbitrum' },
  ],

  async getQuote(params: BridgeQuoteParams): Promise<BridgeQuote | null> {
    const { fromChain, toChain, token, amount, recipientAddress } = params;
    const originChainId = CHAIN_ID_MAP[fromChain];
    const destinationChainId = CHAIN_ID_MAP[toChain];

    if (!originChainId || !destinationChainId) return null;

    const tokenConfig = SUPPORTED_TOKENS[token === 'ETH' ? 'WETH' : token];
    if (!tokenConfig) return null;

    const inputToken = tokenConfig.addresses[fromChain];
    const outputToken = tokenConfig.addresses[toChain];

    if (!inputToken || !outputToken) return null;

    try {
      const url = `https://app.across.to/api/suggested-fees?inputToken=${inputToken}&outputToken=${outputToken}&originChainId=${originChainId}&destinationChainId=${destinationChainId}&amount=${amount}&recipient=${recipientAddress}`;

      const response = await fetchWithTimeout(url, { timeout: 8000 });
      if (!response.ok) return null;

      const data = (await response.json()) as AcrossSuggestedFeesResponse;

      // Across v3 nests fees under `totalRelayFee.total` (atomic units) — that
      // total already bundles gas + capital + LP, so it is the full amount the
      // relayer deducts. If the response is missing it (shape change / partial
      // payload), fall back to summing the sub-fees rather than failing open to a
      // 0 fee, which would over-promise `expectedOutputAmount = full input` and
      // produce an unfillable deposit. If NO fee field is present, we cannot size
      // safely — return null instead of a bogus quote.
      const feeFromTotal = data.totalRelayFee?.total;
      const hasSubFees = Boolean(data.relayerGasFee || data.relayerCapitalFee || data.lpFee);
      let totalFeeAtomic: bigint;
      if (feeFromTotal != null) {
        totalFeeAtomic = BigInt(feeFromTotal);
      } else if (hasSubFees) {
        totalFeeAtomic =
          BigInt(data.relayerGasFee?.total ?? '0') +
          BigInt(data.relayerCapitalFee?.total ?? '0') +
          BigInt(data.lpFee?.total ?? '0');
      } else {
        console.warn('Across quote missing all fee fields; cannot size output safely');
        return null;
      }

      const inputAmount = BigInt(amount);
      const expectedOutputAmount = (inputAmount - totalFeeAtomic).toString();

      // Fetch token price to calculate feeUsd
      let feeUsd = 0;
      try {
        const priceData = await fetchTokenPrices([`coingecko:${tokenConfig.coingeckoId}`]);
        const price = priceData[`coingecko:${tokenConfig.coingeckoId}`];
        if (price) {
          feeUsd = Number(formatUnits(totalFeeAtomic, tokenConfig.decimals)) * price;
        }
      } catch (e) {
        console.warn('Failed to fetch price for Across feeUsd calculation', e);
      }

      return {
        bridgeId: 'across',
        feeUsd,
        estimatedTimeSeconds: data.expectedFillTimeSec ?? 120,
        expectedOutputAmount,
        slippagePercent: params.slippagePercent,
        expiresAt: new Date(Date.now() + BRIDGE_QUOTE_TTL_MS),
        rawQuote: {
          ...data,
          inputToken,
          outputToken,
          originChainId,
          destinationChainId,
          recipientAddress,
          inputAmount: amount,
          tokenSymbol: token,
          decimals: tokenConfig.decimals,
        },
      };
    } catch (error) {
      console.error('Error fetching Across quote:', error);
      return null;
    }
  },

  async buildBridgeTx(quote: BridgeQuote): Promise<UnsignedTx> {
    const raw = quote.rawQuote as AcrossRawQuote;
    const inputAmount = BigInt(raw.inputAmount);
    // depositV3 commits the relayer to deliver EXACTLY `outputAmount`. Sizing it
    // at the raw `expectedOutputAmount` leaves zero margin, so any fee drift
    // between quote and execution makes the deposit unfillable until the 6h
    // refund. Floor it by the user's slippage tolerance so relayers retain
    // headroom and the fill succeeds.
    const outputAmount = applySlippageFloor(
      BigInt(quote.expectedOutputAmount),
      quote.slippagePercent,
    );
    const destinationChainId = BigInt(raw.destinationChainId);

    const data = encodeFunctionData({
      abi: SPOKE_POOL_ABI,
      functionName: 'depositV3',
      args: [
        raw.recipientAddress, // depositor
        raw.recipientAddress, // recipient
        raw.inputToken,
        raw.outputToken,
        inputAmount,
        outputAmount,
        destinationChainId,
        raw.exclusiveRelayer || '0x0000000000000000000000000000000000000000',
        Number(raw.timestamp),
        Number(raw.timestamp) + 21600, // fillDeadline, 6 hours default
        Number(raw.exclusivityDeadline || 0),
        '0x', // message
      ],
    });

    // Check if it's native ETH. In Across, WETH address + value = native ETH deposit
    const isEth = raw.tokenSymbol === 'ETH';

    return {
      chainId: raw.originChainId,
      to: (SPOKE_POOL_ADDRESSES[raw.originChainId] ||
        '0x59728544B08AB483533076417FbBB2fD0B17CE3a') as `0x${string}`,
      data,
      value: isEth ? inputAmount : BigInt(0),
      description: `Bridge ${formatUnits(inputAmount, raw.decimals)} ${raw.tokenSymbol} via Across`,
    };
  },

  async pollStatus(txHash: string, _fromChain: ChainId): Promise<BridgeStatus> {
    const apiUrl = `https://across.to/api/deposit/status?originTransactionHash=${txHash}`;
    const explorerUrl = `https://across.to/explorer/transactions/${txHash}`;

    try {
      const response = await fetchWithTimeout(apiUrl, {
        timeout: 8000,
        cache: 'no-store',
      });

      if (!response.ok) {
        return { status: 'pending', trackingUrl: explorerUrl };
      }

      const data = await response.json();

      if (data.status === 'filled') {
        const destinationTxHash = data.fillTxs?.[0]?.hash;
        const destinationChainId = data.destinationChainId;
        const destinationChain = destinationChainId
          ? REVERSE_CHAIN_ID_MAP[destinationChainId]
          : null;

        let trackingUrl = explorerUrl;
        if (destinationTxHash && destinationChain) {
          try {
            const { getExplorerTxUrl } = await import('@/lib/utils/chains');
            trackingUrl = getExplorerTxUrl(destinationChain, destinationTxHash);
          } catch (e) {
            console.warn('Failed to get explorer URL', e);
          }
        }

        return {
          status: 'complete',
          destinationTxHash,
          trackingUrl,
        };
      }

      if (data.status === 'expired') {
        return {
          status: 'failed',
          errorMessage: 'Across deposit expired',
          trackingUrl: explorerUrl,
        };
      }

      return { status: 'pending', trackingUrl: explorerUrl };
    } catch (error) {
      console.error('Error polling Across bridge status:', error);
      return { status: 'pending', trackingUrl: explorerUrl };
    }
  },
};
