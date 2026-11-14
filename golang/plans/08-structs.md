# 08. Structs
Version: Go 1.27.4
Prerequisites: 07-maps

## Learning goals
- learner can define a struct type and create values with keyed literals
- learner can read and update fields and print with %+v
- learner can compose types by embedding
- learner can use anonymous structs for one-off data
- learner can predict copy and == behaviour for structs

## Sub-topics
### Defining struct types
- Concept: `type User struct { Name string; Age int }`; groups related fields into one new type; field names capitalized = visible outside package (topic 12).
- Analogy: blank form template — fixed fields with a type each; every filled-in form is a value.
- Code example: user.go — define User; `var u User; fmt.Printf("%+v\n", u)` → `{Name: Age:0}`
- Production use: domain models (User, Order), config, request/response bodies (topic 19).
- Common mistakes: lowercase fields then wondering why JSON skips them (topic 19).
- Sources: https://go.dev/ref/spec#Struct_types ; https://go.dev/ref/spec#Type_declarations

### Struct literals and field access
- Concept: keyed literal `User{Name: "Ada", Age: 36}` (omitted fields = zero); positional `User{"Ada", 36}` discouraged; `u.Age++`.
- Analogy: filling in the form by field label instead of guessing which line is which.
- Code example: lit.go — `u := User{Name: "Ada", Age: 36}; u.Age++; fmt.Printf("%+v\n", u)` → `{Name:Ada Age:37}`
- Production use: keyed literals survive adding new fields.
- Common mistakes: positional literal breaks when a field is added; misspelled field → `unknown field`.
- Sources: https://go.dev/ref/spec#Composite_literals ; https://go.dev/ref/spec#Selectors

### Embedding (composition)
- Concept: `type Person struct { Name string }`; `type Employee struct { Person; Role string }`; fields of Person are promoted: `e.Name`; still reachable as `e.Person.Name`; composition, not inheritance. Go 1.27: literal keys may be any valid field selector — author include `Employee{Name: "Ada", Role: "dev"}` ONLY if https://go.dev/doc/go1.27 shows that form; main example uses classic nested literal.
- Analogy: a car has an engine — you can ask the car for its horsepower directly, but the car is not "a kind of engine".
- Code example: embed.go — `e := Employee{Person: Person{Name: "Ada"}, Role: "dev"}; fmt.Println(e.Name, e.Person.Name, e.Role)` → `Ada Ada dev`
- Production use: reusing common fields (timestamps, IDs), wrapping types (methods promote too, topic 10).
- Common mistakes: expecting an Employee to be accepted where a Person is required (it isn't).
- Sources: https://go.dev/ref/spec#Struct_types ; https://go.dev/doc/effective_go#embedding ; https://go.dev/doc/go1.27

### Anonymous structs
- Concept: struct type without a name, declared inline: `p := struct{ X, Y int }{1, 2}`; good for one-off data.
- Analogy: sticky note vs printed form — fine for a quick note, wrong for something reused everywhere.
- Code example: anon.go — `p := struct{ X, Y int }{1, 2}; fmt.Println(p.X + p.Y)` → `3`; list of anonymous structs `[]struct{ in, want int }{{1, 2}, {3, 6}}` looped and printed → `1 2`,`3 6`
- Production use: test tables (topic 20), ad-hoc JSON shapes (topic 19).
- Common mistakes: repeating the same anonymous struct in many places instead of naming it.
- Sources: https://go.dev/ref/spec#Struct_types ; https://go.dev/ref/spec#Composite_literals

### Comparing and copying structs
- Concept: assignment copies all fields; `==` works when every field is comparable; slice/map fields make the struct not comparable; copy of a struct holding a slice still shares the slice's data.
- Analogy: photocopy of a form — scribbling on the copy leaves the original clean; but if the form says "see folder #7", both point to the same folder.
- Code example: cmp.go — `a := User{Name: "Ada", Age: 36}; b := a; b.Name = "Bo"; fmt.Println(a.Name, b.Name, a == b)` → `Ada Bo false`; `c := a; fmt.Println(a == c)` → `true`
- Production use: value objects (Point, Money) compared with ==; map keys.
- Common mistakes: `==` on struct with a slice field → compile error (message contains `cannot be compared`); assuming copy is fully deep.
- Sources: https://go.dev/ref/spec#Comparison_operators ; https://go.dev/ref/spec#Assignment_statements

## Quiz
1. Zero value of an unset Age field — tests zero values in structs
2. Why prefer keyed literals? — tests literals
3. e.Name works for Employee — why? — tests promotion
4. Good use of an anonymous struct — tests anonymous structs
5. b := a; b.Name = "Bo" — what's a.Name? — tests copy
