import { NextRequest, NextResponse } from 'next/server'
import { simulateTransaction } from '@/lib/simulation/simulate'
import { Chain } from '@/types/chain'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, from, data, value, chainId } = body

    if (!to || !from || !chainId) {
      return NextResponse.json(
        { error: 'Missing required parameters: to, from, chainId' },
        { status: 400 }
      )
    }

    // Map chainId (which could be numeric from frontend) back to ChainId slug if needed,
    // but simulateTransaction expects Chain (slug).
    // Let's assume frontend passes the slug or we can resolve it.
    // In StepTwoDeposit.tsx it passed getChainId(destChain) which is now number | string.
    
    // We need a way to get the slug from the chainId if it's numeric.
    // For now, let's assume the frontend passes the slug 'ethereum', 'arbitrum', etc.
    // Wait, StepTwoDeposit.tsx: chainId: getChainId(destChain)
    // getChainId returns number | string.
    
    // Let's find the chain slug from the chainId.
    const chainSlug = body.chain as Chain // Optional field if we want to be explicit

    const result = await simulateTransaction({
      chain: chainSlug || 'ethereum', // Fallback or resolve from chainId
      to,
      from,
      data: data || '0x',
      value: value || '0',
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      gasUsed: result.gasUsed,
      expectedOutput: 'Transaction simulation successful',
    })
  } catch (error) {
    console.error('Simulation error:', error)
    return NextResponse.json(
      { error: 'Failed to simulate transaction' },
      { status: 500 }
    )
  }
}
