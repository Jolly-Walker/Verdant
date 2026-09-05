'use client';

import {
  Background,
  BackgroundVariant,
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  type Node as FlowNode,
  getBezierPath,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ACTION_DRAG_MIME,
  isActionType,
  isPaletteOpen,
  stepsToGraph,
} from '@/lib/sequenceBuilder/canvas';
import type { ActionType, BuilderStep } from '@/lib/sequenceBuilder/types';
import styles from './canvas.module.css';
import { DepositNode } from './DepositNode';
import { type CanvasNodeData, StepNode } from './StepNode';

type CanvasFlowNode = FlowNode<CanvasNodeData, 'step' | 'deposit'>;
type LabeledFlowEdge = Edge<{ label: string }, 'labeled'>;

/** Default bezier path plus a token-amount pill drawn in DOM (design tokens, not SVG attrs). */
function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<LabeledFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return (
    <>
      <BaseEdge id={id} path={path} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            className="pointer-events-none absolute rounded-full border border-verdant-rule bg-verdant-surface px-2 py-0.5 font-mono text-[10px] tabular-nums text-verdant-text-primary shadow-organic"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// Module-scope so React Flow never sees a fresh object identity per render.
const nodeTypes = { step: StepNode, deposit: DepositNode };
const edgeTypes = { labeled: LabeledEdge };
const FIT_VIEW_OPTIONS = { padding: 0.3, maxZoom: 1 };
// The attribution link is an external, dialog-escaping tab stop inside a modal
// with a focus trap; React Flow is credited in SPECS §16.2 instead.
const PRO_OPTIONS = { hideAttribution: true };

/**
 * Re-fits the viewport whenever the graph's footprint changes — a node added or
 * removed, but also a card that grew (placeholder → metric row → chip) without
 * changing the count. Must live under ReactFlowProvider.
 */
function FitOnGraphChange({ count }: { count: number }) {
  const { fitView } = useReactFlow();
  // Node measurement lands in the store after layout, so subscribe to the
  // measured sizes rather than guessing from `count` alone.
  const measuredKey = useStore((state) => {
    let key = '';
    state.nodeLookup.forEach((node) => {
      key += `${node.measured.width}x${node.measured.height}|`;
    });
    return key;
  });

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // Defer a frame so freshly mounted nodes are measured before fitting.
    const frame = requestAnimationFrame(() => {
      void fitView({ ...FIT_VIEW_OPTIONS, duration: reduce ? 0 : 200 });
    });
    return () => cancelAnimationFrame(frame);
  }, [count, measuredKey, fitView]);
  return null;
}

interface SequenceCanvasProps {
  steps: BuilderStep[];
  activeStepIndex: number;
  onFocusStep: (index: number) => void;
  onRemoveStep: (index: number) => void;
  onFocusPalette: () => void;
  onAddAction: (kind: ActionType) => void;
  className?: string;
}

export function SequenceCanvas({
  steps,
  activeStepIndex,
  onFocusStep,
  onRemoveStep,
  onFocusPalette,
  onAddAction,
  className = '',
}: SequenceCanvasProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const { nodes, edges } = useMemo(() => {
    const graph = stepsToGraph(steps, activeStepIndex);
    const paletteOpen = isPaletteOpen(steps);
    const lastIndex = graph.nodes[graph.nodes.length - 1]?.index;
    const nodes: CanvasFlowNode[] = graph.nodes.map((n) => ({
      id: n.id,
      type: n.isRoot ? 'deposit' : 'step',
      position: { x: n.x, y: n.y },
      draggable: false,
      selectable: false,
      data: {
        step: n.step,
        index: n.index,
        selected: n.selected,
        showAddPort: paletteOpen && n.index === lastIndex,
        onFocus: onFocusStep,
        onRemove: onRemoveStep,
        onFocusPalette,
      },
    }));
    const edges: LabeledFlowEdge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'labeled',
      data: { label: e.label },
    }));
    return { nodes, edges };
  }, [steps, activeStepIndex, onFocusStep, onRemoveStep, onFocusPalette]);

  // dragenter/dragleave fire for every descendant the pointer crosses, and
  // WebKit reports `relatedTarget: null` on dragleave — count depth instead of
  // inspecting the target, or the hint flickers mid-canvas.
  const dragDepth = useRef(0);

  const endDrag = () => {
    dragDepth.current = 0;
    setIsDragOver(false);
  };

  const handleDragEnter = () => {
    dragDepth.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Accept unconditionally: some engines hide custom MIME types from
    // `dataTransfer.types` during dragover, and without preventDefault the
    // canvas is not a drop target at all. `handleDrop` re-validates the payload.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = () => {
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) endDrag();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    endDrag();
    const kind = e.dataTransfer.getData(ACTION_DRAG_MIME);
    if (isActionType(kind)) onAddAction(kind);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-[box-shadow,border-color] duration-200 ${
        isDragOver ? 'border-verdant-moss ring-2 ring-verdant-moss/30' : 'border-verdant-rule'
      } ${className}`}
    >
      <ReactFlowProvider>
        <ReactFlow
          className={styles.flow}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          elementsSelectable={false}
          fitView
          fitViewOptions={FIT_VIEW_OPTIONS}
          minZoom={0.4}
          maxZoom={1.5}
          // The canvas lives inside a scrollable dialog: `panOnScroll` swallows
          // every wheel event (its handler ignores `preventScrolling`), which
          // strands the dialog whenever the pointer sits over the canvas. Pan
          // is drag-only instead, and `preventScrolling={false}` leaves a plain
          // wheel to the modal body while ctrl/pinch still zooms.
          panOnScroll={false}
          preventScrolling={false}
          zoomOnDoubleClick={false}
          deleteKeyCode={null}
          nodeOrigin={[0, 0.5]}
          proOptions={PRO_OPTIONS}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
          <FitOnGraphChange count={nodes.length} />
        </ReactFlow>
      </ReactFlowProvider>
      {isDragOver && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="rounded-full bg-verdant-pine px-3 py-1 font-mono text-[11px] text-verdant-glacial shadow-organic">
            Drop to add step
          </span>
        </div>
      )}
    </div>
  );
}
