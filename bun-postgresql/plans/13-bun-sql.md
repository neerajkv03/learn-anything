# 13. Talking to PostgreSQL with Bun.sql
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 12-joins-aggregation

## Learning goals
- Learner can create one pooled `SQL` client from `DATABASE_URL` in `src/db.ts` and explain what a connection pool does.
- Learner can run tagged-template queries and read the returned array of row objects.
- Learner can explain SQL injection and why `${value}` in Bun.sql is safe while string building is not.
- Learner can type query results and convert rows (snake_case, bigint-as-string) into API types.
- Learner can use `sql(object)` for inserts/updates and `sql([...])` for IN lists.
- Learner can close the pool cleanly with `sql.close()`.

## Sub-topics
### Connecting via DATABASE_URL & the connection pool
- Concept: Bun.sql = PostgreSQL client built into Bun (no package). `import { SQL } from "bun"; new SQL(url, options)`. Default `sql` export reads `DATABASE_URL` (also POSTGRES_URL, PGURL...) — course still uses explicit `new SQL(config.databaseUrl, ...)` so config validation (07) controls it. Connection = open network line to PostgreSQL (costly to open). Pool = set of reusable connections; default `max: 10`; opened lazily on first query, on demand up to max; options in seconds: `idleTimeout` (default 0 = off), `maxLifetime` (0 = off), `connectionTimeout` (default 30). URL shape `postgres://user:password@host:5432/db`; `?sslmode=require` for TLS (1.4 honors PGSSLMODE).
- Analogy: taxi rank — instead of buying a new car per trip (new connection per query), a fixed fleet of taxis waits; each query takes a free taxi and returns it; if all are busy, passengers queue.
- Code example: `src/db.ts` — `import { SQL } from "bun"; import { config } from "./config"; export const sql = new SQL(config.databaseUrl, { max: 10, idleTimeout: 30, connectionTimeout: 10 }); export type Sql = typeof sql;` `scripts/db-check.ts`: `import { sql } from "../src/db"; const [row] = await sql\`SELECT 1 + 1 AS two\`; console.log(row.two); await sql.close();` → `2`.
- Production use: one pool per process, shared by all requests; pool size ≤ database connection limit / app instances.
- Common mistakes: creating a new SQL client per request (connection storm); `max` larger than PostgreSQL `max_connections` allows across instances.
- Sources: https://bun.com/docs/api/sql ; https://www.postgresql.org/docs/19/libpq-connect.html#LIBPQ-CONNSTRING-URIS

### Tagged-template queries
- Concept: tagged template = function called with a backtick string (`sql\`...\``) — gloss: same backticks as 02 template literals, but `sql` receives the text pieces and values separately. Returns Promise of array of row objects (each row = object with column names as keys); empty array when no rows; result also has `.count` (rows affected) and `.command`. `const [row] = ...` for single row (`undefined` if none, with `noUncheckedIndexedAccess`). Fragments: `sql\`...\`` can nest; conditional `${cond ? sql\`AND status = ${s}\` : sql\`\`}`.
- Analogy: order form with fixed printed questions and blank boxes — the kitchen reads the printed text as instructions and the box contents only as ingredients, never as new instructions.
- Code example: `scripts/list-orders.ts` — `const status = "paid"; const rows = await sql\`SELECT id, status, total_cents FROM orders WHERE status = ${status} ORDER BY id\`; console.log(rows.length, rows[0]);` → `1 { id: "1", status: "paid", total_cents: 4998 }` (dataset from 09; note `id` is a string because bigint); `const res = await sql\`UPDATE orders SET status = 'paid' WHERE id = ${"2"}\`; console.log(res.count);` → `1`.
- Production use: every repository function.
- Common mistakes: forgetting `await`; expecting single object instead of array; expecting bigint id as number.
- Sources: https://bun.com/docs/api/sql ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates

### Parameters & preventing SQL injection
- Concept: SQL injection = attacker's input becomes part of the SQL instructions. Bun.sql sends `${value}` as a separate parameter (`$1`), never spliced into text → safe. Unsafe: building strings and `sql.unsafe(text)`. Values can't be identifiers (table/column names) — use `sql("column")` with an allow-list of names only. LIKE input: escape `%`/`_` or accept as pattern consciously.
- Analogy: bank teller and a cheque — amount box (parameter) is read as an amount only; if someone writes "and also empty the vault" in the amount box, it's just an invalid amount, not an instruction.
- Code example: `injection.ts` — `const email = "x' OR '1'='1";` unsafe: `await sql.unsafe("SELECT id FROM users WHERE email = '" + email + "'")` → returns all 3 users (`3`); safe: `const rows = await sql\`SELECT id FROM users WHERE email = ${email}\`; console.log(rows.length);` → `0`. Sort-column allow-list: `const allowed = { created: "created_at", total: "total_cents" } as const; const col = allowed[sortKey] ?? "created_at"; sql\`... ORDER BY ${sql(col)} DESC\``.
- Production use: OWASP top risk; parameters are the default for all queries.
- Common mistakes: `sql.unsafe` with user input; template literal (02) instead of tagged template; passing user input to `sql(identifier)` without allow-list.
- Sources: https://bun.com/docs/api/sql ; https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html

