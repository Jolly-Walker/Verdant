'use client'

import { useState, useCallback } from 'react'

export interface OpenBuilderOptions {
  positionId?: string
}

export function useSequenceBuilderModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [builderPositionId, setBuilderPositionId] = useState<string | undefined>(undefined)

  const openBuilder = useCallback((opts?: OpenBuilderOptions) => {
    setBuilderPositionId(opts?.positionId)
    setIsOpen(true)
  }, [])

  const closeBuilder = useCallback(() => {
    setIsOpen(false)
    setBuilderPositionId(undefined)
  }, [])

  return {
    isOpen,
    builderPositionId,
    openBuilder,
    closeBuilder,
  }
}
export type UseSequenceBuilderModalReturn = ReturnType<typeof useSequenceBuilderModal>
