'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CloseButton } from '@/components/ui/CloseButton';
import { Modal } from '@/components/ui/Modal';
import { PlusIcon } from '@/components/ui/PlusIcon';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePositions } from '@/hooks/usePositions';
import { useSequencer } from '@/hooks/useSequencer';
import { useWallet } from '@/hooks/useWallet';
import { DEMO_WALLET_ADDRESS } from '@/lib/demo/wallet';
import { appendStepOfKind, removeStepAt } from '@/lib/sequenceBuilder/canvas';
import { builderStepsToSequencePlan, canSubmit } from '@/lib/sequenceBuilder/logic';
import type {
  ActionType,
  BuilderStep,
  DepositDestination,
  TokenState,
} from '@/lib/sequenceBuilder/types';
import type { BridgeId, ChainId } from '@/types/shared';
import { SequenceCanvas } from './canvas/SequenceCanvas';
import { SidePanel } from './canvas/SidePanel';
import { SummaryBar } from './SummaryBar';

interface SequenceBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPositionId?: string;
}

/** A factory, not a shared constant: the returned array becomes mutable state. */
function createInitialSteps(): BuilderStep[] {
  return [{ kind: 'source', tokenOut: { token: '', chain: 'ethereum', amount: 0, amountUsd: 0 } }];
}

/** Tailwind's `lg` breakpoint — above it the side panel is permanently docked. */
const DESKTOP_QUERY = '(min-width: 1024px)';

