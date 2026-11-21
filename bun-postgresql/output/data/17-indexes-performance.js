window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "17-indexes-performance",
  "order": 17,
  "title": "Indexes & Query Performance",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Learn how a B-tree index (a sorted lookup structure) lets PostgreSQL find rows without reading the whole table, what it costs on writes, and how to create single-column, composite and unique indexes. Then read EXPLAIN output to see what the database really does, remove the N+1 problem (one query per row of a list) from Bun code, and build keyset pagination (continue from the last row you returned) for GET /orders.",
  "prerequisites": ["16-upserts-jsonb"],
  "subtopics": [
    {
      "id": "how-a-btree-index-works",
      "title": "How a B-tree index works",
      "explanation": "Imagine the orders table holds 200,000 rows and you ask for the orders of one user. Without help, PostgreSQL must read every row and check it: this is called a sequential scan (a scan that walks the whole table from start to end). It is fine for a few hundred rows and slow for millions.\n\nAn index is a separate, sorted structure that PostgreSQL keeps next to the table. The default kind is a B-tree: a balanced tree of sorted keys, where each key points to the row (or rows) that hold it. To find a value, the database walks down the tree in a few steps instead of reading everything. Because the keys are sorted, a B-tree also helps with `=`, `<`, `>`, `BETWEEN` and `ORDER BY` (the rows can be read already in order). A prefix search such as `LIKE 'abc%'` can use it too, but only if the column uses the C collation (plain byte-order sorting) or the index is set up for prefix matching (a special setting you can ignore for now). Treat that as a pointer for later, not something to set up now.\n\nIndexes are not free. They take disk space, and every INSERT, every DELETE and every UPDATE that changes an indexed column must also update each index on that table. More indexes mean faster reads and slower writes.\n\nSome indexes appear automatically: a PRIMARY KEY and a UNIQUE constraint each create one. A FOREIGN KEY does not. So a column like `orders.user_id`, which you filter and join on constantly, has no index until you create it.\n\nYou can list the indexes of a table with the system view `pg_indexes` (a built-in read-only table that describes the database itself).",
      "analogy": "The index at the back of a textbook. To find \"transactions\" you look it up and go straight to page 212, instead of reading every page. But the price is real: every time a new edition is printed, the index has to be updated as well, which makes publishing slower.",
      "code": [
        {
          "language": "bash",
          "filename": "list-indexes.sh",
          "source": "psql \"$DATABASE_URL\" -c \"SELECT indexname FROM pg_indexes WHERE tablename = 'users' ORDER BY indexname;\"",
          "output": "    indexname\n-----------------\n users_email_key\n users_pkey\n(2 rows)",
          "explanation": "Run this in a terminal opened in your project folder (it uses psql, from topic 09, and the DATABASE_URL variable from topic 07). The users table has two indexes that you never wrote yourself: users_pkey from the primary key and users_email_key from the UNIQUE constraint on email. Neither orders.user_id nor any other foreign key column shows up here, which is why you must add those yourself. In PowerShell, replace `$DATABASE_URL` with `$env:DATABASE_URL`."
        }
      ],
      "productionNote": "Before shipping an endpoint, look at its WHERE, JOIN and ORDER BY columns and ask whether an index serves them. Do it for foreign key columns too, because joins and the lookup of child rows depend on them. Then keep the set small: each extra index is paid for on every write.",
      "commonMistakes": [
        "Indexing every column \"just in case\". Each unused index still costs disk space and slows every write.",
        "Assuming a FOREIGN KEY creates an index. It does not, so a column such as orders.user_id stays unindexed until you create one.",
        "Expecting an index to help on a tiny table. For a handful of rows reading the table directly is cheaper, and PostgreSQL knows it."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Indexes, Introduction", "url": "https://www.postgresql.org/docs/19/indexes-intro.html" },
        { "title": "PostgreSQL docs: Index types (B-tree)", "url": "https://www.postgresql.org/docs/19/indexes-types.html#INDEXES-TYPES-BTREE" }
      ]
    },
    {
      "id": "single-composite-unique-indexes",
      "title": "Single, composite & unique indexes",
      "explanation": "The basic command is `CREATE INDEX name ON table (column)`. That is a single-column index. A composite (multi-column) index lists several columns, for example `(user_id, created_at DESC, id DESC)`. The index is sorted by the first column, then by the second inside equal first values, then by the third.\n\nThat sort order gives the leftmost-prefix rule: an index can be used for the leading columns, taken from the left. The index above serves `WHERE user_id = 2`, and it serves `WHERE user_id = 2 ORDER BY created_at DESC, id DESC` perfectly, because the rows are already stored in that order. It does not help a query that filters on `created_at` alone, because without `user_id` the sorted order is useless. So the order of the columns matters: put the column you compare with `=` first, then the sort columns.\n\n`CREATE UNIQUE INDEX` builds an index that also rejects duplicate values (this is what a UNIQUE constraint uses underneath). An expression index indexes a computed value, for example a unique index on `lower(email)` makes email uniqueness case-insensitive. We only name this idea here.\n\nOn a big production table, a plain `CREATE INDEX` blocks writes to the table while it builds. `CREATE INDEX CONCURRENTLY` avoids that block, but PostgreSQL refuses to run it inside a transaction. Our migration runner from topic 14 wraps every file in a transaction, so a CONCURRENTLY index cannot go into a normal migration file. That is a known limit of our runner: for a large production table, run that one statement separately by hand.\n\nOur migration `0005_indexes.sql` is small and the tables are small, so the plain form is correct. `order_items` already has a primary key starting with `order_id`, so only `product_id` needs an extra index there.",
      "analogy": "A phone book sorted by surname, then first name. It is great for \"all the Smiths\" and for \"Smith, John\". It is useless for \"everyone named John\", because the Johns are scattered through every surname. A composite index works the same way: it helps from the left column onwards, and not from a column in the middle.",
      "code": [
        {
          "language": "sql",
          "filename": "0005_indexes.sql",
          "source": "-- Serves: WHERE user_id = ? ORDER BY created_at DESC, id DESC\nCREATE INDEX orders_user_id_created_at_idx ON orders (user_id, created_at DESC, id DESC);\n\n-- order_items' primary key already starts with order_id\nCREATE INDEX order_items_product_id_idx ON order_items (product_id);",
          "output": "",
          "explanation": "Save this file in the migrations folder next to the earlier numbered files, then apply it with the runner (for example `bun run scripts/migrate.ts`). The first index matches the list query of GET /orders: filter by user, newest first, with id as the tie-breaker. The second speeds up looking up all order lines for a product."
        },
        {
          "language": "bash",
          "filename": "list-order-indexes.sh",
          "source": "psql \"$DATABASE_URL\" -c \"SELECT indexname FROM pg_indexes WHERE tablename = 'orders' ORDER BY indexname;\"",
          "output": "           indexname\n-------------------------------\n orders_pkey\n orders_user_id_created_at_idx\n(2 rows)",
          "explanation": "After the migration, the orders table has its primary key index plus the new composite index. In PowerShell, replace `$DATABASE_URL` with `$env:DATABASE_URL`."
        },
        {
          "language": "sql",
          "filename": "concurrently-in-transaction.sql",
          "source": "BEGIN;\nCREATE INDEX CONCURRENTLY orders_status_idx ON orders (status);\nROLLBACK;",
          "output": "BEGIN\nERROR:  CREATE INDEX CONCURRENTLY cannot run inside a transaction block\nROLLBACK",
          "explanation": "Type these three lines into an interactive psql session. This is exactly the error you would hit if you put CREATE INDEX CONCURRENTLY into a migration file, since the runner wraps each file in a transaction. The index is not created."
        }
      ],
      "productionNote": "Design indexes from the real queries of your API, not from the table alone. For GET /orders the query is \"orders of one user, newest first\", so the index is (user_id, created_at DESC, id DESC). For very large live tables, create indexes with CONCURRENTLY in a separate step outside the migration transaction.",
      "commonMistakes": [
        "Wrong column order in a composite index, such as (created_at, user_id) for a query that filters by user_id. The leftmost column must be the one the query filters on.",
        "Creating duplicate indexes. An index on (user_id) is redundant when (user_id, created_at DESC, id DESC) already exists, because the leftmost prefix covers it.",
        "Running CREATE INDEX CONCURRENTLY inside a transaction block, which fails with: ERROR:  CREATE INDEX CONCURRENTLY cannot run inside a transaction block."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Multicolumn indexes", "url": "https://www.postgresql.org/docs/19/indexes-multicolumn.html" },
        { "title": "PostgreSQL docs: CREATE INDEX", "url": "https://www.postgresql.org/docs/19/sql-createindex.html" }
      ]
    },
    {
      "id": "reading-explain",
      "title": "Reading EXPLAIN & EXPLAIN ANALYZE",
      "explanation": "The planner (the part of PostgreSQL that decides how to run a query) chooses a plan: which indexes to use, in what order to join tables. You can ask to see that plan. `EXPLAIN` prints the plan with estimates and does not run the query. `EXPLAIN ANALYZE` actually runs the query and adds what really happened: actual time, actual rows and loops (how many times a step ran).\n\nAn important warning: `EXPLAIN ANALYZE` really executes the statement, so with INSERT, UPDATE or DELETE it really changes data. To inspect a write safely, wrap it: `BEGIN; EXPLAIN ANALYZE DELETE ...; ROLLBACK;`.\n\nEach line of a plan is a node. Indented nodes feed their parent, so read from the innermost line outwards. Each node shows `cost=startup..total` (the planner's own unit, not milliseconds), `rows` (estimated row count) and `width` (estimated bytes per row). With ANALYZE you also see `actual time=first..last` in milliseconds, `rows` and `loops`, and a final `Execution Time`.\n\nThe node types you meet first: Seq Scan (reads the whole table), Index Scan (walks an index, then fetches rows from the table), Index Only Scan (answers from the index alone), Bitmap Heap Scan (collects many matches from an index, then reads those table pages in order), Nested Loop and Hash Join (two ways of joining), and Sort.\n\nSigns of trouble: a Seq Scan on a big table with a very selective filter, and estimates far away from actuals (run `ANALYZE table` to refresh the planner's statistics (its stored record of how many rows hold each value)). The reverse also holds: on a small table a Seq Scan is the right choice, so never judge a plan on a tiny development table.\n\nPostgreSQL 19 adds an option to see asynchronous I/O (reads the server starts without waiting for each one): `EXPLAIN (ANALYZE, IO) SELECT ...`. You do not need it now; just know it exists.\n\nThe demo below needs many rows, so it generates them with `generate_series(1, 200000)` (a function that produces the numbers 1 to 200000, one per row) and then runs `ANALYZE orders` to refresh statistics. It is wrapped in a transaction that ends with ROLLBACK, so your real data stays untouched. Inside it we drop the index and recreate it, to compare the plan before and after.",
      "analogy": "A GPS route preview. EXPLAIN is the suggested route with an estimated travel time. EXPLAIN ANALYZE is actually driving the route with a stopwatch, and then comparing the real time with the estimate.",
      "code": [
        {
          "language": "sql",
          "filename": "explain-demo.sql",
          "source": "BEGIN;\n\nINSERT INTO orders (user_id, status, total_cents, created_at)\nSELECT 1 + (g % 3), 'paid', 1000 + (g % 5000), now() - (g || ' minutes')::interval\nFROM generate_series(1, 200000) AS g;\nANALYZE orders;\n\n-- Without the index (transactional DDL: rolled back at the end)\nDROP INDEX orders_user_id_created_at_idx;\nEXPLAIN ANALYZE\nSELECT id FROM orders WHERE user_id = 2 ORDER BY created_at DESC, id DESC LIMIT 20;\n\n-- With the index from 0005_indexes.sql\nCREATE INDEX orders_user_id_created_at_idx ON orders (user_id, created_at DESC, id DESC);\nANALYZE orders;\nEXPLAIN ANALYZE\nSELECT id FROM orders WHERE user_id = 2 ORDER BY created_at DESC, id DESC LIMIT 20;\n\nROLLBACK;",
          "output": "BEGIN\nINSERT 0 200000\nANALYZE\nDROP INDEX\n                                        QUERY PLAN\n-------------------------------------------------------------------------------------------\n Limit  (cost=7461.10..7461.15 rows=20 width=16) (actual time=48.210..48.215 rows=20 loops=1)\n   ->  Sort  (cost=7461.10..7627.77 rows=66667 width=16) (actual time=48.208..48.210 rows=20 loops=1)\n         Sort Key: created_at DESC, id DESC\n         Sort Method: top-N heapsort  Memory: 26kB\n         ->  Seq Scan on orders  (cost=0.00..4207.00 rows=66667 width=16) (actual time=0.020..30.114 rows=66667 loops=1)\n               Filter: (user_id = 2)\n               Rows Removed by Filter: 133333\n Planning Time: 0.150 ms\n Execution Time: 48.300 ms\n(9 rows)\n\nCREATE INDEX\nANALYZE\n                                        QUERY PLAN\n-------------------------------------------------------------------------------------------\n Limit  (cost=0.42..2.10 rows=20 width=16) (actual time=0.030..0.060 rows=20 loops=1)\n   ->  Index Scan using orders_user_id_created_at_idx on orders  (cost=0.42..5600.00 rows=66667 width=16) (actual time=0.028..0.055 rows=20 loops=1)\n         Index Cond: (user_id = 2)\n Planning Time: 0.120 ms\n Execution Time: 0.090 ms\n(5 rows)\n\nROLLBACK",
          "explanation": "All numbers here are illustrative: costs, row counts and times differ on every machine and version, and your plan may look slightly different (for example a parallel Seq Scan, or an Index Only Scan). Only the node types matter. Before the index, the innermost node is a Seq Scan that reads every row and throws away most of them, then a Sort orders the survivors, and Limit keeps 20. After the index, an Index Scan reads rows already in the requested order from the start of user 2's section of the index, so the Sort disappears, Limit stops after 20 rows, and Execution Time drops. The final ROLLBACK undoes the generated rows and the drop and recreate of the index."
        }
      ],
      "productionNote": "When an endpoint is slow, copy its exact SQL into psql and run EXPLAIN ANALYZE before changing anything. Test against realistic data volume, and run ANALYZE first if the estimates look far from the actual numbers. Add the index, run the same EXPLAIN again, and confirm the plan really changed.",
      "commonMistakes": [
        "Running EXPLAIN ANALYZE on a DELETE or UPDATE without BEGIN and ROLLBACK. The statement runs for real and the rows are gone.",
        "Judging a query on a tiny development table. With a few rows a Seq Scan is the correct plan, and the index will only matter at realistic volume.",
        "Reading cost numbers as milliseconds. Cost is the planner's abstract unit; only the actual time values of EXPLAIN ANALYZE are real time."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Using EXPLAIN", "url": "https://www.postgresql.org/docs/19/using-explain.html" },
        { "title": "PostgreSQL docs: EXPLAIN command", "url": "https://www.postgresql.org/docs/19/sql-explain.html" }
      ]
    },
    {
      "id": "n-plus-one-query-problem",
      "title": "The N+1 query problem",
      "explanation": "The N+1 problem means: one query to fetch a list (the 1), then one extra query for each item in that list (the N). For 50 orders that is 51 round trips to the database. Each trip costs network time, often a millisecond or more, so latency adds up and the endpoint gets slower as lists grow. It usually hides in code that awaits a query inside a loop.\n\nThe fix is to ask for all the related rows at once. Collect the ids, run one query with `IN ${sql(ids)}` (the `sql([...])` helper from topic 13 turns an array into a list for IN), and then group the rows in JavaScript. A `Map` is a key-to-value lookup table: here the key is the order id and the value is the list of product ids of that order. Another fix is to let SQL build the nested data with JSON aggregation, as in topic 16.\n\nGuard against an empty list. With zero orders there is nothing to look up, so skip the second query. The example below does that with a check on `ids.length`.\n\nTo detect N+1 in your own code, count the queries a request makes (the example uses a simple counter) or log each query during development. If the count grows with the size of the list, you have N+1.",
      "analogy": "A shopping trip. Driving to the store once for every item on your list is N+1 trips. Taking the whole list and doing one trip is the batched fix. The store is the same distance away each time, so the number of trips is what costs you.",
      "code": [
        {
          "language": "typescript",
          "filename": "n-plus-one.ts",
          "source": "import { sql } from \"bun\";\n\n// Bad: 1 query for the list + 1 query per order\nlet badQueries = 0;\nlet badItems = 0;\nconst orders: { id: string }[] = await sql`SELECT id FROM orders WHERE user_id = ${\"1\"} ORDER BY id LIMIT 2`;\nbadQueries += 1;\nfor (const o of orders) {\n  const items = await sql`SELECT product_id FROM order_items WHERE order_id = ${o.id}`;\n  badQueries += 1;\n  badItems += items.length;\n}\nconsole.log(`bad: ${badQueries} queries, ${badItems} items`);\n\n// Good: 1 query for the list + 1 query for all the lines\nconst ids = orders.map((o) => o.id);\nconst items: { order_id: string; product_id: string }[] =\n  ids.length === 0\n    ? []\n    : await sql`SELECT order_id, product_id FROM order_items WHERE order_id IN ${sql(ids)} ORDER BY order_id, product_id`;\nconst goodQueries = ids.length === 0 ? 1 : 2;\n\nconst byOrder = new Map<string, string[]>();\nfor (const i of items) {\n  const list = byOrder.get(i.order_id) ?? [];\n  list.push(i.product_id);\n  byOrder.set(i.order_id, list);\n}\nconsole.log(`good: ${goodQueries} queries`);\nconsole.log(byOrder.get(\"1\"), byOrder.get(\"2\"));\n\nawait sql.close();",
          "output": "bad: 3 queries, 2 items\ngood: 2 queries\n[ \"1\" ] [ \"2\" ]",
          "explanation": "Run it with `bun run n-plus-one.ts` against the dataset from topic 09 (DATABASE_URL set as in topic 07). User 1 has two orders: order 1 has a Notebook line and order 2 a Pen line, so the first query returns 2 orders. The loop then sends two more queries, 3 in total. The batched version sends 2 queries however many orders there are. The ids are strings because bigint comes back as a string from Bun.sql. The Map is read with get(\"1\") and get(\"2\"), giving each order's product ids."
        }
      ],
      "productionNote": "List endpoints that return nested data (orders with their items) are where N+1 appears. Fetch the children with one batched query, or aggregate them in SQL, and keep the number of queries per request constant regardless of page size.",
      "commonMistakes": [
        "Awaiting a query inside a for loop over the rows of a previous query. Each iteration is another round trip.",
        "Passing an empty array to IN. Guard it, as the example does, so you never build a pointless or invalid query.",
        "Fixing the loop but losing the link between rows. Group the batched rows by the foreign key (order_id) so each parent gets its own children."
      ],
      "sources": [
        { "title": "Bun docs: SQL", "url": "https://bun.com/docs/api/sql" },
        { "title": "MDN: Map", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map" }
      ]
    },
    {
      "id": "keyset-cursor-pagination",
      "title": "Keyset (cursor) pagination",
      "explanation": "Pagination with `LIMIT 20 OFFSET 4000` looks simple, but PostgreSQL still reads and throws away the first 4000 rows, so deep pages get slower. Also, if a new order arrives while the client is paging, every row shifts by one and the client sees a duplicate or misses a row.\n\nKeyset pagination (also called cursor pagination) avoids both. The client remembers the sort key of the last row it received, here `(created_at, id)`, and asks for the rows after it. The SQL uses a row-value comparison, which compares several columns together, in order, as one group (a tuple): `WHERE (created_at, id) < (${c}, ${i}) ORDER BY created_at DESC, id DESC`. With our composite index the database jumps straight to the right place. For one user's list, add `user_id = ${userId}`, the leading column of the index.\n\nThe tie-breaker `id` is essential. Two orders can share the same `created_at`, and a cursor on a non-unique column alone would skip or repeat rows.\n\nFetch `limit + 1` rows. If you get more than `limit`, a next page exists, so drop the extra row and build a cursor from the last row you keep. If you get `limit` or fewer, the next cursor is `null`.\n\nThe cursor is opaque: the client treats it as a meaningless string and sends it back unchanged. We build it as JSON like `{\"c\":\"2026-11-15T09:30:00.000Z\",\"i\":\"2\"}`, encoded with base64url (a way to write bytes as URL-safe text) using `Buffer.from(text).toString(\"base64url\")`. The response shape is `{ \"data\": [...], \"nextCursor\": \"...\" | null }`. Because a cursor comes from the client, in topic 19 you will validate it after decoding.",
      "analogy": "A bookmark in a novel. You continue from the bookmark, instead of counting pages from the first page every time. If the publisher inserts a new chapter at the front, your bookmark still marks the right spot.",
      "code": [
        {
          "language": "typescript",
          "filename": "keyset-demo.ts",
          "source": "import { sql, type SQL } from \"bun\";\n\ninterface OrderRow {\n  id: string;\n  created_at: Date;\n}\n\ninterface Page {\n  data: OrderRow[];\n  nextCursor: string | null;\n}\n\nfunction encodeCursor(row: OrderRow): string {\n  const key = { c: row.created_at.toISOString(), i: row.id };\n  return Buffer.from(JSON.stringify(key)).toString(\"base64url\");\n}\n\nfunction decodeCursor(text: string): { c: string; i: string } {\n  return JSON.parse(Buffer.from(text, \"base64url\").toString(\"utf8\"));\n}\n\nasync function listOrdersPage(\n  db: SQL,\n  userId: string,\n  limit: number,\n  cursor: string | null,\n): Promise<Page> {\n  const key = cursor === null ? null : decodeCursor(cursor);\n  const rows: OrderRow[] = await db`\n    SELECT id, created_at FROM orders\n    WHERE user_id = ${userId}\n    ${key === null ? db`` : db`AND (created_at, id) < (${key.c}, ${key.i})`}\n    ORDER BY created_at DESC, id DESC\n    LIMIT ${limit + 1}`;\n  const data = rows.slice(0, limit);\n  const last = data[data.length - 1];\n  const nextCursor = rows.length > limit && last !== undefined ? encodeCursor(last) : null;\n  return { data, nextCursor };\n}\n\nfunction show(page: Page): void {\n  const cursor = page.nextCursor === null ? null : decodeCursor(page.nextCursor);\n  console.log(JSON.stringify({ ids: page.data.map((o) => o.id), cursor }));\n}\n\nconst first = await listOrdersPage(sql, \"1\", 1, null);\nshow(first);\nconst second = await listOrdersPage(sql, \"1\", 1, first.nextCursor);\nshow(second);\n\nawait sql.close();",
          "output": "{\"ids\":[\"2\"],\"cursor\":{\"c\":\"2026-11-15T09:30:00.000Z\",\"i\":\"2\"}}\n{\"ids\":[\"1\"],\"cursor\":null}",
          "explanation": "Run it with `bun run keyset-demo.ts` on the plain topic 09 dataset (not the 200,000 generated rows). User 1 has order 2 (newest) then order 1. With limit 1 and no cursor, the query fetches 2 rows, keeps order 2, and since a second row exists it builds a cursor from order 2. The demo prints the decoded cursor so you can read it; the real nextCursor is that JSON encoded with base64url. The second call passes the cursor, the comparison (created_at, id) < (...) leaves only order 1, no extra row comes back, and nextCursor is null. The `db` parameter (a SQL client passed in) is the pattern from topic 15, and the empty db`` is the empty fragment trick from topic 13."
        }
      ],
      "productionNote": "Use keyset pagination for infinite scroll, mobile feeds and admin lists, where pages are deep or data keeps changing. Keep the ORDER BY and the comparison direction identical, and make sure the composite index matches. One precaution: PostgreSQL timestamps keep microseconds but a JavaScript Date keeps only milliseconds. If your rows can have sub-millisecond created_at values, carry the timestamp in the cursor at full precision (for example by selecting created_at::text as well) so rows are not skipped.",
      "commonMistakes": [
        "Using only a non-unique column such as created_at as the cursor. Rows with equal values get skipped or repeated; always add the unique id as tie-breaker.",
        "Mismatching ORDER BY and the comparison: sorting DESC but comparing with > returns the wrong rows. Descending order pairs with <.",
        "Returning the extra (limit + 1) row to the client instead of dropping it, or building the cursor from that extra row."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Row-wise comparison", "url": "https://www.postgresql.org/docs/19/functions-comparisons.html#ROW-WISE-COMPARISON" },
        { "title": "PostgreSQL docs: LIMIT and OFFSET", "url": "https://www.postgresql.org/docs/19/queries-limit.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "A table with only 3 rows has an index on the column you filter by, yet EXPLAIN shows a Seq Scan. Why?",
      "options": [
        "The index is broken and must be recreated.",
        "Reading 3 rows directly is cheaper than walking an index, so the planner correctly chooses a Seq Scan.",
        "Seq Scan is always used until ANALYZE has run at least twice.",
        "PostgreSQL never uses an index for a query with a WHERE clause."
      ],
      "answerIndex": 1,
      "explanation": "The planner picks the cheapest plan. For a tiny table, reading everything is cheaper than an index lookup, so a Seq Scan is the right choice there. It says nothing about the index being broken."
    },
    {
      "question": "You have an index on (user_id, created_at). Will it help a query that has only WHERE created_at > '2026-01-01' and no condition on user_id?",
      "options": [
        "Yes, an index on both columns serves a filter on either one equally well.",
        "Yes, but only if you add ORDER BY.",
        "No, the index is sorted by user_id first, so created_at alone is not a usable leftmost prefix.",
        "No, because composite indexes only work with UNIQUE."
      ],
      "answerIndex": 2,
      "explanation": "A B-tree is sorted by the first column, then the second inside equal first values. Without a condition on the leading column, the second column is scattered across the index, like looking for every John in a phone book sorted by surname."
    },
    {
      "question": "Which statement actually runs the query it describes, and therefore can change data if the query is an UPDATE or DELETE?",
      "options": [
        "EXPLAIN ANALYZE",
        "EXPLAIN",
        "Both, EXPLAIN and EXPLAIN ANALYZE run the query.",
        "Neither, both only print a plan."
      ],
      "answerIndex": 0,
      "explanation": "EXPLAIN only shows the planner's estimated plan. EXPLAIN ANALYZE executes the statement to measure real times and rows, so wrap writes in BEGIN and ROLLBACK."
    },
    {
      "question": "The list endpoint loads 50 orders, then runs a separate query for the items of each order inside a for loop. How many queries run?",
      "options": [
        "1",
        "2",
        "50",
        "51"
      ],
      "answerIndex": 3,
      "explanation": "One query fetches the list, plus one query for each of the 50 orders: 1 + 50 = 51. That is the N+1 problem. One batched query with IN would make it 2."
    },
    {
      "question": "Why does keyset pagination fetch limit + 1 rows?",
      "options": [
        "To pre-load the next page into the cache.",
        "To know whether another page exists: if the extra row comes back, a next page exists, and the extra row is dropped.",
        "Because LIMIT in PostgreSQL always returns one row fewer than requested.",
        "To make the cursor shorter."
      ],
      "answerIndex": 1,
      "explanation": "Asking for one more row than you will return tells you cheaply whether more data follows, without a separate count query. You drop the extra row before sending the page."
    }
  ]
});
