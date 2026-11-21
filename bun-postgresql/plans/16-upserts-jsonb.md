# 16. Upserts, JSONB & Shaping JSON in SQL
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 15-transactions-concurrency

## Learning goals
- Learner can write `INSERT ... ON CONFLICT DO NOTHING / DO UPDATE` using `EXCLUDED`, and knows PostgreSQL 19's `DO SELECT`.
- Learner can store and query flexible data in a `jsonb` column with `->`, `->>`, `@>`, `||`.
- Learner can build API-shaped nested JSON in one query with `json_build_object` and `json_agg`.
- Learner can structure a complex query with a CTE (`WITH`).

## Sub-topics
### Upserts with INSERT ... ON CONFLICT
- Concept: upsert = insert, or if it collides with a unique/PK constraint, do something else — atomically (no read-then-write race from 15). `ON CONFLICT (cols) DO NOTHING`; `DO UPDATE SET col = EXCLUDED.col` (`EXCLUDED` = the row you tried to insert); conflict target must match a unique index/constraint; optional `WHERE` on DO UPDATE. PostgreSQL 19: `ON CONFLICT DO SELECT ... RETURNING` returns the existing conflicting row (optionally locked `FOR UPDATE`) — mention briefly, cite release notes, no deep example. RETURNING works with upserts.
- Analogy: hotel check-in desk — new guest gets a new room card (insert); returning guest with an existing booking gets their booking updated instead of a duplicate room.
- Code example: add-to-cart style on order_items: `INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (2, 2, 3, 199) ON CONFLICT (order_id, product_id) DO UPDATE SET quantity = order_items.quantity + EXCLUDED.quantity RETURNING quantity;` → `4` (dataset: order 2 has 1 Pen); `INSERT INTO users (email, name, password_hash) VALUES ('asha@example.com', 'Asha', 'x') ON CONFLICT (email) DO NOTHING RETURNING id;` → `(0 rows)`. Bun: same SQL in tagged template with `${}` values.
- Production use: idempotent writes, counters, seeds (14), "set preference".
- Common mistakes: conflict target without matching unique constraint (`ERROR:  there is no unique or exclusion constraint matching the ON CONFLICT specification`); expecting RETURNING rows from DO NOTHING on conflict.
- Sources: https://www.postgresql.org/docs/19/sql-insert.html#SQL-ON-CONFLICT ; https://www.postgresql.org/docs/19/release-19.html

### JSONB columns & operators
- Concept: `jsonb` = binary JSON column for flexible, schema-light data (order metadata: gift wrap, source app); keep core fields as real columns. Migration `0004_orders_metadata.sql`: `ALTER TABLE orders ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;`. Operators: `->` (get JSON value), `->>` (get as text), `@>` (contains; GIN-indexable — mention), `||` (merge), `- 'key'` (remove key), `jsonb_set`. Bun.sql returns jsonb parsed to JS object (version notes). Writing: pass `${JSON.stringify(meta)}::jsonb` (explicit; avoids guessing driver serialization).
- Analogy: a labelled column in a filing cabinet vs a "notes" envelope — real columns are fixed labelled boxes; jsonb = envelope where you can tuck extra notes and still search inside.
- Code example: `UPDATE orders SET metadata = metadata || '{"giftWrap": true, "source": "mobile"}'::jsonb WHERE id = 1;` then `SELECT id, metadata->>'source' AS source, metadata->'giftWrap' AS gift FROM orders WHERE metadata @> '{"giftWrap": true}';` → `1 | mobile | true`. Bun: `const [o] = await sql\`SELECT metadata FROM orders WHERE id = ${"1"}\`; console.log(o.metadata.source);` → `mobile`.
- Production use: integration payloads, feature flags per row.
- Common mistakes: putting everything in jsonb (loses constraints/types); `->` vs `->>` confusion (JSON vs text); `json` instead of `jsonb`.
- Sources: https://www.postgresql.org/docs/19/datatype-json.html ; https://www.postgresql.org/docs/19/functions-json.html

### Building API-shaped JSON in SQL (json_build_object, json_agg)
- Concept: `json_build_object('key', expr, ...)` builds an object; `json_agg(expr ORDER BY ...)` turns rows into an array; with GROUP BY returns nested API shape in one query (one round trip, fixes N+1 preview for 17). LEFT JOIN with no items → `json_agg` yields `[null]`-style issue → use `FILTER (WHERE oi.order_id IS NOT NULL)` + `coalesce(..., '[]'::json)`. Keys in camelCase directly. Bun returns json parsed.
- Analogy: packing a lunchbox in the kitchen instead of handing the customer loose ingredients — the database assembles the meal (nested JSON) so the API just serves it.
- Code example: `SELECT json_build_object('id', o.id::text, 'status', o.status, 'totalCents', o.total_cents, 'items', coalesce(json_agg(json_build_object('productId', oi.product_id::text, 'name', p.name, 'quantity', oi.quantity) ORDER BY oi.product_id) FILTER (WHERE oi.order_id IS NOT NULL), '[]'::json)) AS order_json FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id LEFT JOIN products p ON p.id = oi.product_id WHERE o.id = 3 GROUP BY o.id;` → psql: `{"id" : "3", "status" : "shipped", "totalCents" : 5397, "items" : [{"productId" : "2", "name" : "Pen", "quantity" : 2}, {"productId" : "3", "name" : "Backpack", "quantity" : 1}]}` (`::text` keeps ids as strings, matching the API's bigint-as-string convention from 13). In Bun, `row.order_json` is already a parsed JS object. Use alias `order_json`, not `order` (reserved word).
- Production use: order detail endpoint in 18.
- Common mistakes: forgetting GROUP BY; `[null]` items for orders without lines; ordering lost without `ORDER BY` inside `json_agg`.
- Sources: https://www.postgresql.org/docs/19/functions-json.html#FUNCTIONS-JSON-CREATION-TABLE ; https://www.postgresql.org/docs/19/functions-aggregate.html

### Common table expressions (WITH)
- Concept: `WITH name AS (SELECT ...) SELECT ... FROM name` — named sub-query, read top to bottom; several CTEs comma-separated; data-modifying CTE (`WITH moved AS (UPDATE ... RETURNING ...)`) mention. Readability over nested sub-queries.
- Analogy: recipe prep steps — "first, make the sauce (CTE); then pour it over pasta" instead of one giant run-on instruction.
- Code example: `WITH user_totals AS (SELECT user_id, sum(total_cents) AS spent FROM orders GROUP BY user_id) SELECT u.name, ut.spent FROM user_totals ut JOIN users u ON u.id = ut.user_id WHERE ut.spent > 5000 ORDER BY ut.spent DESC;` → `Ben | 5397`, `Asha | 5197`.
- Production use: reports, multi-step queries in repositories.
- Common mistakes: assuming CTE is always cached/materialized (PostgreSQL may inline it — mention `MATERIALIZED` keyword exists); overly long CTE chains instead of simpler joins.
- Sources: https://www.postgresql.org/docs/19/queries-with.html

## Quiz
1. In `DO UPDATE SET quantity = order_items.quantity + EXCLUDED.quantity`, what is EXCLUDED? — tests upserts
2. `metadata->'source'` vs `metadata->>'source'`: which returns text? — tests jsonb operators
3. Why use `FILTER (WHERE oi.order_id IS NOT NULL)` with `json_agg` after a LEFT JOIN? — tests JSON shaping
4. What does `WITH` give you compared to a nested sub-query? — tests CTEs
5. When should a field be a real column instead of inside jsonb? — tests jsonb design
