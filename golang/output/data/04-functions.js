window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "04-functions",
  "order": 4,
  "title": "Functions",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7",
  "summary": "A function is a named, reusable block of code. You will declare functions with parameters and results, return several values at once, accept any number of arguments, treat functions as values (including closures that remember variables), and use defer to schedule clean-up work.",
  "prerequisites": [
    "03-control-flow"
  ],
  "subtopics": [
    {
      "id": "declaring-functions",
      "title": "Declaring functions and parameters",
      "explanation": "A function is a named block of code that you can run (call) as many times as you like. You have already used one: `main`. You declare your own with the keyword `func`, then the name, then the parameters in parentheses, then the type of the result, then the body in braces.\n\nA parameter is a named input listed in the declaration. An argument is the actual value you pass when you call the function. In `func add(a, b int) int { return a + b }`, `a` and `b` are parameters, and the final `int` is the type of the result. When consecutive parameters share a type you can write the type once: `a, b int` means the same as `a int, b int`.\n\n`return` ends the function and hands a value back to the code that called it (the caller). If a function declares a result type, every path through it must end in a `return`, otherwise the compiler stops with the compile error `missing return`. (A compile error is a mistake reported before the program is allowed to run.)\n\nParameters are copies. When you call `bump(x)`, the function receives its own copy of the value in `x`, so changing the parameter inside the function does not change the caller's variable. Go has no default parameter values and no named arguments: you always pass every argument, in order.\n\nA name that starts with a capital letter, such as `Add`, can be used from other packages; a lowercase name such as `add` cannot. For now every function you write starts with a lowercase letter, so only code in the same package can call it. Topic 12 explains the rule fully.",
      "analogy": "A vending machine. You must insert the right kind and number of coins (the parameters, with the right types), and it hands back one item (the result). Whatever you insert is taken as a copy of your payment for that transaction; the machine never reaches into your wallet and changes the coins you still hold.",
      "code": [
        {
          "language": "go",
          "filename": "add.go",
          "source": "package main\n\nimport \"fmt\"\n\n// add takes two ints and returns their sum.\nfunc add(a, b int) int {\n\treturn a + b\n}\n\n// bump changes its own copy of n; the caller's variable is untouched.\nfunc bump(n int) int {\n\tn = n + 100\n\treturn n\n}\n\nfunc main() {\n\tfmt.Println(add(2, 3))\n\n\tx := 10\n\tfmt.Println(bump(x))\n\tfmt.Println(x)\n}\n",
          "output": "5\n110\n10",
          "explanation": "Save as add.go in the module folder from topic 01 and run `go run add.go` (not `go run .`, because hello.go there already has a main function). `add(2, 3)` passes arguments 2 and 3 to parameters a and b and prints 5. `bump(x)` receives a copy of 10, adds 100 to the copy and returns 110, but `x` in main is still 10."
        }
      ],
      "productionNote": "Keep functions small and focused on one job, with a name that says what it does. Keep `main` short: it should mostly call other functions. Small functions are easier to test (topic 20) and to read.",
      "commonMistakes": [
        "Forgetting `return` in a function that declares a result type, which gives the compile error `missing return`.",
        "Passing the wrong number or type of arguments, for example `add(1)` or `add(1, \"2\")`. Go reports a compile error (`not enough arguments in call` or a type mismatch) because there are no default values.",
        "Expecting a function to change the caller's variable by assigning to its parameter. The parameter is only a copy."
      ],
      "sources": [
        {
          "title": "The Go Specification: Function declarations",
          "url": "https://go.dev/ref/spec#Function_declarations"
        },
        {
          "title": "Effective Go: Functions",
          "url": "https://go.dev/doc/effective_go#functions"
        }
      ]
    },
    {
      "id": "multiple-return-values",
      "title": "Multiple return values",
      "explanation": "A Go function can return more than one value. List the result types in parentheses: `func divmod(a, b int) (int, int) { return a / b, a % b }` returns the quotient (the whole-number result of the division) and the remainder (from topic 3: `/` and `%` on ints).\n\nThe caller receives all values at once with `:=`, in order: `q, r := divmod(17, 5)`. You must receive every value the function returns. Writing `q := divmod(17, 5)` is a compile error: `assignment mismatch: 1 variable but divmod returns 2 values`.\n\nIf you do not need one of the values, assign it to the blank identifier `_`. It is a write-only placeholder that discards the value, so Go does not complain about an unused variable: `_, r2 := divmod(9, 4)` keeps only the remainder.\n\nThis feature is the foundation of error handling in Go. Many functions return `(value, error)`. An `error` is a value that describes what went wrong, and `nil` means \"no value\", so an error of `nil` means nothing went wrong. You will meet this properly in topic 11; for now, just know why returning two values is so common.\n\nGo also allows naming the results, such as `(q, r int)`, and then writing a bare `return` with no values. That works but makes long functions hard to follow, so prefer explicit `return a / b, a % b`.",
      "analogy": "A shop receipt with two lines: the total and your change. Both are handed over together in one go. If you only care about the change, you can ignore the total line (the blank identifier), but the cashier still prints both.",
      "code": [
        {
          "language": "go",
          "filename": "divmod.go",
          "source": "package main\n\nimport \"fmt\"\n\n// divmod returns the quotient and the remainder of a divided by b.\nfunc divmod(a, b int) (int, int) {\n\treturn a / b, a % b\n}\n\nfunc main() {\n\tq, r := divmod(17, 5)\n\tfmt.Println(q, r)\n\n\t_, r2 := divmod(9, 4)\n\tfmt.Println(r2)\n}\n",
          "output": "3 2\n1",
          "explanation": "17 divided by 5 is 3 with remainder 2, so the first line is `3 2`. In the second call the quotient (2) is discarded with `_`, and only the remainder 1 is stored in `r2`."
        }
      ],
      "productionNote": "The `(result, error)` pattern is used across the whole standard library: opening files, parsing numbers, making network calls. Learning to read and write two-value returns now makes all of those natural.",
      "commonMistakes": [
        "Receiving two values into one variable (`q := divmod(17, 5)`), which gives the compile error `assignment mismatch`.",
        "Using named results with a bare `return` in long functions, where the reader can no longer see what is returned.",
        "Assigning a value to a normal variable you never use. Use `_` for values you intentionally ignore."
      ],
      "sources": [
        {
          "title": "Effective Go: Multiple return values",
          "url": "https://go.dev/doc/effective_go#multiple-returns"
        },
        {
          "title": "The Go Specification: Return statements",
          "url": "https://go.dev/ref/spec#Return_statements"
        }
      ]
    },
    {
      "id": "variadic-functions",
      "title": "Variadic functions",
      "explanation": "A variadic function accepts zero or more arguments for its last parameter. You mark that parameter with three dots before the type: `func sum(nums ...int) int`. You can then call `sum()`, `sum(1)` or `sum(1, 2, 3)`.\n\nInside the function, `nums` is a slice: an ordered list of values of one type (topic 6 covers slices in depth). Two things are enough for now. `len(nums)` is the number of items, and `nums[0]` is the first item (counting starts at 0, so the last valid index is `len(nums) - 1`). With no arguments, `nums` is an empty list and `len(nums)` is 0.\n\nIf you already have a slice, pass it with three dots after it: `sum(nums...)`. The dots tell Go to spread the list into separate arguments. A slice literal such as `[]int{4, 5}` creates a list holding 4 and 5.\n\nThe variadic parameter must be the last one in the parameter list, and a function can have only one.",
      "analogy": "A shopping bag. You can drop in any number of items, even none, and the cashier receives the bag as one list. Passing `list...` is like tipping out a bag you already packed so each item is rung up on its own.",
      "code": [
        {
          "language": "go",
          "filename": "sum.go",
          "source": "package main\n\nimport \"fmt\"\n\n// sum adds up any number of ints.\nfunc sum(nums ...int) int {\n\ttotal := 0\n\tfor i := 0; i < len(nums); i++ {\n\t\ttotal += nums[i]\n\t}\n\treturn total\n}\n\nfunc main() {\n\tfmt.Println(sum(1, 2, 3), sum())\n\n\tnums := []int{4, 5}\n\tfmt.Println(sum(nums...))\n}\n",
          "output": "6 0\n9",
          "explanation": "`sum(1, 2, 3)` builds the list 1, 2, 3 and returns 6. `sum()` receives an empty list, so the loop never runs and the result is the starting value 0. `sum(nums...)` spreads the existing list 4, 5 into the call and returns 9."
        }
      ],
      "productionNote": "You already use variadic functions: `fmt.Println` takes `a ...any` (`any` means a value of any type), and the built-in `append(s, items...)` (adds items to a slice, topic 06) adds many items to a slice. Variadic parameters are also a common way to offer optional settings, such as `NewServer(addr, opts...)`.",
      "commonMistakes": [
        "Passing a slice without the three dots (`sum(nums)`), which is a type error because a list is not a single int.",
        "Putting the variadic parameter anywhere except last, which is a compile error.",
        "Mixing individual values and a spread list in one call (`sum(1, nums...)`). Use either separate arguments or one spread list."
      ],
      "sources": [
        {
          "title": "The Go Specification: Passing arguments to ... parameters",
          "url": "https://go.dev/ref/spec#Passing_arguments_to_..._parameters"
        }
      ]
    },
    {
      "id": "function-values-and-closures",
      "title": "Function values and closures",
      "explanation": "In Go, functions are values, just like numbers and strings. You can store a function in a variable, pass it to another function as an argument and return it from a function. The type of a function value lists its parameters and result, for example `func(int) int` means \"takes an int, returns an int\".\n\nAn anonymous function (also called a function literal) is a function written without a name, directly where a value is expected: `double := func(x int) int { return x * 2 }`. You call it like any other function: `double(21)`.\n\nA closure is a function that remembers the variables from the place where it was created and keeps using them, even after the surrounding function has finished. In `makeCounter`, the variable `n` belongs to that call. The returned function increases and returns the same `n` each time it is called, so successive calls give 1, 2, 3.\n\nEach call to `makeCounter` creates a new `n`, so two counters count independently. Calling the same counter again does not restart it at 0.",
      "analogy": "A backpack. When a function is created it packs the variables it needs from home, then carries them wherever it goes and keeps using them. Passing a function around is like handing someone a tool: they use it without knowing how it was made. Each backpack is packed separately, so two counters never share their contents.",
      "code": [
        {
          "language": "go",
          "filename": "counter.go",
          "source": "package main\n\nimport \"fmt\"\n\n// makeCounter returns a function that remembers n between calls.\nfunc makeCounter() func() int {\n\tn := 0\n\treturn func() int {\n\t\tn++\n\t\treturn n\n\t}\n}\n\nfunc main() {\n\tc := makeCounter()\n\tfmt.Println(c(), c(), c())\n\n\td := makeCounter()\n\tfmt.Println(d())\n\n\tdouble := func(x int) int { return x * 2 }\n\tapply := func(f func(int) int, x int) int { return f(x) }\n\tfmt.Println(apply(double, 21))\n}\n",
          "output": "1 2 3\n1\n42",
          "explanation": "`c` is a closure holding its own `n`. The three calls inside one `Println` run left to right and print `1 2 3`. `d` comes from a second call to `makeCounter`, so it has a fresh `n` and its first call returns 1. `apply` takes a function `f` and a number, and calls `f` on it; passing `double` and 21 gives 42."
        }
      ],
      "productionNote": "Function values appear everywhere in real Go: HTTP handlers (functions that answer web requests; HTTP is the protocol browsers and servers use to talk, topic 21), sort comparison functions and middleware (code that wraps a handler to add behaviour). Closures are how such functions carry configuration with them.",
      "commonMistakes": [
        "Expecting each call to `c()` to restart at 0. The closure keeps its variable between calls; create a new counter if you want a fresh start.",
        "Sharing one closure between goroutines (functions running at the same time, topic 15) without locking. Two goroutines changing the same remembered variable cause bugs; topic 16 shows the fix.",
        "Calling a function value that is `nil` (a function variable that was never assigned), which crashes the program."
      ],
      "sources": [
        {
          "title": "The Go Specification: Function literals",
          "url": "https://go.dev/ref/spec#Function_literals"
        },
        {
          "title": "The Go Specification: Function types",
          "url": "https://go.dev/ref/spec#Function_types"
        }
      ]
    },
    {
      "id": "defer",
      "title": "defer",
      "explanation": "`defer` schedules a function call to run later, at the moment the surrounding function returns. Write `defer` in front of an ordinary call: `defer fmt.Println(\"bye\")`. The program carries on with the next line, and the deferred call runs just before the function finishes, even if it ends early through a `return`.\n\nIf you defer several calls, they run in last-in, first-out order: the most recently deferred call runs first.\n\nThe arguments of a deferred call are evaluated immediately, when the `defer` line runs, not when the call finally happens. If you defer `fmt.Println(\"x =\", x)` while `x` is 1 and later set `x` to 2, the deferred call still prints `x = 1`.\n\nThe usual use is clean-up that must not be forgotten: put the clean-up right next to the code that needs it, and Go guarantees it runs.",
      "analogy": "A spike of sticky notes marked \"do on your way out\". Each new note goes on top of the pile, and on the way out you read from the top, so the last note you stuck down is the first one you do. The note is written when you stick it, so what it says does not change later.",
      "code": [
        {
          "language": "go",
          "filename": "defer.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"start\")\n\tdefer fmt.Println(\"deferred 1\")\n\tdefer fmt.Println(\"deferred 2\")\n\n\tx := 1\n\tdefer fmt.Println(\"x =\", x)\n\tx = 2\n\n\tfmt.Println(\"end\", x)\n}\n",
          "output": "start\nend 2\nx = 1\ndeferred 2\ndeferred 1",
          "explanation": "`start` and `end 2` print immediately in program order. When `main` returns, the deferred calls run from last to first: the `x` note was deferred last, so it runs first. Its argument was captured as 1 when the `defer` line ran, so it prints `x = 1` even though x is 2 by then. Then `deferred 2` runs, then `deferred 1`."
        }
      ],
      "productionNote": "defer is how Go code reliably releases things: closing files (topic 18), unlocking a mutex (a lock that lets one goroutine at a time use shared data, topic 16) and closing the bodies of HTTP responses (the content a web server sends back; topic 22). Write the defer immediately after the call that acquires the resource.",
      "commonMistakes": [
        "Using defer inside a long loop. Deferred calls pile up and only run when the whole function returns, not at the end of each loop pass.",
        "Expecting a deferred call's arguments to see later changes to a variable. They are fixed when the `defer` line executes.",
        "Forgetting the order is last-in, first-out and assuming deferred calls run top to bottom."
      ],
      "sources": [
        {
          "title": "The Go Specification: Defer statements",
          "url": "https://go.dev/ref/spec#Defer_statements"
        },
        {
          "title": "The Go Blog: Defer, Panic, and Recover",
          "url": "https://go.dev/blog/defer-panic-and-recover"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Given `func divmod(a, b int) (int, int) { return a / b, a % b }`, what does `q, r := divmod(17, 5)` followed by `fmt.Println(q, r)` print?",
      "options": [
        "3 2",
        "2 3",
        "3",
        "17 5"
      ],
      "answerIndex": 0,
      "explanation": "17 / 5 is 3 (whole-number division) and 17 % 5 is 2 (the remainder), returned in that order, so `q` is 3 and `r` is 2."
    },
    {
      "question": "What does the blank identifier `_` do in `_, r2 := divmod(9, 4)`?",
      "options": [
        "It discards the first returned value so you do not need a variable for it",
        "It sets the first returned value to zero",
        "It makes the function return only one value",
        "It marks the variable r2 as private to the package"
      ],
      "answerIndex": 0,
      "explanation": "`_` is a write-only placeholder. The first value is thrown away, so no unused variable is left behind, and `r2` receives the second value."
    },
    {
      "question": "With `func sum(nums ...int) int` that adds up its arguments, what does `sum()` return?",
      "options": [
        "A compile error, because arguments are required",
        "1",
        "0",
        "nil"
      ],
      "answerIndex": 2,
      "explanation": "A variadic parameter accepts zero or more arguments. With none, `nums` is an empty list, nothing is added and the total stays 0."
    },
    {
      "question": "After `c := makeCounter()` (the closure that does `n++` and returns `n`), what does the third call `c()` return?",
      "options": [
        "1",
        "2",
        "3",
        "0"
      ],
      "answerIndex": 2,
      "explanation": "The closure keeps its own `n` between calls, so the calls return 1, 2 and 3 in turn."
    },
    {
      "question": "What order do these lines print in?\n\ndefer fmt.Println(\"A\")\ndefer fmt.Println(\"B\")\nfmt.Println(\"C\")",
      "options": [
        "A, B, C",
        "C, A, B",
        "B, A, C",
        "C, B, A"
      ],
      "answerIndex": 3,
      "explanation": "`C` prints at once. When the function returns, deferred calls run last-in, first-out, so `B` runs before `A`."
    }
  ]
});
