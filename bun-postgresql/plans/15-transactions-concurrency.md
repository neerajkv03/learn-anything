# 15. Transactions & Concurrency
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 14-migrations

## Learning goals
- Learner can explain ACID and why multi-step writes need a transaction.
- Learner can use BEGIN / COMMIT / ROLLBACK in psql.
- Learner can write transactions with `sql.begin(async tx => ...)` and savepoints with `tx.savepoint`.
- Learner can spot a lost-update race and fix it with an atomic UPDATE or `SELECT ... FOR UPDATE`.
- Learner knows READ COMMITTED (default), REPEATABLE READ, SERIALIZABLE and when to retry (40001).

## Sub-topics
### ACID & why transactions matter
- Concept: transaction = group of statements that succeed or fail as one. ACID: Atomicity (all or nothing), Consistency (constraints hold), Isolation (concurrent transactions don't see each other's half-done work), Durability (committed = survives crash). Order placement = insert order + insert items + decrement stock + set total → must be one transaction. Every single statement is already its own transaction (autocommit).
- Analogy: bank transfer — taking £50 from one account and adding to another must both happen or neither; a crash between steps must not make money vanish.
- Code example: failure story without tx: order row inserted, stock update fails CHECK (stock would go negative) → orphan order left. With tx: nothing remains. Show `SELECT count(*) FROM orders` before/after → `3` both times in tx version.
- Production use: checkout, transfers, migrations (14).
- Common mistakes: running related writes as separate queries; long transactions holding locks while calling external APIs.
- Sources: https://www.postgresql.org/docs/19/tutorial-transactions.html ; https://www.postgresql.org/docs/19/glossary.html#GLOSSARY-ACID

### BEGIN / COMMIT / ROLLBACK
- Concept: psql: `BEGIN;` ... `COMMIT;` saves, `ROLLBACK;` discards. After an error inside a tx, PostgreSQL rejects further statements (`ERROR:  current transaction is aborted, commands ignored until end of transaction block`) until ROLLBACK. Other sessions don't see uncommitted rows.
- Analogy: shopping cart vs checkout — BEGIN fills the cart, COMMIT pays, ROLLBACK puts everything back on the shelves; others don't see items as sold until you pay.
- Code example: psql: `BEGIN; UPDATE products SET stock = stock - 2 WHERE id = 1; SELECT stock FROM products WHERE id = 1;` → `8`; `ROLLBACK; SELECT stock FROM products WHERE id = 1;` → `10`.
- Production use: understanding what Bun.sql sends for you.
- Common mistakes: forgetting COMMIT in psql (changes vanish on exit); continuing after an error inside a tx.
- Sources: https://www.postgresql.org/docs/19/sql-begin.html ; https://www.postgresql.org/docs/19/sql-rollback.html

### Transactions in Bun.sql (sql.begin) & savepoints
- Concept: `await sql.begin(async tx => { ... return value; })` — Bun sends BEGIN, runs callback on one reserved connection, COMMITs if it resolves, ROLLBACKs and rejects with the error if it throws; resolves to callback's return value. Use `tx` (not `sql`) for every query inside — `sql` would run on another connection outside the tx. Queries on `tx` after it ends reject (`ERR_POSTGRES_INVALID_TRANSACTION_STATE`). Savepoint: `await tx.savepoint(async sp => {...})` — throw inside rolls back only to the savepoint; catch around it to continue. Repository functions take a `db: SQL` parameter (`import type { SQL } from "bun"`) so they run with either `sql` or `tx` (pattern used in 18). Claim only "works with both"; accuracy reviewer confirms the tx type is assignable to `SQL` in Bun's types.
- Analogy: sealed envelope at the post office — everything inside (queries) is posted together; if one page is wrong, the clerk hands back the whole envelope (rollback). Savepoint = paper clip on one section you can remove without redoing the whole letter.
- Code example: `src/services/orders.service.ts` `placeOrder` core — `export async function placeOrder(userId: string, productId: string, quantity: number) { return sql.begin(async tx => { const [product]: { price_cents: number }[] = await tx\`UPDATE products SET stock = stock - ${quantity} WHERE id = ${productId} AND stock >= ${quantity} RETURNING price_cents\`; if (!product) throw new Error("out of stock"); const total = product.price_cents * quantity; const [order]: { id: string }[] = await tx\`INSERT INTO orders (user_id, status, total_cents) VALUES (${userId}, 'pending', ${total}) RETURNING id\`; await tx\`INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (${order!.id}, ${productId}, ${quantity}, ${product.price_cents})\`; return { orderId: order!.id, totalCents: total }; }); }` → `placeOrder("3", "3", 2)` with Backpack stock 5 → `{ orderId: "4", totalCents: 9998 }`, stock 3; `placeOrder("3", "3", 10)` → rejects `out of stock`, no order row. (Error type becomes AppError in 19.) Savepoint demo: inside tx, `try { await tx.savepoint(async sp => { await sp\`INSERT INTO order_items ... duplicate PK\`; }); } catch { console.log("line skipped"); }` → `line skipped` and outer tx still commits.
- Production use: every multi-write service method.
- Common mistakes: using `sql` instead of `tx` inside callback; not awaiting queries inside callback; catching errors inside tx and continuing without savepoint.
- Sources: https://bun.com/docs/api/sql ; https://www.postgresql.org/docs/19/sql-savepoint.html

