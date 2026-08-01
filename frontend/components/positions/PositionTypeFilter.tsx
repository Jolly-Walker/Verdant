import type { PositionType } from '@/types/shared';

type FilterValue = PositionType | 'all' | 'pendle';

interface PositionTypeFilterProps {
  selected: FilterValue;
  onChange: (type: FilterValue) => void;
}

export function PositionTypeFilter({ selected, onChange }: PositionTypeFilterProps) {
  const types: { label: string; value: FilterValue }[] = [
    { label: 'All', value: 'all' },
    { label: 'Wallet', value: 'wallet' },
    { label: 'Supply', value: 'supply' },
    { label: 'Borrow', value: 'borrow' },
    { label: 'Pendle', value: 'pendle' },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {types.map((t) => (
        <button
          type="button"
          key={t.value}
          onClick={() => onChange(t.value)}
          aria-pressed={selected === t.value}
          className={`px-4 py-2 min-h-[36px] rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            selected === t.value
              ? 'bg-verdant-moss text-white'
              : 'bg-verdant-surface text-verdant-text-muted hover:text-verdant-text-primary border border-verdant-rule hover:bg-verdant-surface-accent'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
