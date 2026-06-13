export const DEMO_WALLET_ADDRESS = '0xdemo0000000000000000000000000000000000001' as `0x${string}`;
export const DEMO_EVM_ADDRESS = DEMO_WALLET_ADDRESS;

/**
 * Whether the app is running in demo mode. `NEXT_PUBLIC_DEMO_MODE` is a
 * build-time public flag, safe to read in both client and server code. Read at
 * call time (not a module const) so server-side validation reflects the env.
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}
