import { ChainId } from '@/types/shared'
import { DepositDestination } from './types'

export const DEPOSIT_DESTINATIONS: DepositDestination[] = [
  // Ethereum
  { id: 'aave-usdc-eth',            protocol: 'aave',   chain: 'ethereum', token: 'USDC',   apy: 0.042, displayName: 'Aave V3 — USDC',              outputTokenSymbol: 'aUSDC',         apyType: 'variable' },
  { id: 'aave-weth-eth',            protocol: 'aave',   chain: 'ethereum', token: 'WETH',   apy: 0.018, displayName: 'Aave V3 — WETH',              outputTokenSymbol: 'aWETH',         apyType: 'variable' },
  { id: 'aave-wbtc-eth',            protocol: 'aave',   chain: 'ethereum', token: 'WBTC',   apy: 0.011, displayName: 'Aave V3 — WBTC',              outputTokenSymbol: 'aWBTC',         apyType: 'variable' },
  { id: 'morpho-gauntlet-usdc-eth', protocol: 'morpho', chain: 'ethereum', token: 'USDC',   apy: 0.071, displayName: 'Morpho — Gauntlet USDC',      outputTokenSymbol: 'gauntletUSDC',  apyType: 'variable' },
  { id: 'morpho-steakhouse-usdc-eth',protocol:'morpho', chain: 'ethereum', token: 'USDC',   apy: 0.065, displayName: 'Morpho — Steakhouse USDC',    outputTokenSymbol: 'steakUSDC',     apyType: 'variable' },
  { id: 'morpho-re7-weth-eth',      protocol: 'morpho', chain: 'ethereum', token: 'WETH',   apy: 0.034, displayName: 'Morpho — Re7 WETH',           outputTokenSymbol: 're7WETH',       apyType: 'variable' },
  { id: 'euler-usdc-eth',           protocol: 'euler',  chain: 'ethereum', token: 'USDC',   apy: 0.059, displayName: 'Euler V2 — USDC',             outputTokenSymbol: 'eUSDC',         apyType: 'variable' },
  { id: 'euler-weth-eth',           protocol: 'euler',  chain: 'ethereum', token: 'WETH',   apy: 0.028, displayName: 'Euler V2 — WETH',             outputTokenSymbol: 'eWETH',         apyType: 'variable' },

  // Arbitrum
  { id: 'aave-usdc-arb',            protocol: 'aave',   chain: 'arbitrum', token: 'USDC',   apy: 0.044, displayName: 'Aave V3 — USDC',              outputTokenSymbol: 'aUSDC',         apyType: 'variable' },
  { id: 'aave-weth-arb',            protocol: 'aave',   chain: 'arbitrum', token: 'WETH',   apy: 0.019, displayName: 'Aave V3 — WETH',              outputTokenSymbol: 'aWETH',         apyType: 'variable' },
  { id: 'morpho-gauntlet-usdc-arb', protocol: 'morpho', chain: 'arbitrum', token: 'USDC',   apy: 0.068, displayName: 'Morpho — Gauntlet USDC',      outputTokenSymbol: 'gauntletUSDC',  apyType: 'variable' },
  { id: 'euler-usdc-arb',           protocol: 'euler',  chain: 'arbitrum', token: 'USDC',   apy: 0.057, displayName: 'Euler V2 — USDC',             outputTokenSymbol: 'eUSDC',         apyType: 'variable' },

  // Base
  { id: 'aave-usdc-base',           protocol: 'aave',   chain: 'base',     token: 'USDC',   apy: 0.041, displayName: 'Aave V3 — USDC',              outputTokenSymbol: 'aUSDC',         apyType: 'variable' },
  { id: 'morpho-gauntlet-usdc-base',protocol: 'morpho', chain: 'base',     token: 'USDC',   apy: 0.068, displayName: 'Morpho — Gauntlet USDC',      outputTokenSymbol: 'gauntletUSDC',  apyType: 'variable' },
  { id: 'morpho-usdc-base',         protocol: 'morpho', chain: 'base',     token: 'USDC',   apy: 0.062, displayName: 'Morpho — USDC Core',          outputTokenSymbol: 'mUSDC',         apyType: 'variable' },
  { id: 'euler-usdc-base',          protocol: 'euler',  chain: 'base',     token: 'USDC',   apy: 0.055, displayName: 'Euler V2 — USDC',             outputTokenSymbol: 'eUSDC',         apyType: 'variable' },
  { id: 'euler-weth-base',          protocol: 'euler',  chain: 'base',     token: 'WETH',   apy: 0.024, displayName: 'Euler V2 — WETH',             outputTokenSymbol: 'eWETH',         apyType: 'variable' },
]

export function getDepositDestinations(token: string, chain: ChainId): DepositDestination[] {
  return DEPOSIT_DESTINATIONS.filter(d => d.token === token && d.chain === chain)
    .sort((a, b) => b.apy - a.apy)  // highest APY first
}
