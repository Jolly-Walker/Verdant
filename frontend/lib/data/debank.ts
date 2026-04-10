import { Position } from '@/types/position'

/**
 * Fetch normalised positions from the DeBank proxy API route.
 */
export async function fetchPositions(address: string): Promise<Position[]> {
  try {
    const res = await fetch(`/api/positions?address=${encodeURIComponent(address)}`)

    if (!res.ok) {
      console.error(`Positions API error: ${res.status}`)
      return []
    }

    const data = await res.json()

    if (!Array.isArray(data)) {
      return []
    }

    return data as Position[]
  } catch (error) {
    console.error('Failed to fetch positions:', error)
    return []
  }
}
