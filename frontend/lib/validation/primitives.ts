import { z } from 'zod';
import { DEMO_WALLET_ADDRESS, isDemoMode } from '@/lib/demo/wallet';
import { ALL_CHAINS } from '@/types/shared';

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * An EVM wallet/contract address (0x + 40 hex chars).
 *
 * Accepts the demo sentinel (`DEMO_WALLET_ADDRESS`) ONLY in demo mode, mirroring
 * `isValidAddress` in lib/utils/chains.ts so the two validators agree — otherwise
 * routes guarded by this schema (e.g. /api/positions) would 400 a demo wallet that
 * the plan/bridge routes (isValidAddress) accept. The sentinel is non-hex, so
 * production (non-demo) stays strict.
 */
export const evmAddressSchema = z
  .string()
  .refine(
    (v) => EVM_ADDRESS_RE.test(v) || (isDemoMode() && v === DEMO_WALLET_ADDRESS),
    'Invalid EVM wallet address',
  );

/** One of the chains the app supports. */
export const chainSchema = z.enum(ALL_CHAINS);

/**
 * Slippage tolerance as a percentage (e.g. `0.5` = 0.5%), bounded to a sane
 * executable range. Rejects NaN/Infinity, negatives, and absurd values — any of
 * which would otherwise produce a negative or inflated (unfillable) bridge
 * `outputAmount` once fed through `applySlippageFloor`.
 */
export const slippagePercentSchema = z.number().finite().min(0).max(50);
