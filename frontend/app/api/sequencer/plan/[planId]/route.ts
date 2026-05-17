import { NextResponse } from 'next/server'
import { getSequencePlan } from '@/lib/data/sequencePlans'
import { serializeSequencePlan } from '@/lib/sequencer/engine'

export async function GET(req: Request, { params }: { params: { planId: string } }) {
  try {
    const url = new URL(req.url)
    const walletAddress = url.searchParams.get('wallet')

    if (!walletAddress) {
      return NextResponse.json({ error: 'wallet query parameter required' }, { status: 400 })
    }

    const plan = await getSequencePlan(params.planId)
    
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ plan: serializeSequencePlan(plan) })
  } catch (error) {
    console.error('Error fetching plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
