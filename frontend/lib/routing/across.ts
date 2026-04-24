import 'server-only';

export type BridgeStatus = 'pending' | 'filled' | 'failed' | 'unknown';

export interface AcrossStatusResponse {
  status: BridgeStatus;
  fillTxHash?: string;
}

/**
 * Poll the Across Protocol API for the status of a bridge transaction.
 * 
 * @param originTxHash The transaction hash on the source chain
 */
export async function getAcrossBridgeStatus(originTxHash: string): Promise<AcrossStatusResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://across.to/api/deposit/status?originTransactionHash=${originTxHash}`, {
      // Don't cache status responses
      cache: 'no-store',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Log the error but return unknown to allow polling to continue instead of failing hard
      console.warn(`Across API returned ${response.status} for tx ${originTxHash}`);
      return { status: 'unknown' };
    }

    const data = await response.json();
    
    return {
      status: data.status === 'filled' ? 'filled' : 'pending',
      fillTxHash: data.fillTxs?.[0]?.hash
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Error polling Across bridge status:', error);
    // Return unknown so the caller knows it wasn't a definitive failure
    return { status: 'unknown' };
  }
}
