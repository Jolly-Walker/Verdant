import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
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
          // Deep forest tones (evolved): hierarchy, serif accents, the execution spine
          pine: {
            DEFAULT: '#14342B',
            deep: '#0E251E',
          },

          // Backgrounds & Surfaces
          canvas: '#FAF9F6',
          paper: {
            DEFAULT: '#F4F1EA', // warm parchment — secondary canvas
            deep: '#ECE6DA',
          },
          surface: {
            DEFAULT: '#FFFFFF',
            accent: '#EBF4F1',
          },
          // Sepia ledger hairlines (the "Field Ledger" ruling)
          rule: {
            DEFAULT: '#E3DACB',
            strong: '#CBBCA3',
          },

          // Typography & Core Black
          black: '#1A1614', // Obsidian Wood
          text: {
            primary: '#1A1614',
            muted: '#70655D',
          },

          // Financial Indicators — DEFAULT is text-safe (≥4.5:1 on white AND paper);
          // `bright` is for fills, strokes, and meter bands only, never text.
          profit: {
            DEFAULT: '#187443', // 5.8:1 on white, 5.15:1 on paper
            bright: '#27AE60', // Nephrite Green — decorative fills
          },
          loss: {
            DEFAULT: '#AE4343', // 5.7:1 on white; white-on-loss buttons also pass
            bright: '#C95252', // Muted Brick Red — decorative fills
          },
          caution: {
            DEFAULT: '#92610C', // 5.33:1 on white — replaces raw amber-* text
            bright: '#B45309', // decorative fills / meter bands
          },

          // Chain identity tints — the ONLY hue-coded, non-semantic colors in
          // the palette. Each chain's brand hue pulled down to the same muted,
          // low-chroma register as moss/teak so the pills read as almanac map
          // keys rather than SaaS chips. Every value is text-safe (≥4.5:1 on
          // white, on paper, AND on its own /10 tint); use as
          // `text-verdant-chain-x bg-verdant-chain-x/10 border-verdant-chain-x/25`.
          // Never reuse these for state — profit/loss/caution own that.
          chain: {
            ethereum: '#4A5B6E', // slate ink   — 6.97:1 white, 6.18:1 paper
            arbitrum: '#2F6E6B', // verdigris   — 5.89:1 white, 5.22:1 paper
            base: '#585089', // woad indigo — 7.18:1 white, 6.37:1 paper
          },
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
      boxShadow: {
        organic: '0 4px 20px -4px rgba(26, 22, 20, 0.05)',
        'organic-lg': '0 10px 30px -4px rgba(26, 22, 20, 0.08)',
        'organic-xl': '0 28px 60px -24px rgba(20, 52, 43, 0.22)',
      },
    },
  },
  plugins: [],
};
export default config;
