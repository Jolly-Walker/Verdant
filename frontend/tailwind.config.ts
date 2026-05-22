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
