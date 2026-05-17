import { ALL_CHAINS } from '@/types/shared';
import { SequencePlan, SequenceStep } from '@/types/sequencer';

export function getActiveStep(plan: SequencePlan): SequenceStep | null {
  for (const step of plan.steps) {
    if (step.status === 'pending') {
      const dependsOnStatus = step.dependsOn.every(depId => {
        const depStep = plan.steps.find(s => s.id === depId);
        return depStep && depStep.status === 'confirmed';
      });
      if (dependsOnStatus) {
        return step;
      }
    }
  }
  return null;
}

export function canSimulateStep(plan: SequencePlan, stepId: string): boolean {
  const step = plan.steps.find(s => s.id === stepId);
  if (!step) return false;
  if (step.status !== 'pending') return false;

  return step.dependsOn.every(depId => {
    const depStep = plan.steps.find(s => s.id === depId);
    return depStep && depStep.status === 'confirmed';
  });
}

export function canExecuteStep(plan: SequencePlan, stepId: string): boolean {
  const step = plan.steps.find(s => s.id === stepId);
  if (!step) return false;
  return step.status === 'ready';
}

export function applyStepUpdate(
  plan: SequencePlan,
  stepId: string,
  update: Partial<SequenceStep>
): SequencePlan {
  return {
    ...plan,
    steps: plan.steps.map(step =>
      step.id === stepId ? { ...step, ...update } : step
    )
  };
}

export function computePlanStatus(plan: SequencePlan): SequencePlan['status'] {
  if (plan.steps.length === 0) return 'draft';
  if (plan.steps.every(s => s.status === 'confirmed')) return 'complete';
  if (plan.steps.some(s => s.status === 'failed')) return 'failed';
  if (plan.steps.some(s => s.status !== 'pending')) return 'in-progress';
  return plan.status === 'draft' ? 'draft' : 'in-progress';
}

export function validatePlan(plan: SequencePlan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!plan.steps || plan.steps.length === 0) {
    errors.push('Plan must have at least 1 step');
    return { valid: false, errors };
  }

  const validChains: readonly string[] = ALL_CHAINS;
  const stepIds = new Set(plan.steps.map(s => s.id));

  for (const step of plan.steps) {
    if (!validChains.includes(step.chain)) {
      errors.push(`Step ${step.id} has invalid chainId: ${step.chain}`);
    }
    for (const depId of step.dependsOn) {
      if (!stepIds.has(depId)) {
        errors.push(`Step ${step.id} depends on non-existent step: ${depId}`);
      }
    }
  }

  // Circular dependency check using topological sort approach
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string) {
    if (!visited.has(nodeId)) {
      visited.add(nodeId);
      recStack.add(nodeId);

      const step = plan.steps.find(s => s.id === nodeId);
      if (step) {
        for (const depId of step.dependsOn) {
          if (!visited.has(depId) && dfs(depId)) {
            return true;
          } else if (recStack.has(depId)) {
            return true;
          }
        }
      }
    }
    recStack.delete(nodeId);
    return false;
  }

  for (const step of plan.steps) {
    if (!visited.has(step.id)) {
      if (dfs(step.id)) {
        errors.push('Circular dependency detected in steps');
        break; // Only report once
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
