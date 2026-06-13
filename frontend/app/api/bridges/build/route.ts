import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { BRIDGE_REGISTRY } from '@/lib/plugins/bridges';
import { simulateTransaction } from '@/lib/simulation/simulate';
import { parseJson } from '@/lib/validation/http';
import type { SerializedUnsignedTx } from '@/types/sequencer';
import { ALL_BRIDGES, ALL_CHAINS, type BridgeQuote, type ChainId } from '@/types/shared';

// The client posts back a quote it received from /api/bridges/quote, where
// `expiresAt` has been JSON-serialised to a string. Validate that shape, then
// rehydrate the Date before handing it to the bridge plugin.
const SerializedBridgeQuoteSchema = z.object({
  bridgeId: z.enum(ALL_BRIDGES),
  feeUsd: z.number(),
  estimatedTimeSeconds: z.number(),
  expectedOutputAmount: z.string(),
  slippagePercent: z.number(),
  expiresAt: z.union([z.string(), z.number()]),
  rawQuote: z.record(z.string(), z.unknown()),
});

const BuildBridgeTxSchema = z.object({
  bridgeId: z.enum(ALL_BRIDGES),
  quote: SerializedBridgeQuoteSchema,
  walletAddress: z.string(),
});

function getChainIdFromRawQuote(bridgeId: string, rawQuote: Record<string, unknown>): string {
  if (bridgeId === 'across') {
    const originChainId = rawQuote.originChainId;
    if (originChainId === 1) return 'ethereum';
    if (originChainId === 42161) return 'arbitrum';
    if (originChainId === 8453) return 'base';
    return `unknown-chain-id-${originChainId}`;
  }
  return (rawQuote.fromChain as string) || '';
}

export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, BuildBridgeTxSchema);
  if (!parsed.ok) return parsed.response;

  const { bridgeId, quote, walletAddress } = parsed.data;

  try {
    const rawQuote = quote.rawQuote;
    const recipientAddress = rawQuote.recipientAddress;
    if (!recipientAddress || typeof recipientAddress !== 'string') {
      return NextResponse.json({ error: 'Missing recipientAddress in rawQuote' }, { status: 400 });
    }

    if (recipientAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'walletAddress does not match recipientAddress' },
        { status: 400 },
      );
    }

    const fromChain = getChainIdFromRawQuote(bridgeId, rawQuote);
    if (!fromChain || !ALL_CHAINS.includes(fromChain as ChainId)) {
      return NextResponse.json(
        { error: `Unsupported origin chain: ${fromChain}` },
        { status: 400 },
      );
    }

    const bridge = BRIDGE_REGISTRY[bridgeId];
    if (!bridge) {
      return NextResponse.json({ error: 'Invalid bridge ID' }, { status: 400 });
    }

    // Rehydrate the serialised quote into a real BridgeQuote (expiresAt → Date).
    const bridgeQuote: BridgeQuote = { ...quote, expiresAt: new Date(quote.expiresAt) };
    const unsignedTx = await bridge.buildBridgeTx(bridgeQuote);

    // Simulate transaction
    const simResult = await simulateTransaction({
      chain: fromChain as ChainId,
      to: unsignedTx.to,
      from: walletAddress,
      data: unsignedTx.data,
      value: unsignedTx.value.toString(),
    });

    if (!simResult.success) {
      return NextResponse.json(
        { error: simResult.revertReason || 'Transaction simulation failed' },
        { status: 400 },
      );
    }

    // Serialize BigInt for JSON response
    const serializedTx: SerializedUnsignedTx = {
      ...unsignedTx,
      value: unsignedTx.value.toString(),
      gasLimit: unsignedTx.gasLimit?.toString(),
    };

    return NextResponse.json({ unsignedTx: serializedTx });
  } catch (err) {
    console.error('[bridges/build] Failed to build bridge tx:', err);
    return NextResponse.json({ error: 'Failed to build bridge transaction' }, { status: 500 });
  }
}
