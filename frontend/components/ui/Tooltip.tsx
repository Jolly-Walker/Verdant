import type React from 'react';
import { cloneElement, isValidElement, useId, useState } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  className?: string;
}

export function Tooltip({ children, content, className = '' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  // Callers pass `content=""` when they have nothing to say (e.g. PositionCard's
  // harvest button when the threshold is met). Nothing renders and no description
  // is attached, so assistive tech never sees an empty bubble or a dangling IDREF.
  const shown = visible && content.trim().length > 0;
  const describedBy = shown ? tooltipId : undefined;

  // `aria-describedby` on the generic wrapper is not conveyed by screen readers,
  // so put it on the trigger itself whenever `children` is a single element (the
  // common case: a button). Anything else — text, fragments, lists — falls back
  // to the wrapper, which is at least a correct programmatic relationship.
  const isElementChild = isValidElement<{ 'aria-describedby'?: string }>(children);
  const trigger = isElementChild
    ? cloneElement(children, {
        'aria-describedby':
          [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
      })
    : children;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-only wrapper that toggles a supplementary tooltip; it is not an interactive control, and no ARIA role fits without misrepresenting its semantics (the tooltip itself carries role="tooltip", and the description is wired to the trigger)
    <div
      className={`relative inline-flex ${className}`}
      aria-describedby={isElementChild ? undefined : describedBy}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {trigger}
      {shown && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none z-50">
          <div
            id={tooltipId}
            role="tooltip"
            className="bg-verdant-black text-verdant-canvas text-xs rounded-lg px-3 py-1.5 whitespace-nowrap border border-verdant-black shadow-lg"
          >
            {content}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-verdant-black" />
          </div>
        </div>
      )}
    </div>
  );
}
