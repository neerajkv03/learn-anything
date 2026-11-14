# 29. Gin Middleware
Version: Go 1.27.4 + Gin v1.12.0 + gin-contrib/cors v1.7.11
Prerequisites: 28-gin-binding, 21-http-server (middleware idea), 23-logging-config

## Learning goals
- learner can explain the handler chain and c.Next / c.Abort
- learner knows what Logger and Recovery do
- learner can write middleware for request IDs and timing
- learner can attach middleware globally, per group or per route
- learner can pass values between middleware and handlers
- learner can configure CORS safely

## Sub-topics
### How middleware runs (c.Next, c.Abort)
- Concept: each route has a chain `[mw1, mw2, handler]`; middleware = `gin.HandlerFunc`; code before `c.Next()` runs on the way in, after on the way out (onion); without explicit c.Next the chain still continues after mw returns; `c.Abort()` stops later handlers but NOT the current function → `return` after; `c.AbortWithStatus(401)`; `c.IsAborted()`.
- Analogy: airport security lanes: each checkpoint passes you on (Next) and can stop you (Abort); on the way back you pass them in reverse.
- Code example: order.go — mw A prints `A before`/`A after` around c.Next, mw B same, handler prints `handler`; GET /x prints exactly:
  `A before` `B before` `handler` `B after` `A after` (one per line). Second variant: B calls `c.AbortWithStatus(403); return` → prints `A before` `B before` `A after`, response 403.
- Production use: auth, logging, metrics, panics, CORS — all cross-cutting work.
- Common mistakes: forgetting return after Abort; calling c.Next twice.
- Sources: https://gin-gonic.com/en/docs/examples/custom-middleware/ ; https://pkg.go.dev/github.com/gin-gonic/gin#Context.Next ; https://pkg.go.dev/github.com/gin-gonic/gin#Context.Abort

### Built-in Logger and Recovery
- Concept: `gin.Logger()` writes one line per request (time, status, latency, client IP, method, path) to stdout; `gin.Recovery()` catches panics (topic 11), logs stack, responds 500; `gin.Default()` = both (26); Logger output is text — topic 34 swaps for slog JSON; `gin.LoggerWithConfig` with `SkipPaths` (e.g. /healthz) named.
- Analogy: front-desk visitor log (Logger) and a safety net under a trapeze (Recovery).
- Code example: recover.go — gin.New() + gin.Logger() + gin.Recovery(); GET /boom handler does `panic("oops")` → client gets 500, server keeps running, next GET /ping → 200 `{"message":"pong"}`; without Recovery: net/http's own recover logs the panic and drops the connection (curl shows `Empty reply from server`) — author: describe, don't promise exact curl text
- Production use: Recovery always on; Logger replaced by structured logger.
- Common mistakes: gin.New() without Recovery; logging request bodies with secrets.
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#Logger ; https://pkg.go.dev/github.com/gin-gonic/gin#Recovery ; https://gin-gonic.com/en/docs/examples/using-middleware/

### Writing custom middleware (request ID, timing)
- Concept: factory func returning `gin.HandlerFunc` (lets you pass config); request ID: read `X-Request-ID` header or generate with `crypto/rand.Text()` (Go 1.24+, random 26-char string — gloss), set response header `c.Header("X-Request-ID", id)`; timing: `start := time.Now(); c.Next(); d := time.Since(start)` (topic 13) + `c.Writer.Status()` after Next.
- Analogy: stamping each parcel with a tracking number at the depot entrance; stopwatch started at entry, read at exit.
- Code example: reqid.go — `RequestID()` + `Timing()` middleware; `curl -i -H "X-Request-ID: abc123" localhost:8080/ping` → response header `X-Request-ID: abc123`; without header → 26-character random ID (value varies, say so); Timing prints `GET /ping 200 <duration>` (duration varies)
- Production use: request IDs tie logs across services (topic 34 adds them to slog).
- Common mistakes: reading status before c.Next (always 200); using c (gin.Context) inside a goroutine after the handler returns → use `c.Copy()`.
- Sources: https://gin-gonic.com/en/docs/examples/custom-middleware/ ; https://pkg.go.dev/crypto/rand#Text ; https://gin-gonic.com/en/docs/examples/goroutines-inside-a-middleware/

