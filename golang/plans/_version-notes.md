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

## Gin 1.12.0 (released 2026-02-28)
- Release: v1.12.0 marked Latest, 28 Feb 2026 (year from pkg.go.dev). https://github.com/gin-gonic/gin/releases/tag/v1.12.0
- Min Go: go.mod `go 1.25.0`, no toolchain line. https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/go.mod
- Min Go bumped to 1.24 (#4388), then CI and docs to Go 1.25+ (#4550). https://github.com/gin-gonic/gin/releases/tag/v1.12.0
- Context: new `GetError` and `GetErrorSlice` (#4502). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Context: new `Delete` method (commit 38e7651). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Context: Protocol Buffers support in content negotiation (#4423). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Context: ClientIP fixed for multiple X-Forwarded-For values (#4472). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Context: always trusts X-Forwarded-For headers from a Unix socket (#3359), behavior change. https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Binding: `encoding.UnmarshalText` support in uri/query binding (#4203). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Binding: form binding improves empty slice/array handling (#4380); empty value error fixed (#2169). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Binding: BSON now uses mongo-driver v2 (#4549). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Render: BSON protocol support (#4145). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Render: `Data.Render` writes content length (#4206). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Gin: new option to use escaped path (#4420). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Gin: `RunFd` closes `os.File`, fixing a resource leak (#4422). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Gin: literal colon routes fixed with `engine.Handler()` (#4415). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Logger: latency coloring (#4146); option to skip query string output (#4547). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Recovery: suppresses `http.ErrAbortHandler` (#4336). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Response: hijack behavior refined (#4373); `Flush()` no longer panics without `http.Flusher` (#4479). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Tree: panic in `findCaseInsensitivePathRec` with `RedirectFixedPath` fixed (#4535). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Debug: version mismatch fixed (#4403). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Perf: fewer allocations in `findCaseInsensitivePath` (#4417); regex replaced in `redirectTrailingSlash` (#4414). https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Refactor: `sync.OnceValue` in ginS; `maps.Clone`/`maps.Copy` usage. https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Removals, deprecations, changed defaults: none listed in CHANGELOG or release page. https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/CHANGELOG.md
- Release page: `golang.org/x/crypto` to v0.45.0 (#4449), quic-go to v0.57.1. https://github.com/gin-gonic/gin/releases/tag/v1.12.0

## Gin 1.11.0 (released 2025-09-20)
- Release: 20 Sep 2025 per pkg.go.dev. https://pkg.go.dev/github.com/gin-gonic/gin?tab=versions
- Features: experimental HTTP/3 via quic-go (#3210); `BindPlain` (#3904); `OnlyFilesFS` exported (#3939). https://raw.githubusercontent.com/gin-gonic/gin/v1.11.0/CHANGELOG.md
- Features: `unixMilli`/`unixMicro` time binding (#4190); form collection default values and array format (#4048, #3986). https://raw.githubusercontent.com/gin-gonic/gin/v1.11.0/CHANGELOG.md
- Features: `GetXxx` context getters cover more Go native types (#3633). https://raw.githubusercontent.com/gin-gonic/gin/v1.11.0/CHANGELOG.md
- Min Go: "update Gin minimum Go version to 1.21" (#3960). https://raw.githubusercontent.com/gin-gonic/gin/v1.11.0/CHANGELOG.md
- Build: Trivy scanning in CI (#4359); Go 1.24 and 1.25 added to CI (#4154, #4341). https://raw.githubusercontent.com/gin-gonic/gin/v1.11.0/CHANGELOG.md
- Build: sonic v1.13.2 to v1.14.0 (#4342). https://raw.githubusercontent.com/gin-gonic/gin/v1.11.0/CHANGELOG.md
- Fix: middleware re-entry in `HandleContext` (#3987); nil handler check in context (#3413). https://raw.githubusercontent.com/gin-gonic/gin/v1.11.0/CHANGELOG.md
- Fix: TOML decode duplicate decoding and validation (#4193); no panic on method-not-allowed with empty tree (#4003). https://raw.githubusercontent.com/gin-gonic/gin/v1.11.0/CHANGELOG.md
- Enhancement: `strings.Cut` in binding (#3522); `SaveUploadedFile` takes optional permission parameter (#4068). https://raw.githubusercontent.com/gin-gonic/gin/v1.11.0/CHANGELOG.md
- Removals, deprecations, changed defaults: none listed in CHANGELOG. https://raw.githubusercontent.com/gin-gonic/gin/v1.11.0/CHANGELOG.md

## Gin extension libs (checked 2026-11-15)
- jwt/v5 latest stable: v5.3.1, published Jan 28 2026, marked Latest. pkg.go.dev warns page is not module's latest; newest version UNCONFIRMED. https://github.com/golang-jwt/jwt/releases ; https://pkg.go.dev/github.com/golang-jwt/jwt/v5
- jwt/v5 identifiers all present: NewWithClaims(method SigningMethod, claims Claims, opts ...TokenOption) *Token; SigningMethodHS256 *SigningMethodHMAC (var); RegisteredClaims struct; NewNumericDate(t time.Time) *NumericDate; ParseWithClaims(tokenString string, claims Claims, keyFunc Keyfunc, options ...ParserOption) (*Token, error); WithValidMethods(methods []string) ParserOption; WithExpirationRequired() ParserOption; ErrTokenExpired var; (*Token).SignedString(key any) (string, error); Token.Valid bool field. https://pkg.go.dev/github.com/golang-jwt/jwt/v5
- gin-contrib/cors latest stable: v1.7.11, Nov 8 (2026 per pkg.go.dev), marked Latest; page flags not module's latest. https://github.com/gin-contrib/cors/releases ; https://pkg.go.dev/github.com/gin-contrib/cors
- gin-contrib/cors min Go: `go 1.26.10` (go.mod at tag v1.7.11). https://raw.githubusercontent.com/gin-contrib/cors/v1.7.11/go.mod
- cors API present: func New(config Config) gin.HandlerFunc; func Default() gin.HandlerFunc; Config.AllowOrigins []string, AllowMethods []string, AllowHeaders []string, ExposeHeaders []string, AllowCredentials bool, MaxAge time.Duration. https://pkg.go.dev/github.com/gin-contrib/cors
- validator/v10 latest stable: v10.30.6, marked Latest; date Nov 2 on releases page vs Oct 29 2026 on pkg.go.dev (conflict, not resolved). Newest UNCONFIRMED (pkg.go.dev not-latest warning). https://github.com/go-playground/validator/releases ; https://pkg.go.dev/github.com/go-playground/validator/v10
- gin v1.12.0 go.mod: `go 1.25.0`; requires github.com/go-playground/validator/v10 v10.30.1. https://raw.githubusercontent.com/gin-gonic/gin/v1.12.0/go.mod
- validator: type ValidationErrors present (methods Error(), Translate(ut)); underlying type UNCONFIRMED. https://pkg.go.dev/github.com/go-playground/validator/v10
- validator: FieldError interface methods Tag() string, Field() string, Param() string. https://pkg.go.dev/github.com/go-playground/validator/v10
- validator: (*Validate).RegisterValidation(tag string, fn Func, callValidationEvenIfNull ...bool) error. https://pkg.go.dev/github.com/go-playground/validator/v10
- validator: FieldLevel interface present (Top, Parent, Field, FieldName, StructFieldName, Param, GetTag, ExtractType; GetStructFieldOK* deprecated). https://pkg.go.dev/github.com/go-playground/validator/v10
- gin v1.12.0: SetMode(value string); const ReleaseMode = "release"; const TestMode = "test"; CreateTestContext(w http.ResponseWriter) (c *Context, r *Engine). https://pkg.go.dev/github.com/gin-gonic/gin@v1.12.0
- gin v1.12.0: BasicAuth(accounts Accounts) HandlerFunc; type Accounts map[string]string. https://pkg.go.dev/github.com/gin-gonic/gin@v1.12.0
- gin v1.12.0: (*Engine).SetTrustedProxies(trustedProxies []string) error. https://pkg.go.dev/github.com/gin-gonic/gin@v1.12.0
- gin v1.12.0: Engine field HandleMethodNotAllowed bool (405 if another method matches; else NoMethod/NotFound path). https://pkg.go.dev/github.com/gin-gonic/gin@v1.12.0 (page offset 100000)
- gin v1.12.0: (*Engine).NoRoute(handlers ...HandlerFunc); (*Engine).NoMethod(handlers ...HandlerFunc); (*Engine).Handler() http.Handler. https://pkg.go.dev/github.com/gin-gonic/gin@v1.12.0
- gin v1.12.0 Context: ShouldBindJSON(obj any) error; ShouldBindUri(obj any) error; ShouldBindQuery(obj any) error; ShouldBind(obj any) error. https://pkg.go.dev/github.com/gin-gonic/gin@v1.12.0
- gin v1.12.0 Context: FormFile(name string) (*multipart.FileHeader, error); SaveUploadedFile(file *multipart.FileHeader, dst string, perm ...fs.FileMode) error (perm variadic). https://pkg.go.dev/github.com/gin-gonic/gin@v1.12.0
- gin v1.12.0 Context: AbortWithStatusJSON(code int, jsonObj any); Error(err error) *Error; Errors field type errorMsgs; GetError(key any) error. https://pkg.go.dev/github.com/gin-gonic/gin@v1.12.0
- gin v1.12.0 Context: GetString(key any) string; MustGet(key any) any; Set(key any, value any) (key is any, not string-only). https://pkg.go.dev/github.com/gin-gonic/gin@v1.12.0
- gin v1.12.0 Context: ClientIP() string; DefaultQuery(key, defaultValue string) string; Param(key string) string. https://pkg.go.dev/github.com/gin-gonic/gin@v1.12.0
- gin v1.12.0 binding: var Validator StructValidator = &defaultValidator{}; StructValidator methods ValidateStruct(any) error, Engine() any. https://pkg.go.dev/github.com/gin-gonic/gin/binding@v1.12.0
- UNCONFIRMED: newest jwt/v5 and validator/v10 releases beyond the "Latest" tags shown; ValidationErrors underlying type; gin v1.12.0 Context.Errors exact type beyond "errorMsgs" field line.
