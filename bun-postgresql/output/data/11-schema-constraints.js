window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "11-schema-constraints",
  "order": 11,
  "title": "Schema Design & Constraints",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Learn to make the database itself refuse bad data using NOT NULL, DEFAULT, UNIQUE, CHECK and foreign keys. Then design the course shop schema: one-to-many (users to orders), many-to-many through a junction table (a helper table that links two others: orders to products), and normalization (storing each fact exactly once). Every constraint violation carries a five-character SQLSTATE error code that later topics use.",
  "prerequisites": ["10-sql-crud"],
  "subtopics": [
    {
      "id": "not-null-default-unique-check",
      "title": "NOT NULL, DEFAULT, UNIQUE & CHECK",
      "explanation": "A constraint is a rule that the database enforces on every write (every INSERT and UPDATE), no matter which program sent it. Your Bun server, a script, or you typing in psql all hit the same rules. Validation in your TypeScript code (topic 19) is the first line of defence and gives friendly error messages. Constraints are the last line of defence: if a bug slips past the code, the database still refuses the bad row.\n\nFour column-level constraints cover most needs. NOT NULL means the column must always have a value (NULL, the 'no value' marker from topic 9, is rejected). DEFAULT supplies a value when an INSERT leaves the column out, for example `now()` for a creation time or `'pending'` for a status. UNIQUE means no two rows may hold the same value in that column. CHECK holds a boolean expression that must be true for every row, for example `price_cents >= 0`.\n\nTwo details are worth knowing. UNIQUE does not treat NULLs as equal, so many rows may have NULL in a UNIQUE column (add NOT NULL as well if a value is required). And a CHECK only rejects a row when its expression is false; if the expression is NULL (unknown), the row is accepted, which is another reason to pair CHECK with NOT NULL.\n\nPostgreSQL names each constraint automatically using the pattern table_column_suffix: `users_email_key` (UNIQUE), `products_price_cents_check` (CHECK), `orders_user_id_fkey` (foreign key, next sub-topic) and `order_items_pkey` (primary key). Those names appear in error messages, so your code can tell which rule failed.\n\nWhen a constraint fails, PostgreSQL returns an error with a SQLSTATE: a five-character code that identifies the kind of error, so programs do not have to parse the English message. The ones for this topic: `23502` not-null violation, `23505` unique violation, `23503` foreign-key violation, `23514` check violation. Topic 13 shows how Bun exposes the code and topic 19 turns it into HTTP responses.\n\nThe example below creates the whole course schema. It is the final schema used for the rest of the course. The examples in this topic continue in the same database, so run them in order. Open psql with the same connection URL you used in topic 9: `psql \"postgres://app:app_password@localhost:5432/orders_dev\"`. Then create a fresh scratch database so that no tables from earlier topics exist: run `CREATE DATABASE orders_scratch;`, then `\\c orders_scratch` to switch into it. Paste each example into that scratch database, in order. The first line `\\set VERBOSITY terse` is a psql setting that makes error messages show only their first line, which keeps the output short and identical for everyone.\n\nA failed INSERT still uses up an identity number, so ids can have gaps. That is normal and harmless. In this example the failing inserts come last, after the rows that later examples depend on.",
      "analogy": "Think of a club door with fixed rules, enforced no matter which friend brought you. You must show an ID (NOT NULL), only one entry per person (UNIQUE), and you must be 18 or older (CHECK). If you arrive without a wristband, the door staff hand you one automatically (DEFAULT). The rules are at the door, not in each friend's head, so every visitor meets them.",
      "code": [
        {
          "language": "sql",
          "filename": "01-constraints.sql",
          "source": "\\set VERBOSITY terse\n\nCREATE TABLE users (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  email text NOT NULL UNIQUE,\n  name text NOT NULL,\n  password_hash text NOT NULL,\n  created_at timestamptz NOT NULL DEFAULT now()\n);\nCREATE TABLE products (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  name text NOT NULL,\n  price_cents integer NOT NULL CHECK (price_cents >= 0),\n  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),\n  created_at timestamptz NOT NULL DEFAULT now()\n);\nCREATE TABLE orders (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','shipped','cancelled')),\n  total_cents integer NOT NULL DEFAULT 0 CHECK (total_cents >= 0),\n  created_at timestamptz NOT NULL DEFAULT now()\n);\nCREATE TABLE order_items (\n  order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,\n  product_id bigint NOT NULL REFERENCES products(id) ON DELETE RESTRICT,\n  quantity integer NOT NULL CHECK (quantity > 0),\n  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),\n  PRIMARY KEY (order_id, product_id)\n);\n\n-- Valid rows first (password_hash 'x' is a placeholder)\nINSERT INTO users (email, name, password_hash) VALUES\n  ('asha@example.com', 'Asha', 'x'),\n  ('ben@example.com', 'Ben', 'x');\nINSERT INTO products (name, price_cents, stock) VALUES\n  ('Mug', 1299, 10),\n  ('Notebook', 199, 50),\n  ('Backpack', 4999, 5);\n\n-- status and total_cents are omitted, so their DEFAULTs apply\nINSERT INTO orders (user_id) VALUES (1) RETURNING status, total_cents;\n\n-- Now three writes the database must refuse\nINSERT INTO users (email, name, password_hash) VALUES ('asha@example.com', 'Asha again', 'x');\nINSERT INTO products (name, price_cents) VALUES ('Broken', -5);\nINSERT INTO users (email, name, password_hash) VALUES ('cy@example.com', NULL, 'x');",
          "output": "CREATE TABLE\nCREATE TABLE\nCREATE TABLE\nCREATE TABLE\nINSERT 0 2\nINSERT 0 3\n status  | total_cents \n---------+-------------\n pending |           0\n(1 row)\n\nINSERT 0 1\nERROR:  duplicate key value violates unique constraint \"users_email_key\"\nERROR:  new row for relation \"products\" violates check constraint \"products_price_cents_check\"\nERROR:  null value in column \"name\" of relation \"users\" violates not-null constraint",
          "explanation": "The four CREATE TABLE commands build the final course schema. The valid inserts succeed (INSERT 0 2 means 'zero special ids, two rows inserted'). The order insert names only user_id, so PostgreSQL fills status with 'pending' and total_cents with 0 from the DEFAULTs, and RETURNING shows them. The last three statements break UNIQUE (SQLSTATE 23505), CHECK (23514) and NOT NULL (23502). Each error names the constraint or column that refused the write, and none of the three rows is stored."
        }
      ],
      "productionNote": "A unique email constraint is what makes 'this email is already registered' reliable: two simultaneous sign-up requests cannot both succeed, because the database decides. Your API catches the 23505 error and answers with HTTP 409 (conflict). A CHECK on status that lists the same values as your TypeScript union type `OrderStatus` keeps the database and the code in agreement.",
      "commonMistakes": [
        "Relying only on validation in application code. Another script, a future endpoint or a manual fix in psql bypasses it, and the database then holds bad data. Put the rule in a constraint as well.",
        "Making email UNIQUE but not normalizing it. UNIQUE on text is case-sensitive, so 'Asha@Example.com' and 'asha@example.com' are different values. Convert emails to lowercase in the application before inserting (topic 19).",
        "Forgetting that UNIQUE allows many NULLs. If a value must be present and distinct, use NOT NULL and UNIQUE together.",
        "Being surprised by gaps in identity numbers after a failed insert. The number is used up even though the row was refused; do not rely on ids being consecutive."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Constraints", "url": "https://www.postgresql.org/docs/19/ddl-constraints.html" },
        { "title": "PostgreSQL docs: Error codes appendix", "url": "https://www.postgresql.org/docs/19/errcodes-appendix.html" }
      ]
    },
    {
      "id": "foreign-keys-on-delete",
      "title": "Foreign keys & ON DELETE behaviour",
      "explanation": "A foreign key is a column whose value must match the primary key of a row in another table. In `orders`, the column `user_id bigint NOT NULL REFERENCES users(id)` says: every order must belong to a user that really exists. Inserting an order with an unknown user id fails with SQLSTATE 23503 (foreign-key violation). This prevents orphans: rows that point to something that no longer exists.\n\nThe same rule works in reverse. What should happen when someone deletes a row that other rows still point to? You choose with `ON DELETE`:\n\n`RESTRICT` refuses the delete while any row still references it. `NO ACTION` is the default if you write nothing and behaves the same for our purposes. `CASCADE` deletes the referencing rows too. `SET NULL` keeps the referencing rows but sets their foreign-key column to NULL (so that column must allow NULL; it cannot be NOT NULL).\n\nThe course schema makes deliberate choices. `orders.user_id` uses CASCADE: deleting a user account removes that user's orders, and those orders' items (because `order_items.order_id` is also CASCADE). `order_items.product_id` uses RESTRICT: a product that was ever sold cannot be deleted, so past orders stay readable. There is no SET NULL column in the course schema, but it would look like `author_id bigint REFERENCES users(id) ON DELETE SET NULL`, useful for something like a comment that should survive its author leaving.\n\nOne thing PostgreSQL does not do: it does not create an index (a lookup structure that makes searches fast, covered in topic 17) on the foreign-key column automatically. It only indexes primary keys and UNIQUE columns. Topic 17 adds indexes for the foreign keys.\n\nThe example continues in the database from the previous example. It sets up some orders and order lines (the `order_items` rows link orders to products; the next two sub-topics explain how that table works), adds a throwaway user, Cy, to show CASCADE, and finishes with the two refused statements. Rows inserted by a single multi-row INSERT get consecutive ids in the order you list them.",
      "analogy": "Think of library loan slips. A slip must name a real member (the foreign key). If a member leaves, the library can handle their slips in different ways. CASCADE shreds all of that member's slips. RESTRICT says 'return your books first, then you can leave'. SET NULL keeps the slip but blanks out the name on it.",
      "code": [
        {
          "language": "sql",
          "filename": "02-foreign-keys.sql",
          "source": "\\set VERBOSITY terse\n\nUPDATE orders SET status = 'paid' WHERE id = 1;\nINSERT INTO orders (user_id) VALUES (1), (2);   -- order 2 for Asha, order 3 for Ben\nINSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES\n  (1, 1, 1, 1299),\n  (3, 2, 2, 199),\n  (3, 3, 1, 4999);\n\n-- A throwaway user with one order and one order line\nINSERT INTO users (email, name, password_hash) VALUES ('cy@example.com', 'Cy', 'x');\nINSERT INTO orders (user_id) SELECT id FROM users WHERE email = 'cy@example.com';\nINSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (4, 1, 1, 1299);\n\n-- CASCADE: deleting Cy also deletes order 4 and its line\nDELETE FROM users WHERE email = 'cy@example.com';\nSELECT id FROM orders ORDER BY id;\nSELECT order_id FROM order_items WHERE order_id = 4;\n\n-- Two writes the foreign keys refuse\nINSERT INTO orders (user_id) VALUES (999);\nDELETE FROM products WHERE id = 1;",
          "output": "UPDATE 1\nINSERT 0 2\nINSERT 0 3\nINSERT 0 1\nINSERT 0 1\nINSERT 0 1\nDELETE 1\n id \n----\n  1\n  2\n  3\n(3 rows)\n\n order_id \n----------\n(0 rows)\n\nERROR:  insert or update on table \"orders\" violates foreign key constraint \"orders_user_id_fkey\"\nERROR:  update or delete on table \"products\" violates foreign key constraint \"order_items_product_id_fkey\" on table \"order_items\"",
          "explanation": "Deleting Cy reports DELETE 1 (one user row), yet order 4 and its order line are gone too: that is ON DELETE CASCADE working through two levels. The orders query lists only 1, 2 and 3, and the order_items query for order 4 finds nothing. The last two statements are refused: user 999 does not exist (23503), and product 1 is still referenced by an order line, so ON DELETE RESTRICT blocks the delete (also 23503)."
        }
      ],
      "productionNote": "These rules mean your application never has to clean up orphaned rows or check 'is this product used anywhere?' before deleting: the database refuses. Use CASCADE only where the child rows have no meaning without the parent (an order without its user). Where history matters, such as sold products, use RESTRICT.",
      "commonMistakes": [
        "Putting ON DELETE CASCADE on every foreign key. One careless DELETE can then wipe out a huge tree of rows. Choose per relationship.",
        "Using ON DELETE SET NULL on a column declared NOT NULL. The two contradict each other, so the delete would fail; the column must allow NULL.",
        "Assuming PostgreSQL indexes foreign-key columns automatically. It does not, so lookups like 'all orders of user 7' and cascading deletes can become slow on big tables until you add an index (topic 17)."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Foreign keys", "url": "https://www.postgresql.org/docs/19/ddl-constraints.html#DDL-CONSTRAINTS-FK" },
        { "title": "PostgreSQL docs: CREATE TABLE", "url": "https://www.postgresql.org/docs/19/sql-createtable.html" }
      ]
    },
    {
      "id": "one-to-many",
      "title": "One-to-many relationships",
      "explanation": "A one-to-many relationship means one row on one side relates to many rows on the other. One user places many orders, but each order belongs to exactly one user. In a relational database you model it by putting the foreign key on the 'many' side: `orders.user_id` points to `users.id`.\n\nYou can read the relationship in both directions with plain queries. 'Which orders belong to user 1?' filters orders by `user_id = 1`. 'Who owns order 3?' reads that order's `user_id`.\n\nDo not model it the other way round by storing a list of order ids inside the user row (for example an array or a comma-separated text column). A list cannot be checked by a foreign key, so it can point to orders that do not exist, it is awkward to query, and every new order means rewriting the user row.\n\nThe example uses the data from the previous example (run that one first).",
      "analogy": "Picture a mother duck with ducklings. Each duckling knows who its mother is (the user_id), but the mother does not carry a list of her ducklings. To find all the ducklings you look at who follows which mother. Many ducklings can point to the same mother, and one duckling never has two mothers.",
      "code": [
        {
          "language": "sql",
          "filename": "03-one-to-many.sql",
          "source": "-- All orders of user 1 (the many side holds the foreign key)\nSELECT id, status FROM orders WHERE user_id = 1 ORDER BY id;\n\n-- The other direction: who owns order 3?\nSELECT user_id FROM orders WHERE id = 3;",
          "output": " id | status  \n----+---------\n  1 | paid\n  2 | pending\n(2 rows)\n\n user_id \n---------\n       2\n(1 row)",
          "explanation": "Asha (user 1) has two orders, 1 and 2, found by filtering on the foreign-key column. Order 3 has user_id 2, so it belongs to Ben. No list of orders is stored on the users table."
        }
      ],
      "productionNote": "The same pattern appears everywhere in a backend: users to orders now, users to sessions (login records) in topic 20. A request like 'GET /users/1/orders' becomes exactly the first query above.",
      "commonMistakes": [
        "Adding an `order_ids` array or comma-separated text column to users. The database cannot enforce that those ids exist, and queries and updates become awkward.",
        "Putting the foreign key on the wrong side. If a user has many orders, the key belongs on orders. A `users.order_id` column could hold only one order per user."
      ],
      "sources": [
        { "title": "PostgreSQL tutorial: Foreign keys", "url": "https://www.postgresql.org/docs/19/tutorial-fk.html" }
      ]
    },
    {
      "id": "many-to-many-junction",
      "title": "Many-to-many with junction tables",
      "explanation": "In a many-to-many relationship, rows on both sides relate to many rows on the other. An order contains many products, and a product appears in many orders. A single foreign key cannot express that, so you add a third table, a junction table (also called a join table or link table). In the course schema it is `order_items`: each row links one order to one product.\n\nThe junction table has two foreign keys, `order_id` and `product_id`. Its primary key is composite, meaning it is made of two columns together: `PRIMARY KEY (order_id, product_id)`. Each column may repeat on its own, but the pair may appear only once, so one order has at most one line per product. The duplicate-pair error names the primary key constraint, `order_items_pkey`.\n\nThe junction table can also carry data about the relationship itself: `quantity`, and `unit_price_cents`. The second is a price snapshot: the product's price at the moment of purchase, copied into the row. If you later change `products.price_cents`, old order lines keep the price the customer actually paid, so history is not rewritten. Without the snapshot, raising a price would silently change the total of every past order.\n\nThe example uses the order lines from the earlier example (run those first).",
      "analogy": "Think of a class enrolment sheet. Students take many courses and courses have many students, so the school keeps a sheet of enrolment rows, each linking one student to one course. The row can also record extra facts about that link, such as the grade, just as an order line records quantity and price paid. The same student cannot be enrolled in the same course twice.",
      "code": [
        {
          "language": "sql",
          "filename": "04-junction-table.sql",
          "source": "\\set VERBOSITY terse\n\n-- Lines of order 3, one per product\nSELECT product_id, quantity, unit_price_cents\nFROM order_items\nWHERE order_id = 3\nORDER BY product_id;\n\n-- The same (order, product) pair twice is refused\nINSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (3, 2, 1, 199);\n\n-- The shop raises the Notebook price; the old order line keeps its snapshot\nUPDATE products SET price_cents = 249 WHERE id = 2;\nSELECT price_cents FROM products WHERE id = 2;\nSELECT unit_price_cents FROM order_items WHERE order_id = 3 AND product_id = 2;",
          "output": " product_id | quantity | unit_price_cents \n------------+----------+------------------\n          2 |        2 |              199\n          3 |        1 |             4999\n(2 rows)\n\nERROR:  duplicate key value violates unique constraint \"order_items_pkey\"\nUPDATE 1\n price_cents \n-------------\n         249\n(1 row)\n\n unit_price_cents \n------------------\n              199\n(1 row)",
          "explanation": "Order 3 has two lines: 2 notebooks at 199 and 1 backpack at 4999. Inserting product 2 into order 3 a second time breaks the composite primary key (23505). After the product's price changes to 249, the order line still says 199, which is what the customer paid."
        }
      ],
      "productionNote": "Cart and order lines are the classic use, but the same pattern models tags on posts and roles of users. Always store the price at purchase time on the line; totals and receipts for old orders must not change when the catalog changes.",
      "commonMistakes": [
        "Storing product ids as a comma-separated list in a text column of orders. The database cannot enforce that they exist, and you cannot search or join them properly.",
        "Not snapshotting the price in the order line, so a later price change rewrites the history of every past order.",
        "Forgetting the composite primary key, which lets the same product appear twice in one order as separate lines."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Primary keys", "url": "https://www.postgresql.org/docs/19/ddl-constraints.html#DDL-CONSTRAINTS-PRIMARY-KEYS" }
      ]
    },
    {
      "id": "normalization-basics",
      "title": "Normalization basics",
      "explanation": "Normalization means organising tables so that each fact is stored exactly once. When the same fact is copied into many rows, the copies can drift apart. Changing one copy and missing another creates an update anomaly: the database now holds two different answers to one question.\n\nThe example below shows a flat table, `orders_flat`, where every row repeats the customer's email and name and the product's name and price. Asha appears in two rows. Renaming her in only one of them leaves 'Asha K' and 'Asha' side by side for the same email, and nothing can tell which is right.\n\nThe cure is the schema you already built. Customer facts live once in `users`, product facts once in `products`, orders point to users, and order lines point to orders and products. Renaming Asha is then one UPDATE of one row, and every order sees the new name.\n\nNormalization is a guideline, not a religion. The course schema deliberately repeats two things, each for a reason. `order_items.unit_price_cents` copies the price on purpose, because history must not change. `orders.total_cents` caches the sum of an order's lines so listing orders is cheap; your code must keep it correct when lines change (topic 18). Copying data deliberately, with a reason you can state, is called denormalization. Copying data without a reason is just a bug waiting to happen.",
      "analogy": "Keep one master contacts list on your phone instead of writing a friend's number on every note and sticker. When the friend changes number, you fix it once and every place that uses the contact is right. If you had copied the number onto twenty notes, some would be wrong the day after.",
      "code": [
        {
          "language": "sql",
          "filename": "05-normalization.sql",
          "source": "-- Bad design: customer and product facts repeated on every row\nCREATE TABLE orders_flat (\n  order_id integer,\n  customer_email text,\n  customer_name text,\n  product_name text,\n  product_price integer\n);\nINSERT INTO orders_flat VALUES\n  (1, 'asha@example.com', 'Asha', 'Mug', 1299),\n  (2, 'asha@example.com', 'Asha', 'Notebook', 199),\n  (3, 'ben@example.com', 'Ben', 'Backpack', 4999);\n\n-- Rename Asha, but only in order 1's row\nUPDATE orders_flat SET customer_name = 'Asha K' WHERE order_id = 1;\nSELECT order_id, customer_email, customer_name FROM orders_flat ORDER BY order_id;\n\n-- Normalized design: the name lives once, in users\nUPDATE users SET name = 'Asha K' WHERE email = 'asha@example.com';\nSELECT id, name FROM users ORDER BY id;\n\nDROP TABLE orders_flat;",
          "output": "CREATE TABLE\nINSERT 0 3\nUPDATE 1\n order_id |  customer_email  | customer_name \n----------+------------------+---------------\n        1 | asha@example.com | Asha K\n        2 | asha@example.com | Asha\n        3 | ben@example.com  | Ben\n(3 rows)\n\nUPDATE 1\n id |  name  \n----+--------\n  1 | Asha K\n  2 | Ben\n(2 rows)\n\nDROP TABLE",
          "explanation": "In the flat table the same email now has two names, 'Asha K' and 'Asha', because the name was stored twice and only one copy changed. In the normalized users table the name is stored once, so a single UPDATE fixes it everywhere. The last line removes the practice table."
        }
      ],
      "productionNote": "A normalized schema gives simpler queries and fewer bugs: every fact has one place to change. Denormalize only with a measured or business reason, and write that reason next to the column (as with the price snapshot and the cached order total).",
      "commonMistakes": [
        "Copying user data (name, email) into every order row without a reason. Later edits then leave stale copies behind.",
        "Over-normalizing tiny lookups into many tables. A four-value status is fine as a CHECK on text; a separate statuses table and a join for every query adds work with no benefit.",
        "Denormalizing a value like total_cents and then forgetting to update it when order lines change."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Data definition", "url": "https://www.postgresql.org/docs/19/ddl.html" },
        { "title": "Wikipedia: Database normalization", "url": "https://en.wikipedia.org/wiki/Database_normalization" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Which constraint stops two accounts from having the same email, and which SQLSTATE does it raise when violated?",
      "options": [
        "CHECK, SQLSTATE 23514",
        "UNIQUE, SQLSTATE 23505",
        "NOT NULL, SQLSTATE 23502",
        "DEFAULT, SQLSTATE 23503"
      ],
      "answerIndex": 1,
      "explanation": "UNIQUE rejects duplicate values and raises 23505. CHECK (23514) tests a boolean expression, NOT NULL (23502) rejects missing values, and DEFAULT is not a rule at all: it only fills in omitted values."
    },
    {
      "question": "An order_items row references product 1, and the foreign key uses ON DELETE RESTRICT. What happens on `DELETE FROM products WHERE id = 1;`?",
      "options": [
        "The product and the order_items row referencing it are both deleted.",
        "The product is deleted and order_items.product_id is set to NULL.",
        "The delete fails with a foreign-key violation (23503) and nothing is deleted.",
        "The product is deleted and the order_items row is left pointing at nothing."
      ],
      "answerIndex": 2,
      "explanation": "RESTRICT refuses to delete a row that is still referenced. The first option describes CASCADE, the second SET NULL (which also would not work on a NOT NULL column), and the last cannot happen because a foreign key never allows dangling references."
    },
    {
      "question": "In a one-to-many relationship where one user has many orders, where does the foreign key go?",
      "options": [
        "On the orders table, as orders.user_id referencing users(id).",
        "On the users table, as an array column of order ids.",
        "On the users table, as a single users.order_id column.",
        "On neither table; a separate junction table is always required."
      ],
      "answerIndex": 0,
      "explanation": "The foreign key goes on the 'many' side, so each order records its one owner. A single order_id on users could hold only one order, an id array cannot be checked by a foreign key, and a junction table is only needed for many-to-many."
    },
    {
      "question": "Why does order_items store unit_price_cents instead of reading the price from products when needed?",
      "options": [
        "PostgreSQL does not allow reading another table's columns.",
        "It makes the primary key unique.",
        "It is required for the foreign key to work.",
        "It records the price paid at purchase time, so later price changes do not rewrite past orders."
      ],
      "answerIndex": 3,
      "explanation": "The snapshot keeps history correct: if the catalog price changes later, old order lines still show what the customer paid. The other reasons are false: reading other tables is normal, and the primary key is (order_id, product_id), unrelated to price."
    },
    {
      "question": "What problem does repeating customer_name in every order row cause?",
      "options": [
        "The table can no longer have a primary key.",
        "An update anomaly: changing the name in some rows but not others leaves conflicting copies of the same fact.",
        "PostgreSQL refuses to store more than one row per customer.",
        "Every query must be run twice."
      ],
      "answerIndex": 1,
      "explanation": "Repeated facts drift apart when only some copies are updated, so the data contradicts itself. Repetition does not prevent a primary key, PostgreSQL does not limit rows per customer, and queries do not need to run twice."
    }
  ]
});
