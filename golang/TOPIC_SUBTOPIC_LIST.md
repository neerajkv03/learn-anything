# Go Learning Path (Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7)

Version checked: Go 1.27.4 on 2026-11-15 via https://go.dev/dl/?mode=json (release notes https://go.dev/doc/go1.27); pgx v5.11.0 on 2026-11-15 via https://github.com/jackc/pgx/releases; PostgreSQL 18.7 on 2026-11-15 via https://www.postgresql.org/support/versioning/
Approved: list ✓ | plans ✓
App: done | App verified: done

| # | Topic | Slug | Sub-topics | Plan | Content | Verified |
|---|-------|------|------------|------|---------|----------|
| 01 | Getting Started | 01-getting-started | Installing Go; Your first program (package main, func main, fmt.Println); go run and go build; Modules with go mod init; gofmt and go vet | done | done | done |
| 02 | Variables & Basic Types | 02-variables-types | var and := declarations; Basic types (int, float64, string, bool); Zero values; Constants and iota; Type conversion | done | done | done |
| 03 | Operators & Control Flow | 03-control-flow | Arithmetic, comparison and logical operators; if/else with init statement; for loops (classic, condition-only, range over int); switch; break and continue | done | done | done |
| 04 | Functions | 04-functions | Declaring functions and parameters; Multiple return values; Variadic functions; Function values and closures; defer | done | done | done |
| 05 | Strings, Runes & Formatting | 05-strings-formatting | Strings as immutable bytes; Runes and UTF-8; strings package (Contains, Split, Cut, Builder); strconv conversions; fmt verbs and Sprintf | done | done | done |
| 06 | Arrays & Slices | 06-arrays-slices | Arrays; Slices and slicing; append, len and cap; Ranging over slices; slices package (Sort, Contains, Index) | done | done | done |
| 07 | Maps | 07-maps | Creating maps; Reading with comma-ok; Adding, updating and delete; Iteration order is random; maps package and sets with map[T]struct{} | done | done | done |
| 08 | Structs | 08-structs | Defining struct types; Struct literals and field access; Embedding (composition); Anonymous structs; Comparing and copying structs | done | done | done |
| 09 | Pointers | 09-pointers | Addresses and & / *; nil pointers; Pass by value vs by pointer; new and pointer to struct literals; When to use pointers | done | done | done |
| 10 | Methods & Interfaces | 10-methods-interfaces | Methods on types; Value vs pointer receivers; Interfaces and implicit implementation; Type assertions and type switches; any and fmt.Stringer; Small interfaces (io.Reader idea) | done | done | done |
| 11 | Error Handling | 11-error-handling | The error type and if err != nil; errors.New and fmt.Errorf with %w; errors.Is and errors.As; Custom error types; panic and recover (when not to use) | done | done | done |
| 12 | Packages & Modules | 12-packages-modules | Packages and exported names; Project layout and internal/; go.mod, go.sum and go get; Semantic import versions; go mod tidy | done | done | done |
| 13 | Time & Dates | 13-time | time.Time and time.Now; Durations; Formatting and parsing with the reference layout; Time zones; Timers and tickers | done | done | done |
| 14 | Generics | 14-generics | Type parameters on functions; Constraints and the cmp package; Generic types; Generic methods (new in 1.27); When not to use generics | done | done | done |
| 15 | Goroutines & Channels | 15-goroutines-channels | Goroutines; Unbuffered channels; Buffered channels and close; range over channels; select | done | done | done |
| 16 | Synchronization & Patterns | 16-sync-patterns | Race conditions and go test -race; sync.Mutex and RWMutex; sync.WaitGroup and wg.Go; sync.Once; Worker pools; atomic types | done | done | done |
| 17 | Context | 17-context | What context.Context is; WithCancel; WithTimeout and WithDeadline; Passing context through calls; Context values (sparingly) | done | done | done |
| 18 | Files & I/O | 18-files-io | io.Reader and io.Writer; Reading and writing files with os; bufio.Scanner; Paths with path/filepath; embed for static files | done | done | done |
| 19 | JSON | 19-json | encoding/json Marshal and Unmarshal; Struct tags (omitempty, omitzero); Decoding unknown JSON into map[string]any; Streaming with Encoder and Decoder; json/v2 note | done | done | done |
| 20 | Testing | 20-testing | go test and _test.go files; Table-driven tests and t.Run; Test helpers and t.Cleanup; Benchmarks with b.Loop; Coverage; Fuzzing basics | done | done | done |
| 21 | HTTP Servers | 21-http-server | net/http handlers; ServeMux routing with methods and path values; JSON request and response; Middleware; Server timeouts and graceful shutdown | done | done | done |
| 22 | HTTP Clients | 22-http-client | http.Client and timeouts; Requests with context; Reading and closing response bodies; Sending JSON; Checking status codes | done | done | done |
| 23 | Logging & Configuration | 23-logging-config | log/slog structured logging; Log levels and JSON handler; Environment variables; Command-line flags with flag; Config struct pattern | done | done | done |
| 24 | Databases with database/sql | 24-database-sql | database/sql and drivers (PostgreSQL via pgx stdlib driver); Opening a pool and Ping; Query, QueryRow and Exec with placeholders; Transactions; Context and connection pool settings | done | done | done |
| 25 | Building & Shipping | 25-build-deploy | go build flags and -ldflags version stamping; Cross-compiling with GOOS/GOARCH; go install and tools; Profiling with pprof; Minimal Docker image | done | done | done |
