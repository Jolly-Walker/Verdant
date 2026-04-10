import { NextRequest, NextResponse } from 'next/server'
import { CostPreviewInput } from '@/types/quote'
import { calculateCostPreview } from '@/lib/costPreview/calculator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    const { asset, amountUsd, sourceProtocol, sourceChain, destProtocol, destChain } =
      body as CostPreviewInput

    if (!asset || !amountUsd || !sourceProtocol || !sourceChain || !destProtocol || !destChain) {
      return NextResponse.json(
        { error: 'Missing required fields: asset, amountUsd, sourceProtocol, sourceChain, destProtocol, destChain' },
        { status: 400 }
      )
    }

    // No-op detection
    if (sourceProtocol === destProtocol && sourceChain === destChain) {
      return NextResponse.json(
        { error: 'Source and destination are the same — nothing to move' },
        { status: 400 }
      )
    }

    // Calculate with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const result = await calculateCostPreview({
      asset,
      amountUsd,
      sourceProtocol,
      sourceChain,
      destProtocol,
      destChain,
    })

    clearTimeout(timeoutId)

    // Serialize Date for JSON
    return NextResponse.json({
      ...result,
      quoteFetchedAt: result.quoteFetchedAt.toISOString(),
    })
  } catch (error) {
    console.error('Quote calculation error:', error)

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Upstream service timeout' },
          { status: 504 }
        )
      }

      if (error.message.includes('fetch') || error.message.includes('network')) {
        return NextResponse.json(
          { error: 'Upstream network failure' },
          { status: 502 }
        )
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Internal calculation logic error'

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
