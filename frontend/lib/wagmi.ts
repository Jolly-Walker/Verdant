import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrum, base, mainnet } from 'viem/chains';

// Prevent multiple initialization in development (Fast Refresh)
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'ca7226feaf9c3e98f09d8aa052bd2b93';

// Cache the config on globalThis so Fast Refresh reuses one instance.
// Named-type cast (per CLAUDE.md): globalThis has no index signature for this property.
const globalForWagmi = globalThis as typeof globalThis & {
  wagmiConfig?: ReturnType<typeof getDefaultConfig>;
};

export const wagmiConfig =
  globalForWagmi.wagmiConfig ||
  getDefaultConfig({
    appName: 'Verdant',
    projectId,
    chains: [mainnet, arbitrum, base],
    ssr: true,
  });

if (process.env.NODE_ENV !== 'production') globalForWagmi.wagmiConfig = wagmiConfig;
