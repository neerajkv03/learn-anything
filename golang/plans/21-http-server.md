# 21. HTTP Servers
Version: Go 1.27.4
Prerequisites: 20-testing

## Learning goals
- learner can write handlers with net/http
- learner can route by method and path wildcards with ServeMux
- learner can read and write JSON bodies safely
- learner can wrap handlers with middleware
- learner can configure server timeouts and shut down gracefully

## Sub-topics
### net/http handlers
- Concept: HTTP (gloss: request/response protocol of the web; method, path, status code, headers, body); `http.Handler` interface `ServeHTTP(w, r)`; `http.HandlerFunc` adapter; `mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request))`; `http.ListenAndServe(":8080", mux)`; each request in its own goroutine.
- Analogy: restaurant kitchen — the request is the order ticket, ResponseWriter is the plate you serve on.
- Code example: hello server main.go — `mux := http.NewServeMux(); mux.HandleFunc("GET /hello", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "hello") }); log.Fatal(http.ListenAndServe(":8080", mux))`; `curl localhost:8080/hello` → `hello` (gloss curl: command-line HTTP tool; also open in browser)
- Production use: every Go web service/API.
- Common mistakes: using `http.DefaultServeMux` globally in libraries; shared state in handlers without locks (topic 16).
- Sources: https://pkg.go.dev/net/http#Handler ; https://pkg.go.dev/net/http#ServeMux ; https://go.dev/doc/articles/wiki/

### ServeMux routing with methods and path values
- Concept: Go 1.22+ patterns `"GET /users/{id}"`, `r.PathValue("id")`; wrong method → 405 automatically; `{path...}` rest wildcard; `"/"` matches everything not otherwise matched, `"/{$}"` only exact root; most specific pattern wins.
- Analogy: mailroom sorting by floor and room number, and only accepting the right kind of mail at each door.
- Code example: routes.go — `mux.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintf(w, "user %s\n", r.PathValue("id")) })`; `curl localhost:8080/users/42` → `user 42`; `curl -X POST localhost:8080/users/42` → status 405 body `Method Not Allowed`
- Production use: REST routes without third-party routers.
- Common mistakes: forgetting `{$}` so "/" catches every path; trusting path values without validation (convert with strconv.Atoi, 400 on error).
- Sources: https://go.dev/blog/routing-enhancements ; https://pkg.go.dev/net/http#hdr-Patterns-ServeMux ; https://pkg.go.dev/net/http#Request.PathValue

### JSON request and response
- Concept: limit body `r.Body = http.MaxBytesReader(w, r.Body, 1<<20)`; decode with json.NewDecoder (topic 19); set `Content-Type: application/json` header, then `w.WriteHeader(http.StatusCreated)`, then encode; errors with `http.Error(w, msg, code)`; headers must be set before WriteHeader/first Write.
- Analogy: order form in (request JSON), itemized receipt out (response JSON).
- Code example: create.go — `POST /users` decodes `{"name":"Ada"}` into `struct{ Name string \`json:"name"\` }`, empty name → 400 `name is required`; success → 201 `{"id":1,"name":"Ada"}`; curl: `curl -X POST -d '{"name":"Ada"}' localhost:8080/users` (note PowerShell quoting differs; show bash form + mention)
- Production use: JSON APIs.
- Common mistakes: setting headers after WriteHeader (ignored); unbounded body; returning 200 on errors.
- Sources: https://pkg.go.dev/net/http#MaxBytesReader ; https://pkg.go.dev/net/http#ResponseWriter ; https://pkg.go.dev/net/http#Error

### Middleware
- Concept: `func logging(next http.Handler) http.Handler { return http.HandlerFunc(func(w, r) { start := time.Now(); next.ServeHTTP(w, r); log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start)) }) }`; chain by wrapping; common: logging, recovery, auth, request IDs (topic 17 ctx values).
- Analogy: airport security layers — every passenger passes the same checks before reaching the gate.
- Code example: mw.go — wrap mux: `http.ListenAndServe(":8080", logging(mux))`; GET /hello → client sees `hello`; server log line like `GET /hello 52.3µs` (timestamp + duration vary)
- Production use: cross-cutting concerns in one place.
- Common mistakes: forgetting to call next; middleware order confusion (outermost runs first).
- Sources: https://pkg.go.dev/net/http#HandlerFunc ; https://pkg.go.dev/net/http#Handler

### Server timeouts and graceful shutdown
- Concept: `srv := &http.Server{Addr: ":8080", Handler: mux, ReadHeaderTimeout: 5*time.Second, ReadTimeout: 10*time.Second, WriteTimeout: 10*time.Second, IdleTimeout: 60*time.Second}`; `ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)`; run `srv.ListenAndServe()` in a goroutine (ignore `http.ErrServerClosed`); `<-ctx.Done()`; `srv.Shutdown(shutdownCtx)` with 10s timeout finishes in-flight requests.
- Analogy: closing a shop — lock the front door, let customers already inside finish, then turn off the lights.
- Code example: graceful.go — Ctrl+C → logs `shutting down` then `server stopped`
- Production use: containers/Kubernetes send SIGTERM on deploy; no dropped requests.
- Common mistakes: plain `http.ListenAndServe` in production (no timeouts → slowloris); treating ErrServerClosed as a crash.
- Sources: https://pkg.go.dev/net/http#Server ; https://pkg.go.dev/net/http#Server.Shutdown ; https://pkg.go.dev/os/signal#NotifyContext

## Quiz
1. What does r.PathValue("id") return for /users/42? — tests path values
2. Wrong method on a "GET /x" route returns? — tests 405
3. Why set headers before WriteHeader? — tests response order
4. What does a middleware wrap? — tests middleware
5. What does Shutdown do with in-flight requests? — tests graceful shutdown
