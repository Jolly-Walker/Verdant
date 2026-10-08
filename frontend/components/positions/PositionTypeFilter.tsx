import { FilterChip } from '@/components/ui/FilterChip';
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
        <FilterChip key={t.value} pressed={selected === t.value} onClick={() => onChange(t.value)}>
          {t.label}
        </FilterChip>
      ))}
    </div>
  );
}
