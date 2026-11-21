window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "13-bun-sql",
  "order": 13,
  "title": "Talking to PostgreSQL with Bun.sql",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Bun has a PostgreSQL client built in, so no package is needed. You will create one shared pool of connections, run safe queries (values sent separately from the SQL text, called parameters) with tagged templates, convert database rows into API types, build inserts and IN lists with helpers, and close everything cleanly.",
  "prerequisites": ["12-joins-aggregation"],
  "subtopics": [
    {
      "id": "connecting-and-pool",
      "title": "Connecting via DATABASE_URL and the connection pool",
      "explanation": "Until now you typed SQL into psql. Your backend program must send SQL to PostgreSQL itself. Bun includes a PostgreSQL client in the runtime, called Bun.sql, so there is nothing to install. You import its class with `import { SQL } from \"bun\"` (a class is a blueprint you create objects from with `new`), and create a client with `new SQL(url, options)`.\n\nA connection is an open network line between your program and PostgreSQL. Opening one is slow: the two sides must find each other, agree on settings and log in. So Bun does not open one connection per query. It keeps a connection pool, a set of already-open connections that queries borrow and give back. The pool is lazy, meaning it opens nothing until your first query runs, and then opens more connections on demand, up to a maximum.\n\nThe pool is tuned with options, and the time options are in seconds. `max` is the most connections open at once (default 10). `idleTimeout` closes a connection that sat unused for that many seconds (default 0, meaning never). `maxLifetime` retires a connection after that many seconds in total (default 0, meaning never). `connectionTimeout` is how long to wait while connecting before giving up (default 30; since Bun 1.4 it covers the whole login handshake (the back-and-forth where client and server agree and log in), not each message).\n\nThe database address is a URL such as `postgres://user:password@host:5432/dbname`. Add `?sslmode=require` to force an encrypted connection (TLS, the standard way of scrambling network traffic so others cannot read it). Bun can also read `DATABASE_URL` by itself through a ready-made `sql` export, but this course creates its own client from `config.databaseUrl` (the validated config you built in topic 07), so a missing or malformed URL fails at startup with your own clear message.\n\nCreate the file `src/db.ts` shown below. The last line, `export type Sql = typeof sql;`, makes a type name for \"whatever type `sql` has\", which later topics use to pass the pool around. Then create `scripts/db-check.ts` and run it from the project folder with `bun run scripts/db-check.ts`. PostgreSQL must be running and `DATABASE_URL` must be set in your `.env` file.",
      "analogy": "A taxi rank. Instead of buying a new car for every trip (a new connection per query), a fixed fleet of taxis waits at the rank. Each query takes a free taxi and returns it afterwards. If all taxis are busy, passengers queue until one comes back. `max` is the fleet size, `idleTimeout` is how long a parked taxi waits before being sent home, and the taxis are only brought out when the first passenger arrives (lazy).",
      "code": [
        {
          "language": "typescript",
          "filename": "src/db.ts",
          "source": "import { SQL } from \"bun\";\nimport { config } from \"./config\";\n\n// One pool for the whole process. Every repository imports this.\nexport const sql = new SQL(config.databaseUrl, {\n  max: 10,\n  idleTimeout: 30,\n  connectionTimeout: 10,\n});\n\nexport type Sql = typeof sql;",
          "output": "",
          "explanation": "The pool holds at most 10 connections, closes ones idle for 30 seconds, and gives up connecting after 10 seconds. Nothing connects yet: the pool is lazy. The file prints nothing."
        },
        {
          "language": "typescript",
          "filename": "scripts/db-check.ts",
          "source": "import { sql } from \"../src/db\";\n\nconst [row] = await sql`SELECT 1 + 1 AS two`;\nconsole.log(row.two);\n\nawait sql.close();",
          "output": "2",
          "explanation": "The first query makes the pool open its first connection. `const [row] = ...` takes the first row out of the result array (explained in the next sub-topic). `sql.close()` shuts the pool so the script can exit."
        }
      ],
      "productionNote": "Use exactly one pool per process and share it across all requests. Size it so that max (per app instance) multiplied by the number of app instances stays below PostgreSQL's `max_connections` setting (the server's limit on simultaneous connections), leaving room for admin tools and migrations.",
      "commonMistakes": [
        "Creating a new SQL client inside a request handler. Every request then opens its own connections and the database is overwhelmed (a connection storm). Create it once in src/db.ts.",
        "Setting `max` so high that instances x max exceeds PostgreSQL's `max_connections`. New connections are then refused with errors under load.",
        "Forgetting that the time options are in seconds, not milliseconds."
      ],
      "sources": [
        { "title": "Bun docs: SQL", "url": "https://bun.com/docs/api/sql" },
        { "title": "PostgreSQL 19 docs: connection URIs", "url": "https://www.postgresql.org/docs/19/libpq-connect.html#LIBPQ-CONNSTRING-URIS" }
      ]
    },
    {
      "id": "tagged-template-queries",
      "title": "Tagged-template queries",
      "explanation": "You write queries with backticks directly after `sql`, like sql`SELECT ...`. These are the same backtick strings as the template literals from topic 02, with one difference: when a name sits directly in front of the backticks, that name is a function (a tagged template) and it receives the fixed text pieces and the `${...}` values separately, instead of one merged string. Bun.sql uses this to keep your SQL text apart from your data.\n\nA query returns a Promise (topic 05), so always `await` it. The result is an array of row objects: each row is an object whose keys are the column names. A query matching nothing returns an empty array, not an error. The array also has a `count` property (rows affected, useful for UPDATE and DELETE) and a `command` property (the kind of statement, such as \"UPDATE\").\n\nFor a query that returns one row, destructure it: `const [row] = await sql`...``. If no row matched, `row` is `undefined`. With `noUncheckedIndexedAccess` on (topic 06), once you annotate the row type (as in the typing sub-topic), TypeScript types it as possibly missing, so you must check it then.\n\nA bigint column such as `id` arrives in JavaScript as a string like \"1\", not a number. The reason is explained in the typing sub-topic.\n\nFragments let you assemble a query from parts. A `sql`...`` expression nested inside another query is a fragment. For an optional filter write `${cond ? sql`AND status = ${s}` : sql``}`: an empty `sql``` adds nothing.\n\nCreate `scripts/list-orders.ts` and run it with `bun run scripts/list-orders.ts`. It assumes the orders from topic 09, where order 1 is the only paid order and order 2 exists.",
      "analogy": "An order form with printed questions and blank boxes. The kitchen reads the printed text as instructions, and reads whatever is written in the boxes only as ingredients, never as new instructions. The tag `sql` is the kitchen: it always knows which part was printed (your SQL) and which part was filled in (your values).",
      "code": [
        {
          "language": "typescript",
          "filename": "scripts/list-orders.ts",
          "source": "import { sql } from \"../src/db\";\n\nconst status = \"paid\";\nconst rows = await sql`\n  SELECT id, status, total_cents\n  FROM orders\n  WHERE status = ${status}\n  ORDER BY id\n`;\nconsole.log(rows.length, rows[0]);\n\nconst res = await sql`UPDATE orders SET status = 'paid' WHERE id = ${\"2\"}`;\nconsole.log(res.count);\n\nawait sql.close();",
          "output": "1 { id: \"1\", status: \"paid\", total_cents: 4998 }\n1",
          "explanation": "The SELECT returns an array with one row, so `rows.length` is 1 and `rows[0]` is the row object. Note `id` is the string \"1\". The UPDATE touches one row, so `res.count` is 1. Running the script a second time prints 2 on the first line because order 2 is now paid too."
        }
      ],
      "productionNote": "Every repository function in the course is one or more of these queries. Always pass user-supplied values through `${...}` and never edit the SQL text itself.",
      "commonMistakes": [
        "Forgetting `await`. You then hold a Promise instead of rows, and `rows.length` is `undefined`.",
        "Expecting a single object back. A query always returns an array, even when you expect one row.",
        "Expecting a bigint `id` to be a number. It is a string, so `\"1\" === 1` is false."
      ],
      "sources": [
        { "title": "Bun docs: SQL", "url": "https://bun.com/docs/api/sql" },
        { "title": "MDN: tagged templates", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates" }
      ]
    },
    {
      "id": "parameters-and-sql-injection",
      "title": "Parameters and preventing SQL injection",
      "explanation": "SQL injection is an attack where a user's input becomes part of the SQL instructions instead of staying plain data. If you build `\"... WHERE email = '\" + email + \"'\"` and the user types `x' OR '1'='1`, the quote characters close your string and the extra text becomes SQL that matches every row. Attackers use the same trick to read or delete whole tables. It is one of the most common causes of real data breaches.\n\nBun.sql prevents this by design. For `${value}` it sends the SQL text with a numbered placeholder (`$1`) and sends the value in a separate message as a parameter. PostgreSQL never parses the value as SQL, so quotes and keywords inside it are just characters. This is the default for every query you write with the tag.\n\nThe unsafe ways are building a string yourself (with `+` or a plain template literal without the `sql` tag) and `sql.unsafe(text)`, which runs the string you give it exactly as written. Never pass user input to them.\n\nA parameter can only stand in for a value. It cannot be a table or column name. For a dynamic column such as a sort field, write `sql(name)`, which quotes the name as an identifier (a table or column name). Because the name still comes from you, only ever pass a name from an allow-list, a fixed set of permitted choices you defined. Map the user's key to your own column name, with a safe default for unknown keys, as shown below.\n\nAlso remember that in a LIKE pattern (topic 10), `%` and `_` in user input are wildcards. Either escape them or accept that the user is writing a pattern.\n\nCreate `scripts/injection.ts` and run it with `bun run scripts/injection.ts`. It assumes the three seed users.",
      "analogy": "A bank teller and a cheque. The amount box is read only as an amount. If someone writes \"and also empty the vault\" in it, the teller sees an invalid amount, not an instruction. Building a string by hand is like letting customers write directly on the teller's own instruction sheet.",
      "code": [
        {
          "language": "typescript",
          "filename": "scripts/injection.ts",
          "source": "import { sql } from \"../src/db\";\n\nconst email = \"x' OR '1'='1\";\n\n// UNSAFE: the input is pasted into the SQL text.\nconst bad = await sql.unsafe(\n  \"SELECT id FROM users WHERE email = '\" + email + \"'\",\n);\nconsole.log(bad.length);\n\n// SAFE: the input travels as a parameter.\nconst good = await sql`SELECT id FROM users WHERE email = ${email}`;\nconsole.log(good.length);\n\n// Dynamic column: map the user's key to a column YOU chose.\nconst allowed: Record<string, string> = { id: \"id\", name: \"name\" };\nconst sortKey = \"id; DROP TABLE users\";\nconst col = allowed[sortKey] ?? \"id\";\nconst sorted = await sql`SELECT id FROM users ORDER BY ${sql(col)} DESC`;\nconsole.log(col, sorted.length);\n\nawait sql.close();",
          "output": "3\n0\nid 3",
          "explanation": "The unsafe query became `WHERE email = 'x' OR '1'='1'`, which is true for every row, so all 3 users came back. The parameterised query looks for a user whose email is literally that odd text and finds none. The hostile sort key is not in the allow-list, so the code falls back to `id`. `Record<string, string>` is a type for an object whose keys and values are both strings."
        }
      ],
      "productionNote": "Parameterised queries are the default for all queries in this course, and injection is on the OWASP list of top web risks. Treat any use of `sql.unsafe` with a variable as a bug to be reviewed.",
      "commonMistakes": [
        "Passing user input to `sql.unsafe`. It performs no protection at all.",
        "Using a plain template literal (topic 02) such as a string with backticks and no `sql` tag in front. That builds one merged string and is injectable.",
        "Passing user input straight into `sql(identifier)` without checking it against an allow-list."
      ],
      "sources": [
        { "title": "Bun docs: SQL", "url": "https://bun.com/docs/api/sql" },
        { "title": "OWASP SQL Injection Prevention Cheat Sheet", "url": "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html" }
      ]
    },
    {
      "id": "typing-query-results",
      "title": "Typing query results",
      "explanation": "Bun.sql does not know your table layout, and TypeScript cannot check what the database really returns. You tell TypeScript by annotating the variable: `const rows: OrderRow[] = await sql`...``. This is a promise you make, not a check, so keep your row type in step with the columns you SELECT.\n\nThe value types follow PostgreSQL's types. `integer` becomes a number. `bigint` becomes a string, because a JavaScript number cannot hold every 64-bit integer exactly. `numeric` also becomes a string. `boolean` becomes a boolean, `timestamptz` becomes a `Date` (read as UTC), `jsonb` becomes an already-parsed value, a text array becomes an array, and SQL NULL becomes `null`.\n\nThis explains the aggregate trap from topic 12: `count(*)` is a bigint, so it arrives as the string \"3\", and `\"3\" + 1` is the string \"31\". Cast in SQL with `count(*)::int` to get a number. There is an option `bigint: true` that returns real BigInt (JavaScript's type for very large whole numbers) values instead of strings, but BigInt cannot be turned into JSON (`JSON.stringify` throws a TypeError), so the course keeps strings.\n\nDatabase columns use snake_case (`total_cents`), while the API uses camelCase (`totalCents`). Keep the database shape inside the repository and convert in a small mapper function, one per table. Callers then never see snake_case or a `Date` object.\n\nFirst add the API type to `src/types/order.ts`, then the repository, then a script to try it.",
      "analogy": "A customs declaration. You write on the form what is in the box (the type annotation), and customs (TypeScript) trusts the paperwork. If the declaration is wrong, nobody notices until the box is opened, which in your program means a crash or a wrong result at run time.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/types/order.ts",
          "source": "export type OrderStatus = \"pending\" | \"paid\" | \"shipped\" | \"cancelled\";\n\nexport type Order = {\n  id: string;\n  userId: string;\n  status: OrderStatus;\n  totalCents: number;\n  createdAt: string;\n};",
          "output": "",
          "explanation": "The API shape of an order. Ids are strings and the timestamp is an ISO string, so the object can go straight into JSON. If your `OrderStatus` from topic 04 lists different values, keep yours."
        },
        {
          "language": "typescript",
          "filename": "src/repositories/orders.repo.ts",
          "source": "import { sql } from \"../db\";\nimport type { Order, OrderStatus } from \"../types/order\";\n\ntype OrderRow = {\n  id: string;\n  user_id: string;\n  status: OrderStatus;\n  total_cents: number;\n  created_at: Date;\n};\n\nfunction toOrder(r: OrderRow): Order {\n  return {\n    id: r.id,\n    userId: r.user_id,\n    status: r.status,\n    totalCents: r.total_cents,\n    createdAt: r.created_at.toISOString(),\n  };\n}\n\nexport async function findOrderById(id: string): Promise<Order | null> {\n  const rows: OrderRow[] = await sql`\n    SELECT id, user_id, status, total_cents, created_at\n    FROM orders\n    WHERE id = ${id}\n  `;\n  const row = rows[0];\n  return row ? toOrder(row) : null;\n}",
          "output": "",
          "explanation": "`OrderRow` mirrors the columns (bigint ids as `string`, `created_at` as `Date`). `toOrder` converts to the API type. `findOrderById` returns `null` when no row matches, because `rows[0]` is `undefined` for an empty array."
        },
        {
          "language": "typescript",
          "filename": "scripts/find-order.ts",
          "source": "import { sql } from \"../src/db\";\nimport { findOrderById } from \"../src/repositories/orders.repo\";\n\nconsole.log(JSON.stringify(await findOrderById(\"1\"), null, 2));\nconsole.log(await findOrderById(\"999\"));\n\nawait sql.close();",
          "output": "{\n  \"id\": \"1\",\n  \"userId\": \"1\",\n  \"status\": \"paid\",\n  \"totalCents\": 4998,\n  \"createdAt\": \"2026-11-01T10:00:00.000Z\"\n}\nnull",
          "explanation": "Order 1 comes back as a clean camelCase object. Order 999 does not exist, so the function returns `null`. The `createdAt` value is the seed data's timestamp in UTC."
        }
      ],
      "productionNote": "Keep one row type and one mapper per table inside its repository, and let only the API type leave the repository. When you change a SELECT list, update the row type with it.",
      "commonMistakes": [
        "Typing a bigint column as `number`. At run time it is a string, so comparisons and arithmetic misbehave.",
        "Selecting `count(*)` without `::int`, getting \"3\", and then computing `\"3\" + 1`, which gives \"31\".",
        "Returning raw rows to the client, which leaks snake_case names and `Date` objects into the API."
      ],
      "sources": [
        { "title": "Bun docs: SQL", "url": "https://bun.com/docs/api/sql" },
        { "title": "PostgreSQL 19 docs: numeric types", "url": "https://www.postgresql.org/docs/19/datatype-numeric.html" }
      ]
    },
    {
      "id": "helpers-insert-and-in",
      "title": "Helpers: sql(object) for inserts and sql([...]) for IN lists",
      "explanation": "Writing every column and value by hand is long and easy to get wrong. `sql(object)` builds them from an object. In `sql`INSERT INTO users ${sql(newUser)} RETURNING id``, the object keys become the column list and the values become parameters. The keys must match the column names exactly, so they are snake_case (for example `password_hash`).\n\nPass extra strings to choose columns: `sql(newUser, \"email\", \"name\", \"password_hash\")` uses only those three keys and ignores any others. This matters for safety. Mass assignment is a bug where a client sends extra fields (such as `role` or `id`) in a request body and your code stores them all. Never write `sql(requestBody)`. Always list the allowed columns.\n\nAn array of objects does a bulk insert, with the columns taken from the first object. For an UPDATE, write `SET ${sql(patch, \"status\")}`; keys whose value is `undefined` are skipped.\n\nFor an IN list (topic 10), pass an array: `WHERE id IN ${sql(ids)}`. Bun writes the list of parameters for you. If the list could be empty, do not rely on the query: check `ids.length === 0` first and return early with an empty result.\n\nCreate `scripts/helpers.ts`. It assumes the three seed users (so the new user gets id 4) and products 1 and 3 named Notebook and Backpack. Run it once on a fresh seed, because a second run would break the UNIQUE email rule from topic 11.",
      "analogy": "Pre-printed address labels. Instead of handwriting every field on every parcel, you hand over the contact card and the printer fills the right boxes. `sql(obj, \"email\", \"name\")` means \"print only these two lines from the card\", so a stray extra line on the card never ends up on the parcel.",
      "code": [
        {
          "language": "typescript",
          "filename": "scripts/helpers.ts",
          "source": "import { sql } from \"../src/db\";\n\nconst newUser = {\n  email: \"dee@example.com\",\n  name: \"Dee\",\n  password_hash: \"x\",\n};\nconst [created] = await sql`\n  INSERT INTO users ${sql(newUser, \"email\", \"name\", \"password_hash\")}\n  RETURNING id, email\n`;\nconsole.log(created);\n\nconst rows = await sql`\n  SELECT name FROM products WHERE id IN ${sql([\"1\", \"3\"])} ORDER BY id\n`;\nconsole.log(rows.map((r) => r.name));\n\nawait sql.close();",
          "output": "{ id: \"4\", email: \"dee@example.com\" }\n[ \"Notebook\", \"Backpack\" ]",
          "explanation": "The insert builds `(email, name, password_hash) VALUES (...)` from the chosen keys, and RETURNING gives back the new id and email. The IN list becomes one placeholder per id (two here), and `map` turns the rows into just the names."
        }
      ],
      "productionNote": "Use `sql(obj, ...columns)` in create and update endpoints, and `IN ${sql(ids)}` for batch lookups. In topic 17 the IN helper replaces many one-row queries with a single query.",
      "commonMistakes": [
        "Calling `sql(req.body)` with a raw request body. A client can set columns such as `role` or `id` that you never meant to allow.",
        "Using object keys in camelCase. The keys must equal the column names, so they must be snake_case.",
        "Passing a possibly empty array to IN without checking. Return early when the list is empty instead of relying on the query."
      ],
      "sources": [
        { "title": "Bun docs: SQL", "url": "https://bun.com/docs/api/sql" }
      ]
    },
    {
      "id": "db-module-and-closing",
      "title": "The src/db module, closing connections and errors",
      "explanation": "`src/db.ts` exports the single pool. Repositories import it (topic 18 changes this to receiving it as a parameter). A short script must call `await sql.close()` when it is done. Open connections can keep the process alive, so a script that never closes may hang instead of exiting.\n\n`sql.close()` waits for queries that are still running, then closes the connections. `sql.close({ timeout: 5 })` waits at most 5 seconds and then closes anyway. `sql.close({ timeout: 0 })` closes immediately. After closing, any new query is rejected with the error code `ERR_POSTGRES_CONNECTION_CLOSED`. Never close the shared pool inside a request handler, because it would break every later request. Closing belongs to scripts, tests and graceful shutdown (topic 21).\n\nWhen PostgreSQL rejects a query, Bun throws a `SQL.PostgresError`, a subclass of Error you can detect with `instanceof` (topic 05). It has four useful properties. `errno` holds the SQLSTATE, PostgreSQL's five-character error code, such as \"23505\" for a UNIQUE violation (topic 11). `code` holds Bun's own code, `ERR_POSTGRES_SERVER_ERROR` for errors that came from the server. `detail` and `hint` carry PostgreSQL's extra explanation when it gave one.\n\nThe pattern is: try the query, check `instanceof SQL.PostgresError`, handle what you know, and rethrow everything else with `throw err`. Put the close in `finally` so it runs on success and on failure.\n\nCreate `scripts/db-error.ts` and run it with `bun run scripts/db-error.ts`. The seed user asha@example.com already exists, so the insert breaks the UNIQUE rule.",
      "analogy": "Closing time at the taxi rank. `close()` lets taxis finish their current trips before locking the gate. `close({ timeout: 5 })` says \"you have five minutes, then the gate is locked regardless\". `timeout: 0` locks it right now. And you never lock the gate in the middle of the day because one passenger asked.",
      "code": [
        {
          "language": "typescript",
          "filename": "scripts/db-error.ts",
          "source": "import { SQL } from \"bun\";\nimport { sql } from \"../src/db\";\n\ntry {\n  await sql`\n    INSERT INTO users (email, name, password_hash)\n    VALUES ('asha@example.com', 'Asha', 'x')\n  `;\n} catch (err) {\n  if (err instanceof SQL.PostgresError) {\n    console.log(err.code, err.errno);\n  } else {\n    throw err;\n  }\n} finally {\n  await sql.close({ timeout: 5 });\n}",
          "output": "ERR_POSTGRES_SERVER_ERROR 23505",
          "explanation": "The duplicate email makes PostgreSQL report a UNIQUE violation. Bun throws a `SQL.PostgresError` whose `code` is Bun's server-error code and whose `errno` is the SQLSTATE 23505. Any other kind of error is rethrown. `finally` closes the pool, waiting at most 5 seconds."
        }
      ],
      "productionNote": "Scripts, tests and the shutdown sequence close the pool; request handlers never do. In topic 19 you will translate SQLSTATE values such as 23505 into friendly HTTP errors.",
      "commonMistakes": [
        "Not closing the pool in a script, so the script hangs instead of exiting.",
        "Closing the shared pool in a request handler, which makes every later query fail with `ERR_POSTGRES_CONNECTION_CLOSED`.",
        "Comparing error messages as text instead of checking `instanceof SQL.PostgresError` and `errno`."
      ],
      "sources": [
        { "title": "Bun docs: SQL", "url": "https://bun.com/docs/api/sql" },
        { "title": "PostgreSQL 19 docs: error codes", "url": "https://www.postgresql.org/docs/19/errcodes-appendix.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why is sql`... WHERE email = ${email}` safe against SQL injection, while sql.unsafe(\"... WHERE email = '\" + email + \"'\") is not?",
      "options": [
        "The tagged template sends the value as a separate parameter that PostgreSQL never parses as SQL, while unsafe pastes the input into the SQL text",
        "The tagged template removes every quote character from the value before running the query",
        "sql.unsafe is slower, which gives attackers more time to interrupt it",
        "The tagged template only works for numbers, so text cannot contain SQL"
      ],
      "answerIndex": 0,
      "explanation": "Parameters travel separately from the SQL text, so quotes and keywords in them are just data. String building merges input into the instructions."
    },
    {
      "question": "A table has an `id bigint` column. What JavaScript type does `id` have in a row returned by Bun.sql with default options?",
      "options": [
        "number",
        "string",
        "boolean",
        "Date"
      ],
      "answerIndex": 1,
      "explanation": "bigint arrives as a string (for example \"1\"), because a JavaScript number cannot hold every 64-bit integer exactly. The `bigint: true` option would give BigInt instead."
    },
    {
      "question": "What does `rows[0]` give when the query matched no rows?",
      "options": [
        "`undefined`, because the result is an empty array",
        "An object with all columns set to null",
        "It throws a SyntaxError",
        "The number 0"
      ],
      "answerIndex": 0,
      "explanation": "No match gives an empty array, and reading index 0 of an empty array gives `undefined`. That is why repositories check the row before mapping it."
    },
    {
      "question": "Why write `sql(body, \"email\", \"name\")` instead of `sql(body)` when inserting data from a request body?",
      "options": [
        "It makes the query run faster",
        "It converts camelCase keys to snake_case automatically",
        "Plain `sql(body)` is a syntax error",
        "It stores only the listed columns, so a client cannot set extra columns such as `role` (mass assignment)"
      ],
      "answerIndex": 3,
      "explanation": "`sql(body)` uses every key in the object. Listing the allowed columns ignores everything else the client sent."
    },
    {
      "question": "Which property of a `SQL.PostgresError` holds the SQLSTATE such as \"23505\"?",
      "options": [
        "code",
        "hint",
        "errno",
        "detail"
      ],
      "answerIndex": 2,
      "explanation": "`errno` holds the SQLSTATE. `code` holds Bun's own code (ERR_POSTGRES_SERVER_ERROR), and `detail` and `hint` are PostgreSQL's extra explanation text."
    }
  ]
});
