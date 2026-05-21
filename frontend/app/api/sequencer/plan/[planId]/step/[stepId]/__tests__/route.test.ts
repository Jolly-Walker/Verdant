import { describe, it, expect, vi } from 'vitest'
import { PATCH } from '../route'
import { getSequencePlan, updateSequencePlanStep } from '@/lib/data/sequencePlans'
import { SequencePlan } from '@/types/sequencer'

vi.mock('@/lib/data/sequencePlans', () => ({
  getSequencePlan: vi.fn(),
  updateSequencePlanStep: vi.fn()
}))

describe('PATCH /api/sequencer/plan/[planId]/step/[stepId]', () => {
  it('returns 400 if ready -> signing transition lacks acknowledgment', async () => {
    vi.mocked(getSequencePlan).mockResolvedValue({
      id: 'plan-1',
      walletAddress: '0x123',
      steps: [{ id: 'step-1', status: 'ready' }]
    } as unknown as SequencePlan)

    const req = new Request('http://localhost/api/sequencer/plan/plan-1/step/step-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'signing', walletAddress: '0x123' })
    })

    const res = await PATCH(req, { params: { planId: 'plan-1', stepId: 'step-1' } })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Simulation must be acknowledged')
  })

  it('returns 200 if ready -> signing transition has acknowledgment', async () => {
    vi.mocked(getSequencePlan).mockResolvedValue({
      id: 'plan-1',
      walletAddress: '0x123',
      createdAt: new Date(),
      steps: [{ id: 'step-1', status: 'ready' }]
    } as unknown as SequencePlan)
    vi.mocked(updateSequencePlanStep).mockResolvedValue(true)

    const req = new Request('http://localhost/api/sequencer/plan/plan-1/step/step-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'signing', acknowledged: true, walletAddress: '0x123' })
    })

    const res = await PATCH(req, { params: { planId: 'plan-1', stepId: 'step-1' } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
