import { NextRequest, NextResponse } from "next/server"
import { Position, Reward } from "@/types/position"
import { Protocol } from "@/types/protocol"
import { Chain } from "@/types/chain"

const DEBANK_API_KEY = process.env.DEBANK_API_KEY || ""
const DEBANK_URL = "https://pro-openapi.debank.com/v1/user/complex_protocol_list"

const PROTOCOL_MAP: Record<string, Protocol> = {
  aave3: "aave",
  morpho: "morpho",
  pendle: "pendle",
  euler: "euler",
}

const CHAIN_MAP: Record<string, Chain> = {
  eth: "ethereum",
  arb: "arbitrum",
}

const SUPPORTED_ASSETS = ["USDC", "USDT", "ETH", "WETH", "WBTC", "WSTETH", "EETH"]

interface DeBankToken {
  id: string
  symbol: string
  amount: number
  price: number
}

interface DeBankPortfolioItem {
  pool_id?: string
  detail?: {
    reward_token_list?: DeBankToken[]
    supply_token_list?: DeBankToken[]
    borrow_token_list?: DeBankToken[]
    expiry?: number | string
    unlock_at?: number | string
  }
  stats?: {
    net_yield?: number
  }
}

interface DeBankResponse {
  id: string
  chain: string
  portfolio_item_list?: DeBankPortfolioItem[]
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get("address")

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(`${DEBANK_URL}?id=${address}&chain_ids=eth,arb`, {
      headers: {
        "AccessKey": DEBANK_API_KEY,
        "Accept": "application/json",
      },
      signal: controller.signal,
      next: { revalidate: 60 },
    })
    
    clearTimeout(timeoutId)

    if (!res.ok) {
      throw new Error(`DeBank API responded with status: ${res.status}`)
    }

    const rawData = await res.json()
    const data = rawData as DeBankResponse[]
    const positions: Position[] = []

    if (!Array.isArray(data)) {
      return NextResponse.json([], { status: 200 })
    }

    for (const protocolData of data) {
      let protocolName = PROTOCOL_MAP[protocolData.id] || PROTOCOL_MAP[protocolData.id.replace(/_.*$/, "")]
      const chainName = CHAIN_MAP[protocolData.chain]

      if (protocolData.id.includes("aave") && !protocolData.id.includes("aave3")) continue

      // Fallback matching if DeBank ID doesn't exactly match map
      if (!protocolName) {
        if (protocolData.id.includes("aave3")) protocolName = "aave"
        else if (protocolData.id.includes("morpho")) protocolName = "morpho"
        else if (protocolData.id.includes("pendle")) protocolName = "pendle"
        else if (protocolData.id.includes("euler")) protocolName = "euler"
      }

      if (!protocolName || !chainName) continue

      const items = protocolData.portfolio_item_list || []

      for (const item of items) {
        let claimableRewards: Reward[] = []
        if (item.detail?.reward_token_list) {
          claimableRewards = item.detail.reward_token_list.map((t: DeBankToken) => ({
            token: t.symbol,
            amount: t.amount,
            amountUsd: t.amount * (t.price || 0),
          }))
        }

        if (item.detail?.supply_token_list) {
          for (const token of item.detail.supply_token_list) {
            positions.push({
              id: `${protocolData.id}-${chainName}-${token.id}-supply`,
              protocol: protocolName as Protocol,
              chain: chainName,
              asset: token.symbol,
              assetAddress: token.id,
              amount: token.amount,
              amountUsd: token.amount * (token.price || 0),
              currentApy: item.stats?.net_yield || 0,
              claimableRewards,
              positionType: "supply",
              metadata: { 
                poolId: item.pool_id || "",
                expiry: item.detail?.expiry,
                unlockAt: item.detail?.unlock_at,
              },
            })
          }
        }

        if (item.detail?.borrow_token_list) {
          for (const token of item.detail.borrow_token_list) {
            positions.push({
              id: `${protocolData.id}-${chainName}-${token.id}-borrow`,
              protocol: protocolName as Protocol,
              chain: chainName,
              asset: token.symbol,
              assetAddress: token.id,
              amount: token.amount,
              amountUsd: token.amount * (token.price || 0),
              currentApy: item.stats?.net_yield || 0,
              claimableRewards,
              positionType: "borrow",
              metadata: { 
                poolId: item.pool_id || "",
                expiry: item.detail?.expiry,
                unlockAt: item.detail?.unlock_at,
              },
            })
          }
        }
      }
    }

    const filteredPositions = positions.filter(p => {
      const assetUpperCase = p.asset.toUpperCase()
      if (SUPPORTED_ASSETS.includes(assetUpperCase)) return true
      if (p.protocol === "pendle" && (assetUpperCase.startsWith("PT-") || assetUpperCase.startsWith("YT-"))) return true
      return false
    })

    return NextResponse.json(filteredPositions, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
      },
    })
  } catch (error) {
    console.error("Failed to fetch positions from DeBank", error)
    return NextResponse.json(
      { error: "Failed to fetch positions" },
      { status: 500 }
    )
  }
}
