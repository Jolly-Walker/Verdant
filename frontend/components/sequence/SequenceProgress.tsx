'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { getChainDisplayName } from '@/lib/utils/chains';
import type { SequencePlan, SequenceStep, StepStatus } from '@/types/sequencer';
import fl from './fieldLedger.module.css';

const EASE = [0.16, 1, 0.3, 1] as const;

type NodeKind = 'confirmed' | 'active' | 'failed' | 'pending';

function nodeKind(status: StepStatus, isActive: boolean): NodeKind {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'failed') return 'failed';
  if (isActive) return 'active';
  return 'pending';
}

const PILL: Record<NodeKind, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmed', cls: 'text-verdant-profit bg-verdant-profit/10' },
  failed: { label: 'Failed', cls: 'text-verdant-loss bg-verdant-loss/10' },
  active: { label: 'Active', cls: 'text-verdant-moss bg-verdant-moss/10' },
  pending: { label: 'Queued', cls: 'text-verdant-text-muted bg-verdant-rule/50' },
};

const NODE_CLS: Record<NodeKind, string> = {
  confirmed: fl.nodeConfirmed,
  active: fl.nodeActive,
  failed: fl.nodeFailed,
  pending: '',
};

// An active node's pill reads the live sub-status so the spine narrates execution.
function activeLabel(status: StepStatus): string {
  if (status === 'simulating') return 'Simulating…';
  if (status === 'signing') return 'Signing…';
  if (status === 'ready') return 'Ready to sign';
  return 'Active';
}

/**
 * The execution spine — the Field Ledger signature. A living vertical stem
 * threads the steps: completed steps are "grown" (solid green), the active
 * step is a budding node, pending steps are dormant rings on a dashed stem.
 */
export function SequenceProgress({
  plan,
  currentStepId,
}: {
  plan: SequencePlan;
  currentStepId: string | null;
}) {
  const reduce = useReducedMotion() ?? false;
  const steps = plan.steps;
  const n = steps.length;

  const activeIndex = steps.findIndex((s) => s.id === currentStepId);
  const completed = steps.filter((s) => s.status === 'confirmed').length;
  // Grow the solid stem to the active node's centre (or to the frontier if the
  // plan is fully confirmed / has no active step).
  const frontier = activeIndex >= 0 ? activeIndex : completed >= n ? n - 1 : completed;
  const grownPct =
    n > 1 ? Math.min(Math.max(frontier / (n - 1), 0), 1) * 100 : completed > 0 ? 100 : 0;

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  };

  return (
    <div className={fl.spine}>
      <div className={fl.spineTrack} aria-hidden />
      <motion.div
        className={fl.spineProgress}
        style={{ height: `${grownPct}%` }}
        aria-hidden
        initial={reduce ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
      />

      <motion.ol
        className="relative space-y-6"
        variants={container}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >
        {steps.map((step: SequenceStep, i) => {
          const isActive = step.id === currentStepId;
          const kind = nodeKind(step.status, isActive);
          const nodeCls = NODE_CLS[kind];
          const pill =
            kind === 'active'
              ? { label: activeLabel(step.status), cls: PILL.active.cls }
              : PILL[kind];

          return (
            <motion.li key={step.id} variants={item} className="flex items-start gap-3.5">
              <span className={`${fl.node} ${nodeCls}`} aria-hidden>
                <span className={fl.nodeDot} />
                {kind === 'active' && <span className={fl.nodeBud} />}
              </span>

              <span
                className={`fl-numeral w-7 shrink-0 pt-0.5 text-2xl ${
                  kind === 'pending' ? 'text-verdant-rule-strong' : 'text-verdant-pine'
                }`}
                aria-hidden
              >
                {String(i + 1).padStart(2, '0')}
              </span>

              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h4
                    className={`fl-serif text-[15px] ${
                      kind === 'pending' ? 'text-verdant-text-muted' : 'text-verdant-text-primary'
                    }`}
                  >
                    {step.label}
                  </h4>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${pill.cls}`}
                  >
                    {pill.label}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-verdant-text-muted">
                  {getChainDisplayName(step.chain)}
                </p>
              </div>
            </motion.li>
          );
        })}
      </motion.ol>
    </div>
  );
}
