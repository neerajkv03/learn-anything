# 20. Testing
Version: Go 1.27.4
Prerequisites: 19-json

## Learning goals
- learner can write and run tests with go test
- learner can write table-driven tests with subtests
- learner can write helpers and clean up with t.Cleanup / t.TempDir
- learner can benchmark with b.Loop
- learner can measure coverage
- learner can write a basic fuzz test

## Sub-topics
### go test and _test.go files
- Concept: test files end in `_test.go`, same package; `func TestXxx(t *testing.T)`; `t.Errorf` (continue) vs `t.Fatalf` (stop); `go test ./...`; `-v` verbose, `-run Regex`; go test runs a vet subset (Go 1.27 adds `stdversion` by default).
- Analogy: quality inspector checking each product off the line before it ships.
- Code example: price/price.go `func Add(a, b int) int`; price_test.go `TestAdd` checks `Add(2, 3) == 5` with `t.Errorf("Add(2, 3) = %d, want 5", got)`; `go test ./...` → line starting `ok` + package path (time varies); broken Add → `--- FAIL: TestAdd` + message
- Production use: CI runs `go test -race ./...` on every change.
- Common mistakes: test file in wrong package/folder; function named `Testadd` (lowercase after Test → not run).
- Sources: https://pkg.go.dev/testing ; https://pkg.go.dev/cmd/go#hdr-Test_packages ; https://go.dev/doc/go1.27

### Table-driven tests and t.Run
- Concept: slice of anonymous structs (topic 08) with name/inputs/want; loop with `t.Run(tc.name, func(t *testing.T) {…})`; run one case `go test -run 'TestAdd/negatives'`.
- Analogy: inspection checklist — one row per case, same procedure applied to each.
- Code example: table_test.go — cases `{"positives", 2, 3, 5}`, `{"negatives", -2, -3, -5}`, `{"zero", 0, 0, 0}`; `go test -v` shows `=== RUN   TestAdd/positives` and `--- PASS: TestAdd/positives` lines (timings vary)
- Production use: standard Go test style.
- Common mistakes: no case names (hard to locate failures); t.Fatal in a loop without subtests stops all cases.
- Sources: https://go.dev/wiki/TableDrivenTests ; https://pkg.go.dev/testing#T.Run

### Test helpers and t.Cleanup
- Concept: `t.Helper()` makes failures point at the caller line; `t.TempDir()` auto-deleted dir; `t.Cleanup(f)` runs after the test (LIFO); `t.Context()` (Go 1.24+) cancelled when the test ends.
- Analogy: stage crew — resets the set after every scene so the next scene starts clean.
- Code example: helper_test.go — `func writeTemp(t *testing.T, content string) string { t.Helper(); p := filepath.Join(t.TempDir(), "in.txt"); if err := os.WriteFile(p, []byte(content), 0o644); err != nil { t.Fatal(err) }; return p }`; test reads it back → passes; `t.Cleanup(func() { t.Log("cleanup ran") })` visible with -v
- Production use: shared setup (temp DBs, servers) in helpers.
- Common mistakes: forgetting t.Helper (failure points inside helper); manual os.RemoveAll in defer.
- Sources: https://pkg.go.dev/testing#T.Helper ; https://pkg.go.dev/testing#T.Cleanup ; https://pkg.go.dev/testing#T.TempDir

### Benchmarks with b.Loop
- Concept: `func BenchmarkXxx(b *testing.B) { for b.Loop() { … } }` (Go 1.24+, confirmed https://go.dev/doc/go1.24; replaces `for i := 0; i < b.N; i++`); setup before the loop isn't timed; `go test -bench=. -benchmem`; output columns ns/op, B/op, allocs/op.
- Analogy: stopwatch timing many laps and reporting the average lap.
- Code example: bench_test.go — `BenchmarkJoin` with `strings.Join([]string{"a", "b", "c"}, ",")` inside `b.Loop()`; output line starts `BenchmarkJoin-` + CPU count; numbers vary (say so)
- Production use: compare implementations before optimizing; `benchstat` for comparisons.
- Common mistakes: benchmarking with `go test` without `-bench` (benchmarks don't run); using b.N loop in new code.
- Sources: https://pkg.go.dev/testing#B.Loop ; https://pkg.go.dev/testing#hdr-Benchmarks

### Coverage
- Concept: `go test -cover` prints percent; `-coverprofile=cover.out` then `go tool cover -html=cover.out` shows lines hit/missed.
- Analogy: highlighter over a map marking every road your tests drove on.
- Code example: terminal — `go test -cover ./price` → line containing `coverage: 100.0% of statements` for the Add example
- Production use: find untested branches; don't chase 100%.
- Common mistakes: treating coverage as correctness.
- Sources: https://go.dev/blog/cover ; https://pkg.go.dev/cmd/go#hdr-Testing_flags

### Fuzzing basics
- Concept: `func FuzzXxx(f *testing.F)`; `f.Add(seed)`; `f.Fuzz(func(t *testing.T, s string) { … })` checks a property for random inputs; `go test -fuzz=FuzzReverse -fuzztime=10s`; failing inputs saved under `testdata/fuzz/`.
- Analogy: a monkey pounding the keyboard to find input that breaks your program.
- Code example: fuzz_test.go — `Reverse(s string) string` reversing runes; property: `Reverse(Reverse(s)) == s` and `utf8.ValidString(s)` → valid strings keep validity; describe output `fuzz: elapsed: …` lines (vary)
- Production use: parsers, decoders, input validation.
- Common mistakes: fuzzing without checking a property; forgetting to commit testdata/fuzz cases that found bugs.
- Sources: https://go.dev/doc/security/fuzz/ ; https://go.dev/doc/tutorial/fuzz

## Quiz
1. Which files does go test pick up? — tests _test.go
2. Errorf vs Fatalf — tests failure behavior
3. Run only one subtest — tests -run with /
4. What does b.Loop replace? — tests benchmarks
5. What does a fuzz test check? — tests properties
