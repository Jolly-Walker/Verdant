import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { findPoolApyByIds } from '@/lib/data/poolApyLookup';
import { CHAIN_REGISTRY } from '@/lib/plugins/chains';
import { PROTOCOL_REGISTRY } from '@/lib/plugins/protocols';
import type { ChainId, ProtocolId } from '@/types/shared';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const protocol = searchParams.get('protocol');
  const chain = searchParams.get('chain');
  const asset = searchParams.get('asset');

  if (!protocol || !chain || !asset) {
    return NextResponse.json(
      { error: 'Missing required params: protocol, chain, asset' },
      { status: 400 },
    );
  }

  // Validate the untrusted query params up front (400, not a 404 "no data").
  if (!PROTOCOL_REGISTRY[protocol as ProtocolId] || !CHAIN_REGISTRY[chain as ChainId]) {
    return NextResponse.json({ error: 'Unknown protocol or chain' }, { status: 400 });
  }

  try {
    const result = await findPoolApyByIds(protocol as ProtocolId, chain as ChainId, asset);

    if (!result) {
      return NextResponse.json(
        { error: `No APY data found for ${protocol}/${chain}/${asset}` },
        { status: 404 },
      );
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('APY fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch APY data' }, { status: 500 });
  }
}
