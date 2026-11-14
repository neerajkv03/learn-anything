# 23. Logging & Configuration
Version: Go 1.27.4
Prerequisites: 22-http-client

## Learning goals
- learner can log structured key/value data with log/slog
- learner can set log levels and switch to a JSON handler
- learner can read environment variables with defaults
- learner can parse command-line flags
- learner can load, default and validate a Config struct once at startup

## Sub-topics
### log/slog structured logging
- Concept: structured log = message + key/value pairs machines can search; `slog.Info("server started", "port", 8080)`; `slog.Error(..., "err", err)`; default handler writes via the standard `log` output.
- Analogy: ship's logbook with fixed columns (time, level, event, details) instead of free-form diary entries.
- Code example: slog1.go — `slog.Info("server started", "port", 8080)` → line like `2026/03/14 09:30:00 INFO server started port=8080` (timestamp varies; say so)
- Production use: every service logs requests, errors, startup config.
- Common mistakes: odd number of key/value args → `!BADKEY` in output; string-formatting values into the message instead of attributes.
- Sources: https://pkg.go.dev/log/slog ; https://go.dev/blog/slog

### Log levels and JSON handler
- Concept: levels Debug < Info < Warn < Error; `slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))`; `slog.SetDefault(logger)`; `logger.With("request_id", id)` adds fields to every line; TextHandler for local dev.
- Analogy: volume knob — turn it down in production (Info) and up while debugging (Debug).
- Code example: slogjson.go — JSON handler at Debug; `logger.Debug("cache miss", "key", "user:7")` → `{"time":"…","level":"DEBUG","msg":"cache miss","key":"user:7"}` (time varies); with Level Info the Debug line prints nothing
- Production use: JSON logs shipped to log platforms; per-request child loggers.
- Common mistakes: logging secrets/passwords; Debug left on in production (cost/noise).
- Sources: https://pkg.go.dev/log/slog#NewJSONHandler ; https://pkg.go.dev/log/slog#HandlerOptions ; https://pkg.go.dev/log/slog#Logger.With

### Environment variables
- Concept: `os.Getenv("PORT")` → "" if unset; `v, ok := os.LookupEnv("PORT")` distinguishes unset vs empty; setting for one run: bash `PORT=9090 go run .`, PowerShell `$env:PORT = "9090"; go run .`; secrets via env, never in code.
- Analogy: sticky notes on the fridge the program reads every morning when it starts.
- Code example: env.go — `func getenv(key, def string) string { if v, ok := os.LookupEnv(key); ok { return v }; return def }`; unset → `fmt.Println(getenv("PORT", "8080"))` → `8080`; with PORT=9090 → `9090`
- Production use: 12-factor config in containers (topic 25).
- Common mistakes: forgetting env values are strings (convert with strconv, handle errors); reading env all over the code instead of once.
- Sources: https://pkg.go.dev/os#Getenv ; https://pkg.go.dev/os#LookupEnv

### Command-line flags with flag
- Concept: `port := flag.Int("port", 8080, "listen port")` returns a pointer (topic 09); `flag.Parse()` before use; `-h` prints usage automatically; `flag.Duration`, `flag.String`, `flag.Bool`; `flag.IntVar(&cfg.Port, …)` writes into a struct.
- Analogy: the options box on an order form — "extra cheese: yes", "size: large".
- Code example: flags.go — `go run . -port=9090` → prints `listening on 9090`; no flag → `listening on 8080`; `go run . -port=abc` → error mentioning `invalid value "abc" for flag -port` + usage
- Production use: CLIs and tools; overriding config locally.
- Common mistakes: reading flags before flag.Parse (defaults only); forgetting the value is a pointer (`*port`).
- Sources: https://pkg.go.dev/flag

### Config struct pattern
- Concept: one `type Config struct { Port int; DatabaseURL string; LogLevel slog.Level }`; `load()` builds it once at startup: defaults → env → flags (later wins), validates required fields, returns (Config, error); pass Config (or its fields) explicitly — no globals.
- Analogy: pilot's preflight checklist — every setting checked once before takeoff, not mid-flight.
- Code example: config.go — DATABASE_URL unset → `load()` returns error, main prints `config: DATABASE_URL is required` and exits with code 1 (`os.Exit(1)`); set → `port=8080 db=set` (never print the URL itself)
- Production use: every service main.go.
- Common mistakes: failing late (first request) instead of at startup; logging full config including secrets.
- Sources: https://pkg.go.dev/flag#IntVar ; https://pkg.go.dev/os#Exit

## Quiz
1. Why structured logs over Printf? — tests slog
2. What prints if level is Info and you call Debug? — tests levels
3. Getenv vs LookupEnv — tests env
4. When must flag.Parse be called? — tests flags
5. Where should config be validated? — tests config pattern
