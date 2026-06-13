import { z } from 'zod';
import { ALL_CHAINS } from '@/types/shared';

/** An EVM wallet/contract address (0x + 40 hex chars). */
export const evmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM wallet address');

/** One of the chains the app supports. */
export const chainSchema = z.enum(ALL_CHAINS);
