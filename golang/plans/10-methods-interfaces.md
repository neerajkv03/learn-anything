# 10. Methods & Interfaces
Version: Go 1.27.4
Prerequisites: 09-pointers

## Learning goals
- learner can attach methods to their own types
- learner can choose value or pointer receivers
- learner can define interfaces and satisfy them implicitly
- learner can inspect interface values with type assertions and type switches
- learner can use any and fmt.Stringer
- learner can design small interfaces and accept io.Writer

## Sub-topics
### Methods on types
- Concept: `func (r Rect) Area() float64 { return r.W * r.H }`; receiver = the value the method belongs to; call `r.Area()`; methods on any named type you define in the same package.
- Analogy: verbs attached to a noun — a Rect "knows how" to compute its area.
- Code example: rect.go — `type Rect struct{ W, H float64 }`; `fmt.Println(Rect{W: 3, H: 4}.Area())` → `12`
- Production use: behaviour next to data (`order.Total()`, `user.IsAdmin()`).
- Common mistakes: defining methods on types from another package (e.g. `int`) → compile error; use `type MyInt int`.
- Sources: https://go.dev/ref/spec#Method_declarations ; https://go.dev/doc/effective_go#methods

### Value vs pointer receivers
- Concept: value receiver works on a copy; pointer receiver `func (c *Counter) Inc()` modifies the original; Go auto-takes `&c` for addressable values; rule: if any method needs a pointer receiver, use pointers for all methods of that type.
- Analogy: photocopy vs original (topic 09) — scribbling on a photocopy doesn't update the real ledger.
- Code example: counter.go — `type Counter struct{ n int }`; `func (c *Counter) Inc() { c.n++ }`; `func (c Counter) IncCopy() { c.n++ }`; `var c Counter; c.Inc(); c.Inc(); c.IncCopy(); fmt.Println(c.n)` → `2`
- Production use: services/stores with pointer receivers; small immutable values with value receivers.
- Common mistakes: value receiver on a "setter" → change silently lost; mixing receiver kinds.
- Sources: https://go.dev/doc/faq#methods_on_values_or_pointers ; https://go.dev/doc/effective_go#pointers_vs_values

### Interfaces and implicit implementation
- Concept: interface = set of method signatures; any type with those methods satisfies it automatically (no `implements` keyword); lets one function work with many types.
- Analogy: power socket standard — any plug with the right shape works; the plug never registers with the socket.
- Code example: shapes.go — `type Shape interface{ Area() float64 }`; Rect (topic above) + `type Circle struct{ R float64 }` with `math.Pi * c.R * c.R`; `shapes := []Shape{Rect{W: 3, H: 4}, Circle{R: 1}}`; sum areas; `fmt.Printf("%.2f\n", total)` → `15.14`
- Production use: swapping a real DB for a fake in tests; `io.Reader`, `error`, `http.Handler`.
- Common mistakes: pointer-receiver method → only `*T` satisfies the interface (compile error message contains `method Area has pointer receiver`); huge interfaces.
- Sources: https://go.dev/ref/spec#Interface_types ; https://go.dev/doc/effective_go#interfaces

### Type assertions and type switches
- Concept: `r, ok := s.(Rect)` checks the concrete type inside an interface; without ok, wrong type panics; `switch v := s.(type) { case Rect: … case Circle: … }`.
- Analogy: opening a delivery box marked "Shape" to see if it's actually a Rect.
- Code example: assert.go — `var s Shape = Rect{W: 3, H: 4}`; `r, ok := s.(Rect); fmt.Println(r.W, ok)` → `3 true`; `_, ok = s.(Circle); fmt.Println(ok)` → `false`; type switch prints `rect 3x4` (via `fmt.Printf("rect %gx%g\n", v.W, v.H)`)
- Production use: handling different event/message types; error inspection (topic 11 prefers errors.As).
- Common mistakes: `s.(Circle)` without ok on a Rect → `panic: interface conversion: main.Shape is main.Rect, not main.Circle`.
- Sources: https://go.dev/ref/spec#Type_assertions ; https://go.dev/ref/spec#Type_switches

### any and fmt.Stringer
- Concept: `any` = `interface{}` = holds any value (use sparingly); `fmt.Stringer` = `String() string`; fmt calls it when printing.
- Analogy: name badge — fmt reads your badge if you wear one; without it, it describes you field by field.
- Code example: stringer.go — `func (r Rect) String() string { return fmt.Sprintf("Rect(%gx%g)", r.W, r.H) }`; `fmt.Println(Rect{W: 3, H: 4})` → `Rect(3x4)`; `var v any = 42; fmt.Printf("%v %T\n", v, v)` → `42 int`
- Production use: readable logs; `any` in JSON decoding (topic 19), fmt functions.
- Common mistakes: `String()` with pointer receiver then printing a value (not used); `any` everywhere instead of real types.
- Sources: https://pkg.go.dev/fmt#Stringer ; https://pkg.go.dev/builtin#any

### Small interfaces (io.Reader idea)
- Concept: Go favours one-method interfaces: `io.Writer{ Write(p []byte) (n int, err error) }`, `io.Reader`; "accept interfaces, return structs"; os.Stdout and *strings.Builder are both io.Writers; deeper in topic 18.
- Analogy: USB port — tiny agreed shape, thousands of devices fit.
- Code example: greet.go — `func greet(w io.Writer, name string) { fmt.Fprintf(w, "Hello, %s\n", name) }`; `greet(os.Stdout, "Ada")` → `Hello, Ada`; `var sb strings.Builder; greet(&sb, "Bo"); fmt.Print(sb.String())` → `Hello, Bo`
- Production use: writing to files, HTTP responses, buffers with one function; easy testing.
- Common mistakes: defining interfaces before there's a second implementation; defining them on the producer side instead of the consumer side.
- Sources: https://pkg.go.dev/io#Writer ; https://go.dev/wiki/CodeReviewComments#interfaces

## Quiz
1. Why does IncCopy not change n? — tests receivers
2. How does Rect satisfy Shape? — tests implicit interfaces
3. Safe way to check concrete type — tests comma-ok assertion
4. What does fmt do with a String() method? — tests Stringer
5. Why accept io.Writer instead of *os.File? — tests small interfaces
