'use client';

import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { Spinner } from '@/components/ui/Spinner';
import type { SequencePlan } from '@/types/sequencer';

export function SequenceProgress({
  plan,
  currentStepId,
}: {
  plan: SequencePlan;
  currentStepId: string | null;
}) {
  const prefersReducedMotion = useReducedMotion();

  const totalSteps = plan.steps.length;
  const completedCount = plan.steps.filter((s) => s.status === 'confirmed').length;
  // Fraction of the connector line that should be filled (0 → 1), based on
  // how many steps have confirmed. Guard against a single-step (or empty) plan.
  const fillFraction =
    totalSteps > 1 ? Math.min(completedCount / (totalSteps - 1), 1) : completedCount > 0 ? 1 : 0;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between relative">
        {/* Background Line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-[#E5E0D8] -z-0" />

        {/* Animated progress fill — grows left→right proportional to completed steps */}
        <motion.div
          className="absolute top-5 left-0 h-0.5 bg-verdant-profit -z-0 origin-left"
          style={{ right: 0 }}
          initial={false}
          animate={{ scaleX: fillFraction }}
          transition={
            prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 24 }
          }
        />

        {plan.steps.map((step, index) => {
          const isActive = step.id === currentStepId;
          const isCompleted = step.status === 'confirmed';
          const isFailed = step.status === 'failed';

          return (
            <div
              key={step.id}
              className="flex flex-col items-center relative z-10 bg-verdant-canvas px-4"
            >
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2
                  ${
                    isCompleted
                      ? 'bg-verdant-profit border-verdant-profit text-white'
                      : isFailed
                        ? 'bg-verdant-loss border-verdant-loss text-white'
                        : isActive
                          ? 'bg-verdant-canvas border-verdant-moss text-verdant-moss'
                          : 'bg-verdant-canvas border-[#E5E0D8] text-verdant-text-muted'
                  }`}
                style={{ transition: 'background-color 0.4s, border-color 0.4s, color 0.4s' }}
                initial={false}
                animate={
                  prefersReducedMotion
                    ? {}
                    : {
                        // Pop on completion, gentle pulse while active.
                        scale: isCompleted ? [1, 1.18, 1] : isActive ? [1, 1.06, 1] : 1,
                      }
                }
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : isActive && !isCompleted
                      ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.4, ease: 'easeOut' }
                }
              >
                {isCompleted ? (
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <motion.path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                      initial={prefersReducedMotion ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { duration: 0.4, ease: 'easeOut', delay: 0.1 }
                      }
                    />
                  </svg>
                ) : isFailed ? (
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : step.status === 'simulating' || step.status === 'signing' ? (
                  <Spinner
                    size="sm"
                    className={isActive ? 'text-verdant-moss' : 'text-verdant-text-muted'}
                  />
                ) : (
                  <span className="font-semibold">{index + 1}</span>
                )}
              </motion.div>
              <span
                className={`mt-2 text-xs font-medium text-center max-w-[120px]
                  ${isActive ? 'text-verdant-moss font-semibold' : isCompleted ? 'text-verdant-text-primary' : 'text-verdant-text-muted'}`}
                style={{ transition: 'color 0.4s, font-weight 0.4s' }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
