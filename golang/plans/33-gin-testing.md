# 33. Testing Gin Apps
Version: Go 1.27.4 + Gin v1.12.0
Prerequisites: 32-gin-database, 20-testing

Gloss: `net/http/httptest` (not taught before) = stdlib helpers that fake an HTTP request and record the response in memory — no network, no port.

## Learning goals
- learner can run a Gin router in tests without a server
- learner can assert status code and JSON body
- learner can write table-driven API tests
- learner can test a middleware on its own
- learner can replace the database with a fake repository

## Sub-topics
### gin.TestMode and httptest.NewRecorder
- Concept: `gin.SetMode(gin.TestMode)` once (in `TestMain` named, or init of test file) → quiet output; `w := httptest.NewRecorder()` = fake ResponseWriter: `w.Code`, `w.Body.String()`, `w.Header()`; `req := httptest.NewRequest(http.MethodGet, "/ping", nil)` (panics on bad input — fine in tests); router built by a `setupRouter()` func shared by main and tests.
- Analogy: a flight simulator: real controls (router), no real plane or sky (network).
- Code example: ping_test.go — `TestPing`: setupRouter, GET /ping → `w.Code` == 200, `w.Body.String()` == `{"message":"pong"}`; `go test ./...` → `ok  	example.com/userapi	<time>` (time varies)
- Production use: fast API tests in CI, no ports, run in parallel.
- Common mistakes: starting r.Run in tests; building routes in main() so tests can't reuse them.
- Sources: https://gin-gonic.com/en/docs/testing/ ; https://pkg.go.dev/net/http/httptest#NewRecorder ; https://pkg.go.dev/net/http/httptest#NewRequest

### router.ServeHTTP for handler tests
- Concept: engine is http.Handler → `r.ServeHTTP(w, req)` runs full chain (middleware + routing + binding); POST with body `strings.NewReader(`{"name":"Ada"}`)` + `req.Header.Set("Content-Type", "application/json")`; decode response with json.Unmarshal into struct (topic 19) rather than comparing strings (field order/whitespace safe); `gin.CreateTestContext(w)` named for calling one handler directly (rarely needed).
- Analogy: mailing a test letter through the real sorting office instead of hand-delivering to one desk.
- Code example: create_test.go — POST /api/v1/users `{"name":"Ada"}` with fake repo → `w.Code` 201, decoded `User{ID: 1, Name: "Ada"}`; `t.Fatalf` on mismatch with `got %d, want %d`
- Production use: tests cover routing + binding + mapping together.
- Common mistakes: forgetting Content-Type for form bodies (JSON binding still works via ShouldBindJSON, but ShouldBind needs it); comparing raw JSON strings.
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#Engine.ServeHTTP ; https://gin-gonic.com/en/docs/testing/

### Table-driven API tests
- Concept: `tests := []struct{ name, body string; wantCode int }{...}`; `for _, tt := range tests { t.Run(tt.name, func(t *testing.T){ ... }) }` (topic 20); fresh router + fake per case (isolation); `t.Parallel()` optional.
- Analogy: a checklist of inspections run the same way on each item.
- Code example: table_test.go — cases: `valid` `{"name":"Ada","email":"ada@example.com"}` → 201; `missing name` `{"email":"ada@example.com"}` → 400; `bad email` `{"name":"Ada","email":"x"}` → 400; `bad json` `{` → 400; `go test -run TestCreateUser -v` → `--- PASS: TestCreateUser/valid` etc. (4 sub-tests PASS)
- Production use: one table grows with every bug found.
- Common mistakes: shared state between cases; loop var capture (fixed since Go 1.22 — not an issue now, mention only to reassure).
- Sources: https://go.dev/wiki/TableDrivenTests ; https://pkg.go.dev/testing#T.Run

### Testing middleware
- Concept: build a tiny router: `r := gin.New(); r.Use(mw); r.GET("/t", func(c *gin.Context){ c.String(200, "ok") })`; assert both paths: passes (200, handler ran) and aborts (status, body, handler not run); check headers set by mw.
- Analogy: testing a turnstile with one valid and one invalid ticket.
- Code example: auth_test.go — JWT AuthRequired (31): no header → 401; valid token (issued in test with test secret) → 200 `ok`; RequestID (29): `w.Header().Get("X-Request-ID")` with input `abc123` → `abc123`
- Production use: middleware is shared by every route — highest test value per line.
- Common mistakes: only testing the happy path; reading real secrets from env in tests (pass via constructor).
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#Engine.Use ; https://pkg.go.dev/net/http/httptest#ResponseRecorder

### Fake repository via interface
- Concept: `fakeRepo struct{ users map[int64]User; nextID int64; err error }` implements UserRepo (32); `err` field forces failures (e.g. `errors.New("db down")` → expect 500); no DB needed → fast, deterministic; real DB tested separately in integration tests (named, build tag or `-short` skip).
- Analogy: a crash-test dummy: same shape as a passenger, safe to break.
- Code example: fake_test.go — fake with user 1 Ada: GET /api/v1/users/1 → 200 `{"id":1,"name":"Ada"}`; /users/99 → 404 code `not_found`; fake.err = db down → 500 code `internal`
- Production use: handler tests in milliseconds; DB tests fewer and separate.
- Common mistakes: mocking frameworks for a 3-method interface (hand fake is simpler); fake drifting from real behavior (e.g. not returning ErrNotFound).
- Sources: https://go.dev/doc/tutorial/add-a-test ; https://pkg.go.dev/testing#hdr-Skipping (for -short)

## Quiz
1. What does httptest.NewRecorder replace? — tests fake ResponseWriter
2. Why share setupRouter between main and tests? — tests testability
3. Why decode JSON instead of comparing strings? — tests robust asserts
4. Two cases every middleware test needs — tests pass + abort paths
5. Why a fake repo instead of a real DB in handler tests? — tests isolation/speed
