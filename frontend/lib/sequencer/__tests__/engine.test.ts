import { describe, it, expect } from 'vitest';
import { SequencePlan, SequenceStep } from '../../plugins/types/sequencer';
import { getActiveStep, canSimulateStep, canExecuteStep, applyStepUpdate, computePlanStatus, validatePlan } from '../engine';

const createBasePlan = (): SequencePlan => ({
  id: '1',
  walletAddress: '0x123',
  createdAt: new Date(),
  steps: [],
  status: 'draft',
  totalCostUsd: 0,
  description: 'Test Plan'
});

const createStep = (id: string, status: any, dependsOn: string[] = []): SequenceStep => ({
  id,
  label: `Step ${id}`,
  chain: 'ethereum',
  status,
  dependsOn,
  pluginId: 'aave',
  buildParams: { action: 'supply', protocol: 'aave', chain: 'ethereum', asset: 'USDC', amount: '100', userAddress: '0x123' }
});

describe('Sequencer Engine', () => {
  describe('getActiveStep', () => {
    it('returns the first pending step with no dependencies', () => {
      const plan = createBasePlan();
      plan.steps = [
        createStep('1', 'pending')
      ];
      const active = getActiveStep(plan);
      expect(active?.id).toBe('1');
    });

    it('returns null if all steps are confirmed', () => {
      const plan = createBasePlan();
      plan.steps = [
        createStep('1', 'confirmed')
      ];
      const active = getActiveStep(plan);
      expect(active).toBeNull();
    });

    it('returns step whose dependencies are confirmed', () => {
      const plan = createBasePlan();
      plan.steps = [
        createStep('1', 'confirmed'),
        createStep('2', 'pending', ['1'])
      ];
      const active = getActiveStep(plan);
      expect(active?.id).toBe('2');
    });

    it('does not return step if dependencies are not confirmed', () => {
      const plan = createBasePlan();
      plan.steps = [
        createStep('1', 'pending'),
        createStep('2', 'pending', ['1'])
      ];
      // Active should be 1, because its dependencies are empty (all confirmed)
      const active = getActiveStep(plan);
      expect(active?.id).toBe('1');
    });
  });

  describe('canSimulateStep', () => {
    it('returns true if step is pending and dependencies are confirmed', () => {
      const plan = createBasePlan();
      plan.steps = [
        createStep('1', 'confirmed'),
        createStep('2', 'pending', ['1'])
      ];
      expect(canSimulateStep(plan, '2')).toBe(true);
    });

    it('returns false if step is not pending', () => {
      const plan = createBasePlan();
      plan.steps = [
        createStep('1', 'ready')
      ];
      expect(canSimulateStep(plan, '1')).toBe(false);
    });

    it('returns false if dependencies are not confirmed', () => {
      const plan = createBasePlan();
      plan.steps = [
        createStep('1', 'ready'),
        createStep('2', 'pending', ['1'])
      ];
      expect(canSimulateStep(plan, '2')).toBe(false);
    });
  });

  describe('canExecuteStep', () => {
    it('returns true if step is ready', () => {
      const plan = createBasePlan();
      plan.steps = [
        createStep('1', 'ready')
      ];
      expect(canExecuteStep(plan, '1')).toBe(true);
    });

    it('returns false if step is not ready', () => {
      const plan = createBasePlan();
      plan.steps = [
        createStep('1', 'simulating')
      ];
      expect(canExecuteStep(plan, '1')).toBe(false);
    });
  });

  describe('applyStepUpdate', () => {
    it('returns a new plan with updated step', () => {
      const plan = createBasePlan();
      plan.steps = [createStep('1', 'pending')];
      
      const updated = applyStepUpdate(plan, '1', { status: 'ready' });
      
      expect(updated).not.toBe(plan); // Should be a new object
      expect(updated.steps[0].status).toBe('ready');
      expect(plan.steps[0].status).toBe('pending'); // Original untouched
    });
  });

  describe('computePlanStatus', () => {
    it('returns complete if all steps confirmed', () => {
      const plan = createBasePlan();
      plan.steps = [createStep('1', 'confirmed'), createStep('2', 'confirmed')];
      expect(computePlanStatus(plan)).toBe('complete');
    });

    it('returns failed if any step failed', () => {
      const plan = createBasePlan();
      plan.steps = [createStep('1', 'confirmed'), createStep('2', 'failed')];
      expect(computePlanStatus(plan)).toBe('failed');
    });

    it('returns in-progress if steps are mixed and not failed', () => {
      const plan = createBasePlan();
      plan.steps = [createStep('1', 'confirmed'), createStep('2', 'pending')];
      expect(computePlanStatus(plan)).toBe('in-progress');
    });
  });

  describe('validatePlan', () => {
    it('returns false if no steps', () => {
      const plan = createBasePlan();
      const res = validatePlan(plan);
      expect(res.valid).toBe(false);
    });

    it('returns false if invalid chainId', () => {
      const plan = createBasePlan();
      const step = createStep('1', 'pending');
      step.chain = 'invalid_chain' as any;
      plan.steps = [step];
      const res = validatePlan(plan);
      expect(res.valid).toBe(false);
    });

    it('detects circular dependencies', () => {
      const plan = createBasePlan();
      plan.steps = [
        createStep('1', 'pending', ['2']),
        createStep('2', 'pending', ['1'])
      ];
      const res = validatePlan(plan);
      expect(res.valid).toBe(false);
      expect(res.errors).toContain('Circular dependency detected in steps');
    });

    it('returns true for valid plan', () => {
      const plan = createBasePlan();
      plan.steps = [
        createStep('1', 'pending'),
        createStep('2', 'pending', ['1'])
      ];
      const res = validatePlan(plan);
      expect(res.valid).toBe(true);
    });
  });
});
