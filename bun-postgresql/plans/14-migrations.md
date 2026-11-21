# 14. Migrations with SQL Files
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 13-bun-sql

## Learning goals
- Learner can explain why schema changes are versioned as migrations.
- Learner can write numbered, forward-only `.sql` migration files.
- Learner can describe the `schema_migrations` tracking table.
- Learner can write and run `scripts/migrate.ts` that applies pending files in order, each in a transaction.
- Learner can write an idempotent seed script for dev data.

## Sub-topics
### Why migrations exist
- Concept: migration = one versioned schema change in a file, applied once per database, in order. Every environment (each dev's laptop, test DB, prod) reaches the same schema by replaying the same files. Never edit an applied migration; add a new one. Forward-only (no down files) in this course — fix forward; mention down migrations exist in tools.
- Analogy: building renovation logbook — each numbered entry ("added wall in room 3") is done once and never rewritten; a new builder reads the log to know exactly what state the house is in.
- Code example: none runnable; show timeline: `0001_create_users.sql` applied on dev Monday, on prod Wednesday; `0002_create_products.sql` later — both DBs end identical. Show psql `\dt` listing (`users`, `products`, `orders`, `order_items`, `schema_migrations`) after running all.
- Production use: deploys run migrations before new code starts.
- Common mistakes: editing old migration files; changing schema by hand in prod psql.
- Sources: https://www.postgresql.org/docs/19/ddl-alter.html ; https://www.postgresql.org/docs/19/sql-createtable.html

### Numbered .sql migration files
- Concept: `migrations/NNNN_description.sql`, 4-digit zero-padded (string sort = numeric order). One logical change per file. Plain SQL from topic 11 schema split: `0001_create_users.sql`, `0002_create_products.sql`, `0003_create_orders.sql` (orders + order_items), later `0004_orders_metadata.sql` (topic 16), `0005_indexes.sql` (17), `0006_create_sessions.sql` (20). Use `IF NOT EXISTS` only sparingly — runner guarantees once.
- Analogy: numbered chapters of a book — 0002 makes sense only after 0001; padding `0010` keeps chapter 10 after 9 on the shelf.
- Code example: `migrations/0001_create_users.sql` — `CREATE TABLE users (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());` (exact 11 schema); demo sort: `["0010_x.sql", "0002_y.sql", "0001_z.sql"].sort()` → `[ "0001_z.sql", "0002_y.sql", "0010_x.sql" ]`; unpadded `["10_x.sql","2_y.sql"].sort()` → `[ "10_x.sql", "2_y.sql" ]` (wrong).
- Production use: reviewable schema history in git.
- Common mistakes: unpadded numbers; two devs creating the same number (rename before merge).
- Sources: https://www.postgresql.org/docs/19/sql-createtable.html

### A schema_migrations tracking table
- Concept: table recording which files ran: `CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());` Runner creates it first. PK prevents double-recording; pending = files not in table.
- Analogy: stamp card at a café — each visit (migration) stamped once; staff check the card before stamping again.
- Code example: `SELECT version FROM schema_migrations ORDER BY version;` after first run → `0001_create_users.sql`, `0002_create_products.sql`, `0003_create_orders.sql` `(3 rows)`.
- Production use: same idea used by every migration tool.
- Common mistakes: deleting rows from the table by hand; storing only a count instead of names.
- Sources: https://www.postgresql.org/docs/19/sql-createtable.html

### Writing the migration runner in Bun
- Concept: `scripts/migrate.ts`: ensure tracking table → read `migrations/` with `readdir` from `node:fs/promises` (filter `.sql`, sort) → load applied versions → for each pending file: `Bun.file(path).text()` → inside `sql.begin(async tx => { await tx.unsafe(text); await tx\`INSERT INTO schema_migrations (version) VALUES (${file})\`; })` — schema change and record commit together or both roll back (PostgreSQL DDL is transactional). `tx.unsafe(text)` without params may hold several statements (version notes) — safe here because text comes from our own repo files, never users. Print each applied file; exit code 1 on failure; always `sql.close()`. Path via `import.meta.dir`. Concurrency guard: `SELECT pg_advisory_xact_lock(727274)` inside each tx (gloss: database-wide named lock so two deploys don't migrate at once) — mention, include as one line.
- Analogy: assembly-line worker with a checklist — checks which steps are already ticked, does the next unticked one, ticks it only if it fully succeeded; a failed step leaves no half-built part.
- Code example: `scripts/migrate.ts` — `import { readdir } from "node:fs/promises"; import { join } from "node:path"; import { sql } from "../src/db"; const dir = join(import.meta.dir, "..", "migrations"); async function migrate(): Promise<void> { await sql\`CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())\`; const files = (await readdir(dir)).filter(f => f.endsWith(".sql")).sort(); const appliedRows: { version: string }[] = await sql\`SELECT version FROM schema_migrations\`; const applied = new Set(appliedRows.map(r => r.version)); for (const file of files) { if (applied.has(file)) continue; const text = await Bun.file(join(dir, file)).text(); await sql.begin(async tx => { await tx\`SELECT pg_advisory_xact_lock(727274)\`; await tx.unsafe(text); await tx\`INSERT INTO schema_migrations (version) VALUES (${file})\`; }); console.log(\`applied ${file}\`); } console.log("migrations up to date"); } try { await migrate(); } catch (err) { console.error("migration failed", err); process.exitCode = 1; } finally { await sql.close(); }`. Gloss `Set`. Run `bun run migrate` first time → `applied 0001_create_users.sql` / `applied 0002_create_products.sql` / `applied 0003_create_orders.sql` / `migrations up to date`; second run → `migrations up to date` only. Note: the lock-then-check race (two runners both seeing file pending) — second would fail on PK insert and roll back; acceptable and stated (ponytail-style known ceiling).
- Production use: `bun run migrate` in deploy pipeline and before tests (22).
- Common mistakes: running each file without transaction (half-applied schema); recording version before running SQL; `sql.unsafe` with user input.
- Sources: https://bun.com/docs/api/sql ; https://bun.com/docs/api/file-io ; https://www.postgresql.org/docs/19/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS

### Seed data
- Concept: seed = sample rows for local dev (not migrations; never in prod). Idempotent: `INSERT ... ON CONFLICT DO NOTHING` (full upsert in 16) or check-before-insert; uses `sql(rows)` bulk insert. Passwords hashed via Bun.password in topic 20 — for now seed uses `Bun.password.hash("password123")` gloss as "turns a password into a safe one-way code (topic 20)". Guard: refuse if `config.env === "production"`.
- Analogy: show-home furniture — staged so visitors (developers) can see how rooms work; never moved into a buyer's real house (production).
- Code example: `scripts/seed.ts` — guard `if (config.env === "production") throw new Error("refusing to seed production");` → `const hash = await Bun.password.hash("password123"); await sql\`INSERT INTO users ${sql([{ email: "asha@example.com", name: "Asha", password_hash: hash }, { email: "ben@example.com", name: "Ben", password_hash: hash }, { email: "chen@example.com", name: "Chen", password_hash: hash }])} ON CONFLICT (email) DO NOTHING\`;` products similarly (products have no unique key → seed only when `SELECT count(*)::int AS n FROM products` is 0); `console.log("seed done")` → `seed done`; second run → no duplicates.
- Production use: consistent dev data; test fixtures differ (22).
- Common mistakes: seeding production; non-idempotent seeds duplicating rows.
- Sources: https://bun.com/docs/api/sql ; https://www.postgresql.org/docs/19/sql-insert.html#SQL-ON-CONFLICT

## Quiz
1. Why never edit `0001_create_users.sql` after it ran in production? — tests migration rules
2. Why zero-pad migration numbers? — tests ordering
3. What does running the runner a second time print? — tests tracking table
4. Why run file SQL and the tracking insert in one transaction? — tests atomic runner
5. How does the seed script avoid duplicate users on re-run? — tests idempotent seeds
