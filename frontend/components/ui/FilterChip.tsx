import type React from 'react';

interface FilterChipProps {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

/** Toggle-style filter chip (`aria-pressed`) shared by the positions and palette filter rows. */
export function FilterChip({ pressed, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`min-h-[36px] whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        pressed
          ? 'bg-verdant-moss text-white'
          : 'border border-verdant-rule bg-verdant-surface text-verdant-text-muted hover:bg-verdant-surface-accent hover:text-verdant-text-primary'
      }`}
    >
      {children}
    </button>
  );
}
