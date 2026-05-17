import { ALL_CHAINS } from '@/types/shared';
import { SequencePlan, SequenceStep, SerializedSequenceStep, SerializedSequencePlan } from '@/types/sequencer';

export function serializeSequenceStep(step: SequenceStep): SerializedSequenceStep {
  return {
    ...step,
    unsignedTx: step.unsignedTx ? {
      ...step.unsignedTx,
      value: step.unsignedTx.value.toString(),
      gasLimit: step.unsignedTx.gasLimit?.toString()
    } : undefined,
    simulation: step.simulation ? {
      ...step.simulation,
      gasEstimate: step.simulation.gasEstimate?.toString(),
      simulatedAt: step.simulation.simulatedAt.toISOString()
    } : undefined
  };
}

export function deserializeSequenceStep(step: SerializedSequenceStep): SequenceStep {
  return {
    ...step,
    unsignedTx: step.unsignedTx ? {
      ...step.unsignedTx,
      value: BigInt(step.unsignedTx.value),
      gasLimit: step.unsignedTx.gasLimit ? BigInt(step.unsignedTx.gasLimit) : undefined
    } : undefined,
    simulation: step.simulation ? {
      ...step.simulation,
      gasEstimate: step.simulation.gasEstimate ? BigInt(step.simulation.gasEstimate) : undefined,
      simulatedAt: new Date(step.simulation.simulatedAt)
    } : undefined
  };
}

export function serializeSequencePlan(plan: SequencePlan): SerializedSequencePlan {
  return {
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    steps: plan.steps.map(serializeSequenceStep)
  };
}

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
