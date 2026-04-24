import { Position } from '@/types/position'

interface ZerionPosition {
  type: 'positions'
  id: string
  attributes: {
    position_type: 'wallet' | 'deposit' | 'loan' | 'locked' | 'staked' | 'reward' | 'investment'
    value: number | null
    quantity: {
      decimals: number
      float: number
      numeric: string
    }
    apy: number | null
    dapp_id: string | null
    changes: {
      absolute_1d: number | null
      percent_1d: number | null
    }
  }
  relationships: {
    chain: { data: { id: string } }
    fungible: { data: { id: string } }
  }
}

interface ZerionFungible {
  type: 'fungibles'
  id: string
  attributes: {
    symbol: string
    name: string
    implementations: Array<{
      chain_id: string
      address: string | null
      decimals: number
    }>
  }
}

const ZERION_DAPP_TO_PROTOCOL: Record<string, Position['protocol']> = {
  'aave-v3': 'aave',
  'morpho': 'morpho',
  'pendle': 'pendle',
  'euler-v2': 'euler',
}

const ZERION_CHAIN_TO_VERDANT: Record<string, Position['chain']> = {
  'ethereum': 'ethereum',
  'arbitrum': 'arbitrum',
}

const ZERION_BASE = 'https://api.zerion.io/v1'

function zerionAuthHeader(): string {
  const encoded = Buffer.from(`${process.env.ZERION_API_KEY}:`).toString('base64')
  return `Basic ${encoded}`
}

const SUPPORTED_DAPP_IDS = ['aave-v3', 'morpho', 'pendle', 'euler-v2']
const SUPPORTED_CHAIN_IDS = ['ethereum', 'arbitrum']

export async function fetchZerionPositions(address: string): Promise<Position[]> {
  const params = new URLSearchParams({
    'filter[position_types]': 'wallet,deposit',
    'filter[chain_ids]': SUPPORTED_CHAIN_IDS.join(','),
    'filter[dapp_ids]': SUPPORTED_DAPP_IDS.join(','),
    'currency': 'usd',
    'include': 'fungible',
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(
      `${ZERION_BASE}/wallets/${address}/positions/?${params}`,
      {
        headers: {
          Authorization: zerionAuthHeader(),
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    )

    if (!res.ok) {
      const text = await res.text()
      console.error('Zerion 400 text:', text)
      throw new Error(`Zerion API error: ${res.status} ${res.statusText}`)
    }

    const json = await res.json()
    
    // Map included fungibles
    const fungiblesMap: Record<string, ZerionFungible> = {}
    if (json.included) {
      for (const item of json.included) {
        if (item.type === 'fungibles') {
          fungiblesMap[item.id] = item as ZerionFungible
        }
      }
    }

    return normaliseZerionPositions(json.data ?? [], fungiblesMap)
  } finally {
    clearTimeout(timeout)
  }
}

function normaliseZerionPositions(raw: ZerionPosition[], fungiblesMap: Record<string, ZerionFungible>): Position[] {
  return raw
    .filter(p => {
      const dappId = p.attributes.dapp_id
      const chainId = p.relationships.chain.data.id
      return (
        dappId &&
        ZERION_DAPP_TO_PROTOCOL[dappId] &&
        ZERION_CHAIN_TO_VERDANT[chainId]
      )
    })
    .map(p => {
      const fungibleId = p.relationships.fungible.data.id
      const fungible = fungiblesMap[fungibleId]
      const chainId = p.relationships.chain.data.id
      
      let symbol = 'UNKNOWN'
      let address = fungibleId // fallback

      if (fungible) {
        symbol = fungible.attributes.symbol
        const implementation = fungible.attributes.implementations?.find(impl => impl.chain_id === chainId)
        if (implementation && implementation.address) {
          address = implementation.address
        }
      }

      return {
        id: p.id,
        protocol: ZERION_DAPP_TO_PROTOCOL[p.attributes.dapp_id!],
        chain: ZERION_CHAIN_TO_VERDANT[chainId],
        asset: symbol,
        assetAddress: address,
        amount: p.attributes.quantity.float,
        amountUsd: p.attributes.value ?? 0,
        currentApy: p.attributes.apy ?? 0,
        claimableRewards: [], // populated by /api/rewards separately
        positionType: p.attributes.position_type === 'deposit' ? 'supply' : 'lp',
        metadata: {},
      }
    })
}
