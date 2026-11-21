# 11. Schema Design & Constraints
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 10-sql-crud

## Learning goals
- Learner can protect data with NOT NULL, DEFAULT, UNIQUE and CHECK.
- Learner can link tables with foreign keys and choose ON DELETE CASCADE / RESTRICT / SET NULL.
- Learner can model one-to-many (users → orders).
- Learner can model many-to-many with a junction table (orders ↔ products via order_items).
- Learner can spot repeated data and normalize it.
- Learner knows constraint violations carry SQLSTATE codes (23502, 23505, 23503, 23514) used later in topic 19.

## Final course schema (topic 14 turns it into migrations)
```sql
CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,            -- used in topic 20
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','shipped','cancelled')),
  total_cents integer NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE order_items (
  order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id bigint NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  PRIMARY KEY (order_id, product_id)
);
```
(In topic 11 examples, users may be created without password_hash for brevity only if stated; prefer including `password_hash` with placeholder `'x'`.)

## Sub-topics
### NOT NULL, DEFAULT, UNIQUE & CHECK
- Concept: constraint = rule the database enforces on every write, whatever app wrote it (last line of defence; app validation in 19 is first). NOT NULL; DEFAULT (used when column omitted, e.g. `now()`, `'pending'`); UNIQUE (no duplicates; NULLs don't collide by default); CHECK (boolean expression). Name constraints optional; PostgreSQL auto-names e.g. `users_email_key`, `products_stock_check`. Errors + SQLSTATE: not-null 23502, unique 23505, check 23514.
- Analogy: bouncer rules at the door of a club, enforced no matter which friend brought you — must have ID (NOT NULL), one entry per person (UNIQUE), age ≥ 18 (CHECK), wristband given automatically if you have none (DEFAULT).
- Code example: with schema above: `INSERT INTO users (email, name, password_hash) VALUES ('asha@example.com', 'Asha', 'x');` twice → second: `ERROR:  duplicate key value violates unique constraint "users_email_key"`; `INSERT INTO products (name, price_cents) VALUES ('Broken', -5);` → `ERROR:  new row for relation "products" violates check constraint "products_price_cents_check"`; `INSERT INTO orders (user_id) VALUES (1) RETURNING status, total_cents;` → `pending | 0`.
- Production use: unique email → API 409; CHECK status mirrors TS literal union `OrderStatus`.
- Common mistakes: relying only on app validation; case-sensitive UNIQUE on email (normalize to lowercase in app, topic 19).
- Sources: https://www.postgresql.org/docs/19/ddl-constraints.html ; https://www.postgresql.org/docs/19/errcodes-appendix.html

### Foreign keys & ON DELETE behaviour
- Concept: foreign key = column whose value must exist as a PK in another table (`REFERENCES users(id)`); insert with unknown id → error 23503. ON DELETE: `RESTRICT`/`NO ACTION` (default; refuse delete while referenced), `CASCADE` (delete children), `SET NULL` (column must be nullable). Course choices: orders CASCADE from users (account deletion), order_items RESTRICT on products (can't delete a product that was sold). PostgreSQL does NOT auto-index FK columns (topic 17).
- Analogy: library loan slips — a slip must name a real member (FK); member leaves → CASCADE shreds their slips, RESTRICT says "return books first", SET NULL keeps slip but blanks the name.
- Code example: `INSERT INTO orders (user_id) VALUES (999);` → `ERROR:  insert or update on table "orders" violates foreign key constraint "orders_user_id_fkey"`; `DELETE FROM products WHERE id = 1;` (with order_items referencing it) → `ERROR:  update or delete on table "products" violates foreign key constraint "order_items_product_id_fkey" on table "order_items"`; `DELETE FROM users WHERE id = 2;` → `DELETE 1` and Ben's order 3 + its items gone.
- Production use: no orphan orders; safe product catalog.
- Common mistakes: CASCADE everywhere (accidental mass deletes); forgetting FK index.
- Sources: https://www.postgresql.org/docs/19/ddl-constraints.html#DDL-CONSTRAINTS-FK ; https://www.postgresql.org/docs/19/sql-createtable.html

### One-to-many relationships
- Concept: "one user has many orders" → FK on the many side (`orders.user_id`). Read the relationship both ways. Avoid arrays of ids in parent row.
- Analogy: mother duck and ducklings — each duckling (order) knows its mother (user_id); mother doesn't carry a list.
- Code example: `SELECT id, status FROM orders WHERE user_id = 1 ORDER BY id;` → `1 | paid`, `2 | pending`.
- Production use: users→orders, users→sessions (topic 20).
- Common mistakes: storing `order_ids` array column in users; FK on wrong side.
- Sources: https://www.postgresql.org/docs/19/tutorial-fk.html

### Many-to-many with junction tables
- Concept: an order has many products; a product appears in many orders → junction table `order_items` with two FKs + composite PK `(order_id, product_id)` (one line per product per order) + own data (`quantity`, `unit_price_cents` snapshot — price at purchase time, so later price changes don't rewrite history).
- Analogy: class enrolment sheet — students and courses linked by enrolment rows; each row also stores the grade (extra data).
- Code example: insert dataset order_items; `SELECT product_id, quantity, unit_price_cents FROM order_items WHERE order_id = 3 ORDER BY product_id;` → `2 | 2 | 199`, `3 | 1 | 4999`; duplicate `(3, 2)` insert → unique violation on `order_items_pkey`.
- Production use: cart/order lines, tags, roles.
- Common mistakes: comma-separated id lists in a text column; not snapshotting price.
- Sources: https://www.postgresql.org/docs/19/ddl-constraints.html#DDL-CONSTRAINTS-PRIMARY-KEYS

### Normalization basics
- Concept: store each fact once; repeated data drifts (update anomaly). Show bad table `orders_flat(order_id, customer_email, customer_name, product_name, product_price)` → Asha's name repeated; rename needs many updates. Split into users/products/orders/order_items. Pragmatic: deliberate denormalization (`total_cents` cached on orders, `unit_price_cents` snapshot) with reason.
- Analogy: one master contacts list on your phone instead of writing a friend's number on every note — change it once, it's right everywhere.
- Code example: flat table with 3 rows where Asha appears twice; `UPDATE orders_flat SET customer_name = 'Asha K' WHERE order_id = 1;` → now two different names for one email (show SELECT result `Asha K`, `Asha`). Normalized: one UPDATE on users.
- Production use: clean schema = simpler queries and fewer bugs.
- Common mistakes: over-normalizing tiny lookups; copying user data into orders without reason.
- Sources: https://www.postgresql.org/docs/19/ddl.html ; https://en.wikipedia.org/wiki/Database_normalization

## Quiz
1. Which constraint stops two accounts with the same email, and which SQLSTATE does it raise? (UNIQUE, 23505) — tests UNIQUE
2. Deleting a product that has order_items with ON DELETE RESTRICT → ? — tests FK behaviour
3. Where does the FK go for users→orders? — tests one-to-many
4. Why store `unit_price_cents` in order_items? — tests junction data/snapshot
5. What problem does repeating customer_name in every order row cause? — tests normalization
