# 30. Errors & Responses
Version: Go 1.27.4 + Gin v1.12.0
Prerequisites: 29-gin-middleware, 11-error-handling

## Learning goals
- learner can give every error response one JSON shape
- learner can stop a request with AbortWithStatusJSON
- learner can collect errors with c.Error and render them in one middleware
- learner can map domain errors to HTTP status codes with errors.Is/As
- learner can customise panic recovery without leaking details

## Sub-topics
### Consistent JSON error shape
- Concept: clients parse one shape everywhere: `{"error":{"code":"not_found","message":"user 99 not found"}}`; `type APIError struct{ Code string `json:"code"`; Message string `json:"message"` }` + helper `func fail(c *gin.Context, status int, code, msg string)`; machine `code` (stable, snake_case) vs human `message`; NoRoute/NoMethod (27) and validation (28, add `"details"` map with omitempty) use same shape.
- Analogy: every complaint form in a company uses the same template, so the complaints desk can process them blindly.
- Code example: shape.go — GET /users/99 (not in map) → 404 `{"error":{"code":"not_found","message":"user 99 not found"}}`; GET /nope → 404 `{"error":{"code":"route_not_found","message":"no such route"}}`
- Production use: frontends/SDKs switch on `code`.
- Common mistakes: mixing `{"error":"..."}` and `{"message":"..."}` across handlers; putting internal error text in message.
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#Context.JSON ; https://www.rfc-editor.org/rfc/rfc9457 (Problem Details, named alternative)

### AbortWithStatusJSON
- Concept: `c.AbortWithStatusJSON(status, body)` = Abort + JSON in one call; in middleware it stops the chain; in a handler same as c.JSON + Abort; still `return` after.
- Analogy: a bouncer who both blocks the door and hands you a written reason.
- Code example: abort.go — middleware requiring header `X-Tenant`; missing → 400 `{"error":{"code":"missing_tenant","message":"X-Tenant header required"}}`, handler not run (handler's print `handler ran` absent)
- Production use: auth/tenant/rate-limit middleware rejections.
- Common mistakes: c.JSON in middleware without Abort → handler still runs and writes a second body.
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#Context.AbortWithStatusJSON

### c.Error and an error-handling middleware
- Concept: handler calls `_ = c.Error(err)` (appends to `c.Errors`) and returns without writing; `ErrorHandler()` middleware: `c.Next()`, then if `len(c.Errors) > 0 && !c.Writer.Written()` → take `c.Errors.Last().Err`, map (next sub-topic), write JSON once; keeps handlers short; register with r.Use before routes.
- Analogy: workers drop faulty items in a bin; one supervisor at the line's end decides how to report each.
- Code example: errmw.go — handler `getUser` calls `c.Error(ErrNotFound)` and returns; ErrorHandler writes 404 `{"error":{"code":"not_found","message":"resource not found"}}`; handler returning nil error → its own 200 JSON untouched
- Production use: central mapping + logging in one place.
- Common mistakes: handler writes response AND calls c.Error (double write — check Written()); forgetting to register middleware → empty 200.
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#Context.Error ; https://pkg.go.dev/github.com/gin-gonic/gin#Context (Errors field)

### Mapping domain errors to status codes (errors.Is/As)
- Concept: domain (service/repo) returns Go errors, not HTTP codes; sentinels `ErrNotFound`, `ErrEmailTaken`; type `*ValidationError{Field string}`; `switch { case errors.Is(err, ErrNotFound): 404; case errors.Is(err, ErrEmailTaken): 409; case errors.As(err, &ve): 422 }`; default → 500 `{"code":"internal","message":"internal server error"}` + log real err (slog, topic 23); works through `%w` wrapping (topic 11).
- Analogy: hospital triage: diagnosis (domain error) → which ward (status code); unknown → general ward, doctor notes kept private.
- Code example: mapping.go — wrapped `fmt.Errorf("get user 99: %w", ErrNotFound)` → 404; ErrEmailTaken → 409 `{"error":{"code":"email_taken","message":"email already registered"}}`; `errors.New("db down")` → 500 `{"error":{"code":"internal","message":"internal server error"}}` and log line contains `db down`
- Production use: keeps HTTP out of business logic; one mapping table.
- Common mistakes: `err == ErrNotFound` (fails when wrapped); returning err.Error() for 500s (leaks SQL/hosts).
- Sources: https://pkg.go.dev/errors#Is ; https://pkg.go.dev/errors#As ; https://go.dev/blog/go1.13-errors

### Panics and Recovery
- Concept: panics = bugs, not control flow; `gin.CustomRecovery(func(c *gin.Context, recovered any) { ... })` → log `recovered` + write the standard 500 shape; Recovery only covers the request goroutine — goroutines you start need their own recover (topic 15/11).
- Analogy: smoke alarm that also calls the fire brigade with a standard report.
- Code example: panic.go — gin.New + CustomRecovery; GET /boom panics `index out of range` style (slice `[]int{}[1]` via variable index) → 500 `{"error":{"code":"internal","message":"internal server error"}}`; server stays up
- Production use: last-resort safety net + alerting.
- Common mistakes: returning the panic value to client; panicking for expected errors (not found).
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#CustomRecovery ; https://go.dev/blog/defer-panic-and-recover

## Quiz
1. Why a stable `code` field? — tests error shape
2. What does AbortWithStatusJSON do that c.JSON doesn't? — tests abort
3. Why check c.Writer.Written() in the error middleware? — tests double write
4. Status for a wrapped ErrNotFound — tests errors.Is through %w
5. What should a 500 body contain? — tests no leaks
