import 'server-only';
import { formatUnits, parseUnits } from 'viem';
import { SUPPORTED_TOKENS } from '@/constants/tokens';
import { getServerEnvOrWarn } from '@/lib/server/env';
import type { ChainId, UnsignedTx } from '@/types/shared';
import type { SwapPlugin, SwapQuote, SwapQuoteParams } from '../types/swap-plugin';

/**
 * 1inch Classic Swap API v6.0.
 * Docs: https://portal.1inch.dev/documentation/apis/swap/classic-swap
 * Requires a server-side ONEINCH_API_KEY (Bearer auth). When unset, getQuote
 * returns null so the swap option is simply unavailable rather than crashing.
 */
const ONEINCH_API = 'https://api.1inch.dev/swap/v6.0';

// 1inch's sentinel address for native ETH.
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const EVM_CHAIN_IDS: Partial<Record<ChainId, number>> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
};

/** Resolves a token symbol or address to an on-chain address + decimals. */
function resolveToken(
  tokenOrSymbol: string,
  chain: ChainId,
): { address: string; decimals: number } | null {
  if (tokenOrSymbol.toUpperCase() === 'ETH') return { address: NATIVE_TOKEN, decimals: 18 };

  // Already an address?
  if (/^0x[a-fA-F0-9]{40}$/.test(tokenOrSymbol)) {
    const known = Object.values(SUPPORTED_TOKENS).find(
      (t) => t.addresses[chain]?.toLowerCase() === tokenOrSymbol.toLowerCase(),
    );
    return { address: tokenOrSymbol, decimals: known?.decimals ?? 18 };
  }

  const config = SUPPORTED_TOKENS[tokenOrSymbol.toUpperCase()];
  const address = config?.addresses[chain];
  if (!address) return null;
  return { address, decimals: config.decimals };
}

function authHeaders(): Record<string, string> | null {
  const apiKey = getServerEnvOrWarn('ONEINCH_API_KEY', 'the 1inch swap option is unavailable');
  if (!apiKey) return null;
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

interface OneInchRawQuote {
  chainId: number;
  src: string;
  dst: string;
  amountWei: string;
  dstDecimals: number;
  slippagePercent: number;
}

export const oneinchPlugin: SwapPlugin = {
  id: '1inch',
  displayName: '1inch',
  supportedChains: ['ethereum', 'arbitrum', 'base'],

  async getQuote(params: SwapQuoteParams): Promise<SwapQuote | null> {
    const chainId = EVM_CHAIN_IDS[params.fromChain];
    if (!chainId) return null;

    const headers = authHeaders();
    if (!headers) {
      console.warn('[1inch] ONEINCH_API_KEY not set — swap quotes unavailable');
      return null;
    }

    const src = resolveToken(params.fromToken, params.fromChain);
    const dst = resolveToken(params.toToken, params.fromChain);
    if (!src || !dst) return null;

    try {
      const amountWei = parseUnits(params.amount, src.decimals).toString();
      const qs = new URLSearchParams({ src: src.address, dst: dst.address, amount: amountWei });
      const res = await fetch(`${ONEINCH_API}/${chainId}/quote?${qs.toString()}`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;

      const data = await res.json();
      const dstAmount: string | undefined = data.dstAmount ?? data.toAmount;
      if (!dstAmount) return null;

      return {
        aggregator: '1inch',
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.amount,
        toAmount: formatUnits(BigInt(dstAmount), dst.decimals),
        feeUsd: 0, // gas is counted per-step in the cost engine; 1inch quote has no protocol fee
        priceImpactPercent: 0,
        expiresAt: new Date(Date.now() + 30_000),
        rawQuote: {
          chainId,
          src: src.address,
          dst: dst.address,
          amountWei,
          dstDecimals: dst.decimals,
          slippagePercent: params.slippagePercent,
        } satisfies OneInchRawQuote,
      };
    } catch (e) {
      console.error('[1inch] getQuote failed:', e);
      return null;
    }
  },

  async buildSwapTx(quote: SwapQuote, userAddress: string): Promise<UnsignedTx> {
    const raw = quote.rawQuote as OneInchRawQuote;
    const headers = authHeaders();
    if (!headers) throw new Error('ONEINCH_API_KEY not set — cannot build 1inch swap');

    const qs = new URLSearchParams({
      src: raw.src,
      dst: raw.dst,
      amount: raw.amountWei,
      from: userAddress,
      slippage: String(raw.slippagePercent),
      origin: userAddress,
    });
    const res = await fetch(`${ONEINCH_API}/${raw.chainId}/swap?${qs.toString()}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`1inch swap build failed: ${res.status}`);

    const data = await res.json();
    const tx = data.tx;
    if (!tx?.to || !tx?.data) throw new Error('1inch swap response missing transaction data');

    return {
      chainId: raw.chainId,
      to: tx.to,
      data: tx.data,
      value: BigInt(tx.value ?? '0'),
      description: `Swap ${quote.fromAmount} ${quote.fromToken} → ${quote.toToken} via 1inch`,
    };
  },
};
