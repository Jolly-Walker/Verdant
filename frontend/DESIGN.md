1. Design Philosophy
Verdant Capital merges the organic, sustained growth of nature with high-tech decentralized finance. Our interface is strictly light-themed, utilizing generous whitespace ("fresh water") to make complex cross-chain routing, APY calculations, and portfolio management feel effortless and transparent.

Core Principles:

Organic Authority: Avoid harsh, artificial colors. We do not use pure #000000 or default neon UI colors. Everything is rooted in nature.

Crisp Legibility: Contrast is king. Financial data must be instantly readable and heavily prioritized.

Depth through Light: Since there is no dark mode, we rely on subtle background tints (Canvas) and crisp white surface cards to create visual hierarchy.

1. Color Palette (Earthy Technologist)
These colors are mapped directly to our Tailwind configuration to maintain strict consistency across the application.

Brand & Primary (The Forest & Wood)
Moss Primary (#2D6A4F): Used for primary actions (e.g., "Execute Sequence", "Connect Wallet"), active states, and brand headers.

Moss Hover (#1B4332): A darker, grounded shade for primary button hover states.

Polished Teak (#8B5A2B): Used for secondary actions, interactive toggles, and drawing attention to non-critical but important UI elements (e.g., template selectors).

Backgrounds & Surfaces (The Water & Air)
Canvas (#FAF9F6 - Linen White): The absolute background of the application (body). It provides a warm, soft base that reduces eye strain compared to blinding white.

Surface (#FFFFFF - Pure White): Used for all Card components (e.g., PositionCard, BorrowCard). Placed on top of the Canvas, it creates immediate elevation.

Surface Accent (#EBF4F1): A very light mint-grey used for table headers or secondary nested cards (like step details inside a SequencePlanView).

Glacial Stream (#74C69D): Soft water accent color for non-interactive highlights, subtle gradients, and "New" badges.

Typography (The Soil)
Organic Black (#1A1614 - Obsidian Wood): Our core high-contrast text. It reads as black but contains a microscopic amount of warm brown to harmonize with the Teak and Canvas. Used for main headings and core numerical values.

Text Muted (#70655D): Used for secondary labels, table headers, and disabled states.

Semantic & Financial Indicators
Financial Profit (#27AE60 - Nephrite Green): Used strictly for positive financial data (positive APY, successful transactions, incoming assets).

Financial Loss (#C95252 - Muted Brick): Replaces harsh red. Provides urgent contrast for impermanent loss, negative balances, high slippage, or destructive actions without breaking the natural aesthetic.

1. Typography Guidelines
We utilize the Geist typeface family to balance the organic colors with sharp, tech-forward letterforms.

Sans-Serif (Geist): Used for all headings, body text, buttons, and general UI.

Monospace (Geist Mono): MUST be used for all specific financial data to ensure character widths align vertically in tables.

Examples: Wallet Addresses (0x123...abc), Token Balances (14.532 USDC), APY percentages (12.45%), Transaction hashes.

1. Component Styling Rules
Cards
Background: Always bg-verdant-surface (white).

Border: Subtle teak/gray border (border-[#E5E0D8]).

Shadow: Use a very soft, organic shadow (shadow-organic).

Padding: Generous padding (minimum p-6 for main cards) to let the data breathe.

Buttons
Primary: bg-verdant-moss text-white hover:bg-verdant-moss-dark (No borders).

Secondary: border border-verdant-teak text-verdant-teak hover:bg-verdant-teak hover:text-white bg-transparent.

Radius: Slight rounding (rounded-md or rounded-lg). Do not use fully pill-shaped (rounded-full) buttons to maintain a structured, institutional feel.

Badges & Tags
Use light backgrounds with darker text for subtle categorization.

Example: Protocol tags (Aave, Pendle) should use bg-verdant-surface-accent text-verdant-moss.

1. Tailwind Configuration (tailwind.config.ts)
TypeScript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        verdant: {
          // Brand Colors
          moss: {
            DEFAULT: '#2D6A4F',
            dark: '#1B4332',
          },
          teak: {
            DEFAULT: '#8B5A2B',
            light: '#B07D4A',
          },
          glacial: '#74C69D',

          // Backgrounds & Surfaces
          canvas: '#FAF9F6',
          surface: {
            DEFAULT: '#FFFFFF',
            accent: '#EBF4F1',
          },
          
          // Typography & Core Black
          black: '#1A1614',       // Obsidian Wood 
          text: {
            primary: '#1A1614',   
            muted: '#70655D',
          },
          
          // Financial Indicators
          profit: '#27AE60',      // Nephrite Green (Yields, Success)
          loss: '#C95252',        // Muted Brick Red (Losses, Errors, Destructive)
        }
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
      boxShadow: {
        'organic': '0 4px 20px -4px rgba(26, 22, 20, 0.05)',
        'organic-lg': '0 10px 30px -4px rgba(26, 22, 20, 0.08)',
      }
    },
  },
  plugins: [],
};
export default config;
6. Implementation Checklist for Developers
When building or refactoring UI components, verify the following:

[ ] Is the main app background using bg-verdant-canvas?

[ ] Are data cards utilizing bg-verdant-surface with shadow-organic?

[ ] Are all financial numbers, percentages, and wallet hashes wrapped in <span className="font-mono">?

[ ] Are standard texts using text-verdant-text-primary instead of standard tailwind text-black?

[ ] Are negative numbers, high gas fees, and errors using text-verdant-loss?

[ ] Are positive yields and successful states using text-verdant-profit?
