'use client';

import { Spinner } from '@/components/ui/Spinner';
import { useHarvest } from '@/hooks/useHarvest';
import type { ChainId } from '@/types/shared';

interface HarvestButtonProps {
  protocol: string;
  chain: ChainId;
  rewardsUsd: number;
  onSuccess?: () => void;
  className?: string;
}

export function HarvestButton({
  protocol,
  chain,
  rewardsUsd,
  onSuccess,
  className = '',
}: HarvestButtonProps) {
  const { harvest, isSimulating, isSigning, error } = useHarvest();
  const isDisabled = rewardsUsd < 0.01 || isSimulating || isSigning;

  const handleClick = async () => {
    if (isDisabled) return;
    try {
      await harvest(protocol, chain);
      onSuccess?.();
    } catch {
      // error already captured in hook state
    }
  };

  const label = isSimulating ? 'Simulating…' : isSigning ? 'Sign in wallet…' : 'Claim Rewards';

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        id={`harvest-btn-${protocol}-${chain}`}
        onClick={handleClick}
        disabled={isDisabled}
        className={`btn btn-primary ${className}`}
      >
        {(isSimulating || isSigning) && <Spinner size="sm" />}
        {label}
      </button>
      {error && <p className="text-verdant-loss text-xs max-w-xs text-right font-mono">{error}</p>}
    </div>
  );
}
