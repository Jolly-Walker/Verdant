'use client';

interface CloseButtonProps {
  /** Accessible name — e.g. "Close", "Back to canvas". */
  label: string;
  onClick: () => void;
  className?: string;
}

/**
 * The dismiss affordance shared by `Modal`'s header and any panel that overlays
 * it. 44px hit area, 18px glyph; the icon is decorative, `label` names it.
 */
export function CloseButton({ label, onClick, className = '' }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-verdant-text-muted transition-colors hover:bg-verdant-paper-deep/60 hover:text-verdant-text-primary ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
