# 16. Synchronization & Patterns
Version: Go 1.27.4
Prerequisites: 15-goroutines-channels

## Learning goals
- learner can recognize a data race and detect it with -race
- learner can protect shared state with Mutex and RWMutex
- learner can wait for goroutines with WaitGroup and wg.Go
- learner can run setup once with sync.Once / OnceValue
- learner can build a worker pool
- learner can use atomic counters

## Sub-topics
### Race conditions and go test -race
- Concept: data race = two goroutines touch the same variable at the same time and at least one writes; result unpredictable; `go run -race .` / `go test -race ./...` detects at runtime and prints `WARNING: DATA RACE`; needs cgo/C compiler on some systems (say "may need a C toolchain on Windows").
- Analogy: two people updating the same whiteboard number at once — both read 5, both write 6, one update lost.
- Code example: race.go — 1000 goroutines each `count++` with a WaitGroup → final value often below 1000 and varies (say so; don't give a number); with `-race` → report containing `WARNING: DATA RACE`
- Production use: run tests with -race in CI.
- Common mistakes: "works on my machine" races; thinking maps are safe for concurrent writes (`fatal error: concurrent map writes`).
- Sources: https://go.dev/doc/articles/race_detector ; https://go.dev/ref/mem

### sync.Mutex and RWMutex
- Concept: `mu.Lock(); defer mu.Unlock()` makes a section one-goroutine-at-a-time; keep mutex next to the data it guards in a struct; RWMutex: many readers (`RLock`) or one writer; never copy a mutex after use (vet copylocks).
- Analogy: single bathroom key — whoever holds it goes in, others wait; RWMutex = museum: many visitors may look, but the restorer works alone with the room closed.
- Code example: safe.go — `type Counter struct{ mu sync.Mutex; n int }`; `func (c *Counter) Inc() { c.mu.Lock(); defer c.mu.Unlock(); c.n++ }`; 1000 goroutines → `fmt.Println(c.n)` → `1000`
- Production use: in-memory caches, rate-limit tables.
- Common mistakes: forgetting Unlock (use defer); value receiver copies the mutex; holding a lock during slow I/O.
- Sources: https://pkg.go.dev/sync#Mutex ; https://pkg.go.dev/sync#RWMutex

### sync.WaitGroup and wg.Go
- Concept: WaitGroup counts running goroutines; classic `wg.Add(1)` + `defer wg.Done()`; Go 1.25+ `wg.Go(func(){…})` does both (confirmed https://go.dev/doc/go1.25); `wg.Wait()` blocks until zero; Go 1.27 `go fix` modernizer `waitgroupgo` rewrites the old pattern.
- Analogy: tour guide counting heads — the bus leaves only when everyone is back.
- Code example: wg.go — `results := make([]int, 3); var wg sync.WaitGroup; for i := range 3 { wg.Go(func() { results[i] = i * i }) }; wg.Wait(); fmt.Println(results)` → `[0 1 4]` (each goroutine writes its own index → no race)
- Production use: fan-out calls then wait (e.g. fetch 3 APIs in parallel).
- Common mistakes: `wg.Add` inside the goroutine (race with Wait); copying WaitGroup by value.
- Sources: https://pkg.go.dev/sync#WaitGroup ; https://pkg.go.dev/sync#WaitGroup.Go ; https://go.dev/doc/go1.27

### sync.Once
- Concept: `once.Do(f)` runs f exactly once across goroutines; `sync.OnceValue(f)` returns a func that computes once and caches the result.
- Analogy: lighting the oven's pilot flame — first cook lights it, everyone after just uses it.
- Code example: once.go — `var once sync.Once; for range 3 { once.Do(func() { fmt.Println("init") }) }` → `init` (once); `getCfg := sync.OnceValue(func() int { fmt.Println("loading"); return 42 }); fmt.Println(getCfg(), getCfg())` → `loading`,`42 42`
- Production use: lazy singletons (config, compiled regex, client).
- Common mistakes: Once around code that can fail (error lost) — use OnceValues for (value, error).
- Sources: https://pkg.go.dev/sync#Once ; https://pkg.go.dev/sync#OnceValue

### Worker pools
- Concept: fixed N goroutines read from a jobs channel and write to a results channel; bounds concurrency; close jobs when done; close results after workers finish (WaitGroup).
- Analogy: supermarket with 3 checkout lanes — one queue of customers, 3 cashiers taking the next in line.
- Code example: pool.go — jobs 1..5, 3 workers each send `n*n`; main sums results → `55` (order of processing varies; total doesn't)
- Production use: bounded parallel downloads, image processing, DB batch work.
- Common mistakes: unbounded goroutine per item; forgetting to close results → range hangs.
- Sources: https://go.dev/blog/pipelines ; https://go.dev/doc/effective_go#concurrency

### atomic types
- Concept: `sync/atomic` types `atomic.Int64`, `atomic.Bool`, `atomic.Pointer[T]`; methods Add, Load, Store, CompareAndSwap; for single counters/flags only; Go 1.27 `go fix` modernizer `atomictypes` converts old function style.
- Analogy: stadium turnstile — every click counts exactly once even with crowds pushing.
- Code example: atom.go — `var n atomic.Int64`; 1000 goroutines `n.Add(1)` with wg.Go → `fmt.Println(n.Load())` → `1000`
- Production use: request counters, "shutting down" flags.
- Common mistakes: mixing atomic and plain access to the same var; using atomics for multi-field invariants (use a mutex).
- Sources: https://pkg.go.dev/sync/atomic#Int64 ; https://go.dev/doc/go1.27

## Quiz
1. What is a data race? — tests race definition
2. Why defer Unlock? — tests mutex
3. What does wg.Go replace? — tests WaitGroup
4. How many times does once.Do run its func? — tests Once
5. Why is a worker pool better than one goroutine per item? — tests pools
