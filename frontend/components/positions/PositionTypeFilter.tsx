import React from 'react'
import { PositionType } from '@/lib/plugins/types/shared'

interface PositionTypeFilterProps {
  selected: PositionType | 'all' | 'pendle'
  onChange: (type: PositionType | 'all' | 'pendle') => void
}

export function PositionTypeFilter({ selected, onChange }: PositionTypeFilterProps) {
  const types: { label: string, value: PositionType | 'all' | 'pendle' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Wallet', value: 'wallet' },
    { label: 'Supply', value: 'supply' },
    { label: 'Borrow', value: 'borrow' },
    { label: 'Pendle', value: 'pendle' as any },
  ]

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {types.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
            selected === t.value
              ? 'bg-zinc-100 text-zinc-900'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