### Typing query results
- Concept: Bun.sql result rows are not checked against TS types; you annotate: `const rows: OrderRow[] = await sql\`...\`` (no documented generic form). Row type mirrors DB columns + Bun mapping (version notes): bigint → string, integer → number, numeric → string, boolean → boolean, timestamptz → Date (read as UTC), jsonb → parsed value, NULL → null, `text[]` → array. Then map to API type: `toOrder(row)` converts snake_case → camelCase. `count(*)` is bigint → string → cast `count(*)::int` in SQL. `bigint: true` option makes int8 → JS BigInt (not JSON-serializable by default) — course keeps strings.
- Analogy: customs declaration — you declare what's in the box (type annotation); customs (TypeScript) trusts the paperwork, so if the declaration is wrong nobody notices until it's opened.
- Code example: `src/repositories/orders.repo.ts` (v1) — `import { sql } from "../db"; import type { Order, OrderStatus } from "../types/order"; type OrderRow = { id: string; user_id: string; status: OrderStatus; total_cents: number; created_at: Date }; function toOrder(r: OrderRow): Order { return { id: r.id, userId: r.user_id, status: r.status, totalCents: r.total_cents, createdAt: r.created_at.toISOString() }; } export async function findOrderById(id: string): Promise<Order | null> { const rows: OrderRow[] = await sql\`SELECT id, user_id, status, total_cents, created_at FROM orders WHERE id = ${id}\`; const row = rows[0]; return row ? toOrder(row) : null; }`; `console.log(await findOrderById("1"))` → `{ id: "1", userId: "1", status: "paid", totalCents: 4998, createdAt: "2026-11-01T10:00:00.000Z" }`; `findOrderById("999")` → `null`. `Order` type in `src/types/order.ts` gets `userId: string; createdAt: string`.
- Production use: one row type + mapper per table in repositories.
- Common mistakes: annotating bigint columns as `number`; `count(*)` returned as `"3"` string then `+ 1` → `"31"`; leaking snake_case to API.
- Sources: https://bun.com/docs/api/sql ; https://www.postgresql.org/docs/19/datatype-numeric.html

### Helpers: sql(object) inserts & sql([...]) for IN lists
- Concept: `sql\`INSERT INTO users ${sql(user)} RETURNING id\`` builds column list + values from object keys; `sql(obj, "email", "name")` picks only listed columns (never spread unvalidated request bodies); array of objects = bulk insert (columns from first object); UPDATE: `SET ${sql(patch, "status")}`; IN: `WHERE id IN ${sql(ids)}`. Keys must match column names (snake_case).
- Analogy: pre-printed address labels — instead of handwriting every field, hand over the contact card and the printer fills the right boxes; `sql(obj, "email", "name")` = "print only these two lines".
- Code example: `const newUser = { email: "dee@example.com", name: "Dee", password_hash: "x" }; const [created] = await sql\`INSERT INTO users ${sql(newUser, "email", "name", "password_hash")} RETURNING id, email\`; console.log(created);` → `{ id: "4", email: "dee@example.com" }` (assumes 3 dataset users, no gaps); `const rows = await sql\`SELECT name FROM products WHERE id IN ${sql(["1", "3"])} ORDER BY id\`; console.log(rows.map(r => r.name));` → `[ "Notebook", "Backpack" ]`.
- Production use: create endpoints, batch lookups (fixes N+1 in 17).
- Common mistakes: `sql(req.body)` mass-assignment (client sets `role`/`id`); empty array in IN (author: do not claim specific behaviour; tell learner to return early when list is empty).
- Sources: https://bun.com/docs/api/sql

### The src/db module & closing connections
- Concept: `src/db.ts` exports the one pool; repositories import it (or receive it, topic 18). Scripts must `await sql.close()` or process may wait on open connections; `sql.close()` waits for running queries; `sql.close({ timeout: 5 })` waits ≤5 s; `{ timeout: 0 }` immediate; queries after close reject `ERR_POSTGRES_CONNECTION_CLOSED`. Errors: `SQL.PostgresError` with `errno` = SQLSTATE (e.g. "23505"), `code` = Bun code ("ERR_POSTGRES_SERVER_ERROR"), `detail`, `hint` (only these props documented). Server shutdown wiring in 21.
- Analogy: closing time at the taxi rank — let taxis finish current trips (close waits), or give them 5 minutes max (timeout), then lock the gate.
- Code example: `scripts/db-error.ts` — `import { SQL } from "bun"; import { sql } from "../src/db"; try { await sql\`INSERT INTO users (email, name, password_hash) VALUES ('asha@example.com', 'Asha', 'x')\`; } catch (err) { if (err instanceof SQL.PostgresError) console.log(err.code, err.errno); else throw err; } finally { await sql.close({ timeout: 5 }); }` → `ERR_POSTGRES_SERVER_ERROR 23505`.
- Production use: scripts, tests, graceful shutdown.
- Common mistakes: never closing in scripts (hangs); closing the shared pool in a request handler.
- Sources: https://bun.com/docs/api/sql ; https://www.postgresql.org/docs/19/errcodes-appendix.html

## Quiz
1. Why is `sql\`... WHERE email = ${email}\`` safe but `sql.unsafe("..." + email)` not? — tests injection
2. What JS type does a bigint `id` column arrive as? — tests type mapping
3. What does `rows[0]` give when no row matches? — tests empty results
4. Why `sql(body, "email", "name")` instead of `sql(body)`? — tests helpers / mass assignment
5. Which property holds the SQLSTATE in a `SQL.PostgresError`? (errno) — tests errors
