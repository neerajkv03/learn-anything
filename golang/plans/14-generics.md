# 14. Generics
Version: Go 1.27.4
Prerequisites: 13-time

## Learning goals
- learner can write generic functions with type parameters
- learner can constrain types with cmp.Ordered and custom constraints using ~
- learner can define generic types like Stack[T]
- learner can recognize Go 1.27 generic methods
- learner can decide when an interface or plain code beats generics

## Sub-topics
### Type parameters on functions
- Concept: `func Map[T, U any](s []T, f func(T) U) []U`; type parameters in `[]`; usually inferred at the call; `any` = no restriction; Go 1.27 infers type args when assigning a generic func to a matching function type (per release notes).
- Analogy: cookie cutter that works on any dough — same shape logic, different material.
- Code example: mapfn.go — `out := Map([]int{1, 2, 3}, func(n int) string { return strconv.Itoa(n * 2) }); fmt.Println(out, len(out))` → `[2 4 6] 3`
- Production use: helpers for slices/maps (the slices and maps packages are generic).
- Common mistakes: writing `Map[int, string](...)` everywhere (inference handles it); using `any` then trying `+` → compile error.
- Sources: https://go.dev/doc/tutorial/generics ; https://go.dev/ref/spec#Type_parameter_declarations ; https://go.dev/doc/go1.27

### Constraints and the cmp package
- Concept: constraint = interface listing allowed types/methods; `cmp.Ordered` (supports < >); custom `type Number interface{ ~int | ~int64 | ~float64 }`; `~int` = int and any type whose underlying type is int; `comparable` for ==.
- Analogy: wheel spec "fits any car with a 4-bolt hub" — not one model, but any that meets the spec; ~ means "including rebadged versions".
- Code example: constr.go — `func Max[T cmp.Ordered](a, b T) T`; `fmt.Println(Max(3, 7), Max("apple", "pear"))` → `7 pear`; `func Sum[T Number](xs []T) T`; `fmt.Println(Sum([]float64{1.5, 2.5}))` → `4`
- Production use: numeric helpers, sorted keys `slices.Sorted`, `cmp.Compare` in sort functions.
- Common mistakes: forgetting `~` so `type Celsius float64` is rejected; constraint too loose.
- Sources: https://pkg.go.dev/cmp#Ordered ; https://go.dev/ref/spec#General_interfaces ; https://go.dev/ref/spec#Type_constraints

### Generic types
- Concept: `type Stack[T any] struct{ items []T }`; methods use receiver `(s *Stack[T])`; instantiate `Stack[string]{}`; Pop returns (T, bool) with zero value `var zero T`.
- Analogy: labelled storage bin model "bin of X" — one design, made for books, tools or toys.
- Code example: stack.go — `var s Stack[string]; s.Push("a"); s.Push("b"); v, ok := s.Pop(); fmt.Println(v, ok, len(s.items))` → `b true 1`
- Production use: typed caches, queues, result/option containers, sync-safe maps.
- Common mistakes: forgetting `[T]` in the receiver; returning nil for a T (use the zero value).
- Sources: https://go.dev/ref/spec#Type_definitions ; https://go.dev/doc/tutorial/generics

### Generic methods (new in 1.27)
- Concept: Go 1.27: a method declaration may declare its own type parameters (beyond the receiver type's); interface methods still cannot have type parameters and generic methods don't satisfy interfaces (per https://go.dev/doc/go1.27). Author: take the exact syntax only from go1.27 release notes / spec Method_declarations; if no syntax example is confirmed there, teach concept only, no code.
- Analogy: a juicer attachment on a kitchen machine — the machine (receiver) is fixed, but the attachment can output a different product each time.
- Code example: genmethod.go (only if syntax confirmed) — `type Box[T any] struct{ V T }`; `func (b Box[T]) Map[U any](f func(T) U) Box[U] { return Box[U]{V: f(b.V)} }`; `fmt.Println(Box[int]{V: 21}.Map(func(n int) string { return strconv.Itoa(n * 2) }).V)` → `42`
- Production use: fluent transformation APIs without top-level helper functions.
- Common mistakes: expecting a generic method to satisfy an interface; using on Go < 1.27 (go.mod go line must be ≥ 1.27).
- Sources: https://go.dev/doc/go1.27 ; https://go.dev/ref/spec#Method_declarations

### When not to use generics
- Concept: use generics when the same algorithm works on many types (containers, slice helpers); use interfaces when types differ in behaviour (methods); use plain code when there's only one type; "write code, not types".
- Analogy: don't buy a universal adapter when you only ever charge one phone.
- Code example: choose.go — interface version `func Describe(items []fmt.Stringer)` printing each vs generic `Sum`; show `Describe([]fmt.Stringer{Rect{W: 3, H: 4}})` → `Rect(3x4)` (Rect/String from topic 10)
- Production use: code reviews push back on speculative generics.
- Common mistakes: generic wrapper around one concrete type; type parameters that only call methods (an interface suffices).
- Sources: https://go.dev/blog/when-generics ; https://go.dev/blog/intro-generics

## Quiz
1. What does [T any] mean? — tests type parameters
2. Why does Max need cmp.Ordered? — tests constraints
3. What does ~int allow? — tests tilde
4. Can a generic method satisfy an interface method? — tests 1.27 rule
5. Interface or generics for different behaviours? — tests when-not
