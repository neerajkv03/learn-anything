# 26. Gin Basics
Version: Go 1.27.4 + Gin v1.12.0
Prerequisites: 21-http-server, 19-json, 12-packages-modules

Setup for all Gin topics (26–34), state once in first sub-topic: module `example.com/userapi` (`go mod init example.com/userapi`); `go get github.com/gin-gonic/gin@v1.12.0` → go.mod `require github.com/gin-gonic/gin v1.12.0`; Gin needs Go ≥1.25 (course uses Go 1.27.4). Test calls with curl (taught in 21). Running theme across 26–34: a small "users" API.
Gloss: framework = ready-made skeleton you fill in; third-party = written outside the Go team.

## Learning goals
- learner can say what Gin adds over net/http and when plain net/http is enough
- learner can install Gin at a pinned version
- learner can create an engine with gin.Default or gin.New and knows the difference
- learner can register routes for GET/POST/PUT/PATCH/DELETE
- learner can send JSON and text responses through gin.Context
- learner can switch between debug and release mode

## Sub-topics
### Why a framework over net/http
- Concept: net/http (topic 21) already routes + serves; Gin adds: :param routing with route groups, binding+validation of JSON/query/form into structs, middleware chain with c.Next/c.Abort, one `*gin.Context` per request with helpers (c.JSON), built-in Logger+Recovery. Trade-off: extra dependency + Gin-specific handler signature `func(c *gin.Context)`. Plain net/http is fine for tiny services; Gin is popular for JSON APIs.
- Analogy: cooking from raw ingredients (net/http) vs a meal kit (Gin): same kitchen and stove, pre-measured parts, but you follow the kit's recipe card format.
- Code example: compare.go — same endpoint both ways: net/http `mux.HandleFunc("GET /ping", ...)` writing `{"message":"pong"}` with json.NewEncoder vs Gin `r.GET("/ping", func(c *gin.Context){ c.JSON(http.StatusOK, gin.H{"message": "pong"}) })`; `curl localhost:8080/ping` → `{"message":"pong"}` for both
- Production use: Gin engine is an `http.Handler` → plugs into http.Server (topic 34) and httptest (topic 33).
- Common mistakes: thinking Gin replaces net/http (it builds on it); mixing http.HandlerFunc and gin.HandlerFunc signatures.
- Sources: https://gin-gonic.com/en/docs/introduction/ ; https://pkg.go.dev/github.com/gin-gonic/gin

