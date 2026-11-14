window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "09-pointers",
  "order": 9,
  "title": "Pointers",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "A pointer is a value that holds the memory address of another value. You will learn to take an address with & and follow it with *, to avoid the nil pointer panic (a crash at run time), to understand that Go copies every argument, and to decide when a pointer is worth using instead of a plain value.",
  "prerequisites": [
    "08-structs"
  ],
  "subtopics": [
    {
      "id": "addresses-and-operators",
      "title": "Addresses, & and *",
      "explanation": "Your program stores its values in the computer's memory (the fast working storage where running programs keep their data). Every variable lives at a memory address, a number that says where in memory the value sits. A pointer is a value whose job is to hold such an address.\n\nThe & operator (a symbol that does something to a value) means \"take the address of\". If x is an int variable, then &x is the address of x. Writing p := &x stores that address in p. The type of p is *int, read as \"pointer to int\". For any type T, the type *T means \"pointer to a T\".\n\nThe * operator in front of a pointer value means \"follow the pointer\". This is called dereferencing. *p reads the value stored at the address. *p = 20 writes a new value to that address, so the original variable x changes too, because p and x refer to the same place in memory.\n\nYou can print a pointer with Println, but it shows an address such as 0xc000012345. The exact number differs from run to run, so never depend on it. Go has no pointer arithmetic (you cannot add 1 to an address to reach the next value), which removes a whole class of bugs found in other languages.",
      "analogy": "A house and an address slip. The house is the variable with its value. & writes the house's address on a slip of paper, and the slip is the pointer. * means walking to the address on the slip and going inside. If you paint the house after walking there via the slip, the one real house is now painted, and anyone else holding a slip to it sees the new colour.",
      "code": [
        {
          "language": "go",
          "filename": "ptr.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tx := 10\n\tp := &x // p holds the address of x\n\n\tfmt.Println(*p)    // read through the pointer\n\tfmt.Printf(\"%T\\n\", p) // the type of p\n\n\t*p = 20 // write through the pointer\n\tfmt.Println(x, *p)\n\n\tfmt.Println(p == &x) // same address, so equal\n}\n",
          "output": "10\n*int\n20 20\ntrue",
          "explanation": "Save this as ptr.go in an empty folder that has a go.mod (go mod init example.com/ptr), then run go run . in that folder. p := &x stores x's address, so *p reads 10. The %T verb prints the type *int. Writing *p = 20 changes x itself, so both x and *p print 20. Two pointers are equal when they hold the same address. Printing p itself would show an address that varies on every run, so the example avoids it."
        }
      ],
      "productionNote": "Real programs use pointers so a function can update a caller's struct, or so several parts of a program share one instance of something. You will rarely print an address; you pass pointers around and dereference them.",
      "commonMistakes": [
        "Confusing the two meanings of *. In a type (*int) it means \"pointer to int\". In front of a value (*p) it means \"follow the pointer\".",
        "Expecting pointer arithmetic such as p + 1. Go does not allow it; the compiler (the tool that translates your code into a program) reports an error.",
        "Printing p when you meant *p. You get an unpredictable address instead of the value."
      ],
      "sources": [
        {
          "title": "Go spec: Pointer types",
          "url": "https://go.dev/ref/spec#Pointer_types"
        },
        {
          "title": "Go spec: Address operators",
          "url": "https://go.dev/ref/spec#Address_operators"
        }
      ]
    },
    {
      "id": "nil-pointers",
      "title": "nil pointers",
      "explanation": "The zero value of a pointer (the value a variable has before you assign anything) is nil. A nil pointer points nowhere. Declaring var p *int gives you a nil pointer.\n\nYou can compare a pointer with nil using == and !=. That is the safe way to ask \"does this pointer point at something?\".\n\nFollowing a nil pointer with * is a bug. Go stops the program with a runtime panic (an error that happens while the program runs and, unless handled, crashes it) with the message invalid memory address or nil pointer dereference. Reading a field through a nil struct pointer, such as u.Name when u is nil, does the same.\n\nThe usual defence is a check before use: if p != nil { ... }. In production code nil often means \"this value is absent\", so functions that return a pointer document when it may be nil, and callers check it.",
      "analogy": "A blank address slip. A slip with an address can take you to a house, but a slip with nothing written on it leads nowhere. Trying to walk to \"nowhere\" stops you cold, and that is the panic. Looking at the slip first to see whether it is blank is the nil check.",
      "code": [
        {
          "language": "go",
          "filename": "nilp.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tvar p *int // zero value: nil\n\tfmt.Println(p == nil)\n\n\tif p != nil {\n\t\tfmt.Println(*p)\n\t} else {\n\t\tfmt.Println(\"p points nowhere, skipping\")\n\t}\n}\n",
          "output": "true\np points nowhere, skipping",
          "explanation": "p is declared without a value, so it is nil and p == nil prints true. The if guard keeps the program from following it. Only when p != nil is it safe to write *p."
        },
        {
          "language": "go",
          "filename": "nilpanic.go",
          "source": "package main\n\nimport \"fmt\"\n\ntype User struct {\n\tName string\n}\n\nfunc main() {\n\tvar u *User // nil\n\tfmt.Println(\"before\")\n\tfmt.Println(u.Name) // no guard: panics\n\tfmt.Println(\"after\")\n}\n",
          "output": "before\npanic: runtime error: invalid memory address or nil pointer dereference\n[signal ... code=... addr=0x0 pc=...]\n\ngoroutine 1 [running]:\nmain.main()\n\t...",
          "explanation": "The program prints before, then panics at u.Name because u is nil, so after is never printed. After the first panic line, Go prints extra lines (a signal line and a stack trace, which lists the functions that were running and their file and line numbers). Those extra lines differ by operating system and machine, so only the first panic line is reliable. The program exits with a non-zero status."
        }
      ],
      "productionNote": "Check for nil at the start of a function that accepts a pointer that may be absent, and check the pointer returned from a function whose documentation says it can be nil. A crash from a missing check takes down the whole program, for example a web server.",
      "commonMistakes": [
        "Forgetting to check a pointer that a function returned before using it.",
        "Thinking field access is safe on a nil struct pointer. u.Name panics when u is nil.",
        "Checking for nil after the dereference instead of before it."
      ],
      "sources": [
        {
          "title": "Go spec: Address operators",
          "url": "https://go.dev/ref/spec#Address_operators"
        },
        {
          "title": "Go spec: The zero value",
          "url": "https://go.dev/ref/spec#The_zero_value"
        }
      ]
    },
    {
      "id": "pass-by-value-vs-pointer",
      "title": "Pass by value vs by pointer",
      "explanation": "When you call a function, Go always copies each argument into the function's parameter. This is called pass by value. If you pass an int, the function gets its own copy, and changing the copy does not affect the caller's variable.\n\nIf you pass a pointer, Go copies the pointer, meaning the address. Both copies point at the same original value, so the function can follow the pointer with * and change the original. To call such a function you pass &x, not x. Passing x where a *int is expected is a compile-time type error.\n\nSlices and maps behave in a way that can surprise you. A slice value contains an internal pointer to its elements, so a function that does s[0] = 99 changes the caller's elements. But append inside a function may produce a new slice with a new length, and that change is visible only inside the function unless you return the result.\n\nCopying a big struct on every call costs time and memory, so large structs are often passed by pointer.",
      "analogy": "Handing someone a photocopy versus handing them the key to the locker holding your original document. If you give a photocopy (a value), they can scribble on it as much as they like and your original stays clean. If you give the locker key (a pointer), they can open the locker and change the real document.",
      "code": [
        {
          "language": "go",
          "filename": "pass.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc double(n int) {\n\tn *= 2 // changes only the copy\n}\n\nfunc doublePtr(n *int) {\n\t*n *= 2 // changes the original\n}\n\nfunc setFirst(s []int) {\n\ts[0] = 99 // shared elements: caller sees it\n}\n\nfunc addOne(s []int) {\n\ts = append(s, 4) // caller's slice keeps its old length\n}\n\nfunc main() {\n\tx := 5\n\tdouble(x)\n\tfmt.Println(x)\n\tdoublePtr(&x)\n\tfmt.Println(x)\n\n\tnums := []int{1, 2, 3}\n\tsetFirst(nums)\n\taddOne(nums)\n\tfmt.Println(nums, len(nums))\n}\n",
          "output": "5\n10\n[99 2 3] 3",
          "explanation": "double(x) receives a copy, so x stays 5. doublePtr(&x) receives the address, so *n *= 2 doubles the real x to 10. setFirst changes the shared element, so nums starts with 99. addOne appends to its own copy of the slice header, so the caller's nums still has length 3."
        }
      ],
      "productionNote": "You will see signatures such as func Save(u *User) in real code. They take a pointer so the function can modify the caller's struct and so a large struct is not copied on each call.",
      "commonMistakes": [
        "Expecting double(x) to change x. The function only changes its own copy.",
        "Passing x where a *int is needed. The compiler rejects it with a type error; write &x instead.",
        "Expecting append inside a function to grow the caller's slice. Return the new slice and assign it instead."
      ],
      "sources": [
        {
          "title": "Go FAQ: pass by value",
          "url": "https://go.dev/doc/faq#pass_by_value"
        },
        {
          "title": "Go spec: Calls",
          "url": "https://go.dev/ref/spec#Calls"
        }
      ]
    },
    {
      "id": "new-and-struct-pointers",
      "title": "new and pointers to struct literals",
      "explanation": "The built-in function new creates a fresh value and returns a pointer to it. new(int) allocates (reserves memory for) an int set to its zero value, 0, and returns a *int.\n\nSince Go 1.26, new also accepts an expression. new(30) creates an int holding 30 and returns a *int. Before 1.26 you needed a helper function or a separate variable to get a pointer to a literal value like 30, so this is handy for optional settings.\n\nFor structs, the common form is &User{Name: \"Ada\", Age: 36}. It builds the struct and gives you its address in one step. With a struct pointer you can write u.Age directly. Go follows the pointer automatically, so you do not need to write (*u).Age.\n\nReturning a pointer to a local variable is safe in Go. The garbage collector (the part of the Go runtime that frees memory nothing refers to any more) keeps the value alive while a pointer to it exists.",
      "analogy": "Ordering a new empty box from a warehouse and receiving only its address tag. new(int) gives you a tag for a box that already contains 0. A struct literal with & is the same, but the box arrives pre-filled with the contents you described. new(30) is an order for a box that arrives already holding 30.",
      "code": [
        {
          "language": "go",
          "filename": "newp.go",
          "source": "package main\n\nimport \"fmt\"\n\ntype User struct {\n\tName string\n\tAge  int\n}\n\nfunc newUser(name string) *User {\n\tu := User{Name: name}\n\treturn &u // safe: the value lives on\n}\n\nfunc main() {\n\tp := new(int) // *int pointing at 0\n\tfmt.Println(*p)\n\n\tu := &User{Name: \"Ada\", Age: 36}\n\tu.Age++ // same as (*u).Age++\n\tfmt.Println(u.Age)\n\tfmt.Printf(\"%+v\\n\", u)\n\n\tage := new(30) // Go 1.26+: *int holding 30\n\tfmt.Println(*age)\n\n\tb := newUser(\"Bob\")\n\tfmt.Println(b.Name)\n}\n",
          "output": "0\n37\n&{Name:Ada Age:37}\n30\nBob",
          "explanation": "new(int) points at a zero int, so *p is 0. u is a pointer to a User, and u.Age++ updates the struct through it, giving 37. Printing a struct pointer with %+v shows & followed by the fields. new(30) needs Go 1.26 or newer, which your Go 1.27.4 toolchain satisfies. newUser returns the address of a local value, which is fine in Go."
        }
      ],
      "productionNote": "Constructor functions (helpers that build a value and return it) conventionally look like func NewServer(...) *Server and return a pointer. new(expr) is useful for optional fields typed as pointers, where nil means \"not set\", and it replaces small helper functions such as ptr(30).",
      "commonMistakes": [
        "Overusing pointers for tiny values like an int or a bool when a plain value is simpler.",
        "Writing (*u).Name by habit. u.Name works and is the normal style.",
        "Using new(30) with a toolchain older than Go 1.26. It fails to compile there."
      ],
      "sources": [
        {
          "title": "Go spec: Allocation",
          "url": "https://go.dev/ref/spec#Allocation"
        },
        {
          "title": "Go 1.26 release notes: language",
          "url": "https://go.dev/doc/go1.26#language"
        },
        {
          "title": "Effective Go: Allocation with new",
          "url": "https://go.dev/doc/effective_go#allocation_new"
        }
      ]
    },
    {
      "id": "when-to-use-pointers",
      "title": "When to use pointers",
      "explanation": "Prefer plain values by default, because they are simpler and safer: nobody else can change them behind your back, and there is no nil to check.\n\nUse a pointer when one of these is true. First, a function must modify the caller's value. Second, the struct is large and copying it is wasteful. Third, you need to express \"may be absent\" using nil. Fourth, several parts of the program must share one instance, such as a database connection pool (a managed set of reusable connections to a database).\n\nDo not take a pointer to a slice or a map just to make it fast. They are already small descriptors (a few numbers that point to their data), so passing them by value is cheap.\n\nKeep your use of a type consistent. If most operations on a type need a pointer, use pointers everywhere for that type rather than mixing both styles.",
      "analogy": "Lend someone your original notebook only when they must write in it, or when it is too heavy to photocopy. For a single page of notes, just hand over a copy and keep your original safe.",
      "code": [
        {
          "language": "go",
          "filename": "when.go",
          "source": "package main\n\nimport \"fmt\"\n\ntype Config struct {\n\tPort int\n}\n\nfunc setDefaults(c *Config) {\n\tif c.Port == 0 {\n\t\tc.Port = 8080\n\t}\n}\n\nfunc main() {\n\tc := Config{}\n\tsetDefaults(&c) // function must modify c\n\tfmt.Println(c.Port)\n\n\tc.Port = 9000\n\tsetDefaults(&c) // already set, left alone\n\tfmt.Println(c.Port)\n}\n",
          "output": "8080\n9000",
          "explanation": "setDefaults needs to change the caller's Config, so it takes a *Config. The first call finds Port equal to 0 and sets 8080. After the program sets 9000, the second call sees a non-zero port and changes nothing."
        }
      ],
      "productionNote": "Services and handlers typically hold shared resources by pointer, for example a *sql.DB database pool (topic 24) or an *http.Server (topic 21). A value copy of such a resource would be wrong, because there must be exactly one.",
      "commonMistakes": [
        "Passing pointers to slices or maps \"for speed\". It is unnecessary and makes the code harder to read.",
        "Mixing value and pointer use of the same type inconsistently across a codebase.",
        "Using a pointer only because you want to return \"nothing\" when a clear error or a zero value would do."
      ],
      "sources": [
        {
          "title": "Go FAQ: methods on values or pointers",
          "url": "https://go.dev/doc/faq#methods_on_values_or_pointers"
        },
        {
          "title": "Go Code Review Comments: Pass Values",
          "url": "https://go.dev/wiki/CodeReviewComments#pass-values"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "After x := 10; p := &x; *p = 20, what does fmt.Println(x) print?",
      "options": [
        "10",
        "20",
        "An address such as 0xc000012345",
        "It does not compile"
      ],
      "answerIndex": 1,
      "explanation": "*p = 20 writes to the address held by p, which is where x lives, so x becomes 20."
    },
    {
      "question": "What happens when you dereference (follow with *) a nil pointer?",
      "options": [
        "It returns 0",
        "It returns an empty string",
        "The program panics with a nil pointer dereference error",
        "The compiler stops with an error before the program runs"
      ],
      "answerIndex": 2,
      "explanation": "A nil pointer points nowhere. Following it is a run-time error that panics, and the compiler cannot normally catch it."
    },
    {
      "question": "Why does calling double(x), where func double(n int) { n *= 2 }, not change x?",
      "options": [
        "Go copies the argument, so the function changes only its own copy",
        "Integers are constants and cannot be changed",
        "n *= 2 is not valid Go syntax",
        "Functions can never change anything"
      ],
      "answerIndex": 0,
      "explanation": "Go passes arguments by value. To change the original, pass a pointer (&x) and write through it (*n *= 2)."
    },
    {
      "question": "What does new(int) return?",
      "options": [
        "The number 0",
        "A *int pointing at an int whose value is 0",
        "A nil pointer",
        "An int pointing at a memory address"
      ],
      "answerIndex": 1,
      "explanation": "new allocates a zero value of the type and returns a pointer to it, so new(int) gives a *int that points at 0."
    },
    {
      "question": "Which is a good reason to use a pointer?",
      "options": [
        "To do pointer arithmetic on addresses",
        "To make every small int variable faster",
        "A function needs to modify the caller's struct",
        "To avoid ever writing a nil check"
      ],
      "answerIndex": 2,
      "explanation": "Mutating the caller's value is a core reason. Go has no pointer arithmetic, small values gain nothing from pointers, and pointers actually introduce nil checks."
    }
  ]
});
