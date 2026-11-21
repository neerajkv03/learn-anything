# 09. Relational Databases & PostgreSQL
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 08-http-bun-serve

## Learning goals
- Learner can explain what a relational database and SQL are and why the API needs one.
- Learner can describe tables, rows, columns and schema.
- Learner can choose PostgreSQL types: text, integer, bigint, numeric, boolean, timestamptz, uuid.
- Learner can define a primary key with an identity column.
- Learner can write CREATE TABLE, INSERT and SELECT and read psql output.
- Learner can explain NULL and three-valued logic (`IS NULL`, not `= NULL`).

## Course dataset (canonical; topics 10-17 reuse it)
- users: (1, 'asha@example.com', 'Asha'), (2, 'ben@example.com', 'Ben'), (3, 'chen@example.com', 'Chen') — Chen has no orders.
- products: (1, 'Notebook', 2499 cents, stock 10), (2, 'Pen', 199, 100), (3, 'Backpack', 4999, 5).
- orders: (1, user 1, 'paid', 4998, created '2026-11-01 10:00:00+00'), (2, user 1, 'pending', 199, '2026-11-15 09:30:00+00'), (3, user 2, 'shipped', 5397, '2026-11-20 14:00:00+00').
- order_items (topic 11+): (order 1, product 1, qty 2, unit 2499), (2, 2, 1, 199), (3, 3, 1, 4999), (3, 2, 2, 199).
- In this topic only `users` and a simple `products` table are created; full schema with constraints arrives in 11, migrations in 14.