### Global vs group vs route middleware
- Concept: `r.Use(mw)` = all routes registered after (and NoRoute); `g := r.Group("/admin", mw)` or `g.Use(mw)` = group only; `r.GET("/x", mw, handler)` = one route; order = registration order; Use must come before routes it should cover.
- Analogy: building entrance guard (global), floor key-card reader (group), locked single office (route).
- Code example: scope.go — global RequestID, group `/admin` with `adminOnly` (checks header `X-Admin: yes`, else 403), route `/slow` with Timing; `GET /admin/stats` without header → 403 `{"error":"admins only"}`; with header → 200 `{"users":1}`; `GET /ping` → 200 (no admin check)
- Production use: auth only on private groups; public health endpoints outside.
- Common mistakes: r.Use after routes registered (earlier routes miss it); putting auth global and locking out /healthz.
- Sources: https://gin-gonic.com/en/docs/examples/using-middleware/ ; https://pkg.go.dev/github.com/gin-gonic/gin#RouterGroup.Use

### Sharing values with c.Set / c.Get
- Concept: `c.Set(key, value)` stores per-request value (key type `any`; use package-level string constants e.g. `const requestIDKey = "requestID"` to avoid typos); `v, ok := c.Get(key)` → any + comma-ok, then type assertion (topic 10); `c.GetString(key)`; `c.MustGet(key)` panics if missing (only when middleware guarantees it); lives only for this request; compare context.WithValue (topic 17).
- Analogy: sticky notes on the request folder, passed down the desk line, shredded when the request ends.
- Code example: share.go — RequestID middleware `c.Set(requestIDKey, id)`; handler `id := c.GetString(requestIDKey)` → JSON `{"request_id":"abc123"}` for header `X-Request-ID: abc123`
- Production use: request ID, authenticated user (topic 31), tenant.
- Common mistakes: misspelled string keys (use constants); MustGet where middleware may not have run.
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#Context.Set ; https://pkg.go.dev/github.com/gin-gonic/gin#Context.Get

### CORS with gin-contrib/cors
- Concept: CORS gloss — browser rule: page from origin A may call API on origin B only if B's response allows A; preflight = browser's `OPTIONS` request before non-simple calls; `go get github.com/gin-contrib/cors@v1.7.11` (needs Go ≥1.26.10 — fine on 1.27.4); `r.Use(cors.New(cors.Config{AllowOrigins: []string{"https://app.example.com"}, AllowMethods: []string{"GET","POST"}, AllowHeaders: []string{"Content-Type","Authorization"}, MaxAge: 12 * time.Hour}))`; register before routes; only browsers enforce it — not a security wall for curl/servers.
- Analogy: guest list at a club door: only listed origins get in; preflight = phoning ahead to ask if you're on the list.
- Code example: cors.go — `curl -i -H "Origin: https://app.example.com" localhost:8080/ping` → header `Access-Control-Allow-Origin: https://app.example.com`; Origin `https://evil.example` → 403 (cors middleware rejects disallowed origin; accuracy reviewer confirm status) and no allow header
- Production use: SPA frontends on a different domain.
- Common mistakes: `AllowOrigins: ["*"]` with `AllowCredentials: true` (browsers reject; insecure intent); thinking CORS protects the API from non-browser clients.
- Sources: https://pkg.go.dev/github.com/gin-contrib/cors ; https://github.com/gin-contrib/cors ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS

## Quiz
1. Print order with two middleware around a handler — tests onion order
2. Does c.Abort stop the current function? — tests Abort + return
3. Where to attach auth for /admin only? — tests group middleware
4. How does a handler read a value set by middleware? — tests c.Get/GetString
5. Does CORS stop curl? — tests CORS scope
