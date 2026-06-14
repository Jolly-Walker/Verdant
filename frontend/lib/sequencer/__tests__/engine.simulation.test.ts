import { describe, expect, it } from 'vitest';
import type { SequenceStep } from '@/types/sequencer';
import { deserializeSequenceStep, serializeSequenceStep } from '../engine';

describe('Simulation Serialization', () => {
  it('serializes and deserializes stateChanges in SimulationResult', () => {
    const step: Partial<SequenceStep> = {
      id: 'step-1',
      status: 'ready',
      simulation: {
        success: true,
        simulatedAt: new Date('2026-05-18T12:00:00Z'),
        gasEstimate: 21000n,
        stateChanges: [
          {
            asset: 'USDC',
            assetAddress: '0x...',
            change: '-100',
            type: 'balance',
            decimals: 6,
            chainId: 'ethereum',
          },
        ],
      },
    };
    const serialized = serializeSequenceStep(step as SequenceStep);
    const deserialized = deserializeSequenceStep(serialized);
    expect(deserialized.simulation?.stateChanges).toEqual(step.simulation?.stateChanges);
  });
});
