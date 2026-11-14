# 24. Databases with database/sql
Version: Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7
Prerequisites: 23-logging-config

Setup for all examples (state once, first sub-topic): PostgreSQL 18.7 installed by the learner; database `shop`; DSN `postgres://app:secret@localhost:5432/shop?sslmode=disable` read from env `DATABASE_URL` (topic 23); tables:
`CREATE TABLE users (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL);`
`CREATE TABLE accounts (id BIGINT PRIMARY KEY, balance BIGINT NOT NULL);` with rows (1, 500), (2, 100).
SQL gloss: SQL = language to ask a database for data; table = spreadsheet-like grid of rows and columns.

## Learning goals
- learner can add the pgx driver and register it with database/sql
- learner can open a connection pool and verify it with PingContext
- learner can run queries and statements with $1 placeholders
- learner can group changes in a transaction
- learner can pass contexts and tune the pool

## Sub-topics
### database/sql and drivers (PostgreSQL via pgx stdlib driver)
- Concept: `database/sql` = standard API; driver = database-specific plug-in; `go get github.com/jackc/pgx/v5@v5.11.0`; blank import `import _ "github.com/jackc/pgx/v5/stdlib"` registers driver name `"pgx"` (author: confirm name on https://pkg.go.dev/github.com/jackc/pgx/v5/stdlib); blank import gloss = imported only for its side effect.
- Analogy: universal TV remote (database/sql) + the code for your TV brand (driver).
- Code example: setup only — go.mod line `require github.com/jackc/pgx/v5 v5.11.0` + the import block
- Production use: same database/sql code works with other drivers (MySQL, SQLite) by swapping driver + SQL dialect.
- Common mistakes: forgetting the blank import → `sql: unknown driver "pgx" (forgotten import?)`; mixing pgx native API and database/sql in one beginner codebase.
- Sources: https://go.dev/doc/database/ ; https://pkg.go.dev/github.com/jackc/pgx/v5/stdlib ; https://www.postgresql.org/download/

### Opening a pool and Ping
- Concept: `db, err := sql.Open("pgx", dsn)` only validates arguments — doesn't connect; `db.PingContext(ctx)` checks connectivity; `*sql.DB` is a pool safe for concurrent use: open once at startup, share, `defer db.Close()` in main.
- Analogy: saving a phone number in contacts (Open) vs actually dialing to hear a voice (Ping).
- Code example: open.go — ctx 5s timeout; success → `connected`; wrong password → error printed (text comes from PostgreSQL/pgx; say it contains `password authentication failed`)
- Production use: fail fast at startup if the DB is unreachable.
- Common mistakes: sql.Open per request; assuming Open errors on a bad password.
- Sources: https://go.dev/doc/database/open-handle ; https://pkg.go.dev/database/sql#DB.PingContext

### Query, QueryRow and Exec with placeholders
- Concept: `QueryRowContext(...).Scan(&name)` for one row (`sql.ErrNoRows` if none); `QueryContext` for many: `defer rows.Close()`, `for rows.Next() { rows.Scan(...) }`, then `rows.Err()`; `ExecContext` for INSERT/UPDATE/DELETE → `RowsAffected()`; PostgreSQL placeholders `$1, $2`; `INSERT ... RETURNING id` via QueryRow; never build SQL with fmt.Sprintf (SQL injection gloss).
- Analogy: fill-in-the-blanks order form — the customer only fills the blanks, they can't rewrite the order.
- Code example: queries.go — `INSERT INTO users (name) VALUES ($1) RETURNING id` with "Ada" on empty table → `1`; `SELECT name FROM users WHERE id = $1` with 1 → `Ada`; with 99 → `errors.Is(err, sql.ErrNoRows)` → `true`; `UPDATE users SET name = $1 WHERE id = $2` ("Ada L.", 1) → RowsAffected `1`
- Production use: repository functions per entity.
- Common mistakes: forgetting rows.Close (pool exhaustion); skipping rows.Err; `?` placeholders (MySQL style) on PostgreSQL.
- Sources: https://go.dev/doc/database/querying ; https://go.dev/doc/database/change-data ; https://go.dev/doc/database/sql-injection

### Transactions
- Concept: `tx, err := db.BeginTx(ctx, nil)`; `defer tx.Rollback()` (no-op after Commit); run statements on `tx`, not `db`; `tx.Commit()`; all-or-nothing.
- Analogy: bank transfer — money leaves one account and arrives in the other, or neither happens.
- Code example: transfer.go — move 100 from account 1 (500) to 2 (100) with two UPDATEs; after Commit `SELECT balance` → `400 200`; if the second UPDATE fails, both stay `500 100`
- Production use: orders + stock, transfers, multi-table writes.
- Common mistakes: using `db.ExecContext` inside a tx (runs outside it); forgetting Rollback on error paths (defer fixes it).
- Sources: https://go.dev/doc/database/execute-transactions ; https://pkg.go.dev/database/sql#DB.BeginTx

### Context and connection pool settings
- Concept: always the `...Context` methods with request ctx (topic 17) so slow queries are cancelled; `db.SetMaxOpenConns(25)`, `SetMaxIdleConns(25)`, `SetConnMaxLifetime(5*time.Minute)`, `SetConnMaxIdleTime(1*time.Minute)`; `db.Stats()` for monitoring; don't exceed PostgreSQL's `max_connections`.
- Analogy: taxi fleet — enough cars for peak demand, not so many that the depot (database) overflows; old cars retired regularly.
- Code example: pool.go — set the four values; query with 2s timeout ctx running `SELECT pg_sleep(5)` → error, `errors.Is(err, context.DeadlineExceeded)` → `true`; print `db.Stats().MaxOpenConnections` → `25`
- Production use: tuned per service and DB size; metrics from Stats.
- Common mistakes: unlimited open connections (default 0 = unlimited) overwhelming the DB; queries without timeouts.
- Sources: https://go.dev/doc/database/manage-connections ; https://go.dev/doc/database/cancel-operations ; https://pkg.go.dev/database/sql#DB.SetMaxOpenConns

## Quiz
1. Why the blank import of pgx stdlib? — tests driver registration
2. Does sql.Open connect? — tests Open vs Ping
3. Placeholder style for PostgreSQL — tests $1
4. Why defer tx.Rollback()? — tests transactions
5. Default MaxOpenConns and why set it — tests pool
