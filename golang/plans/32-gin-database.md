# 32. Gin with a Database
Version: Go 1.27.4 + Gin v1.12.0 + pgx v5.11.0 + PostgreSQL 18.7
Prerequisites: 31-gin-auth, 30-gin-errors, 24-database-sql, 17-context

Setup: reuse topic 24 exactly — database `shop`, DSN from env `DATABASE_URL`, driver import `_ "github.com/jackc/pgx/v5/stdlib"`, `sql.Open("pgx", dsn)`, tables `users (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL)` and `accounts (id BIGINT PRIMARY KEY, balance BIGINT NOT NULL)` rows (1, 500), (2, 100). Layout (topic 12): `cmd/api/main.go`, `internal/user/` (repo + handler).

## Learning goals
- learner can inject dependencies into handlers via a struct instead of globals
- learner can hide SQL behind a repository interface
- learner can pass the request context into every query
- learner can run a multi-step write in a transaction from a handler
- learner can paginate list endpoints with limit/offset

## Sub-topics
### Handler struct with dependencies (no globals)
- Concept: `type UserHandler struct{ repo UserRepo; log *slog.Logger }`; constructor `NewUserHandler(repo, log)`; methods as handlers `func (h *UserHandler) Get(c *gin.Context)` — method value `h.Get` fits gin.HandlerFunc (topic 10); `RegisterRoutes(g *gin.RouterGroup)` method; main wires: open db → repo → handler → routes. Globals make tests and parallel setups hard.
- Analogy: a chef handed their own knives and pantry key at shift start, rather than grabbing from a shared drawer anyone can rearrange.
- Code example: wiring.go — main: `db := mustOpen(os.Getenv("DATABASE_URL"))`, `h := user.NewUserHandler(user.NewPGRepo(db), logger)`, `h.RegisterRoutes(r.Group("/api/v1"))`; routes: `GET /api/v1/users/:id`, `POST /api/v1/users`, `GET /api/v1/users`
- Production use: dependency injection by hand — standard Go style, no DI framework needed.
- Common mistakes: package-level `var db *sql.DB`; creating a new handler/db per request.
- Sources: https://go.dev/doc/effective_go#methods ; https://pkg.go.dev/github.com/gin-gonic/gin#RouterGroup.Group

### Repository interface over database/sql + pgx
- Concept: `type UserRepo interface { Get(ctx context.Context, id int64) (User, error); Create(ctx context.Context, name string) (User, error); List(ctx context.Context, limit, offset int) ([]User, error) }`; `PGRepo{db *sql.DB}` implements it with topic-24 SQL; repo maps `sql.ErrNoRows` → `ErrNotFound` (domain error, topic 30) so handlers never import database/sql; interface defined where it's used (handler package), small.
- Analogy: a library's request desk: you ask for a book by title; whether it's on the shelf or in the basement archive is the desk's problem.
- Code example: repo.go — `Create(ctx, "Ada")` on empty table → `User{ID: 1, Name: "Ada"}`; handler POST /api/v1/users `{"name":"Ada"}` → 201 `{"id":1,"name":"Ada"}`; GET /users/1 → 200 same; GET /users/99 → repo returns ErrNotFound → 404 `{"error":{"code":"not_found","message":"user not found"}}`
- Production use: swap real DB for a fake in tests (topic 33).
- Common mistakes: leaking sql.ErrNoRows up to handlers; giant interfaces with every query.
- Sources: https://go.dev/doc/database/querying ; https://go.dev/wiki/CodeReviewComments#interfaces

### c.Request.Context() into queries
- Concept: `ctx := c.Request.Context()` passed to every repo call → client disconnect or server shutdown cancels the query (topic 17); optional per-query cap `ctx, cancel := context.WithTimeout(ctx, 2*time.Second); defer cancel()`; `*gin.Context` also implements context.Context but pass `c.Request.Context()` to non-Gin layers (clear dependency, no Gin import in repo).
- Analogy: if the customer hangs up, the call-centre agent stops searching the archive.
- Code example: ctx.go — handler with 2s timeout calls repo running `SELECT pg_sleep(5)` → `errors.Is(err, context.DeadlineExceeded)` → `true` → 504 `{"error":{"code":"timeout","message":"request timed out"}}`
- Production use: bounded DB time per request protects the pool.
- Common mistakes: `context.Background()` in handlers (queries outlive requests); passing *gin.Context into the repo.
- Sources: https://go.dev/doc/database/cancel-operations ; https://pkg.go.dev/net/http#Request.Context

### Transactions in a handler
- Concept: business op in repo/service method `Transfer(ctx, from, to, amount int64) error` using `db.BeginTx(ctx, nil)`, `defer tx.Rollback()`, `SELECT balance ... FOR UPDATE` (row lock gloss: others wait until commit), check balance → `ErrInsufficientFunds`, two UPDATEs, Commit (topic 24); handler only binds input + maps errors; never start tx in handler code directly.
- Analogy: bank teller locks both ledgers before moving money, unlocks after; customer at the window only sees "done" or "not enough funds".
- Code example: transfer.go — POST /api/v1/transfers `{"from":1,"to":2,"amount":100}` (binding `required,gt=0`) → 200 `{"status":"ok"}`, balances `400 200`; then `{"from":2,"to":1,"amount":1000}` → 409 `{"error":{"code":"insufficient_funds","message":"insufficient funds"}}`, balances unchanged `400 200`
- Production use: orders, payments, stock.
- Common mistakes: check-then-update without FOR UPDATE (two requests both pass the check); using db instead of tx inside.
- Sources: https://go.dev/doc/database/execute-transactions ; https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE

### Pagination with limit/offset
- Concept: bind `ListQuery{Limit int `form:"limit,default=20" binding:"min=1,max=100"`; Offset int `form:"offset,default=0" binding:"min=0"`}` (topic 28); SQL `SELECT id, name FROM users ORDER BY id LIMIT $1 OFFSET $2`; ORDER BY required for stable pages; response `{"items":[...],"limit":2,"offset":0}`; empty page → `"items":[]` not `null` (init `users := []User{}`; nil slice marshals to null, topic 19); keyset pagination (`WHERE id > $1`) named for large tables.
- Analogy: reading a long list a page at a time: "20 items, starting after item 40".
- Code example: list.go — users Ada, Grace, Linus (ids 1–3); `GET /api/v1/users?limit=2` → `{"items":[{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}],"limit":2,"offset":0}`; `?limit=2&offset=2` → `{"items":[{"id":3,"name":"Linus"}],"limit":2,"offset":2}`; `?offset=10` → `{"items":[],"limit":20,"offset":10}`; `?limit=1000` → 400
- Production use: every list endpoint; max limit protects DB.
- Common mistakes: no ORDER BY (pages shuffle); unbounded limit; returning null for empty lists.
- Sources: https://www.postgresql.org/docs/18/queries-limit.html ; https://gin-gonic.com/en/docs/examples/only-bind-query-string/

## Quiz
1. Why a handler struct instead of a global db? — tests DI
2. Where should sql.ErrNoRows be translated? — tests repository boundary
3. Which context to pass to queries? — tests c.Request.Context
4. Why SELECT ... FOR UPDATE in a transfer? — tests row lock
5. Why ORDER BY with LIMIT/OFFSET? — tests stable pagination
