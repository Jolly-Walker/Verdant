'use client';

import { useCallback, useEffect, useState } from 'react';
import { HarvestButton } from '@/components/harvest/HarvestButton';
import { RewardsList } from '@/components/harvest/RewardsList';
import { AppHeader } from '@/components/layout/AppHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { type AggregatedReward, useRewards } from '@/hooks/useRewards';
import { useWallet } from '@/hooks/useWallet';
import type { ChainId } from '@/types/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface HarvestRecord {
  id: string;
  protocol: string;
  chain: string;
  reward_token: string | null;
  reward_amount_usd: number | null;
  tx_hash: string | null;
  created_at: string;
}

interface AutoCompoundSetting {
  protocol: string;
  chain: string;
  asset: string;
  enabled: boolean;
  min_threshold_usd: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PROTOCOL_LABELS: Record<string, string> = {
  aave: 'Aave V3',
  morpho: 'Morpho',
  euler: 'Euler',
  pendle: 'Pendle',
};

const CHAIN_LABELS: Record<string, string> = {
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  base: 'Base',
};

/** Muted chain identity tints (see `verdant.chain` in tailwind.config.ts). */
const CHAIN_COLORS: Record<string, string> = {
  ethereum:
    'text-verdant-chain-ethereum bg-verdant-chain-ethereum/10 border-verdant-chain-ethereum/25',
  arbitrum:
    'text-verdant-chain-arbitrum bg-verdant-chain-arbitrum/10 border-verdant-chain-arbitrum/25',
  base: 'text-verdant-chain-base bg-verdant-chain-base/10 border-verdant-chain-base/25',
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="fl-eyebrow">{label}</p>
      <p className="text-2xl font-bold text-verdant-text-primary font-mono">{value}</p>
      {sub && <p className="text-xs text-verdant-text-muted">{sub}</p>}
    </Card>
  );
}

