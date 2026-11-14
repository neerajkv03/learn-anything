window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "20-testing",
  "order": 20,
  "title": "Testing",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7",
  "summary": "Go ships a testing tool in the standard library and the go command. You will write tests with go test, group cases in tables with subtests, clean up with helpers, measure speed with benchmarks, see which lines your tests run with coverage, and let a fuzzer hunt for inputs that break your code.",
  "prerequisites": [
    "19-json"
  ],
  "subtopics": [
    {
      "id": "go-test-and-test-files",
      "title": "go test and _test.go files",
      "explanation": "A test is a small function that calls your code and checks the result. If the result is wrong, the test reports a failure. Go has this built in: the standard library package testing and the command go test. You need no extra tools.\n\nThe rules are simple. A test lives in a file whose name ends in _test.go, in the same folder and the same package as the code it checks. A test function is named TestSomething: the word Test followed by a capital letter. It takes one parameter, t *testing.T. The value t is the handle you use to report problems (a pointer to testing.T, the type whose methods report results; pointers are topic 9).\n\nTo follow along, create a folder and a module (topic 01). In a terminal (PowerShell or bash), run the commands in the first code block below. Then create the folder price with two files, price.go and price_test.go, as shown in the next two blocks.\n\nInside a test you report failure with methods on t. t.Errorf records a failure message (formatted like fmt.Printf) and lets the test keep running. t.Fatalf records the message and stops that test immediately. Use Errorf when later checks are still useful, and Fatalf when continuing makes no sense (for example, a setup step failed).\n\nRun tests with go test ./... from the module root. The ./... pattern means \"this folder and every folder below it\". A passing package prints one line starting with ok, then the package path, then the time (the time varies from run to run). A failing test prints --- FAIL: followed by the test name and your message, with the file and line number of the failing call.\n\nTwo flags are worth knowing now. -v (verbose) prints every test as it runs, even passing ones. -run takes a regular expression (a pattern for matching text) and runs only tests whose names match it, for example go test -run TestAdd ./...\n\nBefore running your tests, go test also runs a small subset of go vet (topic 01), the built-in checker for suspicious code. Since Go 1.27 that subset includes the stdversion check, which reports code that uses a standard-library feature newer than the Go version your go.mod declares.",
      "analogy": "A quality inspector stands at the end of a production line and checks each product against the spec before it ships. Each Test function is one inspection step. Errorf is the inspector writing a defect on the form and continuing to check the rest of the product. Fatalf is the inspector stopping the line for this product because it cannot be checked any further.",
      "code": [
        {
          "language": "bash",
          "filename": "setup.sh",
          "source": "mkdir shop\ncd shop\ngo mod init example.com/shop\nmkdir price",
          "output": "go: creating new go.mod: module example.com/shop",
          "explanation": "Creates a folder called shop, moves into it, and starts a module named example.com/shop. The price folder will hold our package. Run every later go test command from the shop folder."
        },
        {
          "language": "go",
          "filename": "price/price.go",
          "source": "package price\n\n// Add returns the sum of a and b.\nfunc Add(a, b int) int {\n\treturn a + b\n}\n",
          "output": "",
          "explanation": "The code under test. It is a normal package named price with one exported function (topic 12)."
        },
        {
          "language": "go",
          "filename": "price/price_test.go",
          "source": "package price\n\nimport \"testing\"\n\nfunc TestAdd(t *testing.T) {\n\tgot := Add(2, 3)\n\tif got != 5 {\n\t\tt.Errorf(\"Add(2, 3) = %d, want 5\", got)\n\t}\n}\n",
          "output": "",
          "explanation": "The file name ends in _test.go and the package is price, the same as price.go. TestAdd starts with Test followed by a capital letter, so go test runs it. The message style \"Add(2, 3) = got, want 5\" tells the reader the input, the actual result and the expected result."
        },
        {
          "language": "bash",
          "filename": "run-tests.sh",
          "source": "go test ./...",
          "output": "ok  \texample.com/shop/price\t0.002s",
          "explanation": "The line starts with ok and the package path. The time at the end differs on your machine. A passing test prints nothing else unless you add -v."
        },
        {
          "language": "bash",
          "filename": "run-broken.sh",
          "source": "# after changing price.go to: return a - b\ngo test ./...",
          "output": "--- FAIL: TestAdd (0.00s)\n    price_test.go:8: Add(2, 3) = -1, want 5\nFAIL\nFAIL\texample.com/shop/price\t0.002s\nFAIL",
          "explanation": "If Add is broken (it subtracts instead of adding), go test shows the failing test, the file and line of the Errorf call (line 8), and your message. Change Add back to a + b afterwards."
        },
        {
          "language": "go",
          "filename": "price/demo_test.go",
          "source": "package price\n\nimport \"testing\"\n\nfunc TestStops(t *testing.T) {\n\tt.Errorf(\"first problem\")\n\tt.Fatalf(\"second problem\")\n\tt.Errorf(\"never reached\")\n}\n",
          "output": "",
          "explanation": "A deliberately failing test to compare Errorf and Fatalf. Create it only for this experiment and delete the file afterwards, because it always fails."
        },
        {
          "language": "bash",
          "filename": "run-demo.sh",
          "source": "go test -v -run TestStops ./price",
          "output": "=== RUN   TestStops\n    demo_test.go:6: first problem\n    demo_test.go:7: second problem\n--- FAIL: TestStops (0.00s)\nFAIL\nFAIL\texample.com/shop/price\t0.002s\nFAIL",
          "explanation": "Errorf on line 6 records a failure and the test continues. Fatalf on line 7 records a failure and stops the test, so the third message never appears. -run TestStops selects only this test. Delete demo_test.go before moving on."
        }
      ],
      "productionNote": "Continuous integration (CI) is a server that automatically runs checks on every proposed change. Go projects usually run go test -race ./... in CI. The -race flag turns on the data race detector from topic 16, so tests also catch unsafe sharing between goroutines.",
      "commonMistakes": [
        "Naming the file price_test without the .go ending, or putting it in a different folder from the code it tests. go test only finds files ending in _test.go inside the package folder.",
        "Naming a function Testadd (lowercase letter after Test) or testAdd. Go does not treat it as a test, so it silently never runs. Use TestAdd.",
        "Running go test from a folder that is not inside the module, or forgetting ./... and wondering why subfolders were skipped. Run it from the module root."
      ],
      "sources": [
        {
          "title": "Package testing",
          "url": "https://pkg.go.dev/testing"
        },
        {
          "title": "go command: Test packages",
          "url": "https://pkg.go.dev/cmd/go#hdr-Test_packages"
        },
        {
          "title": "Go 1.27 release notes",
          "url": "https://go.dev/doc/go1.27"
        }
      ]
    },
    {
      "id": "table-driven-tests",
      "title": "Table-driven tests and t.Run",
      "explanation": "Most functions need several checks: normal input, negative numbers, zero, and so on. Writing one test function per case repeats the same code. The usual Go style is a table-driven test: one slice (topic 06) of small structs (topic 08), where each element is one case with a name, the inputs and the expected result.\n\nYou loop over the table and, for each case, call t.Run(name, func(t *testing.T) { ... }). t.Run starts a subtest: a named test inside a test. The function you pass is an anonymous function (topic 04) that receives its own t.\n\nSubtests give you two things. Each case reports separately, so a failure names the exact case, such as TestAddTable/negatives. And a t.Fatalf inside one subtest stops only that subtest, not the other cases.\n\nIf a name contains spaces, Go prints them as underscores. To run only one case, put a slash in the -run pattern: the part before the slash matches the test, the part after matches the subtest name. Quote the pattern so your shell does not misread it.\n\nIn the example below, create price/table_test.go. We call the function TestAddTable so it does not clash with the TestAdd from the previous section.",
      "analogy": "An inspection checklist: every row is one case (name, input, expected result) and the inspector applies the same procedure to each row. Adding a new case means adding one row, not writing a new procedure. A failing row is easy to find because every row has a name.",
      "code": [
        {
          "language": "go",
          "filename": "price/table_test.go",
          "source": "package price\n\nimport \"testing\"\n\nfunc TestAddTable(t *testing.T) {\n\ttests := []struct {\n\t\tname string\n\t\ta, b int\n\t\twant int\n\t}{\n\t\t{\"positives\", 2, 3, 5},\n\t\t{\"negatives\", -2, -3, -5},\n\t\t{\"zero\", 0, 0, 0},\n\t}\n\n\tfor _, tc := range tests {\n\t\tt.Run(tc.name, func(t *testing.T) {\n\t\t\tgot := Add(tc.a, tc.b)\n\t\t\tif got != tc.want {\n\t\t\t\tt.Errorf(\"Add(%d, %d) = %d, want %d\", tc.a, tc.b, got, tc.want)\n\t\t\t}\n\t\t})\n\t}\n}\n",
          "output": "",
          "explanation": "tests is a slice of anonymous structs with the fields name, a, b and want. Each row uses positional values in that field order. The loop calls t.Run once per row, using tc.name as the subtest name. Since Go 1.22 each loop iteration has its own tc, so the closure is safe to use."
        },
        {
          "language": "bash",
          "filename": "run-table.sh",
          "source": "go test -v -run TestAddTable ./price",
          "output": "=== RUN   TestAddTable\n=== RUN   TestAddTable/positives\n=== RUN   TestAddTable/negatives\n=== RUN   TestAddTable/zero\n--- PASS: TestAddTable (0.00s)\n    --- PASS: TestAddTable/positives (0.00s)\n    --- PASS: TestAddTable/negatives (0.00s)\n    --- PASS: TestAddTable/zero (0.00s)\nPASS\nok  \texample.com/shop/price\t0.002s",
          "explanation": "With -v each subtest gets its own RUN and PASS line, indented under the parent. The timings in parentheses and at the end vary."
        },
        {
          "language": "bash",
          "filename": "run-one-case.sh",
          "source": "go test -v -run 'TestAddTable/negatives' ./price",
          "output": "=== RUN   TestAddTable\n=== RUN   TestAddTable/negatives\n--- PASS: TestAddTable (0.00s)\n    --- PASS: TestAddTable/negatives (0.00s)\nPASS\nok  \texample.com/shop/price",
          "explanation": "The slash splits the pattern: TestAddTable selects the test and negatives selects one subtest. The other two cases are skipped. The final ok line also shows a time that varies."
        }
      ],
      "productionNote": "Table-driven tests with t.Run are the standard style in the Go standard library and in almost every Go project. When a bug is reported, add a row that reproduces it, then fix the code.",
      "commonMistakes": [
        "Leaving out the name field or using unclear names. When a case fails you then have to guess which row it was.",
        "Calling t.Fatalf in a loop without t.Run. The first failure stops the whole test function, so the remaining cases never run. Wrapping each case in t.Run limits the stop to that case.",
        "Forgetting to quote the -run pattern in the shell, or writing the slash part without the parent test name."
      ],
      "sources": [
        {
          "title": "Go Wiki: Table-driven tests",
          "url": "https://go.dev/wiki/TableDrivenTests"
        },
        {
          "title": "testing.T.Run",
          "url": "https://pkg.go.dev/testing#T.Run"
        }
      ]
    },
    {
      "id": "test-helpers-and-cleanup",
      "title": "Test helpers and t.Cleanup",
      "explanation": "When several tests need the same setup, you move it into a helper: an ordinary function that takes t *testing.T as its first parameter. Call t.Helper() as the first line of the helper. This marks the function as a helper, so a failure inside it is reported at the line in the test that called the helper, not at a line inside the helper.\n\nTests often need files or other resources that must be removed afterwards. t.TempDir() returns a fresh empty folder that Go deletes automatically when the test ends. You do not need os.RemoveAll or a defer.\n\nt.Cleanup(f) registers a function f to run when the test finishes, whether it passed or failed. Cleanups run in last-in, first-out order: the last one registered runs first (the same order as defer from topic 04). Use it for anything that is not just a temp folder, such as closing a connection or stopping a test server.\n\nSince Go 1.24, t.Context() returns a context (topic 17) that is cancelled just before the cleanup functions run. Pass it to code that takes a context, such as something with a background goroutine, so that code stops when the test ends.\n\nThe first example below creates price/helper_test.go. The helper writeTemp uses filepath.Join and os.WriteFile (topic 18).",
      "analogy": "A stage crew resets the set after every scene so the next scene starts clean. t.TempDir is the crew sweeping the floor automatically. t.Cleanup is a to-do note such as \"put the props back\" that is carried out when the scene ends, in reverse order of how the props were placed. t.Helper is the crew member who, if something goes wrong, points at the actor's cue rather than at their own work.",
      "code": [
        {
          "language": "go",
          "filename": "price/helper_test.go",
          "source": "package price\n\nimport (\n\t\"os\"\n\t\"path/filepath\"\n\t\"testing\"\n)\n\nfunc writeTemp(t *testing.T, content string) string {\n\tt.Helper()\n\tp := filepath.Join(t.TempDir(), \"in.txt\")\n\tif err := os.WriteFile(p, []byte(content), 0o644); err != nil {\n\t\tt.Fatal(err)\n\t}\n\treturn p\n}\n\nfunc TestWriteTemp(t *testing.T) {\n\tt.Cleanup(func() { t.Log(\"cleanup 1 (registered first, runs last)\") })\n\tt.Cleanup(func() { t.Log(\"cleanup 2 (registered last, runs first)\") })\n\n\tpath := writeTemp(t, \"hello\")\n\tdata, err := os.ReadFile(path)\n\tif err != nil {\n\t\tt.Fatal(err)\n\t}\n\tif string(data) != \"hello\" {\n\t\tt.Errorf(\"read %q, want %q\", data, \"hello\")\n\t}\n}\n",
          "output": "",
          "explanation": "writeTemp builds a path inside the auto-deleted temp folder, writes the content and returns the path. If writing fails, t.Fatal(err) stops the test and, thanks to t.Helper, the failure points at the writeTemp call in TestWriteTemp. t.Log records a message that is shown with -v or on failure. The test reads the file back and compares it."
        },
        {
          "language": "bash",
          "filename": "run-helper.sh",
          "source": "go test -v -run TestWriteTemp ./price",
          "output": "=== RUN   TestWriteTemp\n    helper_test.go:20: cleanup 2 (registered last, runs first)\n    helper_test.go:19: cleanup 1 (registered first, runs last)\n--- PASS: TestWriteTemp (0.00s)\nPASS\nok  \texample.com/shop/price\t0.002s",
          "explanation": "The test passes, then the cleanups run in reverse order. The numbers after helper_test.go: are the lines of the t.Log calls. The temp folder is deleted automatically after that."
        },
        {
          "language": "go",
          "filename": "price/context_test.go",
          "source": "package price\n\nimport \"testing\"\n\nfunc TestContext(t *testing.T) {\n\tctx := t.Context()\n\tt.Cleanup(func() {\n\t\tt.Log(\"in cleanup, ctx.Err() =\", ctx.Err())\n\t})\n\tt.Log(\"during test, ctx.Err() =\", ctx.Err())\n}\n",
          "output": "",
          "explanation": "t.Context() gives a context that is still active while the test body runs and is already cancelled when the cleanup functions run."
        },
        {
          "language": "bash",
          "filename": "run-context.sh",
          "source": "go test -v -run TestContext ./price",
          "output": "=== RUN   TestContext\n    context_test.go:10: during test, ctx.Err() = <nil>\n    context_test.go:8: in cleanup, ctx.Err() = context canceled\n--- PASS: TestContext (0.00s)\nPASS\nok  \texample.com/shop/price\t0.002s",
          "explanation": "Err() is nil (no error) during the test and reports context canceled once the test is over."
        }
      ],
      "productionNote": "Shared setup such as a temporary database, a test web server (a fake server for tests, topic 21) or a scratch directory belongs in a helper that calls t.Helper(), registers its own teardown with t.Cleanup, and returns what the test needs. The test then needs no teardown code of its own.",
      "commonMistakes": [
        "Forgetting t.Helper() in a helper. A failure is then reported at a line inside the helper, which is the same for every caller and tells you nothing about which test was wrong.",
        "Creating a folder by hand and removing it with os.RemoveAll in a defer. t.TempDir() does this for you, also when the test fails.",
        "Expecting cleanups to run in the order they were registered. They run last-in, first-out."
      ],
      "sources": [
        {
          "title": "testing.T.Helper",
          "url": "https://pkg.go.dev/testing#T.Helper"
        },
        {
          "title": "testing.T.Cleanup",
          "url": "https://pkg.go.dev/testing#T.Cleanup"
        },
        {
          "title": "testing.T.TempDir",
          "url": "https://pkg.go.dev/testing#T.TempDir"
        }
      ]
    },
    {
      "id": "benchmarks-with-b-loop",
      "title": "Benchmarks with b.Loop",
      "explanation": "A benchmark measures how fast a piece of code runs. It lives in a _test.go file like a test, but it is named BenchmarkSomething and takes b *testing.B.\n\nInside it you write a loop: for b.Loop() { ... }. The code in the loop body is the code being measured. Go calls it many times, increasing the count until the measurement is stable, and then reports the average cost of one run. b.Loop() was added in Go 1.24 and replaces the older pattern for i := 0; i < b.N; i++. Use b.Loop in new code.\n\nAnything you write before the for b.Loop() line is setup, and its time is not counted. That is where to build inputs.\n\nBenchmarks do not run during a normal go test. Add the -bench flag with a regular expression; -bench=. means \"all benchmarks\". The -benchmem flag adds memory figures. The pattern -run '^$' matches no test names, so only benchmarks run.\n\nThe result line has these columns: the benchmark name followed by the number of CPU threads Go can use (for example -8), the number of loop runs, ns/op (nanoseconds per run), B/op (bytes of memory allocated per run) and allocs/op (number of separate memory allocations per run). The numbers depend on your computer, so yours will differ from the example.",
      "analogy": "A stopwatch that times many laps around a track and reports the average lap time. Warm-up and equipment checks before the start (setup) are not on the clock. The more laps, the more trustworthy the average.",
      "code": [
        {
          "language": "go",
          "filename": "price/bench_test.go",
          "source": "package price\n\nimport (\n\t\"strings\"\n\t\"testing\"\n)\n\nfunc BenchmarkJoin(b *testing.B) {\n\tparts := []string{\"a\", \"b\", \"c\"}\n\tfor b.Loop() {\n\t\t_ = strings.Join(parts, \",\")\n\t}\n}\n",
          "output": "",
          "explanation": "parts is built before the loop, so it is not timed. Only strings.Join (topic 05) inside for b.Loop() is measured. The result is assigned to the blank identifier _ because we only care about the time."
        },
        {
          "language": "bash",
          "filename": "run-bench.sh",
          "source": "go test -bench=. -benchmem -run '^$' ./price",
          "output": "goos: linux\ngoarch: amd64\npkg: example.com/shop/price\ncpu: (your processor name)\nBenchmarkJoin-8   \t20000000\t        55.0 ns/op\t       8 B/op\t       1 allocs/op\nPASS\nok  \texample.com/shop/price\t1.2s",
          "explanation": "Representative output only: goos, goarch, cpu, the -8 suffix and every number depend on your machine and vary between runs. The BenchmarkJoin- line shows the average time and memory cost of one strings.Join call."
        }
      ],
      "productionNote": "Benchmark two implementations before deciding to optimize, and measure again after changing code. A single run is noisy. Teams run a benchmark several times (go test -bench=. -count=10) and compare the results with benchstat, a separate tool from the Go project that tells you whether a difference is real.",
      "commonMistakes": [
        "Running go test without -bench and wondering why the benchmark never ran. Benchmarks are skipped unless you ask for them.",
        "Writing the old for i := 0; i < b.N; i++ loop in new code. Use for b.Loop().",
        "Building expensive input inside the loop, which makes the benchmark measure the setup instead of the code you care about. Put it before the loop."
      ],
      "sources": [
        {
          "title": "testing.B.Loop",
          "url": "https://pkg.go.dev/testing#B.Loop"
        },
        {
          "title": "Package testing: Benchmarks",
          "url": "https://pkg.go.dev/testing#hdr-Benchmarks"
        }
      ]
    },
    {
      "id": "coverage",
      "title": "Coverage",
      "explanation": "Code coverage is the share of your statements (lines of code that do something) that ran at least once while the tests ran. It tells you which parts of the code no test has touched.\n\nAdd the -cover flag: go test -cover ./price. The ok line gains a coverage: figure. For our price package, which contains only Add and is fully exercised by the tests, it reads 100.0% of statements.\n\nTo see exactly which lines were hit, write a coverage profile (a data file) with -coverprofile=cover.out, then turn it into a web page with go tool cover -html=cover.out. That command opens your browser with your source code coloured: green for lines your tests ran, red for lines they did not.\n\nIf price.go also had a function that no test calls, its statements would count as not run and the percentage would fall below 100. The red lines show you what to test next.",
      "analogy": "A highlighter over a road map. After your tests finish, every road they drove on is highlighted. The roads still white are the ones nobody has ever driven, but a highlighted road only proves someone drove it, not that the trip went well.",
      "code": [
        {
          "language": "bash",
          "filename": "run-cover.sh",
          "source": "go test -cover ./price",
          "output": "ok  \texample.com/shop/price\t0.002s\tcoverage: 100.0% of statements",
          "explanation": "The same ok line as before, with coverage added at the end. The time varies."
        },
        {
          "language": "bash",
          "filename": "run-cover-html.sh",
          "source": "go test -coverprofile=cover.out ./price\ngo tool cover -html=cover.out",
          "output": "ok  \texample.com/shop/price\t0.002s\tcoverage: 100.0% of statements",
          "explanation": "The first command runs the tests and saves the profile to cover.out. The second command opens a page in your browser showing each source file with covered and uncovered lines coloured. It prints nothing to the terminal."
        }
      ],
      "productionNote": "Use coverage to find untested branches, for example an error path nobody exercised. Do not set a goal of 100%: the last few percent are often trivial code, and chasing the number leads to tests that check nothing.",
      "commonMistakes": [
        "Treating high coverage as proof of correctness. A test that calls a function but checks nothing still marks every line as covered.",
        "Committing cover.out into the repository. It is a generated file and should be ignored."
      ],
      "sources": [
        {
          "title": "The Go Blog: The cover story",
          "url": "https://go.dev/blog/cover"
        },
        {
          "title": "go command: Testing flags",
          "url": "https://pkg.go.dev/cmd/go#hdr-Testing_flags"
        }
      ]
    },
    {
      "id": "fuzzing-basics",
      "title": "Fuzzing basics",
      "explanation": "A normal test checks the inputs you thought of. Fuzzing generates thousands of inputs for you, many of them strange, and runs your code on each. The fuzzer starts from example inputs (the seed corpus) and mutates them (makes small random changes to them), keeping the mutations that reach new code.\n\nBecause the fuzzer does not know the right answer for random input, you check a property: something that must be true for every input. For a function that reverses text, one property is that reversing twice gives back the original.\n\nA fuzz test is named FuzzSomething and takes f *testing.F. You add seed inputs with f.Add(...). Then you call f.Fuzz with a function whose first parameter is t *testing.T, followed by parameters of the types you gave to f.Add (here a string). The body checks the property with t.Errorf as usual.\n\nA plain go test runs only the seed inputs, as ordinary quick tests. To actually fuzz, name the target and a time limit: go test -fuzz=FuzzReverse -fuzztime=10s ./price. Without -fuzztime it runs until you stop it or a failure appears. When the fuzzer finds an input that fails, it saves it as a file under testdata/fuzz/FuzzReverse/ next to the test. From then on a normal go test replays that file as a regression test (a test that stops an old bug from coming back).\n\nThe example uses a Reverse function that converts a string to a slice of runes (topic 05) and swaps elements from both ends toward the middle. The loop assigns two pairs at once: i, j = i+1, j-1 updates both variables together, and r[i], r[j] = r[j], r[i] swaps two elements without a temporary variable. Create price/reverse.go and price/fuzz_test.go.\n\nOne subtlety: a string in Go can hold bytes that are not valid UTF-8. Converting those to runes replaces them with a placeholder, so reversing twice would not return the original. We therefore tell the test to skip such input with t.Skip, which ends that case without failing. If you delete the skip lines and fuzz, the fuzzer finds this problem quickly.",
      "analogy": "A monkey pounding a keyboard, trying to break your program. You do not tell it what to type. You only tell the inspector the rule that must always hold (\"reversing twice returns the original\"), and every time the monkey finds a sequence that breaks the rule, the sequence is written down so it can be replayed.",
      "code": [
        {
          "language": "go",
          "filename": "price/reverse.go",
          "source": "package price\n\n// Reverse returns s with its characters in reverse order.\nfunc Reverse(s string) string {\n\tr := []rune(s)\n\tfor i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {\n\t\tr[i], r[j] = r[j], r[i]\n\t}\n\treturn string(r)\n}\n",
          "output": "",
          "explanation": "[]rune(s) splits the string into characters, so multi-byte characters stay intact. The loop swaps the first and last, then the second and second-to-last, and so on until i and j meet."
        },
        {
          "language": "go",
          "filename": "price/fuzz_test.go",
          "source": "package price\n\nimport (\n\t\"testing\"\n\t\"unicode/utf8\"\n)\n\nfunc FuzzReverse(f *testing.F) {\n\tf.Add(\"hello\")\n\tf.Add(\"héllo, 世界\")\n\n\tf.Fuzz(func(t *testing.T, s string) {\n\t\tif !utf8.ValidString(s) {\n\t\t\tt.Skip(\"invalid UTF-8 is out of scope\")\n\t\t}\n\t\trev := Reverse(s)\n\t\tif !utf8.ValidString(rev) {\n\t\t\tt.Errorf(\"Reverse(%q) = %q, not valid UTF-8\", s, rev)\n\t\t}\n\t\tif back := Reverse(rev); back != s {\n\t\t\tt.Errorf(\"Reverse(Reverse(%q)) = %q\", s, back)\n\t\t}\n\t})\n}\n",
          "output": "",
          "explanation": "Two seeds are registered with f.Add. For every input the property is checked: valid text stays valid after reversing (utf8.ValidString), and reversing twice returns the original."
        },
        {
          "language": "bash",
          "filename": "run-seeds.sh",
          "source": "go test -v -run FuzzReverse ./price",
          "output": "=== RUN   FuzzReverse\n=== RUN   FuzzReverse/seed#0\n=== RUN   FuzzReverse/seed#1\n--- PASS: FuzzReverse (0.00s)\n    --- PASS: FuzzReverse/seed#0 (0.00s)\n    --- PASS: FuzzReverse/seed#1 (0.00s)\nPASS\nok  \texample.com/shop/price\t0.002s",
          "explanation": "Without -fuzz, the fuzz test just runs each seed once as a subtest. This is the fast form that runs in every CI build."
        },
        {
          "language": "bash",
          "filename": "run-fuzz.sh",
          "source": "go test -fuzz=FuzzReverse -fuzztime=10s ./price",
          "output": "fuzz: elapsed: 0s, gathering baseline coverage: 0/2 completed\nfuzz: elapsed: 0s, gathering baseline coverage: 2/2 completed, now fuzzing with 8 workers\nfuzz: elapsed: 3s, execs: 1250000 (416000/sec), new interesting: 12 (total: 14)\nfuzz: elapsed: 10s, execs: 4100000 (283000/sec), new interesting: 15 (total: 17)\nPASS\nok  \texample.com/shop/price\t10.1s",
          "explanation": "Representative output: the worker count, the number of executions and all timings differ on every machine and every run. The fuzzer ran for 10 seconds and found no input that broke the property."
        }
      ],
      "productionNote": "Fuzzing is most valuable for code that handles untrusted or complex input, such as parsers, decoders and input validation. When the fuzzer finds a failing input, commit the new file under testdata/fuzz so the bug stays covered by every normal go test.",
      "commonMistakes": [
        "Writing a fuzz test that calls the function but checks no property. The fuzzer can then only find crashes, never wrong answers.",
        "Not committing the files the fuzzer saves under testdata/fuzz. Other developers and CI then lose the regression cases that found the bug.",
        "Putting slow or random behaviour (like sleeping or reading the clock) in the fuzz function. The fuzzer needs it to be fast and repeatable."
      ],
      "sources": [
        {
          "title": "Go Fuzzing",
          "url": "https://go.dev/doc/security/fuzz/"
        },
        {
          "title": "Tutorial: Getting started with fuzzing",
          "url": "https://go.dev/doc/tutorial/fuzz"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Which files does go test look at to find tests?",
      "options": [
        "Any file whose name starts with test",
        "Files whose names end in _test.go, in the package folder",
        "Only files inside a folder named tests",
        "Every .go file that contains the word testing"
      ],
      "answerIndex": 1,
      "explanation": "Test code lives in files ending in _test.go next to the code under test, in the same package. Functions inside must be named TestXxx with a capital letter after Test."
    },
    {
      "question": "What is the difference between t.Errorf and t.Fatalf?",
      "options": [
        "Errorf records a failure and the test keeps running. Fatalf records a failure and stops that test immediately",
        "Errorf stops the test immediately. Fatalf records a failure and keeps going",
        "Errorf is for tests and Fatalf is for benchmarks",
        "Errorf prints to the screen only. Fatalf is the only one that marks the test as failed"
      ],
      "answerIndex": 0,
      "explanation": "Both mark the test as failed. Errorf lets the remaining checks run, so you see more problems at once. Fatalf stops the test, which is right when continuing would be meaningless."
    },
    {
      "question": "How do you run only the subtest named negatives inside TestAddTable?",
      "options": [
        "go test negatives",
        "go test -only negatives",
        "go test -run 'TestAddTable/negatives'",
        "go test -bench=negatives"
      ],
      "answerIndex": 2,
      "explanation": "-run takes a pattern in which a slash separates the test name from the subtest name. The other commands are not valid ways to select a subtest, and -bench selects benchmarks."
    },
    {
      "question": "What does for b.Loop() replace in a benchmark?",
      "options": [
        "The t.Run call used for subtests",
        "The defer statement used for cleanup",
        "The f.Fuzz call used for fuzz tests",
        "The older for i := 0; i < b.N; i++ loop"
      ],
      "answerIndex": 3,
      "explanation": "Since Go 1.24, for b.Loop() is the recommended way to write the timed loop. It also keeps setup before the loop out of the measured time."
    },
    {
      "question": "What does a fuzz test check?",
      "options": [
        "That the code runs faster than a set number of nanoseconds",
        "That a property you define holds for many generated inputs",
        "That every line of the code has been executed",
        "That the code produces exactly one fixed output for one fixed input"
      ],
      "answerIndex": 1,
      "explanation": "A fuzz test generates many inputs and checks a property that must always be true, for example that reversing a string twice gives the original. Speed is measured by benchmarks, line execution by coverage, and a single fixed input by an ordinary test."
    }
  ]
});
