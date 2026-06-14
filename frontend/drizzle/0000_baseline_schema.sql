CREATE TABLE "auto_compound_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"protocol" text NOT NULL,
	"chain" text NOT NULL,
	"asset" text NOT NULL,
	"enabled" boolean DEFAULT false,
	"min_threshold_usd" numeric DEFAULT '10',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "auto_compound_settings_wallet_address_protocol_chain_asset_unique" UNIQUE("wallet_address","protocol","chain","asset")
);
--> statement-breakpoint
CREATE TABLE "bridge_quotes_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_chain" text NOT NULL,
	"to_chain" text NOT NULL,
	"token" text NOT NULL,
	"amount_wei" text NOT NULL,
	"recipient" text NOT NULL,
	"quotes" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"tx_hash_step1" text,
	"tx_hash_step2" text,
	"source_protocol" text,
	"source_chain" text,
	"dest_protocol" text,
	"dest_chain" text,
	"asset" text,
	"amount_usd" numeric,
	"bridge_fee_usd" numeric,
	"slippage_usd" numeric,
	"gas_usd" numeric,
	"status" text DEFAULT 'pending',
	"plan_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "harvest_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"protocol" text NOT NULL,
	"chain" text NOT NULL,
	"reward_token" text,
	"reward_token_address" text,
	"reward_amount_usd" numeric,
	"tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sequence_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"template_id" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_cost_usd" numeric,
	"position_size_usd" numeric(18, 2),
	"steps" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"wallet_address" text PRIMARY KEY NOT NULL,
	"min_usd_threshold" numeric DEFAULT '1',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "execution_history" ADD CONSTRAINT "execution_history_plan_id_sequence_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."sequence_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bridge_quotes_cache_lookup" ON "bridge_quotes_cache" USING btree ("from_chain","to_chain","token","amount_wei","recipient");--> statement-breakpoint
CREATE INDEX "idx_execution_history_plan_id" ON "execution_history" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "harvest_history_wallet_protocol_idx" ON "harvest_history" USING btree ("wallet_address","protocol","created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_sequence_plans_wallet" ON "sequence_plans" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_sequence_plans_status" ON "sequence_plans" USING btree ("status");