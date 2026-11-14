window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "08-structs",
  "order": 8,
  "title": "Structs",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7",
  "summary": "A struct is a type that groups several named values (fields) into one value, such as a User with a name and an age. You will create structs with keyed literals, read and change their fields, reuse one struct inside another by embedding, write one-off anonymous structs, and learn exactly what copying and == do with them.",
  "prerequisites": [
    "07-maps"
  ],
  "subtopics": [
    {
      "id": "defining-struct-types",
      "title": "Defining struct types",
      "explanation": "So far every value you have used held one thing: a number, a string, or a collection of identical things. Real programs constantly need to keep several different facts together, for example a user has a name (text) and an age (a whole number). A struct (short for structure) is a type that bundles several named values, called fields, into one value. Each field has a name and its own type.\n\nYou create a new type with a type declaration, which gives a name to a type you describe. For a struct it looks like this: `type User struct { Name string; Age int }`. In real code you put each field on its own line instead of using semicolons, and gofmt (the formatter from topic 01) lines them up for you. After this declaration, `User` is a type just like `int` or `string`, and you can declare variables of it.\n\nA variable of a struct type that you do not initialise gets the zero value of the struct: every field is set to its own zero value (empty string for `string`, 0 for `int`, and so on). Nothing is ever left undefined.\n\nTo print a struct, `%v` shows only the values in braces, while `%+v` (the plus flag) also shows the field names. `%+v` is the one you will use most when debugging.\n\nField names that start with a capital letter (`Name`) are exported, meaning code in other packages can see them. Lowercase fields (`name`) are visible only inside their own package. Topic 12 covers packages; for now, remember that capitalised fields are the ones other code, including the JSON library in topic 19 (JSON is a text format for sending structured data), can use.",
      "analogy": "A struct type is a blank paper form template. The template fixes which fields exist (Name, Age) and what kind of answer each one takes. Every filled-in form is one value of that type, and a brand-new unfilled form has every box in its empty default state.",
      "code": [
        {
          "language": "go",
          "filename": "user.go",
          "source": "package main\n\nimport \"fmt\"\n\ntype User struct {\n\tName string\n\tAge  int\n}\n\nfunc main() {\n\tvar u User\n\tfmt.Printf(\"%+v\\n\", u)\n\tfmt.Printf(\"%v\\n\", u)\n}\n",
          "output": "{Name: Age:0}\n{ 0}",
          "explanation": "`type User struct {...}` declares the type with two fields. `var u User` creates a value with zero fields: Name is the empty string and Age is 0. `%+v` prints the field names, so you see `Name:` followed by nothing and then `Age:0`. Plain `%v` prints only the values, which is an empty string, a space and 0, so the output starts with `{ ` and the name is invisible."
        }
      ],
      "productionNote": "Structs are the basic building block of Go programs: domain models such as User and Order, configuration objects, and the request and response bodies of web APIs (topic 19). Give each field a clear name and put fields of one concept together in one struct.",
      "commonMistakes": [
        "Naming fields in lowercase (`name string`) and then wondering why the JSON library in topic 19 (JSON is a text format for sending structured data) leaves them out. Code outside the package cannot see unexported (lowercase) fields.",
        "Expecting a variable of a struct type to be nil or missing before you fill it in. It always exists, with every field at its zero value.",
        "Using `%v` when debugging and being unable to tell which value belongs to which field. Use `%+v`."
      ],
      "sources": [
        {
          "title": "The Go Specification: Struct types",
          "url": "https://go.dev/ref/spec#Struct_types"
        },
        {
          "title": "The Go Specification: Type declarations",
          "url": "https://go.dev/ref/spec#Type_declarations"
        }
      ]
    },
    {
      "id": "struct-literals-and-field-access",
      "title": "Struct literals and field access",
      "explanation": "A composite literal is an expression that builds a value of a struct (or slice or map) from the values you list. A keyed struct literal names each field: `User{Name: \"Ada\", Age: 36}`. Fields you leave out get their zero value, so `User{Name: \"Bo\"}` has Age 0.\n\nThere is also a positional literal, `User{\"Ada\", 36}`, which lists values in field order with no names. It works, but you must supply every field in exactly the declared order, so it is hard to read and discouraged for your own types.\n\nYou read and change a field with a dot, called a selector: `u.Name` reads it and `u.Age = 40` sets it. Fields behave like ordinary variables, so `u.Age++` adds one to the age.\n\nIf you misspell a field in a keyed literal, the compiler stops with an error such as `unknown field Nme in struct literal of type User`. That is a good thing: the mistake is caught before the program runs.",
      "analogy": "A keyed literal is filling in the form by its printed labels (\"Name: Ada, Age: 36\"). A positional literal is filling it in blind, guessing which line is which; it works only until someone adds a new line to the form.",
      "code": [
        {
          "language": "go",
          "filename": "lit.go",
          "source": "package main\n\nimport \"fmt\"\n\ntype User struct {\n\tName string\n\tAge  int\n}\n\nfunc main() {\n\tu := User{Name: \"Ada\", Age: 36}\n\tu.Age++\n\tfmt.Printf(\"%+v\\n\", u)\n\n\tpartial := User{Name: \"Bo\"}\n\tfmt.Printf(\"%+v\\n\", partial)\n\n\tpositional := User{\"Cy\", 40}\n\tfmt.Printf(\"%+v\\n\", positional)\n}\n",
          "output": "{Name:Ada Age:37}\n{Name:Bo Age:0}\n{Name:Cy Age:40}",
          "explanation": "The first literal sets both fields by name, then `u.Age++` raises Age from 36 to 37. The second literal omits Age, so it is 0. The third is a positional literal: it works because both fields are given in order, but if someone later inserted a field into User, this line would stop compiling or would silently put values in the wrong fields."
        }
      ],
      "productionNote": "Always use keyed literals for your own struct types. They keep working when a new field is added to the struct, and the reader sees what each value means. Positional literals are mostly acceptable only for tiny, stable types such as a two-number point.",
      "commonMistakes": [
        "Using a positional literal and then breaking it when a field is added to the struct, because the number or order of values no longer matches.",
        "Misspelling a field name in a literal or selector. The compiler reports `unknown field`; fix the spelling to match the type declaration exactly, including capitalisation.",
        "Mixing keyed and positional values in one literal. Go does not allow it; use one style for the whole literal."
      ],
      "sources": [
        {
          "title": "The Go Specification: Composite literals",
          "url": "https://go.dev/ref/spec#Composite_literals"
        },
        {
          "title": "The Go Specification: Selectors",
          "url": "https://go.dev/ref/spec#Selectors"
        }
      ]
    },
    {
      "id": "embedding-composition",
      "title": "Embedding (composition)",
      "explanation": "Embedding means putting a type inside a struct by writing just its name, with no field name. In `type Employee struct { Person; Role string }`, the line `Person` embeds the Person struct. This builds a bigger type out of smaller ones, which is called composition.\n\nThe fields of the embedded type are promoted: you can reach them directly on the outer value, so `e.Name` works as a shortcut for `e.Person.Name`. The long form still works too. The embedded value is stored under a field named after its type, so in a literal you write `Employee{Person: Person{Name: \"Ada\"}, Role: \"dev\"}`.\n\nGo 1.27 relaxed the rule for literal keys: a key may now be any valid field selector, not only a top-level field name. This course keeps to the classic nested literal above, which works in every Go version and is the clearest to read.\n\nEmbedding is not inheritance. An Employee contains a Person, but it is not a Person. A function that needs a Person will not accept an Employee; you would pass `e.Person`. Methods (functions attached to a type, topic 10) are also promoted through embedding.\n\nPrinting with `%+v` shows the embedded value under its type name, as in the example below.",
      "analogy": "A car has an engine. You can ask the car for its horsepower directly (promotion), and you can open the hood and ask the engine itself (`e.Person.Name`). But a car is not a kind of engine, so you cannot put a whole car where only an engine fits.",
      "code": [
        {
          "language": "go",
          "filename": "embed.go",
          "source": "package main\n\nimport \"fmt\"\n\ntype Person struct {\n\tName string\n}\n\ntype Employee struct {\n\tPerson\n\tRole string\n}\n\nfunc main() {\n\te := Employee{Person: Person{Name: \"Ada\"}, Role: \"dev\"}\n\tfmt.Println(e.Name, e.Person.Name, e.Role)\n\tfmt.Printf(\"%+v\\n\", e)\n}\n",
          "output": "Ada Ada dev\n{Person:{Name:Ada} Role:dev}",
          "explanation": "`e.Name` and `e.Person.Name` reach the same field, so both print Ada. The `%+v` line shows the real layout: Employee has a field called Person holding a struct, plus the Role field."
        }
      ],
      "productionNote": "Embedding is used to reuse common fields such as an ID and timestamps across many model types, and to wrap an existing type while keeping its methods. Use it for genuine \"has a\" reuse; if you only need one value from another type, a plain named field is clearer.",
      "commonMistakes": [
        "Expecting an Employee to be accepted where a Person is required. It is a different type; pass `e.Person` instead.",
        "Forgetting that the literal needs the embedded type's name as the key (`Person: Person{...}`) in the classic form, and writing `Name: \"Ada\"` directly on a Go version older than 1.27.",
        "Embedding two types that have the same field name at the same level, then reading that name. The compiler reports it as ambiguous; use the full path such as `e.Person.Name`."
      ],
      "sources": [
        {
          "title": "The Go Specification: Struct types",
          "url": "https://go.dev/ref/spec#Struct_types"
        },
        {
          "title": "Effective Go: Embedding",
          "url": "https://go.dev/doc/effective_go#embedding"
        },
        {
          "title": "Go 1.27 Release Notes",
          "url": "https://go.dev/doc/go1.27"
        }
      ]
    },
    {
      "id": "anonymous-structs",
      "title": "Anonymous structs",
      "explanation": "An anonymous struct is a struct type written inline, with no `type` name. You describe the fields and immediately give the values: `p := struct{ X, Y int }{1, 2}`. The first braces describe the type (`X, Y int` means both fields are ints) and the second braces hold the literal values.\n\nThey are handy when you need a small grouping of data exactly once. A very common use is a list of cases: a slice (an ordered, growable list from topic 06) whose elements are anonymous structs, written `[]struct{ in, want int }{{1, 2}, {3, 6}}`. Inside the slice's braces, each element can drop the repeated type name and write just `{1, 2}`.\n\nThe moment you need the same shape in more than one place, give it a name with `type`. Two separate anonymous struct types with identical fields can be assigned to each other, but repeating the long type everywhere is noisy and easy to get out of sync.",
      "analogy": "An anonymous struct is a sticky note: perfect for jotting down a quick pair of numbers for yourself. A named struct is a printed form: worth the effort when many people will fill it in again and again.",
      "code": [
        {
          "language": "go",
          "filename": "anon.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tp := struct{ X, Y int }{1, 2}\n\tfmt.Println(p.X + p.Y)\n\n\tcases := []struct{ in, want int }{{1, 2}, {3, 6}}\n\tfor _, c := range cases {\n\t\tfmt.Println(c.in, c.want)\n\t}\n}\n",
          "output": "3\n1 2\n3 6",
          "explanation": "`p` has no named type; its fields X and Y are read with the usual dot, giving 1 + 2 = 3. The `cases` slice holds two anonymous structs. The loop (`range` over a slice, topic 06) assigns each one to `c`, and prints its `in` and `want` fields."
        }
      ],
      "productionNote": "Anonymous structs are standard in table-driven tests (topic 20), where a slice of cases is used once, and for quick ad-hoc JSON shapes (topic 19). For anything shared across functions or files, declare a named type.",
      "commonMistakes": [
        "Repeating the same anonymous struct type in several places instead of naming it once with `type`.",
        "Using an anonymous struct as a function parameter or return type. The signature becomes long and hard to read; use a named type."
      ],
      "sources": [
        {
          "title": "The Go Specification: Struct types",
          "url": "https://go.dev/ref/spec#Struct_types"
        },
        {
          "title": "The Go Specification: Composite literals",
          "url": "https://go.dev/ref/spec#Composite_literals"
        }
      ]
    },
    {
      "id": "comparing-and-copying-structs",
      "title": "Comparing and copying structs",
      "explanation": "Assigning a struct to another variable copies every field. After `b := a`, the two variables are independent: changing `b.Name` does not change `a.Name`. The same happens when you pass a struct to a function: the function receives its own copy.\n\nThe `==` operator (an operator is a symbol like `==` or `+` that works on values) compares two structs of the same type field by field. They are equal when every field is equal. This only works when every field's type is comparable. Numbers, strings, booleans and other structs of comparable fields are comparable. Slices and maps are not.\n\nIf a struct has a slice or map field, writing `a == b` is a compile-time error whose message contains `cannot be compared`. The compiler refuses it instead of guessing what \"equal\" should mean for a collection.\n\nCopying is also shallow for such fields. A slice value is a small descriptor that points to an underlying array of data (topic 06). Copying the struct copies the descriptor, not the data, so both copies point to the same elements. Changing an element through one copy is visible through the other. The same holds for maps.",
      "analogy": "A struct copy is a photocopy of a filled-in form: scribbling on the copy leaves the original clean. But if one line on the form says \"see folder #7\", the photocopy says the same thing, so both forms lead to the same folder, and a change to the folder shows up for both.",
      "code": [
        {
          "language": "go",
          "filename": "cmp.go",
          "source": "package main\n\nimport \"fmt\"\n\ntype User struct {\n\tName string\n\tAge  int\n}\n\ntype Team struct {\n\tName    string\n\tMembers []string\n}\n\nfunc main() {\n\ta := User{Name: \"Ada\", Age: 36}\n\tb := a\n\tb.Name = \"Bo\"\n\tfmt.Println(a.Name, b.Name, a == b)\n\n\tc := a\n\tfmt.Println(a == c)\n\n\tt1 := Team{Name: \"core\", Members: []string{\"ann\", \"raj\"}}\n\tt2 := t1\n\tt2.Name = \"copy\"\n\tt2.Members[0] = \"zed\"\n\tfmt.Println(t1.Name, t2.Name)\n\tfmt.Println(t1.Members[0], t2.Members[0])\n}\n",
          "output": "Ada Bo false\ntrue\ncore copy\nzed zed",
          "explanation": "`b := a` copies the fields, so renaming b leaves a as Ada, and the two now differ, so `a == b` is false. `c := a` makes an identical copy, so `a == c` is true. For the Team copy, changing `t2.Name` only affects t2, but the Members slice is shared: setting `t2.Members[0]` to zed also changes t1's first member. Writing `t1 == t2` here would not compile because Team contains a slice."
        }
      ],
      "productionNote": "Small structs of plain values, such as Point or Money, are often used as plain values that you compare and copy as a whole: compared with `==` and even used as map keys (topic 07), which works because they are comparable. When a struct holds a slice or map and you need an independent copy, copy that field yourself (for example with `slices.Clone` from topic 06).",
      "commonMistakes": [
        "Writing `==` on a struct that has a slice or map field. The compiler reports an error containing `cannot be compared`. Compare the fields you care about one by one instead.",
        "Assuming a struct copy is fully independent. Slice and map fields still share their underlying data between the copy and the original."
      ],
      "sources": [
        {
          "title": "The Go Specification: Comparison operators",
          "url": "https://go.dev/ref/spec#Comparison_operators"
        },
        {
          "title": "The Go Specification: Assignment statements",
          "url": "https://go.dev/ref/spec#Assignment_statements"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Given `type User struct { Name string; Age int }` and `var u User` with no other code, what is the value of `u.Age`?",
      "options": [
        "0",
        "nil",
        "-1",
        "The code does not compile because Age was never set"
      ],
      "answerIndex": 0,
      "explanation": "Every field of an unset struct gets the zero value of its type. For an int that is 0. Int fields are never nil, and Go does not require you to set fields before use."
    },
    {
      "question": "Why should you prefer keyed struct literals such as `User{Name: \"Ada\", Age: 36}` over positional ones such as `User{\"Ada\", 36}`?",
      "options": [
        "Positional literals are a syntax error in Go",
        "Keyed literals are faster at runtime",
        "Keyed literals still work and stay readable when a field is added or reordered in the struct",
        "Keyed literals are the only way to leave a field at its zero value"
      ],
      "answerIndex": 2,
      "explanation": "With names, each value is tied to its field, so adding a field to the struct does not break the literal. Positional literals are allowed but fragile. Speed is identical, and positional literals are not an error."
    },
    {
      "question": "Given `type Employee struct { Person; Role string }`, why does `e.Name` work when Name is a field of Person?",
      "options": [
        "Employee inherits from Person, as in class-based languages",
        "Embedding promotes the fields of Person, so e.Name is a shortcut for e.Person.Name",
        "Go searches every struct in the program for a field called Name",
        "Name is automatically copied into Employee when the program starts"
      ],
      "answerIndex": 1,
      "explanation": "Embedding is composition: Employee contains a Person and its fields are promoted to the outer type. It is not inheritance, there is no global search, and nothing is copied at startup."
    },
    {
      "question": "Which is the best use of an anonymous struct?",
      "options": [
        "The type of a field shared by twenty different functions",
        "A public API type that other packages need to import",
        "A small list of one-off test cases used in a single place",
        "A replacement for every named struct to save typing"
      ],
      "answerIndex": 2,
      "explanation": "Anonymous structs suit data used once, such as a table of test cases. Anything reused in many places or exposed to other packages should be a named type."
    },
    {
      "question": "After `a := User{Name: \"Ada\"}`, `b := a` and `b.Name = \"Bo\"`, what does `a.Name` hold?",
      "options": [
        "Bo",
        "An empty string",
        "A compile error is reported",
        "Ada"
      ],
      "answerIndex": 3,
      "explanation": "Assignment copies all fields into a new independent struct value, so changing b does not affect a. a.Name is still Ada."
    }
  ]
});
