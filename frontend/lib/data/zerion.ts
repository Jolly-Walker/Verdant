import 'server-only'
import { Position } from '@/types/position'
import { ChainId, ProtocolId } from '@/lib/plugins/types/shared'

export interface ZerionPosition {
  type: 'positions'
  id: string
  attributes: {
    name: string
    protocol: string | null
    position_type: 'wallet' | 'deposit' | 'loan' | 'locked' | 'staked' | 'reward' | 'investment'
    value: number | null
    quantity: {
      decimals: number
      float: number
      numeric: string
    }
    apy: number | null
    fungible_info?: {
      symbol: string
      name: string
      implementations: Array<{
        chain_id: string
        address: string | null
        decimals: number
      }>
    }
  }
  relationships: {
    chain: { data: { id: string } }
  }
}

interface ZerionResponse {
  data: ZerionPosition[]
}

const ZERION_CHAIN_TO_VERDANT: Record<string, ChainId> = {
  'ethereum': 'ethereum',
  'arbitrum': 'arbitrum',
  'base': 'base',
}

const ZERION_BASE = 'https://api.zerion.io/v1'

function zerionAuthHeader(): string {
  if (!process.env.ZERION_API_KEY) {
    throw new Error('ZERION_API_KEY is missing from environment variables')
  }
  const encoded = Buffer.from(`${process.env.ZERION_API_KEY}:`).toString('base64')
  return `Basic ${encoded}`
}

export function getVerdantProtocol(protocol: string | null, symbol: string, name: string): ProtocolId | null {
  const p = (protocol || '').toLowerCase()
  const s = symbol.toLowerCase()
  const n = name.toLowerCase()

  if (p.includes('aave') || (s.startsWith('a') && n.includes('aave'))) return 'aave'
  if (p.includes('morpho') || n.includes('morpho') || s.includes('morpho') || s === 'hyperusdc') return 'morpho'
  if (p.includes('pendle') || n.includes('pendle')) return 'pendle'
  if (p.includes('euler') || n.includes('euler')) return 'euler'
  return null
}

const SUPPORTED_CHAIN_IDS = ['ethereum', 'arbitrum', 'base']

export async function fetchZerionPositions(address: string): Promise<Position[]> {
  const params = new URLSearchParams({
    'filter[chain_ids]': SUPPORTED_CHAIN_IDS.join(','),
    'filter[position_types]': 'wallet,deposited,borrowed,staked',
    'currency': 'usd',
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

    const json = (await res.json()) as ZerionResponse
    
    return normaliseZerionPositions(json.data ?? [])
  } finally {
    clearTimeout(timeout)
  }
}

export function normaliseZerionPositions(raw: ZerionPosition[]): Position[] {
  return raw
    .map(p => {
      let symbol = 'UNKNOWN'
      let address = '' // fallback
      let name = p.attributes.name || ''

      const fungible = p.attributes.fungible_info
      const chainId = p.relationships?.chain?.data?.id
      if (fungible) {
        symbol = fungible.symbol
        name = fungible.name
        const implementation = fungible.implementations?.find(impl => impl.chain_id === chainId)
        if (implementation && implementation.address) {
          address = implementation.address
        }
      } else {
        symbol = p.attributes.name
      }

      const protocolName = p.attributes.protocol || ''
      const mappedProtocol = getVerdantProtocol(protocolName, symbol, name)
      const mappedChain = ZERION_CHAIN_TO_VERDANT[chainId || '']

      if (!mappedChain) return null
      if (!mappedProtocol && p.attributes.position_type !== 'wallet') return null

      const posType = p.attributes.position_type
      let mappedPosType: Position['positionType'] = 'supply'
      
      if (posType === 'wallet') {
        mappedPosType = 'wallet'
      } else if (posType === 'loan') {
        mappedPosType = 'borrow'
      } else if (posType === 'staked' || posType === 'locked') {
        mappedPosType = 'lp'
      }

      return {
        id: p.id,
        protocol: mappedProtocol || 'wallet', // Fallback for wallet tokens
        chain: mappedChain,
        asset: symbol,
        assetAddress: address,
        amount: p.attributes.quantity?.float ?? 0,
        amountUsd: p.attributes.value ?? 0,
        currentApy: p.attributes.apy ?? 0,
        claimableRewards: [], 
        positionType: mappedPosType,
        metadata: {},
        priceUsd: (p.attributes.value ?? 0) / (p.attributes.quantity?.float || 1),
      } as Position
    })
    .filter((p): p is Position => p !== null && (p.protocol !== 'wallet' || p.positionType === 'wallet'))
}
