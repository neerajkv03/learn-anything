window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "24-database-sql",
  "order": 24,
  "title": "Databases with database/sql",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Learn how Go programs talk to a PostgreSQL database through the standard database/sql package and the pgx driver (the plug-in that speaks PostgreSQL's language). You will open a shared connection pool, run queries and changes with safe placeholders, group changes into all-or-nothing transactions, and tune timeouts and pool size.",
  "prerequisites": [
    "23-logging-config"
  ],
  "subtopics": [
    {
      "id": "database-sql-and-drivers",
      "title": "database/sql and drivers (PostgreSQL via pgx)",
      "explanation": "A database is a program that stores data and answers questions about it. SQL (Structured Query Language) is the language you use to ask a database for data or to change it. In a relational database such as PostgreSQL, data lives in tables: spreadsheet-like grids where each row is one record and each column is one named piece of information.\n\nGo's standard library has a package called database/sql. It does not know any particular database. It only defines one common set of functions (open a connection, run a query, read the rows) that look the same for every database. The database-specific part is a driver: a plug-in package that translates those common calls into the real protocol of one database. For PostgreSQL we use the pgx driver.\n\nSetup used by every example in this topic. Follow these steps once:\n\n1. Install PostgreSQL 18.7 (see sources); during install you set a password for the postgres superuser.\n2. Open a terminal and run `psql -U postgres -h localhost`, then type that password. psql is PostgreSQL's command-line client.\n3. At the postgres=# prompt type `CREATE USER app WITH PASSWORD 'secret';` then `CREATE DATABASE shop OWNER app;` then `\\q` to quit.\n4. Save the SQL below as setup.sql in your project folder and run `psql -U app -h localhost -d shop -f setup.sql` (enter secret when asked).\n\nThe SQL creates two tables: users (an auto-numbered id plus a name) and accounts (an id plus a balance in whole units), and puts two rows in accounts.\n\nNext, create an empty folder, open a terminal in it, and run `go mod init shop` (topic 1) to create a module. Install the driver with `go get github.com/jackc/pgx/v5@v5.11.0` (topic 12). This adds a `require` line to go.mod, shown in the second example. Each later example is a file named main.go in this folder: replace its contents and run it with `go run .`.\n\nThe address of the database is written as a DSN (data source name), one string holding user, password, host, port, database name and options: `postgres://app:secret@localhost:5432/shop?sslmode=disable`. The `sslmode=disable` option turns off encrypted connections, which is fine for a database on your own machine only. Following topic 23, programs read the DSN from the environment variable DATABASE_URL, so the password never sits in the source code. In bash set it with `export DATABASE_URL='postgres://app:secret@localhost:5432/shop?sslmode=disable'`; in PowerShell use `$env:DATABASE_URL = 'postgres://app:secret@localhost:5432/shop?sslmode=disable'`.\n\nThe driver must announce itself to database/sql. pgx does this inside its own package when the package is imported, registering the name \"pgx\". Your code never calls anything from that package directly, so Go would reject a normal import as unused. The blank identifier fixes that: `import _ \"github.com/jackc/pgx/v5/stdlib\"` (a blank import) means \"import this package only for its side effect\", where a side effect is something a piece of code does besides returning a value, here registering the driver.",
      "analogy": "database/sql is a universal TV remote with the same buttons for every TV. The driver is the code you enter for your TV brand: without it, the buttons do nothing. Swap the brand code and the same remote controls a different TV.",
      "code": [
        {
          "language": "sql",
          "filename": "setup.sql",
          "source": "CREATE TABLE users (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL);\nCREATE TABLE accounts (id BIGINT PRIMARY KEY, balance BIGINT NOT NULL);\nINSERT INTO accounts (id, balance) VALUES (1, 500), (2, 100);",
          "output": "",
          "explanation": "Run once in psql while connected to the shop database. PRIMARY KEY means each id value is unique and identifies one row. BIGSERIAL makes PostgreSQL number new users automatically (1, 2, 3, ...). NOT NULL means the column must always have a value."
        },
        {
          "language": "text",
          "filename": "go.mod",
          "source": "module shop\n\ngo 1.27\n\nrequire github.com/jackc/pgx/v5 v5.11.0",
          "output": "",
          "explanation": "The require line records the exact driver version that go get added. Go may also add `// indirect` lines for packages that pgx itself needs; leave them alone, and `go mod tidy` keeps them correct."
        },
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"database/sql\"\n\t\"fmt\"\n\n\t_ \"github.com/jackc/pgx/v5/stdlib\"\n)\n\nfunc main() {\n\t// sql.Open fails if the driver name is not registered.\n\t// It does not contact the database yet.\n\t_, err := sql.Open(\"pgx\", \"postgres://app:secret@localhost:5432/shop?sslmode=disable\")\n\tif err != nil {\n\t\tfmt.Println(\"error:\", err)\n\t\treturn\n\t}\n\tfmt.Println(\"driver pgx is registered\")\n}",
          "output": "driver pgx is registered",
          "explanation": "The blank import registers the driver under the name \"pgx\". sql.Open then accepts that name. Delete the blank import line and the program prints an error saying the driver \"pgx\" is unknown, with a hint about a forgotten import. This first example hard-codes the DSN only to keep it short; from the next subtopic on, the code reads DATABASE_URL."
        }
      ],
      "productionNote": "Because your code talks to database/sql, not to pgx directly, moving to another database (MySQL, SQLite) means swapping the driver import and driver name, and rewriting the SQL where that database's dialect (its own flavour of SQL) differs. Pick one style per codebase: this course uses database/sql; pgx also has its own native API, and mixing the two in one beginner project makes it unclear which connection or pool each function uses.",
      "commonMistakes": [
        "Forgetting the blank import. sql.Open then returns the error `sql: unknown driver \"pgx\" (forgotten import?)`, because no driver registered that name.",
        "Writing a normal import of the pgx stdlib package without the underscore. Go refuses to compile with an \"imported and not used\" error, since you never call anything from it.",
        "Mixing pgx's own native API and database/sql in the same small project, so it is unclear which pool or connection a function is using.",
        "Putting the password directly in the source code instead of reading DATABASE_URL from the environment."
      ],
      "sources": [
        {
          "title": "Accessing relational databases (Go docs)",
          "url": "https://go.dev/doc/database/"
        },
        {
          "title": "pgx stdlib package",
          "url": "https://pkg.go.dev/github.com/jackc/pgx/v5/stdlib"
        },
        {
          "title": "PostgreSQL downloads",
          "url": "https://www.postgresql.org/download/"
        }
      ]
    },
    {
      "id": "opening-a-pool-and-ping",
      "title": "Opening a pool and Ping",
      "explanation": "`sql.Open(\"pgx\", dsn)` returns a `*sql.DB` and an error. Despite the name, it does not connect to the database. It only checks that the driver name is registered and that its arguments are well-formed. So a wrong password, a wrong host or a stopped database all still give a nil error from Open.\n\nTo really test the connection, call `db.PingContext(ctx)`. It takes a context (topic 17) and opens a connection if needed, then checks the database answers. Give it a context with a timeout, for example 5 seconds, so an unreachable server cannot make your program wait forever. If the password is wrong, Ping returns an error produced by pgx and PostgreSQL whose text contains `password authentication failed`.\n\nDespite its name, `*sql.DB` is not one connection. It is a pool: a set of connections that database/sql opens, hands out for each query and takes back afterwards, so connections are reused instead of being opened again every time. It is safe to use from many goroutines at once (topic 15). So you create it once at program start, share it with all your code, and call `defer db.Close()` in main to close every connection when the program ends.",
      "analogy": "Open is like saving a phone number in your contacts: you have the number, but nobody has answered yet and it may be wrong. Ping is actually dialing and listening for a voice. The pool is the company switchboard with several phone lines that callers share.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"database/sql\"\n\t\"fmt\"\n\t\"os\"\n\t\"time\"\n\n\t_ \"github.com/jackc/pgx/v5/stdlib\"\n)\n\nfunc main() {\n\tdb, err := sql.Open(\"pgx\", os.Getenv(\"DATABASE_URL\"))\n\tif err != nil {\n\t\tfmt.Println(\"open failed:\", err)\n\t\treturn\n\t}\n\tdefer db.Close()\n\n\tctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)\n\tdefer cancel()\n\n\tif err := db.PingContext(ctx); err != nil {\n\t\tfmt.Println(\"ping failed:\", err)\n\t\treturn\n\t}\n\tfmt.Println(\"connected\")\n}",
          "output": "connected",
          "explanation": "With DATABASE_URL set correctly and PostgreSQL running, the program prints connected. With a wrong password in the DSN, Open still succeeds but Ping fails and prints `ping failed:` followed by pgx's error text, which contains `password authentication failed`. The function returns (instead of calling os.Exit) so the deferred db.Close and cancel still run."
        }
      ],
      "productionNote": "Open the pool once at startup and Ping it straight away. If the database is unreachable or the credentials are wrong, fail fast: log the error and exit, so the problem shows in the first seconds of a deploy, not on the first user request. Pass the same *sql.DB to every part of the program that needs it.",
      "commonMistakes": [
        "Calling sql.Open inside every request handler. Each call creates a whole new pool, so connections pile up. Open once and share.",
        "Assuming sql.Open returns an error for a bad password or an unreachable server. It does not connect; only Ping or the first query does.",
        "Pinging with context.Background() and no timeout, so an unreachable host can hang the start-up.",
        "Forgetting `defer db.Close()` in main."
      ],
      "sources": [
        {
          "title": "Opening a database handle",
          "url": "https://go.dev/doc/database/open-handle"
        },
        {
          "title": "DB.PingContext",
          "url": "https://pkg.go.dev/database/sql#DB.PingContext"
        }
      ]
    },
    {
      "id": "query-queryrow-exec",
      "title": "Query, QueryRow and Exec with placeholders",
      "explanation": "Three methods cover most database work, and each has a Context version that takes a context first. `QueryRowContext` runs a query expected to return one row. `QueryContext` runs a query that returns many rows. `ExecContext` runs a statement that changes data (INSERT adds rows, UPDATE changes rows, DELETE removes rows) and returns no rows.\n\nValues never go inside the SQL text. You write a placeholder, a numbered marker standing for a value, and pass the values as extra arguments after the SQL. PostgreSQL placeholders are `$1`, `$2`, and so on. (MySQL uses `?` instead, and `?` does not work on PostgreSQL.) The driver sends the SQL and the values separately, so the database always treats the values as plain data.\n\nThat is the defence against SQL injection: an attack where someone types text such as `x'; DROP TABLE users; --` into a form, and a program that glued that text into its SQL string with fmt.Sprintf lets it run as commands. Never build SQL by joining strings with user input. Placeholders only stand in for values, not for table or column names.\n\nFor one row, call `QueryRowContext(...)` and then `.Scan(&name)`. Scan copies the columns of the row into the variables whose addresses (topic 9) you pass, in column order. If the query found no row, Scan returns the sentinel error (topic 11) `sql.ErrNoRows`, which you test with `errors.Is`. A statement ending in `RETURNING id` makes an INSERT hand back the new row's generated id, so it can be read with QueryRow too.\n\nFor many rows, `QueryContext` returns a `*sql.Rows`. The pattern has four parts: `defer rows.Close()` so the connection goes back to the pool; a loop `for rows.Next()` that moves to each row; `rows.Scan(...)` inside the loop; and `rows.Err()` after the loop, which reports any error that stopped the loop early.\n\nFor changes, `ExecContext` returns a result. Its `RowsAffected()` method tells you how many rows the statement changed.",
      "analogy": "A fill-in-the-blanks order form. The printed form is the SQL, with numbered blanks ($1, $2). The customer can only write values into the blanks. They cannot cross out the printed text and rewrite the order, which is exactly why injection fails.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"database/sql\"\n\t\"errors\"\n\t\"fmt\"\n\t\"os\"\n\t\"time\"\n\n\t_ \"github.com/jackc/pgx/v5/stdlib\"\n)\n\nfunc run(ctx context.Context, db *sql.DB) error {\n\t// INSERT ... RETURNING gives back the generated id.\n\tvar id int64\n\terr := db.QueryRowContext(ctx,\n\t\t\"INSERT INTO users (name) VALUES ($1) RETURNING id\", \"Ada\").Scan(&id)\n\tif err != nil {\n\t\treturn err\n\t}\n\tfmt.Println(\"inserted id\", id)\n\n\t// One row.\n\tvar name string\n\terr = db.QueryRowContext(ctx,\n\t\t\"SELECT name FROM users WHERE id = $1\", 1).Scan(&name)\n\tif err != nil {\n\t\treturn err\n\t}\n\tfmt.Println(\"name:\", name)\n\n\t// No matching row.\n\terr = db.QueryRowContext(ctx,\n\t\t\"SELECT name FROM users WHERE id = $1\", 99).Scan(&name)\n\tfmt.Println(\"not found:\", errors.Is(err, sql.ErrNoRows))\n\n\t// Change a row.\n\tres, err := db.ExecContext(ctx,\n\t\t\"UPDATE users SET name = $1 WHERE id = $2\", \"Ada L.\", 1)\n\tif err != nil {\n\t\treturn err\n\t}\n\tn, err := res.RowsAffected()\n\tif err != nil {\n\t\treturn err\n\t}\n\tfmt.Println(\"rows affected:\", n)\n\n\t// Add a second user, then read all users.\n\tif _, err := db.ExecContext(ctx,\n\t\t\"INSERT INTO users (name) VALUES ($1)\", \"Grace\"); err != nil {\n\t\treturn err\n\t}\n\trows, err := db.QueryContext(ctx, \"SELECT id, name FROM users ORDER BY id\")\n\tif err != nil {\n\t\treturn err\n\t}\n\tdefer rows.Close()\n\tfor rows.Next() {\n\t\tvar id int64\n\t\tvar name string\n\t\tif err := rows.Scan(&id, &name); err != nil {\n\t\t\treturn err\n\t\t}\n\t\tfmt.Println(id, name)\n\t}\n\treturn rows.Err()\n}\n\nfunc main() {\n\tdb, err := sql.Open(\"pgx\", os.Getenv(\"DATABASE_URL\"))\n\tif err != nil {\n\t\tfmt.Println(\"open failed:\", err)\n\t\treturn\n\t}\n\tdefer db.Close()\n\n\tctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)\n\tdefer cancel()\n\n\tif err := run(ctx, db); err != nil {\n\t\tfmt.Println(\"error:\", err)\n\t}\n}",
          "output": "inserted id 1\nname: Ada\nnot found: true\nrows affected: 1\n1 Ada L.\n2 Grace",
          "explanation": "Run it once against an empty users table; to reset between runs, execute `TRUNCATE users RESTART IDENTITY;` in psql. Ada gets id 1. The lookup for id 99 finds nothing, so Scan returns sql.ErrNoRows and errors.Is reports true. The UPDATE changes one row. The loop prints both users, and rows.Err() is returned at the end so a mid-loop failure is not lost."
        }
      ],
      "productionNote": "Group queries for one entity (users, orders) in small repository functions (small functions that hold all the queries for one kind of data) such as GetUser(ctx, db, id) or CreateUser(ctx, db, name), each taking a context and returning plain Go values and errors. Translate sql.ErrNoRows into your own \"not found\" error at that boundary, so HTTP handlers (topic 21) can answer 404.",
      "commonMistakes": [
        "Forgetting `defer rows.Close()`. Until the rows are closed, their connection is not returned to the pool, and after enough leaks every query waits forever.",
        "Skipping `rows.Err()` after the loop, so a network failure halfway through looks like a normal, shorter result.",
        "Using `?` placeholders (MySQL style) on PostgreSQL. Use $1, $2.",
        "Building SQL with fmt.Sprintf or string joining from user input, which opens the door to SQL injection.",
        "Treating sql.ErrNoRows as a crash. For QueryRow it just means no row matched, and the caller should decide what that means."
      ],
      "sources": [
        {
          "title": "Querying for data",
          "url": "https://go.dev/doc/database/querying"
        },
        {
          "title": "Executing SQL statements that don't return data",
          "url": "https://go.dev/doc/database/change-data"
        },
        {
          "title": "Avoiding SQL injection risk",
          "url": "https://go.dev/doc/database/sql-injection"
        }
      ]
    },
    {
      "id": "transactions",
      "title": "Transactions",
      "explanation": "Sometimes several changes only make sense together. Moving 100 from one account to another needs two UPDATEs: subtract from one account, add to the other. If the program crashes between them, money vanishes. A transaction groups statements so they are all-or-nothing: either every change is saved, or none is.\n\nYou start one with `tx, err := db.BeginTx(ctx, nil)`. The second argument holds optional settings; nil means the defaults. The result `tx` is a `*sql.Tx`, which holds one connection from the pool for the whole transaction. You run each statement on tx (`tx.ExecContext`, `tx.QueryRowContext`), not on db. Other connections cannot see your uncommitted changes.\n\nTo save everything, call `tx.Commit()`. To throw everything away, call `tx.Rollback()`. The standard trick is `defer tx.Rollback()` right after BeginTx succeeds. If the function returns early because a statement failed, the deferred Rollback undoes the work. After a successful Commit the deferred Rollback does nothing harmful (it just returns the error `sql.ErrTxDone`, which we ignore), so one line covers every exit path.",
      "analogy": "A bank transfer. The money must leave one account and arrive in the other, or neither must happen. Commit is the bank confirming the whole transfer. Rollback is the bank cancelling it and putting everything back as it was.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"database/sql\"\n\t\"errors\"\n\t\"fmt\"\n\t\"os\"\n\t\"time\"\n\n\t_ \"github.com/jackc/pgx/v5/stdlib\"\n)\n\n// transfer moves amount from one account to another in one transaction.\n// If crashAfterDebit is true it fails on purpose between the two UPDATEs.\nfunc transfer(ctx context.Context, db *sql.DB, from, to, amount int64, crashAfterDebit bool) error {\n\ttx, err := db.BeginTx(ctx, nil)\n\tif err != nil {\n\t\treturn err\n\t}\n\tdefer tx.Rollback() // does nothing harmful after Commit\n\n\t_, err = tx.ExecContext(ctx,\n\t\t\"UPDATE accounts SET balance = balance - $1 WHERE id = $2\", amount, from)\n\tif err != nil {\n\t\treturn err\n\t}\n\tif crashAfterDebit {\n\t\treturn errors.New(\"simulated crash after debit\")\n\t}\n\t_, err = tx.ExecContext(ctx,\n\t\t\"UPDATE accounts SET balance = balance + $1 WHERE id = $2\", amount, to)\n\tif err != nil {\n\t\treturn err\n\t}\n\treturn tx.Commit()\n}\n\nfunc balances(ctx context.Context, db *sql.DB) (int64, int64, error) {\n\tvar a, b int64\n\terr := db.QueryRowContext(ctx, \"SELECT balance FROM accounts WHERE id = 1\").Scan(&a)\n\tif err != nil {\n\t\treturn 0, 0, err\n\t}\n\terr = db.QueryRowContext(ctx, \"SELECT balance FROM accounts WHERE id = 2\").Scan(&b)\n\treturn a, b, err\n}\n\nfunc main() {\n\tdb, err := sql.Open(\"pgx\", os.Getenv(\"DATABASE_URL\"))\n\tif err != nil {\n\t\tfmt.Println(\"open failed:\", err)\n\t\treturn\n\t}\n\tdefer db.Close()\n\n\tctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)\n\tdefer cancel()\n\n\t// Failing transfer: the rollback keeps both balances unchanged.\n\tfmt.Println(\"first:\", transfer(ctx, db, 1, 2, 100, true))\n\ta, b, _ := balances(ctx, db)\n\tfmt.Println(\"balances:\", a, b)\n\n\t// Successful transfer.\n\tfmt.Println(\"second:\", transfer(ctx, db, 1, 2, 100, false))\n\ta, b, _ = balances(ctx, db)\n\tfmt.Println(\"balances:\", a, b)\n}",
          "output": "first: simulated crash after debit\nbalances: 500 100\nsecond: <nil>\nbalances: 400 200",
          "explanation": "Start with accounts 1 and 2 holding 500 and 100. In the first call the debit UPDATE runs, then the function returns an error, so the deferred Rollback undoes the debit: balances stay 500 100. The second call runs both UPDATEs and Commit, so account 1 drops to 400 and account 2 rises to 200. Reset the table with `UPDATE accounts SET balance = CASE id WHEN 1 THEN 500 ELSE 100 END;` before running again."
        }
      ],
      "productionNote": "Use a transaction whenever several writes must stay consistent: an order row plus its stock decrease, a transfer, writes spread over several tables. Keep transactions short, because each holds a pooled connection and may block other writers on the same rows. Pass the same ctx to BeginTx and to every statement inside.",
      "commonMistakes": [
        "Calling db.ExecContext inside a transaction. That runs on a different connection, outside the transaction, so Rollback cannot undo it. Use tx.ExecContext.",
        "Not rolling back on error paths, leaving the connection stuck inside an open transaction. `defer tx.Rollback()` right after BeginTx fixes every path.",
        "Ignoring the error from tx.Commit(). Commit itself can fail, and then nothing was saved.",
        "Doing slow work such as an HTTP call in the middle of a transaction, keeping rows locked meanwhile."
      ],
      "sources": [
        {
          "title": "Executing transactions",
          "url": "https://go.dev/doc/database/execute-transactions"
        },
        {
          "title": "DB.BeginTx",
          "url": "https://pkg.go.dev/database/sql#DB.BeginTx"
        }
      ]
    },
    {
      "id": "context-and-pool-settings",
      "title": "Context and connection pool settings",
      "explanation": "Always use the `...Context` methods (PingContext, QueryContext, ExecContext, BeginTx) and pass a context with a deadline. In a web server, pass `r.Context()` (topic 21) so the query is cancelled when the client disconnects, and wrap it in `context.WithTimeout` to cap the time. When the context ends, the driver stops waiting for the database and the call returns an error that satisfies `errors.Is(err, context.DeadlineExceeded)` (topic 17).\n\nThe pool needs limits too. Four setters control it:\n\n`db.SetMaxOpenConns(25)` caps how many connections may be open at once, busy plus idle. The default is 0, meaning unlimited. When all 25 are busy, further queries wait for a free one.\n\n`db.SetMaxIdleConns(25)` sets how many unused connections are kept open for reuse.\n\n`db.SetConnMaxLifetime(5*time.Minute)` closes any connection older than 5 minutes, so connections are renewed regularly (useful when a load balancer (a machine that spreads traffic across servers) or the database drops old ones).\n\n`db.SetConnMaxIdleTime(1*time.Minute)` closes connections that sat unused for a minute.\n\n`db.Stats()` returns a snapshot of pool numbers: open connections, in use, idle, how many callers had to wait, and `MaxOpenConnections`, the limit you set. Export these as metrics (numbers recorded over time) in a real service.\n\nPostgreSQL itself accepts only a limited number of connections, set by its `max_connections` setting (100 by default). The sum of the MaxOpenConns of every copy of your service must stay below it.",
      "analogy": "A taxi fleet. You want enough cars for the busy hour, but not so many that the depot (the database) overflows. Cars that sit idle too long are sent home, and every car is retired after a fixed time so none gets too worn. A passenger's timeout is the moment they give up waiting for a taxi.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"database/sql\"\n\t\"errors\"\n\t\"fmt\"\n\t\"os\"\n\t\"time\"\n\n\t_ \"github.com/jackc/pgx/v5/stdlib\"\n)\n\nfunc main() {\n\tdb, err := sql.Open(\"pgx\", os.Getenv(\"DATABASE_URL\"))\n\tif err != nil {\n\t\tfmt.Println(\"open failed:\", err)\n\t\treturn\n\t}\n\tdefer db.Close()\n\n\tdb.SetMaxOpenConns(25)\n\tdb.SetMaxIdleConns(25)\n\tdb.SetConnMaxLifetime(5 * time.Minute)\n\tdb.SetConnMaxIdleTime(1 * time.Minute)\n\n\tfmt.Println(\"max open:\", db.Stats().MaxOpenConnections)\n\n\t// pg_sleep(5) makes PostgreSQL wait 5 seconds; our context allows only 2.\n\tctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)\n\tdefer cancel()\n\n\t_, err = db.ExecContext(ctx, \"SELECT pg_sleep(5)\")\n\tfmt.Println(\"timed out:\", errors.Is(err, context.DeadlineExceeded))\n}",
          "output": "max open: 25\ntimed out: true",
          "explanation": "The four setters configure the pool, and Stats().MaxOpenConnections reads the limit back. The slow query is cancelled after 2 seconds instead of 5, and the returned error wraps context.DeadlineExceeded, so errors.Is is true."
        }
      ],
      "productionNote": "Tune the numbers per service: the busiest expected number of simultaneous queries, divided by how many copies of the service run, all kept under PostgreSQL's max_connections. Read db.Stats() regularly (for example log it with slog, topic 23, or export it as metrics) to see whether callers are waiting for connections.",
      "commonMistakes": [
        "Leaving MaxOpenConns at its default of 0 (unlimited). A traffic spike then opens connections until PostgreSQL refuses new ones for everybody.",
        "Running queries with context.Background() and no timeout, so one slow query can hold a connection, and a request, forever.",
        "Setting MaxIdleConns higher than MaxOpenConns. The idle limit is then capped at the open limit anyway, so the extra number does nothing.",
        "Setting MaxOpenConns on each service copy without adding them up against PostgreSQL's max_connections."
      ],
      "sources": [
        {
          "title": "Managing connections",
          "url": "https://go.dev/doc/database/manage-connections"
        },
        {
          "title": "Canceling in-progress database operations",
          "url": "https://go.dev/doc/database/cancel-operations"
        },
        {
          "title": "DB.SetMaxOpenConns",
          "url": "https://pkg.go.dev/database/sql#DB.SetMaxOpenConns"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why does the program include the blank import `_ \"github.com/jackc/pgx/v5/stdlib\"`?",
      "options": [
        "It makes the program connect to PostgreSQL automatically when it starts",
        "Importing the package registers the driver named \"pgx\" with database/sql, even though the code never calls the package directly",
        "It switches the SQL placeholders from ? to $1",
        "It prevents SQL injection by checking every query"
      ],
      "answerIndex": 1,
      "explanation": "The pgx package registers itself as a database/sql driver when it is imported. The underscore keeps the import legal although nothing from the package is used by name. It does not connect, change placeholders or filter queries."
    },
    {
      "question": "You call `sql.Open(\"pgx\", dsn)` with a wrong password in the DSN and get a nil error. What does that tell you?",
      "options": [
        "The password is actually correct",
        "The database is running and accepted the connection",
        "Nothing about the connection yet: Open only validates its arguments, and PingContext or the first query is what actually connects",
        "The program will crash on the next line"
      ],
      "answerIndex": 2,
      "explanation": "sql.Open does not contact the database. A bad password only appears as an error from PingContext or from the first query, which is why you Ping at startup."
    },
    {
      "question": "Which statement is correct for PostgreSQL with pgx?",
      "options": [
        "`db.QueryRowContext(ctx, \"SELECT name FROM users WHERE id = $1\", 1)` passes the value 1 separately from the SQL text",
        "`db.QueryRowContext(ctx, \"SELECT name FROM users WHERE id = ?\", 1)` is the correct PostgreSQL placeholder style",
        "`fmt.Sprintf(\"... WHERE name = '%s'\", input)` is the safe way to insert user input",
        "Placeholders can be used for table names as well as values"
      ],
      "answerIndex": 0,
      "explanation": "PostgreSQL placeholders are $1, $2, ... and the driver sends the values apart from the SQL. ? is MySQL style, Sprintf invites SQL injection, and placeholders stand only for values, not for table or column names."
    },
    {
      "question": "Why is `defer tx.Rollback()` written right after a successful BeginTx?",
      "options": [
        "Because Commit does not work unless Rollback is deferred first",
        "Because it makes the transaction run faster",
        "Because Rollback is what saves the changes to the database",
        "So that every early return on an error undoes the unfinished work, while after a successful Commit it has no harmful effect"
      ],
      "answerIndex": 3,
      "explanation": "One deferred Rollback covers all error paths. After Commit it just returns sql.ErrTxDone, which is ignored. Commit, not Rollback, saves the changes, and the defer does not affect speed."
    },
    {
      "question": "What is the default MaxOpenConns of a *sql.DB, and why should a production service set it?",
      "options": [
        "It defaults to 1, so every query already waits in line and no setting is needed",
        "It defaults to 0, meaning unlimited, so a busy service could open more connections than PostgreSQL's max_connections allows",
        "It defaults to 25, which is always the right size",
        "It defaults to the number of CPU cores, which can never overload the database"
      ],
      "answerIndex": 1,
      "explanation": "The default is 0, which means no limit. Without a cap, a traffic spike can open so many connections that PostgreSQL refuses new ones. Set a limit that fits your service and stays below the database's max_connections."
    }
  ]
});
