# Verdant — Design Rebrand Implementation

Branch: `demo` (commit directly here, do not branch again)

This ticket converts the entire UI from the current dark zinc theme to the
Verdant light theme defined in `DESIGN.md`. It is a visual-only change. No
logic, no hooks, no types, no API routes are modified. If you find yourself
editing anything outside of `app/globals.css`, `tailwind.config.ts`, and
the `components/` and `app/` TSX files, stop — you are out of scope.

Read `frontend/DESIGN.md` in full before writing a single line. Every
colour decision in this ticket traces back to it.

---

## Step 1 — Update `tailwind.config.ts`

Replace the entire file with the config from `DESIGN.md` section 5, verbatim.
The existing `background`/`foreground` CSS variable colours are removed. The
`verdant` colour namespace is added in their place.

The final config must include:
- `verdant.moss.DEFAULT` = `#2D6A4F`
- `verdant.moss.dark` = `#1B4332`
- `verdant.teak.DEFAULT` = `#8B5A2B`
- `verdant.teak.light` = `#B07D4A`
- `verdant.glacial` = `#74C69D`
- `verdant.canvas` = `#FAF9F6`
- `verdant.surface.DEFAULT` = `#FFFFFF`
- `verdant.surface.accent` = `#EBF4F1`
- `verdant.black` = `#1A1614`
- `verdant.text.primary` = `#1A1614`
- `verdant.text.muted` = `#70655D`
- `verdant.profit` = `#27AE60`
- `verdant.loss` = `#C95252`
- `boxShadow.organic` = `0 4px 20px -4px rgba(26, 22, 20, 0.05)`
- `boxShadow.organic-lg` = `0 10px 30px -4px rgba(26, 22, 20, 0.08)`
- `fontFamily.sans` = `['var(--font-geist-sans)']`
- `fontFamily.mono` = `['var(--font-geist-mono)']`

---

## Step 2 — Update `app/globals.css`

Replace the `:root` block and the dark mode media query entirely:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #FAF9F6;
  --foreground: #1A1614;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: var(--font-geist-sans), Arial, Helvetica, sans-serif;
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

Remove the `@media (prefers-color-scheme: dark)` block entirely — Verdant is
light-only.

---

## Step 3 — UI Primitives

### `components/ui/Card.tsx`

The Card is the foundational surface. Every position card, step card, and
modal panel uses it.

