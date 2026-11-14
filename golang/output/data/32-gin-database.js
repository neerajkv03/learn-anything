window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "32-gin-database",
  "order": 32,
  "title": "Gin with a Database",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Connect your Gin handlers to PostgreSQL the way production Go services do it. You will hand dependencies to handlers through a struct, hide SQL behind a small repository interface (a Go interface that lists only the data methods a handler needs), pass the request context into every query, run multi-step writes in a transaction, and paginate list endpoints safely.",
  "prerequisites": [
    "31-gin-auth",
    "30-gin-errors",
    "24-database-sql",
    "17-context"
  ],
  "subtopics": [
    {
      "id": "handler-struct-dependencies",
      "title": "Handler struct with dependencies (no globals)",
      "explanation": "A handler needs things to do its job: a way to reach the database, a logger, maybe settings. Those needed things are called its dependencies. Dependency injection means handing them to the handler from the outside, when you create it, instead of letting the handler grab them from somewhere on its own. In Go you do this by hand with an ordinary struct and a constructor function (a function, usually named NewSomething, that builds and returns a ready-to-use value). No framework is needed.\n\nThe tempting shortcut is a global: a package-level variable such as `var db *sql.DB` that every function can see. It works in a tiny demo, but every handler now silently depends on that one variable. Tests cannot swap in a fake, and two copies of the app in one process (for example two test cases running in parallel) would fight over the same variable.\n\nInstead, put the dependencies in a struct (topic 8). In the example below, `UserHandler` has a `repo` field (the thing that talks to storage) and a `log` field (a `*slog.Logger` from topic 23). `NewUserHandler(repo, log)` returns a pointer to one (topic 9). The handlers are methods with a pointer receiver (topic 10), for example `func (h *UserHandler) Get(c *gin.Context)`, so they can read `h.repo` and `h.log`.\n\nWriting `h.Get` without parentheses does not call the method. It produces a method value: a function that is already attached to `h`. Its type is `func(*gin.Context)`, which is exactly `gin.HandlerFunc`, so you can pass it straight to `g.GET(\"/users/:id\", h.Get)`.\n\nThe handler also gets a `RegisterRoutes(g *gin.RouterGroup)` method (route groups: topic 27). That way the handler owns its own paths and `main` only decides the prefix, here `/api/v1`. In `main` you wire everything in order: open the database, build the repository, build the handler, register its routes. `UserRepo` is an interface (topic 10): a list of methods the handler needs. The next sub-topic explains it properly; for now it has one method, `Get`.\n\nOne `*sql.DB` is a connection pool (topic 24) and is safe to share, so you open it once at start-up and never per request.\n\nIn a real project the types live in `internal/user/` and `main` lives in `cmd/api/main.go` (topic 12), so the calls read `user.NewUserHandler(...)`. The example keeps everything in one file so you can run it as-is.\n\nSetup, step by step. Open a terminal, run the first block below to make a new module, then save the Go file as `main.go` in that folder. Make sure the `shop` database and the `users` table from topic 24 exist. The same block sets `DATABASE_URL` (use your own DSN from topic 24) and puts one user in the table. Run the server with `go run .` and leave it running. Open a second terminal for the `curl` command.",
      "analogy": "A chef is handed their own knives and the pantry key at the start of a shift. They do not rummage in a shared drawer that anyone in the building can rearrange. A different chef (a test) can be handed different knives (a fake repository) without changing how the chef cooks.",
      "code": [
        {
          "language": "bash",
          "filename": "setup.sh",
          "source": "mkdir shopapi\ncd shopapi\ngo mod init example.com/shopapi\ngo get github.com/gin-gonic/gin@v1.12.0 github.com/jackc/pgx/v5@v5.11.0\n# save the Go file below as main.go in this folder, then:\ngo mod tidy\n\nexport DATABASE_URL=\"postgres://postgres:postgres@localhost:5432/shop\"\npsql \"$DATABASE_URL\" -c \"TRUNCATE users RESTART IDENTITY\" -c \"INSERT INTO users (name) VALUES ('Ada')\"",
          "output": "TRUNCATE TABLE\nINSERT 0 1",
          "explanation": "Creates the module, installs Gin and the pgx driver at the course versions, sets the DSN environment variable (use your own from topic 24; on PowerShell write $env:DATABASE_URL = \"...\"), and resets the users table to a single row, Ada with id 1. The output shown is what the last command prints."
        },
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"database/sql\"\n\t\"log/slog\"\n\t\"net/http\"\n\t\"os\"\n\n\t\"github.com/gin-gonic/gin\"\n\t_ \"github.com/jackc/pgx/v5/stdlib\"\n)\n\ntype User struct {\n\tID   int64  `json:\"id\"`\n\tName string `json:\"name\"`\n}\n\n// UserRepo lists what the handler needs from storage.\ntype UserRepo interface {\n\tGet(ctx context.Context, id int64) (User, error)\n}\n\ntype PGRepo struct{ db *sql.DB }\n\nfunc NewPGRepo(db *sql.DB) *PGRepo { return &PGRepo{db: db} }\n\nfunc (r *PGRepo) Get(ctx context.Context, id int64) (User, error) {\n\tvar u User\n\terr := r.db.QueryRowContext(ctx, \"SELECT id, name FROM users WHERE id = $1\", id).\n\t\tScan(&u.ID, &u.Name)\n\treturn u, err\n}\n\n// UserHandler holds everything its methods need.\ntype UserHandler struct {\n\trepo UserRepo\n\tlog  *slog.Logger\n}\n\nfunc NewUserHandler(repo UserRepo, log *slog.Logger) *UserHandler {\n\treturn &UserHandler{repo: repo, log: log}\n}\n\nfunc (h *UserHandler) RegisterRoutes(g *gin.RouterGroup) {\n\tg.GET(\"/users/:id\", h.Get) // h.Get is a method value\n}\n\nfunc (h *UserHandler) Get(c *gin.Context) {\n\tvar p struct {\n\t\tID int64 `uri:\"id\" binding:\"required\"`\n\t}\n\tif err := c.ShouldBindUri(&p); err != nil {\n\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": gin.H{\"code\": \"bad_request\", \"message\": \"invalid id\"}})\n\t\treturn\n\t}\n\tu, err := h.repo.Get(c.Request.Context(), p.ID)\n\tif err != nil {\n\t\th.log.Error(\"get user failed\", \"err\", err)\n\t\tc.JSON(http.StatusInternalServerError, gin.H{\"error\": gin.H{\"code\": \"internal\", \"message\": \"internal error\"}})\n\t\treturn\n\t}\n\tc.JSON(http.StatusOK, u)\n}\n\nfunc mustOpen(dsn string) *sql.DB {\n\tdb, err := sql.Open(\"pgx\", dsn)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tif err := db.PingContext(context.Background()); err != nil {\n\t\tpanic(err)\n\t}\n\treturn db\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tlogger := slog.New(slog.NewJSONHandler(os.Stderr, nil))\n\n\t// wiring: database -> repository -> handler -> routes\n\tdb := mustOpen(os.Getenv(\"DATABASE_URL\"))\n\th := NewUserHandler(NewPGRepo(db), logger)\n\n\tr := gin.New()\n\tr.Use(gin.Recovery())\n\th.RegisterRoutes(r.Group(\"/api/v1\"))\n\n\tif err := r.Run(\":8080\"); err != nil {\n\t\tlogger.Error(\"server stopped\", \"err\", err)\n\t\tos.Exit(1)\n\t}\n}\n",
          "output": "",
          "explanation": "Prints nothing: the server just runs until you press Ctrl+C. Release mode (gin.SetMode) silences Gin's debug lines. main wires database, repository, handler and routes by hand. ShouldBindUri (topic 28) reads :id into an int64. If the repository fails, the handler logs the error and answers 500; a missing user would also give 500 for now, which the next sub-topic fixes."
        },
        {
          "language": "bash",
          "filename": "try.sh",
          "source": "curl -s -w ' %{http_code}\\n' localhost:8080/api/v1/users/1",
          "output": "{\"id\":1,\"name\":\"Ada\"} 200",
          "explanation": "The -s flag hides progress output and -w appends the HTTP status code after the body. The handler found the row through the repository it was given."
        }
      ],
      "productionNote": "Wiring dependencies by hand in main (sometimes called the composition root: the one place where everything is created and connected) is standard Go style. Avoid a dependency-injection framework until the wiring is genuinely painful. Every handler struct stays easy to test because a test can build it with a fake repository.",
      "commonMistakes": [
        "Declaring a package-level `var db *sql.DB` that every handler reads. Tests cannot replace it and the dependency is invisible in function signatures.",
        "Creating a new handler or opening a new database connection pool inside each request. Open the pool once in main and share it.",
        "Writing `h.Get()` with parentheses when registering the route. That calls the method immediately; pass `h.Get` itself.",
        "Using a value receiver for a handler struct that holds mutable state. Use a pointer receiver and return `*UserHandler` from the constructor."
      ],
      "sources": [
        {
          "title": "Effective Go: Methods",
          "url": "https://go.dev/doc/effective_go#methods"
        },
        {
          "title": "gin: RouterGroup.Group",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#RouterGroup.Group"
        }
      ]
    },
    {
      "id": "repository-interface",
      "title": "Repository interface over database/sql + pgx",
      "explanation": "A repository is a type that hides how data is stored behind methods named after what the application needs: `Get`, `Create`, `List`. The handler asks for \"user 7\" and does not care that SQL, a pool and a driver exist.\n\nIn Go you describe the repository with an interface (topic 10). The convention is to define the interface where it is used, next to the handler, and to keep it small: only the methods that handler actually calls. A giant interface with every query in the app makes fakes painful to write. A concrete type, `PGRepo`, holds the `*sql.DB` and implements the methods with the SQL you learned in topic 24. Go interfaces are satisfied implicitly, so `PGRepo` never says it implements `UserRepo`.\n\nThe repository also translates errors. When `QueryRowContext(...).Scan` finds no row it returns `sql.ErrNoRows` (topic 24). That is a database/sql detail. The repository catches it with `errors.Is` (topic 11) and returns a domain error, `ErrNotFound`, a sentinel error (a package-level error value, topic 11) declared with `errors.New`. A domain error is named after the business situation and says nothing about SQL.\n\nThe handler then only checks `errors.Is(err, ErrNotFound)` and answers 404 using the error shape from topic 30 (`{\"error\":{\"code\":...,\"message\":...}}`). In the split layout (topic 12) the handler file never imports `database/sql`. If you later switch databases, only the repository changes.\n\nThe example adds `Create`, which uses `INSERT ... RETURNING id` (topic 24) to get the new id back. The helper `fail` writes the error JSON and aborts; topic 30 showed how to centralise this in middleware, and a small helper keeps this example short. For the new endpoint, `POST /api/v1/users` binds a JSON body with `required` on the name (topic 28) and replies 201 (Created) on success.\n\nPress Ctrl+C in the terminal where the previous server is still running, then save the file as `main.go`, set `DATABASE_URL` and run `go run .`. Leave it running. The first block resets the table so the first new user gets id 1.",
      "analogy": "A library's request desk. You ask for a book by title. Whether it sits on the front shelf or in the basement archive is the desk's problem, and if the book does not exist the desk says 'we do not have it', not 'the basement shelf query returned zero rows'.",
      "code": [
        {
          "language": "bash",
          "filename": "reset.sh",
          "source": "psql \"$DATABASE_URL\" -c \"TRUNCATE users RESTART IDENTITY\"",
          "output": "TRUNCATE TABLE",
          "explanation": "Empties users and restarts the id counter so the next row gets id 1."
        },
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"database/sql\"\n\t\"errors\"\n\t\"log/slog\"\n\t\"net/http\"\n\t\"os\"\n\n\t\"github.com/gin-gonic/gin\"\n\t_ \"github.com/jackc/pgx/v5/stdlib\"\n)\n\ntype User struct {\n\tID   int64  `json:\"id\"`\n\tName string `json:\"name\"`\n}\n\n// ErrNotFound is a domain error: it says nothing about SQL.\nvar ErrNotFound = errors.New(\"not found\")\n\ntype UserRepo interface {\n\tGet(ctx context.Context, id int64) (User, error)\n\tCreate(ctx context.Context, name string) (User, error)\n}\n\ntype PGRepo struct{ db *sql.DB }\n\nfunc NewPGRepo(db *sql.DB) *PGRepo { return &PGRepo{db: db} }\n\nfunc (r *PGRepo) Get(ctx context.Context, id int64) (User, error) {\n\tvar u User\n\terr := r.db.QueryRowContext(ctx, \"SELECT id, name FROM users WHERE id = $1\", id).\n\t\tScan(&u.ID, &u.Name)\n\tif errors.Is(err, sql.ErrNoRows) {\n\t\treturn User{}, ErrNotFound // translate at the boundary\n\t}\n\treturn u, err\n}\n\nfunc (r *PGRepo) Create(ctx context.Context, name string) (User, error) {\n\tu := User{Name: name}\n\terr := r.db.QueryRowContext(ctx, \"INSERT INTO users (name) VALUES ($1) RETURNING id\", name).\n\t\tScan(&u.ID)\n\treturn u, err\n}\n\ntype APIError struct {\n\tCode    string `json:\"code\"`\n\tMessage string `json:\"message\"`\n}\n\nfunc fail(c *gin.Context, status int, code, msg string) {\n\tc.AbortWithStatusJSON(status, gin.H{\"error\": APIError{Code: code, Message: msg}})\n}\n\ntype UserHandler struct {\n\trepo UserRepo\n\tlog  *slog.Logger\n}\n\nfunc NewUserHandler(repo UserRepo, log *slog.Logger) *UserHandler {\n\treturn &UserHandler{repo: repo, log: log}\n}\n\nfunc (h *UserHandler) RegisterRoutes(g *gin.RouterGroup) {\n\tg.GET(\"/users/:id\", h.Get)\n\tg.POST(\"/users\", h.Create)\n}\n\nfunc (h *UserHandler) Get(c *gin.Context) {\n\tvar p struct {\n\t\tID int64 `uri:\"id\" binding:\"required\"`\n\t}\n\tif err := c.ShouldBindUri(&p); err != nil {\n\t\tfail(c, http.StatusBadRequest, \"bad_request\", \"invalid id\")\n\t\treturn\n\t}\n\tu, err := h.repo.Get(c.Request.Context(), p.ID)\n\tif errors.Is(err, ErrNotFound) {\n\t\tfail(c, http.StatusNotFound, \"not_found\", \"user not found\")\n\t\treturn\n\t}\n\tif err != nil {\n\t\th.log.Error(\"get user failed\", \"err\", err)\n\t\tfail(c, http.StatusInternalServerError, \"internal\", \"internal error\")\n\t\treturn\n\t}\n\tc.JSON(http.StatusOK, u)\n}\n\nfunc (h *UserHandler) Create(c *gin.Context) {\n\tvar in struct {\n\t\tName string `json:\"name\" binding:\"required\"`\n\t}\n\tif err := c.ShouldBindJSON(&in); err != nil {\n\t\tfail(c, http.StatusBadRequest, \"bad_request\", \"name is required\")\n\t\treturn\n\t}\n\tu, err := h.repo.Create(c.Request.Context(), in.Name)\n\tif err != nil {\n\t\th.log.Error(\"create user failed\", \"err\", err)\n\t\tfail(c, http.StatusInternalServerError, \"internal\", \"internal error\")\n\t\treturn\n\t}\n\tc.JSON(http.StatusCreated, u)\n}\n\nfunc mustOpen(dsn string) *sql.DB {\n\tdb, err := sql.Open(\"pgx\", dsn)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tif err := db.PingContext(context.Background()); err != nil {\n\t\tpanic(err)\n\t}\n\treturn db\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tlogger := slog.New(slog.NewJSONHandler(os.Stderr, nil))\n\tdb := mustOpen(os.Getenv(\"DATABASE_URL\"))\n\th := NewUserHandler(NewPGRepo(db), logger)\n\n\tr := gin.New()\n\tr.Use(gin.Recovery())\n\th.RegisterRoutes(r.Group(\"/api/v1\"))\n\tif err := r.Run(\":8080\"); err != nil {\n\t\tlogger.Error(\"server stopped\", \"err\", err)\n\t\tos.Exit(1)\n\t}\n}\n",
          "output": "",
          "explanation": "Prints nothing; the server runs until Ctrl+C. UserRepo has two methods. PGRepo.Get turns sql.ErrNoRows into ErrNotFound, so the handler's only error check for 'missing' is errors.Is(err, ErrNotFound). This single file imports database/sql because PGRepo lives in it; in the split layout only repo.go would."
        },
        {
          "language": "bash",
          "filename": "try.sh",
          "source": "curl -s -w ' %{http_code}\\n' -X POST -H 'Content-Type: application/json' -d '{\"name\":\"Ada\"}' localhost:8080/api/v1/users\ncurl -s -w ' %{http_code}\\n' localhost:8080/api/v1/users/1\ncurl -s -w ' %{http_code}\\n' localhost:8080/api/v1/users/99",
          "output": "{\"id\":1,\"name\":\"Ada\"} 201\n{\"id\":1,\"name\":\"Ada\"} 200\n{\"error\":{\"code\":\"not_found\",\"message\":\"user not found\"}} 404",
          "explanation": "Create returns 201 with the new row, Get finds it (200), and the unknown id 99 becomes a clean 404 in the shared error shape."
        }
      ],
      "productionNote": "Putting storage behind a small interface lets tests (topic 33) swap the real database for a fake, and keeps SQL out of HTTP code. Keep one repository per area of the domain, not one for the whole app.",
      "commonMistakes": [
        "Letting `sql.ErrNoRows` travel up to the handler, which then needs to import `database/sql` and know about SQL. Translate it to a domain error in the repository.",
        "Writing one giant interface containing every query in the app. Define small interfaces next to the code that uses them.",
        "Returning a zero-value `User` and a nil error for a missing row, so the handler cannot tell 'not found' from 'found an empty user'."
      ],
      "sources": [
        {
          "title": "Go: Querying for data",
          "url": "https://go.dev/doc/database/querying"
        },
        {
          "title": "Go Code Review Comments: Interfaces",
          "url": "https://go.dev/wiki/CodeReviewComments#interfaces"
        }
      ]
    },
    {
      "id": "request-context-into-queries",
      "title": "c.Request.Context() into queries",
      "explanation": "Topic 17 taught context.Context: a value that carries a cancellation signal and a deadline through your code. Every `http.Request` has one, available as `c.Request.Context()` in Gin. net/http cancels it when the client disconnects or the handler returns. If you pass that context to a query (the `...Context` methods from topic 24), the database work stops when nobody is waiting for the answer anymore.\n\nSo the rule is simple: in every handler write `ctx := c.Request.Context()` (or pass it inline) and give it as the first argument of every repository call. A repository method takes `ctx context.Context` as its first parameter and passes it on to `QueryRowContext`, `ExecContext` or `BeginTx`.\n\nYou can also cap the time one request may spend on the database. `context.WithTimeout(parent, 2*time.Second)` returns a child context that is cancelled after two seconds, plus a `cancel` function you must call (usually with `defer cancel()`) to release its resources. When the deadline passes, the query is cancelled and the error satisfies `errors.Is(err, context.DeadlineExceeded)`. Map that to `504 Gateway Timeout` (the server gave up waiting on something it depends on).\n\nWhy not pass `c` (the `*gin.Context`) itself? It does have the methods of a context, but by default it does not forward the request's cancellation signal, and handing it to the repository would force that layer to import Gin. Pass `c.Request.Context()` to everything outside the handler. Likewise avoid `context.Background()` inside handlers: a query started from it keeps running after the client has gone.\n\nThe example has one route, `GET /slow`. Its repository method runs `SELECT pg_sleep(5)`, a PostgreSQL statement that just waits 5 seconds. The handler allows only 2, so the call is cancelled and the client receives 504 after about two seconds. Press Ctrl+C in the terminal where the previous server is still running. Set `DATABASE_URL`, save as `main.go`, run `go run .` and use a second terminal for `curl`.",
      "analogy": "A call-centre agent searches the archive for you. If you hang up, the agent stops searching right away. A time limit works the same way: after two minutes the agent says 'sorry, that is taking too long' instead of keeping a line busy forever.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"database/sql\"\n\t\"errors\"\n\t\"net/http\"\n\t\"os\"\n\t\"time\"\n\n\t\"github.com/gin-gonic/gin\"\n\t_ \"github.com/jackc/pgx/v5/stdlib\"\n)\n\ntype SlowRepo struct{ db *sql.DB }\n\n// Slow runs a query that sleeps 5 seconds inside PostgreSQL.\nfunc (r *SlowRepo) Slow(ctx context.Context) error {\n\t_, err := r.db.ExecContext(ctx, \"SELECT pg_sleep(5)\")\n\treturn err\n}\n\ntype Handler struct{ repo *SlowRepo }\n\nfunc (h *Handler) Slow(c *gin.Context) {\n\t// start from the request's context, then cap it at 2 seconds\n\tctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)\n\tdefer cancel()\n\n\tif err := h.repo.Slow(ctx); err != nil {\n\t\tif errors.Is(err, context.DeadlineExceeded) {\n\t\t\tc.JSON(http.StatusGatewayTimeout, gin.H{\"error\": gin.H{\"code\": \"timeout\", \"message\": \"request timed out\"}})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusInternalServerError, gin.H{\"error\": gin.H{\"code\": \"internal\", \"message\": \"internal error\"}})\n\t\treturn\n\t}\n\tc.JSON(http.StatusOK, gin.H{\"status\": \"ok\"})\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tdb, err := sql.Open(\"pgx\", os.Getenv(\"DATABASE_URL\"))\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\th := &Handler{repo: &SlowRepo{db: db}}\n\n\tr := gin.New()\n\tr.Use(gin.Recovery())\n\tr.GET(\"/slow\", h.Slow)\n\tif err := r.Run(\":8080\"); err != nil {\n\t\tpanic(err)\n\t}\n}\n",
          "output": "",
          "explanation": "Prints nothing; the server runs until Ctrl+C. The handler derives a 2-second context from c.Request.Context() and passes it to the repository, which passes it to ExecContext. defer cancel() releases the timer. errors.Is(err, context.DeadlineExceeded) recognises the timeout."
        },
        {
          "language": "bash",
          "filename": "try.sh",
          "source": "curl -s -w ' %{http_code}\\n' localhost:8080/slow",
          "output": "{\"error\":{\"code\":\"timeout\",\"message\":\"request timed out\"}} 504",
          "explanation": "The response arrives after roughly 2 seconds, not 5: the query was cancelled at the deadline and the pool connection was freed."
        }
      ],
      "productionNote": "A bounded database time per request protects the connection pool (topic 24): without it, a few slow queries can occupy every connection and the whole service stalls. Pick a timeout that fits your slowest legitimate endpoint.",
      "commonMistakes": [
        "Using `context.Background()` in a handler, so queries outlive the request and keep holding pool connections.",
        "Passing the `*gin.Context` into the repository. It couples that layer to Gin and does not carry the request's cancellation signal by default; pass `c.Request.Context()`.",
        "Forgetting `defer cancel()` after `context.WithTimeout`, which leaks the timer until it fires."
      ],
      "sources": [
        {
          "title": "Go: Canceling in-progress database operations",
          "url": "https://go.dev/doc/database/cancel-operations"
        },
        {
          "title": "net/http: Request.Context",
          "url": "https://pkg.go.dev/net/http#Request.Context"
        }
      ]
    },
    {
      "id": "transactions-in-handler",
      "title": "Transactions in a handler",
      "explanation": "A transaction (topic 24) groups several SQL statements so they all succeed or none do. Moving money is the classic case: subtract from one account, add to another. If the second step failed after the first, money would vanish.\n\nKeep the transaction in the repository (or a service layer: a plain Go type that holds business operations). Give it one method named after the business action, here `Transfer(ctx, from, to, amount int64) error`. The handler only binds the input and maps errors to status codes. Never call `BeginTx` in handler code: HTTP code should not know how many SQL statements make up a transfer.\n\nInside `Transfer`: call `db.BeginTx(ctx, nil)` and immediately `defer tx.Rollback()`. After a successful `Commit` the rollback does nothing, and on any early `return` it undoes the work. Then run every statement on `tx`, never on `db`, because a statement on `db` runs outside the transaction.\n\nThe subtle part is reading the balance. If two requests both read \"balance 500\", both pass the check and both withdraw, leaving the account overdrawn. The fix is `SELECT ... FOR UPDATE`. It locks the selected rows (a row lock) until the transaction ends; other transactions that try to lock or change those rows wait until this one commits or rolls back. The check and the update then happen without interference.\n\nThe example locks both account rows in one query ordered by id. Locking in a fixed order prevents a deadlock (two transactions each holding a lock the other needs). It reads the rows into a map (topic 7), closes the rows before running the next statement, and returns `ErrNotFound` if an account is missing or `ErrInsufficientFunds` if the balance is too small. Then it runs the two `UPDATE` statements and commits.\n\nThe handler binds `{\"from\":1,\"to\":2,\"amount\":100}` with `binding:\"required,gt=0\"` on each field (topic 28; `gt=0` means greater than zero) and maps errors with `switch` and `errors.Is`: insufficient funds becomes 409 Conflict (the request conflicts with the current state), a missing account 404, anything else 500.\n\nPress Ctrl+C in the terminal where the previous server is still running, then save the file as `main.go` and run `go run .` after the reset.sh block. The first block puts the balances back to 500 and 100 (the `accounts` table from topic 24).",
      "analogy": "A bank teller locks both ledgers before moving money and unlocks them afterwards. Other tellers wait their turn at those two ledgers. The customer at the window only ever hears 'done' or 'not enough funds', never the ledger steps.",
      "code": [
        {
          "language": "bash",
          "filename": "reset.sh",
          "source": "psql \"$DATABASE_URL\" -c \"UPDATE accounts SET balance = CASE id WHEN 1 THEN 500 ELSE 100 END\"",
          "output": "UPDATE 2",
          "explanation": "Resets accounts 1 and 2 to balances 500 and 100."
        },
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"database/sql\"\n\t\"errors\"\n\t\"log/slog\"\n\t\"net/http\"\n\t\"os\"\n\n\t\"github.com/gin-gonic/gin\"\n\t_ \"github.com/jackc/pgx/v5/stdlib\"\n)\n\nvar (\n\tErrNotFound          = errors.New(\"not found\")\n\tErrInsufficientFunds = errors.New(\"insufficient funds\")\n)\n\ntype AccountRepo interface {\n\tTransfer(ctx context.Context, from, to, amount int64) error\n}\n\ntype PGRepo struct{ db *sql.DB }\n\n// Transfer moves amount from one account to another, all or nothing.\nfunc (r *PGRepo) Transfer(ctx context.Context, from, to, amount int64) error {\n\ttx, err := r.db.BeginTx(ctx, nil)\n\tif err != nil {\n\t\treturn err\n\t}\n\tdefer tx.Rollback() // no-op after a successful Commit\n\n\t// Lock both rows (always in id order) and read their balances.\n\trows, err := tx.QueryContext(ctx,\n\t\t\"SELECT id, balance FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR UPDATE\", from, to)\n\tif err != nil {\n\t\treturn err\n\t}\n\tbalances := map[int64]int64{}\n\tfor rows.Next() {\n\t\tvar id, bal int64\n\t\tif err := rows.Scan(&id, &bal); err != nil {\n\t\t\trows.Close()\n\t\t\treturn err\n\t\t}\n\t\tbalances[id] = bal\n\t}\n\trows.Close() // the connection must be free before the next statement\n\tif err := rows.Err(); err != nil {\n\t\treturn err\n\t}\n\tif len(balances) != 2 {\n\t\treturn ErrNotFound\n\t}\n\tif balances[from] < amount {\n\t\treturn ErrInsufficientFunds\n\t}\n\n\tif _, err := tx.ExecContext(ctx, \"UPDATE accounts SET balance = balance - $1 WHERE id = $2\", amount, from); err != nil {\n\t\treturn err\n\t}\n\tif _, err := tx.ExecContext(ctx, \"UPDATE accounts SET balance = balance + $1 WHERE id = $2\", amount, to); err != nil {\n\t\treturn err\n\t}\n\treturn tx.Commit()\n}\n\ntype APIError struct {\n\tCode    string `json:\"code\"`\n\tMessage string `json:\"message\"`\n}\n\nfunc fail(c *gin.Context, status int, code, msg string) {\n\tc.AbortWithStatusJSON(status, gin.H{\"error\": APIError{Code: code, Message: msg}})\n}\n\ntype AccountHandler struct {\n\trepo AccountRepo\n\tlog  *slog.Logger\n}\n\ntype transferRequest struct {\n\tFrom   int64 `json:\"from\" binding:\"required,gt=0\"`\n\tTo     int64 `json:\"to\" binding:\"required,gt=0\"`\n\tAmount int64 `json:\"amount\" binding:\"required,gt=0\"`\n}\n\n// Transfer only binds input and maps errors; the repo owns the transaction.\nfunc (h *AccountHandler) Transfer(c *gin.Context) {\n\tvar in transferRequest\n\tif err := c.ShouldBindJSON(&in); err != nil {\n\t\tfail(c, http.StatusBadRequest, \"bad_request\", \"from, to and amount must be positive numbers\")\n\t\treturn\n\t}\n\terr := h.repo.Transfer(c.Request.Context(), in.From, in.To, in.Amount)\n\tswitch {\n\tcase errors.Is(err, ErrInsufficientFunds):\n\t\tfail(c, http.StatusConflict, \"insufficient_funds\", \"insufficient funds\")\n\tcase errors.Is(err, ErrNotFound):\n\t\tfail(c, http.StatusNotFound, \"not_found\", \"account not found\")\n\tcase err != nil:\n\t\th.log.Error(\"transfer failed\", \"err\", err)\n\t\tfail(c, http.StatusInternalServerError, \"internal\", \"internal error\")\n\tdefault:\n\t\tc.JSON(http.StatusOK, gin.H{\"status\": \"ok\"})\n\t}\n}\n\nfunc mustOpen(dsn string) *sql.DB {\n\tdb, err := sql.Open(\"pgx\", dsn)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tif err := db.PingContext(context.Background()); err != nil {\n\t\tpanic(err)\n\t}\n\treturn db\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tlogger := slog.New(slog.NewJSONHandler(os.Stderr, nil))\n\tdb := mustOpen(os.Getenv(\"DATABASE_URL\"))\n\th := &AccountHandler{repo: &PGRepo{db: db}, log: logger}\n\n\tr := gin.New()\n\tr.Use(gin.Recovery())\n\tr.POST(\"/api/v1/transfers\", h.Transfer)\n\tif err := r.Run(\":8080\"); err != nil {\n\t\tlogger.Error(\"server stopped\", \"err\", err)\n\t\tos.Exit(1)\n\t}\n}\n",
          "output": "",
          "explanation": "Prints nothing; the server runs until Ctrl+C. Transfer begins a transaction, locks both rows with FOR UPDATE, checks the balance, runs two UPDATEs on tx and commits. The deferred Rollback undoes everything if any step returns early. The handler never touches the transaction."
        },
        {
          "language": "bash",
          "filename": "try.sh",
          "source": "curl -s -w ' %{http_code}\\n' -X POST -H 'Content-Type: application/json' -d '{\"from\":1,\"to\":2,\"amount\":100}' localhost:8080/api/v1/transfers\npsql \"$DATABASE_URL\" -tA -c \"SELECT string_agg(balance::text, ' ' ORDER BY id) FROM accounts\"\ncurl -s -w ' %{http_code}\\n' -X POST -H 'Content-Type: application/json' -d '{\"from\":2,\"to\":1,\"amount\":1000}' localhost:8080/api/v1/transfers\npsql \"$DATABASE_URL\" -tA -c \"SELECT string_agg(balance::text, ' ' ORDER BY id) FROM accounts\"",
          "output": "{\"status\":\"ok\"} 200\n400 200\n{\"error\":{\"code\":\"insufficient_funds\",\"message\":\"insufficient funds\"}} 409\n400 200",
          "explanation": "The first transfer moves 100 (balances become 400 and 200). The second asks account 2 for 1000 but it only has 200, so the repository returns ErrInsufficientFunds, the handler answers 409, and the balances are unchanged."
        }
      ],
      "productionNote": "Use this pattern for orders, payments and stock changes: one repository or service method per business operation, a transaction inside it, and row locks wherever you read a value and then change it. Always lock rows in a consistent order.",
      "commonMistakes": [
        "Checking the balance with a plain SELECT and then updating. Two concurrent requests can both pass the check. Use `SELECT ... FOR UPDATE` inside the transaction.",
        "Running a statement on `db` instead of `tx` inside the transaction, so it is not part of it and is not rolled back.",
        "Starting the transaction in the handler. Handlers should call one repository method and map its errors.",
        "Running the next statement while a `rows` result is still open on the same `tx`. Finish reading and close `rows` first."
      ],
      "sources": [
        {
          "title": "Go: Executing transactions",
          "url": "https://go.dev/doc/database/execute-transactions"
        },
        {
          "title": "PostgreSQL 18: SELECT, locking clause",
          "url": "https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE"
        }
      ]
    },
    {
      "id": "pagination-limit-offset",
      "title": "Pagination with limit/offset",
      "explanation": "A table can hold millions of rows. A list endpoint must never return them all at once, so it returns one page at a time. Pagination with limit and offset uses two numbers: `limit` is the page size (\"give me at most 20 items\") and `offset` is how many items to skip first (\"start after item 40\").\n\nIn SQL that is `SELECT id, name FROM users ORDER BY id LIMIT $1 OFFSET $2`. The `ORDER BY` is essential. Without it PostgreSQL may return rows in any order, and consecutive pages could repeat or skip items. Ordering by a unique column such as `id` makes pages stable.\n\nRead the two numbers from the query string with the binding tools from topic 28. The struct `ListQuery` uses `form:\"limit,default=20\"` to apply a default when the parameter is missing, and `binding:\"min=1,max=100\"` to reject silly values. The maximum protects the database from `?limit=1000000`. `ShouldBindQuery` fills the struct, and a validation failure becomes a 400 response.\n\nThe response wraps the items together with the numbers used: `{\"items\":[...],\"limit\":2,\"offset\":0}`, so clients can compute the next page.\n\nWatch the empty page. In Go an uninitialised slice is nil, and a nil slice encodes to JSON as `null` (topic 19), which breaks clients that expect an array. Start the slice as `users := []User{}` so that \"no rows\" is encoded as `[]`.\n\nLimit/offset gets slower as the offset grows, because the database still walks past all the skipped rows. For very large tables use keyset pagination instead: the client sends the last id it saw and the query uses `WHERE id > $1 ORDER BY id LIMIT $2`. That is only named here; limit/offset is fine for most endpoints.\n\nThe repository interface from the earlier sub-topic now has a `List` method, and the handler has a `List` method registered at `GET /api/v1/users`. The example keeps only the list parts. The first block below stores three users, Ada, Grace and Linus, with ids 1 to 3.\n\nPress Ctrl+C in the terminal where the previous server is still running. Save the Go file as `main.go` in the `shopapi` folder (replacing the old one), run the reset.sh block, then run `go run .` and leave it running.",
      "analogy": "Reading a long list one page at a time: 'give me 20 items, starting after item 40'. Without a fixed order, the list is like a shuffled deck, and page 2 might repeat cards from page 1.",
      "code": [
        {
          "language": "bash",
          "filename": "reset.sh",
          "source": "psql \"$DATABASE_URL\" -c \"TRUNCATE users RESTART IDENTITY\" -c \"INSERT INTO users (name) VALUES ('Ada'), ('Grace'), ('Linus')\"",
          "output": "TRUNCATE TABLE\nINSERT 0 3",
          "explanation": "Resets the table and inserts three users with ids 1, 2 and 3."
        },
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"database/sql\"\n\t\"log/slog\"\n\t\"net/http\"\n\t\"os\"\n\n\t\"github.com/gin-gonic/gin\"\n\t_ \"github.com/jackc/pgx/v5/stdlib\"\n)\n\ntype User struct {\n\tID   int64  `json:\"id\"`\n\tName string `json:\"name\"`\n}\n\ntype UserRepo interface {\n\tList(ctx context.Context, limit, offset int) ([]User, error)\n}\n\ntype PGRepo struct{ db *sql.DB }\n\nfunc (r *PGRepo) List(ctx context.Context, limit, offset int) ([]User, error) {\n\trows, err := r.db.QueryContext(ctx,\n\t\t\"SELECT id, name FROM users ORDER BY id LIMIT $1 OFFSET $2\", limit, offset)\n\tif err != nil {\n\t\treturn nil, err\n\t}\n\tdefer rows.Close()\n\n\tusers := []User{} // not \"var users []User\": an empty page must encode as [], not null\n\tfor rows.Next() {\n\t\tvar u User\n\t\tif err := rows.Scan(&u.ID, &u.Name); err != nil {\n\t\t\treturn nil, err\n\t\t}\n\t\tusers = append(users, u)\n\t}\n\treturn users, rows.Err()\n}\n\ntype ListQuery struct {\n\tLimit  int `form:\"limit,default=20\" binding:\"min=1,max=100\"`\n\tOffset int `form:\"offset,default=0\" binding:\"min=0\"`\n}\n\ntype Page struct {\n\tItems  []User `json:\"items\"`\n\tLimit  int    `json:\"limit\"`\n\tOffset int    `json:\"offset\"`\n}\n\ntype UserHandler struct {\n\trepo UserRepo\n\tlog  *slog.Logger\n}\n\nfunc (h *UserHandler) RegisterRoutes(g *gin.RouterGroup) {\n\tg.GET(\"/users\", h.List)\n}\n\nfunc (h *UserHandler) List(c *gin.Context) {\n\tvar q ListQuery\n\tif err := c.ShouldBindQuery(&q); err != nil {\n\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": gin.H{\n\t\t\t\"code\": \"invalid_query\", \"message\": \"limit must be 1-100 and offset must be 0 or more\"}})\n\t\treturn\n\t}\n\tusers, err := h.repo.List(c.Request.Context(), q.Limit, q.Offset)\n\tif err != nil {\n\t\th.log.Error(\"list users failed\", \"err\", err)\n\t\tc.JSON(http.StatusInternalServerError, gin.H{\"error\": gin.H{\"code\": \"internal\", \"message\": \"internal error\"}})\n\t\treturn\n\t}\n\tc.JSON(http.StatusOK, Page{Items: users, Limit: q.Limit, Offset: q.Offset})\n}\n\nfunc mustOpen(dsn string) *sql.DB {\n\tdb, err := sql.Open(\"pgx\", dsn)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tif err := db.PingContext(context.Background()); err != nil {\n\t\tpanic(err)\n\t}\n\treturn db\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tlogger := slog.New(slog.NewJSONHandler(os.Stderr, nil))\n\tdb := mustOpen(os.Getenv(\"DATABASE_URL\"))\n\th := &UserHandler{repo: &PGRepo{db: db}, log: logger}\n\n\tr := gin.New()\n\tr.Use(gin.Recovery())\n\th.RegisterRoutes(r.Group(\"/api/v1\"))\n\tif err := r.Run(\":8080\"); err != nil {\n\t\tlogger.Error(\"server stopped\", \"err\", err)\n\t\tos.Exit(1)\n\t}\n}\n",
          "output": "",
          "explanation": "Prints nothing; the server runs until Ctrl+C. List uses ORDER BY id with LIMIT and OFFSET placeholders, and starts from an empty (non-nil) slice. ListQuery defaults limit to 20 and offset to 0 and validates both. Page is the response shape."
        },
        {
          "language": "bash",
          "filename": "try.sh",
          "source": "curl -s -w ' %{http_code}\\n' 'localhost:8080/api/v1/users?limit=2'\ncurl -s -w ' %{http_code}\\n' 'localhost:8080/api/v1/users?limit=2&offset=2'\ncurl -s -w ' %{http_code}\\n' 'localhost:8080/api/v1/users?offset=10'\ncurl -s -w ' %{http_code}\\n' 'localhost:8080/api/v1/users?limit=1000'",
          "output": "{\"items\":[{\"id\":1,\"name\":\"Ada\"},{\"id\":2,\"name\":\"Grace\"}],\"limit\":2,\"offset\":0} 200\n{\"items\":[{\"id\":3,\"name\":\"Linus\"}],\"limit\":2,\"offset\":2} 200\n{\"items\":[],\"limit\":20,\"offset\":10} 200\n{\"error\":{\"code\":\"invalid_query\",\"message\":\"limit must be 1-100 and offset must be 0 or more\"}} 400",
          "explanation": "The quotes keep the shell from treating & as a command separator. Page 1 holds Ada and Grace, page 2 only Linus, an offset past the end gives an empty array (with the default limit 20 echoed), and limit=1000 breaks max=100 so it is rejected."
        }
      ],
      "productionNote": "Every list endpoint needs pagination, a default limit and a hard maximum, otherwise one request can pull the whole table. Always pair LIMIT with a deterministic ORDER BY, and consider keyset pagination when tables or offsets get large.",
      "commonMistakes": [
        "Leaving out `ORDER BY`, so pages shuffle and items repeat or disappear between requests.",
        "Allowing an unbounded `limit`. Always set a maximum such as 100.",
        "Declaring `var users []User` and returning `null` for an empty page. Start with `users := []User{}` so the JSON is `[]`.",
        "Building the SQL by joining the limit and offset into a string. Use `$1` and `$2` placeholders (topic 24)."
      ],
      "sources": [
        {
          "title": "PostgreSQL 18: LIMIT and OFFSET",
          "url": "https://www.postgresql.org/docs/18/queries-limit.html"
        },
        {
          "title": "Gin: Only bind query string",
          "url": "https://gin-gonic.com/en/docs/binding/only-bind-query-string/"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why give a handler its database through a struct field instead of a global variable?",
      "options": [
        "Globals are not allowed by the Go compiler",
        "The dependency is visible, and a test can build the handler with a fake repository",
        "Struct fields make SQL queries run faster",
        "Gin refuses to register handlers that read globals"
      ],
      "answerIndex": 1,
      "explanation": "A struct field makes the dependency explicit and replaceable, so tests and parallel setups do not share hidden state. Globals compile fine and have no speed or Gin-related difference."
    },
    {
      "question": "Where should sql.ErrNoRows (the error meaning 'the query found no row') be translated into a domain error such as ErrNotFound?",
      "options": [
        "In the handler, with a switch on the HTTP status",
        "In the client that calls the API",
        "In the repository, so handlers never need to import database/sql",
        "Nowhere, it should always be returned as a 500"
      ],
      "answerIndex": 2,
      "explanation": "The repository is the layer that knows about SQL. It converts sql.ErrNoRows to ErrNotFound, and the handler maps ErrNotFound to 404 without knowing how data is stored."
    },
    {
      "question": "Which context should a handler pass to repository queries?",
      "options": [
        "c.Request.Context()",
        "context.Background()",
        "context.TODO() created once at start-up",
        "The *gin.Context stored in a global variable"
      ],
      "answerIndex": 0,
      "explanation": "c.Request.Context() is cancelled when the client disconnects, so the query stops. context.Background() never cancels, and a *gin.Context should not be passed into the repository layer."
    },
    {
      "question": "Why does the transfer query use SELECT ... FOR UPDATE?",
      "options": [
        "It makes the UPDATE statements execute faster",
        "It automatically commits the transaction",
        "It converts the balance column to a different type",
        "It locks the rows so two concurrent transfers cannot both pass the balance check"
      ],
      "answerIndex": 3,
      "explanation": "FOR UPDATE takes a row lock until the transaction ends. Another transfer on the same account waits, so the check and the update are not interleaved."
    },
    {
      "question": "Why must a LIMIT/OFFSET query have an ORDER BY?",
      "options": [
        "Without it the SQL is a syntax error in PostgreSQL",
        "Without a fixed order, rows can come back in any order, so pages may repeat or skip items",
        "ORDER BY is what makes OFFSET skip rows",
        "ORDER BY lets the limit exceed 100"
      ],
      "answerIndex": 1,
      "explanation": "PostgreSQL accepts LIMIT without ORDER BY but gives no promise about row order, so consecutive pages are unreliable. ORDER BY on a unique column makes them stable."
    }
  ]
});
