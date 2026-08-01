'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { useWallet } from '@/hooks/useWallet';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Positions' },
  { href: '/harvest', label: 'Harvest' },
];

/**
 * Shared sticky app header. Desktop: wordmark + inline nav + actions.
 * Mobile: condensed bar with a disclosure panel (two nav items don't
 * warrant a drawer). Pass `onSequence` to show the primary CTA.
 */
export function AppHeader({ onSequence }: { onSequence?: () => void }) {
  const { disconnect } = useWallet();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLink = (href: string, label: string, mobile = false) => {
    const isCurrent = pathname === href;
    const base = mobile ? 'flex min-h-[44px] items-center px-1 text-base' : 'text-sm px-1 py-2';
    return (
      <Link
        key={href}
        href={href}
        aria-current={isCurrent ? 'page' : undefined}
        onClick={() => setMenuOpen(false)}
        className={`${base} font-medium transition-colors ${
          isCurrent
            ? 'text-verdant-pine underline decoration-verdant-teak decoration-2 underline-offset-8'
            : 'text-verdant-text-muted hover:text-verdant-text-primary'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-verdant-rule bg-verdant-paper/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="fl-serif text-xl text-verdant-pine">
            Verdant
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => navLink(l.href, l.label))}
          </nav>
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 md:flex">
          {onSequence && (
            <button type="button" onClick={onSequence} className="btn btn-primary btn-sm">
              Sequence
            </button>
          )}
          <ConnectButton />
          <button type="button" onClick={() => disconnect()} className="btn btn-ghost btn-sm">
            Disconnect
          </button>
        </div>

        {/* Mobile actions: primary CTA stays visible; the rest folds away */}
        <div className="flex items-center gap-2 md:hidden">
          {onSequence && (
            <button type="button" onClick={onSequence} className="btn btn-primary btn-sm">
              Sequence
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="grid h-11 w-11 place-items-center rounded-lg text-verdant-text-primary transition-colors hover:bg-verdant-paper-deep/60"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="border-t border-verdant-rule px-4 pb-4 md:hidden">
          <nav aria-label="Primary" className="flex flex-col divide-y divide-verdant-rule/70">
            {NAV_LINKS.map((l) => navLink(l.href, l.label, true))}
          </nav>
          <div className="mt-3 flex flex-col gap-3 border-t border-verdant-rule/70 pt-4">
            <ConnectButton />
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                disconnect();
              }}
              className="btn btn-ghost min-h-[44px] justify-start px-1"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
