const REVERT_MAP: Record<string, string> = {
  '0x13be252b': 'Insufficient allowance for this transaction',
  '0xf4844814': 'Health factor too low after this action',
  '0x4e487b71': 'Arithmetic overflow/underflow',
};

/** Phrases that appear in plain-text reverts and map to a known classification. */
const REVERT_PHRASE_MAP: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /health\s*factor|\bhf\b/i, message: REVERT_MAP['0xf4844814'] },
  { pattern: /insufficient allowance/i, message: REVERT_MAP['0x13be252b'] },
  { pattern: /overflow|underflow/i, message: REVERT_MAP['0x4e487b71'] },
];

/**
 * Decodes an EVM revert into a human-readable message. Handles BOTH forms a
 * provider may return:
 *  - a 4-byte hex selector (e.g. `0xf4844814`) → mapped via REVERT_MAP, and
 *  - a plain-text string (e.g. Alchemy's `execution reverted: HF too low`) →
 *    matched against known phrases, else returned as-is.
 * @param data The revert data (hex selector or prose).
 */
export function decodeRevertReason(data: string): string {
  if (!data || data === '0x') return 'Unknown execution failure';

  // Hex selectors are the first 4 bytes (10 chars including 0x). Only treat the
  // input as a selector when it actually looks like hex — otherwise `slice(0,10)`
  // would mangle a prose revert into a meaningless "selector".
  const isHex = /^0x[0-9a-fA-F]+$/.test(data);
  if (isHex) {
    const selector = data.slice(0, 10).toLowerCase();
    return REVERT_MAP[selector] || `Execution failed (Error: ${selector})`;
  }

  // Plain-text revert: surface known classifications, else return the prose.
  for (const { pattern, message } of REVERT_PHRASE_MAP) {
    if (pattern.test(data)) return message;
  }
  return data;
}