export function SequenceBuilderModal({
  isOpen,
  onClose,
  initialPositionId,
}: SequenceBuilderModalProps) {
  const router = useRouter();
  const { positions } = usePositions();
  const { createPlan } = useSequencer();
  const { address } = useWallet();
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  // Below `lg` the side panel lives in an overlay sheet toggled by a floating
  // button — rendered *instead of* the docked aside, never alongside it, so
  // only one SourceCard / PalettePanel state ever exists.
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const sheetTriggerRef = useRef<HTMLButtonElement>(null);
  const wasSheetOpen = useRef(false);

  // Initialize steps array
  const [steps, setSteps] = useState<BuilderStep[]>(createInitialSteps);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  // Bumped whenever the control the user was on is about to unmount; SidePanel
  // parks focus on its heading so keyboard focus never falls back to <body>.
  const [panelFocusNonce, setPanelFocusNonce] = useState(0);

  // Sync / pre-seed from initialPositionId
  useEffect(() => {
    if (isOpen && initialPositionId && positions.length > 0) {
      const pos = positions.find((p) => p.id === initialPositionId);
      if (pos && pos.positionType !== 'borrow') {
        const tokenOut: TokenState = {
          token: pos.asset,
          chain: pos.chain,
          amount: pos.amount,
          amountUsd: pos.amountUsd,
          sourcePositionId: pos.id,
          positionType: pos.positionType === 'supply' ? 'supply' : 'wallet',
        };
        setSteps([
          { kind: 'source', tokenOut },
          { kind: 'action-select', tokenIn: tokenOut },
        ]);
        setActiveStepIndex(1);
      }
    } else if (isOpen && !initialPositionId) {
      // Reset
      setSteps(createInitialSteps());
      setActiveStepIndex(0);
    }
  }, [isOpen, initialPositionId, positions]);

  // A stale failure from a previous attempt must not greet the next open.
  useEffect(() => {
    if (isOpen) {
      setExecuteError(null);
      setIsSheetOpen(false);
    }
  }, [isOpen]);

  // Sheet focus: in on open, back to the trigger on close (the trigger only
  // re-mounts on the closing render, so restoring has to happen in an effect).
  useEffect(() => {
    if (isSheetOpen) sheetRef.current?.focus();
    else if (wasSheetOpen.current) sheetTriggerRef.current?.focus();
    wasSheetOpen.current = isSheetOpen;
  }, [isSheetOpen]);

  // Stable identities: these ride inside React Flow node data, so the canvas'
  // node-graph memo re-derives only when the graph really changed and not on
  // unrelated re-renders (opening the mobile sheet, an execute error landing).
  const handleStepFocus = useCallback(
    (idx: number) => {
      setActiveStepIndex(idx);
      // Below `lg` the SidePanel is not mounted until the sheet opens, so
      // without this a node tap changes nothing the user can see.
      if (!isDesktop) setIsSheetOpen(true);
    },
    [isDesktop],
  );

  const handleFocusPalette = useCallback(() => {
    setActiveStepIndex(steps.length - 1);
    setPanelFocusNonce((n) => n + 1);
    if (!isDesktop) setIsSheetOpen(true);
  }, [steps.length, isDesktop]);

  const handleRemoveStep = useCallback(
    (idx: number) => {
      const next = removeStepAt(steps, idx);
      if (next === steps) return;
      setSteps(next);
      // Focus follows the new tail when the removed step was at/before focus;
      // an earlier step still under review keeps its form.
      setActiveStepIndex((current) => (current >= idx ? next.length - 1 : current));
      // The "x" that was just activated has unmounted with its own node.
      setPanelFocusNonce((n) => n + 1);
    },
    [steps],
  );

  if (!isOpen) return null;

  // Truncates subsequent steps when a change occurs at idx
  const updateStepsAndTruncate = (idx: number, newStep: BuilderStep) => {
    const updated = steps.slice(0, idx + 1);
    updated[idx] = newStep;
    setSteps(updated);
  };

  // Commits the active step, appends a fresh action-select fed by its output
  // token, and advances focus to it.
  const commitStepAndAdvance = (updatedStep: BuilderStep, tokenOut: TokenState) => {
    const updated = steps.slice(0, activeStepIndex + 1);
    updated[activeStepIndex] = updatedStep;
    updated.push({ kind: 'action-select', tokenIn: tokenOut });
    setSteps(updated);
    setActiveStepIndex(activeStepIndex + 1);
    // The confirm button the user just pressed unmounts with its config card.
    setPanelFocusNonce((n) => n + 1);
  };

  // Step event handlers
  // SourceCard emits on every valid keystroke, so focus deliberately stays on
  // the root while it is being edited (advancing would unmount the form
  // mid-typing). The root's "+" port / the panel's "Choose next action" CTA
  // move focus to the palette.
  const handleSourceSelect = (tokenOut: TokenState) => {
    const newStep: BuilderStep = { kind: 'source', tokenOut };
    setSteps([newStep, { kind: 'action-select', tokenIn: tokenOut }]);
  };

  const handleActionSelect = (action: ActionType) => {
    const next = appendStepOfKind(steps, action);
    if (next === steps) return;
    setSteps(next);
    setActiveStepIndex(next.length - 1);
    // The palette row that was just activated unmounts with the palette.
    setPanelFocusNonce((n) => n + 1);
  };

  const handleDepositSelect = (destination: DepositDestination) => {
    const currentStep = steps[activeStepIndex];
    if (currentStep.kind !== 'deposit') return;

    const updatedStep: BuilderStep = { ...currentStep, destination };
    updateStepsAndTruncate(activeStepIndex, updatedStep);
  };

  const handleRepaySelect = (targetPositionId: string) => {
    const currentStep = steps[activeStepIndex];
    if (currentStep.kind !== 'repay') return;

    const updatedStep: BuilderStep = { ...currentStep, targetPositionId };
    updateStepsAndTruncate(activeStepIndex, updatedStep);
  };

  const handleWithdrawConfirm = (tokenOut: TokenState) => {
    const currentStep = steps[activeStepIndex];
    if (currentStep.kind !== 'withdraw') return;

    commitStepAndAdvance({ ...currentStep, tokenOut }, tokenOut);
  };

  const handleRepayAndWithdrawSelect = (targetPositionId: string, tokenOut: TokenState) => {
    const currentStep = steps[activeStepIndex];
    if (currentStep.kind !== 'repayAndWithdraw') return;

    commitStepAndAdvance({ ...currentStep, targetPositionId, tokenOut }, tokenOut);
  };

  const handleBridgeSelect = (
    toChain: ChainId,
    bridgeId: BridgeId,
    feeUsd: number,
    tokenOut: TokenState,
  ) => {
    const currentStep = steps[activeStepIndex];
    if (currentStep.kind !== 'bridge') return;

    commitStepAndAdvance({ ...currentStep, toChain, bridgeId, feeUsd, tokenOut }, tokenOut);
  };

  const handleSwapSelect = (toToken: string, feeUsd: number, tokenOut: TokenState) => {
    const currentStep = steps[activeStepIndex];
    if (currentStep.kind !== 'swap') return;

    commitStepAndAdvance({ ...currentStep, toToken, feeUsd, tokenOut }, tokenOut);
  };

  const handleExecute = async () => {
    if (!canSubmit(steps)) return;
    setIsExecuting(true);
    setExecuteError(null);

    try {
      const activeAddress = address || DEMO_WALLET_ADDRESS;
      const customPlan = builderStepsToSequencePlan(steps, activeAddress, positions);

      const plan = await createPlan('custom', { customPlan });
      onClose();
      router.push(`/sequence/${plan.id}`);
    } catch (e) {
      console.error(e);
      // createPlan throws an Error carrying the server's message — surface it.
      setExecuteError(e instanceof Error ? e.message : 'Failed to execute sequence.');
    } finally {
      setIsExecuting(false);
    }
  };

  const sidePanel = (
    <SidePanel
      steps={steps}
      activeStepIndex={activeStepIndex}
      userPositions={positions}
      focusNonce={panelFocusNonce}
      onFocusStep={handleStepFocus}
      onFocusPalette={handleFocusPalette}
      onAddAction={handleActionSelect}
      onSourceSelect={handleSourceSelect}
      onDepositSelect={handleDepositSelect}
      onRepaySelect={handleRepaySelect}
      onWithdrawConfirm={handleWithdrawConfirm}
      onRepayAndWithdrawSelect={handleRepayAndWithdrawSelect}
      onBridgeSelect={handleBridgeSelect}
      onSwapSelect={handleSwapSelect}
    />
  );

  // Same predicate SidePanel uses to pick palette-vs-form, spelled once.
  const paletteMode = steps[activeStepIndex]?.kind === 'action-select';
  const sheetLabel = paletteMode ? 'Add step' : 'Configure step';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Custom sequence"
      title="Build a Sequence"
      size="2xl"
      footer={
        <div className="flex flex-col gap-3">
          {executeError && <WarningBanner message={executeError} variant="error" />}
          <SummaryBar
            steps={steps}
            onCancel={onClose}
            onExecute={handleExecute}
            isExecuting={isExecuting}
          />
          {/* React Flow's own badge is hidden (`hideAttribution`), so the MIT
              attribution is discharged here, where users can actually see it. */}
          <p className="text-center text-[11px] text-verdant-text-muted">
            Canvas by{' '}
            <a
              href="https://reactflow.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-verdant-text-primary"
            >
              React Flow
            </a>
          </p>
        </div>
      }
    >
      <div className="relative flex h-[clamp(420px,60dvh,640px)] gap-4">
        <SequenceCanvas
          className="min-w-0 flex-1"
          steps={steps}
          activeStepIndex={activeStepIndex}
          onFocusStep={handleStepFocus}
          onRemoveStep={handleRemoveStep}
          onFocusPalette={handleFocusPalette}
          onAddAction={handleActionSelect}
        />

        {/* Persistent side panel from `lg` up; below it, a floating trigger and
            an overlay sheet hosting the one and only SidePanel instance. */}
        {isDesktop ? (
          <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-verdant-rule bg-verdant-surface">
            {sidePanel}
          </aside>
        ) : isSheetOpen ? (
          <section
            ref={sheetRef}
            tabIndex={-1}
            aria-label={`${sheetLabel} panel`}
            className="absolute inset-0 z-10 flex flex-col overflow-hidden rounded-2xl border border-verdant-rule bg-verdant-surface shadow-organic-xl focus:outline-none"
          >
            <div className="flex items-center justify-end border-b border-verdant-rule px-2 py-1">
              <CloseButton label="Back to canvas" onClick={() => setIsSheetOpen(false)} />
            </div>
            <div className="min-h-0 flex-1">{sidePanel}</div>
          </section>
        ) : (
          <button
            ref={sheetTriggerRef}
            type="button"
            onClick={() => setIsSheetOpen(true)}
            className="btn btn-primary absolute right-4 bottom-4 shadow-organic-lg"
          >
            <PlusIcon />
            {sheetLabel}
          </button>
        )}
      </div>
    </Modal>
  );
}
