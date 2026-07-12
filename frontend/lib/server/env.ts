/**
 * Typed, validated access to server-side environment variables.
 *
 * Every key is optional BY DESIGN: integrations fail soft when unconfigured
 * (SPECS — return null / fall back rather than crash). Call sites decide
 * whether a missing var means "feature unavailable" or "throw". What this
 * module guarantees:
 *
 *  - blank strings in .env files count as unset (no more `|| ''` footguns
 *    producing malformed URLs or empty auth headers),
 *  - `getServerEnvOrWarn` logs a one-time warning naming the consequence,
 *    so a missing key is diagnosable from server logs instead of surfacing
 *    as an opaque 401 from a third-party API.
 *
 * NEXT_PUBLIC_* vars are intentionally NOT here: they must be read as
 * literal `process.env.NEXT_PUBLIC_X` expressions for Next.js build-time
 * inlining, and this module is server-only.
 */

import 'server-only';
import { z } from 'zod';

const optionalVar = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v : undefined));

const serverEnvSchema = z.object({
  ALCHEMY_API_KEY_ETHEREUM: optionalVar,
  ALCHEMY_API_KEY_ARBITRUM: optionalVar,
  ALCHEMY_API_KEY_BASE: optionalVar,
  ALCHEMY_API_KEY_SOLANA: optionalVar,
  ZERION_API_KEY: optionalVar,
  NEAR_INTENTS_API_KEY: optionalVar,
  PENDLE_HOSTED_SDK_API_KEY: optionalVar,
  ONEINCH_API_KEY: optionalVar,
  SUPABASE_SERVICE_ROLE_KEY: optionalVar,
  DATABASE_URL: optionalVar,
  TENDERLY_ACCESS_KEY: optionalVar,
  TENDERLY_ACCOUNT_SLUG: optionalVar,
  TENDERLY_PROJECT_SLUG: optionalVar,
  UPSTASH_REDIS_REST_URL: optionalVar,
  UPSTASH_REDIS_REST_TOKEN: optionalVar,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const warned = new Set<string>();

/**
 * Parses fresh on every call (cheap — a handful of string fields) so tests
 * and tooling that mutate `process.env` at runtime behave as expected.
 */
export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse(process.env);
}

/**
 * Returns the var's value, logging a one-time warning describing the
 * consequence when it is unset.
 */
export function getServerEnvOrWarn(key: keyof ServerEnv, consequence: string): string | undefined {
  const value = getServerEnv()[key];
  if (value === undefined && !warned.has(key)) {
    warned.add(key);
    console.warn(`[env] ${key} is not set — ${consequence}`);
  }
  return value;
}

/** Clears the warn-once state — for tests. */
export function resetServerEnvWarnings(): void {
  warned.clear();
}
