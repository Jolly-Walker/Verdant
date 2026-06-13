import 'server-only';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let _db: PostgresJsDatabase<typeof schema> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

/**
 * Lazy-initialized, server-only Drizzle client backed by postgres-js.
 *
 * `DATABASE_URL` must point at the Postgres connection string for the project's
 * database (for Supabase, use the connection-pooler URI). `prepare: false` keeps
 * us compatible with transaction-mode poolers (pgBouncer), which don't support
 * prepared statements.
 *
 * Throws if `DATABASE_URL` is missing so misconfiguration fails loudly at the
 * first query rather than silently returning empty results.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured');
  _client = postgres(url, { prepare: false });
  _db = drizzle(_client, { schema });
  return _db;
}

export { schema };
