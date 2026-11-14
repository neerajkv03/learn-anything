# 04. Functions
Version: Go 1.27.4
Prerequisites: 03-control-flow

## Learning goals
- learner can declare functions with parameters and a result
- learner can return and receive multiple values, ignoring some with _
- learner can write and call variadic functions
- learner can pass functions as values and build closures
- learner can use defer and predict its order

## Sub-topics
### Declaring functions and parameters
- Concept: `func add(a, b int) int { return a + b }`; parameters are copies; shared-type shorthand `a, b int`; no default/named arguments; func name capital letter matters later (topic 12).
- Analogy: vending machine — you put in specific coins (parameters, right types only), it hands back one item (result).
- Code example: add.go — `fmt.Println(add(2, 3))` → `5`
- Production use: small focused functions; `main` stays short.
- Common mistakes: missing `return` → compile error `missing return`; wrong argument count/type.
- Sources: https://go.dev/ref/spec#Function_declarations ; https://go.dev/doc/effective_go#functions

### Multiple return values
- Concept: `func divmod(a, b int) (int, int) { return a / b, a % b }`; receive `q, r := divmod(17, 5)`; blank identifier `_` ignores one; preview: Go functions often return `(value, error)` — gloss error = value describing what went wrong, `nil` = nothing went wrong (topic 11).
- Analogy: shop receipt with two lines — total and change — handed over together.
- Code example: divmod.go — `q, r := divmod(17, 5)`; `fmt.Println(q, r)` → `3 2`; `_, r2 := divmod(9, 4)`; `fmt.Println(r2)` → `1`
- Production use: `(result, error)` pattern across the whole standard library.
- Common mistakes: receiving 2 values into 1 variable → compile error `assignment mismatch`; overusing named results with bare `return` in long functions.
- Sources: https://go.dev/doc/effective_go#multiple-returns ; https://go.dev/ref/spec#Return_statements

### Variadic functions
- Concept: `func sum(nums ...int) int` accepts zero or more ints; inside, `nums` is a slice (gloss: list of values; topic 06); spread an existing list with `sum(list...)`.
- Analogy: shopping bag — drop in any number of items, even none.
- Code example: sum.go — `fmt.Println(sum(1, 2, 3), sum())` → `6 0`; `nums := []int{4, 5}`; `fmt.Println(sum(nums...))` → `9`
- Production use: `fmt.Println(a ...any)`, `append(s, items...)`, option lists.
- Common mistakes: forgetting `...` when passing a list → type error; variadic param not last.
- Sources: https://go.dev/ref/spec#Passing_arguments_to_..._parameters

### Function values and closures
- Concept: functions are values: assign to variables, pass as arguments; anonymous `func(x int) int { … }`; closure = function that remembers variables from where it was created.
- Analogy: closure = a backpack — the function carries variables from home and keeps using them later.
- Code example: counter.go — `func makeCounter() func() int { n := 0; return func() int { n++; return n } }`; `c := makeCounter()`; `fmt.Println(c(), c(), c())` → `1 2 3`; plus `apply := func(f func(int) int, x int) int { return f(x) }` with doubling → `apply(double, 21)` → `42`
- Production use: HTTP handlers (topic 21), sort comparators, middleware.
- Common mistakes: expecting each `c()` call to restart at 0; sharing one closure across goroutines without locking (topic 16).
- Sources: https://go.dev/ref/spec#Function_literals ; https://go.dev/ref/spec#Function_types

### defer
- Concept: `defer f()` runs f when the surrounding function returns; multiple defers run last-in first-out; arguments are evaluated when `defer` runs, not at the end.
- Analogy: stack of "do on your way out" sticky notes — the last note put on top is read first.
- Code example: defer.go — `fmt.Println("start"); defer fmt.Println("deferred 1"); defer fmt.Println("deferred 2"); fmt.Println("end")` → `start`,`end`,`deferred 2`,`deferred 1`; plus `x := 1; defer fmt.Println("x =", x); x = 2` → prints `x = 1`
- Production use: closing files (topic 18), unlocking mutexes (topic 16), closing response bodies (topic 22).
- Common mistakes: defer in a long loop (piles up until function returns); expecting deferred args to see later changes.
- Sources: https://go.dev/ref/spec#Defer_statements ; https://go.dev/blog/defer-panic-and-recover

## Quiz
1. Output of divmod(17, 5) — tests multiple returns
2. What does `_` do? — tests blank identifier
3. sum() with no arguments returns? — tests variadic
4. Third call of c() returns? — tests closure state
5. Order of two deferred prints — tests LIFO
