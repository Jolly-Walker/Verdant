'use client';

import type React from 'react';
import { PlusIcon } from '@/components/ui/PlusIcon';
import { ACTION_DRAG_MIME, type PaletteItem } from '@/lib/sequenceBuilder/canvas';
import type { ActionType } from '@/lib/sequenceBuilder/types';

interface PaletteRowProps {
  item: PaletteItem;
  /** False whenever the trailing step is not an action-select — the row is
   *  still legible, but it must not be a drag source for a step that cannot
   *  be appended. */
  isDraggable: boolean;
  onAdd: (kind: ActionType) => void;
}

const GLYPHS: Record<ActionType, string> = {
  deposit: '↓',
  repay: '↩',
  repayAndWithdraw: '↹',
  bridge: '⇄',
  swap: '⇅',
  withdraw: '↑',
};

export function PaletteRow({ item, isDraggable, onAdd }: PaletteRowProps) {
  const handleDragStart = (e: React.DragEvent<HTMLLIElement>) => {
    e.dataTransfer.setData(ACTION_DRAG_MIME, item.action);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <li
      draggable={isDraggable}
      onDragStart={handleDragStart}
      className="group flex cursor-grab items-center gap-3 rounded-xl border border-transparent py-1.5 pr-1 pl-2 transition-colors duration-150 hover:border-verdant-rule hover:bg-verdant-paper active:cursor-grabbing"
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-verdant-surface-accent font-mono text-sm text-verdant-moss"
      >
        {GLYPHS[item.action]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-verdant-text-primary">{item.label}</div>
        <div className="truncate text-xs text-verdant-text-muted">{item.description}</div>
      </div>
      <button
        type="button"
        onClick={() => onAdd(item.action)}
        aria-label={`Add ${item.label} step`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-verdant-moss transition-colors duration-150 hover:bg-verdant-moss hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-verdant-moss focus-visible:ring-offset-2"
      >
        <PlusIcon />
      </button>
    </li>
  );
}
