# 11. Error Handling
Version: Go 1.27.4
Prerequisites: 10-methods-interfaces

## Learning goals
- learner can check and return errors with if err != nil
- learner can create errors and wrap them with %w
- learner can inspect wrapped errors with errors.Is, errors.As and errors.AsType
- learner can define custom error types
- learner can explain when panic/recover is appropriate

## Sub-topics
### The error type and if err != nil
- Concept: `error` is a built-in interface `{ Error() string }`; functions return it last; nil = success; check immediately, return early; add context and pass up.
- Analogy: delivery receipt with a "problem" box — empty box means fine; you check it before using the parcel.
- Code example: atoi.go — `n, err := strconv.Atoi("abc"); if err != nil { fmt.Println("error:", err); return }` → `error: strconv.Atoi: parsing "abc": invalid syntax`
- Production use: every I/O, parsing and network call.
- Common mistakes: ignoring err with `_`; using the value when err != nil; logging and returning the same error (double logs).
- Sources: https://go.dev/blog/error-handling-and-go ; https://pkg.go.dev/builtin#error

### errors.New and fmt.Errorf with %w
- Concept: `errors.New("not found")`; sentinel errors as package vars `var ErrNotFound = errors.New("not found")`; `fmt.Errorf("load user %d: %w", id, err)` wraps (keeps the original inside); `%v` formats without wrapping; message style: lowercase, no trailing punctuation.
- Analogy: envelope inside an envelope — each layer adds a note ("while loading user 7") but the original letter stays inside.
- Code example: wrap.go — `err := fmt.Errorf("load user %d: %w", 7, ErrNotFound); fmt.Println(err)` → `load user 7: not found`
- Production use: context chains like `handle request: load user 7: query: connection refused`.
- Common mistakes: `%v` when caller needs errors.Is; Go 1.27 vet flags `fmt.Errorf("%w", p)` where p is `*E` and E (not *E) implements error.
- Sources: https://pkg.go.dev/fmt#Errorf ; https://go.dev/blog/go1.13-errors ; https://go.dev/doc/go1.27

### errors.Is and errors.As
- Concept: `errors.Is(err, ErrNotFound)` looks through all wrap layers for that exact value; `errors.As(err, &target)` finds the first error of a type; Go 1.26+ generic `errors.AsType[*ValidationError](err)` returns (value, ok) — confirmed https://go.dev/doc/go1.26; never compare wrapped errors with ==.
- Analogy: Is = searching nested envelopes for one specific signed letter; As/AsType = searching for any letter on a specific form and pulling it out to read its fields.
- Code example: is.go — with wrapped err above: `fmt.Println(err == ErrNotFound, errors.Is(err, ErrNotFound))` → `false true`; As/AsType shown in next sub-topic with ValidationError
- Production use: map ErrNotFound → HTTP 404 (topic 21); `sql.ErrNoRows` (topic 24).
- Common mistakes: `err == ErrNotFound` on wrapped errors; passing a non-pointer to errors.As (panics).
- Sources: https://pkg.go.dev/errors#Is ; https://pkg.go.dev/errors#As ; https://pkg.go.dev/errors#AsType

### Custom error types
- Concept: struct with `Error() string` carries extra data; usually pointer receiver; return as `error`; typed-nil pitfall: returning a nil `*ValidationError` in an `error` result is non-nil — return literal `nil`.
- Analogy: custom incident report form — besides "something went wrong" it has fields (which field, what rule).
- Code example: custom.go — `type ValidationError struct{ Field string }`; `func (e *ValidationError) Error() string { return e.Field + " is required" }`; `err := fmt.Errorf("signup: %w", &ValidationError{Field: "email"})`; `fmt.Println(err)` → `signup: email is required`; `if ve, ok := errors.AsType[*ValidationError](err); ok { fmt.Println(ve.Field) }` → `email`; same with `var ve *ValidationError; errors.As(err, &ve)` → `email`
- Production use: validation errors → HTTP 400 with field name.
- Common mistakes: typed nil returned as error; value vs pointer receiver mismatch making As fail.
- Sources: https://go.dev/blog/error-handling-and-go ; https://go.dev/doc/faq#nil_error

### panic and recover (when not to use)
- Concept: panic = program-stopping failure for bugs/impossible states (gloss: unwinds functions, runs defers, crashes); `recover()` inside a deferred func stops it; use errors for expected failures; net/http recovers per request.
- Analogy: fire alarm vs a complaint form — complaints (errors) are normal business; the alarm is for real emergencies; recover = fire door at the building edge so one fire doesn't burn the city.
- Code example: recover.go — `func safeDiv(a, b int) (q int, err error) { defer func() { if r := recover(); r != nil { err = fmt.Errorf("recovered: %v", r) } }(); return a / b, nil }`; `_, err := safeDiv(1, 0); fmt.Println(err)` → `recovered: runtime error: integer divide by zero`
- Production use: `Must...` helpers at startup (`regexp.MustCompile`); recovery middleware (topic 21).
- Common mistakes: panic for normal errors (bad input, missing file); recover outside a deferred function does nothing.
- Sources: https://go.dev/blog/defer-panic-and-recover ; https://go.dev/ref/spec#Handling_panics

## Quiz
1. What does nil error mean? — tests convention
2. %w vs %v in fmt.Errorf — tests wrapping
3. Why errors.Is instead of ==? — tests Is
4. What does errors.AsType return? — tests AsType
5. When is panic OK? — tests panic usage
