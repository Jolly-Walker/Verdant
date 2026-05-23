'use client'

import { useState, useCallback } from 'react'
import { Position } from '@/types/position'

export function useLoopModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [loopPosition, setLoopPosition] = useState<Position | null>(null)
  const [loopCollateral, setLoopCollateral] = useState<Position | undefined>(undefined)

  const openLoop = useCallback((position: Position, collateral?: Position) => {
    setLoopPosition(position)
    setLoopCollateral(collateral)
    setIsOpen(true)
  }, [])

  const closeLoop = useCallback(() => {
    setIsOpen(false)
    setLoopPosition(null)
    setLoopCollateral(undefined)
  }, [])

  return {
    isOpen,
    loopPosition,
    loopCollateral,
    openLoop,
    closeLoop,
  }
}
export type UseLoopModalReturn = ReturnType<typeof useLoopModal>
