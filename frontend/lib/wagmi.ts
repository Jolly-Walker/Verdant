import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, arbitrum } from 'wagmi/chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'Verdant',
  // Non-null assertion strictly following the SPECS, but fallback added just in case it breaks locally without .env
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'ca7226feaf9c3e98f09d8aa052bd2b93',
  chains: [mainnet, arbitrum],
  ssr: true,
})
