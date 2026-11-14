# Go 1.27.4 version notes

Released 2026-11-10 (per https://go.dev/doc/devel/release). Go 1.27.0 released 2026-08-19.

- Language: generic methods supported; a method declaration may declare its own type parameters. https://go.dev/doc/go1.27
- Language: struct literal keys may be any valid field selector, not just top-level field names. https://go.dev/doc/go1.27
- Language: function type inference applies wherever a generic function is assigned to or converted to a matching function type. https://go.dev/doc/go1.27
- Language: interface methods still cannot declare type parameters or be implemented by generic methods. https://go.dev/doc/go1.27
- Tools: `@file` response file parsing supported by compile, link, asm, cgo, cover, pack. https://go.dev/doc/go1.27
- Go command: `bzr` support removed; bzr module servers can no longer be fetched. https://go.dev/doc/go1.27
- Go command: removed GODEBUG settings in go.mod/`//go:debug` are accepted only if set to final default; old values fail the build. https://go.dev/doc/go1.27
- go test: `stdversion` vet check runs by default. https://go.dev/doc/go1.27
- go doc: accepts `package@version`; new `-ex` lists executable examples. https://go.dev/doc/go1.27
- go fix: new modernizers `atomictypes`, `embedlit`, `slicesbackward`, `unsafefuncs`; `fmtappendf` removed; `waitgroup` renamed `waitgroupgo`. https://go.dev/doc/go1.27
- go mod tidy: for go 1.27+ modules, duplicate require blocks merged into at most two. https://go.dev/doc/go1.27
- gofmt: column alignment no longer varies by CPU architecture; minor whitespace changes possible. https://go.dev/doc/go1.27
- vet (printf): reports `fmt.Errorf("%w", p)` where p is `*E` and E implements error. https://go.dev/doc/go1.27
- trace: `go tool trace -http=:port` now listens on localhost only. https://go.dev/doc/go1.27
- Runtime: go 1.27+ tracebacks include pprof goroutine labels; disable with `tracebacklabels=0`. https://go.dev/doc/go1.27
- Runtime: size-specialized allocation for allocations under 80 bytes, up to 30% cheaper per allocation; opt-out `GOEXPERIMENT=nosizespecializedmalloc`, expected removed in 1.28. https://go.dev/doc/go1.27
- Runtime: `goroutineleak` profile generally available in runtime/pprof and at `/debug/pprof/goroutineleak`. https://go.dev/doc/go1.27
- Runtime: GODEBUG `asynctimerchan` removed; time package channels always unbuffered. https://go.dev/doc/go1.27
- Compiler: relative filenames in `//line` directives resolve against containing file's directory. https://go.dev/doc/go1.27
- Compiler: closure names simpler and stable under inlining; code comparing function pointers via reflect may differ. https://go.dev/doc/go1.27
- Linker: new `-macos` and `-macsdk` options; defaults macOS 13.0.0 and SDK 26.2.0. https://go.dev/doc/go1.27
- encoding/json/v2 (new package): `Marshal`, `Unmarshal` etc. take variadic `Options`; rejects invalid UTF-8 and duplicate names by default. https://go.dev/doc/go1.27
- encoding/json/jsontext (new package): low-level Encoder/Decoder on Token and Value. https://go.dev/doc/go1.27
- encoding/json now backed by v2; v1 behavior kept via Options; opt-out `GOEXPERIMENT=nojsonv2`. https://go.dev/doc/go1.27
- crypto/mldsa (new package): ML-DSA (FIPS 204); crypto/x509 supports ML-DSA keys and signatures. https://go.dev/doc/go1.27
- crypto/tls: TLS 1.3 ML-DSA via `MLDSA44`, `MLDSA65`, `MLDSA87` SignatureScheme values; `MLKEM1024` in CurvePreferences. https://go.dev/doc/go1.27
- crypto/tls: `Config.Rand` deprecated; use `testing/cryptotest.SetGlobalRandom`. https://go.dev/doc/go1.27
- crypto/x509: `SystemCertPool` honors SSL_CERT_FILE/SSL_CERT_DIR on Windows and Darwin (opt-out `GODEBUG=x509sslcertoverrideplatform=0`). https://go.dev/doc/go1.27
- uuid (new package): generate and parse UUIDs. https://go.dev/doc/go1.27
- simd (experimental, `GOEXPERIMENT=simd`): vector-size-agnostic package; archsimd adds arm64 Neon and WebAssembly. https://go.dev/doc/go1.27
- strings and bytes: new `CutLast` functions. https://go.dev/doc/go1.27
- math/big: new `Int.Divide` with Trunc, Floor, Round, Ceil modes. https://go.dev/doc/go1.27
- math/rand/v2: generic method `(*Rand) N`. https://go.dev/doc/go1.27
- net/http: HTTP/2 server honors RFC 9218 client priority (`Server.DisableClientPriority` restores round-robin). https://go.dev/doc/go1.27
- net/http: HTTP/1 Response.Body drains unread content on close (up to a limit). https://go.dev/doc/go1.27
- net/http: new `Server.MaxHeaderValueCount` field. https://go.dev/doc/go1.27
- net/url: new `URL.Clone` and `Values.Clone`. https://go.dev/doc/go1.27
- testing/synctest: new `Sleep` helper. https://go.dev/doc/go1.27
- unicode: upgraded from Unicode 15 to Unicode 17. https://go.dev/doc/go1.27
- Ports: Darwin requires macOS 13 Ventura or later. https://go.dev/doc/go1.27
- Removals: go/types `gotypesalias` GODEBUG removed; crypto/tls `tlsunsafeekm`, `tlsrsakex`, `tls3des`, `tls10server`, `x509keypairleaf` removed. https://go.dev/doc/go1.27

# pgx v5.11.0 (checked 2026-11-15)
- Latest stable v5 per https://github.com/jackc/pgx/releases ; adds driver.RowsColumnScanner support in stdlib. Driver name "pgx" not confirmed on that page: confirm on https://pkg.go.dev/github.com/jackc/pgx/v5/stdlib

# PostgreSQL 18.7 (checked 2026-11-15)
- Latest stable per https://www.postgresql.org/support/versioning/ ; major 18 first released 2025-09-25.

# Go 1.24–1.26 features used by plans (confirmed 2026-11-15)
- 1.26: built-in new accepts an expression operand; errors.AsType generic version of As. https://go.dev/doc/go1.26
- 1.25: sync.WaitGroup.Go. https://go.dev/doc/go1.25
- 1.24: testing.B.Loop; omitzero json tag option. https://go.dev/doc/go1.24
