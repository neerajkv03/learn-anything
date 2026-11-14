# 12. Packages & Modules
Version: Go 1.27.4
Prerequisites: 11-error-handling

## Learning goals
- learner can split code into packages and control visibility with capitalization
- learner can lay out a project with cmd/ and internal/
- learner can add, upgrade and verify dependencies with go get and go.sum
- learner can read major-version import paths like /v5
- learner can keep go.mod clean with go mod tidy

## Sub-topics
### Packages and exported names
- Concept: package = folder of .go files with the same `package` line; import path = module path + folder; Capitalized names exported, lowercase private to the package.
- Analogy: shop — the shop window (Capitalized) is what customers see; the back office (lowercase) is staff only.
- Code example: module `example.com/shop`; `price/price.go`: `package price`; `func Total(cents ...int) int` uses private `func sum(...)`; main.go imports `"example.com/shop/price"`; `fmt.Println(price.Total(250, 199))` → `449`; calling `price.sum` → compile error (don't quote exact text; say "not exported / undefined")
- Production use: one package per responsibility (`store`, `api`, `auth`).
- Common mistakes: package name ≠ folder name confusion; import cycles → compile error `import cycle not allowed`; stuttering names (`price.PriceTotal`).
- Sources: https://go.dev/doc/code ; https://go.dev/ref/spec#Exported_identifiers

### Project layout and internal/
- Concept: small: main.go at root; bigger: `cmd/<app>/main.go` for each binary, packages beside; `internal/` packages importable only from the parent tree.
- Analogy: building with a "staff only" door — anyone in this building may pass, outsiders may not.
- Code example: tree — `shop/ go.mod, cmd/shop/main.go, internal/price/price.go`; `go run ./cmd/shop` → `449`
- Production use: services keep business logic in internal/ so other modules can't depend on it.
- Common mistakes: copying huge "standard layouts" for a 3-file program; importing another module's internal/ → error `use of internal package ... not allowed`.
- Sources: https://go.dev/doc/modules/layout ; https://pkg.go.dev/cmd/go#hdr-Internal_Directories

### go.mod, go.sum and go get
- Concept: go.mod lists the module path, go version and `require` lines; `go get golang.org/x/text@latest` adds/updates; `@v1.2.3` pins; go.sum stores checksums verified on download (checksum database); commit both files.
- Analogy: go.mod = shopping list with brands and versions; go.sum = sealed receipts proving each item is exactly what was bought.
- Code example: terminal — `go get golang.org/x/text@latest` → go.mod gains a line `require golang.org/x/text vX.Y.Z` (say version varies) and go.sum gains hash lines; don't invent a version number
- Production use: reproducible builds in CI; `go list -m -u all` to see upgrades.
- Common mistakes: editing go.sum by hand; deleting go.sum; not committing it.
- Sources: https://go.dev/doc/modules/managing-dependencies ; https://go.dev/ref/mod#go-get ; https://go.dev/ref/mod#go-sum-files

### Semantic import versions
- Concept: versions MAJOR.MINOR.PATCH (semver); breaking change = new major; v2+ modules put `/vN` in the import path, e.g. `github.com/jackc/pgx/v5` (used in topic 24); v0/v1 have no suffix.
- Analogy: book editions — a 2nd edition with rewritten chapters is shelved under its own title so old readers aren't surprised.
- Code example: imports.go — `import "github.com/jackc/pgx/v5/stdlib"` vs a hypothetical `github.com/example/lib` (v1); show `go get github.com/jackc/pgx/v5@v5.11.0` → go.mod line `require github.com/jackc/pgx/v5 v5.11.0` (plus indirect deps)
- Production use: upgrading majors deliberately and side by side.
- Common mistakes: `go get github.com/jackc/pgx@v5.11.0` (missing /v5) fails; assuming minor bumps break APIs.
- Sources: https://go.dev/ref/mod#major-version-suffixes ; https://go.dev/doc/modules/version-numbers

### go mod tidy
- Concept: adds missing requires, removes unused ones, updates go.sum; Go 1.27 (go 1.27+ modules) merges duplicate require blocks into at most two (direct and indirect, per https://go.dev/doc/go1.27); `// indirect` marks deps of deps.
- Analogy: tidying the pantry against the recipe list — buy what's missing, throw out what no recipe uses.
- Code example: terminal — remove the last use of golang.org/x/text, run `go mod tidy` → its require line disappears from go.mod
- Production use: run before commit; CI check that `go mod tidy` produces no diff.
- Common mistakes: hand-editing requires; forgetting tidy after deleting code.
- Sources: https://go.dev/ref/mod#go-mod-tidy ; https://go.dev/doc/go1.27

## Quiz
1. How do you make a function visible to other packages? — tests exported names
2. Who can import internal/price? — tests internal
3. Purpose of go.sum — tests checksums
4. Why does pgx's import path end in /v5? — tests major suffix
5. What does go mod tidy remove? — tests tidy
