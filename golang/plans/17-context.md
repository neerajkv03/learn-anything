# 17. Context
Version: Go 1.27.4
Prerequisites: 16-sync-patterns

## Learning goals
- learner can explain what context.Context carries
- learner can cancel work with WithCancel
- learner can bound work with WithTimeout and WithDeadline
- learner can pass ctx as the first parameter through a call chain
- learner can use context values only for request-scoped data

## Sub-topics
### What context.Context is
- Concept: interface carrying a cancellation signal (`Done()` channel), deadline, error (`Err()`) and request-scoped values across API calls and goroutines; root `context.Background()`; `context.TODO()` placeholder; immutable — derive children.
- Analogy: walkie-talkie network from the manager — one "stop now" message reaches every worker on that job.
- Code example: bg.go — `ctx := context.Background(); fmt.Println(ctx.Err())` → `<nil>`
- Production use: every HTTP request has one (`r.Context()`, topic 21); DB and HTTP client calls accept one.
- Common mistakes: passing nil ctx; using TODO in finished code.
- Sources: https://pkg.go.dev/context ; https://go.dev/blog/context

### WithCancel
- Concept: `ctx, cancel := context.WithCancel(parent)`; `cancel()` closes `ctx.Done()`; `ctx.Err()` → `context.Canceled`; always `defer cancel()`; cancelling a parent cancels children.
- Analogy: master off switch — flip it and every machine on that circuit stops.
- Code example: cancel.go — goroutine `<-ctx.Done(); fmt.Println("worker stopped:", ctx.Err())` signalled via a done channel; main calls `cancel()` → `worker stopped: context canceled`
- Production use: stop background workers on shutdown; abandon work when the client disconnects.
- Common mistakes: not calling cancel → resource leak (vet lostcancel warns).
- Sources: https://pkg.go.dev/context#WithCancel

### WithTimeout and WithDeadline
- Concept: `WithTimeout(parent, 50*time.Millisecond)` = deadline now+d; `WithDeadline(parent, t)` exact time; Err → `context.DeadlineExceeded`; child can only shorten, never extend, a parent deadline.
- Analogy: parking meter — when time runs out, you must leave, whatever you were doing.
- Code example: timeout.go — `ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond); defer cancel(); select { case <-time.After(time.Second): fmt.Println("finished"); case <-ctx.Done(): fmt.Println(ctx.Err()) }` → `context deadline exceeded`
- Production use: per-request DB/API timeouts (topics 22, 24).
- Common mistakes: one timeout for a whole batch when each call needs its own; ignoring ctx inside long loops.
- Sources: https://pkg.go.dev/context#WithTimeout ; https://pkg.go.dev/context#WithDeadline

### Passing context through calls
- Concept: convention: first parameter `ctx context.Context`; pass it down unchanged or derived; check `ctx.Err()` in loops; never store ctx in a struct.
- Analogy: relay baton passed down the chain — every runner carries the same baton, so the "race cancelled" flag reaches all.
- Code example: chain.go — `func process(ctx context.Context, items []string) error { for _, it := range items { if err := ctx.Err(); err != nil { return err }; fmt.Println("processed", it) }; return nil }`; with already-cancelled ctx → returns `context canceled`; with Background over `[]string{"a", "b"}` → `processed a`,`processed b`
- Production use: handler → service → repository all take ctx.
- Common mistakes: `context.Background()` deep inside a call chain (breaks cancellation); ctx as struct field.
- Sources: https://pkg.go.dev/context#pkg-overview ; https://go.dev/blog/context-and-structs

### Context values (sparingly)
- Concept: `context.WithValue(ctx, key, val)`; key = unexported custom type to avoid collisions; read with type assertion `ctx.Value(k).(string)`; only request-scoped data crossing APIs (request ID, auth user) — never optional parameters or dependencies.
- Analogy: luggage tag on a suitcase — identifies the trip, isn't the luggage itself.
- Code example: values.go — `type requestIDKey struct{}`; `ctx := context.WithValue(context.Background(), requestIDKey{}, "req-42")`; `id, ok := ctx.Value(requestIDKey{}).(string); fmt.Println(id, ok)` → `req-42 true`
- Production use: request IDs for logs (topic 23), authenticated user from middleware (topic 21).
- Common mistakes: string keys (collisions; vet/staticcheck warn); stuffing DB handles or config into ctx.
- Sources: https://pkg.go.dev/context#WithValue

## Quiz
1. What does ctx.Done() return? — tests Done channel
2. Why always defer cancel()? — tests leaks
3. Error after a timeout — tests DeadlineExceeded
4. Where does ctx go in a function signature? — tests convention
5. Good use of context values — tests WithValue
