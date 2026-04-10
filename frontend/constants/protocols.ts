import { Protocol } from '@/types/protocol'
import { Chain } from '@/types/chain'

export interface ProtocolConfig {
  name: Protocol
  displayName: string
  chains: Chain[]
  /** Defillama project slug used for APY lookups */
  defillamaSlug: string
  /** Pool/vault addresses per chain */
  poolAddresses: Partial<Record<Chain, string>>
  /** Brief description for UI */
  description: string
}

export const PROTOCOL_CONFIG: Record<Protocol, ProtocolConfig> = {
  aave: {
    name: 'aave',
    displayName: 'Aave V3',
    chains: ['ethereum', 'arbitrum'],
    defillamaSlug: 'aave-v3',
    poolAddresses: {
      ethereum: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      arbitrum: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    },
    description: 'Decentralised lending and borrowing protocol',
  },
  morpho: {
    name: 'morpho',
    displayName: 'Morpho',
    chains: ['ethereum', 'arbitrum'],
    defillamaSlug: 'morpho-blue',
    poolAddresses: {
      ethereum: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
      arbitrum: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    },
    description: 'Optimised lending with MetaMorpho vaults',
  },
  pendle: {
    name: 'pendle',
    displayName: 'Pendle',
    chains: ['ethereum', 'arbitrum'],
    defillamaSlug: 'pendle',
    poolAddresses: {
      ethereum: '0x888888888889758F76e7103c6CbF23ABbF58F946',
      arbitrum: '0x888888888889758F76e7103c6CbF23ABbF58F946',
    },
    description: 'Yield tokenisation and fixed-rate yields',
  },
  euler: {
    name: 'euler',
    displayName: 'Euler',
    chains: ['ethereum', 'arbitrum'],
    defillamaSlug: 'euler',
    poolAddresses: {
      ethereum: '0x27182842E098f60e3D576794A5bFFb0777E025d3',
      arbitrum: '0x27182842E098f60e3D576794A5bFFb0777E025d3',
    },
    description: 'Modular lending via Euler Vault Kit',
  },
}

/** All supported protocols as array */
export const PROTOCOL_LIST: Protocol[] = ['aave', 'morpho', 'pendle', 'euler']

/** Token configuration */
export interface TokenConfig {
  symbol: string
  name: string
  decimals: number
  coingeckoId: string
  addresses: {
    ethereum: string
    arbitrum: string
  }
}

export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    coingeckoId: 'usd-coin',
    addresses: {
      ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    },
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    coingeckoId: 'tether',
    addresses: {
      ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    },
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    coingeckoId: 'weth',
    addresses: {
      ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    },
  },
  WBTC: {
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    coingeckoId: 'wrapped-bitcoin',
    addresses: {
      ethereum: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      arbitrum: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    },
  },
  wstETH: {
    symbol: 'wstETH',
    name: 'Wrapped Lido Staked Ether',
    decimals: 18,
    coingeckoId: 'wrapped-steth',
    addresses: {
      ethereum: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
      arbitrum: '0x5979D7b546E38E414F7E9822514be443A4800529',
    },
  },
}

/** Flat list of supported asset symbols (uppercase) */
export const SUPPORTED_ASSET_SYMBOLS = Object.keys(SUPPORTED_TOKENS)
