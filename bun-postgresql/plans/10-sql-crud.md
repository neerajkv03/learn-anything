# 10. SQL CRUD Queries
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 09-relational-postgresql

## Learning goals
- Learner can filter rows with WHERE, AND/OR, IN, BETWEEN.
- Learner can sort and page results with ORDER BY, LIMIT, OFFSET and knows LIMIT without ORDER BY is unstable.
- Learner can change and remove rows with UPDATE and DELETE and always uses WHERE.
- Learner can get changed rows back with RETURNING.
- Learner can match text patterns (LIKE, ILIKE) and filter by dates/time ranges.

## Setup
- Uses course dataset from 09: `users` (3), `products` (3), plus an `orders` table without constraints yet: `CREATE TABLE orders (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id bigint NOT NULL, status text NOT NULL, total_cents integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now());` with the 3 dataset orders inserted with explicit created_at. CRUD = Create (INSERT), Read (SELECT), Update, Delete; maps to POST/GET/PATCH/DELETE.

## Sub-topics
### Filtering with WHERE
- Concept: WHERE keeps rows where condition is true; operators `= <> < > <= >=`, `AND`, `OR`, `NOT`, parentheses for precedence (AND binds tighter than OR), `IN ('paid','shipped')`, `BETWEEN a AND b` (inclusive).
- Analogy: sieve at a gold mine — rows pour through; only those matching the mesh (condition) stay in the pan.
- Code example: `SELECT id, status, total_cents FROM orders WHERE user_id = 1 AND status IN ('paid', 'shipped');` → `1 | paid | 4998` `(1 row)`; `SELECT name FROM products WHERE price_cents BETWEEN 100 AND 2500;` → `Notebook`, `Pen` (order not guaranteed without ORDER BY — add `ORDER BY name` → `Notebook`, `Pen`).
- Production use: every "get my orders" query.
- Common mistakes: mixing AND/OR without parentheses; string literal case mismatch (`'Paid'` ≠ `'paid'`).
- Sources: https://www.postgresql.org/docs/19/queries-table-expressions.html#QUERIES-WHERE ; https://www.postgresql.org/docs/19/functions-comparison.html

### Sorting & limiting (ORDER BY, LIMIT, OFFSET)
- Concept: row order undefined unless ORDER BY. `ORDER BY created_at DESC, id DESC` (tie-breaker for stable order). `LIMIT n` caps rows; `OFFSET n` skips — simple page-based pagination; slow for deep pages (keyset in topic 17).
- Analogy: queue at a bank — ORDER BY lines people up by ticket time; LIMIT = "next 2 customers"; OFFSET = "skip the first 2".
- Code example: `SELECT id, created_at FROM orders ORDER BY created_at DESC, id DESC LIMIT 2;` → ids `3`, `2`; `... LIMIT 2 OFFSET 2;` → id `1`.
- Production use: GET /orders?limit=20&offset=40.
- Common mistakes: LIMIT without ORDER BY (random-looking pages); no tie-breaker column.
- Sources: https://www.postgresql.org/docs/19/queries-order.html ; https://www.postgresql.org/docs/19/queries-limit.html

### UPDATE & DELETE
- Concept: `UPDATE t SET col = value, col2 = ... WHERE ...;` `DELETE FROM t WHERE ...;` psql acks `UPDATE n` / `DELETE n` (rows affected). Forgetting WHERE changes/deletes every row. Habit: run the SELECT with the same WHERE first. Soft delete alternative (status 'cancelled') mentioned for orders.
- Analogy: correction fluid and shredder — powerful, but without naming which page (WHERE) you white-out or shred the whole binder.
- Code example: `UPDATE orders SET status = 'paid' WHERE id = 2;` → `UPDATE 1`; `UPDATE products SET stock = stock - 2 WHERE id = 1;` → `UPDATE 1` then stock 8; `DELETE FROM orders WHERE id = 999;` → `DELETE 0`.
- Production use: PATCH /orders/:id, DELETE endpoints.
- Common mistakes: no WHERE; read-then-write races (topic 15 fixes with atomic `SET stock = stock - 2`).
- Sources: https://www.postgresql.org/docs/19/sql-update.html ; https://www.postgresql.org/docs/19/sql-delete.html

### RETURNING
- Concept: `INSERT/UPDATE/DELETE ... RETURNING cols` returns affected rows in the same round trip — get generated id and defaults; zero rows returned = nothing matched → API 404. Core pattern for repositories (topic 13).
- Analogy: receipt from a cashier — you pay (write) and immediately get a printed receipt with the transaction number (generated id).
- Code example: `INSERT INTO orders (user_id, status, total_cents) VALUES (2, 'pending', 2499) RETURNING id, status, created_at IS NOT NULL AS has_created_at;` → `4 | pending | t` (id 4 given dataset of 3 rows and no earlier failed inserts — author state assumption); `UPDATE orders SET status = 'cancelled' WHERE id = 999 RETURNING id;` → `(0 rows)`.
- Production use: POST returns created row; PATCH returns updated row or 404.
- Common mistakes: separate SELECT after INSERT (extra round trip, race); assuming identity values have no gaps (failed inserts consume numbers).
- Sources: https://www.postgresql.org/docs/19/dml-returning.html

### Pattern matching & date filters
- Concept: `LIKE 'a%'` (`%` any run, `_` one char; case-sensitive), `ILIKE` (case-insensitive, PostgreSQL), escape for user input (forward pointer: still use parameters, topic 13). Dates: compare timestamptz with literals `'2026-11-10T00:00:00Z'`; half-open ranges `>= start AND < end` (not BETWEEN for timestamps); `now() - interval '7 days'`; `date_trunc('day', created_at)`.
- Analogy: library search card — `LIKE 'Note%'` = "titles starting with Note"; date range = "books returned from Monday up to (not including) next Monday".
- Code example: `SELECT name FROM products WHERE name ILIKE '%PEN%';` → `Pen`; `SELECT id FROM orders WHERE created_at >= '2026-11-10T00:00:00Z' AND created_at < '2026-11-21T00:00:00Z' ORDER BY id;` → `2`, `3`.
- Production use: search box, "orders this month" reports.
- Common mistakes: `BETWEEN` with timestamps missing end-of-day rows; leading `%` can't use normal index (topic 17).
- Sources: https://www.postgresql.org/docs/19/functions-matching.html#FUNCTIONS-LIKE ; https://www.postgresql.org/docs/19/functions-datetime.html

## Quiz
1. Why add `id DESC` after `ORDER BY created_at DESC`? — tests stable ordering
2. What does `UPDATE orders SET status = 'paid';` do? — tests WHERE safety
3. How does an API know a PATCH target didn't exist using RETURNING? — tests RETURNING
4. Rows for `created_at >= '2026-11-15T00:00:00Z' AND created_at < '2026-11-16T00:00:00Z'`? (order 2) — tests date ranges
5. LIKE vs ILIKE for `'%pen%'` matching `Pen`? — tests pattern matching
