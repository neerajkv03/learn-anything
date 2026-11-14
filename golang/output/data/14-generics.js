window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "14-generics",
  "order": 14,
  "title": "Generics",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7",
  "summary": "Generics let you write one function or type that works for many types (type parameters are placeholders such as T for those types; constraints are rules saying which types are allowed, such as cmp.Ordered and ~int) while the compiler still checks everything. You will learn type parameters, constraints such as cmp.Ordered and ~int, generic types like Stack[T], the Go 1.27 generic methods rule, and when plain code or an interface is the better choice.",
  "prerequisites": [
    "13-time"
  ],
  "subtopics": [
    {
      "id": "type-parameters-on-functions",
      "title": "Type parameters on functions",
      "explanation": "Sometimes the same algorithm should work for several types. Without generics you would copy the function once per type (one for []int, one for []string), or give up type checking by using any (the empty interface from topic 10, which accepts every value but forgets what the value was).\n\nA type parameter solves this. It is a placeholder for a type, written in square brackets right after the function name. In `func Map[T, U any](s []T, f func(T) U) []U`, T and U are type parameters. The word after them, `any`, is the constraint: the rule saying which types are allowed. `any` means no restriction at all.\n\nMap takes a slice of T values and a function that turns one T into one U, and returns a slice of U values. When you call it, you normally do not write the types yourself. The compiler works them out from your arguments. This is called type inference. In the example, the slice is []int so T is int, and the function returns string so U is string.\n\nThe actual types that replace T and U in a call are called type arguments. You may write them explicitly, as in `Map[int, string](...)`, but that is only needed when the compiler cannot infer them.\n\nBecause `any` promises nothing about the type, the body of the function can only do things every type supports: store, copy, pass around and return values. Writing `a + b` on two values of a type parameter constrained only by `any` is a compile error (a mistake the compiler reports before the program can run). The next sub-topic fixes this with stronger constraints.\n\nGo 1.27 extends inference to one more situation: when you assign a generic function (or convert it) to a variable of a matching function type, the compiler fills in the type arguments from that function type. The second example shows this.",
      "analogy": "A generic function is a cookie cutter that works on any dough. The shape logic (the cutter) is written once; the material (chocolate, ginger, plain) is decided each time you use it. The constraint is a note on the cutter saying which doughs are allowed. `any` means every dough is fine.",
      "code": [
        {
          "language": "go",
          "filename": "mapfn.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"strconv\"\n)\n\n// Map applies f to every element of s and collects the results.\nfunc Map[T, U any](s []T, f func(T) U) []U {\n\tout := make([]U, 0, len(s))\n\tfor _, v := range s {\n\t\tout = append(out, f(v))\n\t}\n\treturn out\n}\n\nfunc main() {\n\t// T and U are inferred: T = int, U = string.\n\tout := Map([]int{1, 2, 3}, func(n int) string { return strconv.Itoa(n * 2) })\n\tfmt.Println(out, len(out))\n}\n",
          "output": "[2 4 6] 3",
          "explanation": "Map is written once and used with int input and string output. No type arguments appear at the call because the compiler infers them. Run it with `go run mapfn.go` in a folder that has a go.mod, or `go run .`."
        },
        {
          "language": "go",
          "filename": "assign.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"strconv\"\n)\n\nfunc Map[T, U any](s []T, f func(T) U) []U {\n\tout := make([]U, 0, len(s))\n\tfor _, v := range s {\n\t\tout = append(out, f(v))\n\t}\n\treturn out\n}\n\nfunc main() {\n\t// The variable's function type fixes T = int and U = string,\n\t// so Map needs no type arguments here.\n\tvar toStrings func([]int, func(int) string) []string = Map\n\tfmt.Println(toStrings([]int{5, 6}, strconv.Itoa))\n}\n",
          "output": "[5 6]",
          "explanation": "The variable toStrings has a concrete function type. Assigning the generic Map to it makes the compiler pick T = int and U = string. Go 1.27 applies this inference wherever a generic function is assigned to or converted to a matching function type."
        }
      ],
      "productionNote": "Most day-to-day generic code is small helpers over slices and maps. The standard library's slices and maps packages (used in topics 6 and 7) are themselves written with type parameters, so check them before writing your own helper. Keep helper signatures simple so callers never have to write type arguments.",
      "commonMistakes": [
        "Writing `Map[int, string](...)` at every call. Inference already does this; explicit type arguments just add noise.",
        "Constraining a type parameter with `any` and then using `+`, `<` or `==` on it. This is a compile error because `any` allows types that do not support those operators (symbols like + that act on values).",
        "Copying a function once per type instead of making it generic when the body is identical."
      ],
      "sources": [
        {
          "title": "Tutorial: Getting started with generics",
          "url": "https://go.dev/doc/tutorial/generics"
        },
        {
          "title": "Go spec: Type parameter declarations",
          "url": "https://go.dev/ref/spec#Type_parameter_declarations"
        },
        {
          "title": "Go 1.27 release notes",
          "url": "https://go.dev/doc/go1.27"
        }
      ]
    },
    {
      "id": "constraints-and-cmp",
      "title": "Constraints and the cmp package",
      "explanation": "A constraint is an interface that lists which types a type parameter accepts. It can list methods, like the interfaces from topic 10, and it can also list concrete types.\n\nTo compare with `<` or `>`, use `cmp.Ordered` from the standard library package cmp. It allows every type that supports ordering: all integer and float types, and string. So `func Max[T cmp.Ordered](a, b T) T` works for `Max(3, 7)` and `Max(\"apple\", \"pear\")`, but it rejects a struct, which has no ordering.\n\nTo compare with `==` and `!=`, use the built-in constraint `comparable`. It allows types whose values can be compared for equality, such as numbers, strings, bools, pointers and structs made only of comparable fields.\n\nYou can also write your own constraint as an interface with a union (a list of types separated by `|`). `type Number interface{ ~int | ~int64 | ~float64 }` means: any one of these types.\n\nThe `~` (tilde) in `~int` means: int itself, plus any type whose underlying type is int. The underlying type is the basic type a named type is built on. With `type Celsius float64`, Celsius is a new named type (topic 2) whose underlying type is float64. Without the tilde, `float64` in a union would accept only float64 and reject Celsius. With `~float64`, both are accepted.\n\nInside Sum, `var total T` gives the zero value of whatever T is, and `+=` is allowed because every type in Number supports it.\n\nThe cmp package also has `cmp.Compare(a, b)`. It returns -1 if a is less than b, 0 if they are equal and 1 if a is greater. It is the usual helper inside sort functions.",
      "analogy": "A constraint is a wheel spec: fits any car with a 4-bolt hub. It names no single model; any car meeting the spec is allowed. `comparable` and `cmp.Ordered` are ready-made specs from the shop. The tilde means including rebadged versions: a car sold under a new name (Celsius) but built on the same chassis (float64) still fits.",
      "code": [
        {
          "language": "go",
          "filename": "constr.go",
          "source": "package main\n\nimport (\n\t\"cmp\"\n\t\"fmt\"\n)\n\n// Number accepts int, int64, float64 and any named type built on them.\ntype Number interface {\n\t~int | ~int64 | ~float64\n}\n\ntype Celsius float64\n\nfunc Max[T cmp.Ordered](a, b T) T {\n\tif a > b {\n\t\treturn a\n\t}\n\treturn b\n}\n\nfunc Sum[T Number](xs []T) T {\n\tvar total T\n\tfor _, x := range xs {\n\t\ttotal += x\n\t}\n\treturn total\n}\n\nfunc main() {\n\tfmt.Println(Max(3, 7), Max(\"apple\", \"pear\"))\n\tfmt.Println(Sum([]float64{1.5, 2.5}))\n\tfmt.Println(Sum([]Celsius{20.5, 1.5}))\n}\n",
          "output": "7 pear\n4\n22",
          "explanation": "Max works on ints and strings because both are cmp.Ordered. Sum works on []float64 and on []Celsius only because Number uses ~float64. Println prints the float 4 as 4 and 22 as 22."
        },
        {
          "language": "go",
          "filename": "comparable.go",
          "source": "package main\n\nimport (\n\t\"cmp\"\n\t\"fmt\"\n)\n\n// IndexOf returns the position of target in s, or -1 if it is absent.\nfunc IndexOf[T comparable](s []T, target T) int {\n\tfor i, v := range s {\n\t\tif v == target {\n\t\t\treturn i\n\t\t}\n\t}\n\treturn -1\n}\n\nfunc main() {\n\tfmt.Println(IndexOf([]string{\"a\", \"b\", \"c\"}, \"c\"))\n\tfmt.Println(IndexOf([]int{10, 20}, 99))\n\tfmt.Println(cmp.Compare(2, 5), cmp.Compare(\"b\", \"a\"), cmp.Compare(4, 4))\n}\n",
          "output": "2\n-1\n-1 1 0",
          "explanation": "`comparable` is what lets the body use ==. cmp.Compare returns -1, 1 or 0 for less, greater or equal."
        }
      ],
      "productionNote": "Prefer the standard constraints (cmp.Ordered, comparable, any) over inventing your own. Define a custom constraint like Number only when no standard one fits. Use cmp.Compare inside sort functions, and slices.Sorted (topic 7) when you need sorted keys.",
      "commonMistakes": [
        "Leaving out the tilde: with `float64` instead of `~float64`, a call using `type Celsius float64` fails to compile because Celsius is a different type.",
        "Making a constraint too loose (`any`) and then not being able to use the operator you need, or too tight (one concrete type) so the function is no longer generic.",
        "Using `comparable` and expecting `<` to work. Equality and ordering are separate constraints."
      ],
      "sources": [
        {
          "title": "cmp package: Ordered",
          "url": "https://pkg.go.dev/cmp#Ordered"
        },
        {
          "title": "Go spec: General interfaces",
          "url": "https://go.dev/ref/spec#General_interfaces"
        },
        {
          "title": "Go spec: Type constraints",
          "url": "https://go.dev/ref/spec#Type_constraints"
        }
      ]
    },
    {
      "id": "generic-types",
      "title": "Generic types",
      "explanation": "Type parameters also work on types. `type Stack[T any] struct{ items []T }` declares a stack (a last-in, first-out collection) whose element type is chosen by the user. Writing `Stack[string]` is called instantiating the type: it fills in T with string and gives a concrete type. `var s Stack[string]` creates an empty stack of strings.\n\nMethods on a generic type repeat the type parameter in the receiver: `func (s *Stack[T]) Push(v T)`. Here `*Stack[T]` is a pointer receiver (topic 10) and T inside the brackets is a name for the type argument, usable in the method signature and body. Forgetting `[T]` in the receiver is a compile error.\n\nA method cannot invent a new type parameter of its own in older Go versions; it uses only the ones from the type. Go 1.27 relaxes this, which the next sub-topic covers.\n\nPop must return a value even when the stack is empty. You cannot return nil for a T, because T might be int. Instead declare `var zero T`, which is the zero value of whatever T is (0 for int, \"\" for string), and return it with false as the second result, the comma-ok style from topic 7.",
      "analogy": "A generic type is a labelled storage bin model: one design, \"bin of X\". The factory uses the same blueprint to make a bin of books, a bin of tools or a bin of toys. Once a bin is made for books, only books go in.",
      "code": [
        {
          "language": "go",
          "filename": "stack.go",
          "source": "package main\n\nimport \"fmt\"\n\ntype Stack[T any] struct {\n\titems []T\n}\n\nfunc (s *Stack[T]) Push(v T) {\n\ts.items = append(s.items, v)\n}\n\n// Pop removes and returns the last item. ok is false when the stack is empty.\nfunc (s *Stack[T]) Pop() (T, bool) {\n\tvar zero T\n\tif len(s.items) == 0 {\n\t\treturn zero, false\n\t}\n\tlast := len(s.items) - 1\n\tv := s.items[last]\n\ts.items = s.items[:last]\n\treturn v, true\n}\n\nfunc main() {\n\tvar s Stack[string]\n\ts.Push(\"a\")\n\ts.Push(\"b\")\n\tv, ok := s.Pop()\n\tfmt.Println(v, ok, len(s.items))\n\n\tvar n Stack[int]\n\tx, ok := n.Pop()\n\tfmt.Println(x, ok)\n}\n",
          "output": "b true 1\n0 false",
          "explanation": "The string stack returns the last pushed item \"b\" and keeps one item. The empty int stack returns the zero value 0 and false."
        }
      ],
      "productionNote": "Generic types shine as typed containers: caches, queues, sets, and result or option wrappers. Keep their API small, and if several goroutines share one, protect it with the tools from topic 16.",
      "commonMistakes": [
        "Writing `func (s *Stack) Push(v T)` without `[T]` after the type name in the receiver. The compiler reports that generic type Stack needs type arguments.",
        "Trying to `return nil` for a value of type T. Use `var zero T` and return zero.",
        "Creating a generic type around only one concrete type, which adds complexity and no reuse."
      ],
      "sources": [
        {
          "title": "Go spec: Type definitions",
          "url": "https://go.dev/ref/spec#Type_definitions"
        },
        {
          "title": "Tutorial: Getting started with generics",
          "url": "https://go.dev/doc/tutorial/generics"
        }
      ]
    },
    {
      "id": "generic-methods",
      "title": "Generic methods (new in Go 1.27)",
      "explanation": "Before Go 1.27, a method could use only the type parameters of its receiver type. For example, the methods of Stack[T] could use T but could not add a second type parameter such as U. To transform a Box[T] into a Box[U] you had to write a top-level function (one that is not attached to a type), like Map in the first sub-topic.\n\nGo 1.27 adds generic methods: a method declaration may declare its own type parameters, in addition to those of its receiver type. This allows transformation methods that return a different instantiation of the type, so calls can read naturally as `value.Map(f)` instead of `Map(value, f)`. The standard library already uses this: in Go 1.27 the math/rand/v2 package gains the generic method `(*Rand) N`.\n\nThere is one firm limit. Interface methods still cannot declare type parameters, and a generic method cannot be used to implement an interface method. An interface describes a fixed set of method signatures. A method that is generic over an extra type would be a different signature for every type argument, so it cannot stand for one entry in that set.\n\nThis course does not show the declaration syntax in code, because the exact form should be copied from the official Go 1.27 release notes and the language specification section on method declarations, linked below. Use a go.mod whose `go` line is 1.27 or higher; older language versions reject generic methods. If you only need a transformation once or twice, a plain top-level generic function still works on every Go version.",
      "analogy": "A generic method is a juicer attachment on a kitchen machine. The machine (the receiver, such as Box) is fixed, but the attachment can output a different product (apple juice, orange juice) each time you fit it. A power socket on the wall (an interface) only promises one fixed plug shape, so an attachment that changes with the fruit cannot be what that socket asks for.",
      "code": [
        {
          "language": "powershell",
          "filename": "PowerShell terminal",
          "source": "go mod edit -go=1.27\nSelect-String '^go ' go.mod",
          "output": "go.mod:3:go 1.27",
          "explanation": "Run this in the folder that holds your go.mod (the module file from topic 1). `go mod edit -go=1.27` sets the module's language version to 1.27, the minimum for generic methods, and Select-String prints the resulting `go` line. Type these two lines into a PowerShell terminal opened in the folder that holds go.mod; no file is saved. Select-String prints the go line."
        }
      ],
      "productionNote": "Treat generic methods as a convenience for fluent APIs (calls chained one after another). Do not rely on them across a codebase that must still build with older Go versions, and do not design an interface that needs one: use an ordinary interface method or a top-level generic function instead.",
      "commonMistakes": [
        "Expecting a generic method to satisfy an interface method. It cannot, and interface methods cannot declare type parameters either.",
        "Using a generic method while go.mod still says a Go version below 1.27. The compiler rejects it until the `go` line is raised.",
        "Reaching for a generic method when an ordinary top-level generic function is clearer."
      ],
      "sources": [
        {
          "title": "Go 1.27 release notes",
          "url": "https://go.dev/doc/go1.27"
        },
        {
          "title": "Go spec: Method declarations",
          "url": "https://go.dev/ref/spec#Method_declarations"
        }
      ]
    },
    {
      "id": "when-not-to-use-generics",
      "title": "When not to use generics",
      "explanation": "Generics are a tool, not a goal. Three situations call for three different tools.\n\nUse generics when the same algorithm works on many types and the code does not depend on what the values can do beyond simple operations: containers like Stack[T], and slice or map helpers like Map or Sum.\n\nUse an interface when the types differ in behaviour. If the code only calls methods on its values, such as String(), an interface like fmt.Stringer already does the job. A type parameter that merely calls methods adds syntax and gains nothing.\n\nUse plain code when there is only one type. A generic wrapper around a single concrete type is speculative: it prepares for a need nobody has. A common Go saying is to write code first and abstract later, once you see the same code repeated for a second or third type.\n\nThe example below shows both. Describe takes a slice of fmt.Stringer (the interface from topic 10 with one method, String() string) because Rect and Circle behave differently when printed. Sum is generic because adding numbers is the same algorithm for every number type.",
      "analogy": "Do not buy a universal travel adapter when you only ever charge one phone: a plain charger is simpler. If you own different devices with different plugs and needs, you want a socket standard (an interface). The universal adapter (generics) is for when many different plugs follow the same pattern.",
      "code": [
        {
          "language": "go",
          "filename": "choose.go",
          "source": "package main\n\nimport \"fmt\"\n\ntype Rect struct{ W, H int }\n\nfunc (r Rect) String() string { return fmt.Sprintf(\"Rect(%dx%d)\", r.W, r.H) }\n\ntype Circle struct{ R int }\n\nfunc (c Circle) String() string { return fmt.Sprintf(\"Circle(r=%d)\", c.R) }\n\n// Behaviour differs per type: an interface is enough.\nfunc Describe(items []fmt.Stringer) {\n\tfor _, it := range items {\n\t\tfmt.Println(it.String())\n\t}\n}\n\n// Same algorithm for every number type: generics fit.\nfunc Sum[T ~int | ~float64](xs []T) T {\n\tvar total T\n\tfor _, x := range xs {\n\t\ttotal += x\n\t}\n\treturn total\n}\n\nfunc main() {\n\tDescribe([]fmt.Stringer{Rect{W: 3, H: 4}, Circle{R: 2}})\n\tfmt.Println(Sum([]int{1, 2, 3}))\n}\n",
          "output": "Rect(3x4)\nCircle(r=2)\n6",
          "explanation": "Describe needs no type parameter because it only calls String(). Sum needs one because it uses + on values of a type chosen by the caller. The constraint is written inline as `~int | ~float64`."
        }
      ],
      "productionNote": "Code reviewers often push back on speculative generics. Start with concrete code, and introduce a type parameter when a second real type needs the same logic. Prefer the standard library's generic helpers over writing your own.",
      "commonMistakes": [
        "Wrapping a single concrete type in a generic type or function that is never used with a second type.",
        "Using a type parameter whose only job is to call methods on the value. A plain interface parameter does that with less syntax.",
        "Choosing generics to avoid writing a few lines of duplicate code when the duplication is clearer than the abstraction."
      ],
      "sources": [
        {
          "title": "When To Use Generics",
          "url": "https://go.dev/blog/when-generics"
        },
        {
          "title": "An Introduction To Generics",
          "url": "https://go.dev/blog/intro-generics"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "In `func Map[T, U any](s []T, f func(T) U) []U`, what does `[T, U any]` declare?",
      "options": [
        "Two slices named T and U that may hold any value",
        "Two type parameters, T and U, that can stand for any type",
        "Two constants named T and U with the value any",
        "An import of the package any"
      ],
      "answerIndex": 1,
      "explanation": "Square brackets after the function name declare type parameters: placeholders for types. `any` is the constraint meaning no restriction."
    },
    {
      "question": "Why does `Max[T cmp.Ordered](a, b T) T` need the constraint cmp.Ordered instead of any?",
      "options": [
        "Because any cannot be used with functions",
        "Because Max must run faster than any would allow",
        "Because the body uses `>`, which only some types support, and cmp.Ordered lists exactly those types",
        "Because cmp.Ordered stops the compiler from inferring T"
      ],
      "answerIndex": 2,
      "explanation": "With `any`, a type might not support ordering, so `a > b` would be a compile error. cmp.Ordered restricts T to integers, floats and strings, which all support it."
    },
    {
      "question": "Given `type Celsius float64`, what does `~float64` in a constraint allow?",
      "options": [
        "float64 and any named type whose underlying type is float64, such as Celsius",
        "Only float64 itself",
        "Any numeric type, including int",
        "Only types that have a String method"
      ],
      "answerIndex": 0,
      "explanation": "The tilde means the type itself plus every type built on it. Without the tilde only float64 would be accepted and Celsius would be rejected."
    },
    {
      "question": "In Go 1.27, can a generic method be used to satisfy a method required by an interface?",
      "options": [
        "Yes, as long as the type arguments are inferred",
        "Yes, but only if the receiver is a pointer",
        "Yes, if the go.mod line is 1.27 or higher",
        "No, interface methods cannot declare type parameters and generic methods do not implement interfaces"
      ],
      "answerIndex": 3,
      "explanation": "Go 1.27 allows methods to declare their own type parameters, but interface methods still cannot, and a generic method cannot implement an interface method."
    },
    {
      "question": "A function only calls String() on each value it receives, and the types differ in how they print. What is the best tool?",
      "options": [
        "A type parameter with the any constraint",
        "A parameter of the interface type fmt.Stringer",
        "A generic type Stack[T]",
        "Copying the function once per type"
      ],
      "answerIndex": 1,
      "explanation": "When types differ in behaviour and the code only calls methods, an interface is simpler than a type parameter and does the job fully."
    }
  ]
});
