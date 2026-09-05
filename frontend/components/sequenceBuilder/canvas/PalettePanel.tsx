'use client';

import { useState } from 'react';
import {
  getPaletteItems,
  isPaletteOpen,
  type PaletteFilter,
  visiblePaletteFilters,
} from '@/lib/sequenceBuilder/canvas';
import type { ActionType, BuilderStep } from '@/lib/sequenceBuilder/types';
import type { Position } from '@/types/position';
import { PaletteRow } from './PaletteRow';

interface PalettePanelProps {
  steps: BuilderStep[];
  userPositions: Position[];
  onAddAction: (kind: ActionType) => void;
}

/**
 * Filter chips + the addable-action rows for the trailing action-select.
 * `SidePanel` only mounts this while the palette is open, so a closed palette
 * (`getPaletteItems` → `null`) is not a state this component renders.
 */
export function PalettePanel({ steps, userPositions, onAddAction }: PalettePanelProps) {
  const [filter, setFilter] = useState<PaletteFilter>('all');
  const { chips, effectiveFilter, visible } = visiblePaletteFilters(
    getPaletteItems(steps, userPositions) ?? [],
    filter,
  );
  const paletteOpen = isPaletteOpen(steps);

  return (
    <div className="flex h-full flex-col">
      {/* A labelled group so AT announces what the pressed chips filter.
          `<fieldset>`/`<legend>` rather than role="group" — Biome's
          useSemanticElements prefers the element over the ARIA role. */}
      <fieldset className="flex flex-wrap gap-2 px-4 pt-4">
        <legend className="sr-only">Filter actions</legend>
        {chips.map((chip) => (
          <button
            type="button"
            key={chip.id}
            onClick={() => setFilter(chip.id)}
            aria-pressed={chip.id === effectiveFilter}
            className={`min-h-[36px] whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 ${
              chip.id === effectiveFilter
                ? 'bg-verdant-moss text-white'
                : 'border border-verdant-rule bg-verdant-surface text-verdant-text-muted hover:bg-verdant-surface-accent hover:text-verdant-text-primary'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </fieldset>

      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="fl-eyebrow">Actions</span>
        <span className="font-mono text-[11px] tabular-nums text-verdant-text-muted">
          {visible.length}
        </span>
      </div>

      {visible.length > 0 ? (
        <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {visible.map((item) => (
            <PaletteRow
              key={item.action}
              item={item}
              isDraggable={paletteOpen}
              onAdd={onAddAction}
            />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-8 text-center text-xs text-verdant-text-muted">
          No valid actions available.
        </p>
      )}

      <p className="border-t border-verdant-rule px-4 py-2.5 text-[11px] text-verdant-text-muted">
        Press <span className="font-semibold text-verdant-text-primary">+</span> or drag a row onto
        the canvas.
      </p>
    </div>
  );
}
