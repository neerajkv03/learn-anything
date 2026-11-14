window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "11-error-handling",
  "order": 11,
  "title": "Error Handling",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Go reports expected failures as ordinary values of the built-in error type instead of exceptions (a crash-and-catch system used by some other languages). You will learn to check and return errors, wrap them with context, inspect them with errors.Is, errors.As and errors.AsType, define your own error types, and know the narrow cases where panic (a crash for serious bugs) and recover (stopping a crash) are appropriate.",
  "prerequisites": [
    "10-methods-interfaces"
  ],
  "subtopics": [
    {
      "id": "error-type-and-if-err-nil",
      "title": "The error type and if err != nil",
      "explanation": "Things go wrong in real programs: a file is missing, a number is typed as letters, a network drops. Go handles these expected failures with plain values rather than a special exception mechanism. The built-in type `error` is an interface (a set of methods a type must have, as you saw in the previous topic) with exactly one method: `Error() string`. Any type that has that method is an error, and the string it returns is the human-readable message.\n\nBy convention a function that can fail returns its error as the last result, for example `(int, error)`. If the call worked, the error is `nil` (Go's \"nothing here\" value). If it failed, the error is not `nil` and describes what happened. So `nil` means success.\n\nThe standard pattern is to check right after the call: `if err != nil { ... }`. Inside the block you either handle the problem or return early, passing the error up to your caller. Returning early keeps the normal, successful path unindented and easy to read. On failure, return zero values (such as `0`) for the other results and ignore them.\n\nHandle each error once. Either handle it (for example, print a message and stop) or return it to the caller. Doing both, logging it and also returning it, makes the same failure appear several times in the logs.",
      "analogy": "Think of a delivery receipt with a \"problem\" box. If the box is empty (nil), the parcel arrived fine. If something is written in the box, you read it before you open or use the parcel. You always look at the box first, and you never use a parcel the receipt says is damaged.",
      "code": [
        {
          "language": "go",
          "filename": "atoi.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"strconv\"\n)\n\nfunc main() {\n\tn, err := strconv.Atoi(\"abc\")\n\tif err != nil {\n\t\tfmt.Println(\"error:\", err)\n\t\treturn\n\t}\n\tfmt.Println(n)\n}\n",
          "output": "error: strconv.Atoi: parsing \"abc\": invalid syntax",
          "explanation": "strconv.Atoi converts text to an int and returns (int, error). The text \"abc\" is not a number, so err is not nil, the message is printed, and main returns before the number is used. To run it, save the file in a folder that has a go.mod (go mod init example) and run `go run .`."
        },
        {
          "language": "go",
          "filename": "addone.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"strconv\"\n)\n\nfunc addOne(s string) (int, error) {\n\tn, err := strconv.Atoi(s)\n\tif err != nil {\n\t\treturn 0, err\n\t}\n\treturn n + 1, nil\n}\n\nfunc main() {\n\tfor _, s := range []string{\"41\", \"x\"} {\n\t\tresult, err := addOne(s)\n\t\tif err != nil {\n\t\t\tfmt.Println(s, \"->\", \"error:\", err)\n\t\t\tcontinue\n\t\t}\n\t\tfmt.Println(s, \"->\", result)\n\t}\n}\n",
          "output": "41 -> 42\nx -> error: strconv.Atoi: parsing \"x\": invalid syntax",
          "explanation": "addOne checks the error immediately and returns it to its caller (0 is a placeholder that the caller must ignore). On success it returns the result and nil. The caller in main decides what to do: print the error and move on to the next input with continue."
        }
      ],
      "productionNote": "Every input/output step, parsing step and network call in real Go code can fail, so this check appears constantly. Never discard an error silently. Decide at each level whether to handle it or return it, and do one or the other, not both.",
      "commonMistakes": [
        "Ignoring the error by assigning it to the blank identifier `_` (`n, _ := strconv.Atoi(s)`). The program then continues with a meaningless value such as 0 and the real problem is hidden.",
        "Using the other results when err is not nil. On failure, those values are usually zero values and must not be trusted.",
        "Logging an error and then returning it as well. The caller usually logs it too, so one failure produces duplicate log lines."
      ],
      "sources": [
        {
          "title": "Error handling and Go",
          "url": "https://go.dev/blog/error-handling-and-go"
        },
        {
          "title": "builtin: type error",
          "url": "https://pkg.go.dev/builtin#error"
        }
      ]
    },
    {
      "id": "errors-new-and-wrapping",
      "title": "errors.New and fmt.Errorf with %w",
      "explanation": "To create a brand-new error, call `errors.New(\"not found\")` from the standard `errors` package. It returns an `error` whose message is that text. Style rule: messages start lowercase and have no trailing punctuation, because they are usually joined into longer messages.\n\nAn error that callers are expected to recognise is often stored in a package-level variable, called a sentinel error (a fixed, named error value): `var ErrNotFound = errors.New(\"not found\")`. By convention the name starts with `Err`.\n\nAs an error travels up through your functions, each layer can add context with `fmt.Errorf`. It works like `fmt.Sprintf` but returns an `error`. The special verb `%w` (\"wrap\") puts the original error inside the new one: `fmt.Errorf(\"load user %d: %w\", 7, ErrNotFound)`. The message reads `load user 7: not found`, and the original error is still stored inside so code can find it later.\n\nIf you use `%v` instead of `%w`, you get the same text, but the original error is only copied as text and is lost as a value. Callers can then no longer detect it with the tools in the next sub-topic. Use `%w` whenever callers may need to check for the cause.\n\nWrapping can be repeated, building a chain such as `handle request: load user 7: not found`. Each layer says what it was doing when the failure happened.",
      "analogy": "An envelope inside an envelope. Each layer of the program adds a note on a new outer envelope (\"while loading user 7\", then \"while handling the request\"), but the original letter stays sealed inside, unchanged, so anyone can still open the layers and read it. Using %v is like copying the letter's words onto the outer note and throwing the original away.",
      "code": [
        {
          "language": "go",
          "filename": "wrap.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n)\n\nvar ErrNotFound = errors.New(\"not found\")\n\nfunc main() {\n\terr := fmt.Errorf(\"load user %d: %w\", 7, ErrNotFound)\n\tfmt.Println(err)\n\n\tplain := fmt.Errorf(\"load user %d: %v\", 7, ErrNotFound)\n\tfmt.Println(plain)\n\n\touter := fmt.Errorf(\"handle request: %w\", err)\n\tfmt.Println(outer)\n}\n",
          "output": "load user 7: not found\nload user 7: not found\nhandle request: load user 7: not found",
          "explanation": "err wraps ErrNotFound with %w. plain prints identically but used %v, so it does not contain ErrNotFound as a value (the next sub-topic shows the difference). outer wraps err again, building a two-layer chain on top of the sentinel."
        }
      ],
      "productionNote": "Production error messages read like a path: `handle request: load user 7: query: connection refused`. Each function adds only its own short context and wraps with %w.",
      "commonMistakes": [
        "Using `%v` when callers need to detect the cause with errors.Is or errors.As. The text looks the same, but the link to the original error is gone.",
        "Writing messages with capital letters or trailing punctuation (\"Failed to load user.\"). Wrapped, they read badly: `handle request: Failed to load user.: not found`."
      ],
      "sources": [
        {
          "title": "fmt.Errorf",
          "url": "https://pkg.go.dev/fmt#Errorf"
        },
        {
          "title": "Working with Errors in Go 1.13",
          "url": "https://go.dev/blog/go1.13-errors"
        },
        {
          "title": "Go 1.27 Release Notes",
          "url": "https://go.dev/doc/go1.27"
        }
      ]
    },
    {
      "id": "errors-is-as-astype",
      "title": "errors.Is, errors.As and errors.AsType",
      "explanation": "Once errors are wrapped, comparing with `==` stops working, because the outer error is a different value from the one inside it. Use `errors.Is(err, ErrNotFound)` instead. It looks through every wrap layer for that exact error value and returns a `bool`.\n\nSometimes you do not want one specific value but any error of a certain type, so you can read its fields. For that, use `errors.AsType`, added in Go 1.26. It is generic (you give the type in square brackets): `ne, ok := errors.AsType[*strconv.NumError](err)`. It finds the first error in the chain of that type and returns it plus a `bool` that is true when one was found.\n\nThe older form is `errors.As(err, &target)`, where `target` is a variable of the wanted type and you pass its address with `&`. It also returns a `bool` and fills `target`. The second argument must be a non-nil pointer, otherwise `errors.As` panics (it stops the program with an error message). Prefer `AsType` in new code because the compiler checks the type for you.\n\nThe standard library already offers an example: `strconv.Atoi` returns a `*strconv.NumError`, a struct with fields `Func` (the function name), `Num` (the input text) and `Err` (the reason). Its reason is `strconv.ErrSyntax` for text that is not a number, which `errors.Is` can find too.",
      "analogy": "errors.Is is searching a stack of nested envelopes for one specific signed letter: either that exact letter is in there or it is not. errors.As and AsType are searching for any letter printed on a certain form, then pulling it out so you can read the form's fields.",
      "code": [
        {
          "language": "go",
          "filename": "is.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n)\n\nvar ErrNotFound = errors.New(\"not found\")\n\nfunc main() {\n\terr := fmt.Errorf(\"load user %d: %w\", 7, ErrNotFound)\n\touter := fmt.Errorf(\"handle request: %w\", err)\n\tfmt.Println(outer == ErrNotFound, errors.Is(outer, ErrNotFound))\n\n\tflattened := fmt.Errorf(\"load user %d: %v\", 7, ErrNotFound)\n\tfmt.Println(errors.Is(flattened, ErrNotFound))\n}\n",
          "output": "false true\nfalse",
          "explanation": "The == comparison is false because outer is a different value from ErrNotFound. errors.Is walks through both layers and finds it, so it prints true. The last line is false because %v discarded the original error."
        },
        {
          "language": "go",
          "filename": "numerror.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n\t\"strconv\"\n)\n\nfunc main() {\n\t_, err := strconv.Atoi(\"abc\")\n\terr = fmt.Errorf(\"parse age: %w\", err)\n\tfmt.Println(err)\n\n\tif ne, ok := errors.AsType[*strconv.NumError](err); ok {\n\t\tfmt.Println(ne.Func, ne.Num)\n\t}\n\n\tvar target *strconv.NumError\n\tif errors.As(err, &target) {\n\t\tfmt.Println(target.Func, target.Num)\n\t}\n\n\tfmt.Println(errors.Is(err, strconv.ErrSyntax))\n}\n",
          "output": "parse age: strconv.Atoi: parsing \"abc\": invalid syntax\nAtoi abc\nAtoi abc\ntrue",
          "explanation": "The error from Atoi is wrapped once with context. AsType and As both reach through the wrapper to the *strconv.NumError and let you read its Func and Num fields. errors.Is finds the sentinel strconv.ErrSyntax stored inside the NumError."
        }
      ],
      "productionNote": "Web services map error values to responses: errors.Is(err, ErrNotFound) becomes an HTTP 404 (topic 21), and a database lookup that finds no row returns sql.ErrNoRows, which you detect with errors.Is (topic 24).",
      "commonMistakes": [
        "Comparing a wrapped error with `==` (`err == ErrNotFound`). It is false as soon as any layer wraps the error. Use errors.Is.",
        "Passing a non-pointer, or nil, as the second argument of errors.As. It panics. Pass a pointer to a variable, or use errors.AsType, which avoids this.",
        "Checking error text with strings.Contains(err.Error(), ...). Messages change; use errors.Is or errors.As."
      ],
      "sources": [
        {
          "title": "errors.Is",
          "url": "https://pkg.go.dev/errors#Is"
        },
        {
          "title": "errors.As",
          "url": "https://pkg.go.dev/errors#As"
        },
        {
          "title": "errors.AsType",
          "url": "https://pkg.go.dev/errors#AsType"
        }
      ]
    },
    {
      "id": "custom-error-types",
      "title": "Custom error types",
      "explanation": "A message string is sometimes not enough. A validation failure might need to say which field was wrong. You can define your own error type: a struct with an `Error() string` method. Because the method exists, the type satisfies the `error` interface automatically (implicit implementation, as in the previous topic).\n\nUsually the method has a pointer receiver, and you create values with `&`: `&ValidationError{Field: \"email\"}`. Then the type that implements error is `*ValidationError`, so that is the type you ask for in `errors.AsType[*ValidationError](err)`. If you ask for `ValidationError` without the star, nothing matches and the lookup fails.\n\nCustom errors can be wrapped like any other error, and errors.AsType (or errors.As) finds them through the layers, giving you access to the extra fields.\n\nThere is one trap, the typed nil. If a function with result type `error` returns a variable of type `*ValidationError` that happens to be nil, the interface value is not nil: it holds a type with a nil pointer inside. The check `err != nil` is then true even though nothing went wrong. When there is no error, return the literal `nil` directly.",
      "analogy": "A custom incident report form. A plain error is a note saying \"something went wrong\". A custom error is a printed form that also has labelled boxes (which field, which rule), so whoever receives it can read the details without guessing from the sentence. A typed nil is a blank form sealed in an envelope marked error: the envelope is never empty, so the desk treats it as a problem even though the form is blank.",
      "code": [
        {
          "language": "go",
          "filename": "custom.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n)\n\ntype ValidationError struct {\n\tField string\n}\n\nfunc (e *ValidationError) Error() string {\n\treturn e.Field + \" is required\"\n}\n\nfunc signup(email string) error {\n\tif email == \"\" {\n\t\treturn fmt.Errorf(\"signup: %w\", &ValidationError{Field: \"email\"})\n\t}\n\treturn nil\n}\n\nfunc main() {\n\terr := signup(\"\")\n\tfmt.Println(err)\n\n\tif ve, ok := errors.AsType[*ValidationError](err); ok {\n\t\tfmt.Println(ve.Field)\n\t}\n\n\tvar ve *ValidationError\n\tif errors.As(err, &ve) {\n\t\tfmt.Println(ve.Field)\n\t}\n}\n",
          "output": "signup: email is required\nemail\nemail",
          "explanation": "ValidationError carries a Field. signup wraps it with context. AsType and As both locate the *ValidationError inside the wrapper so main can read Field."
        },
        {
          "language": "go",
          "filename": "typednil.go",
          "source": "package main\n\nimport \"fmt\"\n\ntype ValidationError struct {\n\tField string\n}\n\nfunc (e *ValidationError) Error() string {\n\treturn e.Field + \" is required\"\n}\n\nfunc bad() error {\n\tvar ve *ValidationError\n\treturn ve\n}\n\nfunc good() error {\n\treturn nil\n}\n\nfunc main() {\n\tfmt.Println(bad() == nil)\n\tfmt.Println(good() == nil)\n}\n",
          "output": "false\ntrue",
          "explanation": "bad returns a nil *ValidationError inside an error interface, so the interface itself is not nil and the comparison prints false. good returns the literal nil and prints true."
        }
      ],
      "productionNote": "Validation errors that carry a field name let an HTTP handler answer with status 400 and tell the client exactly which field to fix. Keep custom error types small, and give each a pointer-receiver Error method.",
      "commonMistakes": [
        "Returning a nil pointer of a custom type as `error`. The result is a non-nil error. Return the literal `nil` for success.",
        "Mismatching value and pointer: the method is on `*ValidationError` but you look for `ValidationError`, so AsType or As never finds it.",
        "Putting everything into the message string and parsing it later, instead of using fields on the type."
      ],
      "sources": [
        {
          "title": "Error handling and Go",
          "url": "https://go.dev/blog/error-handling-and-go"
        },
        {
          "title": "Go FAQ: Why is my nil error value not equal to nil?",
          "url": "https://go.dev/doc/faq#nil_error"
        }
      ]
    },
    {
      "id": "panic-and-recover",
      "title": "panic and recover (when not to use)",
      "explanation": "A panic is a failure so serious that the program cannot reasonably continue: a bug or an impossible state, such as dividing an integer by zero or using a nil pointer. When code panics, the current function stops, then each calling function stops in turn (this is called unwinding), running its deferred calls on the way. If nothing stops the panic, the program crashes with a message.\n\n`recover()` is a built-in function that stops a panic and returns the panic value. It only works when called directly inside a deferred function (a function scheduled with `defer`, which you learned earlier). Called anywhere else, it returns nil and does nothing.\n\nFor normal, expected failures such as bad user input, a missing file or a failed network call, return an `error`. Do not panic. Panic is for programmer mistakes and for startup code that cannot work without something.\n\nThat last case gives the `Must` pattern: a helper that panics on error, used only for setup that must succeed, for example `regexp.MustCompile` (it turns text into a pattern matcher and panics if the text is invalid). A bad value there is a bug found as soon as the program starts.",
      "analogy": "Errors are complaint forms: normal business, handled at the desk. A panic is the fire alarm, reserved for real emergencies. recover is a fire door at the edge of the building: it stops one fire from burning down the whole city, so everyone else can keep working.",
      "code": [
        {
          "language": "go",
          "filename": "recover.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc safeDiv(a, b int) (q int, err error) {\n\tdefer func() {\n\t\tif r := recover(); r != nil {\n\t\t\terr = fmt.Errorf(\"recovered: %v\", r)\n\t\t}\n\t}()\n\treturn a / b, nil\n}\n\nfunc main() {\n\tq, err := safeDiv(10, 2)\n\tfmt.Println(q, err)\n\n\tq, err = safeDiv(1, 0)\n\tfmt.Println(q, err)\n}\n",
          "output": "5 <nil>\n0 recovered: runtime error: integer divide by zero",
          "explanation": "q and err are named results (the result slots have names, so the deferred function can reach them and set err) after a panic. Dividing by zero panics, the deferred function calls recover, and safeDiv returns normally with an ordinary error. q stays 0 because the return statement never completed."
        },
        {
          "language": "go",
          "filename": "must.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"strconv\"\n)\n\nfunc mustAtoi(s string) int {\n\tn, err := strconv.Atoi(s)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\treturn n\n}\n\nvar port = mustAtoi(\"8080\")\n\nfunc main() {\n\tfmt.Println(\"port:\", port)\n}\n",
          "output": "port: 8080",
          "explanation": "mustAtoi is a Must helper: it panics if the text is not a number. It is safe here because the value is a fixed constant in the source, so a failure would be a programming bug caught immediately at startup."
        }
      ],
      "productionNote": "Use Must helpers only for fixed values at program startup. The net/http package recovers panics per request, so one broken handler does not kill the whole server, and web services add their own recovery middleware (topic 21). Recovery is a safety net, not a way to handle ordinary errors.",
      "commonMistakes": [
        "Panicking for normal failures such as bad input or a missing file. Return an error instead.",
        "Calling recover() outside a deferred function, or in a function called by the deferred function. It returns nil and the panic continues.",
        "Using panic and recover as a general try/catch replacement. Go code is meant to pass errors as values."
      ],
      "sources": [
        {
          "title": "Defer, Panic, and Recover",
          "url": "https://go.dev/blog/defer-panic-and-recover"
        },
        {
          "title": "The Go Specification: Handling panics",
          "url": "https://go.dev/ref/spec#Handling_panics"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "A function returns (int, error) and the error result is nil. What does that mean?",
      "options": [
        "The call failed and the int is invalid",
        "The call succeeded",
        "The program has panicked",
        "The error message is an empty string and the call may or may not have worked"
      ],
      "answerIndex": 1,
      "explanation": "By convention a nil error means success. A non-nil error means failure, and then the other results should not be used."
    },
    {
      "question": "What is the difference between %w and %v in fmt.Errorf when you pass it an error?",
      "options": [
        "There is no difference; both produce the same error value",
        "%v wraps the error and %w only formats its text",
        "%w wraps the error so errors.Is and errors.As can find it; %v only copies its text",
        "%w makes the program panic if the error is nil"
      ],
      "answerIndex": 2,
      "explanation": "%w keeps the original error inside the new one, so it can be found later. %v produces the same text but loses the original error value."
    },
    {
      "question": "Why use errors.Is(err, ErrNotFound) instead of err == ErrNotFound?",
      "options": [
        "errors.Is searches through all wrap layers, while == fails once the error has been wrapped",
        "errors.Is is faster than ==",
        "== does not compile for error values",
        "errors.Is also converts the error to a string"
      ],
      "answerIndex": 0,
      "explanation": "A wrapped error is a different value from the one inside it, so == is false. errors.Is looks through every layer of wrapping."
    },
    {
      "question": "What does errors.AsType[*ValidationError](err) return?",
      "options": [
        "Only a bool",
        "Only the error message as a string",
        "A pointer that you must then convert yourself",
        "The first matching *ValidationError in the chain and a bool saying whether one was found"
      ],
      "answerIndex": 3,
      "explanation": "AsType (Go 1.26) is the generic form of As. It returns the found value and an ok boolean."
    },
    {
      "question": "Which situation is an appropriate use of panic?",
      "options": [
        "A user types letters where a number is expected",
        "A package-level Must helper finds that a fixed, hard-coded pattern is invalid at startup",
        "A file the program tries to open does not exist",
        "A network request times out"
      ],
      "answerIndex": 1,
      "explanation": "Panics are for bugs and impossible states, like a broken hard-coded value found at startup. Bad input, missing files and timeouts are expected failures and should be returned as errors."
    }
  ]
});
