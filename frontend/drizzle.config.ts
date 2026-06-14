import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit config for schema management and studio.
 *
 * The canonical applied migrations live in `supabase/migrations/`. The Drizzle
 * schema in `lib/db/schema.ts` mirrors them and is the typed source of truth.
 * Use `npm run db:generate` to author new migrations from schema changes and
 * `npm run db:studio` to browse the database. `DATABASE_URL` must be set in the
 * shell environment when running these commands.
 */
export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
