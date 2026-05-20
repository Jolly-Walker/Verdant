import { ChainId } from '@/types/shared'

export interface TokenConfig {
  symbol: string
  name: string
  decimals: number
  coingeckoId: string
  addresses: Partial<Record<ChainId, string>>
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
      base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      solana: 'EPjFW3F2KVq7V8iMsyqqzFuU6CHqL76vAndFmXGLh6rk',
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
      solana: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
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
      base: '0x4200000000000000000000000000000000000006',
      solana: '7vf7Nm1sRUXS78ndY7idS2o2QjhKQY4h6iH8E4fQUyEc',
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
      solana: '3NZ9J7P67mR27mN6w3EeymFcyHstC997S8z8U9',
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
      base: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452',
    },
  },
  cbETH: {
    symbol: 'cbETH',
    name: 'Coinbase Staked ETH',
    decimals: 18,
    coingeckoId: 'coinbase-wrapped-staked-eth',
    addresses: {
      ethereum: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704',
      base: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    },
  },
  LINK: {
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    coingeckoId: 'chainlink',
    addresses: {
      ethereum: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      arbitrum: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
      base: '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196',
    },
  },
  'PT-eETH': {
    symbol: 'PT-eETH',
    name: 'Pendle PT eETH',
    decimals: 18,
    coingeckoId: 'pendle-pt-eeth',
    addresses: {
      ethereum: '0x35D1A6fD38F0839e3F9329C356391d4e0258B0A8',
    },
  },
  'PT-USDC': {
    symbol: 'PT-USDC',
    name: 'Pendle PT USDC',
    decimals: 6,
    coingeckoId: 'pendle-pt-usdc',
    addresses: {
      ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Using real USDC address as mock
      arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Using real USDC address as mock
    },
  },
}

export const SUPPORTED_ASSET_SYMBOLS = Object.keys(SUPPORTED_TOKENS)
