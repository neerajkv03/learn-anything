# 17. Indexes & Query Performance
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 16-upserts-jsonb

## Learning goals
- Learner can explain how a B-tree index speeds lookups and what it costs on writes.
- Learner can create single-column, composite and unique indexes and choose column order.
- Learner can read EXPLAIN / EXPLAIN ANALYZE output (Seq Scan vs Index Scan, rows, actual time).
- Learner can spot and fix the N+1 query problem in Bun code.
- Learner can implement keyset (cursor) pagination for GET /orders.

## Setup
- Demo data needs volume: `INSERT INTO orders (user_id, status, total_cents, created_at) SELECT 1 + (g % 3), 'paid', 1000 + (g % 5000), now() - (g || ' minutes')::interval FROM generate_series(1, 200000) AS g; ANALYZE orders;` (gloss generate_series = row generator; ANALYZE = refresh planner statistics). All EXPLAIN outputs are illustrative: costs/times differ per machine — author must label them so and only assert node types (Seq Scan / Index Scan / Bitmap Heap Scan) qualitatively. Bulk data applies to the EXPLAIN sub-topics only; N+1 and keyset examples use the plain 09 dataset.

## Sub-topics
### How a B-tree index works
- Concept: without index, PostgreSQL reads every row (sequential scan). Index = separate sorted structure (B-tree: balanced tree of sorted keys pointing to rows) → finds matches in few steps; supports `=`, `<`, `>`, `BETWEEN`, `ORDER BY`, prefix `LIKE 'abc%'` (with C collation or text_pattern_ops — mention only). Costs: disk space, slower INSERT/UPDATE (every index updated). PK and UNIQUE create indexes automatically; FKs don't.
- Analogy: index at the back of a textbook — find "transactions, page 212" instantly instead of reading every page; but every new edition must update the index too.
- Code example: `SELECT indexname FROM pg_indexes WHERE tablename = 'users' ORDER BY indexname;` → `users_email_key`, `users_pkey`.
- Production use: every frequent WHERE/JOIN/ORDER BY column considered.
- Common mistakes: indexing everything; forgetting FK columns (`orders.user_id`).
- Sources: https://www.postgresql.org/docs/19/indexes-intro.html ; https://www.postgresql.org/docs/19/indexes-types.html#INDEXES-TYPES-BTREE

### Single, composite & unique indexes
- Concept: `CREATE INDEX name ON t (col)`; composite `(user_id, created_at DESC, id DESC)` serves `WHERE user_id = ? ORDER BY created_at DESC, id DESC` — leftmost-prefix rule (usable for `user_id` alone, not for `created_at` alone). `CREATE UNIQUE INDEX` (e.g. `lower(email)` expression index for case-insensitive uniqueness — mention). `CREATE INDEX CONCURRENTLY` avoids blocking writes on big tables but can't run inside a transaction → our runner wraps files in transactions, so note: for large prod tables run it separately (known ceiling). Migration `0005_indexes.sql`: `CREATE INDEX orders_user_id_created_at_idx ON orders (user_id, created_at DESC, id DESC); CREATE INDEX order_items_product_id_idx ON order_items (product_id);` (order_items PK already starts with order_id).
- Analogy: phone book sorted by surname then first name — great for "all Smiths" or "Smith, John", useless for "everyone named John".
- Code example: the migration above; `SELECT indexname FROM pg_indexes WHERE tablename = 'orders' ORDER BY indexname;` → `orders_pkey`, `orders_user_id_created_at_idx`.
- Production use: matching indexes to the API's actual queries.
- Common mistakes: wrong column order in composite; duplicate indexes; CONCURRENTLY inside a transaction (`ERROR:  CREATE INDEX CONCURRENTLY cannot run inside a transaction block`).
- Sources: https://www.postgresql.org/docs/19/indexes-multicolumn.html ; https://www.postgresql.org/docs/19/sql-createindex.html

