const REVERT_MAP: Record<string, string> = {
  '0x13be252b': 'Insufficient allowance for this transaction',
  '0xf4844814': 'Health factor too low after this action',
  '0x4e487b71': 'Arithmetic overflow/underflow',
}

/**
 * Decodes an EVM revert selector into a human-readable error message.
 * @param data The revert data (hex string)
 */
export function decodeRevertReason(data: string): string {
  if (!data || data === '0x') return 'Unknown execution failure'
  
  // Alchemy and other providers might return the full error data
  // Selectors are the first 4 bytes (10 characters including 0x)
  const selector = data.slice(0, 10).toLowerCase()
  
  return REVERT_MAP[selector] || `Execution failed (Error: ${selector})`
}
