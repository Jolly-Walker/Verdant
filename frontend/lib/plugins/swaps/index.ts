import 'server-only'
import { SwapPlugin } from '../types/swap-plugin'
import { oneinchPlugin } from './oneinch'

export const SWAP_REGISTRY: Record<string, SwapPlugin> = {
  '1inch': oneinchPlugin,
}