## Sub-topics
### What a relational database is
- Concept: database = program that stores data safely on disk and answers questions about it; many clients at once; survives restarts (fixes topic 08's in-memory loss). Relational = data in tables linked by matching values (keys). SQL = language to define and query data (declarative: say what, not how). PostgreSQL 19.0 = open-source relational database server; app connects over network with a URL (`postgres://user:password@host:5432/dbname`). `psql` = PostgreSQL's terminal client used in topics 09-12 (comes with PostgreSQL; no install steps). Database vs server vs schema (namespace; default `public`).
- Analogy: library with a card catalogue — books (data) on shelves, librarian (PostgreSQL) fetches what you ask for in a formal request slip (SQL); many readers at once; catalogue cards link authors to books (relations).
- Code example: `psql "postgres://app:app_password@localhost:5432/orders_dev"` then `SELECT version();` → one row starting `PostgreSQL 19.0` (rest platform-specific; author must not invent the rest). `\q` quits.
- Production use: single source of truth for users and orders.
- Common mistakes: confusing database server with a database inside it; thinking SQL is the database.
- Sources: https://www.postgresql.org/docs/19/tutorial-concepts.html ; https://www.postgresql.org/docs/19/app-psql.html

### Tables, rows & columns
- Concept: table = one kind of thing (users); column = one attribute with a fixed type (email); row = one item (Asha). Schema = the set of table definitions. Naming: lowercase `snake_case`, plural tables. Every row same columns. Mapping to TS: one row ↔ one object; column `price_cents` ↔ property (camelCase conversion in repositories, topic 13).
- Analogy: spreadsheet with strict rules — sheet = table, header = columns, each line = row; but unlike a spreadsheet, a column marked "number" refuses text.
- Code example: show users table as psql-style grid (id | email | name) with the 3 dataset rows and `(3 rows)` footer.
- Production use: one table per entity: users, products, orders, order_items, sessions.
- Common mistakes: one giant table with repeated data (fixed in 11); camelCase column names (need quoting in PostgreSQL).
- Sources: https://www.postgresql.org/docs/19/tutorial-table.html ; https://www.postgresql.org/docs/19/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS

### PostgreSQL data types (text, integer, bigint, numeric, boolean, timestamptz, uuid)
- Concept: `text` (any length string; prefer over varchar(n)), `integer` (±2.1 billion; prices in cents, quantities), `bigint` (huge; ids), `numeric(12,2)` (exact decimal; when cents not possible), avoid `real/double` for money, `boolean`, `timestamptz` (point in time stored as UTC, shown in session time zone; always prefer over `timestamp`), `uuid` (128-bit random id; `gen_random_uuid()` built in). Preview of JS mapping via Bun.sql (version notes): bigint → string by default, numeric → string, timestamptz → Date, uuid → string, boolean → boolean.
- Analogy: different storage boxes in a warehouse — shoebox (integer), shipping container (bigint), jeweller's scale (numeric, exact), on/off tag (boolean), stamped arrival time in GMT (timestamptz), barcode label (uuid).
- Code example: `SELECT 2499::integer AS price_cents, 0.1::numeric + 0.2::numeric AS exact_sum, now()::timestamptz IS NOT NULL AS has_time, gen_random_uuid() IS NOT NULL AS has_uuid;` → `price_cents 2499 | exact_sum 0.3 | has_time t | has_uuid t` (psql shows booleans as `t`/`f`).
- Production use: correct types prevent bad data and rounding bugs.
- Common mistakes: `timestamp` without time zone; float for money; `varchar(255)` habit.
- Sources: https://www.postgresql.org/docs/19/datatype.html ; https://www.postgresql.org/docs/19/datatype-datetime.html ; https://wiki.postgresql.org/wiki/Don%27t_Do_This

### Primary keys & identity columns
- Concept: primary key = column(s) uniquely identifying each row, never NULL, never changes. `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY` — database assigns 1, 2, 3...; `ALWAYS` rejects manual ids (use `OVERRIDING SYSTEM VALUE` only in special cases — mention only). Avoid legacy `serial` (mention once as older style). uuid PK alternative (`DEFAULT gen_random_uuid()`) for public/unguessable ids; course uses bigint identity.
- Analogy: ticket numbers at a deli counter — machine hands out the next number, nobody picks their own, no two customers share one.
- Code example: `CREATE TABLE users (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email text NOT NULL, name text NOT NULL); INSERT INTO users (email, name) VALUES ('asha@example.com', 'Asha') RETURNING id;` → `id 1`. Then `INSERT INTO users (id, email, name) VALUES (5, 'x@example.com', 'X');` → `ERROR:  cannot insert a non-DEFAULT value into column "id"` (author: keep only the first error line, which PostgreSQL prints; detail line may follow).
- Production use: every table has a PK; foreign keys point to it (topic 11).
- Common mistakes: using email as PK (emails change); `serial` in new code.
- Sources: https://www.postgresql.org/docs/19/ddl-identity-columns.html ; https://www.postgresql.org/docs/19/ddl-constraints.html#DDL-CONSTRAINTS-PRIMARY-KEYS

### CREATE TABLE, INSERT & SELECT
- Concept: DDL vs DML gloss. `CREATE TABLE products (...)`; `INSERT INTO t (cols) VALUES (...), (...)` multi-row; string literals single quotes `'Pen'` (double quotes = identifiers); `SELECT col1, col2 FROM t;` `SELECT *` (fine in psql, list columns in app code); column alias `AS`; expressions `price_cents / 100.0`. Statements end with `;`. Keywords upper case by convention. `DROP TABLE` mentioned as destructive.
- Analogy: setting up a new filing cabinet (CREATE), filing new cards (INSERT), asking the clerk for copies of certain cards (SELECT).
- Code example: `CREATE TABLE products (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL, price_cents integer NOT NULL, stock integer NOT NULL); INSERT INTO products (name, price_cents, stock) VALUES ('Notebook', 2499, 10), ('Pen', 199, 100), ('Backpack', 4999, 5); SELECT name, round(price_cents / 100.0, 2) AS price FROM products;` → `Notebook 24.99 / Pen 1.99 / Backpack 49.99` + `(3 rows)`. Insert ack: `INSERT 0 3`.
- Production use: migrations (14) are CREATE TABLE files; repositories run INSERT/SELECT.
- Common mistakes: double quotes for strings (→ `column "Pen" does not exist`); forgetting `;` in psql; `SELECT *` in app code.
- Sources: https://www.postgresql.org/docs/19/sql-createtable.html ; https://www.postgresql.org/docs/19/sql-insert.html ; https://www.postgresql.org/docs/19/tutorial-select.html

### What NULL means
- Concept: NULL = unknown/missing, not 0 or ''. Any comparison with NULL gives NULL (not true) → `WHERE x = NULL` matches nothing; use `IS NULL` / `IS NOT NULL`. `coalesce(x, default)`. Columns allow NULL unless `NOT NULL` (default stance in course: NOT NULL unless truly optional). Bun.sql maps NULL → `null` (topic 13).
- Analogy: blank answer on a survey — not "zero", not "no", just unknown; asking "is this blank answer equal to that blank answer?" → "unknown".
- Code example: `ALTER TABLE users ADD COLUMN phone text;` (gloss ALTER) `SELECT name, phone IS NULL AS no_phone, coalesce(phone, 'n/a') AS phone_display FROM users WHERE phone IS NULL;` → 3 rows `Asha | t | n/a` etc.; `SELECT count(*) FROM users WHERE phone = NULL;` → `0`; `SELECT NULL = NULL AS same;` → empty cell (NULL; psql shows blank).
- Production use: optional fields (shipped_at); NOT NULL guards data quality.
- Common mistakes: `= NULL`; nullable columns by accident; treating NULL as empty string.
- Sources: https://www.postgresql.org/docs/19/functions-comparison.html ; https://www.postgresql.org/docs/19/functions-conditional.html#FUNCTIONS-COALESCE-NVL-IFNULL

## Quiz
1. Which type for an order total in cents? for created time? — tests data types
2. Why does `WHERE phone = NULL` return no rows? — tests NULL
3. What happens when you insert your own id into a GENERATED ALWAYS identity column? — tests identity
4. `'Pen'` vs `"Pen"` in SQL — what's each? — tests literals vs identifiers
5. What does one row of `users` correspond to in TypeScript? — tests tables/rows
