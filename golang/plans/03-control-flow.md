# 03. Operators & Control Flow
Version: Go 1.27.4
Prerequisites: 02-variables-types

## Learning goals
- learner can use arithmetic, comparison and logical operators
- learner can branch with if/else, including an init statement
- learner can write all for-loop forms, incl. range over an int
- learner can replace if chains with switch
- learner can control loops with break and continue

## Sub-topics
### Arithmetic, comparison and logical operators
- Concept: + - * / %; int division truncates (7/2 = 3), % remainder; float 7.0/2 = 3.5; ++/-- are statements only; == != < <= > >=; && || ! short-circuit.
- Analogy: calculator for math; yes/no questions for comparisons; short-circuit = two locked doors in a row — if the first is locked you never try the second.
- Code example: ops.go — `fmt.Println(7/2, 7%2, 7.0/2, 3 < 5 && 2 > 1, !true)` → `3 1 3.5 true false`
- Production use: pagination math `offset := (page-1) * size`; validation checks.
- Common mistakes: expecting 3.5 from int division; `y := x++` → compile error (++ is not an expression).
- Sources: https://go.dev/ref/spec#Arithmetic_operators ; https://go.dev/ref/spec#Comparison_operators ; https://go.dev/ref/spec#Logical_operators

### if/else with init statement
- Concept: `if cond { } else if cond { } else { }`, no parentheses, braces required; init form `if n := len(s); n > 3 { }` — n lives only inside that if/else.
- Analogy: bouncer at a door — checks a rule and sends you one way; the init statement is a wristband handed out at that door, valid only inside that venue.
- Code example: grade.go — `score := 72`; ≥90 "A", else ≥70 "B", else "C" → `B`; then `if n := len("gopher"); n > 3 { fmt.Println("long name", n) }` → `long name 6` (len gloss: number of bytes; equals letters for plain English text; detail topic 05)
- Production use: `if err := save(); err != nil { }` (topic 11).
- Common mistakes: `else` on a new line after `}` → syntax error; using the init variable after the if.
- Sources: https://go.dev/ref/spec#If_statements

### for loops (classic, condition-only, range over int)
- Concept: only `for`: classic `for i := 0; i < 3; i++`; condition-only `for n > 1` (the "while"); infinite `for { }` + break; `for i := range 3` → 0,1,2 (Go 1.22+); each iteration gets its own loop variable (Go 1.22+).
- Analogy: laps on a track — classic = "count laps 0 to 2", condition-only = "keep running while you have energy", infinite = "run until the coach whistles".
- Code example: loops.go — classic with `fmt.Println(i)` → `0`,`1`,`2` on separate lines; `n := 8; for n > 1 { fmt.Println(n); n /= 2 }` → `8`,`4`,`2`; `for i := range 3 { fmt.Println(i) }` → `0`,`1`,`2`
- Production use: retry loops, polling, processing N items.
- Common mistakes: looking for a `while` keyword; off-by-one `<=`; infinite loop with no break.
- Sources: https://go.dev/ref/spec#For_statements ; https://go.dev/ref/spec#For_range

### switch
- Concept: `switch day { case "sat", "sun": … default: … }`; no automatic fallthrough; tagless `switch { case t < 10: }` replaces if-else chains; `fallthrough` keyword exists, rarely used.
- Analogy: station departure board — your ticket matches one platform and you board only that train, never the next one too.
- Code example: day.go — `day := "sun"` → `weekend`; tagless `temp := 31`: `<10` "cold", `<25` "mild", default "hot" → `hot`
- Production use: dispatch on command/method names, state machines, code → message mapping.
- Common mistakes: writing `break` in each case (unneeded); expecting C-style fallthrough.
- Sources: https://go.dev/ref/spec#Switch_statements

### break and continue
- Concept: `continue` jumps to next iteration, `break` leaves the loop; labeled break (`outer:` … `break outer`) for nested loops / switch inside for.
- Analogy: playlist — continue = skip this song, break = switch the music off.
- Code example: skip.go — `for i := range 10 { if i%2 == 1 { continue }; if i > 6 { break }; fmt.Println(i) }` → `0`,`2`,`4`,`6` on separate lines
- Production use: skip invalid records; stop at first match.
- Common mistakes: `break` inside a `switch` inside a `for` only leaves the switch — use a label.
- Sources: https://go.dev/ref/spec#Break_statements ; https://go.dev/ref/spec#Continue_statements

## Quiz
1. Result of 7/2 with ints? — tests int division
2. Where does a variable from an if init statement exist? — tests scope
3. How do you write a "while" loop in Go? — tests for cond {}
4. Does a matching case run the next case too? — tests no fallthrough
5. Output of skip.go — tests break/continue
