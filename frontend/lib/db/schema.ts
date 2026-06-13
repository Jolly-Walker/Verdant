/**
 * Drizzle schema — the single typed source of truth for the Postgres database.
 *
 * This mirrors the applied SQL migrations in `supabase/migrations/`. When you add
 * a migration there, reflect the change here so the inferred types stay in sync.
 * Numeric columns are returned by the driver as strings (Postgres `numeric` has
 * arbitrary precision); repositories convert them to `number` at their boundary.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import type { SequencePlan, SerializedSequenceStep } from '@/types/sequencer';
import type { BridgeQuote } from '@/types/shared';

/** 001_user_settings.sql, 009_add_min_usd_threshold.sql */
export const userSettings = pgTable('user_settings', {
  walletAddress: text('wallet_address').primaryKey(),
  minUsdThreshold: numeric('min_usd_threshold').default('1'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/** 002_auto_compound_settings.sql */
export const autoCompoundSettings = pgTable(
  'auto_compound_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    walletAddress: text('wallet_address').notNull(),
    protocol: text('protocol').notNull(),
    chain: text('chain').notNull(),
    asset: text('asset').notNull(),
    enabled: boolean('enabled').default(false),
    minThresholdUsd: numeric('min_threshold_usd').default('10'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    walletProtocolChainAsset: unique().on(t.walletAddress, t.protocol, t.chain, t.asset),
  }),
);

/** 005_sequence_plans.sql, 010_add_position_size_usd.sql */
export const sequencePlans = pgTable(
  'sequence_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    walletAddress: text('wallet_address').notNull(),
    templateId: text('template_id').notNull(),
    description: text('description').notNull(),
    status: text('status').$type<SequencePlan['status']>().notNull().default('draft'),
    totalCostUsd: numeric('total_cost_usd'),
    positionSizeUsd: numeric('position_size_usd', { precision: 18, scale: 2 }),
    steps: jsonb('steps').$type<SerializedSequenceStep[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    walletIdx: index('idx_sequence_plans_wallet').on(t.walletAddress),
    statusIdx: index('idx_sequence_plans_status').on(t.status),
  }),
);

/** 003_execution_history.sql, 006_update_execution_history.sql */
export const executionHistory = pgTable(
  'execution_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    walletAddress: text('wallet_address').notNull(),
    txHashStep1: text('tx_hash_step1'),
    txHashStep2: text('tx_hash_step2'),
    sourceProtocol: text('source_protocol'),
    sourceChain: text('source_chain'),
    destProtocol: text('dest_protocol'),
    destChain: text('dest_chain'),
    asset: text('asset'),
    amountUsd: numeric('amount_usd'),
    bridgeFeeUsd: numeric('bridge_fee_usd'),
    slippageUsd: numeric('slippage_usd'),
    gasUsd: numeric('gas_usd'),
    status: text('status').default('pending'),
    planId: uuid('plan_id').references(() => sequencePlans.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    planIdx: index('idx_execution_history_plan_id').on(t.planId),
  }),
);

/** 004_harvest_history.sql, 008_harvest_history_update.sql */
export const harvestHistory = pgTable(
  'harvest_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    walletAddress: text('wallet_address').notNull(),
    protocol: text('protocol').notNull(),
    chain: text('chain').notNull(),
    rewardToken: text('reward_token'),
    rewardTokenAddress: text('reward_token_address'),
    rewardAmountUsd: numeric('reward_amount_usd'),
    txHash: text('tx_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    walletProtocolIdx: index('harvest_history_wallet_protocol_idx').on(
      t.walletAddress,
      t.protocol,
      sql`${t.createdAt} DESC`,
    ),
  }),
);

/** 007_bridge_quotes_cache.sql */
export const bridgeQuotesCache = pgTable(
  'bridge_quotes_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromChain: text('from_chain').notNull(),
    toChain: text('to_chain').notNull(),
    token: text('token').notNull(),
    amountWei: text('amount_wei').notNull(),
    recipient: text('recipient').notNull(),
    slippagePercent: text('slippage_percent').notNull().default('0.5'),
    quotes: jsonb('quotes').$type<BridgeQuote[]>().notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    lookupIdx: index('idx_bridge_quotes_cache_lookup').on(
      t.fromChain,
      t.toChain,
      t.token,
      t.amountWei,
      t.recipient,
      t.slippagePercent,
    ),
  }),
);
