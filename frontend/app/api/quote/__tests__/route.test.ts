import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/costPreview/calculator', () => ({
  calculateCostPreview: vi.fn(),
}))

import { calculateCostPreview } from '@/lib/costPreview/calculator'

function postRequest(body: unknown) {
  return new NextRequest(new URL('http://localhost/api/quote'), {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const validBody = {
  asset: 'USDC',
  amountUsd: 10000,
  sourceProtocol: 'aave',
  sourceChain: 'ethereum',
  destProtocol: 'morpho',
  destChain: 'base',
}

describe('POST /api/quote', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects malformed JSON with 400', async () => {
    const res = await POST(postRequest('{not json'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid JSON body')
  })

  it('rejects a missing required field with 400', async () => {
    const { asset, ...rest } = validBody
    void asset
    const res = await POST(postRequest(rest))
    expect(res.status).toBe(400)
  })

  it('rejects a non-positive amountUsd with 400', async () => {
    const res = await POST(postRequest({ ...validBody, amountUsd: 0 }))
    expect(res.status).toBe(400)
  })

  it('rejects an unsupported chain with 400', async () => {
    const res = await POST(postRequest({ ...validBody, sourceChain: 'dogechain' }))
    expect(res.status).toBe(400)
  })

  it('rejects a no-op move (same source and destination) with 400', async () => {
    const res = await POST(
      postRequest({ ...validBody, destProtocol: 'aave', destChain: 'ethereum' })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/nothing to move/i)
  })

  it('returns a cost preview with quoteFetchedAt serialised to ISO', async () => {
    const fetchedAt = new Date('2026-06-13T00:00:00.000Z')
    vi.mocked(calculateCostPreview).mockResolvedValueOnce({
      steps: [],
      totalCostUsd: 1.23,
      totalGasUsd: 1.23,
      totalBridgeFeeUsd: 0,
      totalSlippageUsd: 0,
      currentApyDecimal: 0.05,
      targetApyDecimal: 0.08,
      netUpliftDecimal: 0.03,
      dailyYieldGainUsd: 1,
      breakEvenDays: 2,
      targetUtilisationDecimal: null,
      quoteFetchedAt: fetchedAt,
      warnings: [],
    })

    const res = await POST(postRequest(validBody))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.quoteFetchedAt).toBe('2026-06-13T00:00:00.000Z')
    expect(data.totalCostUsd).toBe(1.23)
    expect(calculateCostPreview).toHaveBeenCalledOnce()
  })
})
