import 'server-only';

export interface BridgeIntentParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageTolerance: number;
  recipientAddress: string;
}

/**
 * Mocks the NEAR Intents SDK which is currently unavailable via npm.
 * In a real environment, this would call the solver infrastructure.
 */
export async function createBridgeIntent(params: BridgeIntentParams) {
  console.log('Creating bridge intent with params:', params);

  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 1200));

  // Simulate a 0.5% slippage on output
  const amountOutStr = ((BigInt(params.amountIn) * BigInt(995)) / BigInt(1000)).toString();

  return {
    intentId: `intent_${Math.random().toString(36).substring(2, 11)}`,
    status: 'created',
    quote: {
      amountIn: params.amountIn,
      amountOut: amountOutStr,
      slippage: params.slippageTolerance
    },
    executionDeadline: Date.now() + 300000,
    recipient: params.recipientAddress
  };
}
