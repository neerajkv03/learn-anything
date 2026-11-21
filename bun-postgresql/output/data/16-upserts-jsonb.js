window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "16-upserts-jsonb",
  "order": 16,
  "title": "Upserts, JSONB & Shaping JSON in SQL",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Learn to insert-or-update (upsert) a row in one atomic (all-in-one-step) statement with ON CONFLICT, to store flexible data in a jsonb column (PostgreSQL's column type for JSON data), and to make PostgreSQL build the nested JSON your API returns. You will also learn to split a long query into readable named steps with WITH.",
  "prerequisites": ["15-transactions-concurrency"],
  "subtopics": [
    {
      "id": "upserts-on-conflict",
      "title": "Upserts with INSERT ... ON CONFLICT",
      "explanation": "An upsert (the word joins \"update\" and \"insert\") means: try to insert a row, and if it collides with a row that already exists, do something else instead of failing. In topic 15 you saw that \"read the row, then decide whether to insert or update\" is a race condition: two requests can both read \"not there\" and both insert. An upsert fixes this because PostgreSQL does the check and the write as one atomic step (one indivisible operation that no other request can interleave with).\n\nA \"collision\" means breaking a unique rule: a PRIMARY KEY or UNIQUE constraint (a rule the database enforces, from topic 11). You tell PostgreSQL which rule with a conflict target, the column list in parentheses: `ON CONFLICT (email)`. The target must match an existing unique index or constraint exactly, otherwise PostgreSQL refuses the statement.\n\nAfter the target you choose an action. `DO NOTHING` silently skips the new row. `DO UPDATE SET ...` updates the existing row instead. Inside `DO UPDATE`, the special name `EXCLUDED` is the row you tried to insert, so `EXCLUDED.quantity` is the new quantity you offered. The table name itself (for example `order_items.quantity`) is the row already stored. You can add a `WHERE` after `DO UPDATE SET ...` to update only when a condition holds.\n\n`RETURNING` (topic 10) works with upserts and returns the row that was inserted or updated. With `DO NOTHING`, a skipped row returns nothing, so you get zero rows back.\n\nPostgreSQL 19 adds a third action, `ON CONFLICT DO SELECT ... RETURNING`. It returns the existing conflicting row without changing it, and can lock it with `FOR UPDATE` (a row lock, from topic 15). It is new in 19, so see the release notes before relying on it. This course does not use it further.\n\nIn Bun, you write exactly the same SQL inside a tagged template (topic 13) and pass values with `${}`; they are sent as safe parameters.",
      "analogy": "A hotel check-in desk. A new guest gets a new room card (an insert). A returning guest who already has a booking is not given a second room; the clerk updates the existing booking instead (DO UPDATE), or just says \"you are already checked in\" and does nothing (DO NOTHING). The booking number is the unique rule, and the clerk checks it and acts in one motion, so two clerks cannot both create a booking for the same guest.",
      "code": [
        {
          "language": "sql",
          "filename": "upsert-demo.sql",
          "source": "-- Order 2 already holds 1 Pen (product 2). Add 3 more.\nINSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)\nVALUES (2, 2, 3, 199)\nON CONFLICT (order_id, product_id)\nDO UPDATE SET quantity = order_items.quantity + EXCLUDED.quantity\nRETURNING quantity;\n\n-- asha@example.com already exists, so nothing is inserted.\nINSERT INTO users (email, name, password_hash)\nVALUES ('asha@example.com', 'Asha', 'x')\nON CONFLICT (email) DO NOTHING\nRETURNING id;",
          "output": " quantity\n----------\n        4\n(1 row)\n\nINSERT 0 1\n\n id\n----\n(0 rows)\n\nINSERT 0 0",
          "explanation": "Run in psql. The first statement collides on the composite primary key (order_id, product_id), so DO UPDATE runs: stored 1 + offered 3 = 4. The second collides on the unique email, DO NOTHING skips it, and RETURNING has no row to return."
        },
        {
          "language": "typescript",
          "filename": "upsert-demo.ts",
          "source": "import { sql } from \"bun\";\n\nconst email = \"asha@example.com\";\nconst rows = await sql`\n  INSERT INTO users (email, name, password_hash)\n  VALUES (${email}, ${\"Asha\"}, ${\"x\"})\n  ON CONFLICT (email) DO NOTHING\n  RETURNING id\n`;\n\nconsole.log(rows.length);\nawait sql.close();",
          "output": "0",
          "explanation": "The same upsert from Bun. The three values travel as parameters. Because the email already exists, RETURNING gives no rows, so the result array is empty and its length is 0. Always check for an empty result when you use DO NOTHING with RETURNING."
        }
      ],
      "productionNote": "Upserts make writes idempotent (safe to repeat with the same result): seed scripts (topic 14), counters such as \"add to cart quantity\", and \"set preference\" endpoints all rely on them. Prefer an upsert over \"SELECT, then INSERT or UPDATE\" in application code, because it needs one round trip (one request and reply to the database) and has no race window.",
      "commonMistakes": [
        "Writing a conflict target that has no matching unique index or constraint. PostgreSQL answers with: ERROR:  there is no unique or exclusion constraint matching the ON CONFLICT specification. Add the constraint first, or use the columns of the one that exists.",
        "Expecting RETURNING to give a row when DO NOTHING skipped it. A skipped row returns nothing, so handle the empty result.",
        "Writing `SET quantity = EXCLUDED.quantity` when you meant to add to the stored value. That overwrites; use `order_items.quantity + EXCLUDED.quantity` to accumulate."
      ],
      "sources": [
        { "title": "PostgreSQL 19: INSERT, ON CONFLICT clause", "url": "https://www.postgresql.org/docs/19/sql-insert.html#SQL-ON-CONFLICT" },
        { "title": "PostgreSQL 19 release notes", "url": "https://www.postgresql.org/docs/19/release-19.html" }
      ]
    },
    {
      "id": "jsonb-columns-operators",
      "title": "JSONB columns & operators",
      "explanation": "JSON is the text format for objects and lists you met in topic 1. PostgreSQL has two column types for it: `json` stores the text as you wrote it, while `jsonb` stores a parsed (already read and understood) binary form. Use `jsonb`: it is faster to query, supports searching operators and indexes, and is what almost every project picks. `json` is only useful if you must keep the exact original text.\n\nA `jsonb` column suits flexible, schema-light data, such as order metadata (was it gift wrapped, which app sent it). Keep core fields that you filter, join or constrain (status, totals, user id) as real columns, because real columns have types, NOT NULL, CHECK and foreign keys, and jsonb does not.\n\nThe migration for our orders table adds one column. Save it as `migrations/0004_orders_metadata.sql`, then apply it with your migration runner from topic 14 (`bun run scripts/migrate.ts`):\n\n`ALTER TABLE orders ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;`\n\n`'{}'::jsonb` converts the text `{}` (an empty JSON object) to jsonb with a cast (the `::type` syntax). Every existing order gets an empty object.\n\nFour operators (symbols that combine or inspect values) do most of the work. `->` gets a value as JSON, so `metadata->'giftWrap'` is JSON `true`. `->>` gets the value as plain text, so `metadata->>'source'` is the text `mobile`. `@>` means \"contains\": `metadata @> '{\"giftWrap\": true}'` is true when the left side includes that key and value. `||` merges two objects, with the right side winning on duplicate keys.\n\nTwo more you should know exist: `metadata - 'key'` removes a key, and the function `jsonb_set(...)` replaces a value at a path. A GIN index (a special index type built for searching inside values) can speed up `@>` on large tables; indexes are the subject of topic 17.\n\nIn Bun, a jsonb column comes back already parsed into a JS object (topic 13), so `o.metadata.source` just works. When writing, pass `JSON.stringify(object)` (turns an object into JSON text, topic 1) and add `::jsonb` yourself, so the conversion is explicit and does not depend on how the driver guesses types.",
      "analogy": "A filing cabinet with fixed, labelled drawers (the real columns: id, status, total) plus a \"notes\" envelope clipped to each folder. You can tuck any extra notes in the envelope without building a new drawer, and you can still ask \"which envelopes mention gift wrap?\". But a drawer label guarantees what goes inside, and the envelope guarantees nothing, so important things belong in drawers.",
      "code": [
        {
          "language": "sql",
          "filename": "0004_orders_metadata.sql",
          "source": "ALTER TABLE orders ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;",
          "output": "",
          "explanation": "The migration file. It prints nothing when your runner applies it. NOT NULL plus a default of an empty object means code can always read metadata without a null check."
        },
        {
          "language": "sql",
          "filename": "jsonb-demo.sql",
          "source": "UPDATE orders\nSET metadata = metadata || '{\"giftWrap\": true, \"source\": \"mobile\"}'::jsonb\nWHERE id = 1;\n\nSELECT id,\n       metadata->>'source' AS source,\n       metadata->'giftWrap' AS gift\nFROM orders\nWHERE metadata @> '{\"giftWrap\": true}';",
          "output": "UPDATE 1\n\n id | source | gift\n----+--------+------\n  1 | mobile | true\n(1 row)",
          "explanation": "|| merges two keys into order 1's metadata. ->> returns text, -> returns JSON (true), and @> in WHERE keeps only orders whose metadata contains giftWrap: true."
        },
        {
          "language": "typescript",
          "filename": "jsonb-demo.ts",
          "source": "import { sql } from \"bun\";\n\nconst patch = { giftWrap: true, source: \"mobile\" };\nawait sql`\n  UPDATE orders\n  SET metadata = metadata || ${JSON.stringify(patch)}::jsonb\n  WHERE id = ${\"1\"}\n`;\n\nconst [o] = await sql`SELECT metadata FROM orders WHERE id = ${\"1\"}`;\nconsole.log(o.metadata.source);\nconsole.log(o.metadata.giftWrap);\nawait sql.close();",
          "output": "mobile\ntrue",
          "explanation": "The patch object becomes JSON text with JSON.stringify and is cast with ::jsonb in the SQL. Reading back, o.metadata is already a JS object, so you access its properties directly. The id is passed as the string \"1\" because bigint values are strings in this course (topic 13)."
        }
      ],
      "productionNote": "Good fits for jsonb are integration payloads (the raw body a partner sent you) and per-row feature flags or client info. Validate the shape in your code before storing it, because the database will not. Create a GIN index only when `@>` queries on a large table are slow (topic 17).",
      "commonMistakes": [
        "Putting everything in jsonb. You lose column types, NOT NULL, CHECK and foreign keys, and queries get harder. Anything you filter, join or must enforce should be a real column.",
        "Mixing up -> and ->>. -> returns JSON (a string comes back with quotes), ->> returns text. Use ->> when you want to compare to or display plain text.",
        "Choosing the json type instead of jsonb. json keeps raw text and supports far fewer operations and indexes."
      ],
      "sources": [
        { "title": "PostgreSQL 19: JSON types", "url": "https://www.postgresql.org/docs/19/datatype-json.html" },
        { "title": "PostgreSQL 19: JSON functions and operators", "url": "https://www.postgresql.org/docs/19/functions-json.html" }
      ]
    },
    {
      "id": "api-shaped-json",
      "title": "Building API-shaped JSON in SQL (json_build_object, json_agg)",
      "explanation": "An order detail endpoint returns one object with an `items` list inside. You could run one query for the order and another for its items and join them in TypeScript, but PostgreSQL can build the final JSON itself in one query (one round trip to the database). This also avoids the \"N+1\" problem (one query per row of a list) that topic 17 explains.\n\n`json_build_object('key', value, 'key2', value2, ...)` builds a JSON object from alternating keys and values. You can write the keys in camelCase (`'totalCents'`) so they already match your API.\n\n`json_agg(expr ORDER BY ...)` is an aggregate function (topic 12): it collects one value per row of a group into a JSON array. Put `ORDER BY` inside the parentheses to fix the order of the array, because without it the order is not guaranteed. Because `json_agg` is an aggregate, the query needs `GROUP BY` (here `GROUP BY o.id`).\n\nWith a LEFT JOIN (topic 12), an order with no items still produces one row whose item columns are NULL, and `json_agg` would turn that into an array holding one object whose values are all null. Fix it with `FILTER (WHERE oi.order_id IS NOT NULL)`, which makes the aggregate ignore those empty rows, then wrap the result in `coalesce(..., '[]'::json)` so an order with no items returns an empty list `[]` instead of NULL.\n\nIds are bigint, which our API sends as strings (topic 13), so cast with `o.id::text`. Name the output column `order_json`, not `order`, because `order` is a reserved word (a word SQL keeps for itself, as in ORDER BY). In Bun, json columns are returned already parsed, so `row.order_json` is a JS object.",
      "analogy": "Packing a lunchbox in the kitchen instead of handing the customer loose ingredients at the counter. The database (kitchen) assembles the finished meal, nested compartments and all, and the API (waiter) just carries it out. json_build_object makes one compartment, json_agg fills a compartment with several of the same item in a set order, and the FILTER step is checking that you do not pack an empty wrapper labelled \"item\" when there is no food.",
      "code": [
        {
          "language": "sql",
          "filename": "order-json.sql",
          "source": "SELECT json_build_object(\n         'id', o.id::text,\n         'status', o.status,\n         'totalCents', o.total_cents,\n         'items', coalesce(\n           json_agg(\n             json_build_object(\n               'productId', oi.product_id::text,\n               'name', p.name,\n               'quantity', oi.quantity\n             )\n             ORDER BY oi.product_id\n           ) FILTER (WHERE oi.order_id IS NOT NULL),\n           '[]'::json\n         )\n       ) AS order_json\nFROM orders o\nLEFT JOIN order_items oi ON oi.order_id = o.id\nLEFT JOIN products p ON p.id = oi.product_id\nWHERE o.id = 3\nGROUP BY o.id;",
          "output": "{\"id\" : \"3\", \"status\" : \"shipped\", \"totalCents\" : 5397, \"items\" : [{\"productId\" : \"2\", \"name\" : \"Pen\", \"quantity\" : 2}, {\"productId\" : \"3\", \"name\" : \"Backpack\", \"quantity\" : 1}]}",
          "explanation": "psql shows this single value in the order_json column (the header and borders are left out here). Order 3 has two lines, ordered by product id. The spacing around the colons is how PostgreSQL prints json_build_object output; the content is valid JSON."
        },
        {
          "language": "typescript",
          "filename": "order-json.ts",
          "source": "import { sql } from \"bun\";\n\nconst [row] = await sql`\n  SELECT json_build_object(\n           'id', o.id::text,\n           'status', o.status,\n           'totalCents', o.total_cents,\n           'items', coalesce(\n             json_agg(\n               json_build_object(\n                 'productId', oi.product_id::text,\n                 'name', p.name,\n                 'quantity', oi.quantity\n               )\n               ORDER BY oi.product_id\n             ) FILTER (WHERE oi.order_id IS NOT NULL),\n             '[]'::json\n           )\n         ) AS order_json\n  FROM orders o\n  LEFT JOIN order_items oi ON oi.order_id = o.id\n  LEFT JOIN products p ON p.id = oi.product_id\n  WHERE o.id = ${\"3\"}\n  GROUP BY o.id\n`;\n\nconsole.log(JSON.stringify(row?.order_json));\nawait sql.close();",
          "output": "{\"id\":\"3\",\"status\":\"shipped\",\"totalCents\":5397,\"items\":[{\"productId\":\"2\",\"name\":\"Pen\",\"quantity\":2},{\"productId\":\"3\",\"name\":\"Backpack\",\"quantity\":1}]}",
          "explanation": "Bun parses the json column into a JS object, so no JSON.parse is needed. JSON.stringify prints it compactly. `row?.` guards against no matching order (row would be undefined)."
        }
      ],
      "productionNote": "This is the shape of the order detail endpoint you will build in topic 18: the repository returns one ready-made object per order. Keep the query in one named function so the JSON keys live in a single place.",
      "commonMistakes": [
        "Forgetting GROUP BY when using json_agg. PostgreSQL then raises an error about the column needing to appear in GROUP BY or an aggregate function.",
        "Getting `[{\"productId\":null,\"name\":null,\"quantity\":null}]` (one all-null item) for an order without items. Add FILTER (WHERE oi.order_id IS NOT NULL) and coalesce(..., '[]'::json).",
        "Leaving out ORDER BY inside json_agg. The array order is then unspecified and can change between runs."
      ],
      "sources": [
        { "title": "PostgreSQL 19: JSON creation functions", "url": "https://www.postgresql.org/docs/19/functions-json.html#FUNCTIONS-JSON-CREATION-TABLE" },
        { "title": "PostgreSQL 19: aggregate functions", "url": "https://www.postgresql.org/docs/19/functions-aggregate.html" }
      ]
    },
    {
      "id": "common-table-expressions",
      "title": "Common table expressions (WITH)",
      "explanation": "A common table expression, or CTE, is a named sub-query defined at the top of a statement with `WITH name AS (SELECT ...)`. The main query after it can use `name` as if it were a table. You read the statement top to bottom: first the helper, then the final query.\n\nYou can define several CTEs, separated by commas, and a later one can use an earlier one. Compared with a sub-query nested in the middle of a `FROM` clause, a CTE gives the step a name and keeps the main query short.\n\nA CTE can even contain `UPDATE ... RETURNING` or `DELETE ... RETURNING` (a data-modifying CTE), so the rows it changed feed the next step. We only name this here.\n\nPostgreSQL is free to fold a simple CTE into the main query rather than computing it separately. If you must force a separate computation, write `WITH name AS MATERIALIZED (...)`. Most of the time you can ignore this.",
      "analogy": "Recipe prep steps. \"First make the sauce, then pour it over the pasta\" is easier to follow than one giant run-on sentence with the sauce method buried in brackets. The CTE is the named prep step (the sauce), and the final SELECT is the plating.",
      "code": [
        {
          "language": "sql",
          "filename": "cte-demo.sql",
          "source": "WITH user_totals AS (\n  SELECT user_id, sum(total_cents) AS spent\n  FROM orders\n  GROUP BY user_id\n)\nSELECT u.name, ut.spent\nFROM user_totals ut\nJOIN users u ON u.id = ut.user_id\nWHERE ut.spent > 5000\nORDER BY ut.spent DESC;",
          "output": " name | spent\n------+-------\n Ben  |  5397\n Asha |  5197\n(2 rows)",
          "explanation": "Step one (the CTE) totals spending per user. Step two joins that result to users to get names, keeps people who spent more than 5000 cents, and sorts the biggest spender first."
        }
      ],
      "productionNote": "CTEs keep report queries and multi-step repository queries readable and easy to review. Name each CTE for what it contains (user_totals), not how it is computed.",
      "commonMistakes": [
        "Assuming a CTE is always computed once and cached. PostgreSQL may inline it; add the MATERIALIZED keyword if you need it computed separately.",
        "Chaining many CTEs when one plain join would do. Long chains are harder to read and debug than the simpler query."
      ],
      "sources": [
        { "title": "PostgreSQL 19: WITH queries (common table expressions)", "url": "https://www.postgresql.org/docs/19/queries-with.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "In `DO UPDATE SET quantity = order_items.quantity + EXCLUDED.quantity`, what is EXCLUDED?",
      "options": [
        "The row already stored in the table",
        "The row you tried to insert",
        "A list of columns that are skipped",
        "A copy of the row after the update"
      ],
      "answerIndex": 1,
      "explanation": "EXCLUDED is the row that was proposed for insertion and collided. The table name (order_items.quantity) is the stored row, so the expression adds the new quantity to the old one."
    },
    {
      "question": "Which one returns the value as plain text: `metadata->'source'` or `metadata->>'source'`?",
      "options": [
        "`metadata->>'source'`",
        "`metadata->'source'`",
        "Both return plain text",
        "Neither; you need a cast to get text"
      ],
      "answerIndex": 0,
      "explanation": "->> returns text. -> returns a JSON value, so a string keeps its quotes and is still JSON."
    },
    {
      "question": "Why use `FILTER (WHERE oi.order_id IS NOT NULL)` with `json_agg` after a LEFT JOIN?",
      "options": [
        "It makes the array sort faster",
        "It converts the ids to text",
        "An order with no items would otherwise produce an array with one object full of nulls",
        "It removes the need for GROUP BY"
      ],
      "answerIndex": 2,
      "explanation": "A LEFT JOIN keeps an order with no items as one row of NULLs, and json_agg would add an object of nulls to the array. FILTER ignores those rows, and coalesce turns the empty result into []."
    },
    {
      "question": "What does `WITH` give you compared to a nested sub-query?",
      "options": [
        "It always runs faster",
        "It lets you skip the GROUP BY",
        "It stores the result permanently in the database",
        "A named step that reads top to bottom, which makes long queries easier to follow"
      ],
      "answerIndex": 3,
      "explanation": "A CTE names an intermediate step so the main query stays short and readable. It is not a permanent table and is not guaranteed to be faster."
    },
    {
      "question": "When should a field be a real column instead of living inside jsonb?",
      "options": [
        "When it is rarely used",
        "When you need to filter, join or enforce rules on it, such as status or total",
        "When the value is a string",
        "Never; jsonb is always better because it is flexible"
      ],
      "answerIndex": 1,
      "explanation": "Real columns have types, NOT NULL, CHECK and foreign keys, and are easy to query and index. Use jsonb only for optional, loosely structured extras."
    }
  ]
});
