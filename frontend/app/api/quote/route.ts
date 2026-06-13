import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateCostPreview } from '@/lib/costPreview/calculator';
import { jsonError, parseJson } from '@/lib/validation/http';
import { chainSchema } from '@/lib/validation/primitives';

const QuoteSchema = z.object({
  asset: z.string().min(1, 'asset is required'),
  amountUsd: z.number().positive('amountUsd must be a positive number'),
  sourceProtocol: z.string().min(1, 'sourceProtocol is required'),
  sourceChain: chainSchema,
  destProtocol: z.string().min(1, 'destProtocol is required'),
  destChain: chainSchema,
  pendleMaturityMs: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  const parsed = await parseJson(request, QuoteSchema);
  if (!parsed.ok) return parsed.response;

  const {
    asset,
    amountUsd,
    sourceProtocol,
    sourceChain,
    destProtocol,
    destChain,
    pendleMaturityMs,
  } = parsed.data;

  // No-op detection
  if (sourceProtocol === destProtocol && sourceChain === destChain) {
    return jsonError('Source and destination are the same — nothing to move');
  }

  try {
    const result = await calculateCostPreview({
      asset,
      amountUsd,
      sourceProtocol,
      sourceChain,
      destProtocol,
      destChain,
      pendleMaturityMs,
    });

    // Serialize Date for JSON
    return NextResponse.json({
      ...result,
      quoteFetchedAt: result.quoteFetchedAt.toISOString(),
    });
  } catch (error) {
    console.error('Quote calculation error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json({ error: 'Upstream service timeout' }, { status: 504 });
      }

      if (error.message.includes('fetch') || error.message.includes('network')) {
        return NextResponse.json({ error: 'Upstream network failure' }, { status: 502 });
      }
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Internal calculation logic error';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
