window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "10-sql-crud",
  "order": 10,
  "title": "SQL CRUD Queries",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "CRUD stands for Create, Read, Update, Delete: the four things an API does with stored data. You will filter rows with WHERE, sort and page them with ORDER BY, LIMIT and OFFSET, change and remove rows safely with UPDATE and DELETE, get the changed rows back with RETURNING, and search text and date ranges.",
  "prerequisites": ["09-relational-postgresql"],
  "subtopics": [
    {
      "id": "filtering-with-where",
      "title": "Filtering with WHERE",
      "explanation": "CRUD is the short name for the four basic data operations: Create (SQL `INSERT`), Read (`SELECT`), Update (`UPDATE`) and Delete (`DELETE`). They map onto the HTTP methods from topic 01: POST creates, GET reads, PATCH updates, DELETE deletes. This topic teaches the parts of SQL you need to build those endpoints.\n\nFirst, some setup. Open `psql` the same way you did in topic 09 (a terminal, then `psql` with your connection URL). Every statement you type must end with a semicolon `;`. The `users` and `products` tables from topic 09 should still exist. This topic assumes `products` has the columns `id`, `name`, `price_cents` and `stock`, holding Notebook (price 2499, stock 10), Pen (price 199) and Backpack (price 4999). If your values differ, your results will differ from the outputs shown. Now create a new table, `orders`, and put three rows in it. Each order stores the buyer's `user_id`, a `status` text, a `total_cents` amount (money as integer cents, as in topic 01) and a `created_at` timestamp. The first code example below does this.\n\nA `WHERE` clause (a clause is one part of a statement) filters rows. PostgreSQL checks the condition for every row and keeps only the rows where it is true. Comparison operators (symbols that compare two values) are `=` (equal, a single equals sign in SQL), `<>` (not equal), `<`, `>`, `<=` and `>=`.\n\nYou combine conditions with `AND` (both must be true), `OR` (at least one must be true) and `NOT` (reverses a condition). `AND` binds tighter than `OR`, like multiplication before addition, so use parentheses to say what you mean.\n\n`IN ('paid', 'shipped')` is a short form for \"equals any value in this list\". `BETWEEN a AND b` means \"greater than or equal to a, and less than or equal to b\": both ends are included.\n\nWithout `ORDER BY` (next sub-topic) PostgreSQL may return rows in any order, so add `ORDER BY name` whenever the order matters.",
      "analogy": "A WHERE clause is a sieve at a gold mine. All the gravel (rows) pours in, and only the pieces that fit the mesh (the condition) stay in the pan. AND makes the mesh finer (every rule must pass), OR lets through anything that fits either of two meshes, and parentheses decide which meshes are stacked together first.",
      "code": [
        {
          "language": "sql",
          "filename": "setup-orders.sql",
          "source": "CREATE TABLE orders (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  user_id bigint NOT NULL,\n  status text NOT NULL,\n  total_cents integer NOT NULL,\n  created_at timestamptz NOT NULL DEFAULT now()\n);\n\nINSERT INTO orders (user_id, status, total_cents, created_at) VALUES\n  (1, 'paid',    4998, '2026-11-05T09:00:00Z'),\n  (1, 'pending', 1200, '2026-11-15T10:30:00Z'),\n  (2, 'shipped', 2499, '2026-11-20T14:00:00Z');",
          "output": "CREATE TABLE\nINSERT 0 3",
          "explanation": "Run this once in psql. The three orders get ids 1, 2 and 3 from the identity column. Timestamps ending in `Z` are written in UTC. `INSERT 0 3` means three rows were inserted. `DEFAULT now()` means: if an INSERT leaves `created_at` out, the database fills in the current time (topic 11 covers DEFAULT in full)."
        },
        {
          "language": "sql",
          "filename": "where-basics.sql",
          "source": "SELECT id, status, total_cents\nFROM orders\nWHERE user_id = 1 AND status IN ('paid', 'shipped');\n\nSELECT name\nFROM products\nWHERE price_cents BETWEEN 100 AND 2500\nORDER BY name;",
          "output": " id | status | total_cents\n----+--------+-------------\n  1 | paid   |        4998\n(1 row)\n\n   name\n----------\n Notebook\n Pen\n(2 rows)",
          "explanation": "The first query keeps orders of user 1 whose status is paid or shipped; order 2 is pending, so only order 1 remains. The second keeps products priced 100 to 2500 cents inclusive: Notebook (2499) and Pen (199) pass, Backpack (4999) does not."
        },
        {
          "language": "sql",
          "filename": "where-precedence.sql",
          "source": "-- AND binds tighter: status = 'paid' OR (status = 'pending' AND user_id = 2)\nSELECT id FROM orders\nWHERE status = 'paid' OR status = 'pending' AND user_id = 2;\n\n-- Parentheses change the meaning: (paid OR pending) AND user 2\nSELECT id FROM orders\nWHERE (status = 'paid' OR status = 'pending') AND user_id = 2;",
          "output": " id\n----\n  1\n(1 row)\n\n id\n----\n(0 rows)",
          "explanation": "Same words, different results. Without parentheses every paid order matches, whoever owns it. With parentheses user 2 owns neither a paid nor a pending order, so nothing matches. Lines starting with `--` are SQL comments."
        }
      ],
      "productionNote": "Almost every \"get my orders\" endpoint is a SELECT with `WHERE user_id = ...` plus optional filters such as status. Always put parentheses around mixed AND/OR conditions so the next reader does not have to remember the precedence rules.",
      "commonMistakes": [
        "Mixing AND and OR without parentheses and getting more rows than intended, because AND is evaluated first.",
        "Writing string values with the wrong case: `'Paid'` does not equal `'paid'`, so the query returns zero rows without any error.",
        "Using double quotes around a value. In SQL, single quotes make a string value; double quotes mean an identifier (a table or column name)."
      ],
      "sources": [
        { "title": "PostgreSQL docs: The WHERE clause", "url": "https://www.postgresql.org/docs/19/queries-table-expressions.html#QUERIES-WHERE" },
        { "title": "PostgreSQL docs: Comparison functions and operators", "url": "https://www.postgresql.org/docs/19/functions-comparison.html" }
      ]
    },
    {
      "id": "sorting-and-limiting",
      "title": "Sorting and limiting (ORDER BY, LIMIT, OFFSET)",
      "explanation": "A table has no built-in order. Unless you write `ORDER BY`, PostgreSQL may return rows in whatever order is convenient, and that order can change between runs. `ORDER BY created_at DESC` sorts by a column; `DESC` means descending (newest or largest first) and `ASC` (the default) means ascending.\n\nYou can list several sort columns. `ORDER BY created_at DESC, id DESC` sorts by time first, and when two rows have the same time, falls back to `id`. That second column is a tie-breaker: it makes the order fully determined, so the same query always returns the same sequence.\n\n`LIMIT n` returns at most n rows. `OFFSET n` skips the first n rows before counting. Together they give page-based pagination (splitting a long list into pages): page 3 with 20 rows per page is `LIMIT 20 OFFSET 40`.\n\n`LIMIT` without `ORDER BY` is unstable: you get \"some\" rows, and different requests may show the same row on two pages or skip a row entirely. Large offsets are also slow, because the database still has to walk past all the skipped rows. Topic 17 shows a faster alternative.",
      "analogy": "Think of a queue at a bank. ORDER BY is how the people are lined up (by ticket time, newest first or oldest first, with the ticket number settling ties). LIMIT 2 is \"serve the next 2 customers\", and OFFSET 2 is \"skip the first 2 people in line\". Without a lined-up queue, \"the next 2 customers\" would be whoever happens to be standing nearest.",
      "code": [
        {
          "language": "sql",
          "filename": "paging.sql",
          "source": "SELECT id FROM orders\nORDER BY created_at DESC, id DESC\nLIMIT 2;\n\nSELECT id FROM orders\nORDER BY created_at DESC, id DESC\nLIMIT 2 OFFSET 2;",
          "output": " id\n----\n  3\n  2\n(2 rows)\n\n id\n----\n  1\n(1 row)",
          "explanation": "Newest first, the orders are 3, 2, 1. Page one (`LIMIT 2`) is orders 3 and 2. Page two skips two rows and shows what is left: order 1, so the page has only one row."
        }
      ],
      "productionNote": "An endpoint like `GET /orders?limit=20&offset=40` becomes `ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET 40`. Always include the tie-breaker, and cap the limit the client may ask for (for example at 100) so nobody requests a million rows.",
      "commonMistakes": [
        "Using LIMIT without ORDER BY, so pages look random and can repeat or skip rows.",
        "Sorting by a column that is not unique (such as `created_at`) with no tie-breaker column, so equal rows can swap places between requests.",
        "Using very large OFFSET values for deep pages; they get slower the further you go."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Sorting rows (ORDER BY)", "url": "https://www.postgresql.org/docs/19/queries-order.html" },
        { "title": "PostgreSQL docs: LIMIT and OFFSET", "url": "https://www.postgresql.org/docs/19/queries-limit.html" }
      ]
    },
    {
      "id": "update-and-delete",
      "title": "UPDATE and DELETE",
      "explanation": "`UPDATE` changes values in existing rows. The shape is `UPDATE table SET column = value, other_column = value WHERE condition;`. `DELETE FROM table WHERE condition;` removes rows. After either command psql prints how many rows were affected, such as `UPDATE 1` or `DELETE 0`. Zero means no row matched the WHERE.\n\nThe most dangerous mistake is forgetting `WHERE`. `UPDATE orders SET status = 'paid';` changes every row in the table, and PostgreSQL will not ask you to confirm. A good habit is to run a `SELECT` with the exact same WHERE first, check that it returns the rows you expect, then replace the `SELECT ... ` part with `UPDATE ... SET ...`.\n\nIn `SET`, the right-hand side can use the current value of the column. `SET stock = stock - 2` means \"new stock is the old stock minus 2\", and PostgreSQL computes it inside the database in one step. Topic 15 explains why this is safer than reading the number into your program, subtracting there and writing it back.\n\nFor orders, real systems often avoid `DELETE` and instead set `status = 'cancelled'`. That is called a soft delete: the row stays, so you keep the history. Use a real `DELETE` when the data truly must go.",
      "analogy": "UPDATE is correction fluid and DELETE is a shredder. Both are precise tools if you point at a page (the WHERE clause). If you do not say which page, you white out or shred the whole binder, and there is no undo button.",
      "code": [
        {
          "language": "sql",
          "filename": "update-delete.sql",
          "source": "-- 1. Look first, using the same WHERE\nSELECT id, status FROM orders WHERE id = 2;\n\n-- 2. Then change it\nUPDATE orders SET status = 'paid' WHERE id = 2;\n\n-- Subtract 2 from the Notebook's stock (it was 10)\nUPDATE products SET stock = stock - 2 WHERE id = 1;\nSELECT name, stock FROM products WHERE id = 1;\n\n-- No order has id 999\nDELETE FROM orders WHERE id = 999;",
          "output": " id | status\n----+---------\n  2 | pending\n(1 row)\n\nUPDATE 1\nUPDATE 1\n   name   | stock\n----------+-------\n Notebook |     8\n(1 row)\n\nDELETE 0",
          "explanation": "The SELECT confirms that exactly one row, id 2, would be touched. `UPDATE 1` reports one changed row. The stock update uses the old value (10) to compute 8. `DELETE 0` is not an error: it simply says nothing matched, which an API would turn into a 404 (not found) response."
        }
      ],
      "productionNote": "These statements sit behind `PATCH /orders/:id` and `DELETE /orders/:id`. The row count tells your code whether the target existed. Never build an UPDATE or DELETE without a WHERE, and consider soft deletes for business records.",
      "commonMistakes": [
        "Running UPDATE or DELETE without WHERE and changing or removing every row.",
        "Reading a value into your program, changing it there, and writing it back. Two requests at once can overwrite each other (a race condition). Use `SET stock = stock - 2` so the database does it in one step.",
        "Treating `DELETE 0` or `UPDATE 0` as success when your code expected one row to exist."
      ],
      "sources": [
        { "title": "PostgreSQL docs: UPDATE", "url": "https://www.postgresql.org/docs/19/sql-update.html" },
        { "title": "PostgreSQL docs: DELETE", "url": "https://www.postgresql.org/docs/19/sql-delete.html" }
      ]
    },
    {
      "id": "returning",
      "title": "RETURNING",
      "explanation": "After you insert a row, you usually need to know what the database generated for it: the new `id`, the default `created_at`, and so on. Adding `RETURNING` at the end of an `INSERT`, `UPDATE` or `DELETE` makes PostgreSQL send back the affected rows, with the columns you list, as the result of the same statement. No second query is needed.\n\nThe number of rows returned also tells you whether anything matched. If an `UPDATE ... WHERE id = 999 RETURNING id` returns zero rows, no order 999 exists, and your API should answer 404 (not found). Topic 13 shows how to read these rows from Bun.\n\nWhen psql shows a RETURNING result, it prints the table first and then the usual row-count line (`INSERT 0 1`, `UPDATE 0`).\n\nA caution about identity values: they come from a counter that never goes backwards. If an insert fails, the number it reserved is still used up, so ids can have gaps. Never assume ids are consecutive.",
      "analogy": "RETURNING is the receipt from a cashier. You pay (write to the database) and immediately get a printed receipt showing the transaction number (the generated id) and what was recorded. Without it you would have to walk back to the counter and ask \"what number was my purchase?\", and someone else might have been served in between.",
      "code": [
        {
          "language": "sql",
          "filename": "returning.sql",
          "source": "INSERT INTO orders (user_id, status, total_cents)\nVALUES (2, 'pending', 2499)\nRETURNING id, status, created_at IS NOT NULL AS has_created_at;\n\nUPDATE orders SET status = 'cancelled' WHERE id = 999 RETURNING id;",
          "output": " id | status  | has_created_at\n----+---------+----------------\n  4 | pending | t\n(1 row)\n\nINSERT 0 1\n id\n----\n(0 rows)\n\nUPDATE 0",
          "explanation": "The insert did not give an id or created_at; the database made them, and RETURNING sends them back. The id is 4 because the three setup rows used 1 to 3 and no earlier insert failed (yours may differ if one did). `t` is how psql shows true; we test created_at instead of printing it, so the output does not depend on the clock. The update matches nothing, so zero rows come back: the 404 signal."
        }
      ],
      "productionNote": "This is the core pattern for repository functions (topic 13): `POST` returns the created row from `INSERT ... RETURNING`, and `PATCH` returns the updated row, or 404 when RETURNING gives no rows. One statement is faster and safer than an INSERT followed by a SELECT.",
      "commonMistakes": [
        "Running a separate SELECT after an INSERT to find the new row. It costs an extra round trip and another request may change the data in between.",
        "Assuming identity ids have no gaps. Failed inserts consume numbers.",
        "Ignoring an empty RETURNING result and telling the client the update succeeded."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Returning data from modified rows", "url": "https://www.postgresql.org/docs/19/dml-returning.html" }
      ]
    },
    {
      "id": "pattern-matching-and-dates",
      "title": "Pattern matching and date filters",
      "explanation": "`LIKE` matches text against a pattern. In a pattern, `%` stands for any run of characters (including none) and `_` stands for exactly one character. `name LIKE 'Note%'` means \"starts with Note\". `LIKE` is case-sensitive. `ILIKE` is a PostgreSQL addition that ignores case, so `name ILIKE '%pen%'` finds Pen, PEN and pen.\n\nIf the text to search for comes from a user, remember that `%` and `_` inside it act as wildcards. To match them literally, put a backslash before them, for example `'100\\%'`. Also, never glue user text into the SQL string yourself. Topic 13 shows how to pass values safely as parameters.\n\nFor dates, compare a `timestamptz` column with a text literal such as `'2026-11-10T00:00:00Z'` (`Z` means UTC). PostgreSQL converts it to a timestamp for the comparison.\n\nTo select a time range, use a half-open range: `created_at >= start AND created_at < end`. The start is included and the end is excluded. This way consecutive ranges (day after day) never overlap and never lose rows. `BETWEEN` includes its end value, so `BETWEEN '2026-11-15' AND '2026-11-16'` also returns a row at exactly midnight of the 16th, and writing `BETWEEN` with an end like 23:59:59 misses the last fraction of a second.\n\nTwo helpers you will meet: `now() - interval '7 days'` is the moment seven days ago (an `interval` is a length of time), and `date_trunc('day', created_at)` rounds a timestamp down to the start of its day.",
      "analogy": "A library search card. `LIKE 'Note%'` is \"titles starting with Note\", and ILIKE is the same search where capital letters do not matter. A date range is \"books returned from Monday up to, but not including, next Monday\": next Monday's returns belong to next week's list, so no book is counted twice or missed.",
      "code": [
        {
          "language": "sql",
          "filename": "patterns-dates.sql",
          "source": "-- Case-insensitive search\nSELECT name FROM products WHERE name ILIKE '%PEN%';\n\n-- Case-sensitive: no product contains the capitals PEN\nSELECT name FROM products WHERE name LIKE '%PEN%';\n\n-- Half-open date range: from Nov 10 up to (not including) Nov 21\nSELECT id FROM orders\nWHERE created_at >= '2026-11-10T00:00:00Z'\n  AND created_at <  '2026-11-21T00:00:00Z'\nORDER BY id;",
          "output": " name\n------\n Pen\n(1 row)\n\n name\n------\n(0 rows)\n\n id\n----\n  2\n  3\n(2 rows)",
          "explanation": "ILIKE finds Pen even though the pattern is capitals. LIKE does not, because the case differs. The date query keeps orders 2 (Nov 15) and 3 (Nov 20). Order 1 (Nov 5) is too early, and order 4 was just created, so it is too late."
        }
      ],
      "productionNote": "Search boxes use ILIKE and \"orders this month\" reports use half-open ranges. A pattern that starts with `%` cannot use a normal index, so on big tables it scans every row; topic 17 covers that. Always pass user text as a parameter, never concatenate it into SQL.",
      "commonMistakes": [
        "Using BETWEEN with timestamps, which includes the end value and invites off-by-one-second bugs. Prefer `>= start AND < end`.",
        "Expecting LIKE to ignore case. Use ILIKE for that.",
        "Forgetting that `%` and `_` typed by a user are wildcards inside the pattern."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Pattern matching (LIKE)", "url": "https://www.postgresql.org/docs/19/functions-matching.html#FUNCTIONS-LIKE" },
        { "title": "PostgreSQL docs: Date/time functions and operators", "url": "https://www.postgresql.org/docs/19/functions-datetime.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why write `ORDER BY created_at DESC, id DESC` instead of only `ORDER BY created_at DESC`?",
      "options": [
        "The id column breaks ties between rows with the same created_at, so the order is always the same",
        "DESC only works when two columns are given",
        "It makes the query return more rows",
        "It stops other users from reading the table"
      ],
      "answerIndex": 0,
      "explanation": "Rows with equal created_at could appear in any order between runs. A unique second column (the tie-breaker) makes the order fully determined, which keeps pages stable."
    },
    {
      "question": "What does `UPDATE orders SET status = 'paid';` (no WHERE) do?",
      "options": [
        "Updates only the newest order",
        "Updates every row in the orders table",
        "Fails with an error because WHERE is required",
        "Does nothing and prints UPDATE 0"
      ],
      "answerIndex": 1,
      "explanation": "Without WHERE every row matches, so every order becomes paid. PostgreSQL does not ask for confirmation, which is why you check with a SELECT using the same WHERE first."
    },
    {
      "question": "A PATCH request targets order 999, which does not exist. How does `UPDATE ... WHERE id = 999 RETURNING id` tell your API?",
      "options": [
        "It raises an error that always contains the word missing",
        "It returns id 999 anyway",
        "It returns zero rows, so the API can answer 404",
        "It creates a new order 999"
      ],
      "answerIndex": 2,
      "explanation": "RETURNING gives back only rows that were actually changed. Zero rows means nothing matched, so the API sends 404 (not found)."
    },
    {
      "question": "Which orders match `created_at >= '2026-11-15T00:00:00Z' AND created_at < '2026-11-16T00:00:00Z'` with our data (order 2 was created on Nov 15 at 10:30 UTC)?",
      "options": [
        "Orders 1 and 2",
        "No rows",
        "All three orders",
        "Only order 2"
      ],
      "answerIndex": 3,
      "explanation": "The range covers exactly Nov 15. Only order 2 was created then; order 1 is from Nov 5 and order 3 from Nov 20."
    },
    {
      "question": "Does `name LIKE '%pen%'` match the product `Pen`?",
      "options": [
        "Yes, LIKE ignores case",
        "No, LIKE is case-sensitive; use ILIKE to match Pen",
        "Yes, but only when the name is in the first row",
        "No, because % cannot be used at the start of a pattern"
      ],
      "answerIndex": 1,
      "explanation": "LIKE compares case-sensitively, so `pen` does not match `Pen`. ILIKE ignores case and does match. A leading `%` is allowed, though it cannot use a normal index."
    }
  ]
});
