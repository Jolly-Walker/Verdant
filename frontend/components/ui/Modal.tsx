'use client';

import type React from 'react';
import { useEffect, useId, useRef } from 'react';
import { CloseButton } from './CloseButton';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Optional mono eyebrow line above the title (e.g. "Transaction sequence"). */
  eyebrow?: string;
  size?: 'md' | 'lg' | 'xl' | '2xl';
  /** Sticky footer slot — keeps the primary CTA reachable inside the mobile sheet. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const sizeMap: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-5xl',
  '2xl': 'sm:max-w-6xl',
};

/**
 * Tab-order candidates inside the dialog. Elements that are `disabled`, `hidden`,
 * `aria-hidden`, or explicitly removed from the tab order (`tabindex="-1"`, which
 * includes the dialog container itself) are excluded by the selector.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex^="-"])',
]
  .map((selector) => `${selector}:not([hidden]):not([aria-hidden="true"])`)
  .join(',');

/**
 * Shared dialog shell: full-screen sheet below `sm`, centered panel above.
 * Owns backdrop, Escape-to-close, body scroll-lock, and focus management
 * (focus-in on open, Tab trap while open, focus restore on close) so feature
 * modals only provide content and an optional footer.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  eyebrow,
  size = 'md',
  footer,
  children,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  // Callers routinely pass an inline arrow for `onClose`. Reading it through a ref
  // keeps the effect below keyed on `isOpen` alone — otherwise every parent render
  // would tear the effect down and restore focus to the opener mid-dialog.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const active = document.activeElement;
    const previouslyFocused = active instanceof HTMLElement ? active : null;

    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // Move focus in: first focusable control, else the dialog container itself.
    (focusable()[0] ?? dialog).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      // Recomputed per keystroke: dialog content is dynamic (steps unlock, buttons
      // enable) while the dialog is open.
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const outside = !dialog.contains(current);

      if (e.shiftKey) {
        if (current === first || outside) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || outside) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-4">
      {/* Click-outside-to-close only. Deliberately not a focusable control: as a
          <button> it was a silent, unlabelled-in-context stop inside the focus trap.
          It is hidden from assistive tech; the labelled header close button and
          Escape are the keyboard/AT paths out. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-verdant-black/50 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex h-dvh w-full flex-col bg-verdant-surface focus:outline-none sm:h-auto sm:max-h-[85dvh] sm:rounded-2xl sm:border sm:border-verdant-rule sm:shadow-organic-xl ${sizeMap[size]}`}
      >
        <header className="flex items-center justify-between gap-4 border-b border-verdant-rule px-5 py-3.5">
          <div className="min-w-0">
            {eyebrow && <p className="fl-eyebrow">{eyebrow}</p>}
            <h2
              id={titleId}
              className={`fl-serif truncate text-xl text-verdant-pine ${eyebrow ? 'mt-1' : ''}`}
            >
              {title}
            </h2>
          </div>
          <CloseButton label="Close" onClick={onClose} />
        </header>

        <div
          className={`flex-1 overflow-y-auto overscroll-contain px-5 py-5 ${
            footer ? '' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'
          }`}
        >
          {children}
        </div>

        {footer && (
          <footer className="border-t border-verdant-rule bg-verdant-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
