'use client'

import { useState, useCallback } from 'react'
import { TemplateId } from '@/types/sequencer'

interface OpenModalOptions {
  template?: TemplateId
  params?: Partial<Record<string, string>>
}

export function useSequenceModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<OpenModalOptions>({})

  const openModal = useCallback((opts: OpenModalOptions = {}) => {
    setOptions(opts)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
    setOptions({})
  }, [])

  return { isOpen, options, openModal, closeModal }
}
