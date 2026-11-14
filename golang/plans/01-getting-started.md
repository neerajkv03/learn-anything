# 01. Getting Started
Version: Go 1.27.4
Prerequisites: none

## Learning goals
- learner can install Go 1.27.4 and confirm it with `go version`
- learner can write, run and build a one-file Go program
- learner can create a module with `go mod init`
- learner can format code with gofmt and catch mistakes with go vet

## Sub-topics
### Installing Go
- Concept: toolchain (gloss: compiler = translator from Go text to machine instructions); download installer from go.dev/dl (Windows .msi, macOS .pkg, Linux tarball); open a terminal (gloss); `go version`.
- Analogy: workshop toolbox — one `go` command holds every tool (build, run, test, format), like one box with hammer, saw, ruler.
- Code example: terminal — `go version` → `go version go1.27.4 <os>/<arch>`, e.g. `go version go1.27.4 windows/amd64` (state the last part varies by computer).
- Production use: CI servers and teammates pin the same Go version.
- Common mistakes: terminal opened before install → `go` not found, reopen terminal; installing an old OS-package Go instead of go.dev/dl.
- Sources: https://go.dev/doc/install ; https://go.dev/dl/

### Your first program (package main, func main, fmt.Println)
- Concept: `.go` file; `package main` marks a runnable program; `import "fmt"` brings in the formatting package (gloss package = labelled drawer of ready-made code); `func main()` = start point; `fmt.Println` prints a line; braces; `//` comments.
- Analogy: house with one front door — `package main` says "people can enter this house", `func main` is the front door; every visit starts there.
- Code example: hello.go — `fmt.Println("Hello, Go!")` → `Hello, Go!`
- Production use: every Go service/CLI has exactly one `main` package with one `main` func.
- Common mistakes: unused import is a compile error (message contains `"os" imported and not used`); opening brace `{` on the next line fails to compile; `Println` capital P required.
- Sources: https://go.dev/doc/tutorial/getting-started ; https://go.dev/ref/spec#Program_execution

### go run and go build
- Concept: `go run hello.go` compiles to a temp file and runs it; `go build` writes a binary (gloss executable) — `hello` on macOS/Linux, `hello.exe` on Windows; run with `./hello` / `.\hello.exe`; binary runs without Go installed.
- Analogy: `go run` = cook and eat at the stove; `go build` = cook, pack a lunchbox, eat anywhere later.
- Code example: same hello.go — `go build` then `./hello` → `Hello, Go!`
- Production use: `go run` while developing, `go build` for what you ship (topic 25 goes deeper).
- Common mistakes: expecting `go run` to leave a file behind; committing binaries to version control.
- Sources: https://pkg.go.dev/cmd/go#hdr-Compile_and_run_Go_program ; https://pkg.go.dev/cmd/go#hdr-Compile_packages_and_dependencies

### Modules with go mod init
- Concept: module = a project folder Go tracks as one unit; `go mod init example.com/hello` creates `go.mod` with `module example.com/hello` plus a `go` line naming a Go version; then `go run .` runs the package in the current folder. Module path is usually a repo URL. Deeper in topic 12.
- Analogy: go.mod = the project's ID card: its name and which Go version it expects.
- Code example: terminal — `mkdir hello`, `cd hello`, `go mod init example.com/hello` → `go: creating new go.mod: module example.com/hello`; show go.mod first line `module example.com/hello` exactly; say the `go` line's number depends on the toolchain (don't print a specific number).
- Production use: every real Go project starts with go.mod.
- Common mistakes: `go run .` outside a module → error mentioning `go.mod file not found`; spaces/uppercase in module path.
- Sources: https://go.dev/ref/mod#go-mod-init ; https://go.dev/doc/tutorial/create-module

### gofmt and go vet
- Concept: `gofmt -w file.go` / `go fmt ./...` rewrite layout to the one standard style (tabs); `go vet ./...` reports suspicious code that still compiles. `./...` gloss = this folder and every folder below.
- Analogy: gofmt = laundry machine that folds every shirt identically; vet = proofreader who says "this sentence probably isn't what you meant".
- Code example: vetme.go — `fmt.Printf("%d\n", "hi")` compiles; `go vet` reports a line containing `fmt.Printf format %d has arg "hi" of wrong type string` (file:line prefix varies).
- Production use: editors run gofmt on save; CI runs `go vet`; `go test` runs a subset of vet checks automatically.
- Common mistakes: hand-aligning code then fighting gofmt; ignoring vet warnings.
- Sources: https://pkg.go.dev/cmd/gofmt ; https://pkg.go.dev/cmd/vet

## Quiz
1. Which line marks a file as a runnable program? — tests package main
2. Difference between go run and go build — tests build leaves a binary
3. What happens with an unused import? — tests compile error rule
4. What does go.mod record? — tests module path + Go version
5. Which tool catches a wrong Printf verb? — tests go vet
