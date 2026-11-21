# 12. Joins & Aggregation
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 11-schema-constraints

## Learning goals
- Learner can combine tables with INNER JOIN and predict which rows survive.
- Learner can keep unmatched rows with LEFT JOIN and handle resulting NULLs.
- Learner can join 3+ tables using short aliases.
- Learner can summarize with COUNT, SUM, AVG and knows `count(*)` vs `count(col)`.
- Learner can group with GROUP BY and filter groups with HAVING (vs WHERE).

## Setup
- Full schema from 11, full course dataset from 09 (users 1-3, products 1-3, orders 1-3, 4 order_items). All outputs below assume exactly that data.

## Sub-topics
### INNER JOIN
- Concept: `FROM orders JOIN users ON users.id = orders.user_id` pairs rows where ON is true; unmatched rows dropped. `JOIN` = `INNER JOIN`. Always qualify columns (`orders.id`).
- Analogy: matching socks from two drawers — only socks with a partner (matching id) come out as pairs; lone socks stay in the drawer.
- Code example: `SELECT orders.id, users.name, orders.status FROM orders JOIN users ON users.id = orders.user_id ORDER BY orders.id;` → `1 | Asha | paid`, `2 | Asha | pending`, `3 | Ben | shipped` `(3 rows)` — Chen absent.
- Production use: order list with customer names.
- Common mistakes: ambiguous column `id` error (`column reference "id" is ambiguous`); missing ON condition (cross join explosion).
- Sources: https://www.postgresql.org/docs/19/tutorial-join.html ; https://www.postgresql.org/docs/19/queries-table-expressions.html#QUERIES-JOIN

### LEFT JOIN
- Concept: keeps every left row; right columns NULL when no match. Find "users with no orders": `WHERE orders.id IS NULL`. Filter on right table inside ON, not WHERE, to keep left rows (common trap).
- Analogy: class attendance list — every student is listed (left), with their homework if handed in; empty box for those who didn't.
- Code example: `SELECT users.name, orders.id AS order_id FROM users LEFT JOIN orders ON orders.user_id = users.id ORDER BY users.id, orders.id;` → `Asha | 1`, `Asha | 2`, `Ben | 3`, `Chen | ` (NULL blank) `(4 rows)`; `... WHERE orders.id IS NULL` → `Chen`.
- Production use: dashboards that must show zero-order customers.
- Common mistakes: `WHERE orders.status = 'paid'` after LEFT JOIN silently turns it into INNER.
- Sources: https://www.postgresql.org/docs/19/queries-table-expressions.html#QUERIES-JOIN

### Joining several tables & aliases
- Concept: chain joins; aliases `FROM orders o JOIN users u ON u.id = o.user_id`; join junction to reach products; line total expression `oi.quantity * oi.unit_price_cents`.
- Analogy: connecting flights — orders → order_items → products; each JOIN is a layover with a matching gate number.
- Code example: `SELECT o.id AS order_id, u.name AS customer, p.name AS product, oi.quantity, oi.quantity * oi.unit_price_cents AS line_cents FROM orders o JOIN users u ON u.id = o.user_id JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id ORDER BY o.id, p.id;` → `1 | Asha | Notebook | 2 | 4998`, `2 | Asha | Pen | 1 | 199`, `3 | Ben | Pen | 2 | 398`, `3 | Ben | Backpack | 1 | 4999` `(4 rows)`.
- Production use: order detail endpoint.
- Common mistakes: alias then using full name (`orders.id` after aliasing → error `invalid reference to FROM-clause entry for table "orders"`); row duplication when joining two one-to-many tables at once.
- Sources: https://www.postgresql.org/docs/19/queries-table-expressions.html#QUERIES-TABLE-ALIASES

### COUNT, SUM, AVG
- Concept: aggregate = many rows → one value. `count(*)` rows, `count(col)` non-NULL values, `sum`, `avg`, `min`, `max`; aggregates ignore NULLs; `sum` of no rows = NULL → `coalesce(sum(x), 0)`. Types: `count` returns bigint, `sum(integer)` returns bigint, `avg` returns numeric — Bun.sql turns bigint/numeric into strings (version notes) → cast `count(*)::int` when safe (forward pointer 13). `round(avg(x))`.
- Analogy: cashier's end-of-day tally — counts receipts, adds totals, works out average sale; blank receipts (NULL) are skipped.
- Code example: `SELECT count(*) AS orders, sum(total_cents) AS revenue_cents, round(avg(total_cents)) AS avg_cents FROM orders;` → `3 | 10594 | 3531` (4998+199+5397=10594; 10594/3=3531.33 → 3531); `SELECT coalesce(sum(total_cents), 0) FROM orders WHERE user_id = 3;` → `0`.
- Production use: totals, stats endpoints.
- Common mistakes: `count(col)` when meaning rows; forgetting NULL sum; expecting JS number for bigint.
- Sources: https://www.postgresql.org/docs/19/functions-aggregate.html ; https://www.postgresql.org/docs/19/tutorial-agg.html

### GROUP BY & HAVING
- Concept: GROUP BY makes one output row per group; every selected non-aggregate column must be grouped. WHERE filters rows before grouping; HAVING filters groups after. Order of evaluation: FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT.
- Analogy: sorting laundry into piles by colour (GROUP BY), counting each pile, then only washing piles with more than 5 items (HAVING); socks with holes were thrown out before sorting (WHERE).
- Code example: `SELECT u.name, count(o.id)::int AS order_count, coalesce(sum(o.total_cents), 0) AS spent_cents FROM users u LEFT JOIN orders o ON o.user_id = u.id GROUP BY u.id, u.name ORDER BY u.id;` → `Asha | 2 | 5197`, `Ben | 1 | 5397`, `Chen | 0 | 0`; add `HAVING count(o.id) >= 2` → `Asha | 2 | 5197` only.
- Production use: per-customer stats, admin reports.
- Common mistakes: `column "u.name" must appear in the GROUP BY clause or be used in an aggregate function`; aggregate in WHERE (`aggregate functions are not allowed in WHERE`).
- Sources: https://www.postgresql.org/docs/19/queries-table-expressions.html#QUERIES-GROUP ; https://www.postgresql.org/docs/19/sql-select.html

## Quiz
1. Why is Chen missing from the INNER JOIN but present in the LEFT JOIN? — tests join types
2. What breaks if you put `WHERE o.status = 'paid'` after a LEFT JOIN? — tests LEFT JOIN filter trap
3. `count(*)` vs `count(o.id)` for Chen in a LEFT JOIN? (1 vs 0) — tests counting
4. WHERE vs HAVING: which can use `sum(...)`? — tests grouping order
5. Total revenue of the dataset? (10594 cents) — tests SUM
