# 25. Building & Shipping
Version: Go 1.27.4
Prerequisites: 24-database-sql

## Learning goals
- learner can build release binaries with -trimpath and stamp a version with -ldflags
- learner can cross-compile for other OS/architectures
- learner can install command-line tools and track project tools in go.mod
- learner can profile a running service with pprof
- learner can package a Go service in a minimal multi-stage Docker image

## Sub-topics
### go build flags and -ldflags version stamping
- Concept: `go build -o bin/app ./cmd/app`; `-trimpath` removes local paths; `-ldflags="-s -w -X main.version=1.2.0"` (-s -w strip debug info → smaller; -X sets a string var at link time); `var version = "dev"`; `go version -m bin/app` shows embedded module + VCS info.
- Analogy: factory stamping the batch number on each product as it leaves the line.
- Code example: version.go — `var version = "dev"`; `-version` flag (topic 23) prints it; `go run . -version` → `dev`; built with `-ldflags="-X main.version=1.2.0"` then `./app -version` → `1.2.0`
- Production use: `/version` endpoint, logs showing which build is running.
- Common mistakes: -X on a const or non-string (silently ignored); wrong package path (`main.version` vs full import path for other packages).
- Sources: https://pkg.go.dev/cmd/go#hdr-Compile_packages_and_dependencies ; https://pkg.go.dev/cmd/link ; https://pkg.go.dev/runtime/debug#ReadBuildInfo

### Cross-compiling with GOOS/GOARCH
- Concept: set target OS/CPU via env vars; bash `GOOS=linux GOARCH=arm64 go build -o app-linux-arm64 ./cmd/app`; PowerShell `$env:GOOS = "linux"; $env:GOARCH = "arm64"; go build ...` (then reset/remove them); `go tool dist list` lists targets; `CGO_ENABLED=0` → static binary, easiest cross builds.
- Analogy: printing the same manual in another language for a different country — same content, different reader.
- Code example: terminal — after building, `go version -m app-linux-arm64` output includes lines `GOARCH=arm64` and `GOOS=linux`
- Production use: build Linux binaries on Windows/Mac laptops and in CI for servers and Raspberry Pi/ARM cloud.
- Common mistakes: forgetting PowerShell env vars persist for the session; cgo-dependent packages failing to cross-compile.
- Sources: https://go.dev/doc/install/source#environment ; https://pkg.go.dev/cmd/go#hdr-Environment_variables

### go install and tools
- Concept: `go install golang.org/x/tools/cmd/stringer@latest` builds and puts the binary in `$(go env GOPATH)/bin` (or GOBIN) — add that folder to PATH; project-pinned tools (Go 1.24+): `go get -tool golang.org/x/tools/cmd/stringer` adds a `tool` line to go.mod, run with `go tool stringer`.
- Analogy: installing an app on your phone (global) vs keeping a specific tool in the project's own toolbox so every teammate has the same version.
- Code example: terminal — `go get -tool golang.org/x/tools/cmd/stringer` → go.mod gains `tool golang.org/x/tools/cmd/stringer`; `go tool stringer -help` prints usage (don't quote output)
- Production use: code generators, linters pinned per repo for reproducible CI.
- Common mistakes: `go get` without -tool to install binaries (no longer installs); PATH missing GOPATH/bin.
- Sources: https://pkg.go.dev/cmd/go#hdr-Compile_and_install_packages_and_dependencies ; https://go.dev/doc/modules/managing-dependencies#tools

### Profiling with pprof
- Concept: profile = measurement of where CPU time/memory goes; `import _ "net/http/pprof"` registers `/debug/pprof/` on DefaultServeMux — serve it on a separate localhost-only port (`go http.ListenAndServe("localhost:6060", nil)`); `go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30` then `top`; heap profile `/debug/pprof/heap`; Go 1.27: `goroutineleak` profile generally available at `/debug/pprof/goroutineleak` (per https://go.dev/doc/go1.27); tests: `go test -cpuprofile cpu.out`.
- Analogy: health check-up scan — a heat map showing which organs (functions) work hardest.
- Code example: pprof.go — app with a busy loop handler; steps listed; output of `top` described generally (columns flat, flat%, sum%, cum, cum%; values vary)
- Production use: diagnosing CPU spikes, memory growth, goroutine leaks.
- Common mistakes: exposing /debug/pprof on the public port (leaks internals); optimizing without a profile.
- Sources: https://pkg.go.dev/net/http/pprof ; https://go.dev/blog/pprof ; https://go.dev/doc/diagnostics

### Minimal Docker image
- Concept: container image (gloss: packaged app + minimal OS files, run the same everywhere); multi-stage Dockerfile: build stage `FROM golang:1.27 AS build`, `WORKDIR /src`, `COPY go.mod go.sum ./`, `RUN go mod download`, `COPY . .`, `RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /app ./cmd/app`; runtime stage `FROM gcr.io/distroless/static-debian12:nonroot`, `COPY --from=build /app /app`, `USER nonroot:nonroot`, `ENTRYPOINT ["/app"]`; config via env (topic 23); graceful SIGTERM (topic 21). Docker installed by learner.
- Analogy: shipping container holding only the finished product — no factory machines inside.
- Code example: Dockerfile above; `docker build -t shop:1.2.0 .` then `docker run -p 8080:8080 -e DATABASE_URL=... shop:1.2.0`; image is tens of MB vs hundreds for the build image (say "much smaller", no exact numbers)
- Production use: Kubernetes/Cloud Run/ECS deployments.
- Common mistakes: shipping the full golang image; CGO enabled binary on a static base (fails to start); copying source before go.mod (breaks layer cache).
- Sources: https://docs.docker.com/build/building/multi-stage/ ; https://github.com/GoogleContainerTools/distroless ; https://hub.docker.com/_/golang

## Quiz
1. What does -X main.version=1.2.0 change? — tests ldflags
2. Build for Linux ARM64 from Windows — tests GOOS/GOARCH
3. go install vs go get -tool — tests tools
4. Why serve pprof on localhost only? — tests pprof safety
5. Why a multi-stage Dockerfile? — tests image size
