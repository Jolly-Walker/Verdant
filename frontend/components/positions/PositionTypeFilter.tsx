import React from 'react'
import { PositionType } from '@/types/position'

type FilterValue = PositionType | 'all' | 'pendle'

interface PositionTypeFilterProps {
  selected: FilterValue
  onChange: (type: FilterValue) => void
}

export function PositionTypeFilter({ selected, onChange }: PositionTypeFilterProps) {
  const types: { label: string, value: FilterValue }[] = [
    { label: 'All', value: 'all' },
    { label: 'Wallet', value: 'wallet' },
    { label: 'Supply', value: 'supply' },
    { label: 'Borrow', value: 'borrow' },
    { label: 'Pendle', value: 'pendle' },
  ]

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {types.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            selected === t.value
              ? 'bg-verdant-moss text-white'
              : 'bg-verdant-surface text-verdant-text-muted hover:text-verdant-text-primary border border-[#E5E0D8] hover:bg-verdant-surface-accent'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
