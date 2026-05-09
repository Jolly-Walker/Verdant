import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, arbitrum, base } from 'wagmi/chains'

// Prevent multiple initialization in development (Fast Refresh)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'ca7226feaf9c3e98f09d8aa052bd2b93'

// @ts-expect-error - global property
export const wagmiConfig = globalThis.wagmiConfig || getDefaultConfig({
  appName: 'Verdant',
  projectId,
  chains: [mainnet, arbitrum, base],
  ssr: true,
})

// @ts-expect-error - global property
if (process.env.NODE_ENV !== 'production') globalThis.wagmiConfig = wagmiConfig
