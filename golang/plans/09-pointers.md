# 09. Pointers
Version: Go 1.27.4
Prerequisites: 08-structs

## Learning goals
- learner can take an address with & and follow it with *
- learner can guard against nil pointer dereference
- learner can choose between passing a value and passing a pointer
- learner can create pointers with new and &T{}
- learner can decide when pointers are worth it

## Sub-topics
### Addresses and & / *
- Concept: every variable lives at a memory address (gloss memory); `p := &x` stores x's address, type `*int`; `*p` reads/writes the value there.
- Analogy: house vs the address slip — `&` writes the address on a slip, `*` walks to the house; painting the house via the slip changes the one real house.
- Code example: ptr.go — `x := 10; p := &x; *p = 20; fmt.Println(x, *p)` → `20 20`; printing `p` shows an address like `0xc000012345` (say value varies)
- Production use: functions that update a caller's struct; shared state.
- Common mistakes: confusing `*int` (type) with `*p` (dereference); no pointer arithmetic in Go.
- Sources: https://go.dev/ref/spec#Pointer_types ; https://go.dev/ref/spec#Address_operators

### nil pointers
- Concept: zero value of a pointer is `nil` (points nowhere); `*p` on nil → runtime panic; check `if p != nil`.
- Analogy: blank address slip — trying to walk to "nowhere" stops you cold.
- Code example: nilp.go — `var p *int; fmt.Println(p == nil)` → `true`; then `fmt.Println(*p)` → `panic: runtime error: invalid memory address or nil pointer dereference` (plus extra lines; say so)
- Production use: nil = "absent" for optional values; checks at function entry.
- Common mistakes: forgetting nil checks on returned pointers; calling field access on a nil struct pointer.
- Sources: https://go.dev/ref/spec#Address_operators ; https://go.dev/ref/spec#The_zero_value

### Pass by value vs by pointer
- Concept: Go always copies arguments; passing a pointer copies the address so the function can change the original; slices/maps already contain internal pointers so element changes are visible (but `append` inside may not be).
- Analogy: giving someone a photocopy (value) vs your original document's locker key (pointer).
- Code example: pass.go — `func double(n int) { n *= 2 }`; `func doublePtr(n *int) { *n *= 2 }`; `x := 5; double(x); fmt.Println(x); doublePtr(&x); fmt.Println(x)` → `5`,`10`
- Production use: `func (s *Store) Save(u *User)`; avoiding copies of big structs.
- Common mistakes: expecting `double(x)` to change x; passing `x` where `*int` is needed → type error.
- Sources: https://go.dev/doc/faq#pass_by_value ; https://go.dev/ref/spec#Calls

### new and pointer to struct literals
- Concept: `new(int)` returns `*int` to a zero value; `&User{Name: "Ada"}` is the common form; `u.Name` auto-dereferences (no `(*u).Name` needed); Go 1.26+: `new` accepts an expression, e.g. `new(30)` gives `*int` holding 30 (confirmed in https://go.dev/doc/go1.26).
- Analogy: ordering a new empty box and receiving only its address tag.
- Code example: newp.go — `p := new(int); fmt.Println(*p)` → `0`; `u := &User{Name: "Ada", Age: 36}; u.Age++; fmt.Println(u.Age)` → `37`; `age := new(30); fmt.Println(*age)` → `30`
- Production use: constructors `func NewServer(...) *Server`; optional fields `*int` in JSON/config (new(expr) replaces helper funcs like `ptr(30)`).
- Common mistakes: returning a pointer to a loop variable copy (fine since Go 1.22, but know why); overusing pointers for tiny values.
- Sources: https://go.dev/ref/spec#Allocation ; https://go.dev/doc/go1.26#language ; https://go.dev/doc/effective_go#allocation_new

### When to use pointers
- Concept: use a pointer to: mutate the caller's value, avoid copying large structs, express "may be absent" (nil), share one instance (e.g. a DB pool); otherwise prefer values (simpler, safer); Go's garbage collector frees memory (gloss) — returning `&local` is safe.
- Analogy: lend the original only when the borrower must write on it or it's too heavy to copy.
- Code example: when.go — `type Config struct{ Port int }`; `func setDefaults(c *Config) { if c.Port == 0 { c.Port = 8080 } }`; `c := Config{}; setDefaults(&c); fmt.Println(c.Port)` → `8080`
- Production use: services/handlers hold `*sql.DB` (topic 24), `*http.Server` (topic 21).
- Common mistakes: pointers to slices/maps "for speed" (unnecessary); mixing value and pointer use of the same type inconsistently.
- Sources: https://go.dev/doc/faq#methods_on_values_or_pointers ; https://go.dev/wiki/CodeReviewComments#pass-values

## Quiz
1. Output after *p = 20 — tests dereference
2. What happens dereferencing a nil pointer? — tests panic
3. Why does double(x) not change x? — tests pass-by-value
4. What does new(int) return? — tests new
5. Name one good reason to use a pointer — tests when to use
