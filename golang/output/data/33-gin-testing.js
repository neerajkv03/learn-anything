window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "33-gin-testing",
  "order": 33,
  "title": "Testing Gin Apps",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Test a Gin API without starting a server: the standard library's httptest package fakes the request and records the response in memory. You will test handlers, a table of cases, middleware on its own, and handlers backed by a hand-written fake repository instead of a real database.",
  "prerequisites": ["32-gin-database", "20-testing"],
  "subtopics": [
    {
      "id": "testmode-and-recorder",
      "title": "gin.TestMode and httptest.NewRecorder",
      "explanation": "Topic 20 showed how to write tests with the testing package. To test a web API you would normally have to start the server, pick a port and send real network requests. Go avoids that with net/http/httptest, a standard-library package of helpers that fake an HTTP request and record the response in memory. There is no network and no port, so tests are fast and cannot clash with each other.\n\nThree pieces do the work. httptest.NewRequest(method, target, body) builds a fake incoming request. It panics (stops the program with an error) on bad input such as an invalid method, which is fine in a test because a typo should fail loudly. httptest.NewRecorder() returns a recorder: a fake http.ResponseWriter (the object a handler writes its response to) that remembers what was written. Afterwards you read w.Code (the status code), w.Body.String() (the body as text) and w.Header() (the response headers).\n\nThe third piece is the router itself. In topic 21 you saw that anything with a ServeHTTP(w, req) method is an http.Handler, and a Gin engine (the value gin.New() returns) is one. Calling r.ServeHTTP(w, req) pushes the fake request through the real router and into your handler.\n\nFor this to work, the code that builds the routes must live in a function that tests can call. Put the routes in setupRouter() and have main call it too. If you register routes inside main(), tests cannot reuse them.\n\nAlso call gin.SetMode(gin.TestMode) once (topic 26 introduced modes). Test mode silences the [GIN-debug] lines that Gin would otherwise print for every route. The natural place is TestMain, a special function: when a package defines func TestMain(m *testing.M), go test runs it instead of running tests directly. m.Run() runs all the tests and returns an exit code, and os.Exit passes that code on.\n\nSetup, done once by hand: open a terminal in an empty parent folder and run the commands in the first code block below; the mkdir and cd lines create and enter userapi, so do not create that folder by hand. They also create a module (topic 1). Then save the two Go files next to each other. Run the tests with go test ./... (the ./... pattern means every package under the current folder).",
      "analogy": "A flight simulator. The pilot uses the real controls (your router and handlers) and sees real instrument readings (the recorder), but there is no real plane and no real sky (no server and no network). You can practise as often as you like without leaving the ground.",
      "code": [
        {
          "language": "bash",
          "filename": "setup.sh",
          "source": "mkdir userapi\ncd userapi\ngo mod init example.com/userapi\ngo get github.com/gin-gonic/gin@v1.12.0",
          "output": "go: creating new go.mod: module example.com/userapi\ngo: added github.com/gin-gonic/gin v1.12.0",
          "explanation": "Creates the folder, turns it into a Go module and adds Gin. Go prints extra lines for Gin's own dependencies; only the two shown matter here."
        },
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"log/slog\"\n\t\"os\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\n// setupRouter builds the router. main and the tests both call it.\nfunc setupRouter() *gin.Engine {\n\tr := gin.New()\n\tr.GET(\"/ping\", func(c *gin.Context) {\n\t\tc.JSON(200, gin.H{\"message\": \"pong\"})\n\t})\n\treturn r\n}\n\nfunc main() {\n\tif err := setupRouter().Run(\":8080\"); err != nil {\n\t\tslog.Error(\"server stopped\", \"err\", err)\n\t\tos.Exit(1)\n\t}\n}\n",
          "output": "",
          "explanation": "The routes live in setupRouter, which returns the engine. main only starts the server. This file is not run for the tests; it just shows the split that makes testing possible."
        },
        {
          "language": "go",
          "filename": "ping_test.go",
          "source": "package main\n\nimport (\n\t\"net/http\"\n\t\"net/http/httptest\"\n\t\"os\"\n\t\"testing\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc TestMain(m *testing.M) {\n\tgin.SetMode(gin.TestMode)\n\tos.Exit(m.Run())\n}\n\nfunc TestPing(t *testing.T) {\n\tr := setupRouter()\n\tw := httptest.NewRecorder()\n\treq := httptest.NewRequest(http.MethodGet, \"/ping\", nil)\n\n\tr.ServeHTTP(w, req)\n\n\tif w.Code != http.StatusOK {\n\t\tt.Fatalf(\"status: got %d, want %d\", w.Code, http.StatusOK)\n\t}\n\tif got, want := w.Body.String(), `{\"message\":\"pong\"}`; got != want {\n\t\tt.Errorf(\"body: got %q, want %q\", got, want)\n\t}\n\tif got, want := w.Header().Get(\"Content-Type\"), \"application/json; charset=utf-8\"; got != want {\n\t\tt.Errorf(\"content type: got %q, want %q\", got, want)\n\t}\n}\n",
          "output": "ok  \texample.com/userapi\t0.012s",
          "explanation": "TestMain switches Gin to test mode. TestPing builds the router, sends a fake GET /ping and checks the status code, the body and the Content-Type header. t.Fatalf stops the test at once (the later checks would be meaningless if the status is wrong). The time at the end of the ok line varies from run to run."
        }
      ],
      "productionNote": "Recorder-based tests need no ports, so they are fast and safe to run in CI (continuous integration: a server that runs your tests on every change). They can also run in parallel without clashing over a port number.",
      "commonMistakes": [
        "Calling r.Run in a test. Run starts a real server and blocks forever, so the test hangs. Use r.ServeHTTP with a recorder instead.",
        "Registering routes inside main(). Tests cannot call main, so they cannot reach the routes. Move them into a setupRouter function.",
        "Forgetting gin.SetMode(gin.TestMode). Tests still pass, but the output fills with [GIN-debug] lines."
      ],
      "sources": [
        { "title": "Gin: Testing", "url": "https://gin-gonic.com/en/docs/testing/" },
        { "title": "httptest.NewRecorder", "url": "https://pkg.go.dev/net/http/httptest#NewRecorder" },
        { "title": "httptest.NewRequest", "url": "https://pkg.go.dev/net/http/httptest#NewRequest" }
      ]
    },
    {
      "id": "servehttp-handler-tests",
      "title": "router.ServeHTTP for handler tests",
      "explanation": "Because the engine is an http.Handler, r.ServeHTTP(w, req) runs the whole chain: routing, middleware (functions that run before a handler, topic 29), JSON binding (topic 28) and the handler. One test therefore covers all of those working together.\n\nTo test a POST with a JSON body, give httptest.NewRequest a body reader. strings.NewReader(`{\"name\":\"Ada\"}`) turns a string into the io.Reader (topic 18) the request needs. Then set the header with req.Header.Set(\"Content-Type\", \"application/json\"), as a real client would.\n\nDo not compare the response as a raw string. JSON field order and whitespace can change without the meaning changing. Decode the body with json.Unmarshal (topic 19) into a struct and compare the struct.\n\nThe example file below is self-contained: the code under test sits at the top, then the test. It uses package userapi so that it needs no main function. Use a new empty folder: run go mod init example.com/userapi and go get github.com/gin-gonic/gin@v1.12.0 in it, then save this file there. Do not keep main.go or ping_test.go from the first sub-topic in that folder. The handler talks to a UserRepo, an interface (topic 10) like the one from topic 32. The test supplies fakeRepo, a hand-written stand-in that keeps nothing on disk and hands out IDs 1, 2, 3...\n\nOne more tool exists: gin.CreateTestContext(w) returns a *gin.Context and an engine without any routing, so you can call a single handler function directly. You will rarely need it, because going through ServeHTTP tests more of the real behaviour.",
      "analogy": "Posting a test letter through the real sorting office instead of carrying it by hand to one desk. The letter passes every stage a real one would (routing, checks, delivery), so if anything in the chain is broken, you find out.",
      "code": [
        {
          "language": "go",
          "filename": "create_test.go",
          "source": "package userapi\n\nimport (\n\t\"context\"\n\t\"encoding/json\"\n\t\"net/http\"\n\t\"net/http/httptest\"\n\t\"os\"\n\t\"strings\"\n\t\"testing\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\n// ---- code under test ----\n\ntype User struct {\n\tID   int64  `json:\"id\"`\n\tName string `json:\"name\"`\n}\n\ntype createUserRequest struct {\n\tName string `json:\"name\" binding:\"required\"`\n}\n\ntype UserRepo interface {\n\tCreate(ctx context.Context, name string) (User, error)\n}\n\nfunc newRouter(repo UserRepo) *gin.Engine {\n\tr := gin.New()\n\tv1 := r.Group(\"/api/v1\")\n\tv1.POST(\"/users\", func(c *gin.Context) {\n\t\tvar req createUserRequest\n\t\tif err := c.ShouldBindJSON(&req); err != nil {\n\t\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": \"invalid request\"})\n\t\t\treturn\n\t\t}\n\t\tu, err := repo.Create(c.Request.Context(), req.Name)\n\t\tif err != nil {\n\t\t\tc.JSON(http.StatusInternalServerError, gin.H{\"error\": \"internal error\"})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusCreated, u)\n\t})\n\treturn r\n}\n\n// ---- test helpers ----\n\ntype fakeRepo struct {\n\tnextID int64\n}\n\nfunc (f *fakeRepo) Create(ctx context.Context, name string) (User, error) {\n\tf.nextID++\n\treturn User{ID: f.nextID, Name: name}, nil\n}\n\nfunc TestMain(m *testing.M) {\n\tgin.SetMode(gin.TestMode)\n\tos.Exit(m.Run())\n}\n\n// ---- the test ----\n\nfunc TestCreateUser(t *testing.T) {\n\tr := newRouter(&fakeRepo{})\n\n\tbody := strings.NewReader(`{\"name\":\"Ada\"}`)\n\treq := httptest.NewRequest(http.MethodPost, \"/api/v1/users\", body)\n\treq.Header.Set(\"Content-Type\", \"application/json\")\n\tw := httptest.NewRecorder()\n\n\tr.ServeHTTP(w, req)\n\n\tif w.Code != http.StatusCreated {\n\t\tt.Fatalf(\"status: got %d, want %d\", w.Code, http.StatusCreated)\n\t}\n\tvar got User\n\tif err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {\n\t\tt.Fatalf(\"decode body %q: %v\", w.Body.String(), err)\n\t}\n\twant := User{ID: 1, Name: \"Ada\"}\n\tif got != want {\n\t\tt.Errorf(\"body: got %+v, want %+v\", got, want)\n\t}\n}\n",
          "output": "=== RUN   TestCreateUser\n--- PASS: TestCreateUser (0.00s)\nPASS\nok  \texample.com/userapi\t0.015s",
          "explanation": "Run with go test -v. The request travels through the router group, JSON binding and the handler into fakeRepo, which returns ID 1. The test decodes the response into a User and compares it with the expected value using !=, which works because User's fields are all comparable (topic 8). Timings in the output vary."
        }
      ],
      "productionNote": "Going through ServeHTTP means one test checks routing, binding, the repository call and the response mapping together. That catches mistakes such as a wrong route path or a missing binding tag that a test of the bare function would miss.",
      "commonMistakes": [
        "Forgetting the Content-Type header on a request with a body. ShouldBindJSON always parses JSON, but ShouldBind chooses its parser from Content-Type, so without the header it fails or picks the wrong one.",
        "Comparing the raw JSON string with ==. A harmless change in field order or spacing breaks the test. Decode and compare values instead.",
        "Ignoring the error from json.Unmarshal. If the body is not valid JSON you will compare an empty struct and get a confusing message."
      ],
      "sources": [
        { "title": "gin.Engine.ServeHTTP", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Engine.ServeHTTP" },
        { "title": "Gin: Testing", "url": "https://gin-gonic.com/en/docs/testing/" }
      ]
    },
    {
      "id": "table-driven-api-tests",
      "title": "Table-driven API tests",
      "explanation": "Topic 20 introduced table-driven tests: a slice (list) of cases, each with an input and the expected result, and a loop that runs them all. This suits APIs well, because most endpoints need several requests: one valid, and several invalid in different ways.\n\nEach case is a struct with a name, a request body and the status code you expect. The loop calls t.Run(tt.name, func(t *testing.T) { ... }), which creates a subtest. A subtest reports its own pass or fail, and you can run just one with -run. Go replaces spaces in subtest names with underscores, so the case \"missing name\" is reported as missing_name.\n\nBuild a fresh router (and a fresh fake, if you use one) inside each subtest. Cases that share state can pass or fail depending on the order they run in, which is hard to debug.\n\nThe function t.Parallel() inside a subtest lets subtests run at the same time. It is optional and only worth it for slow tests. Since Go 1.22 each loop iteration has its own tt variable, so using tt inside the closure is safe; older advice about copying it no longer applies.\n\nAs before, the code under test is at the top of the file, and the package is userapi. Use a new empty folder: run go mod init example.com/userapi and go get github.com/gin-gonic/gin@v1.12.0 in it, then save this file there.",
      "analogy": "A checklist of inspections that an inspector runs the same way on every item. Adding a new item is one line on the list; the inspection procedure does not change.",
      "code": [
        {
          "language": "go",
          "filename": "table_test.go",
          "source": "package userapi\n\nimport (\n\t\"net/http\"\n\t\"net/http/httptest\"\n\t\"os\"\n\t\"strings\"\n\t\"testing\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\n// ---- code under test ----\n\ntype createUserRequest struct {\n\tName  string `json:\"name\" binding:\"required\"`\n\tEmail string `json:\"email\" binding:\"required,email\"`\n}\n\nfunc newRouter() *gin.Engine {\n\tr := gin.New()\n\tr.POST(\"/api/v1/users\", func(c *gin.Context) {\n\t\tvar req createUserRequest\n\t\tif err := c.ShouldBindJSON(&req); err != nil {\n\t\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": \"invalid request\"})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusCreated, gin.H{\"name\": req.Name, \"email\": req.Email})\n\t})\n\treturn r\n}\n\nfunc TestMain(m *testing.M) {\n\tgin.SetMode(gin.TestMode)\n\tos.Exit(m.Run())\n}\n\n// ---- the test ----\n\nfunc TestCreateUser(t *testing.T) {\n\ttests := []struct {\n\t\tname     string\n\t\tbody     string\n\t\twantCode int\n\t}{\n\t\t{name: \"valid\", body: `{\"name\":\"Ada\",\"email\":\"ada@example.com\"}`, wantCode: http.StatusCreated},\n\t\t{name: \"missing name\", body: `{\"email\":\"ada@example.com\"}`, wantCode: http.StatusBadRequest},\n\t\t{name: \"bad email\", body: `{\"name\":\"Ada\",\"email\":\"x\"}`, wantCode: http.StatusBadRequest},\n\t\t{name: \"bad json\", body: `{`, wantCode: http.StatusBadRequest},\n\t}\n\n\tfor _, tt := range tests {\n\t\tt.Run(tt.name, func(t *testing.T) {\n\t\t\tr := newRouter()\n\t\t\treq := httptest.NewRequest(http.MethodPost, \"/api/v1/users\", strings.NewReader(tt.body))\n\t\t\treq.Header.Set(\"Content-Type\", \"application/json\")\n\t\t\tw := httptest.NewRecorder()\n\n\t\t\tr.ServeHTTP(w, req)\n\n\t\t\tif w.Code != tt.wantCode {\n\t\t\t\tt.Errorf(\"status: got %d, want %d (body %s)\", w.Code, tt.wantCode, w.Body.String())\n\t\t\t}\n\t\t})\n\t}\n}\n",
          "output": "=== RUN   TestCreateUser\n=== RUN   TestCreateUser/valid\n=== RUN   TestCreateUser/missing_name\n=== RUN   TestCreateUser/bad_email\n=== RUN   TestCreateUser/bad_json\n--- PASS: TestCreateUser (0.00s)\n    --- PASS: TestCreateUser/valid (0.00s)\n    --- PASS: TestCreateUser/missing_name (0.00s)\n    --- PASS: TestCreateUser/bad_email (0.00s)\n    --- PASS: TestCreateUser/bad_json (0.00s)\nPASS\nok  \texample.com/userapi\t0.014s",
          "explanation": "Run with go test -run TestCreateUser -v. Four cases share one test body. The binding tags require a name and a valid email, and the unfinished JSON { fails to parse, so all three bad cases give 400. Timings vary."
        }
      ],
      "productionNote": "A table grows with your bugs: when a bug is reported, add one row that reproduces it, watch it fail, then fix the code. The row stays forever as a regression test (a test that stops an old bug coming back).",
      "commonMistakes": [
        "Sharing one router or fake between cases, so an earlier case changes the result of a later one. Create them inside t.Run.",
        "Giving every case the same name, or an empty one, which makes failures hard to tell apart. Name each case after what it checks.",
        "Worrying that the closure sees the wrong tt (the loop variable). Since Go 1.22 each iteration has its own tt, so the closure inside t.Run is safe as written."
      ],
      "sources": [
        { "title": "Go wiki: Table-driven tests", "url": "https://go.dev/wiki/TableDrivenTests" },
        { "title": "testing.T.Run", "url": "https://pkg.go.dev/testing#T.Run" }
      ]
    },
    {
      "id": "testing-middleware",
      "title": "Testing middleware",
      "explanation": "Middleware runs before the handlers of every route it is attached to, so a bug in it affects the whole API. That makes it the best-value code to test. You do not need your real routes: build a tiny router with gin.New(), attach only the middleware with r.Use, and add one trivial handler that returns the text ok. Then the only thing under test is the middleware.\n\nTest both outcomes. The pass path: the request is allowed, the handler runs and the status is 200. The abort path: the middleware stops the chain (topic 29) with the right status, and the handler must not run. A boolean variable that the handler sets to true lets the test prove it never ran.\n\nThe example below tests two middlewares from earlier topics. AuthRequired (topic 31) rejects requests that lack a valid JWT, a signed token that proves who the caller is. RequestID (topic 29) copies the incoming X-Request-ID header to the response, or creates a new ID if the header is missing.\n\nTwo details matter. First, AuthRequired takes its secret as an argument instead of reading an environment variable, so a test can pass a fake secret and never touches real credentials. Second, the test issues its own token with the same jwt calls you used in topic 31.\n\nBefore running, add the JWT library to your module with go get github.com/golang-jwt/jwt/v5@v5.3.1. As before, use a fresh folder or remove earlier files with clashing names.",
      "analogy": "Testing a turnstile with one valid ticket and one invalid one. A valid ticket must let you through, an invalid one must keep the bar locked. Checking only the valid ticket would never reveal a turnstile that lets everyone in.",
      "code": [
        {
          "language": "go",
          "filename": "auth_test.go",
          "source": "package userapi\n\nimport (\n\t\"crypto/rand\"\n\t\"net/http\"\n\t\"net/http/httptest\"\n\t\"os\"\n\t\"strings\"\n\t\"testing\"\n\t\"time\"\n\n\t\"github.com/gin-gonic/gin\"\n\t\"github.com/golang-jwt/jwt/v5\"\n)\n\n// ---- code under test ----\n\nfunc AuthRequired(secret []byte) gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\traw, ok := strings.CutPrefix(c.Request.Header.Get(\"Authorization\"), \"Bearer \")\n\t\tif !ok {\n\t\t\tc.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{\"error\": \"missing token\"})\n\t\t\treturn\n\t\t}\n\t\tkeyFunc := func(t *jwt.Token) (any, error) { return secret, nil }\n\t\t_, err := jwt.ParseWithClaims(raw, &jwt.RegisteredClaims{}, keyFunc,\n\t\t\tjwt.WithValidMethods([]string{\"HS256\"}))\n\t\tif err != nil {\n\t\t\tc.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{\"error\": \"invalid token\"})\n\t\t\treturn\n\t\t}\n\t\tc.Next()\n\t}\n}\n\nfunc RequestID() gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tid := c.Request.Header.Get(\"X-Request-ID\")\n\t\tif id == \"\" {\n\t\t\tid = rand.Text()\n\t\t}\n\t\tc.Header(\"X-Request-ID\", id)\n\t\tc.Next()\n\t}\n}\n\n// ---- test helpers ----\n\nconst testSecret = \"test-secret-not-real\"\n\nfunc TestMain(m *testing.M) {\n\tgin.SetMode(gin.TestMode)\n\tos.Exit(m.Run())\n}\n\n// serve sends GET /t through a router that has only mw and one trivial handler.\n// It returns the recorded response and whether the handler ran.\nfunc serve(mw gin.HandlerFunc, header, value string) (*httptest.ResponseRecorder, bool) {\n\tran := false\n\tr := gin.New()\n\tr.Use(mw)\n\tr.GET(\"/t\", func(c *gin.Context) {\n\t\tran = true\n\t\tc.String(http.StatusOK, \"ok\")\n\t})\n\n\treq := httptest.NewRequest(http.MethodGet, \"/t\", nil)\n\tif header != \"\" {\n\t\treq.Header.Set(header, value)\n\t}\n\tw := httptest.NewRecorder()\n\tr.ServeHTTP(w, req)\n\treturn w, ran\n}\n\nfunc issueToken(t *testing.T, secret string) string {\n\tt.Helper()\n\tclaims := jwt.RegisteredClaims{\n\t\tSubject:   \"1\",\n\t\tExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),\n\t}\n\ts, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))\n\tif err != nil {\n\t\tt.Fatalf(\"sign token: %v\", err)\n\t}\n\treturn s\n}\n\n// ---- the tests ----\n\nfunc TestAuthRequired_NoHeader(t *testing.T) {\n\tw, ran := serve(AuthRequired([]byte(testSecret)), \"\", \"\")\n\tif w.Code != http.StatusUnauthorized {\n\t\tt.Errorf(\"status: got %d, want %d\", w.Code, http.StatusUnauthorized)\n\t}\n\tif ran {\n\t\tt.Error(\"handler ran although the request was rejected\")\n\t}\n}\n\nfunc TestAuthRequired_ValidToken(t *testing.T) {\n\ttoken := issueToken(t, testSecret)\n\tw, ran := serve(AuthRequired([]byte(testSecret)), \"Authorization\", \"Bearer \"+token)\n\tif w.Code != http.StatusOK || w.Body.String() != \"ok\" {\n\t\tt.Errorf(\"got %d %q, want 200 \\\"ok\\\"\", w.Code, w.Body.String())\n\t}\n\tif !ran {\n\t\tt.Error(\"handler did not run for a valid token\")\n\t}\n}\n\nfunc TestAuthRequired_WrongSecret(t *testing.T) {\n\ttoken := issueToken(t, \"some-other-secret\")\n\tw, ran := serve(AuthRequired([]byte(testSecret)), \"Authorization\", \"Bearer \"+token)\n\tif w.Code != http.StatusUnauthorized {\n\t\tt.Errorf(\"status: got %d, want %d\", w.Code, http.StatusUnauthorized)\n\t}\n\tif ran {\n\t\tt.Error(\"handler ran for a token signed with the wrong secret\")\n\t}\n}\n\nfunc TestRequestID_KeepsIncoming(t *testing.T) {\n\tw, _ := serve(RequestID(), \"X-Request-ID\", \"abc123\")\n\tif got := w.Header().Get(\"X-Request-ID\"); got != \"abc123\" {\n\t\tt.Errorf(\"X-Request-ID: got %q, want %q\", got, \"abc123\")\n\t}\n}\n",
          "output": "=== RUN   TestAuthRequired_NoHeader\n--- PASS: TestAuthRequired_NoHeader (0.00s)\n=== RUN   TestAuthRequired_ValidToken\n--- PASS: TestAuthRequired_ValidToken (0.00s)\n=== RUN   TestAuthRequired_WrongSecret\n--- PASS: TestAuthRequired_WrongSecret (0.00s)\n=== RUN   TestRequestID_KeepsIncoming\n--- PASS: TestRequestID_KeepsIncoming (0.00s)\nPASS\nok  \texample.com/userapi\t0.021s",
          "explanation": "Run with go test -v. The helper serve builds the tiny router and reports whether the handler ran. Three auth tests cover the missing header, a valid token and a token signed with the wrong secret. The last test checks that a response header copies the incoming request ID. Timings vary."
        }
      ],
      "productionNote": "Every route passes through your middleware, so one small test file protects the whole API. Always give the middleware its secrets and settings as function arguments. Tests then use fake values and never need real credentials or environment variables.",
      "commonMistakes": [
        "Testing only the happy path. A middleware that lets every request through would still pass. Always add a test where the request must be rejected and check that the handler did not run.",
        "Reading the real secret from an environment variable inside the middleware. Tests then depend on the machine they run on. Pass the secret in as an argument.",
        "Testing the middleware through the full application router. A failure then could come from any route. A tiny router isolates the cause."
      ],
      "sources": [
        { "title": "gin.Engine.Use", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Engine.Use" },
        { "title": "httptest.ResponseRecorder", "url": "https://pkg.go.dev/net/http/httptest#ResponseRecorder" }
      ]
    },
    {
      "id": "fake-repository",
      "title": "Fake repository via interface",
      "explanation": "In topic 32 the handlers talk to a repository (the code that reads and writes the database) through an interface. That pays off in tests: instead of a real PostgreSQL server, you hand the handler a fake, a small hand-written type that satisfies the same interface but keeps its data in a map in memory.\n\nThe fake in the example has two fields. users is a map of the users it holds. err is an error that, when set, makes every call fail. Setting err to errors.New(\"db down\") lets you check the failure path, which is hard to trigger with a real database. A missing user must return the same ErrNotFound sentinel (topic 11) the real repository returns, so the handler maps it to 404 exactly as in production.\n\nThe test is table-driven with three cases: user 1 exists (200), user 99 does not (404 with error code not_found), and the database is down (500 with code internal). The 500 case also checks that the response does not contain the text db down, because internal error messages must not leak to clients (topic 30).\n\nHandler tests with a fake run in milliseconds and give the same result every time. The real repository still needs testing against a real database, but separately, in a smaller number of integration tests (tests that use real external systems). Mark them so they can be skipped: testing.Short() reports whether the -short flag was passed, and t.Skip marks the test as skipped. The second file below shows the pattern; go test -short skips it, and plain go test runs it.\n\nFor a repository with only a few methods, a hand-written fake is simpler than a mocking library, which generates fakes from a description. The risk of a hand-written fake is drifting away from the real behaviour, so make sure it returns the same errors as the real one.\n\nUse a new empty folder with go mod init example.com/userapi and go get github.com/gin-gonic/gin@v1.12.0, then save fake_test.go there.",
      "analogy": "A crash-test dummy. It has the same shape as a real passenger, so the car behaves as it would with a person, but you can crash it as often as you like and nobody gets hurt. You can even tell it to fail on purpose.",
      "code": [
        {
          "language": "go",
          "filename": "fake_test.go",
          "source": "package userapi\n\nimport (\n\t\"context\"\n\t\"encoding/json\"\n\t\"errors\"\n\t\"net/http\"\n\t\"net/http/httptest\"\n\t\"os\"\n\t\"strconv\"\n\t\"strings\"\n\t\"testing\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\n// ---- code under test ----\n\nvar ErrNotFound = errors.New(\"not found\")\n\ntype User struct {\n\tID   int64  `json:\"id\"`\n\tName string `json:\"name\"`\n}\n\ntype UserRepo interface {\n\tGet(ctx context.Context, id int64) (User, error)\n}\n\nfunc writeError(c *gin.Context, status int, code, msg string) {\n\tc.JSON(status, gin.H{\"error\": gin.H{\"code\": code, \"message\": msg}})\n}\n\nfunc newRouter(repo UserRepo) *gin.Engine {\n\tr := gin.New()\n\tr.GET(\"/api/v1/users/:id\", func(c *gin.Context) {\n\t\tid, err := strconv.ParseInt(c.Param(\"id\"), 10, 64)\n\t\tif err != nil {\n\t\t\twriteError(c, http.StatusBadRequest, \"bad_request\", \"id must be a number\")\n\t\t\treturn\n\t\t}\n\t\tu, err := repo.Get(c.Request.Context(), id)\n\t\tswitch {\n\t\tcase errors.Is(err, ErrNotFound):\n\t\t\twriteError(c, http.StatusNotFound, \"not_found\", \"user not found\")\n\t\tcase err != nil:\n\t\t\twriteError(c, http.StatusInternalServerError, \"internal\", \"internal error\")\n\t\tdefault:\n\t\t\tc.JSON(http.StatusOK, u)\n\t\t}\n\t})\n\treturn r\n}\n\n// ---- the fake ----\n\ntype fakeRepo struct {\n\tusers map[int64]User\n\terr   error // when set, every call fails with it\n}\n\nfunc (f *fakeRepo) Get(ctx context.Context, id int64) (User, error) {\n\tif f.err != nil {\n\t\treturn User{}, f.err\n\t}\n\tu, ok := f.users[id]\n\tif !ok {\n\t\treturn User{}, ErrNotFound\n\t}\n\treturn u, nil\n}\n\nfunc TestMain(m *testing.M) {\n\tgin.SetMode(gin.TestMode)\n\tos.Exit(m.Run())\n}\n\n// ---- the test ----\n\nfunc TestGetUser(t *testing.T) {\n\ttests := []struct {\n\t\tname     string\n\t\tpath     string\n\t\trepoErr  error\n\t\twantCode int\n\t\twantErr  string // expected error code in the JSON, \"\" for success\n\t}{\n\t\t{name: \"found\", path: \"/api/v1/users/1\", wantCode: http.StatusOK},\n\t\t{name: \"not found\", path: \"/api/v1/users/99\", wantCode: http.StatusNotFound, wantErr: \"not_found\"},\n\t\t{name: \"db down\", path: \"/api/v1/users/1\", repoErr: errors.New(\"db down\"), wantCode: http.StatusInternalServerError, wantErr: \"internal\"},\n\t}\n\n\tfor _, tt := range tests {\n\t\tt.Run(tt.name, func(t *testing.T) {\n\t\t\trepo := &fakeRepo{\n\t\t\t\tusers: map[int64]User{1: {ID: 1, Name: \"Ada\"}},\n\t\t\t\terr:   tt.repoErr,\n\t\t\t}\n\t\t\tw := httptest.NewRecorder()\n\t\t\tnewRouter(repo).ServeHTTP(w, httptest.NewRequest(http.MethodGet, tt.path, nil))\n\n\t\t\tif w.Code != tt.wantCode {\n\t\t\t\tt.Fatalf(\"status: got %d, want %d\", w.Code, tt.wantCode)\n\t\t\t}\n\t\t\tvar body struct {\n\t\t\t\tID    int64  `json:\"id\"`\n\t\t\t\tName  string `json:\"name\"`\n\t\t\t\tError struct {\n\t\t\t\t\tCode string `json:\"code\"`\n\t\t\t\t} `json:\"error\"`\n\t\t\t}\n\t\t\tif err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {\n\t\t\t\tt.Fatalf(\"decode body %q: %v\", w.Body.String(), err)\n\t\t\t}\n\t\t\tif body.Error.Code != tt.wantErr {\n\t\t\t\tt.Errorf(\"error code: got %q, want %q\", body.Error.Code, tt.wantErr)\n\t\t\t}\n\t\t\tif tt.wantCode == http.StatusOK && (body.ID != 1 || body.Name != \"Ada\") {\n\t\t\t\tt.Errorf(\"user: got id=%d name=%q, want id=1 name=%q\", body.ID, body.Name, \"Ada\")\n\t\t\t}\n\t\t\tif strings.Contains(w.Body.String(), \"db down\") {\n\t\t\t\tt.Errorf(\"response leaks the internal error: %s\", w.Body.String())\n\t\t\t}\n\t\t})\n\t}\n}\n",
          "output": "=== RUN   TestGetUser\n=== RUN   TestGetUser/found\n=== RUN   TestGetUser/not_found\n=== RUN   TestGetUser/db_down\n--- PASS: TestGetUser (0.00s)\n    --- PASS: TestGetUser/found (0.00s)\n    --- PASS: TestGetUser/not_found (0.00s)\n    --- PASS: TestGetUser/db_down (0.00s)\nPASS\nok  \texample.com/userapi\t0.016s",
          "explanation": "Run with go test -v. The fake holds user 1 (Ada). The three cases check a hit (200), a miss (404, not_found) and a forced failure (500, internal) without any database. Timings vary."
        },
        {
          "language": "go",
          "filename": "integration_test.go",
          "source": "package userapi\n\nimport \"testing\"\n\nfunc TestUserRepoIntegration(t *testing.T) {\n\tif testing.Short() {\n\t\tt.Skip(\"skipping integration test in -short mode\")\n\t}\n\t// A real test would connect to a test PostgreSQL database here.\n}\n",
          "output": "=== RUN   TestUserRepoIntegration\n    integration_test.go:7: skipping integration test in -short mode\n--- SKIP: TestUserRepoIntegration (0.00s)\nPASS\nok  \texample.com/userapi\t0.003s",
          "explanation": "This is the pattern for slow tests that need a real database. Run with go test -short -v -run Integration to see the skip; without -short the test body runs. Add it to the same folder as fake_test.go; it declares nothing that clashes. Timings vary."
        }
      ],
      "productionNote": "Aim for many fast handler tests with a fake, and a few slower integration tests that run the real repository against a real database. In CI, run go test -short on every change and the full suite less often or in a separate job.",
      "commonMistakes": [
        "Pulling in a mocking framework for an interface with two or three methods. A hand-written fake is shorter and easier to read.",
        "Letting the fake drift from the real repository, for example returning an empty result instead of ErrNotFound. Handler tests then pass while production behaves differently. Keep the fake's errors identical to the real ones.",
        "Only testing the success path of the fake. Use the err field to force failures and check the status code and that no internal message leaks."
      ],
      "sources": [
        { "title": "Go tutorial: Add a test", "url": "https://go.dev/doc/tutorial/add-a-test" },
        { "title": "testing: Skipping", "url": "https://pkg.go.dev/testing#hdr-Skipping" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "In a Gin handler test, what does httptest.NewRecorder() replace?",
      "options": [
        "The router, so no routes are needed",
        "The real http.ResponseWriter, by a fake that remembers the status, headers and body",
        "The database connection",
        "The go test command"
      ],
      "answerIndex": 1,
      "explanation": "The recorder is a fake ResponseWriter. The handler writes to it as usual, and the test reads w.Code, w.Header() and w.Body afterwards. The router, the database and go test are still needed."
    },
    {
      "question": "Why should routes be built in a setupRouter function that both main and the tests call?",
      "options": [
        "Tests can build the same router without starting a server, since they cannot call main",
        "It makes Gin run faster in production",
        "go test refuses to run if routes are registered in main",
        "It is the only way to enable test mode"
      ],
      "answerIndex": 0,
      "explanation": "Tests cannot call main(), which also starts the server. A separate function returns the engine so tests can use it with ServeHTTP. Speed and test mode are unrelated, and go test would not refuse to run."
    },
    {
      "question": "Why decode a JSON response with json.Unmarshal instead of comparing the body string with ==?",
      "options": [
        "json.Unmarshal makes the test run faster",
        "Strings cannot be compared in Go",
        "The recorder only returns decoded values",
        "Field order and whitespace can change without the meaning changing, so a string comparison is fragile"
      ],
      "answerIndex": 3,
      "explanation": "Two JSON texts can mean the same thing but differ in spacing or field order. Comparing decoded values checks the meaning. Strings can be compared in Go, and the recorder returns raw bytes."
    },
    {
      "question": "Which two paths should every middleware test cover?",
      "options": [
        "A fast run and a slow run",
        "A test with gin.New() and a test with gin.Default()",
        "One run in debug mode and one in release mode",
        "The pass path (handler runs) and the abort path (right status and handler does not run)"
      ],
      "answerIndex": 3,
      "explanation": "A middleware has to let valid requests through and stop invalid ones. Testing only the pass path would not notice a middleware that lets everything through."
    },
    {
      "question": "Why use a fake repository instead of a real database in handler tests?",
      "options": [
        "Gin cannot talk to a database",
        "Tests are fast and repeatable, and the fake can be told to fail on purpose to test error paths",
        "A fake checks that the SQL is correct",
        "Go forbids network access inside tests"
      ],
      "answerIndex": 1,
      "explanation": "A fake keeps data in memory, so tests run in milliseconds, do not depend on a server and can force errors such as a database outage. It does not check SQL; that is the job of separate integration tests. Gin can use a database, and Go allows network access in tests."
    }
  ]
});
