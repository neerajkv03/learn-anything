window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "14-migrations",
  "order": 14,
  "title": "Migrations with SQL Files",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "A migration is one versioned schema change stored in a file and applied exactly once per database. You will write numbered .sql files, a tracking table that remembers which files ran, a Bun script that applies the pending ones inside transactions, and an idempotent seed script (one that gives the same result when run twice) that fills a development database with sample rows.",
  "prerequisites": ["13-bun-sql"],
  "subtopics": [
    {
      "id": "why-migrations-exist",
      "title": "Why migrations exist",
      "explanation": "So far you created tables by typing SQL into psql. That works on one laptop, but a real project has many databases: one per developer, one for automated tests, one for production. If each is changed by hand, they drift apart, and code that works on your laptop fails in production because a column is missing.\n\nA migration is one schema change (a change to tables, columns or constraints) saved in its own file. Each file is applied once to each database, in order. Every environment reaches the same schema by replaying the same files, so the files become the single source of truth for what the database looks like.\n\nThe key rule: never edit a migration that has already been applied anywhere. A database that already ran it will not run it again, so your edit would reach only new databases and the schemas would diverge. To change something, add a new migration that makes the change. This course uses forward-only migrations: there are no \"undo\" files, and a mistake is fixed by a newer migration that corrects it (called fixing forward). Some migration tools support \"down\" files that undo a change, but we do not use them.\n\nPostgreSQL allows most schema changes (called DDL, data definition language, such as CREATE TABLE and ALTER TABLE) inside a transaction. A transaction is a group of statements that either all take effect or none do. That property is what makes the runner in this topic safe.",
      "analogy": "A building renovation logbook. Each numbered entry (\"added wall in room 3\") is done once and never rewritten. A new builder reads the log from the start and knows exactly what state the house is in. If a wall was built in the wrong place, you do not erase the old entry; you add a new entry that moves it.",
      "code": [
        {
          "language": "bash",
          "filename": "timeline.txt",
          "source": "Monday     dev database : apply 0001_create_users.sql\nWednesday  prod database: apply 0001_create_users.sql\nFriday     dev database : apply 0002_create_products.sql\nNext Mon   prod database: apply 0002_create_products.sql\n\nResult: both databases have users and products, identical.",
          "output": "",
          "explanation": "A plain-text timeline, not something you run. The two databases are updated at different times, but because they apply the same files in the same order they end up identical."
        },
        {
          "language": "bash",
          "filename": "check-tables.sh",
          "source": "psql \"$DATABASE_URL\" -c \"SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;\"",
          "output": "     tablename     \n-------------------\n order_items\n orders\n products\n schema_migrations\n users\n(5 rows)",
          "explanation": "After all migrations of this topic have run, this lists the tables in the public schema (the default namespace). Inside psql you can use the shortcut \\dt for a similar listing. In PowerShell, use `psql $env:DATABASE_URL -c \"...\"` instead; in bash keep the command as shown. schema_migrations is the tracking table you create in a later sub-topic."
        }
      ],
      "productionNote": "Deploys run migrations before the new application code starts, so the code never runs against a schema older than it expects. Migration files live in git, so schema changes get reviewed in a pull request (a proposed code change that teammates review before it is merged) like any other code.",
      "commonMistakes": [
        "Editing a migration file that has already been applied. Databases that ran it keep the old schema, so environments silently diverge. Add a new migration instead.",
        "Changing the schema by hand in a production psql session. The change exists in no file, so no other database will ever get it."
      ],
      "sources": [
        { "title": "PostgreSQL 19 docs: Modifying tables (ALTER TABLE)", "url": "https://www.postgresql.org/docs/19/ddl-alter.html" },
        { "title": "PostgreSQL 19 docs: CREATE TABLE", "url": "https://www.postgresql.org/docs/19/sql-createtable.html" }
      ]
    },
    {
      "id": "numbered-sql-files",
      "title": "Numbered .sql migration files",
      "explanation": "Migration files live in a folder named migrations/ at the project root (the layout from topic 6). Each is named NNNN_description.sql: a 4-digit zero-padded number, an underscore, then a short description. Each file holds one logical change, written as plain SQL.\n\nThe zero padding matters because the runner sorts file names as text. Text sorting compares character by character, so \"10_x.sql\" sorts before \"2_y.sql\" (the character 1 comes before 2). With padding, 0002 comes before 0010, and text order equals numeric order.\n\nThe files for this course are 0001_create_users.sql, 0002_create_products.sql and 0003_create_orders.sql (which creates both orders and order_items). Later topics add 0004_orders_metadata.sql, 0005_indexes.sql and 0006_create_sessions.sql. The products, orders and order_items files below follow the schema design you built in topic 11; if your column lists differ slightly, keep yours.\n\nDo not sprinkle IF NOT EXISTS (a clause that skips creation when the table already exists) through migrations. The runner already guarantees each file runs once, and if a table unexpectedly exists you want an error, not silence.",
      "analogy": "Numbered chapters of a book. Chapter 2 makes sense only after chapter 1, and padding the numbers (0010) keeps chapter 10 after chapter 9 on the shelf instead of right after chapter 1.",
      "code": [
        {
          "language": "sql",
          "filename": "migrations/0001_create_users.sql",
          "source": "CREATE TABLE users (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  email text NOT NULL UNIQUE,\n  name text NOT NULL,\n  password_hash text NOT NULL,\n  created_at timestamptz NOT NULL DEFAULT now()\n);",
          "output": "",
          "explanation": "The first migration: exactly the users table from topic 11. The file only contains the schema change; recording that it ran is the runner's job."
        },
        {
          "language": "sql",
          "filename": "migrations/0002_create_products.sql",
          "source": "CREATE TABLE products (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  name text NOT NULL,\n  price_cents integer NOT NULL CHECK (price_cents >= 0),\n  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),\n  created_at timestamptz NOT NULL DEFAULT now()\n);",
          "output": "",
          "explanation": "Products store money as integer cents (topic 1). The CHECK constraints stop negative prices and negative stock."
        },
        {
          "language": "sql",
          "filename": "migrations/0003_create_orders.sql",
          "source": "CREATE TABLE orders (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  user_id bigint NOT NULL REFERENCES users (id) ON DELETE RESTRICT,\n  status text NOT NULL DEFAULT 'pending'\n    CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),\n  total_cents integer NOT NULL CHECK (total_cents >= 0),\n  created_at timestamptz NOT NULL DEFAULT now()\n);\n\nCREATE TABLE order_items (\n  order_id bigint NOT NULL REFERENCES orders (id) ON DELETE CASCADE,\n  product_id bigint NOT NULL REFERENCES products (id) ON DELETE RESTRICT,\n  quantity integer NOT NULL CHECK (quantity > 0),\n  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),\n  PRIMARY KEY (order_id, product_id)\n);",
          "output": "",
          "explanation": "One file with two statements, because orders and order_items form one logical change. order_items is the junction table with a composite primary key and a price snapshot, as in topic 11. The runner you write later must therefore be able to run a file with several statements."
        },
        {
          "language": "typescript",
          "filename": "sort-demo.ts",
          "source": "const padded = [\"0010_x.sql\", \"0002_y.sql\", \"0001_z.sql\"];\nconst unpadded = [\"10_x.sql\", \"2_y.sql\"];\n\nconsole.log(padded.sort());\nconsole.log(unpadded.sort());",
          "output": "[ \"0001_z.sql\", \"0002_y.sql\", \"0010_x.sql\" ]\n[ \"10_x.sql\", \"2_y.sql\" ]",
          "explanation": "An array's .sort() with no argument compares items as text. Padded names come out in numeric order. The unpadded list puts 10 before 2, which is the wrong order for migrations."
        }
      ],
      "productionNote": "Because the files are plain text in git, the schema history is reviewable, searchable and blame-able: you can see who changed what and why. Keep each file to one logical change so a failure is easy to understand.",
      "commonMistakes": [
        "Using unpadded numbers such as 2_x.sql and 10_y.sql, which sort in the wrong order as text.",
        "Two developers creating the same number on different branches. Whoever merges second must rename their file to the next free number before merging."
      ],
      "sources": [
        { "title": "PostgreSQL 19 docs: CREATE TABLE", "url": "https://www.postgresql.org/docs/19/sql-createtable.html" }
      ]
    },
    {
      "id": "schema-migrations-table",
      "title": "A schema_migrations tracking table",
      "explanation": "The runner needs a way to remember which files a database has already applied. It keeps that memory inside the database itself, in a small table called schema_migrations with one row per applied file.\n\nversion is a text primary key holding the file name (for example 0001_create_users.sql). A primary key must be unique, so the same file can never be recorded twice. applied_at defaults to the current time and tells you when the file ran. The runner creates this table first, using CREATE TABLE IF NOT EXISTS, which does nothing if the table already exists. This is the one place IF NOT EXISTS is right, because the runner itself must be safe to run repeatedly.\n\nA file is pending when its name is not in the table. To see what a database has applied, select from the table.",
      "analogy": "A stamp card at a cafe. Each visit (migration) gets stamped once, and the staff check the card before stamping so nobody gets the same stamp twice.",
      "code": [
        {
          "language": "sql",
          "filename": "create-schema-migrations.sql",
          "source": "CREATE TABLE IF NOT EXISTS schema_migrations (\n  version text PRIMARY KEY,\n  applied_at timestamptz NOT NULL DEFAULT now()\n);",
          "output": "",
          "explanation": "The runner executes this on every start. The first time it creates the table; afterwards it does nothing."
        },
        {
          "language": "sql",
          "filename": "list-applied.sql",
          "source": "SELECT version FROM schema_migrations ORDER BY version;",
          "output": "         version\n--------------------------\n 0001_create_users.sql\n 0002_create_products.sql\n 0003_create_orders.sql\n(3 rows)",
          "explanation": "Run in psql after the runner has applied the first three files. One row per file, in order."
        }
      ],
      "productionNote": "Every migration tool uses this same idea, under names such as schema_migrations or a migrations table. Once you understand this one, the others are easy to read.",
      "commonMistakes": [
        "Deleting rows from schema_migrations by hand. The runner will then try to apply that file again and usually fail because the table already exists.",
        "Storing only a count of applied migrations instead of file names. Names let you detect gaps and mismatches; a number cannot."
      ],
      "sources": [
        { "title": "PostgreSQL 19 docs: CREATE TABLE", "url": "https://www.postgresql.org/docs/19/sql-createtable.html" }
      ]
    },
    {
      "id": "migration-runner",
      "title": "Writing the migration runner in Bun",
      "explanation": "The runner is a script, scripts/migrate.ts, that applies every pending file in order. It builds on src/db.ts (the sql client from topic 13), so make sure DATABASE_URL is set in your .env file (topic 7) and the database exists. Run commands from the project root, the folder containing package.json.\n\nThe steps are: create the tracking table; list the files in migrations/ (readdir from node:fs/promises returns the file names in a folder), keep the .sql ones and sort them; load the already-applied names; then for each pending file, read its text with Bun.file(path).text() and apply it.\n\nEach file is applied inside sql.begin(async (tx) => { ... }). sql.begin opens a transaction: everything done through tx either commits together when the callback finishes, or is rolled back (undone) if the callback throws. Inside it we run the file's SQL with tx.unsafe(text) and then insert the file name into schema_migrations. Because PostgreSQL supports transactional DDL, the schema change and its record succeed together or both vanish. A failed step leaves no half-built schema and no false record.\n\nsql.unsafe runs a string of SQL exactly as written. Without parameters the string may contain several statements, which our 0003 file needs. It is called unsafe because text built from user input would allow SQL injection (topic 13). Here the text comes from files in our own repository, never from users, so it is acceptable.\n\nA few supporting details: join from node:path glues path pieces together, and import.meta.dir is the folder of the current file, so the path works from any working directory. A Set is a collection of unique values with a fast .has() check.\n\nThe line SELECT pg_advisory_xact_lock(727274) takes an advisory lock, a database-wide named lock that is released automatically when the transaction ends, so two deploys do not migrate at the same time. The lock has a known limit: a second runner could already have listed the file as pending before it waited, and would then fail on the primary key insert and roll back. That is acceptable, because it fails safely.\n\nOn failure the script prints the error and sets process.exitCode = 1 (a non-zero exit code tells the deploy pipeline that something broke). The finally block always closes the database pool so the script can exit.",
      "analogy": "An assembly-line worker with a checklist. The worker checks which steps are already ticked, performs the next unticked one, and ticks it only if it fully succeeded. A failed step leaves no half-built part on the line.",
      "code": [
        {
          "language": "typescript",
          "filename": "scripts/migrate.ts",
          "source": "import { readdir } from \"node:fs/promises\";\nimport { join } from \"node:path\";\nimport { sql } from \"../src/db\";\n\nconst dir = join(import.meta.dir, \"..\", \"migrations\");\n\nasync function migrate(): Promise<void> {\n  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (\n    version text PRIMARY KEY,\n    applied_at timestamptz NOT NULL DEFAULT now()\n  )`;\n\n  const files = (await readdir(dir)).filter((f) => f.endsWith(\".sql\")).sort();\n  const appliedRows: { version: string }[] = await sql`SELECT version FROM schema_migrations`;\n  const applied = new Set(appliedRows.map((r) => r.version));\n\n  for (const file of files) {\n    if (applied.has(file)) continue;\n    const text = await Bun.file(join(dir, file)).text();\n    await sql.begin(async (tx) => {\n      await tx`SELECT pg_advisory_xact_lock(727274)`;\n      await tx.unsafe(text);\n      await tx`INSERT INTO schema_migrations (version) VALUES (${file})`;\n    });\n    console.log(`applied ${file}`);\n  }\n  console.log(\"migrations up to date\");\n}\n\ntry {\n  await migrate();\n} catch (err) {\n  console.error(\"migration failed\", err);\n  process.exitCode = 1;\n} finally {\n  await sql.close();\n}",
          "output": "",
          "explanation": "The complete runner. It prints nothing by itself until it is run; the next example runs it. The tracking insert uses the normal tagged template, so the file name is sent as a safe parameter."
        },
        {
          "language": "json",
          "filename": "package.json",
          "source": "{\n  \"scripts\": {\n    \"migrate\": \"bun run scripts/migrate.ts\",\n    \"seed\": \"bun run scripts/seed.ts\"\n  }\n}",
          "output": "",
          "explanation": "Add these two entries to the scripts section of your existing package.json (keep the scripts you already have, such as dev). They give you short commands, bun run migrate and bun run seed."
        },
        {
          "language": "bash",
          "filename": "run-migrate.sh",
          "source": "bun run migrate\nbun run migrate",
          "output": "$ bun run scripts/migrate.ts\napplied 0001_create_users.sql\napplied 0002_create_products.sql\napplied 0003_create_orders.sql\nmigrations up to date\n$ bun run scripts/migrate.ts\nmigrations up to date",
          "explanation": "Bun echoes the script command (the $ line) before each run's output. Before the first run, start from a fresh empty database, because you created these tables by hand in earlier topics and 0001 would fail with \"relation already exists\". For example run createdb shop_dev, point DATABASE_URL in .env at it, then run the commands below, and afterwards run bun run seed. On the empty database the first run applies all three files. The second run finds all three names in schema_migrations, skips them, and prints only the final line."
        }
      ],
      "productionNote": "Run bun run migrate in the deploy pipeline before the new code starts, and before the automated tests in topic 22. Production runners add more safeguards, but the core loop (check, apply in a transaction, record) is the same.",
      "commonMistakes": [
        "Running each file without a transaction. A failure halfway leaves a half-applied schema that is hard to repair.",
        "Recording the version before running the SQL. If the SQL then fails, the table claims the file ran and it will never be applied.",
        "Passing user input to sql.unsafe. It bypasses parameter protection and allows SQL injection. Only use it with trusted text such as your own migration files."
      ],
      "sources": [
        { "title": "Bun docs: SQL", "url": "https://bun.com/docs/api/sql" },
        { "title": "Bun docs: File I/O", "url": "https://bun.com/docs/api/file-io" },
        { "title": "PostgreSQL 19 docs: Advisory lock functions", "url": "https://www.postgresql.org/docs/19/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS" }
      ]
    },
    {
      "id": "seed-data",
      "title": "Seed data",
      "explanation": "Seed data is a set of sample rows that make a local development database useful: a few users and products so you can try your API straight away. Seeds are not migrations. A migration changes structure and runs everywhere; a seed adds example data and must never run in production.\n\nA seed script should be idempotent: running it twice gives the same result as running it once. For users, we use INSERT ... ON CONFLICT (email) DO NOTHING, which tells PostgreSQL to silently skip a row whose email already exists (topic 16 covers this fully). Bulk insert uses sql(array), which turns an array of objects into the column list and values (topic 13). Products have no unique column, so the script first counts rows (count(*)::int casts the count to a normal number) and inserts only when the table is empty.\n\nThe seed users need a password hash. Bun.password.hash turns a password into a safe one-way code that cannot be reversed; topic 20 explains it in depth. For now just know that we store the code, never the plain password.\n\nThe script also guards itself: if the config says the environment is production (the config object from topic 7), it throws before touching anything.",
      "analogy": "Show-home furniture. It is staged so visitors (developers) can see how the rooms work, but it is never moved into a buyer's real house (production).",
      "code": [
        {
          "language": "typescript",
          "filename": "scripts/seed.ts",
          "source": "import { sql } from \"../src/db\";\nimport { config } from \"../src/config\";\n\ntry {\n  if (config.env === \"production\") {\n    throw new Error(\"refusing to seed production\");\n  }\n\n  const hash = await Bun.password.hash(\"password123\");\n  await sql`INSERT INTO users ${sql([\n    { email: \"asha@example.com\", name: \"Asha\", password_hash: hash },\n    { email: \"ben@example.com\", name: \"Ben\", password_hash: hash },\n    { email: \"chen@example.com\", name: \"Chen\", password_hash: hash },\n  ])} ON CONFLICT (email) DO NOTHING`;\n\n  const countRows: { n: number }[] = await sql`SELECT count(*)::int AS n FROM products`;\n  if (countRows[0]?.n === 0) {\n    await sql`INSERT INTO products ${sql([\n      { name: \"Notebook\", price_cents: 2499, stock: 10 },\n      { name: \"Pen\", price_cents: 199, stock: 100 },\n      { name: \"Backpack\", price_cents: 4999, stock: 5 },\n    ])}`;\n  }\n\n  console.log(\"seed done\");\n} catch (err) {\n  console.error(\"seed failed\", err);\n  process.exitCode = 1;\n} finally {\n  await sql.close();\n}",
          "output": "seed done",
          "explanation": "Run it with bun run seed after bun run migrate. The second and later runs also print seed done, but add no rows: the users conflict on email and are skipped, and the products table is no longer empty. If config.env is production the script prints seed failed with the error and exits with code 1."
        }
      ],
      "productionNote": "Consistent seed data gives every developer the same starting point. Automated tests use their own fixtures (topic 22) instead of this script, so tests do not depend on what a developer happens to have in their database.",
      "commonMistakes": [
        "Running a seed against production. Keep the environment guard, and never point DATABASE_URL at production on your laptop.",
        "Writing a non-idempotent seed that inserts duplicate rows each time it is run."
      ],
      "sources": [
        { "title": "Bun docs: SQL", "url": "https://bun.com/docs/api/sql" },
        { "title": "PostgreSQL 19 docs: INSERT (ON CONFLICT clause)", "url": "https://www.postgresql.org/docs/19/sql-insert.html#SQL-ON-CONFLICT" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why must you never edit 0001_create_users.sql after it has run in production?",
      "options": [
        "Production already recorded it as applied and will not run it again, so the edit would reach only new databases and the schemas would differ",
        "PostgreSQL refuses to start if a migration file changes",
        "Editing a file deletes the schema_migrations table",
        "Migration files become read-only once they are committed to git"
      ],
      "answerIndex": 0,
      "explanation": "Each file runs once per database. An edited file is skipped where it already ran, so new databases and production diverge. Add a new numbered migration instead."
    },
    {
      "question": "Why are migration numbers zero-padded, as in 0002 rather than 2?",
      "options": [
        "PostgreSQL requires four-digit file names",
        "Names are sorted as text, and padding makes text order equal numeric order (10_x.sql would otherwise sort before 2_y.sql)",
        "It makes the files run faster",
        "Bun cannot read file names that start with a single digit"
      ],
      "answerIndex": 1,
      "explanation": "The runner sorts file names as text. Without padding, \"10_x.sql\" sorts before \"2_y.sql\", so migrations would run in the wrong order."
    },
    {
      "question": "What does bun run migrate print when run a second time, with all files already applied?",
      "options": [
        "applied 0001_create_users.sql and the other two file names again",
        "migration failed, because the tables already exist",
        "Only migrations up to date",
        "Nothing at all"
      ],
      "answerIndex": 2,
      "explanation": "All three names are already in schema_migrations, so the runner skips every file and prints only the final line."
    },
    {
      "question": "Why does the runner execute the file's SQL and the schema_migrations insert in one transaction?",
      "options": [
        "Transactions make the SQL run faster than separate statements",
        "Bun requires every query to be inside sql.begin",
        "It lets the file contain user input safely",
        "Both succeed together or both are rolled back, so a failed file is never recorded as applied and leaves no half-built schema"
      ],
      "answerIndex": 3,
      "explanation": "PostgreSQL supports transactional DDL. If the SQL fails, the record is not saved. If the record insert fails, the schema change is undone. The database never shows a file as applied when it was not, or half applied."
    },
    {
      "question": "How does the seed script avoid duplicate users when it is run again?",
      "options": [
        "It deletes the whole users table first",
        "It uses INSERT ... ON CONFLICT (email) DO NOTHING, so rows whose email already exists are skipped",
        "It records itself in schema_migrations",
        "It only runs when the environment is production"
      ],
      "answerIndex": 1,
      "explanation": "email is UNIQUE, so a repeated email is a conflict, and DO NOTHING skips that row. That makes the script idempotent. The script also refuses to run in production, the opposite of the last option."
    }
  ]
});