function ProtocolRewardGroup({
  protocol,
  rewards,
  onClaimed,
}: {
  protocol: string;
  rewards: AggregatedReward[];
  onClaimed: () => void;
}) {
  const protocolLabel = PROTOCOL_LABELS[protocol] ?? protocol;
  const chains = [...new Set(rewards.map((r) => r.chain))] as ChainId[];
  const totalUsd = rewards.reduce((s, r) => s + r.amountUsd, 0);

  return (
    <div className="bg-verdant-surface border border-verdant-rule rounded-xl overflow-hidden shadow-organic">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-verdant-rule bg-verdant-paper/60">
        <div className="flex items-center gap-3">
          <span className="fl-serif text-lg text-verdant-pine">{protocolLabel}</span>
          <div className="flex gap-1">
            {chains.map((c) => (
              <span
                key={c}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CHAIN_COLORS[c] ?? 'text-verdant-text-muted bg-verdant-paper-deep/60 border-verdant-rule'}`}
              >
                {CHAIN_LABELS[c] ?? c}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-verdant-profit font-semibold font-mono">
            ${totalUsd.toFixed(2)}
          </span>
          {chains.map((chain) => {
            const chainRewards = rewards.filter((r) => r.chain === chain);
            const chainUsd = chainRewards.reduce((s, r) => s + r.amountUsd, 0);
            return (
              <HarvestButton
                key={chain}
                protocol={protocol}
                chain={chain}
                rewardsUsd={chainUsd}
                onSuccess={onClaimed}
              />
            );
          })}
        </div>
      </div>

      {/* Reward rows */}
      <div className="px-5 py-4">
        <RewardsList rewards={rewards} />
      </div>
    </div>
  );
}

function HarvestHistory({ address }: { address: string }) {
  const [history, setHistory] = useState<HarvestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    setIsLoading(true);
    fetch(`/api/harvest/history?address=${address}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.records ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [address]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-verdant-text-muted text-sm">
        No harvest history yet. Claim your first rewards above.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-verdant-text-muted text-xs uppercase tracking-wider border-b border-verdant-rule">
            <th className="text-left pb-3 pr-4">Protocol</th>
            <th className="text-left pb-3 pr-4">Chain</th>
            <th className="text-left pb-3 pr-4">Token</th>
            <th className="text-right pb-3 pr-4">Amount (USD)</th>
            <th className="text-left pb-3 pr-4">Tx</th>
            <th className="text-left pb-3">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-verdant-rule/60">
          {history.map((rec) => (
            <tr key={rec.id} className="hover:bg-verdant-paper/60 transition-colors">
              <td className="py-3 pr-4">
                <Badge variant="default">{PROTOCOL_LABELS[rec.protocol] ?? rec.protocol}</Badge>
              </td>
              <td className="py-3 pr-4 text-verdant-text-muted capitalize">{rec.chain}</td>
              <td className="py-3 pr-4 text-verdant-text-primary">{rec.reward_token ?? '—'}</td>
              <td className="py-3 pr-4 text-right text-verdant-profit font-medium font-mono">
                {rec.reward_amount_usd != null ? `$${rec.reward_amount_usd.toFixed(2)}` : '—'}
              </td>
              <td className="py-3 pr-4">
                {rec.tx_hash ? (
                  <a
                    href={`https://etherscan.io/tx/${rec.tx_hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-verdant-moss hover:underline font-mono text-xs"
                  >
                    {rec.tx_hash.slice(0, 10)}…
                  </a>
                ) : (
                  '—'
                )}
              </td>
              <td className="py-3 text-verdant-text-muted text-xs font-mono">
                {new Date(rec.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AutoCompoundToggle({
  setting,
  onToggle,
}: {
  setting: AutoCompoundSetting;
  onToggle: (enabled: boolean) => Promise<void>;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [enabled, setEnabled] = useState(setting.enabled);

  const handleToggle = async () => {
    setIsUpdating(true);
    const next = !enabled;
    setEnabled(next);
    try {
      await onToggle(next);
    } catch {
      setEnabled(!next); // revert on failure
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-verdant-rule/60 last:border-0">
      <div>
        <p className="text-verdant-text-primary text-sm font-medium">
          {PROTOCOL_LABELS[setting.protocol] ?? setting.protocol}
          {' · '}
          <span className="text-verdant-text-muted">{setting.asset}</span>
        </p>
        <p className="text-verdant-text-muted text-xs capitalize">
          {CHAIN_LABELS[setting.chain] ?? setting.chain}
        </p>
      </div>
      <button
        type="button"
        id={`autocompound-toggle-${setting.protocol}-${setting.chain}-${setting.asset}`}
        onClick={handleToggle}
        disabled={isUpdating}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
          ${enabled ? 'bg-verdant-moss' : 'bg-verdant-rule-strong'}
          ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200
            ${enabled ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HarvestPage() {
  const { evmAddress, isConnected, isMounted } = useWallet();
  const { rewards, totalRewardsUsd, byProtocol, isLoading, error, refetch } = useRewards();
  const [activeTab, setActiveTab] = useState<'rewards' | 'history' | 'settings'>('rewards');
  const [autoCompoundSettings, setAutoCompoundSettings] = useState<AutoCompoundSetting[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Load auto-compound settings when address is available
  useEffect(() => {
    if (!evmAddress) return;
    setIsLoadingSettings(true);
    fetch(`/api/harvest/settings?address=${evmAddress}`)
      .then((r) => r.json())
      .then((d) => setAutoCompoundSettings(d.settings ?? []))
      .catch(() => {})
      .finally(() => setIsLoadingSettings(false));
  }, [evmAddress]);

  // Kick off rewards fetch when mounted
  useEffect(() => {
    if (isMounted && isConnected && evmAddress) {
      refetch();
    }
  }, [isMounted, isConnected, evmAddress, refetch]);

  const handleAutoCompoundToggle = useCallback(
    async (setting: AutoCompoundSetting, enabled: boolean) => {
      await fetch('/api/harvest/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: evmAddress,
          protocol: setting.protocol,
          chain: setting.chain,
          asset: setting.asset,
          enabled,
        }),
      });
      // Optimistically update local state
      setAutoCompoundSettings((prev) =>
        prev.map((s) =>
          s.protocol === setting.protocol && s.chain === setting.chain && s.asset === setting.asset
            ? { ...s, enabled }
            : s,
        ),
      );
    },
    [evmAddress],
  );

  const protocols = Object.keys(byProtocol);
  const rewardCount = rewards.length;

  // ── Not connected state ──────────────────────────────────────────────────
  if (!isMounted || !isConnected) {
    return (
      <div className="min-h-screen text-verdant-text-primary">
        <AppHeader />
        <div className="flex items-center justify-center px-4 py-24">
          <div className="text-center">
            <div className="text-5xl mb-4">🌾</div>
            <p className="fl-eyebrow">Harvest</p>
            <h1 className="fl-serif mt-2 text-2xl text-verdant-pine">Connect your wallet</h1>
            <p className="text-verdant-text-muted text-sm mt-2">
              Connect a wallet to view and claim your protocol rewards
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-verdant-text-primary">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-8">
        {/* ── Ledger masthead ─────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="fl-eyebrow">Field ledger</p>
            <h1 className="fl-serif mt-2 text-3xl text-verdant-pine md:text-4xl">Harvest</h1>
            <p className="text-verdant-text-muted text-sm mt-2">
              Claim rewards from your DeFi positions across all protocols
            </p>
          </div>
          <button
            type="button"
            id="harvest-refresh-btn"
            onClick={refetch}
            disabled={isLoading}
            className="btn btn-outline"
          >
            {isLoading ? (
              <Spinner size="sm" />
            ) : (
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
            Refresh
          </button>
          <hr className="fl-double-rule mt-2 w-full" />
        </header>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Claimable"
            value={`$${totalRewardsUsd.toFixed(2)}`}
            sub={
              isLoading
                ? 'Fetching…'
                : `across ${protocols.length} protocol${protocols.length !== 1 ? 's' : ''}`
            }
          />
          <StatCard
            label="Reward Entries"
            value={String(rewardCount)}
            sub={isLoading ? 'Fetching…' : 'distinct reward tokens'}
          />
          <StatCard
            label="Auto-compound"
            value={`${autoCompoundSettings.filter((s) => s.enabled).length} / ${autoCompoundSettings.length}`}
            sub="positions enabled"
          />
        </div>

        {/* ── Error banner ────────────────────────────────────────────────── */}
        {error && <WarningBanner message={error} variant="error" />}

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-verdant-rule">
          {(['rewards', 'history', 'settings'] as const).map((tab) => (
            <button
              type="button"
              key={tab}
              id={`harvest-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`
                px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px
                ${
                  activeTab === tab
                    ? 'text-verdant-moss border-verdant-moss'
                    : 'text-verdant-text-muted border-transparent hover:text-verdant-text-primary'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Tab: Rewards ────────────────────────────────────────────────── */}
        {activeTab === 'rewards' && (
          <div className="flex flex-col gap-4">
            {isLoading && protocols.length === 0 ? (
              <div className="flex flex-col gap-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-48 bg-verdant-surface border border-verdant-rule rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : protocols.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">🌱</div>
                <p className="text-verdant-text-primary font-medium">No claimable rewards</p>
                <p className="text-verdant-text-muted text-sm mt-1">
                  Your positions will start accruing rewards over time
                </p>
              </div>
            ) : (
              protocols.map((protocol) => (
                <ProtocolRewardGroup
                  key={protocol}
                  protocol={protocol}
                  rewards={byProtocol[protocol]}
                  onClaimed={refetch}
                />
              ))
            )}
          </div>
        )}

        {/* ── Tab: History ────────────────────────────────────────────────── */}
        {activeTab === 'history' && evmAddress && (
          <Card>
            <h2 className="fl-serif text-xl text-verdant-pine mb-5">Harvest History</h2>
            <HarvestHistory address={evmAddress} />
          </Card>
        )}

        {/* ── Tab: Settings ───────────────────────────────────────────────── */}
        {activeTab === 'settings' && (
          <Card>
            <h2 className="fl-serif text-xl text-verdant-pine mb-1">Auto-Compound Settings</h2>
            <p className="text-verdant-text-muted text-sm mb-5">
              When enabled, harvested rewards are automatically re-deposited into the same position.
            </p>
            {isLoadingSettings ? (
              <div className="flex justify-center py-6">
                <Spinner size="md" />
              </div>
            ) : autoCompoundSettings.length === 0 ? (
              <p className="text-verdant-text-muted text-sm text-center py-6">
                No positions available for auto-compounding
              </p>
            ) : (
              <div>
                {autoCompoundSettings.map((setting) => (
                  <AutoCompoundToggle
                    key={`${setting.protocol}-${setting.chain}-${setting.asset}`}
                    setting={setting}
                    onToggle={(enabled) => handleAutoCompoundToggle(setting, enabled)}
                  />
                ))}
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
