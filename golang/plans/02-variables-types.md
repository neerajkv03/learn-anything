# 02. Variables & Basic Types
Version: Go 1.27.4
Prerequisites: 01-getting-started

## Learning goals
- learner can declare variables with var and :=
- learner can pick int, float64, string or bool for a value
- learner can predict zero values
- learner can define constants and enum-like values with iota
- learner can convert between numeric types explicitly

## Sub-topics
### var and := declarations
- Concept: variable = named storage; `var name string = "Ada"`, `var name = "Ada"` (type inferred), `age := 36` (short form, inside functions only); reassign with `=`; static typing (gloss: a variable's type never changes); unused local variable = compile error.
- Analogy: labelled storage box — `var` writes the label and allowed content type; `:=` lets Go read the type from what you drop in; the box can never hold a different kind of thing later.
- Code example: vars.go — `var name string = "Ada"`; `age := 36`; `age = 37`; `fmt.Println(name, age)` → `Ada 37`
- Production use: `:=` inside functions everywhere; `var` at package level and when you want the zero value.
- Common mistakes: `:=` outside a function → compile error; `declared and not used: x`; `:=` with no new variable on the left → `no new variables on left side of :=`.
- Sources: https://go.dev/ref/spec#Variable_declarations ; https://go.dev/ref/spec#Short_variable_declarations

### Basic types (int, float64, string, bool)
- Concept: int (whole numbers), float64 (decimals), string (text), bool (true/false); sized variants int64, uint8 and alias `byte` exist; `%T` prints a type; Go never mixes types automatically.
- Analogy: containers shaped for content — egg carton (int, whole items), measuring jug (float64, fractions), envelope (string), light switch (bool); you can't pour juice into an egg carton.
- Code example: types.go — `fmt.Printf("%T %T %T %T\n", 42, 3.14, "hi", true)` → `int float64 string bool`
- Production use: int for counts/IDs, float64 for measurements, int64 cents for money (never float for money).
- Common mistakes: int + float64 → `invalid operation: a + b (mismatched types int and float64)`; float for money.
- Sources: https://go.dev/ref/spec#Numeric_types ; https://go.dev/ref/spec#String_types ; https://go.dev/ref/spec#Boolean_types

### Zero values
- Concept: declared-but-unassigned variable holds its type's zero value: 0, 0 (float), "" (empty string), false; never garbage/undefined.
- Analogy: new paper form where every field is pre-filled with a sensible blank (0, empty line, unticked box).
- Code example: zero.go — `var i int; var f float64; var s string; var b bool`; `fmt.Printf("%d %v %q %t\n", i, f, s, b)` → `0 0 "" false` (gloss: %q shows text in quotes)
- Production use: structs and counters rely on usable zero values ("make the zero value useful").
- Common mistakes: treating "" as "not set"; expecting nil for an int.
- Sources: https://go.dev/ref/spec#The_zero_value

### Constants and iota
- Concept: `const Pi = 3.14159` can't change; untyped constants adapt to context; `iota` in a const block counts 0,1,2…; `type Weekday int` for enum-like values.
- Analogy: iota = ticket dispenser for one queue: first ticket 0, then 1, 2; a new const block is a new queue starting again at 0.
- Code example: consts.go — `type Weekday int`; `const ( Sunday Weekday = iota; Monday; Tuesday )`; `fmt.Println(Sunday, Tuesday)` → `0 2`
- Production use: states, log levels, limits like `const maxRetries = 3`.
- Common mistakes: assigning to a constant → compile error; assuming iota continues across const blocks.
- Sources: https://go.dev/ref/spec#Constant_declarations ; https://go.dev/ref/spec#Iota

### Type conversion
- Concept: `T(v)` converts: `float64(x)`; `int(f)` truncates toward zero; always explicit; constant `int(3.99)` is a compile error (constant truncated), a variable is fine; `string(65)` gives "A" not "65" → use strconv.Itoa (topic 05, gloss now).
- Analogy: currency exchange desk — rupees never turn into dollars by themselves; you exchange explicitly and may lose the cents.
- Code example: convert.go — `x := 7`; `y := float64(x) / 2`; `f := 3.99`; `n := int(f)`; `fmt.Println(y, n)` → `3.5 3`
- Production use: counts → float64 for averages; int ↔ int64 at API boundaries.
- Common mistakes: dividing ints before converting (`float64(7/2)` → 3); `string(65)`; overflow converting large int64 to int32.
- Sources: https://go.dev/ref/spec#Conversions

## Quiz
1. Where can := be used? — tests function-only rule
2. Zero value of a string? — tests zero values
3. Value of Tuesday in the iota block? — tests iota (2)
4. Result of int(f) when f is 3.99? — tests truncation (3)
5. Why does int + float64 fail? — tests no implicit conversion
