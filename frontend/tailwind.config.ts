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

          // Financial Indicators
          profit: '#27AE60', // Nephrite Green (Yields, Success)
          loss: '#C95252', // Muted Brick Red (Losses, Errors, Destructive)
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
        display: ['var(--font-fraunces)', 'Georgia', 'Cambria', 'serif'],
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
