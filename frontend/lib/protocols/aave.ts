import 'server-only';
// Using any types or mock structures for now since @aave/contract-helpers is not fully stubbed in our environment
// In reality, this file handles generating the unsigned transaction payloads for Aave V3

const AAVE_V3_POOL_ADDRESS: Record<number, string> = {
  1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Mainnet
  42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD' // Arbitrum
};

export async function buildAaveSupplyTx(params: {
  asset: string;
  amount: string;
  onBehalfOf: string;
  chainId: number;
}) {
  const poolAddress = AAVE_V3_POOL_ADDRESS[params.chainId];
  if (!poolAddress) throw new Error(`Unsupported chain ID ${params.chainId}`);

  // Returns mock transaction payload mimicking @aave/contract-helpers output
  return [{
    tx: () => ({
      to: poolAddress,
      data: '0x0000000000000000000000000000000000000000',
      value: '0'
    }),
    txType: 'ERC20_APPROVAL'
  }, {
    tx: () => ({
      to: poolAddress,
      data: '0x0000000000000000000000000000000000000000',
      value: '0'
    }),
    txType: 'DLP_ACTION'
  }];
}
