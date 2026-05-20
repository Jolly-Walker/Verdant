import { createPublicClient, http, parseAbiItem } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://cloudflare-eth.com')
})

async function run() {
  // aUSDC token on Aave V3 Ethereum
  const logs = await client.getLogs({
    address: '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c',
    event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
    fromBlock: 'latest',
  })
  
  // Find a recipient of aUSDC
  for (const log of logs) {
    if (log.args.to && log.args.to !== '0x0000000000000000000000000000000000000000') {
      console.log('Found depositor:', log.args.to)
      return
    }
  }
}
run()
