# 18. Files & I/O
Version: Go 1.27.4
Prerequisites: 17-context

## Learning goals
- learner can connect io.Reader and io.Writer values with io.Copy
- learner can read and write whole files and open files for streaming
- learner can process a file line by line with bufio.Scanner
- learner can build portable paths with path/filepath
- learner can embed static files into a binary

## Sub-topics
### io.Reader and io.Writer
- Concept: Reader = `Read(p []byte) (n int, err error)`, returns `io.EOF` at end (gloss); Writer = `Write`; files, network connections, buffers, HTTP bodies all implement them; `io.Copy(dst, src)` streams between.
- Analogy: taps and sinks — any tap (Reader) connects to any sink (Writer) with the same hose (io.Copy).
- Code example: copy.go — `io.Copy(os.Stdout, strings.NewReader("hello\n"))` → `hello`
- Production use: streaming uploads/downloads without loading into memory.
- Common mistakes: treating `io.EOF` as a failure; ignoring `n` when err != nil.
- Sources: https://pkg.go.dev/io#Reader ; https://pkg.go.dev/io#Copy

### Reading and writing files with os
- Concept: `os.WriteFile(name, data, 0o644)` (permission bits gloss: owner read/write, others read); `os.ReadFile(name)` → []byte; `os.Create`/`os.Open` return `*os.File` + `defer f.Close()`; `os.ErrNotExist` with errors.Is; check Close error on writes.
- Analogy: filing cabinet — ReadFile = copy the whole folder at once; Open = pull the drawer and read page by page.
- Code example: files.go — `os.WriteFile("notes.txt", []byte("line 1\nline 2\n"), 0o644)`; `data, err := os.ReadFile("notes.txt"); fmt.Print(string(data))` → `line 1`,`line 2`; `_, err = os.ReadFile("missing.txt"); fmt.Println(errors.Is(err, os.ErrNotExist))` → `true`
- Production use: config files, exports, temp files.
- Common mistakes: ReadFile on huge files; forgetting Close (leak); ignoring Close error after writing.
- Sources: https://pkg.go.dev/os#ReadFile ; https://pkg.go.dev/os#WriteFile ; https://pkg.go.dev/os#Open

### bufio.Scanner
- Concept: `scanner := bufio.NewScanner(f)`; `for scanner.Scan() { scanner.Text() }`; check `scanner.Err()` after; default max token 64 KiB (`bufio.MaxScanTokenSize`), raise with `scanner.Buffer`.
- Analogy: reading a book with your finger under one line at a time.
- Code example: lines.go — open notes.txt from above; count lines printing `fmt.Printf("%d: %s\n", n, scanner.Text())` → `1: line 1`,`2: line 2`
- Production use: log processing, CSV-ish line formats, reading stdin.
- Common mistakes: skipping `scanner.Err()`; very long lines → `bufio.Scanner: token too long`.
- Sources: https://pkg.go.dev/bufio#Scanner

### Paths with path/filepath
- Concept: `filepath.Join` uses the OS separator; `Base`, `Dir`, `Ext`, `Abs`; `filepath.WalkDir` for trees; `path` package is for URL-style slash paths only.
- Analogy: writing a postal address in the local country's format — same place, different punctuation.
- Code example: paths.go — `p := filepath.Join("data", "2026", "report.csv"); fmt.Println(p, filepath.Base(p), filepath.Ext(p))` → `data/2026/report.csv report.csv .csv` on macOS/Linux; Windows prints `data\2026\report.csv report.csv .csv`
- Production use: cross-platform tools, upload directories.
- Common mistakes: string concat with "/"; using `path` for file paths on Windows; joining untrusted names (path traversal `../`) — mention `os.Root` (Go 1.24+) as the safe option without detail.
- Sources: https://pkg.go.dev/path/filepath#Join ; https://pkg.go.dev/path/filepath#WalkDir ; https://pkg.go.dev/os#Root

### embed for static files
- Concept: `//go:embed hello.txt` directly above a package-level `var s string`, `[]byte` or `embed.FS`; files baked into the binary at build time; requires `import _ "embed"` for string/[]byte; patterns like `//go:embed static/*`.
- Analogy: packing the files inside the suitcase with the program — nothing left behind at the hotel.
- Code example: embed.go — hello.txt contains `Hello from a file!` + newline; `//go:embed hello.txt` `var greeting string`; `fmt.Print(greeting)` → `Hello from a file!`
- Production use: HTML templates, static web assets, SQL migrations in single-binary deploys (topic 25).
- Common mistakes: space after `//` (`// go:embed` ignored); blank line between directive and var; paths with `..` not allowed.
- Sources: https://pkg.go.dev/embed

## Quiz
1. What does io.Copy connect? — tests Reader/Writer
2. Detect "file not found" — tests os.ErrNotExist
3. What must you check after the Scan loop? — tests scanner.Err
4. Why filepath.Join over "+"? — tests portability
5. What does //go:embed do? — tests embed
