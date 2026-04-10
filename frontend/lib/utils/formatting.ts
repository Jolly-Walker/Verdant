/**
 * Formatting utilities for USD, token amounts, percentages, and addresses.
 */

/**
 * Format a number as USD currency.
 * @example formatUsd(1234.5) => "$1,234.50"
 * @example formatUsd(0.003) => "$0.003"
 */
export function formatUsd(value: number): string {
  if (Math.abs(value) < 0.01 && value !== 0) {
    return `$${value.toFixed(4)}`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format a token amount with appropriate precision.
 * @example formatToken(1234.5678) => "1,234.5678"
 * @example formatToken(0.000001, 6) => "0.000001"
 */
export function formatToken(value: number, decimals: number = 4): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format a decimal as a percentage.
 * @example formatPercent(0.065) => "6.50%"
 * @example formatPercent(0.1234) => "12.34%"
 */
export function formatPercent(decimal: number): string {
  return `${(decimal * 100).toFixed(2)}%`
}

/**
 * Truncate an Ethereum address for display.
 * @example truncateAddress("0x1234567890abcdef1234567890abcdef12345678") => "0x1234...5678"
 */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Format a large number with K/M/B suffixes.
 * @example formatCompact(1500000) => "$1.50M"
 */
export function formatCompactUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return formatUsd(value)
}
