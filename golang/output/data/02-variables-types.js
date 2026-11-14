window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "02-variables-types",
  "order": 2,
  "title": "Variables & Basic Types",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7",
  "summary": "Learn how to store values in named variables with var and :=, and how Go's four everyday types (int, float64, string, bool) behave. You will see the zero value every variable starts with, how to define constants and lists of named numbers with iota (Go's way of writing an enum, a fixed set of named choices), and how to convert between numeric types explicitly.",
  "prerequisites": ["01-getting-started"],
  "subtopics": [
    {
      "id": "var-and-short-declaration",
      "title": "var and := declarations",
      "explanation": "A variable is a named place in the computer's memory that holds a value. You choose the name, and later you use the name to read or change the value. Go is statically typed, which means every variable has one type (the kind of value it can hold, such as whole numbers or text), and that type is fixed for the variable's whole life.\n\nThe long form uses the keyword var (a keyword is a word with a special meaning in Go): `var name string = \"Ada\"` says 'declare a variable called name, of type string, holding the text Ada'. If you give a value, Go can work out the type itself, so `var city = \"London\"` is enough. This is called type inference (the compiler reads the type from the value).\n\nThe short form is `age := 36`. The `:=` both declares the variable and assigns its first value, and Go infers the type (here int, whole numbers). It only works inside a function body. To change an existing variable later, use plain `=`, as in `age = 37`. Using `=` never changes the type: assigning text to age would be rejected.\n\nGo is strict about waste. If you declare a local variable (one inside a function) and never use it, the compiler refuses to build the program. A compile error is a problem the compiler (the tool that turns your code into a program, from topic 01) reports before the program is allowed to run.\n\nSave the example below as vars.go in the module folder from topic 01 and run `go run vars.go` (not `go run .`, because hello.go in that folder already has a main function).",
      "analogy": "A variable is a labelled storage box. `var` writes the label and says what kind of thing the box may hold (for example 'text'). `:=` is the shortcut where you simply drop something in and Go looks at it and writes the label for you. Either way, once the box is labelled for text it can never hold a number later; you can only swap the text for other text (that is `=`).",
      "code": [
        {
          "language": "go",
          "filename": "vars.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tvar name string = \"Ada\"\n\tvar city = \"London\"\n\tage := 36\n\tage = 37\n\tfmt.Println(name, age, city)\n}\n",
          "output": "Ada 37 London",
          "explanation": "name is declared with an explicit type, city has its type inferred from the text, and age uses the short form. `age = 37` replaces the value without redeclaring. fmt.Println prints the values separated by spaces."
        }
      ],
      "productionNote": "Inside functions, nearly all Go code uses `:=`. Use `var` at package level (outside any function, where `:=` is not allowed) and when you want a variable to start at its type's zero value, such as `var count int`. Run `go vet .` (from topic 01) and let the compiler's unused-variable errors keep your code tidy.",
      "commonMistakes": [
        "Using `:=` outside a function (at package level). This is a syntax error (the code breaks Go grammar, so the compiler refuses it); use `var` there.",
        "Declaring a local variable and never using it. The compiler reports `declared and not used: x` and refuses to build.",
        "Writing `x := 5` a second time in the same scope when x already exists. The compiler reports `no new variables on left side of :=`; use `x = 5` to reassign.",
        "Trying to assign a different kind of value, such as `age = \"old\"`. The variable's type is fixed, so this is a compile error."
      ],
      "sources": [
        { "title": "Go spec: Variable declarations", "url": "https://go.dev/ref/spec#Variable_declarations" },
        { "title": "Go spec: Short variable declarations", "url": "https://go.dev/ref/spec#Short_variable_declarations" }
      ]
    },
    {
      "id": "basic-types",
      "title": "Basic types (int, float64, string, bool)",
      "explanation": "Go has four types you will use constantly. `int` holds whole numbers like 42 or -7. `float64` holds numbers with a decimal part like 3.14 (float means 'floating-point number'; the 64 is how many bits of memory it uses). `string` holds text, written in double quotes like \"hi\". `bool` holds exactly one of two values, `true` or `false`.\n\nWhen you write a bare literal (a value typed directly in the code), Go picks a default type: 42 is an int, 3.14 is a float64, \"hi\" is a string and true is a bool.\n\nTo check a type, use `fmt.Printf` with the verb `%T`. Printf prints a template where each verb (a `%` followed by a letter) is replaced by the next argument; `%T` means 'print the type of this value'. The `\\n` at the end of the template is a newline.\n\nThere are also sized integer types such as `int64` (a whole number using 64 bits) and `uint8` (an unsigned 8-bit number, 0 to 255; unsigned means it cannot be negative). `byte` is just another name for `uint8`, so `%T` prints `uint8` for a byte.\n\nGo never mixes types automatically. You cannot add an int to a float64, or an int to an int64, without converting one of them yourself (shown in the Type conversion sub-topic).",
      "analogy": "Each type is a container shaped for its content: an egg carton for whole items (int), a measuring jug for fractions of a litre (float64), an envelope for written text (string) and a light switch that is only on or off (bool). The sized integers are the same egg carton in different sizes. You cannot pour juice into an egg carton, and Go will not quietly pour one container into another either.",
      "code": [
        {
          "language": "go",
          "filename": "types.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Printf(\"%T %T %T %T\\n\", 42, 3.14, \"hi\", true)\n\n\tvar small uint8 = 200\n\tvar big int64 = 9000000000\n\tvar b byte = 65\n\tfmt.Printf(\"%T %T %T\\n\", small, big, b)\n\n\tvar priceCents int64 = 1999\n\tfmt.Println(priceCents)\n}\n",
          "output": "int float64 string bool\nuint8 int64 uint8\n1999",
          "explanation": "The first line shows the default types of literals. The second shows the sized types; byte is reported as uint8 because they are the same type. The last variable stores a price of 19.99 as whole cents in an int64."
        }
      ],
      "productionNote": "Use int for counts, lengths and most IDs, float64 for measurements such as temperatures, and int64 for values that must be exact and may be large. Never store money in a float64: decimals like 0.1 cannot be stored exactly as binary digits (the 0s and 1s a computer uses for numbers), so errors creep in. Store whole cents in an int64 instead.",
      "commonMistakes": [
        "Adding an int and a float64, for example `a + b`. The compiler reports `invalid operation: a + b (mismatched types int and float64)`. Convert one side first.",
        "Using float64 for money. Rounding errors appear; use integer cents.",
        "Putting a value outside a sized type's range, such as 300 in a uint8 (maximum 255). Constants like this are rejected at compile time."
      ],
      "sources": [
        { "title": "Go spec: Numeric types", "url": "https://go.dev/ref/spec#Numeric_types" },
        { "title": "Go spec: String types", "url": "https://go.dev/ref/spec#String_types" },
        { "title": "Go spec: Boolean types", "url": "https://go.dev/ref/spec#Boolean_types" }
      ]
    },
    {
      "id": "zero-values",
      "title": "Zero values",
      "explanation": "If you declare a variable with `var` and give it no value, Go does not leave it undefined or filled with leftover garbage. It automatically sets it to the zero value of its type: 0 for numbers (including 0 for a float64), the empty string \"\" for string, and false for bool.\n\nThis means a freshly declared variable is always safe to read. `var count int` is a counter ready to be incremented, with no setup step.\n\nThe example prints each one with Printf. `%d` prints a whole number, `%v` prints a value in its default format, `%q` prints text wrapped in double quotes (so an empty string is visible as `\"\"`), and `%t` prints a bool.",
      "analogy": "A zero value is like a brand-new paper form where every field is already pre-filled with a sensible blank: the number fields say 0, the text line is empty, and the checkbox is unticked. You never receive a form with scribbles from the previous user.",
      "code": [
        {
          "language": "go",
          "filename": "zero.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tvar i int\n\tvar f float64\n\tvar s string\n\tvar b bool\n\tfmt.Printf(\"%d %v %q %t\\n\", i, f, s, b)\n}\n",
          "output": "0 0 \"\" false",
          "explanation": "None of the four variables was assigned, yet each holds a well-defined value: 0, 0, an empty string (shown as two quote marks by %q) and false."
        }
      ],
      "productionNote": "Go code is designed so that the zero value is useful: a counter starts at 0, a flag starts false, and later topics (structs, sync.Mutex) rely on this so that you can use a variable straight after declaring it.",
      "commonMistakes": [
        "Treating \"\" or 0 as 'not set'. A zero value is a real value; you cannot tell 'user typed nothing' from 'never filled in' without another variable.",
        "Expecting an int or string to be nil (nil is Go's word for \"no value\"; these types can never hold it). Those types can never be nil; they start at 0 and \"\"."
      ],
      "sources": [
        { "title": "Go spec: The zero value", "url": "https://go.dev/ref/spec#The_zero_value" }
      ]
    },
    {
      "id": "constants-and-iota",
      "title": "Constants and iota",
      "explanation": "A constant is a named value that can never change after it is defined. You declare it with `const`, for example `const Pi = 3.14159`. Trying to assign to a constant is a compile error.\n\nA constant written without a type is called untyped. It adapts to the context where it is used: `Pi` can be used with a float64 variable without any conversion, and `maxRetries` below could be used as an int or a float64.\n\nFor a list of related values, Go uses iota. Inside a `const ( ... )` block (a group of constants in parentheses), `iota` starts at 0 and goes up by 1 on each line. A line with no expression repeats the previous line's expression, so only the first line needs `= iota`.\n\nTo give such values a meaningful type, first declare a new type with `type Weekday int`. This creates a named type, Weekday, that is built on int but is its own distinct type. Then `Sunday Weekday = iota` makes Sunday 0, Monday 1 and Tuesday 2, all of type Weekday. This is Go's way of writing an enum (a fixed set of named choices).\n\nEach new const block starts iota again at 0. That is why `High` in the second block below is 1, not 4.",
      "analogy": "iota is a ticket dispenser for one queue: the first ticket is 0, the next is 1, then 2. A new const block is a new queue with its own dispenser, which starts again at 0. A constant itself is a sign carved in stone, while a variable is a whiteboard.",
      "code": [
        {
          "language": "go",
          "filename": "consts.go",
          "source": "package main\n\nimport \"fmt\"\n\ntype Weekday int\n\nconst (\n\tSunday Weekday = iota\n\tMonday\n\tTuesday\n)\n\nconst (\n\tLow = iota\n\tHigh\n)\n\nconst Pi = 3.14159\nconst maxRetries = 3\n\nfunc main() {\n\tfmt.Println(Sunday, Tuesday)\n\n\tvar radius float64 = 2\n\tfmt.Println(Pi * radius * radius)\n\n\tfmt.Println(maxRetries, High)\n}\n",
          "output": "0 2\n12.56636\n3 1",
          "explanation": "Sunday is 0 and Tuesday is 2 because iota counts up the lines of the first block. Pi, an untyped constant, works directly with the float64 radius (the * operator multiplies). High is 1 because the second block restarted iota at 0."
        }
      ],
      "productionNote": "Constants are used for states (for example order status values with iota), log levels, and limits like `const maxRetries = 3`. Naming them removes 'magic numbers' (unexplained numbers) from your code.",
      "commonMistakes": [
        "Assigning to a constant after declaring it, such as `maxRetries = 4`. This is a compile error.",
        "Assuming iota keeps counting across separate const blocks. It restarts at 0 in each block.",
        "Forgetting that `type Weekday int` makes a distinct type: a Weekday cannot be mixed with a plain int variable without a conversion."
      ],
      "sources": [
        { "title": "Go spec: Constant declarations", "url": "https://go.dev/ref/spec#Constant_declarations" },
        { "title": "Go spec: Iota", "url": "https://go.dev/ref/spec#Iota" }
      ]
    },
    {
      "id": "type-conversion",
      "title": "Type conversion",
      "explanation": "Because Go never mixes types automatically, you convert explicitly by writing the target type like a function: `float64(x)` turns the int x into a float64, and `int(f)` turns the float64 f into an int.\n\nConverting a float to an int truncates, meaning it throws away the decimal part and moves toward zero. So `int(3.99)` is 3 and `int(-3.99)` is -3; it does not round. Precision can be lost, like cents when you exchange currency.\n\nOrder matters. In `float64(7 / 2)` the division of two whole numbers happens first and gives 3 (whole-number division drops the remainder), and only then is 3 converted. To get 3.5, convert before dividing, as in `float64(x) / 2`.\n\nOne rule applies to constants: writing `int(3.99)` with a literal is a compile error ('constant truncated'), because Go refuses to silently lose digits from a fixed value. A variable holding 3.99 is fine.\n\nBeware `string(65)`. It does not give \"65\"; it gives \"A\", the character whose code is 65. To turn a number into its digits as text, use `strconv.Itoa` from the standard library's strconv package (covered in topic 05). Also, converting a large int64 to a smaller type such as int32 can overflow (wrap around to a wrong value) without any error.",
      "analogy": "Conversion is a currency exchange desk. Rupees never turn into dollars on their own; you walk to the desk and exchange them explicitly, and you may lose the small change in the process (the truncated decimals).",
      "code": [
        {
          "language": "go",
          "filename": "convert.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tx := 7\n\ty := float64(x) / 2\n\tf := 3.99\n\tn := int(f)\n\twrong := float64(7 / 2)\n\tfmt.Println(y, n, wrong)\n\n\tfmt.Println(n, int(-f))\n\n\tvar id int64 = 42\n\tcount := int(id) + x\n\tfmt.Println(count)\n}\n",
          "output": "3.5 3 3\n3 -3\n49",
          "explanation": "float64(x) / 2 is 3.5 because the division happens in floating point. int(f) truncates 3.99 to 3 and int(-f) truncates -3.99 to -3. float64(7 / 2) divides whole numbers first, so it prints 3. The last lines convert an int64 to int so it can be added to x."
        }
      ],
      "productionNote": "Common real uses are converting counts to float64 to compute averages, and converting between int and int64 at boundaries such as database code and API code (an API is a service other programs call). Convert early and check ranges before shrinking to a smaller integer type.",
      "commonMistakes": [
        "Dividing integers before converting, e.g. `float64(7/2)` gives 3, not 3.5.",
        "Using `string(65)` expecting \"65\". It gives \"A\"; use `strconv.Itoa(65)`.",
        "Converting a large int64 to int32 and getting a wrong, wrapped-around number with no error.",
        "Expecting `int(3.99)` to round to 4. It truncates to 3."
      ],
      "sources": [
        { "title": "Go spec: Conversions", "url": "https://go.dev/ref/spec#Conversions" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Where can the short declaration `:=` be used?",
      "options": [
        "Only inside a function body",
        "Anywhere, including at package level",
        "Only at package level",
        "Only for string variables"
      ],
      "answerIndex": 0,
      "explanation": "`:=` is allowed only inside functions. At package level you must use `var`."
    },
    {
      "question": "What is the zero value of a string variable declared with `var s string`?",
      "options": [
        "nil",
        "The empty string \"\"",
        "The text \"0\"",
        "It is undefined until assigned"
      ],
      "answerIndex": 1,
      "explanation": "Strings start as the empty string. Go never leaves variables undefined, and a string can never be nil."
    },
    {
      "question": "In `const ( Sunday Weekday = iota; Monday; Tuesday )`, what is the value of Tuesday?",
      "options": [
        "0",
        "1",
        "3",
        "2"
      ],
      "answerIndex": 3,
      "explanation": "iota counts 0, 1, 2 down the block, so Sunday is 0, Monday is 1 and Tuesday is 2."
    },
    {
      "question": "What does `int(f)` give when f is the float64 value 3.99?",
      "options": [
        "4, because it rounds",
        "3, because it truncates the decimal part",
        "3.99, unchanged",
        "A compile error, because f is a variable"
      ],
      "answerIndex": 1,
      "explanation": "Converting a float to an int truncates toward zero, so 3.99 becomes 3. Only a constant like `int(3.99)` is a compile error."
    },
    {
      "question": "Why does adding an int variable to a float64 variable fail to compile?",
      "options": [
        "Go has no addition for floats",
        "Variables cannot be added in Go",
        "Go never converts between types automatically, so you must convert one explicitly",
        "The int must be declared with var instead of :="
      ],
      "answerIndex": 2,
      "explanation": "Go reports `mismatched types int and float64`. Fix it with an explicit conversion such as `float64(a) + b`."
    }
  ]
});