```tsx
export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`bg-verdant-surface border border-[#E5E0D8] rounded-xl p-5 shadow-organic ${
        hover ? 'hover:shadow-organic-lg transition-shadow' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
```

### `components/ui/Badge.tsx`

```tsx
const variantStyles: Record<string, string> = {
  default:  'bg-verdant-surface-accent text-verdant-text-muted border-[#D5E8E0]',
  success:  'bg-verdant-surface-accent text-verdant-profit border-[#A8D5BE]',
  warning:  'bg-amber-50 text-amber-700 border-amber-200',
  error:    'bg-red-50 text-verdant-loss border-red-200',
}
```

### `components/ui/HealthFactor.tsx`

Replace `text-emerald-400` / `text-amber-400` / `text-red-400` with the
semantic palette:

```tsx
let colorClass = 'text-verdant-loss'        // < 1.2 — danger
if (value >= 2.0)      colorClass = 'text-verdant-profit'   // safe
else if (value >= 1.2) colorClass = 'text-amber-600'        // caution
```

The label text changes from `text-zinc-500` to `text-verdant-text-muted`.
The dot indicator uses `bg-verdant-profit`, `bg-amber-600`, `bg-verdant-loss`
to match.

### `components/ui/Spinner.tsx`

Change the spinner ring colour from whatever zinc shade it uses to
`border-verdant-moss` for the active arc and `border-verdant-surface-accent`
for the track.

### `components/ui/Tooltip.tsx`

Tooltip background from `bg-zinc-800 text-white` to
`bg-verdant-black text-verdant-canvas` — readable dark-on-light inversion
for contrast.

### `components/ui/WarningBanner.tsx`

Warning banners: amber variant stays amber, error variant uses
`bg-red-50 border-red-200 text-verdant-loss`.

---

## Step 4 — Position Components

### `components/positions/PositionCard.tsx`

**Outer wrapper:** `bg-verdant-surface border border-[#E5E0D8] rounded-xl p-5
shadow-organic hover:shadow-organic-lg transition-shadow`

**Asset + protocol heading:** `text-xl font-semibold text-verdant-text-primary`

**Chain + type subtext:** `text-sm text-verdant-text-muted capitalize`

**USD value:** `text-xl font-bold text-verdant-text-primary font-mono`

**Token amount:** `text-sm text-verdant-text-muted font-mono`

**APY / Rewards inner panel:** Background changes from `bg-zinc-950/50` to
`bg-verdant-surface-accent`, border to `border-[#D5E8E0]`.

- APY label: `text-xs text-verdant-text-muted uppercase tracking-wider font-semibold`
- APY value: `text-verdant-profit font-medium font-mono` (positive yield is profit)
- Rewards label: same muted style
- Rewards value when > 0: `text-verdant-profit font-medium font-mono`
- Rewards value when 0: `text-verdant-text-muted font-mono`

**"Wallet" type badge:** `text-[10px] bg-verdant-surface-accent
text-verdant-text-muted border border-[#D5E8E0] px-1.5 py-0.5 rounded font-bold
uppercase tracking-wider`

**Protocol tag** (e.g. "on Aave"): same badge style as above.

**Harvest button:** `text-sm bg-verdant-moss hover:bg-verdant-moss-dark
text-white px-4 py-2 rounded-md transition-colors font-medium`

**Manage button:** secondary style — `text-sm border border-verdant-teak
text-verdant-teak hover:bg-verdant-teak hover:text-white bg-transparent
px-4 py-2 rounded-md transition-colors font-medium`

### `components/positions/BorrowCard.tsx`

The borrow card has a red accent in dark mode. In light mode, use a warm
loss-tinted border instead:

**Outer wrapper:** `bg-verdant-surface border border-red-200 rounded-xl p-5
shadow-organic hover:shadow-organic-lg transition-shadow`

**"USDC Debt" heading:** `text-xl font-semibold text-verdant-text-primary`

**"Borrow" badge:** `text-[10px] bg-red-50 text-verdant-loss border
border-red-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider`

**Inner stats panel:** `bg-red-50/60 border border-red-100 rounded-lg p-3`

**Borrow APY value:** `text-verdant-loss font-medium font-mono`

**Multi-collateral warning note:** `text-[11px] text-verdant-text-muted
bg-amber-50 px-2 py-1.5 rounded border border-amber-200`

**De-leverage button:** `text-sm bg-verdant-loss hover:bg-red-700 text-white
px-4 py-2 rounded-md transition-colors font-medium`

**Repay button:** secondary style with teak.

### `components/positions/PendleCard.tsx`

Apply the same Card surface treatment. The PT/YT type badge uses the default
badge style. Fixed APY in `text-verdant-profit font-mono`. Maturity date in
`text-verdant-text-muted font-mono`. The "Exit" button uses the secondary
(teak) button style. If maturity is within 30 days, the maturity value uses
`text-verdant-loss` instead of the muted colour.

### `components/positions/PositionSkeleton.tsx`

Replace `bg-zinc-800` pulse blocks with `bg-verdant-surface-accent` and the
outer container with `bg-verdant-surface border border-[#E5E0D8] rounded-xl
p-5 shadow-organic`.

### `components/positions/PositionTypeFilter.tsx`

Filter pills: inactive state `bg-verdant-surface border border-[#E5E0D8]
text-verdant-text-muted hover:border-verdant-moss`. Active state
`bg-verdant-moss text-white border-verdant-moss`.

---

## Step 5 — Sequence Components

### `components/sequence/SequenceModal.tsx`

**Backdrop:** `bg-verdant-black/40 backdrop-blur-sm` (lighter than current
`bg-black/60` — the light theme backdrop should feel airy, not oppressive)

**Modal card:** `bg-verdant-surface border border-[#E5E0D8] rounded-2xl
shadow-organic-lg` — remove the current `bg-zinc-900`.

**Header:** `border-b border-[#E5E0D8]`

**Title:** `text-xl font-bold text-verdant-text-primary`

**Close button:** `text-verdant-text-muted hover:text-verdant-text-primary
hover:bg-verdant-surface-accent transition-colors p-1 rounded-md`

**Configure Parameters section:** Background from `bg-zinc-950/40` to
`bg-verdant-surface-accent border border-[#D5E8E0] rounded-xl p-6`

**Section heading:** `font-bold text-lg text-verdant-text-primary`

**Form labels:** `text-sm font-medium text-verdant-text-muted`

**Select and input fields:** `w-full bg-verdant-surface border border-[#E5E0D8]
rounded-md p-2 text-verdant-text-primary focus:outline-none
focus:border-verdant-moss transition-colors`

**Create Sequence Plan button:** Primary moss style — `w-full bg-verdant-moss
hover:bg-verdant-moss-dark text-white font-bold py-3 rounded-lg
transition-colors disabled:opacity-50`

**Template selector cards** (in `TemplateSelector.tsx` — restyle in the same
pass): Each template option — unselected: `bg-verdant-surface border
border-[#E5E0D8] rounded-lg p-4 cursor-pointer hover:border-verdant-moss
transition-colors`. Selected: `border-verdant-moss bg-verdant-surface-accent`.
Template name in `text-verdant-text-primary font-semibold`. Description in
`text-verdant-text-muted text-sm`.

### `components/sequence/SequenceStepCard.tsx`

**Card outer:** Current step: `border border-verdant-moss/40 bg-verdant-surface-accent`
Non-current: `border border-[#E5E0D8] bg-verdant-surface`

**Step number bubble:** Confirmed: `bg-verdant-profit/10 text-verdant-profit`.
Current: `bg-verdant-moss text-white`. Pending: `bg-verdant-surface-accent
text-verdant-text-muted border border-[#E5E0D8]`.

**Step label:** Current: `font-semibold text-verdant-text-primary`. Other:
`text-verdant-text-muted`.

**Chain badge:** `text-[10px] text-verdant-text-muted uppercase tracking-widest
bg-verdant-surface-accent px-2 py-0.5 rounded border border-[#E5E0D8]`

**Description text:** `text-verdant-text-muted text-sm`

**"View on Explorer" link:** `text-verdant-moss text-xs hover:underline`

**"Complete" confirmed state:** `text-verdant-profit font-medium` with a
`text-verdant-profit` checkmark.

**"Sign Transaction" button:** Primary moss — `bg-verdant-moss
hover:bg-verdant-moss-dark text-white font-semibold py-2 px-4 rounded-md
transition-colors disabled:opacity-50`

**"Quote Expired" disabled state:** `bg-verdant-loss/80` with `text-white`.

**"Waiting…" state:** `text-verdant-text-muted text-sm`

**"Verified" ready state (non-current):** `text-verdant-profit text-sm`

**Error panel:** `bg-red-50 border border-red-200 rounded-lg` with
`text-verdant-loss text-xs` message and `text-verdant-loss font-bold
hover:underline` retry link.

### `components/sequence/SequencePlanView.tsx`

**Page background:** The `py-12 px-6` wrapper needs no explicit background —
it inherits `bg-verdant-canvas` from the body.

**Plan title:** `text-2xl font-bold text-verdant-text-primary`

**Subtext (created date, cost):** `text-verdant-text-muted` with the cost
value in `text-verdant-text-primary font-semibold font-mono`

**Expired quotes banner:** `bg-red-50 border border-red-200 rounded-lg` with
`text-verdant-loss text-sm` message. Refresh button:
`bg-verdant-loss hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm`

**Cancel link:** `text-sm text-verdant-text-muted hover:text-verdant-text-primary
transition-colors`

### `components/sequence/SequenceProgress.tsx`

The progress stepper: completed steps use `text-verdant-profit` and a filled
`bg-verdant-profit` indicator. Current step uses `text-verdant-moss` and
`bg-verdant-moss`. Pending steps use `text-verdant-text-muted` and
`bg-verdant-surface-accent border border-[#E5E0D8]`. Connector lines between
steps: completed segment in `bg-verdant-profit`, pending in `bg-[#E5E0D8]`.

### `components/sequence/SequenceComplete.tsx`

**Success icon circle:** `bg-verdant-profit/10 border-2 border-verdant-profit`
with `text-verdant-profit` checkmark.

**Heading:** `text-3xl font-bold text-verdant-text-primary`

**Subtext:** `text-verdant-text-muted`

**Summary card:** `bg-verdant-surface border border-[#E5E0D8] shadow-organic
divide-y divide-[#E5E0D8]` with labels in `text-verdant-text-muted` and
values in `text-verdant-text-primary font-semibold font-mono`.

**"View Tx" links:** `text-verdant-moss hover:text-verdant-moss-dark font-medium`

**"Back to Dashboard" button:** Primary moss style.

---

## Step 6 — Execute / Cost Components

### `components/execute/CostPreview.tsx`

**Loading state card:** `bg-verdant-surface border border-[#E5E0D8]
shadow-organic`. Spinner uses moss colour. Loading text:
`text-verdant-text-muted`.

**Error state card:** `bg-verdant-surface border border-red-200 shadow-organic`.
Error message: `text-verdant-loss text-sm`. Retry button: secondary teak style.

**Results card:** `bg-verdant-surface border border-[#E5E0D8] shadow-organic`

**Section heading ("Cost Preview"):** `text-lg font-semibold text-verdant-text-primary`

**Per-step rows:**
- Step label: `text-verdant-text-primary text-sm font-medium`
- Gas cost: `text-verdant-text-muted font-mono text-sm`
- Bridge fee: `text-verdant-text-primary font-mono text-sm`
- HIGH FEE badge: `bg-red-50 text-verdant-loss border border-red-200`
- Stale indicator: `text-amber-600`
- Expired indicator: `text-verdant-loss`

**Totals row:** Separator `border-[#E5E0D8]`. Total label
`text-verdant-text-primary font-semibold`. Total value
`text-verdant-text-primary font-bold font-mono`.

**Break-even block:** Background `bg-verdant-surface-accent border
border-[#D5E8E0] rounded-lg`. Yield gain value: `text-verdant-profit
font-mono`. Break-even days: `text-verdant-text-primary font-mono font-semibold`.

**Stale quote warning:** `bg-amber-50 border border-amber-200` with
`text-amber-700`. Refresh button: `text-verdant-moss hover:text-verdant-moss-dark
font-medium text-sm`.

### `components/execute/SimulationResult.tsx`

**Success state:** `bg-verdant-surface-accent border border-[#D5E8E0]
rounded-lg`. "Simulation passed" text: `text-verdant-profit font-semibold`.
State changes list: labels `text-verdant-text-muted text-sm`, values
`text-verdant-text-primary font-mono text-sm`.

**Failure state:** `bg-red-50 border border-red-200 rounded-lg`. Revert reason:
`text-verdant-loss text-sm font-mono`.

**Warning banners (amber):** `bg-amber-50 border border-amber-200 text-amber-700`
with the acknowledgment checkbox accent colour `accent-verdant-moss`.

### `components/execute/BridgeQuoteSelector.tsx`

**Quote option cards:** Unselected `bg-verdant-surface border border-[#E5E0D8]
rounded-lg`. Selected `border-verdant-moss bg-verdant-surface-accent`.

**Bridge name:** `text-verdant-text-primary font-semibold`

**Fee:** `text-verdant-text-primary font-mono`

**HIGH FEE badge:** `bg-red-50 text-verdant-loss border border-red-200`

**Time estimate:** `text-verdant-text-muted text-sm`

### `components/execute/StepOneBridge.tsx`

Apply Card surface. Inputs and selects use the same form field style as
SequenceModal (white background, `border-[#E5E0D8]`, moss focus ring).
Primary action button uses moss primary style.

### `components/execute/AssetSelector.tsx`

Same form field treatment. Asset option rows: hover state
`hover:bg-verdant-surface-accent`. Selected state
`bg-verdant-surface-accent border-verdant-moss`.

---

## Step 7 — Harvest Components

### `components/harvest/RewardsList.tsx`

Apply Card surface for each reward row. Reward token name:
`text-verdant-text-primary font-semibold`. Amount: `text-verdant-profit
font-mono`. USD value: `text-verdant-text-muted font-mono text-sm`.
"No rewards" empty state: `text-verdant-text-muted`.

### `components/harvest/HarvestButton.tsx`

Primary moss button style. Loading / signing states keep the same label
changes but in `bg-verdant-moss` colour.

---

## Step 8 — Wallet Components

### `components/wallet/ConnectButton.tsx`

The RainbowKit `ConnectButton` renders its own styled button. Wrap or override
with: `bg-verdant-moss hover:bg-verdant-moss-dark text-white font-semibold
px-4 py-2 rounded-md transition-colors`.

If the ConnectButton component is a thin wrapper around RainbowKit's component
with custom rendering, apply the moss style to the custom render props. If it
is a direct `<ConnectButton />` passthrough, leave the RainbowKit default — do
not fight the library's own styling.

### `components/wallet/SolanaConnectButton.tsx`

Same moss primary style as above.

---

## Step 9 — App Pages

### `app/globals.css` and `app/layout.tsx`

`layout.tsx` needs no changes — it applies fonts and renders `<WalletProvider>`
and children. The `bg-verdant-canvas` comes from the `globals.css` body rule.

### `app/page.tsx` (landing)

**Page background:** Remove `flex min-h-screen` dark treatment. The page
inherits `bg-verdant-canvas` from body.

**Heading "Verdant":** `text-5xl font-bold tracking-tight text-verdant-text-primary`

**Tagline:** `text-lg text-verdant-text-muted`

**"Try Demo" button (demo mode):** Primary moss — `bg-verdant-moss
hover:bg-verdant-moss-dark text-white font-semibold px-6 py-3 rounded-lg
transition-colors`

**"Connect Wallet" button:** Same primary moss style (via ConnectButton).

**"Enter Debug Mode" link:** `text-sm text-verdant-text-muted
hover:text-verdant-text-primary underline underline-offset-4 transition-colors`

### `app/dashboard/page.tsx`

**Page wrapper:** `min-h-screen bg-verdant-canvas text-verdant-text-primary`

**Header:** `border-b border-[#E5E0D8] bg-verdant-surface/80 backdrop-blur-sm
sticky top-0 z-10` — the surface-white sticky header contrasts cleanly against
the canvas background.

**"Verdant" brand in header:** `text-xl font-bold tracking-tight
text-verdant-text-primary`

**Portfolio value in header:** `text-verdant-text-muted` label,
`text-verdant-text-primary font-semibold font-mono` value.

**Claimable rewards in header:** `text-verdant-text-muted` label,
`text-verdant-profit font-semibold font-mono` value.

**"Sequence" header button:** Primary moss style.

**"Disconnect" link:** `text-sm text-verdant-text-muted
hover:text-verdant-loss transition-colors`

**"Your Positions" section heading:** `text-xl font-semibold
text-verdant-text-primary`

**"Refresh" button:** Secondary teak style but smaller — `text-sm border
border-[#E5E0D8] text-verdant-text-muted hover:border-verdant-moss
hover:text-verdant-moss px-3 py-1.5 rounded-lg border transition-colors`

**Error banner:** `bg-amber-50 border border-amber-200 text-amber-700 text-sm
px-4 py-3 rounded-lg`

**Demo mode banner:** `bg-verdant-surface-accent border border-[#D5E8E0]
rounded-lg text-sm text-verdant-text-muted` with
`text-verdant-moss font-semibold` for the "Demo Mode" label.

### `app/sequence/page.tsx` (full-page sequence setup fallback)

Apply the same form field and Card surface treatments as SequenceModal. Page
background inherits canvas. Page heading `text-verdant-text-primary`.

### `app/sequence/[planId]/page.tsx`

Page background inherits canvas. Loading state uses `text-verdant-text-muted`.
Error state uses `text-verdant-loss`.

### `app/harvest/page.tsx`

Page heading `text-verdant-text-primary`. Apply Card surface to harvest panels.

---

## Typographic rules — apply everywhere

These are mechanical rules, not component-specific. Apply them globally as you
restyle each component:

1. **All financial numbers** (USD values, APY percentages, token amounts,
   tx hashes, wallet addresses) must be wrapped in `font-mono` or have the
   `font-mono` class on their element.

2. **Positive financial values** (yields, rewards, profits, successful
   simulation) use `text-verdant-profit`.

3. **Negative financial values** (borrow costs, losses, errors, high fees,
   health factor danger) use `text-verdant-loss`.

4. **Primary text** (headings, card titles, important labels) uses
   `text-verdant-text-primary`.

5. **Secondary text** (sublabels, metadata, timestamps, helper text) uses
   `text-verdant-text-muted`.

6. **Never use `text-black`, `text-white` (except on coloured button
   backgrounds), `text-zinc-*`, `text-emerald-*`, or `bg-zinc-*`** in
   any restyled component. These are all remnants of the dark theme.

---

## What not to touch

- All files under `hooks/` — no changes
- All files under `lib/` — no changes
- All files under `app/api/` — no changes
- All files under `types/` — no changes
- All files under `constants/` — no changes
- All files under `supabase/` — no changes
- `lib/utils/formatting.ts` — no changes
- `DESIGN.md`, `AGENTS.md`, `SPECS.md` — no changes

---

## Acceptance checklist

Before marking done, verify each item visually by running the dev server with
`NEXT_PUBLIC_DEMO_MODE=true` and walking the full demo flow.

- [ ] `tailwind.config.ts` contains the full `verdant` colour namespace
- [ ] `globals.css` has no dark mode media query; body background is `#FAF9F6`
- [ ] Landing page: light canvas background, moss Connect Wallet button
- [ ] Dashboard: light header with surface-white sticky bar on canvas background
- [ ] Dashboard: portfolio value and APY in `font-mono`
- [ ] Position cards: white surface cards with organic shadow on canvas
- [ ] Position cards: APY values in `text-verdant-profit font-mono`
- [ ] BorrowCard: red-200 border, loss-coloured borrow APY
- [ ] BorrowCard: De-leverage button in `bg-verdant-loss`
- [ ] SequenceModal: light modal panel, moss Create button, teak-bordered selects
- [ ] TemplateSelector: unselected/selected states use moss accent
- [ ] SequenceStepCard: current step in surface-accent, moss sign button
- [ ] CostPreview: surface card, profit-coloured yield gain, mono font on all numbers
- [ ] SequenceComplete: profit-coloured success icon, moss Back button
- [ ] No `bg-zinc-*`, `text-zinc-*`, `bg-emerald-*`, or `text-emerald-*`
      classes anywhere in components or app pages
- [ ] No `text-white` on any text that sits on a light background
- [ ] All financial numbers in `font-mono`