### Race conditions & row locks (SELECT ... FOR UPDATE)
- Concept: race = result depends on timing of concurrent requests. Lost update: two requests read stock 1, both see enough, both write → stock -1 (or oversell). Fixes: (1) atomic conditional UPDATE (`SET stock = stock - $q WHERE stock >= $q`, used above) — preferred; (2) `SELECT ... FOR UPDATE` inside tx locks rows until commit — others wait; use when logic needs to read then decide in code. Lock in consistent order to avoid deadlock (gloss: two transactions each waiting for the other; PostgreSQL detects and aborts one, SQLSTATE 40P01).
- Analogy: last concert ticket — two cashiers both see "1 left" and both sell it; FOR UPDATE = the first cashier puts a hand on the ticket, the second waits until the sale finishes and then sees "0 left".
- Code example: timeline table, two sessions A/B in psql: A `BEGIN; SELECT stock FROM products WHERE id = 3 FOR UPDATE;` → `5`; B `BEGIN; SELECT stock FROM products WHERE id = 3 FOR UPDATE;` → waits; A `UPDATE products SET stock = stock - 5 WHERE id = 3; COMMIT;`; B unblocks → `0`. Bun version: `const [p]: { stock: number }[] = await tx\`SELECT stock FROM products WHERE id = ${id} FOR UPDATE\`;`.
- Production use: inventory, balances, seat booking.
- Common mistakes: read-check-write without lock or atomic update; FOR UPDATE outside a transaction (lock released immediately).
- Sources: https://www.postgresql.org/docs/19/explicit-locking.html#LOCKING-ROWS ; https://www.postgresql.org/docs/19/sql-select.html#SQL-FOR-UPDATE-SHARE

### Isolation levels in practice
- Concept: READ COMMITTED (PostgreSQL default; each statement sees data committed before it started), REPEATABLE READ (whole tx sees one snapshot; may fail with serialization error), SERIALIZABLE (as if one at a time; may fail with SQLSTATE 40001 → retry whole tx). Set inside tx as first statement: `await tx\`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE\`` (Bun.sql begin option strings undocumented — version notes). Retry helper with max 3 attempts on errno `40001`. Default stance: READ COMMITTED + atomic updates/locks.
- Analogy: photos vs live video of a shop shelf — READ COMMITTED looks at the live feed before each step; REPEATABLE READ works from one photo taken at the start; SERIALIZABLE = referee who cancels your turn if someone else's change would make your photo wrong — try again.
- Code example: `withSerializableRetry` — `import { SQL } from "bun"; export async function withSerializableRetry<T>(fn: (tx: SQL) => Promise<T>, attempts = 3): Promise<T> { for (let i = 1; ; i++) { try { return await sql.begin(async tx => { await tx\`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE\`; return fn(tx); }); } catch (err) { if (err instanceof SQL.PostgresError && err.errno === "40001" && i < attempts) continue; throw err; } } }`. `SHOW transaction_isolation;` in psql → `read committed`.
- Production use: financial invariants spanning several rows.
- Common mistakes: SERIALIZABLE without retry; setting isolation after first query (error: must be called before any query).
- Sources: https://www.postgresql.org/docs/19/transaction-iso.html ; https://www.postgresql.org/docs/19/sql-set-transaction.html ; https://bun.com/docs/api/sql

## Quiz
1. Which ACID letter is broken if an order row exists without its items after a crash? — tests ACID
2. What happens to queries run with `sql` (not `tx`) inside `sql.begin`? — tests Bun tx usage
3. Two requests buy the last Backpack — how does `WHERE stock >= ${q}` prevent overselling? — tests atomic update
4. What does B see after A commits in the FOR UPDATE timeline? (`0`) — tests row locks
5. What SQLSTATE means "retry this serializable transaction"? (40001) — tests isolation