### Reading EXPLAIN & EXPLAIN ANALYZE
- Concept: `EXPLAIN` shows the planner's plan + estimates (cost=startup..total, rows, width); `EXPLAIN ANALYZE` runs the query and adds actual time/rows/loops (runs writes too — wrap in BEGIN/ROLLBACK). Read bottom-up/innermost first. Node types: Seq Scan, Index Scan, Index Only Scan, Bitmap Heap Scan, Nested Loop, Hash Join, Sort. Signs of trouble: Seq Scan on big table with selective filter, estimates far from actuals (run ANALYZE). PG19: `EXPLAIN (ANALYZE, IO)` option reports async I/O (version notes) — mention. Small tables: Seq Scan is correct choice.
- Analogy: GPS route preview — EXPLAIN = suggested route with estimated time; EXPLAIN ANALYZE = actually driving it with a stopwatch.
- Code example: before index: `EXPLAIN ANALYZE SELECT id FROM orders WHERE user_id = 2 ORDER BY created_at DESC, id DESC LIMIT 20;` → illustrative plan containing `Seq Scan on orders` under a Sort/Limit; after `0005_indexes.sql` → plan containing `Index Scan using orders_user_id_created_at_idx on orders` under Limit, with lower `Execution Time`. Show plan text shape, label numbers illustrative.
- Production use: diagnosing slow endpoints; check before adding indexes.
- Common mistakes: EXPLAIN ANALYZE on a DELETE without rollback; judging on a tiny dev table.
- Sources: https://www.postgresql.org/docs/19/using-explain.html ; https://www.postgresql.org/docs/19/sql-explain.html

### The N+1 query problem
- Concept: 1 query for a list + 1 query per item = N+1 round trips; latency adds up (each ~ms network). Fix: one batched query with `IN ${sql(ids)}` then group in JS, or JSON aggregation in SQL (16). Detect by logging query counts.
- Analogy: shopping trip — driving to the store once per item on your list vs once with the whole list.
- Code example: `n-plus-one.ts` — bad: `const orders: { id: string }[] = await sql\`SELECT id FROM orders WHERE user_id = ${"1"} ORDER BY id LIMIT 2\`; for (const o of orders) { const items = await sql\`SELECT product_id FROM order_items WHERE order_id = ${o.id}\`; }` → 3 queries; good: `const ids = orders.map(o => o.id); const items: { order_id: string; product_id: string }[] = ids.length === 0 ? [] : await sql\`SELECT order_id, product_id FROM order_items WHERE order_id IN ${sql(ids)} ORDER BY order_id, product_id\`; const byOrder = new Map<string, string[]>(); for (const i of items) { const list = byOrder.get(i.order_id) ?? []; list.push(i.product_id); byOrder.set(i.order_id, list); } console.log(byOrder.get("1"), byOrder.get("2"));` → `[ "1" ] [ "2" ]` on 09 dataset (order 1 Notebook line, order 2 Pen line) → 2 queries total. Gloss `Map` (key → value lookup table).
- Production use: list endpoints with nested data.
- Common mistakes: awaiting queries inside loops; empty IN list (guard as shown).
- Sources: https://bun.com/docs/api/sql ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy

### Keyset (cursor) pagination
- Concept: OFFSET n still reads and discards n rows (slow deep pages; rows shift when new data arrives). Keyset: remember last row's sort key (`created_at`, `id`) and ask for rows "after" it: `WHERE (created_at, id) < (${cursorCreatedAt}, ${cursorId}) ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}` (row-value comparison; uses composite index). Fetch limit+1 to know if there's a next page. Cursor = opaque string: base64url of JSON `{"c":"2026-11-15T09:30:00.000Z","i":"2"}` via `Buffer.from(JSON.stringify(x)).toString("base64url")`. Response shape `{ "data": [...], "nextCursor": "..." | null }`. Validate decoded cursor (19). For user-scoped list add `user_id = ${userId}` (index leading column).
- Analogy: bookmark in a novel — you continue from the bookmark instead of counting pages from the start each time.
- Code example: repository `listOrdersPage(db, userId, limit, cursor)`; with 09 dataset (user 1: orders 2 then 1 by created_at DESC), limit 1, no cursor → `{ data: [order 2], nextCursor: <base64url of {"c":"2026-11-15T09:30:00.000Z","i":"2"}> }`; next call with that cursor → `{ data: [order 1], nextCursor: null }`. Author computes exact base64url string by hand only if certain; else show decoded JSON and say "encoded with base64url".
- Production use: infinite scroll, mobile feeds, admin lists.
- Common mistakes: cursor on a non-unique column only (duplicates/skips); mismatched ORDER BY and comparison direction.
- Sources: https://www.postgresql.org/docs/19/functions-comparisons.html#ROW-WISE-COMPARISON ; https://www.postgresql.org/docs/19/queries-limit.html

## Quiz
1. Why does a 3-row table show Seq Scan even with an index? — tests planner basics
2. Composite index `(user_id, created_at)`: helps `WHERE created_at > ...` alone? — tests leftmost prefix
3. EXPLAIN vs EXPLAIN ANALYZE: which runs the query? — tests EXPLAIN
4. How many queries does the bad N+1 loop run for 50 orders? (51) — tests N+1
5. Why fetch `limit + 1` rows in keyset pagination? — tests cursor pagination
