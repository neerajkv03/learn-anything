window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "12-joins-aggregation",
  "order": 12,
  "title": "Joins & Aggregation",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Real questions span several tables: which customer placed this order, which customers have no orders, how much has each one spent. You will combine tables with INNER JOIN and LEFT JOIN, chain joins with short nicknames (aliases) for tables, summarise rows with count, sum and avg, and group them with GROUP BY and HAVING.",
  "prerequisites": ["11-schema-constraints"],
  "subtopics": [
    {
      "id": "inner-join",
      "title": "INNER JOIN",
      "explanation": "So far every query read one table. But your data is deliberately split: an order stores only a user_id, and the customer's name lives in the users table. A join combines two tables into one result by pairing rows. You say how to pair them in an ON clause (a true/false condition; a pair of rows is kept only when it is true).\n\nTry it in psql (the terminal client from topic 09), connected to the course database. Run the setup block below first; all outputs in this topic assume its rows (the setup drops and recreates the four tables, so ids start again at 1). The query after it reads FROM orders, then JOIN users ON users.id = orders.user_id pairs every order with the user whose id equals the order's user_id.\n\nJOIN on its own means INNER JOIN; the word INNER is optional. An inner join keeps only rows that found a partner. Chen has no orders, so Chen has no partner and does not appear. An order whose user_id matched nothing would be dropped too (the foreign key from topic 11 prevents that here).\n\nBoth tables have a column called id, so write orders.id and users.name: table name, a dot, then the column. This is called qualifying a column. Without it, PostgreSQL cannot tell which id you mean.",
      "analogy": "Matching socks from two drawers. You pull a sock from the left drawer (orders) and look in the right drawer (users) for the one with the same id. Only socks that find a partner come out as a pair; a lone sock, like Chen, stays in the drawer and is not in the result.",
      "code": [
        {
          "language": "sql",
          "filename": "queries/12-setup.sql",
          "source": "DROP TABLE IF EXISTS order_items, orders, products, users CASCADE;\nCREATE TABLE users (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  email text NOT NULL UNIQUE,\n  name text NOT NULL,\n  password_hash text NOT NULL,\n  created_at timestamptz NOT NULL DEFAULT now()\n);\nCREATE TABLE products (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  name text NOT NULL,\n  price_cents integer NOT NULL CHECK (price_cents >= 0),\n  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),\n  created_at timestamptz NOT NULL DEFAULT now()\n);\nCREATE TABLE orders (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','shipped','cancelled')),\n  total_cents integer NOT NULL DEFAULT 0 CHECK (total_cents >= 0),\n  created_at timestamptz NOT NULL DEFAULT now()\n);\nCREATE TABLE order_items (\n  order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,\n  product_id bigint NOT NULL REFERENCES products(id) ON DELETE RESTRICT,\n  quantity integer NOT NULL CHECK (quantity > 0),\n  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),\n  PRIMARY KEY (order_id, product_id)\n);\n\nINSERT INTO users (email, name, password_hash) VALUES\n  ('asha@example.com', 'Asha', 'x'),\n  ('ben@example.com', 'Ben', 'x'),\n  ('chen@example.com', 'Chen', 'x');\n\nINSERT INTO products (name, price_cents, stock) VALUES\n  ('Notebook', 2499, 50),\n  ('Pen', 199, 100),\n  ('Backpack', 4999, 5);\n\nINSERT INTO orders (user_id, status, total_cents) VALUES\n  (1, 'paid', 4998),\n  (1, 'pending', 199),\n  (2, 'shipped', 5397);\n\nINSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES\n  (1, 1, 2, 2499),\n  (2, 2, 1, 199),\n  (3, 2, 2, 199),\n  (3, 3, 1, 4999);",
          "output": "DROP TABLE\nCREATE TABLE\nCREATE TABLE\nCREATE TABLE\nCREATE TABLE\nINSERT 0 3\nINSERT 0 3\nINSERT 0 3\nINSERT 0 4",
          "explanation": "Drops the four tables if they exist, recreates them with the same columns as topic 11 (DROP TABLE is one line, CREATE TABLE one line per table), then loads the rows every output in this topic uses: users Asha, Ben and Chen, three products, three orders (for users 1, 1 and 2) and four order lines."
        },
        {
          "language": "sql",
          "filename": "queries/12-inner-join.sql",
          "source": "SELECT orders.id, users.name, orders.status\nFROM orders\nJOIN users ON users.id = orders.user_id\nORDER BY orders.id;",
          "output": " id | name |  status\n----+------+---------\n  1 | Asha | paid\n  2 | Asha | pending\n  3 | Ben  | shipped\n(3 rows)",
          "explanation": "Each order is paired with its customer. There are 3 orders, so 3 result rows. Chen (user 3) has no order, so Chen is absent. ORDER BY orders.id makes the order of rows predictable."
        }
      ],
      "productionNote": "An order list endpoint (the HTTP route that returns orders, built in later topics) almost always joins orders to users so it can show the customer name next to each order. Always qualify column names in joined queries, even where not strictly required: the query keeps working when someone later adds a column with the same name to another table.",
      "commonMistakes": [
        "Writing SELECT id with two tables that both have an id column. PostgreSQL stops with the error column reference \"id\" is ambiguous (ambiguous means it cannot decide which of two columns you mean). Write orders.id or users.id.",
        "Forgetting the join condition. JOIN without ON is a syntax error, but listing tables with commas (FROM orders, users) and forgetting a condition in WHERE pairs every row with every row (a cross join): 3 orders x 3 users = 9 rows, most of them nonsense. On big tables this explodes into millions of rows.",
        "Joining on the wrong columns, for example ON users.id = orders.id. The query runs without error but pairs unrelated rows. Join the foreign key (orders.user_id) to the primary key it references (users.id)."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Joins Between Tables (tutorial)", "url": "https://www.postgresql.org/docs/19/tutorial-join.html" },
        { "title": "PostgreSQL docs: Joined Tables", "url": "https://www.postgresql.org/docs/19/queries-table-expressions.html#QUERIES-JOIN" }
      ]
    },
    {
      "id": "left-join",
      "title": "LEFT JOIN",
      "explanation": "A LEFT JOIN keeps every row of the left table (the one written before the word JOIN), even when no row on the right matches. For unmatched rows, every column coming from the right table is filled with NULL (the 'no value' marker from topic 09). In psql a NULL shows as an empty cell.\n\nBelow, users is the left table. Chen has no orders, so Chen still appears, with a NULL order id. Asha appears twice because she has two orders: a join produces one result row per matching pair.\n\nThis gives you a way to find rows that have no partner. After the LEFT JOIN, keep only rows where a right-side column IS NULL. Use the right table's primary key, because it can never be NULL in a real row, so a NULL there can only mean 'no match'.\n\nOne trap: where you put a filter on the right table matters. A condition in the ON clause is applied while pairing, so left rows survive with NULLs. A condition in WHERE runs afterwards on the finished result, and a NULL never satisfies a comparison like orders.status = 'paid', so those rows are removed. The last code block shows the difference.",
      "analogy": "A class attendance list. Every student is printed on the list (the left table) whether or not they handed in homework (the right table). Next to each name goes their homework if they handed one in, or an empty box if not. The ON clause says which homework belongs to which student; WHERE is like a teacher cutting out every line with an empty box afterwards.",
      "code": [
        {
          "language": "sql",
          "filename": "queries/12-left-join.sql",
          "source": "SELECT users.name, orders.id AS order_id\nFROM users\nLEFT JOIN orders ON orders.user_id = users.id\nORDER BY users.id, orders.id;\n\n-- users with no orders at all\nSELECT users.name\nFROM users\nLEFT JOIN orders ON orders.user_id = users.id\nWHERE orders.id IS NULL;",
          "output": " name | order_id\n------+----------\n Asha |        1\n Asha |        2\n Ben  |        3\n Chen |         \n(4 rows)\n\n name\n------\n Chen\n(1 row)",
          "explanation": "The first query lists 4 rows: Asha twice, Ben once, and Chen with an empty (NULL) order_id. The second query keeps only the rows where the right side did not match, which is exactly Chen."
        },
        {
          "language": "sql",
          "filename": "queries/12-left-join-filter.sql",
          "source": "-- filter in ON: every user stays\nSELECT users.name, orders.id AS order_id\nFROM users\nLEFT JOIN orders ON orders.user_id = users.id AND orders.status = 'paid'\nORDER BY users.id;\n\n-- filter in WHERE: users without a paid order vanish\nSELECT users.name, orders.id AS order_id\nFROM users\nLEFT JOIN orders ON orders.user_id = users.id\nWHERE orders.status = 'paid'\nORDER BY users.id;",
          "output": " name | order_id\n------+----------\n Asha |        1\n Ben  |         \n Chen |         \n(3 rows)\n\n name | order_id\n------+----------\n Asha |        1\n(1 row)",
          "explanation": "With the status test in ON, only paid orders are paired, but all three users are kept; Ben and Chen simply get NULL. With the same test in WHERE, rows with a NULL status fail the comparison and are removed, so the LEFT JOIN behaves like an INNER JOIN."
        }
      ],
      "productionNote": "Dashboards and admin screens usually must show every customer, including those with zero orders; an INNER JOIN would silently hide them and make the numbers look wrong. Use LEFT JOIN whenever the left table is the thing you are reporting on.",
      "commonMistakes": [
        "Adding WHERE orders.status = 'paid' after a LEFT JOIN. The unmatched rows have NULL there, fail the test and disappear, so the query silently becomes an INNER JOIN. Put filters on the right table in the ON clause.",
        "Testing for no match with = NULL. Nothing is ever equal to NULL; use IS NULL.",
        "Checking IS NULL on a column that can legitimately be NULL in matched rows. Use the right table's primary key (orders.id)."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Joined Tables", "url": "https://www.postgresql.org/docs/19/queries-table-expressions.html#QUERIES-JOIN" }
      ]
    },
    {
      "id": "multi-table-joins-aliases",
      "title": "Joining several tables & aliases",
      "explanation": "You can chain joins: each extra JOIN ... ON ... adds one more table to the result. To reach product names from an order you need three hops: orders to users (the customer), orders to order_items (the junction table from topic 11), and order_items to products.\n\nWriting full table names gets long. A table alias is a short temporary name given right after the table in FROM, for example FROM orders o JOIN users u. From then on you write o.id and u.name. This is the same idea as AS for columns from topic 09, but for tables (AS is optional here).\n\nOnce you give a table an alias, you must use only the alias for that table in the whole query. Writing orders.id after FROM orders o is an error.\n\nThe SELECT list can also hold expressions. oi.quantity * oi.unit_price_cents multiplies two columns of each row to give the line total in cents (quantity times the price saved when the order was placed).",
      "analogy": "Connecting flights. Order 3 flies from orders to order_items to products. Each JOIN is a layover, and the ON clause is the matching gate number that tells you which connecting flight you board. An alias is the short airport code (o, oi, p) you use instead of the full airport name.",
      "code": [
        {
          "language": "sql",
          "filename": "queries/12-order-lines.sql",
          "source": "SELECT o.id AS order_id,\n       u.name AS customer,\n       p.name AS product,\n       oi.quantity,\n       oi.quantity * oi.unit_price_cents AS line_cents\nFROM orders o\nJOIN users u ON u.id = o.user_id\nJOIN order_items oi ON oi.order_id = o.id\nJOIN products p ON p.id = oi.product_id\nORDER BY o.id, p.id;",
          "output": " order_id | customer | product  | quantity | line_cents\n----------+----------+----------+----------+------------\n        1 | Asha     | Notebook |        2 |       4998\n        2 | Asha     | Pen      |        1 |        199\n        3 | Ben      | Pen      |        2 |        398\n        3 | Ben      | Backpack |        1 |       4999\n(4 rows)",
          "explanation": "Four tables become one result with one row per order item (4 rows). Order 3 appears twice because it has two items. Order 3's total of 5397 is 398 + 4999."
        }
      ],
      "productionNote": "An order detail endpoint is exactly this query: one order, its customer, and each line with product name and line total. Short, consistent aliases (o, u, oi, p) keep such queries readable.",
      "commonMistakes": [
        "Using the full table name after aliasing it (FROM orders o ... SELECT orders.id). PostgreSQL reports invalid reference to FROM-clause entry for table \"orders\". Use o.id.",
        "Joining two one-to-many tables to the same parent at once. If an order had 2 items and 2 payments (a hypothetical payments table), joining both gives 2 x 2 = 4 rows for that order, which inflates every sum. Aggregate each child table separately, or join one at a time.",
        "Using an INNER JOIN in the chain when you need to keep unmatched rows. One inner join anywhere in the chain can drop rows that earlier LEFT JOINs kept."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Table and Column Aliases", "url": "https://www.postgresql.org/docs/19/queries-table-expressions.html#QUERIES-TABLE-ALIASES" }
      ]
    },
    {
      "id": "count-sum-avg",
      "title": "COUNT, SUM, AVG",
      "explanation": "An aggregate function takes many rows and returns one value. The common ones: count(*) counts rows, sum(x) adds values, avg(x) averages them, min(x) and max(x) find the smallest and largest. With no GROUP BY (next sub-topic), the whole result is treated as one group and you get a single row.\n\nThe key distinction is count(*) versus count(col). count(*) counts rows. count(col) counts only rows where col is not NULL. All other aggregates also skip NULLs. The second example below shows it: a LEFT JOIN gives 4 rows, but only 3 have an order id.\n\nIf no rows are aggregated at all, count gives 0 but sum gives NULL, not 0. Wrap it as coalesce(sum(x), 0) (coalesce returns its first non-NULL argument, from topic 09) when you want 0.\n\nResult types matter once your Bun code reads the numbers. count returns a bigint (a 64-bit integer), sum of an integer column also returns bigint, and avg returns numeric (exact decimal). Bun.sql hands bigint and numeric values to JavaScript as strings, not numbers; topic 13 covers this.\n\nWhen you know the value is small, write count(*)::int, where ::int casts (converts) the value to a normal integer. round(avg(x)) rounds an average to a whole number.",
      "analogy": "A cashier's end-of-day tally. The cashier counts the receipts (count), adds up their totals (sum), and works out the average sale (avg). Blank receipts, the NULLs, are skipped in the adding and averaging, and count(col) skips them too. If no receipts exist, the total on the till tape is empty rather than 0 until you write 0 on it yourself (coalesce).",
      "code": [
        {
          "language": "sql",
          "filename": "queries/12-aggregates.sql",
          "source": "SELECT count(*) AS orders,\n       sum(total_cents) AS revenue_cents,\n       round(avg(total_cents)) AS avg_cents\nFROM orders;\n\n-- sum over zero rows is NULL, so coalesce it\nSELECT coalesce(sum(total_cents), 0)\nFROM orders\nWHERE user_id = 3;",
          "output": " orders | revenue_cents | avg_cents\n--------+---------------+-----------\n      3 |         10594 |      3531\n(1 row)\n\n coalesce\n----------\n        0\n(1 row)",
          "explanation": "The three order totals are 4998, 199 and 5397, which sum to 10594. The average is 10594 / 3 = 3531.33..., which round turns into 3531. Chen (user 3) has no orders, so sum sees no rows and returns NULL; coalesce turns that into 0."
        },
        {
          "language": "sql",
          "filename": "queries/12-count-star-vs-col.sql",
          "source": "SELECT count(*) AS all_rows,\n       count(o.id) AS order_ids\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id;",
          "output": " all_rows | order_ids\n----------+-----------\n        4 |         3\n(1 row)",
          "explanation": "The LEFT JOIN produces 4 rows (Asha twice, Ben, Chen). count(*) counts all 4. count(o.id) skips Chen's NULL order id and counts 3."
        }
      ],
      "productionNote": "Totals and statistics endpoints (revenue, number of orders) are built from aggregates. Decide the type up front: cast small counts with ::int so JavaScript receives a number, and keep money sums in integer cents, converting to a display format only at the edge.",
      "commonMistakes": [
        "Using count(col) when you mean the number of rows. If col contains NULLs, they are not counted and the result is too small. Use count(*) for rows.",
        "Forgetting that sum of no rows is NULL, so a report shows an empty value instead of 0. Use coalesce(sum(x), 0).",
        "Expecting a JavaScript number from count or sum. They are bigint, which Bun.sql returns as a string (\"3\"), so arithmetic like + 1 would glue strings together. Cast with ::int when safe."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Aggregate Functions", "url": "https://www.postgresql.org/docs/19/functions-aggregate.html" },
        { "title": "PostgreSQL docs: Aggregate Functions (tutorial)", "url": "https://www.postgresql.org/docs/19/tutorial-agg.html" }
      ]
    },
    {
      "id": "group-by-having",
      "title": "GROUP BY & HAVING",
      "explanation": "GROUP BY splits the rows into groups that share the same value, then runs the aggregates once per group, giving one output row per group. Every column in SELECT must either be listed in GROUP BY or be inside an aggregate function. In the example, u.name is fine because we also group by u.id and u.name. Grouping by the primary key u.id keeps two different users with the same name apart.\n\nTwo clauses filter, at different moments. WHERE filters individual rows before they are grouped, so it cannot use aggregates. HAVING filters whole groups after the aggregates are computed, so it can.\n\nThe logical order in which PostgreSQL evaluates a query is: FROM and JOIN, then WHERE, GROUP BY, HAVING, SELECT, ORDER BY, and finally LIMIT. This is why a column alias defined in SELECT cannot be used in WHERE, and why ORDER BY can use it.\n\nThe first example counts orders per user. It uses a LEFT JOIN so Chen still shows up, count(o.id) so Chen counts 0 rather than 1, and coalesce so Chen's sum is 0. The second example combines both filters on an inner join.",
      "analogy": "Sorting laundry. GROUP BY sorts the clothes into piles by colour. You then count each pile (the aggregates). HAVING decides which whole piles are worth washing, for example only piles with more than 5 items. WHERE happened earlier: socks with holes were thrown away before any sorting started.",
      "code": [
        {
          "language": "sql",
          "filename": "queries/12-group-by.sql",
          "source": "SELECT u.name,\n       count(o.id)::int AS order_count,\n       coalesce(sum(o.total_cents), 0) AS spent_cents\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nGROUP BY u.id, u.name\nORDER BY u.id;\n\n-- keep only groups with at least 2 orders\nSELECT u.name,\n       count(o.id)::int AS order_count,\n       coalesce(sum(o.total_cents), 0) AS spent_cents\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nGROUP BY u.id, u.name\nHAVING count(o.id) >= 2\nORDER BY u.id;",
          "output": " name | order_count | spent_cents\n------+-------------+-------------\n Asha |           2 |        5197\n Ben  |           1 |        5397\n Chen |           0 |           0\n(3 rows)\n\n name | order_count | spent_cents\n------+-------------+-------------\n Asha |           2 |        5197\n(1 row)",
          "explanation": "Asha has orders of 4998 and 199 (5197 total), Ben one of 5397, Chen none. The second query adds HAVING, which removes the Ben and Chen groups because their counts are below 2."
        },
        {
          "language": "sql",
          "filename": "queries/12-where-vs-having.sql",
          "source": "SELECT u.name,\n       sum(o.total_cents) AS spent_cents\nFROM users u\nJOIN orders o ON o.user_id = u.id\nWHERE o.status <> 'pending'\nGROUP BY u.name\nHAVING sum(o.total_cents) > 5000\nORDER BY u.name;",
          "output": " name | spent_cents\n------+-------------\n Ben  |        5397\n(1 row)",
          "explanation": "WHERE first removes the pending order (199) row by row. Then the groups are formed: Asha has 4998 left and Ben has 5397. HAVING keeps only groups whose sum is over 5000, which leaves Ben."
        }
      ],
      "productionNote": "Per-customer statistics and admin reports are GROUP BY queries. Put every condition that does not need an aggregate in WHERE rather than HAVING, because it removes rows before the grouping work and is cheaper.",
      "commonMistakes": [
        "Selecting a column that is neither grouped nor aggregated. PostgreSQL stops with an error such as column \"u.name\" must appear in the GROUP BY clause or be used in an aggregate function. Add it to GROUP BY or wrap it in an aggregate.",
        "Using an aggregate in WHERE (WHERE sum(o.total_cents) > 5000). The error is aggregate functions are not allowed in WHERE, because WHERE runs before groups exist. Use HAVING.",
        "Grouping only by a non-unique column such as name, which merges different users who share a name. Group by the primary key too."
      ],
      "sources": [
        { "title": "PostgreSQL docs: GROUP BY and HAVING Clauses", "url": "https://www.postgresql.org/docs/19/queries-table-expressions.html#QUERIES-GROUP" },
        { "title": "PostgreSQL docs: SELECT", "url": "https://www.postgresql.org/docs/19/sql-select.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Chen has no orders. Why is Chen missing from the INNER JOIN of orders and users, but present in users LEFT JOIN orders?",
      "options": [
        "An inner join keeps only rows that found a match, while a left join keeps every left-table row and fills the right-side columns with NULL",
        "An inner join always sorts rows by name and drops the last one",
        "A left join deletes the unmatched rows from the orders table",
        "A left join only works for users whose id is greater than 2"
      ],
      "answerIndex": 0,
      "explanation": "INNER JOIN drops rows without a partner. LEFT JOIN keeps all rows of the left table (users) and puts NULL in the right-table columns when nothing matches. Neither join changes the stored data."
    },
    {
      "question": "What goes wrong if you write WHERE o.status = 'paid' after users u LEFT JOIN orders o ON ...?",
      "options": [
        "PostgreSQL raises a syntax error because WHERE cannot follow a join",
        "Users with no matching order have NULL status, fail the test and disappear, so the LEFT JOIN acts like an INNER JOIN",
        "Every user is duplicated once per order status",
        "The paid orders are deleted from the table"
      ],
      "answerIndex": 1,
      "explanation": "WHERE runs after the join. NULL = 'paid' is not true, so unmatched rows are removed. To keep all users, put the status condition in the ON clause."
    },
    {
      "question": "For Chen in users u LEFT JOIN orders o ON o.user_id = u.id, grouped by user, what do count(*) and count(o.id) return?",
      "options": [
        "0 and 0",
        "1 and 1",
        "0 and 1",
        "1 and 0"
      ],
      "answerIndex": 3,
      "explanation": "Chen produces one joined row, so count(*) is 1. That row has a NULL o.id, which count(o.id) skips, so it is 0. Use count(o.id) to count real orders."
    },
    {
      "question": "Which clause can filter on sum(o.total_cents), and why?",
      "options": [
        "WHERE, because it runs after the aggregates are computed",
        "Both WHERE and HAVING, they are interchangeable",
        "HAVING, because it runs after GROUP BY has formed the groups, while WHERE runs on individual rows before grouping",
        "Neither; aggregates can only appear in the SELECT list"
      ],
      "answerIndex": 2,
      "explanation": "The evaluation order is FROM/JOIN, WHERE, GROUP BY, HAVING, SELECT. Aggregates exist only after grouping, so only HAVING can test them. Using one in WHERE gives the error aggregate functions are not allowed in WHERE."
    },
    {
      "question": "With the course dataset, what does SELECT sum(total_cents) FROM orders return?",
      "options": [
        "3",
        "5397",
        "10594",
        "3531"
      ],
      "answerIndex": 2,
      "explanation": "The order totals are 4998 + 199 + 5397 = 10594 cents. 3 is the row count, 5397 is only Ben's order, and 3531 is the rounded average."
    }
  ]
});
