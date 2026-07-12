import { expect } from 'vitest';

import type { SequencePlan, SequenceStep } from '@/types/sequencer';
import type { BridgeQuoteParams, TxBuildParams } from '@/types/shared';
import { validatePlan } from '../../engine';

/**
 * Structural invariants every template-built plan must satisfy:
 * - passes the engine's DAG validation (valid chains, existing deps, no cycles)
 * - step ids are unique
 * - every dependency points at an EARLIER step in the list (execution is one
 *   step at a time in listed order; a forward reference would deadlock
 *   `getActiveStep`)
 * - all steps start out 'pending'
 */
export function expectStructurallyValidPlan(plan: SequencePlan): void {
  const { valid, errors } = validatePlan(plan);
  expect(errors).toEqual([]);
  expect(valid).toBe(true);

  const ids = plan.steps.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);

  plan.steps.forEach((step, index) => {
    for (const depId of step.dependsOn) {
      const depIndex = plan.steps.findIndex((s) => s.id === depId);
      expect(depIndex).toBeGreaterThanOrEqual(0);
      expect(depIndex).toBeLessThan(index);
    }
  });

  for (const step of plan.steps) {
    expect(step.status).toBe('pending');
  }
}

/** Narrows a step's buildParams to protocol TxBuildParams or fails the test. */
export function txParams(step: SequenceStep): TxBuildParams {
  if (!('action' in step.buildParams)) {
    throw new Error(`Step ${step.id} does not carry protocol TxBuildParams`);
  }
  return step.buildParams;
}

/** Narrows a step's buildParams to BridgeQuoteParams or fails the test. */
export function bridgeParams(step: SequenceStep): BridgeQuoteParams {
  if ('action' in step.buildParams) {
    throw new Error(`Step ${step.id} does not carry BridgeQuoteParams`);
  }
  return step.buildParams;
}

/** Finds a step by id or fails the test. */
export function getStep(plan: SequencePlan, id: string): SequenceStep {
  const found = plan.steps.find((s) => s.id === id);
  if (!found) {
    throw new Error(
      `Step ${id} not found in plan (have: ${plan.steps.map((s) => s.id).join(', ')})`,
    );
  }
  return found;
}
