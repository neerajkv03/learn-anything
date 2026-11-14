window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "10-methods-interfaces",
  "order": 10,
  "title": "Methods & Interfaces",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Learn how to attach functions (methods) to your own types, choose between value and pointer receivers, and describe behaviour with interfaces that types satisfy automatically. You will also inspect what is inside an interface value, use any and fmt.Stringer, and see why small interfaces like io.Writer make code flexible and easy to test.",
  "prerequisites": [
    "09-pointers"
  ],
  "subtopics": [
    {
      "id": "methods-on-types",
      "title": "Methods on types",
      "explanation": "A method is a function that belongs to a type. You write it like a normal function, but put one extra parenthesised part between the keyword func and the function name. That part is called the receiver: it names the value the method is attached to, and gives it a type.\n\nIn func (r Rect) Area() float64, the receiver is (r Rect). Inside the method, r is the Rect the method was called on. You call the method with a dot after a value: r.Area(). You can also call it directly on a literal, as in Rect{W: 3, H: 4}.Area().\n\nYou can attach methods to any named type that you define in your own package, not only structs. For example, type Celsius float64 creates a new named type built on float64, and you can give Celsius its own methods. You cannot attach methods to types you do not own, such as the built-in int or types from another package.\n\nMethods keep behaviour next to the data it works on, so a reader looking at a type sees both what it holds and what it can do.",
      "analogy": "Think of verbs attached to a noun. A Rect is a noun: it has a width and a height. Its methods are the verbs it knows how to do, such as 'compute my own area'. You do not hand a rectangle to a far-away calculator; you simply ask the rectangle.",
      "code": [
        {
          "language": "go",
          "filename": "rect.go",
          "source": "package main\n\nimport \"fmt\"\n\n// Rect is a rectangle with a width and a height.\ntype Rect struct{ W, H float64 }\n\n// Area is a method: (r Rect) is the receiver.\nfunc (r Rect) Area() float64 {\n\treturn r.W * r.H\n}\n\nfunc main() {\n\tr := Rect{W: 3, H: 4}\n\tfmt.Println(r.Area())\n\tfmt.Println(Rect{W: 5, H: 2}.Area())\n}\n",
          "output": "12\n10\n",
          "explanation": "Area is declared with the receiver (r Rect), so every Rect has an Area method. r.Area() calls it on the variable r; the second call uses a Rect literal directly. Println prints the float64 12 as 12 and 10 as 10."
        },
        {
          "language": "go",
          "filename": "celsius.go",
          "source": "package main\n\nimport \"fmt\"\n\n// Celsius is a new named type based on float64.\ntype Celsius float64\n\nfunc (c Celsius) Fahrenheit() float64 {\n\treturn float64(c)*9/5 + 32\n}\n\nfunc main() {\n\tboiling := Celsius(100)\n\tfmt.Println(boiling.Fahrenheit())\n}\n",
          "output": "212\n",
          "explanation": "You cannot add a method to the built-in float64 or int, but you can define your own type on top of one and give that type methods. float64(c) converts back to a plain float64 so the arithmetic is on ordinary numbers. 100*9/5 + 32 is 212."
        }
      ],
      "productionNote": "Real code puts behaviour next to data: order.Total(), user.IsAdmin(), money.String(). Methods on small named types such as type Status int also give you a natural home for helper logic like Status.IsFinal().",
      "commonMistakes": [
        "Trying to define a method on a type from another package, such as func (i int) Double() int. The compiler (the tool that turns Go source into a program) rejects it. Define your own type with type MyInt int and attach the method to that.",
        "Forgetting the receiver and writing a plain function, then calling it with a dot (r.Area()). The dot syntax only works for functions declared with a receiver.",
        "Confusing the receiver with a parameter: the receiver goes before the method name, and the parameters go after it."
      ],
      "sources": [
        {
          "title": "Go spec: Method declarations",
          "url": "https://go.dev/ref/spec#Method_declarations"
        },
        {
          "title": "Effective Go: Methods",
          "url": "https://go.dev/doc/effective_go#methods"
        }
      ]
    },
    {
      "id": "value-vs-pointer-receivers",
      "title": "Value vs pointer receivers",
      "explanation": "A receiver can be a value, as in (c Counter), or a pointer, as in (c *Counter). Recall from the pointers topic that Go passes copies. A value receiver gets a copy of the value, so changes the method makes to its fields are thrown away when it returns. A pointer receiver gets the address of the original, so changes stick.\n\nYou call both kinds the same way: c.Inc(). If c is a variable (an addressable value), Go automatically takes its address for a pointer-receiver method, as if you had written (&c).Inc(). You do not need to write the & yourself.\n\nRule of thumb: if any method of a type needs a pointer receiver (because it modifies the value, or the value is large and costly to copy), use pointer receivers for all methods of that type. Mixing the two kinds makes a type confusing and causes trouble with interfaces, covered in the next sub-topic.",
      "analogy": "A value receiver is a photocopy of a ledger: you can scribble all over it, but the real ledger in the office is unchanged. A pointer receiver is being handed the original ledger itself, so every entry you write is real.",
      "code": [
        {
          "language": "go",
          "filename": "counter.go",
          "source": "package main\n\nimport \"fmt\"\n\ntype Counter struct{ n int }\n\n// Inc has a pointer receiver: it changes the original.\nfunc (c *Counter) Inc() {\n\tc.n++\n}\n\n// IncCopy has a value receiver: it changes only a copy.\nfunc (c Counter) IncCopy() {\n\tc.n++\n}\n\nfunc main() {\n\tvar c Counter\n\tc.Inc()\n\tc.Inc()\n\tc.IncCopy()\n\tfmt.Println(c.n)\n}\n",
          "output": "2\n",
          "explanation": "c is a variable, so c.Inc() automatically becomes (&c).Inc() and increments the real n twice. c.IncCopy() increments the n inside a copy that is discarded, so the final value is 2, not 3."
        }
      ],
      "productionNote": "Services, stores and anything holding state or resources (a database handle, a mutex) use pointer receivers. Small immutable values such as a Point or a Money amount often use value receivers. Whichever you pick, keep it consistent across the type.",
      "commonMistakes": [
        "Writing a 'setter' method with a value receiver, for example func (c Counter) SetN(v int). The change is made to a copy and silently lost; the code compiles and runs but nothing changes.",
        "Mixing value and pointer receivers on one type. It works until you try to satisfy an interface, and then it becomes confusing which of T or *T has which methods.",
        "Expecting the automatic & to work everywhere. It only works when the value is addressable, such as a variable; a literal like Counter{}.Inc() does not compile."
      ],
      "sources": [
        {
          "title": "Go FAQ: Should I define methods on values or pointers?",
          "url": "https://go.dev/doc/faq#methods_on_values_or_pointers"
        },
        {
          "title": "Effective Go: Pointers vs. Values",
          "url": "https://go.dev/doc/effective_go#pointers_vs_values"
        }
      ]
    },
    {
      "id": "interfaces-implicit",
      "title": "Interfaces and implicit implementation",
      "explanation": "An interface is a type that lists method signatures (names, parameters and results) and nothing else. For example, type Shape interface { Area() float64 } says: 'anything with an Area method returning a float64 is a Shape'.\n\nIn Go there is no implements keyword. A type satisfies an interface automatically, just by having all the methods the interface lists. Rect from the first sub-topic already has Area() float64, so it is a Shape without ever mentioning Shape.\n\nThis lets one function or one slice work with many different types. A variable of type Shape can hold a Rect or a Circle, and calling its Area method runs the right code for whichever one is inside. A slice (a growable list) of type []Shape can mix them.\n\nOne detail from receivers matters here. If Area were declared with a pointer receiver, (r *Rect), then only *Rect (a pointer to a Rect) would satisfy Shape, not Rect. The method set (the list of methods a type has) of a value type includes only its value-receiver methods; the pointer type includes both.",
      "analogy": "An interface is a power socket standard. Any plug with the right shape works, and the plug never has to register with the socket or the manufacturer. A Rect and a Circle are different appliances, but both have a plug shaped 'Area() float64', so both fit.",
      "code": [
        {
          "language": "go",
          "filename": "shapes.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"math\"\n)\n\n// Shape is satisfied by any type with an Area method.\ntype Shape interface {\n\tArea() float64\n}\n\ntype Rect struct{ W, H float64 }\n\nfunc (r Rect) Area() float64 { return r.W * r.H }\n\ntype Circle struct{ R float64 }\n\nfunc (c Circle) Area() float64 { return math.Pi * c.R * c.R }\n\nfunc main() {\n\tshapes := []Shape{Rect{W: 3, H: 4}, Circle{R: 1}}\n\ttotal := 0.0\n\tfor _, s := range shapes {\n\t\ttotal += s.Area()\n\t}\n\tfmt.Printf(\"%.2f\\n\", total)\n}\n",
          "output": "15.14\n",
          "explanation": "Rect and Circle never say they are Shapes; having an Area() float64 method is enough. The loop calls s.Area() on each one: 12 for the Rect and about 3.14159 for the Circle. The total is about 15.14159, printed with two decimals as 15.14. math.Pi is the constant pi from the standard math package."
        }
      ],
      "productionNote": "Interfaces let you swap a real database for a fake in tests, and they power the standard library: io.Reader, error and http.Handler are all interfaces. Keep them small and define them where they are used.",
      "commonMistakes": [
        "Giving Area a pointer receiver and then storing a plain Rect in a Shape. The compiler error contains the text 'method Area has pointer receiver'. Store &Rect{...} instead, or switch to a value receiver.",
        "Writing huge interfaces with many methods. The bigger the interface, the fewer types satisfy it and the harder it is to fake in tests.",
        "Looking for an implements keyword. There is none; satisfaction is checked automatically by the compiler from the methods alone."
      ],
      "sources": [
        {
          "title": "Go spec: Interface types",
          "url": "https://go.dev/ref/spec#Interface_types"
        },
        {
          "title": "Effective Go: Interfaces and other types",
          "url": "https://go.dev/doc/effective_go#interfaces"
        }
      ]
    },
    {
      "id": "type-assertions-switches",
      "title": "Type assertions and type switches",
      "explanation": "A variable of interface type hides which concrete type (the real type, like Rect) is stored inside. A type assertion looks inside. The form r, ok := s.(Rect) asks: 'is s holding a Rect?' If yes, r is that Rect and ok is true. If not, r is the zero value of Rect and ok is false. This is the same comma-ok pattern you saw with maps.\n\nIf you leave out ok and the type is wrong, the program panics (crashes with an error message). For a Rect inside a Shape, s.(Circle) panics with: interface conversion: main.Shape is main.Rect, not main.Circle. Always use the comma-ok form unless you are certain.\n\nWhen there are several possible types, use a type switch: switch v := s.(type) { case Rect: ... case Circle: ... }. In each case branch, v has that concrete type, so you can use its fields. A default branch handles everything else.",
      "analogy": "A delivery box is labelled 'Shape'. That label tells you what it can do, but not what is inside. A type assertion is opening the box to check whether it is really a Rect. The comma-ok form says 'tell me yes or no'; the plain form says 'I insist it is a Rect, and I will be furious if it is not'. A type switch is a row of labelled boxes: you open the one whose label matches what is inside.",
      "code": [
        {
          "language": "go",
          "filename": "assert.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"math\"\n)\n\ntype Shape interface{ Area() float64 }\n\ntype Rect struct{ W, H float64 }\n\nfunc (r Rect) Area() float64 { return r.W * r.H }\n\ntype Circle struct{ R float64 }\n\nfunc (c Circle) Area() float64 { return math.Pi * c.R * c.R }\n\nfunc describe(s Shape) {\n\tswitch v := s.(type) {\n\tcase Rect:\n\t\tfmt.Printf(\"rect %gx%g\\n\", v.W, v.H)\n\tcase Circle:\n\t\tfmt.Printf(\"circle radius %g\\n\", v.R)\n\tdefault:\n\t\tfmt.Println(\"unknown shape\")\n\t}\n}\n\nfunc main() {\n\tvar s Shape = Rect{W: 3, H: 4}\n\n\tr, ok := s.(Rect)\n\tfmt.Println(r.W, ok)\n\n\t_, ok = s.(Circle)\n\tfmt.Println(ok)\n\n\tdescribe(s)\n\tdescribe(Circle{R: 1})\n}\n",
          "output": "3 true\nfalse\nrect 3x4\ncircle radius 1\n",
          "explanation": "s holds a Rect, so s.(Rect) succeeds: r.W is 3 and ok is true. s.(Circle) fails safely with ok false (the _ discards the value). The type switch in describe runs the Rect branch for s and the Circle branch for Circle{R: 1}. The %g verb prints a float without trailing zeros."
        }
      ],
      "productionNote": "Type switches are used to handle different event or message types arriving through one interface. For errors, the next topic shows errors.As, which is usually preferred over asserting on an error by hand.",
      "commonMistakes": [
        "Writing s.(Circle) without ok when s holds a Rect. The program panics with: interface conversion: main.Shape is main.Rect, not main.Circle.",
        "Using the type switch variable outside its branch. v only has the concrete type inside its own case.",
        "Overusing assertions when a method on the interface would do. If you keep asserting, the interface probably needs another method."
      ],
      "sources": [
        {
          "title": "Go spec: Type assertions",
          "url": "https://go.dev/ref/spec#Type_assertions"
        },
        {
          "title": "Go spec: Type switches",
          "url": "https://go.dev/ref/spec#Type_switches"
        }
      ]
    },
    {
      "id": "any-and-stringer",
      "title": "any and fmt.Stringer",
      "explanation": "any is an interface with no methods at all, so every type satisfies it. It is the same as writing interface{}. A variable of type any can hold a value of any type, for example var v any = 42. Because it promises nothing, you can do very little with the value until you assert or switch on its real type. Use it sparingly; a real type is almost always better.\n\nfmt.Stringer is a tiny interface from the fmt package: type Stringer interface { String() string }. If your type has a String() string method, the fmt functions call it automatically when printing with Println, or with the %v and %s verbs.\n\nWithout a String method, fmt prints a struct field by field, like {1}. With it, you choose the text. The verb %T prints the concrete type name, which is handy when a value sits in an any.",
      "analogy": "A name badge at a conference. If you wear one, people read it and know what to call you. If you do not, they describe you feature by feature ('tall, glasses, grey coat'). fmt reads your String badge if you have one, and otherwise falls back to describing the fields. any is a sealed box that can hold anything; you cannot see what is inside until you check its real type.",
      "code": [
        {
          "language": "go",
          "filename": "stringer.go",
          "source": "package main\n\nimport \"fmt\"\n\ntype Rect struct{ W, H float64 }\n\n// String makes Rect a fmt.Stringer.\nfunc (r Rect) String() string {\n\treturn fmt.Sprintf(\"Rect(%gx%g)\", r.W, r.H)\n}\n\ntype Circle struct{ R float64 }\n\nfunc main() {\n\tfmt.Println(Rect{W: 3, H: 4})\n\tfmt.Println(Circle{R: 1})\n\n\tvar v any = 42\n\tfmt.Printf(\"%v %T\\n\", v, v)\n\n\tv = \"hi\"\n\tfmt.Printf(\"%v %T\\n\", v, v)\n}\n",
          "output": "Rect(3x4)\n{1}\n42 int\nhi string\n",
          "explanation": "Println finds the String method on Rect and prints Rect(3x4). Circle has none, so fmt prints its fields in braces: {1}. The any variable v first holds the int 42 and later the string \"hi\"; %T reports the concrete type each time."
        }
      ],
      "productionNote": "String methods make logs and error messages readable (a Status printing as 'shipped' instead of 3). any shows up where the type is genuinely unknown, such as decoding JSON into a map (a later topic) and the arguments of fmt functions.",
      "commonMistakes": [
        "Using any everywhere to avoid thinking about types. You lose compile-time checks and must assert the type before doing anything useful with the value.",
        "Calling fmt.Sprintf(\"%v\", r) inside r's own String method. That calls String again forever and the program crashes with a stack overflow.",
        "Assuming a String method changes the value itself. It only changes how fmt shows it."
      ],
      "sources": [
        {
          "title": "fmt.Stringer",
          "url": "https://pkg.go.dev/fmt#Stringer"
        },
        {
          "title": "builtin: any",
          "url": "https://pkg.go.dev/builtin#any"
        }
      ]
    },
    {
      "id": "small-interfaces",
      "title": "Small interfaces (the io.Writer idea)",
      "explanation": "Go programmers prefer interfaces with one or two methods. The standard library's io.Writer is the model: type Writer interface { Write(p []byte) (n int, err error) }. It means 'something you can write bytes to'. A []byte is a slice of bytes, n is how many were written, and err reports a problem (or nil, meaning no error).\n\nMany things are Writers: os.Stdout (your terminal output), files, network connections, and *strings.Builder (a text buffer in memory). Its Write method has a pointer receiver, so you pass &sb, not sb. Its counterpart io.Reader is 'something you can read bytes from'; both are explored fully in the files topic.\n\nA function that takes an io.Writer works with all of them. fmt.Fprintf(w, ...) is like Printf but prints into any Writer you give it.\n\nThe saying is: accept interfaces, return structs. Parameters should be small interfaces so callers have freedom; return values should be concrete types so callers get everything. Define an interface where it is used, and only once you really need it.",
      "analogy": "A USB port. The agreed shape is tiny, yet thousands of different devices fit: keyboards, drives, lamps. The port does not care which one you plug in, and a new gadget works the day it is invented because it follows the same small shape.",
      "code": [
        {
          "language": "go",
          "filename": "greet.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"io\"\n\t\"os\"\n\t\"strings\"\n)\n\n// greet accepts any io.Writer.\nfunc greet(w io.Writer, name string) {\n\tfmt.Fprintf(w, \"Hello, %s\\n\", name)\n}\n\nfunc main() {\n\tgreet(os.Stdout, \"Ada\")\n\n\tvar sb strings.Builder\n\tgreet(&sb, \"Bo\")\n\tfmt.Print(sb.String())\n}\n",
          "output": "Hello, Ada\nHello, Bo\n",
          "explanation": "greet does not care where the text goes. With os.Stdout it appears in the terminal. With &sb it is collected in the Builder, and sb.String() returns it so Print can show it. The same function also makes tests easy: pass a Builder and compare the text."
        }
      ],
      "productionNote": "One function that takes an io.Writer can write to a file, an HTTP response or an in-memory buffer, and tests can pass a strings.Builder instead of touching the real world. This is why handlers and loggers in Go take small interfaces.",
      "commonMistakes": [
        "Defining an interface before there is a second implementation. Start with the concrete type and extract an interface when a real need appears.",
        "Defining the interface next to the producing type instead of next to the code that consumes it. The consumer knows which few methods it needs.",
        "Passing sb instead of &sb for a strings.Builder. Write has a pointer receiver, so only *strings.Builder is an io.Writer, and the compiler rejects the plain value."
      ],
      "sources": [
        {
          "title": "io.Writer",
          "url": "https://pkg.go.dev/io#Writer"
        },
        {
          "title": "Go Code Review Comments: Interfaces",
          "url": "https://go.dev/wiki/CodeReviewComments#interfaces"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Given func (c Counter) IncCopy() { c.n++ }, why does calling c.IncCopy() leave c.n unchanged?",
      "options": [
        "The method name does not start with a capital letter",
        "A value receiver gets a copy of c, so the increment happens on the copy",
        "Methods can never change struct fields",
        "c.n++ is not allowed inside a method"
      ],
      "answerIndex": 1,
      "explanation": "A value receiver is passed by copy like any other argument. The increment changes the copy, which is thrown away. A pointer receiver (c *Counter) would modify the original."
    },
    {
      "question": "Rect has the method Area() float64. How does it satisfy the interface Shape { Area() float64 }?",
      "options": [
        "By writing 'Rect implements Shape' in its declaration",
        "By calling a registration function at program start",
        "Automatically, because it has all the methods the interface lists",
        "By embedding Shape inside the Rect struct"
      ],
      "answerIndex": 2,
      "explanation": "Go interfaces are satisfied implicitly. Having every listed method with matching signatures is all that is required; no keyword or registration exists."
    },
    {
      "question": "What is the safe way to check whether a Shape variable s holds a Circle without risking a panic?",
      "options": [
        "c := s.(Circle)",
        "c, ok := s.(Circle) and then check ok",
        "c := Circle(s)",
        "if s == Circle { ... }"
      ],
      "answerIndex": 1,
      "explanation": "The comma-ok form returns false in ok instead of panicking when s holds some other type. The plain form s.(Circle) panics on a mismatch."
    },
    {
      "question": "Rect has a method String() string. What does fmt.Println(Rect{W: 3, H: 4}) do?",
      "options": [
        "Calls String() and prints the text it returns",
        "Always prints the fields as {3 4}, ignoring String",
        "Fails to compile because Println needs a string argument",
        "Prints the memory address of the Rect"
      ],
      "answerIndex": 0,
      "explanation": "String() string makes Rect a fmt.Stringer, and fmt calls that method when printing. Without it, fmt would print the fields in braces."
    },
    {
      "question": "Why is func greet(w io.Writer, name string) better than func greet(f *os.File, name string)?",
      "options": [
        "io.Writer is faster than *os.File at runtime",
        "*os.File cannot be passed to functions",
        "An interface parameter is required to use fmt.Fprintf",
        "It accepts any type with a Write method, such as os.Stdout or a strings.Builder, which also makes it easy to test"
      ],
      "answerIndex": 3,
      "explanation": "The small interface only asks for the one capability the function needs, so callers can pass a file, the terminal, an HTTP response or an in-memory buffer."
    }
  ]
});
