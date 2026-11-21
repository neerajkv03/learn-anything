window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "09-relational-postgresql",
  "order": 9,
  "title": "Relational Databases & PostgreSQL",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Your API from topic 08 forgets everything when it restarts. In this topic you meet the relational database, a program that stores data safely on disk, and PostgreSQL 19.0, the one this course uses. You learn tables, rows, columns, the main column types, primary keys, the first SQL statements (CREATE TABLE, INSERT, SELECT) and the special value NULL.",
  "prerequisites": ["08-http-bun-serve"],
  "subtopics": [
    {
      "id": "what-a-relational-database-is",
      "title": "What a relational database is",
      "explanation": "In topic 08 your server kept data in variables. Variables live in the computer's memory, so when the server restarts, everything is gone. A database is a separate program whose job is to store data safely on disk, keep it after restarts, and answer questions about it. Many programs can talk to it at the same time.\n\nA relational database keeps its data in tables, and links the tables together by matching values. For example, an order row holds the id of the user who placed it, and that id matches a row in the users table. Those matching values are called keys. You will build these links in topic 11.\n\nSQL (Structured Query Language) is the language you use to talk to a relational database. It is declarative: you describe what data you want, not the steps to find it. The database decides how. SQL is only the language; it is not the database itself.\n\nPostgreSQL is a free, open-source relational database. It runs as a server, meaning a program that waits for connections from clients (programs that ask for something). Your app will be a client. It finds the server with a connection URL of the form `postgres://user:password@host:5432/dbname`: a user name, a password, the machine (host), the port (5432 is PostgreSQL's usual one), and the name of the database to use.\n\nOne PostgreSQL server can hold many databases, and each database is separate from the others. Inside a database, tables are grouped in schemas. A schema is a named folder-like namespace (a named group that keeps names from clashing). The default schema is called `public`, and all our tables will live there.\n\n`psql` is PostgreSQL's own terminal client. It comes with PostgreSQL, and you will use it in topics 09 to 12 to type SQL and see results. This course assumes a PostgreSQL 19.0 server is running on your machine with a database called `orders_dev` and a user `app` with the password `app_password`. If you have not set that up yet, do these steps once:\n\n1. Install PostgreSQL 19.0 from the official installer at postgresql.org. It includes psql, and it normally starts the server as a background service on port 5432. If the server is not running, start its PostgreSQL service from the Windows Services window (or your OS's equivalent).\n2. Open psql as the administrator user `postgres`, the account the installer created (on Windows, open the psql app from the Start menu, or type `psql -U postgres` in a terminal). Enter the password you chose during installation.\n3. At the prompt, run `CREATE USER app WITH PASSWORD 'app_password';` and then `CREATE DATABASE orders_dev OWNER app;`. Type `\\q` to leave.\n\nTo start: open a terminal (a window where you type commands), then run the command below. Once you see the `orders_dev=>` prompt, type SQL and end each statement with a semicolon. Type `\\q` to leave psql.",
      "analogy": "Think of a library with a card catalogue. The books (your data) sit on shelves, and the librarian (PostgreSQL) fetches what you ask for when you hand over a formal request slip (SQL). Many readers can be served at once, the books are still there tomorrow, and the catalogue cards link authors to books, which is the 'relation' in relational. The library building is the server, each separate collection inside it is a database, and a section of shelves is a schema.",
      "code": [
        {
          "language": "bash",
          "filename": "connect.sh",
          "source": "psql \"postgres://app:app_password@localhost:5432/orders_dev\"\n# now inside psql, type:\n# SELECT version();\n# \\q",
          "output": "psql (19.0)\nType \"help\" for help.\n\norders_dev=> SELECT version();\n                 version\n-----------------------------------------\n PostgreSQL 19.0 on ... (rest depends on your platform)\n(1 row)\n\norders_dev=> \\q",
          "explanation": "The first line connects psql to the server using the connection URL. `SELECT version();` asks the server for its version, and the answer is one row whose text starts with `PostgreSQL 19.0`. The rest of that text depends on your operating system, so it is shown as `...`. `\\q` is a psql command (not SQL) that quits."
        }
      ],
      "productionNote": "In production the database is the single source of truth for users, products and orders. The app server stays stateless (it keeps nothing important in memory), so you can restart or add copies of it without losing data. The connection URL, which contains a password, belongs in an environment variable such as `DATABASE_URL` (topic 07), never in source code.",
      "commonMistakes": [
        "Confusing the database server with a database inside it. The server is the running program; one server holds many databases, and you choose one in the connection URL.",
        "Thinking SQL is the database. SQL is only the language; PostgreSQL is the program that stores the data and runs your SQL.",
        "Typing SQL in psql and forgetting the closing `;`. psql then waits for more input and shows a continuation prompt instead of running the statement."
      ],
      "sources": [
        { "title": "PostgreSQL 19 Tutorial: Concepts", "url": "https://www.postgresql.org/docs/19/tutorial-concepts.html" },
        { "title": "PostgreSQL 19: psql", "url": "https://www.postgresql.org/docs/19/app-psql.html" }
      ]
    },
    {
      "id": "tables-rows-columns",
      "title": "Tables, rows & columns",
      "explanation": "A table stores one kind of thing, such as users or products. A column is one attribute of that thing, such as `email`, and every column has a fixed type (for example text or integer). A row is one item in the table, such as the user Asha. All rows in a table have exactly the same columns.\n\nThe schema is the full set of table definitions: which tables exist, and what columns and types each one has. (Earlier we used 'schema' for the namespace called `public`. In everyday talk it also means this overall shape of your data. Both meanings are common.)\n\nNaming convention for this course: table and column names are lowercase `snake_case` (words joined by underscores, like `price_cents`), and table names are plural (`users`, `products`). Avoid camelCase (words joined with no separator, each new word starting with a capital letter, such as `priceCents`). PostgreSQL folds unquoted names to lowercase, so a camelCase column would need double quotes every time you mention it.\n\nIn TypeScript, one row corresponds to one object, and each column corresponds to a property. A column `price_cents` becomes a property `priceCents`. In topic 13 you will convert between the two styles in one place. Below, `SELECT id, email, name FROM users;` asks for all three columns of every row; you will learn SELECT properly in a later sub-topic. The output shown below only appears after you finish the NULL sub-topic, which adds Ben and Chen; you will run it then.",
      "analogy": "A table is like a spreadsheet with strict rules. The sheet is the table, the header row names the columns, and each line below it is a row. The strict part: in a spreadsheet you can type text into a 'number' column, but in a database a column of type number refuses text.",
      "code": [
        {
          "language": "sql",
          "filename": "users-table.sql",
          "source": "SELECT id, email, name FROM users;",
          "output": " id |      email       | name\n----+------------------+------\n  1 | asha@example.com | Asha\n  2 | ben@example.com  | Ben\n  3 | chen@example.com | Chen\n(3 rows)",
          "explanation": "This is how psql prints the users table once it holds the three course users. The header line lists the three columns, each following line is one row, and `(3 rows)` is the footer. Row order is only guaranteed when you ask for it with ORDER BY (topic 10); on a small fresh table you normally see insertion order."
        },
        {
          "language": "typescript",
          "filename": "row.ts",
          "source": "// One database row, as a TypeScript object.\ntype ProductRow = { name: string; priceCents: number };\n\nconst row: ProductRow = { name: \"Pen\", priceCents: 199 };\nconsole.log(row.name, row.priceCents);",
          "output": "Pen 199",
          "explanation": "A row is just an object whose properties are the columns. The database column `price_cents` appears as the camelCase property `priceCents` on the TypeScript side."
        }
      ],
      "productionNote": "A typical backend has one table per entity (a kind of thing the app cares about): users, products, orders, order_items and sessions. This course builds exactly those, using the dataset of users Asha, Ben and Chen, and products Notebook, Pen and Backpack.",
      "commonMistakes": [
        "Putting everything in one giant table with repeated data (for example the user's name copied onto every order). Topic 11 shows how to split it into linked tables.",
        "Using camelCase column names like `createdAt`. PostgreSQL lowercases unquoted names, so you would have to write `\"createdAt\"` with double quotes everywhere. Use `created_at`."
      ],
      "sources": [
        { "title": "PostgreSQL 19 Tutorial: Creating a New Table", "url": "https://www.postgresql.org/docs/19/tutorial-table.html" },
        { "title": "PostgreSQL 19: Identifiers and Key Words", "url": "https://www.postgresql.org/docs/19/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS" }
      ]
    },
    {
      "id": "postgresql-data-types",
      "title": "PostgreSQL data types (text, integer, bigint, numeric, boolean, timestamptz, uuid)",
      "explanation": "Every column has a data type: a rule for what values it may hold. PostgreSQL has many types. These seven cover almost everything in this course.\n\n`text` holds a string of any length. Prefer it over `varchar(255)` (a string with a length limit), because the limit adds nothing useful. `boolean` holds true or false; psql prints these as `t` and `f`.\n\n`integer` is a whole number from about -2.1 billion to +2.1 billion. It fits prices in cents and quantities. `bigint` is a much larger whole number (up to about 9.2 quintillion), and the course uses it for ids so they never run out.\n\n`numeric(12,2)` is an exact decimal number: up to 12 digits, 2 of them after the decimal point. Use it when you cannot store whole cents. Avoid `real` and `double precision`, the floating-point types: they store approximations (the same effect as `0.1 + 0.2` in JavaScript, topic 02), which is a bug waiting to happen with money.\n\n`timestamptz` ('timestamp with time zone') holds a point in time. PostgreSQL stores it in UTC (the world reference time) and shows it in the time zone of your session (your connection). Always prefer it to plain `timestamp`, which has no time zone and invites confusion. `uuid` is a 128-bit identifier that looks like `3f2c...`; the built-in function `gen_random_uuid()` makes a random one.\n\nThe code below uses `::type` (a cast: it converts a value to a type) and `AS` (it names an output column). It also uses `now()`, the current time, and `IS NOT NULL`, which you will meet in the NULL sub-topic. Here it simply turns 'a value exists' into true or false, so the output is deterministic.\n\nA preview of topic 13: when your Bun code reads these columns through Bun.sql (Bun's built-in database client), `bigint` and `numeric` arrive as JavaScript strings, `timestamptz` arrives as a `Date`, `uuid` arrives as a string and `boolean` as a boolean. Plan for that.",
      "analogy": "Types are different storage boxes in a warehouse. A shoebox holds ordinary numbers (integer), a shipping container holds huge ones (bigint), a jeweller's scale gives exact weights with no rounding (numeric), an on/off tag marks yes or no (boolean), a stamped arrival time recorded in GMT is the same for everyone worldwide (timestamptz), and a unique barcode label identifies one item (uuid). Putting the wrong thing in a box is refused at the door.",
      "code": [
        {
          "language": "sql",
          "filename": "types.sql",
          "source": "SELECT 2499::integer AS price_cents,\n       0.1::numeric + 0.2::numeric AS exact_sum,\n       now()::timestamptz IS NOT NULL AS has_time,\n       gen_random_uuid() IS NOT NULL AS has_uuid;",
          "output": " price_cents | exact_sum | has_time | has_uuid\n-------------+-----------+----------+----------\n        2499 |       0.3 | t        | t\n(1 row)",
          "explanation": "`2499::integer` is a whole number. `0.1::numeric + 0.2::numeric` is exactly `0.3`, unlike floating point in JavaScript. The last two columns are `t` (true) because `now()` and `gen_random_uuid()` always return a value. The actual time and uuid change on every run, so we test for their existence instead of printing them."
        }
      ],
      "productionNote": "Correct types prevent bad data and rounding bugs. A rule of thumb for this course: ids are `bigint`, money is `integer` cents, times are `timestamptz`, free text is `text`.",
      "commonMistakes": [
        "Using `timestamp` (without time zone) instead of `timestamptz`. The value then has no clear meaning when servers or users are in different time zones.",
        "Storing money in `real` or `double precision`. Floating-point rounding gives amounts like 0.30000000000000004. Use integer cents or `numeric`.",
        "Copying the `varchar(255)` habit from other systems. `text` has no useful downside in PostgreSQL."
      ],
      "sources": [
        { "title": "PostgreSQL 19: Data Types", "url": "https://www.postgresql.org/docs/19/datatype.html" },
        { "title": "PostgreSQL 19: Date/Time Types", "url": "https://www.postgresql.org/docs/19/datatype-datetime.html" },
        { "title": "PostgreSQL Wiki: Don't Do This", "url": "https://wiki.postgresql.org/wiki/Don%27t_Do_This" }
      ]
    },
    {
      "id": "primary-keys-identity-columns",
      "title": "Primary keys & identity columns",
      "explanation": "A primary key is a column (or columns) that uniquely identifies each row. Its value is never NULL (missing) and never changes. Other tables point to a row by its primary key. Because it is a rule the database enforces, it is called a constraint: a restriction on what data is allowed. You will meet more constraints in topic 11.\n\nIn PostgreSQL the modern way to make a self-filling primary key is an identity column: `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`. The database hands out 1, 2, 3 and so on by itself. `ALWAYS` means it refuses any id you try to supply. (A special clause, `OVERRIDING SYSTEM VALUE`, can override this; it exists for rare cases like data imports, and we will not use it.) You may see the older `serial` type in old tutorials. It does the same job but is the legacy style, so do not use it in new code.\n\nThe example creates the course `users` table and inserts one row. `NOT NULL` is a constraint meaning the column must always have a value. `RETURNING id` makes INSERT send back the new row's id, which is how your app learns the id the database chose. Do not list `id` in the INSERT; the database fills it in. The second INSERT tries to supply an id on purpose and fails.\n\nA uuid primary key (`id uuid DEFAULT gen_random_uuid() PRIMARY KEY`; DEFAULT is the value the database fills in when you leave a column out, and topic 11 covers it) is another option, useful when ids are shown publicly and must not be guessable. This course uses bigint identity keys for simplicity.",
      "analogy": "An identity column is the ticket machine at a deli counter. The machine hands out the next number, nobody gets to pick their own, and no two customers ever hold the same ticket. The primary key is the number on your ticket: it identifies you, and it stays the same even if you change your name or order.",
      "code": [
        {
          "language": "sql",
          "filename": "users-identity.sql",
          "source": "CREATE TABLE users (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  email text NOT NULL,\n  name text NOT NULL\n);\n\nINSERT INTO users (email, name) VALUES ('asha@example.com', 'Asha') RETURNING id;\n\nINSERT INTO users (id, email, name) VALUES (5, 'x@example.com', 'X');",
          "output": "CREATE TABLE\n id\n----\n  1\n(1 row)\n\nINSERT 0 1\nERROR:  cannot insert a non-DEFAULT value into column \"id\"",
          "explanation": "`CREATE TABLE` succeeds. The first INSERT lets the database choose the id, and RETURNING shows it is 1. The second INSERT supplies `id` 5, which `GENERATED ALWAYS` rejects with this error. PostgreSQL prints extra DETAIL and HINT lines after it; only the first line is shown here."
        }
      ],
      "productionNote": "Every table gets a primary key, and foreign keys (columns in other tables that point to it, topic 11) refer to it. Letting the database generate ids avoids two requests picking the same id.",
      "commonMistakes": [
        "Using the email address as the primary key. Emails change, and a key must never change. Use a generated id and keep email as an ordinary column.",
        "Using `serial` in new code. It is the older style; prefer `GENERATED ALWAYS AS IDENTITY`.",
        "Supplying your own id to a `GENERATED ALWAYS` column. List only the other columns and let the database fill in `id`."
      ],
      "sources": [
        { "title": "PostgreSQL 19: Identity Columns", "url": "https://www.postgresql.org/docs/19/ddl-identity-columns.html" },
        { "title": "PostgreSQL 19: Primary Keys", "url": "https://www.postgresql.org/docs/19/ddl-constraints.html#DDL-CONSTRAINTS-PRIMARY-KEYS" }
      ]
    },
    {
      "id": "create-table-insert-select",
      "title": "CREATE TABLE, INSERT & SELECT",
      "explanation": "SQL statements fall into two broad groups. DDL (Data Definition Language) defines the structure: `CREATE TABLE` makes a table. DML (Data Manipulation Language) works with the data: `INSERT` adds rows and `SELECT` reads them. Every statement ends with `;`. By convention SQL keywords are written in upper case, though PostgreSQL does not require it.\n\n`CREATE TABLE name (column type, ...)` lists each column with its type and constraints. `INSERT INTO table (columns) VALUES (...), (...)` adds one or more rows; list several value groups separated by commas to insert many rows at once. When it works, psql replies `INSERT 0 3`, where the last number is how many rows were added (the `0` is a legacy field you can ignore).\n\nText values are written as string literals (fixed text in the statement) in single quotes: `'Pen'`. Double quotes mean something different: they mark an identifier, which is the name of a table or column. So `\"Pen\"` makes PostgreSQL look for a column called Pen.\n\n`SELECT col1, col2 FROM table;` returns chosen columns for every row. `SELECT *` means all columns. It is fine for exploring in psql, but in app code list the columns you need, so that adding a column later does not change what your code receives. You can compute new values from columns. `AS` gives the result column a name, and `round(x, 2)` rounds to 2 decimal places. In the example, `price_cents / 100.0` converts cents to dollars; dividing by `100.0` (not `100`) keeps the decimals.\n\n`DROP TABLE products;` deletes a table and all its rows. It is destructive and cannot be undone, so be careful where you run it.",
      "analogy": "Setting up a filing cabinet. CREATE TABLE is buying the cabinet and labelling the drawer and the card layout. INSERT is filing new cards into it. SELECT is asking the clerk for photocopies of certain fields from the cards. The cards themselves stay in the cabinet.",
      "code": [
        {
          "language": "sql",
          "filename": "products.sql",
          "source": "CREATE TABLE products (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  name text NOT NULL,\n  price_cents integer NOT NULL,\n  stock integer NOT NULL\n);\n\nINSERT INTO products (name, price_cents, stock) VALUES\n  ('Notebook', 2499, 10),\n  ('Pen', 199, 100),\n  ('Backpack', 4999, 5);\n\nSELECT name, round(price_cents / 100.0, 2) AS price FROM products;",
          "output": "CREATE TABLE\nINSERT 0 3\n   name   | price\n----------+-------\n Notebook | 24.99\n Pen      |  1.99\n Backpack | 49.99\n(3 rows)",
          "explanation": "The CREATE TABLE makes `products` with an identity id. The INSERT adds the three course products in one statement, and psql confirms with `INSERT 0 3`. The SELECT returns each name and its price in dollars, named `price` by `AS`. Row order is not guaranteed without ORDER BY (topic 10), but on a fresh table you normally see insertion order."
        }
      ],
      "productionNote": "In real projects the CREATE TABLE statements live in migration files (topic 14), and your repository code (topic 13) runs INSERT and SELECT. Always list columns explicitly in INSERT and in app queries.",
      "commonMistakes": [
        "Using double quotes for text: `VALUES (\"Pen\", ...)` fails with `ERROR:  column \"Pen\" does not exist`, because double quotes name columns. Use single quotes for text.",
        "Forgetting the `;` in psql. The statement is not sent, and you get a `->` continuation prompt instead of a result.",
        "Using `SELECT *` in application code. A later new column silently changes the shape of every result."
      ],
      "sources": [
        { "title": "PostgreSQL 19: CREATE TABLE", "url": "https://www.postgresql.org/docs/19/sql-createtable.html" },
        { "title": "PostgreSQL 19: INSERT", "url": "https://www.postgresql.org/docs/19/sql-insert.html" },
        { "title": "PostgreSQL 19 Tutorial: Querying a Table", "url": "https://www.postgresql.org/docs/19/tutorial-select.html" }
      ]
    },
    {
      "id": "what-null-means",
      "title": "What NULL means",
      "explanation": "NULL means 'no value': the data is unknown or missing. It is not 0 and it is not an empty string `''`. A column accepts NULL unless you declare it `NOT NULL`. In this course, make columns `NOT NULL` unless the value is truly optional (for example `shipped_at` on an order that has not shipped).\n\nSQL uses three-valued logic: a comparison can be true, false, or unknown (NULL). Comparing anything with NULL gives unknown, even `NULL = NULL`, because two unknown things are not known to be equal. A WHERE clause (a filter on rows) keeps only rows where the condition is true, so `WHERE phone = NULL` matches nothing, ever. Use `IS NULL` and `IS NOT NULL` instead.\n\n`coalesce(x, fallback)` returns the first value that is not NULL. It is a handy way to show a default such as `'n/a'`.\n\nThe example first adds the other two course users. Then `ALTER TABLE` (a DDL statement that changes an existing table) adds a new optional column `phone`. Existing rows get NULL in it. Later, when your Bun code reads a row through Bun.sql (topic 13), a NULL arrives as JavaScript `null`.",
      "analogy": "NULL is a blank answer on a survey. It is not 'zero' and not 'no'; it just means the answer is unknown. If you ask 'is this blank answer equal to that other blank answer?', the honest reply is 'unknown', not 'yes'.",
      "code": [
        {
          "language": "sql",
          "filename": "nulls.sql",
          "source": "INSERT INTO users (email, name) VALUES\n  ('ben@example.com', 'Ben'),\n  ('chen@example.com', 'Chen');\n\nALTER TABLE users ADD COLUMN phone text;\n\nSELECT name, phone IS NULL AS no_phone, coalesce(phone, 'n/a') AS phone_display\nFROM users\nWHERE phone IS NULL;\n\nSELECT count(*) FROM users WHERE phone = NULL;\n\nSELECT NULL = NULL AS same;",
          "output": "INSERT 0 2\nALTER TABLE\n name | no_phone | phone_display\n------+----------+---------------\n Asha | t        | n/a\n Ben  | t        | n/a\n Chen | t        | n/a\n(3 rows)\n\n count\n-------\n     0\n(1 row)\n\n same\n------\n\n(1 row)",
          "explanation": "All three users have no phone, so `IS NULL` matches all three rows, and coalesce shows `n/a`. The query with `phone = NULL` counts 0 rows, because the comparison is never true (`count(*)` simply counts the rows that reach it). `NULL = NULL` yields NULL, which psql prints as an empty cell."
        }
      ],
      "productionNote": "Optional fields such as `shipped_at` or `phone` are real NULLs, and `NOT NULL` on everything else is a cheap guard for data quality: bad rows are rejected at the door instead of crashing your code later.",
      "commonMistakes": [
        "Writing `= NULL` or `<> NULL`. These never match; use `IS NULL` and `IS NOT NULL`.",
        "Leaving columns nullable by accident. Without `NOT NULL`, missing data can slip in and surface as `null` bugs in your TypeScript.",
        "Treating NULL as an empty string or zero. They are different: `''` is a known empty text, NULL is unknown."
      ],
      "sources": [
        { "title": "PostgreSQL 19: Comparison Functions and Operators", "url": "https://www.postgresql.org/docs/19/functions-comparison.html" },
        { "title": "PostgreSQL 19: COALESCE", "url": "https://www.postgresql.org/docs/19/functions-conditional.html#FUNCTIONS-COALESCE-NVL-IFNULL" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Which column types fit an order total stored in cents and the time the order was created?",
      "options": [
        "boolean for the total and uuid for the time",
        "real for the total and text for the time",
        "integer for the total and timestamptz for the time",
        "uuid for the total and boolean for the time"
      ],
      "answerIndex": 2,
      "explanation": "Cents are whole numbers, so integer is exact and compact. A point in time belongs in timestamptz. Boolean and uuid cannot hold amounts or times, and real is a floating-point type that rounds money wrongly."
    },
    {
      "question": "Why does `SELECT * FROM users WHERE phone = NULL` return no rows even when some phones are missing?",
      "options": [
        "Comparing anything with NULL gives unknown, which WHERE treats as not matching; you must write IS NULL",
        "NULL is the same as 0, and no phone equals 0",
        "The phone column must be declared NOT NULL before it can be filtered",
        "SQL does not allow the word NULL inside a WHERE clause"
      ],
      "answerIndex": 0,
      "explanation": "`= NULL` yields NULL (unknown), never true, so no row is kept. `IS NULL` is the correct test. NULL is not 0, NULL is allowed in WHERE, and NOT NULL columns would have no NULLs at all."
    },
    {
      "question": "What happens if you run `INSERT INTO users (id, email, name) VALUES (5, 'x@example.com', 'X')` when `id` is `GENERATED ALWAYS AS IDENTITY`?",
      "options": [
        "The row is inserted with id 5",
        "The id 5 is silently ignored and the next number is used",
        "The whole users table is deleted",
        "PostgreSQL rejects it with an error: cannot insert a non-DEFAULT value into column \"id\""
      ],
      "answerIndex": 3,
      "explanation": "ALWAYS means the database alone assigns the id, so a manual value is refused with an error. It is not accepted and not silently ignored, and nothing is deleted."
    },
    {
      "question": "In SQL, what is the difference between `'Pen'` and `\"Pen\"`?",
      "options": [
        "There is no difference; both are text",
        "`'Pen'` is a text value (string literal) and `\"Pen\"` is an identifier, a name of a table or column",
        "`'Pen'` is a column name and `\"Pen\"` is a text value",
        "`'Pen'` is upper case and `\"Pen\"` is lower case"
      ],
      "answerIndex": 1,
      "explanation": "Single quotes make a text value; double quotes name an object such as a column. Using `\"Pen\"` as a value makes PostgreSQL report that the column Pen does not exist."
    },
    {
      "question": "What does one row of the `users` table correspond to in TypeScript?",
      "options": [
        "A single string that holds all the column names",
        "One object, with each column as a property",
        "A whole array of every user in the table",
        "A function that returns the user's email"
      ],
      "answerIndex": 1,
      "explanation": "A row is one item with several named values, which is exactly what an object is. The columns become its properties, for example `price_cents` becomes `priceCents`. A whole table, not a row, would be an array of such objects."
    }
  ]
});
