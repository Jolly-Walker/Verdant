# Drizzle migrations

`0000_baseline_schema.sql` is a **baseline snapshot** of the schema as it already exists in the
database. The canonical, already-applied migrations are the hand-written SQL files in
`../supabase/migrations/` — this baseline simply mirrors their cumulative result so that
`drizzle-kit` has a reference point.

**Do not run `drizzle-kit migrate` against the existing database with this baseline** — the tables
already exist and it would fail. The baseline + `meta/` snapshot exist so that:

1. `lib/db/schema.ts` has a verified, diffable representation of the live schema.
2. Future schema changes can be authored with `npm run db:generate`, which produces an incremental
   migration (`0001_*.sql`, …) describing only the delta.

When you change `lib/db/schema.ts`, run `npm run db:generate` and commit the new migration alongside
the corresponding `supabase/migrations/NNN_*.sql` that actually applies it. CI fails if `schema.ts`
drifts from the committed migrations.