### Installing Gin with go get
- Concept: `go get github.com/gin-gonic/gin@v1.12.0` (pin, topic 12); go.mod require + go.sum entries (indirect deps like validator appear, `// indirect`); import path `"github.com/gin-gonic/gin"`, package name `gin`; `go mod tidy` after edits.
- Analogy: ordering a specific edition of a book by ISBN, not "whatever's newest".
- Code example: terminal: `go mod init example.com/userapi` → `go get github.com/gin-gonic/gin@v1.12.0` → go.mod contains `require github.com/gin-gonic/gin v1.12.0` (show only that line; don't list indirect versions)
- Production use: pinned versions + go.sum = reproducible builds in CI.
- Common mistakes: running go get outside a module (no go.mod); importing `gin-gonic/gin` without `github.com/` prefix.
- Sources: https://gin-gonic.com/en/docs/quickstart/ ; https://go.dev/ref/mod#go-get

### gin.Default vs gin.New
- Concept: `gin.New()` = bare engine, no middleware; `gin.Default()` = New + Logger (one log line per request) + Recovery (panic → 500 instead of crash). Middleware gloss = code that runs around every handler (detail in 29). `r.Run(":8080")` starts server (blocks, returns error) — fine for learning; topic 34 replaces it with http.Server for timeouts.
- Analogy: a car with seatbelt and dashcam fitted (Default) vs bare chassis where you fit your own (New).
- Code example: main.go — `r := gin.Default()`; GET /ping → JSON; `log.Fatal(r.Run(":8080"))`; curl → `{"message":"pong"}`; terminal shows a `[GIN]` log line containing `200` and `"/ping"` (don't quote full line: timing varies)
- Production use: gin.New + chosen middleware (slog logger, topic 34); Default for quick start.
- Common mistakes: gin.Default() + adding Logger again → double log lines; ignoring Run's error.
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#Default ; https://pkg.go.dev/github.com/gin-gonic/gin#New ; https://pkg.go.dev/github.com/gin-gonic/gin#Engine.Run

### Routes and HTTP methods
- Concept: `r.GET/POST/PUT/PATCH/DELETE(path, handler)`; handler type `gin.HandlerFunc` = `func(*gin.Context)`; named handler funcs over anonymous for readability; recap methods: GET read, POST create, PUT replace, PATCH partial update, DELETE remove.
- Analogy: reception desk with labelled windows: same building (path), different windows per request type (method).
- Code example: routes.go — in-memory `users := map[string]string{"1": "Ada"}`; `GET /users` → `{"users":{"1":"Ada"}}`; `POST /users` → 201 `{"status":"created"}`; `DELETE /users` → 204 no body (c.Status(http.StatusNoContent)). (Path params come in 27; keep paths static.) Note map is not goroutine-safe — fine for demo, real apps use a DB or mutex (topic 16).
- Production use: REST-style resource routes.
- Common mistakes: registering same method+path twice → panic at startup; using GET for actions that change data.
- Sources: https://gin-gonic.com/en/docs/examples/http-method/ ; https://pkg.go.dev/github.com/gin-gonic/gin#RouterGroup.GET

### gin.Context and responses (c.JSON, c.String, gin.H)
- Concept: `*gin.Context` = one request's everything: `c.Request` (*http.Request), `c.Writer`, helpers; `gin.H` = shorthand for `map[string]any`; `c.JSON(code, obj)` sets Content-Type `application/json; charset=utf-8` + marshals (struct with json tags works, topic 19); `c.String(code, format, args...)` → text/plain; `c.Status(code)` no body; `c.IndentedJSON` named (debug only, costs CPU). Write the response once.
- Analogy: a waiter's order pad for one table: holds the order (request) and is how the dish goes back (response).
- Code example: respond.go — `type User struct{ ID int `json:"id"`; Name string `json:"name"` }`; GET /user → `c.JSON(200, User{ID: 1, Name: "Ada"})` → `{"id":1,"name":"Ada"}`; GET /hello → `c.String(200, "hello %s", "Ada")` → `hello Ada`
- Production use: struct responses (typed) over gin.H for public API shapes.
- Common mistakes: calling c.JSON twice (second write appended/garbled, status warning); forgetting `return` after writing an error response so code continues.
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#Context.JSON ; https://pkg.go.dev/github.com/gin-gonic/gin#H ; https://gin-gonic.com/en/docs/examples/rendering/

### Debug vs release mode
- Concept: default debug mode prints `[GIN-debug]` lines (each route registered, warnings); release mode silences them; set via env `GIN_MODE=release` or `gin.SetMode(gin.ReleaseMode)` before creating engine; `gin.TestMode` for tests (topic 33). Env var syntax bash/PowerShell taught in 23.
- Analogy: workshop with lights on and labels showing (debug) vs showroom (release).
- Code example: mode.go — `gin.SetMode(gin.ReleaseMode)` then `gin.Default()` + route → startup prints no `[GIN-debug]` lines; without it startup prints lines like `[GIN-debug] GET    /ping  --> main.main.func1 (3 handlers)` (say "a line like"; spacing varies); `fmt.Println(gin.Mode())` → `release`
- Production use: GIN_MODE=release in Dockerfile/deploy env (topic 34).
- Common mistakes: shipping debug mode (noisy logs); calling SetMode after routes are registered and expecting earlier debug lines to vanish.
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#SetMode ; https://gin-gonic.com/en/docs/deployment/

## Quiz
1. What does gin.Default add over gin.New? — tests Logger+Recovery
2. What is gin.H? — tests map[string]any shorthand
3. Signature of a Gin handler — tests gin.HandlerFunc
4. How to switch to release mode — tests GIN_MODE / SetMode
5. Is a Gin engine usable with net/http tools? — tests engine as http.Handler
