import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getHarvestHistory } from '@/lib/data/harvestHistory';
import { parseQuery } from '@/lib/validation/http';
import { evmAddressSchema } from '@/lib/validation/primitives';

const QuerySchema = z.object({
  address: evmAddressSchema,
});

/**
 * GET /api/harvest/history?address={address}
 *
 * Returns the most recent harvest events for a wallet address.
 */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(new URL(req.url).searchParams, QuerySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const records = await getHarvestHistory(parsed.data.address);
    return NextResponse.json({ records });
  } catch (err) {
    console.error('[harvest/history] fetch failed:', err);
    return NextResponse.json({ error: 'Could not load harvest history' }, { status: 502 });
  }
}
