window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "05-strings-formatting",
  "order": 5,
  "title": "Strings, Runes & Formatting",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7",
  "summary": "Text is everywhere in real programs, and Go has precise rules for it: a string is a read-only run of bytes, and a rune is one character. You will learn the strings package, how to convert between text and numbers with strconv, and how to build formatted output with fmt verbs (the % codes that mark where a value goes).",
  "prerequisites": [
    "04-functions"
  ],
  "subtopics": [
    {
      "id": "strings-as-bytes",
      "title": "Strings as immutable bytes",
      "explanation": "A string in Go is a read-only sequence of bytes. A byte is an 8-bit number, so it holds a value from 0 to 255. Every piece of text is stored as a row of these numbers.\n\nThe built-in len(s) returns the number of bytes in s, not the number of characters. For plain English letters each character is one byte, so the two agree. For a letter like é, Go stores two bytes, so len is larger than the character count.\n\nWrite s[i] (indexing: pick the item at position i, counting from 0) to read one byte. The result is a number of type byte, not a character. In \"héllo\", s[0] is the letter h, whose byte value is 104.\n\nStrings are immutable, meaning you cannot change them after creation. The statement s[0] = 'H' does not compile (the compiler rejects the program before it runs). To get a different text, build a new string. The + operator joins two strings into a new one and leaves the originals untouched.\n\nA raw string is written with backticks instead of double quotes. Nothing inside is treated specially: backslashes stay as typed, and the text can span several lines. This is handy for Windows paths, regular expressions (patterns for matching text) and SQL queries (SQL is the language for asking databases questions).\n\nSetup: create a folder, run go mod init example.com/strs inside it as in topic 01, save the code as bytes.go, and run it with go run .",
      "analogy": "A string is a sentence printed on paper. You can read any letter at any position, but you cannot erase one letter and write another. To change the sentence you print a whole new sheet, and the old sheet stays as it was.",
      "code": [
        {
          "language": "go",
          "filename": "bytes.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\ts := \"héllo\"\n\tfmt.Println(len(s), s[0])\n\n\tt := s + \"!\"\n\tfmt.Println(t)\n\tfmt.Println(s)\n\n\traw := `C:\\temp\\new`\n\tfmt.Println(raw)\n}\n",
          "output": "6 104\nhéllo!\nhéllo\nC:\\temp\\new\n",
          "explanation": "len(s) is 6 because é uses 2 bytes, and s[0] is 104, the byte for h. Joining with + creates t while s stays unchanged. The raw string keeps the backslashes exactly as typed; in a normal \"...\" string, \\t would become a tab."
        }
      ],
      "productionNote": "Raw strings keep SQL and regular expressions readable because you do not have to double every backslash. When you compare IDs or keys, remember that comparing strings with == compares bytes, so it is exact and case-sensitive.",
      "commonMistakes": [
        "Writing s[0] = \"H\" to change a letter. This is a compile error because strings are read-only; build a new string instead.",
        "Assuming len(s) is the number of characters. It is the number of bytes, so len(\"héllo\") is 6, not 5.",
        "Expecting s[i] to give a character. It gives a byte (a number), so fmt.Println(s[0]) prints 104, not h."
      ],
      "sources": [
        {
          "title": "Go blog: Strings, bytes, runes and characters in Go",
          "url": "https://go.dev/blog/strings"
        },
        {
          "title": "Go spec: String types",
          "url": "https://go.dev/ref/spec#String_types"
        }
      ]
    },
    {
      "id": "runes-utf8",
      "title": "Runes and UTF-8",
      "explanation": "Unicode is the worldwide catalogue that gives every character (letters, accents, symbols, emoji) a number. UTF-8 is the way Go stores those numbers in bytes: one character takes between 1 and 4 bytes. Plain English letters take 1 byte, é takes 2.\n\nA rune is Go's name for one Unicode character. Its type rune is an alias (another name for the same type) of int32, a 32-bit whole number. A rune literal uses single quotes: 'a' is a rune (the number 97), while \"a\" is a string. Printing 'a' with Println shows 97.\n\nTo walk through characters, use for i, r := range s. On a string, range decodes the UTF-8 bytes and gives you each rune r together with i, the byte position where that character starts. Because é takes 2 bytes, the positions in \"héllo\" are 0, 1, 3, 4, 5, with no position 2.\n\nstring(r) turns a rune back into a one-character string. To count characters, import the unicode/utf8 package (the standard library's UTF-8 helpers) and call utf8.RuneCountInString(s).\n\nA slice expression s[a:b] (take the bytes from position a up to but not including b) works on byte positions. If you cut in the middle of a multi-byte character, you get broken text. The %q verb shows this: it prints the cut-off byte as \\xc3, a hexadecimal escape (a byte written as two base-16 digits).",
      "analogy": "Think of Lego. Every character is a model built from 1 to 4 bricks (bytes). len counts loose bricks, while range hands you one finished model at a time, plus the number of the brick where it starts.",
      "code": [
        {
          "language": "go",
          "filename": "runes.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"unicode/utf8\"\n)\n\nfunc main() {\n\ts := \"héllo\"\n\tfor i, r := range s {\n\t\tfmt.Println(i, string(r))\n\t}\n\n\tfmt.Println(utf8.RuneCountInString(s))\n\tfmt.Println('a', \"a\")\n\n\t// Cutting after 2 bytes splits the two-byte é in half.\n\tfmt.Printf(\"%q\\n\", s[:2])\n}\n",
          "output": "0 h\n1 é\n3 l\n4 l\n5 o\n5\n97 a\n\"h\\xc3\"\n",
          "explanation": "range yields whole characters with their starting byte index, so index 2 is skipped. RuneCountInString returns 5 characters although len is 6. The rune 'a' prints as its number 97 while \"a\" prints as text. s[:2] keeps h and only the first byte of é, which %q shows as \\xc3."
        }
      ],
      "productionNote": "User names and messages can contain any language, so never assume one byte per character. Count with utf8.RuneCountInString and loop with range. When you truncate text for display, cut at a rune boundary, not at an arbitrary byte.",
      "commonMistakes": [
        "Looping with for i := 0; i < len(s); i++ and treating s[i] as a character. This breaks on any non-ASCII text because you see raw bytes.",
        "Slicing in the middle of a multi-byte character, which produces invalid text.",
        "Mixing up quotes: 'a' (single quotes) is a rune, \"a\" (double quotes) is a string. They are different types and cannot be compared directly."
      ],
      "sources": [
        {
          "title": "Go blog: Strings, bytes, runes and characters in Go",
          "url": "https://go.dev/blog/strings"
        },
        {
          "title": "unicode/utf8: RuneCountInString",
          "url": "https://pkg.go.dev/unicode/utf8#RuneCountInString"
        },
        {
          "title": "Go spec: For statements with range clause",
          "url": "https://go.dev/ref/spec#For_range"
        }
      ]
    },
    {
      "id": "strings-package",
      "title": "The strings package: Contains, Split, Cut, Builder",
      "explanation": "The standard library package strings holds the everyday text tools. Add import \"strings\" and call them as strings.Name(...). None of them change the original string, because strings are immutable; each returns a new value.\n\nTests and changes: strings.Contains(s, sub) reports true if sub appears inside s. strings.HasPrefix(s, p) reports whether s starts with p. strings.ToUpper(s) returns an upper-case copy. strings.TrimSpace(s) removes spaces, tabs and newlines from both ends.\n\nSplitting and joining: strings.Split(s, sep) cuts s at every sep and returns a slice, which is an ordered list of values (topic 06 covers slices fully). fmt.Println prints a slice in square brackets with spaces between items. strings.Join(parts, sep) does the reverse and glues a slice of strings together with sep between them.\n\nstrings.Cut(s, sep) splits once, at the first sep. It returns three values: the text before, the text after, and a bool (true or false) saying whether sep was found. If sep is missing, you get the whole string, an empty string and false. This is the standard tool for key=value text. Go 1.27 also adds strings.CutLast, which works like Cut but splits at the last match.\n\nstrings.Builder builds a string efficiently. Declare var b strings.Builder, call b.WriteString(text) as many times as needed, then read the result with b.String(). Using += in a loop copies the whole string every time, which gets slow for large loops; Builder avoids that.",
      "analogy": "The strings package is a Swiss army knife for text: one handle, many blades. Contains is the magnifier, Split the scissors, Join the glue, Cut the knife that slices once, and Builder the sewing machine that stitches many pieces without redoing the whole garment each time.",
      "code": [
        {
          "language": "go",
          "filename": "strs.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"strings\"\n)\n\nfunc main() {\n\tfmt.Println(strings.Contains(\"seafood\", \"foo\"))\n\tfmt.Println(strings.HasPrefix(\"golang\", \"go\"))\n\tfmt.Println(strings.ToUpper(\"go\"))\n\tfmt.Printf(\"%q\\n\", strings.TrimSpace(\"  hi  \"))\n\n\tparts := strings.Split(\"a,b,c\", \",\")\n\tfmt.Println(parts, len(parts))\n\tfmt.Println(strings.Join(parts, \"-\"))\n\n\tk, v, ok := strings.Cut(\"port=8080\", \"=\")\n\tfmt.Println(k, v, ok)\n\n\tvar b strings.Builder\n\tfor i := range 3 {\n\t\tif i > 0 {\n\t\t\tb.WriteString(\"-\")\n\t\t}\n\t\tb.WriteString(\"go\")\n\t}\n\tfmt.Println(b.String())\n\n\tfmt.Println(len(strings.Split(\"\", \",\")))\n}\n",
          "output": "true\ntrue\nGO\n\"hi\"\n[a b c] 3\na-b-c\nport 8080 true\ngo-go-go\n1\n",
          "explanation": "Split gives a slice of three items, and Join turns it back into one string. Cut returns the key, the value and true. The Builder loop writes a dash before every item except the first, giving go-go-go. The last line shows that splitting an empty string returns one empty item, so its length is 1, not 0."
        }
      ],
      "productionNote": "Cut is the cleanest way to parse key=value config lines, HTTP headers (the name: value lines sent with a web request) and URL parts (the pieces of a web address). Use strings.Builder whenever you assemble output in a loop, for example building a report or a long log line.",
      "commonMistakes": [
        "Using += to build a big string in a loop. It copies the string on every pass and gets slow; use strings.Builder.",
        "Forgetting that strings.Split(\"\", \",\") returns a slice with one empty string, not an empty slice. Check for empty input first if that matters.",
        "Ignoring the third result of Cut. If the separator is missing, the first result is the whole string, so check ok."
      ],
      "sources": [
        {
          "title": "Package strings",
          "url": "https://pkg.go.dev/strings"
        },
        {
          "title": "strings.Cut",
          "url": "https://pkg.go.dev/strings#Cut"
        },
        {
          "title": "strings.Builder",
          "url": "https://pkg.go.dev/strings#Builder"
        }
      ]
    },
    {
      "id": "strconv-conversions",
      "title": "strconv conversions",
      "explanation": "Text and numbers are different types in Go, and Go never converts between them silently. The standard library package strconv (string conversion) does it explicitly.\n\nstrconv.Itoa(42) turns the int 42 into the string \"42\" (Itoa means integer to ASCII, where ASCII is the numbered table of letters and symbols). Do not write string(42): that converts the number to the character with that code, which is the symbol *, and go vet flags it.\n\nstrconv.Atoi(\"123\") goes the other way (ASCII to integer). It parses the text, meaning it reads it and works out its meaning, and returns two values: the int and an error. An error is a built-in value that describes what went wrong, and nil means no error. Topic 11 covers errors in depth; for now the pattern is: call the function, then check if err != nil before using the number.\n\nWhen the text is not a valid number, Atoi returns 0 and an error whose message names the function, the bad input and the reason: strconv.Atoi: parsing \"12a\": invalid syntax.\n\nThree more functions follow the same shape. strconv.ParseFloat(s, 64) reads a decimal number as a float64 (the 64 is the bit size). strconv.ParseBool(s) reads true or false. strconv.FormatFloat(f, 'f', 2, 64) writes a float as text with 2 digits after the point: 'f' means plain decimal notation, with no exponent.",
      "analogy": "strconv is a translator between number language and text language. It can speak both directions, and when you hand it text that is not really a number, it does not guess: it tells you it could not translate.",
      "code": [
        {
          "language": "go",
          "filename": "conv.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"strconv\"\n)\n\nfunc main() {\n\tfmt.Println(strconv.Itoa(42) + \"!\")\n\n\tn, err := strconv.Atoi(\"123\")\n\tfmt.Println(n, err)\n\n\t_, err = strconv.Atoi(\"12a\")\n\tfmt.Println(err)\n\n\tf, err := strconv.ParseFloat(\"3.5\", 64)\n\tif err != nil {\n\t\tfmt.Println(\"bad float:\", err)\n\t\treturn\n\t}\n\tfmt.Println(f * 2)\n\n\tfmt.Println(strconv.FormatFloat(3.14159, 'f', 2, 64))\n}\n",
          "output": "42!\n123 <nil>\nstrconv.Atoi: parsing \"12a\": invalid syntax\n7\n3.14\n",
          "explanation": "Itoa makes \"42\" so + can join it with \"!\". The first Atoi succeeds, so err prints as <nil>. The second fails, and the blank identifier _ discards the unused number. ParseFloat is checked with if err != nil before f is used. FormatFloat rounds to 2 decimals."
        }
      ],
      "productionNote": "Query parameters (the ?key=value part of a web address), CSV files (comma-separated text, one record per line), environment variables (named settings a program receives from the operating system) and form values (what a user typed into a web form) all arrive as text. Convert them with strconv at the edge of your program, always check the error, and reject bad input with a clear message instead of using a zero value.",
      "commonMistakes": [
        "Writing string(42) to get \"42\". It gives the character with code 42 instead; use strconv.Itoa(42).",
        "Ignoring the error from Atoi. A failed parse returns 0, which looks like a valid number and hides bad input.",
        "Passing text with spaces, such as \" 12\", to Atoi. It is invalid; clean the input with strings.TrimSpace first."
      ],
      "sources": [
        {
          "title": "strconv.Atoi",
          "url": "https://pkg.go.dev/strconv#Atoi"
        },
        {
          "title": "strconv.Itoa",
          "url": "https://pkg.go.dev/strconv#Itoa"
        }
      ]
    },
    {
      "id": "fmt-verbs",
      "title": "fmt verbs and Sprintf",
      "explanation": "The fmt package formats values into text. A format string is a template that contains verbs: a verb is a code starting with % that marks where a value goes and how to show it. Values are filled in, in order, from the arguments after the template.\n\nCommon verbs: %v the value in its default form, %d a whole number, %s a string, %q a string in double quotes with special characters escaped, %f a decimal number, %t true or false, %T the type of the value, and %% a literal percent sign. %+v adds field names when printing structs, which topic 08 introduces.\n\nWidth and precision go between % and the letter. %.2f shows 2 digits after the decimal point. %5.2f also makes the whole field at least 5 characters wide, padding on the left with spaces. %-6s pads a string to 6 characters and the minus sign left-aligns it. This is how you line up columns.\n\nThree functions share this template syntax. fmt.Printf prints the result and adds no newline, so end the template with \\n. fmt.Sprintf returns the result as a string instead of printing. fmt.Println needs no template: it separates its arguments with spaces and adds a newline.\n\nIf the arguments do not match the verbs, Go does not stop. Fewer arguments than verbs prints text such as %!d(MISSING). A verb of the wrong type prints something like %!d(string=hi). Run go vet (topic 01) to catch such mistakes before running.",
      "analogy": "A format string is a mail-merge letter: \"Dear ____, your total is ____.\" The blanks are the verbs, and they are filled in order with the values you pass. Sprintf hands you the finished letter, while Printf drops it straight into the output.",
      "code": [
        {
          "language": "go",
          "filename": "fmtx.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\ts := fmt.Sprintf(\"%-6s|%5.2f|%q\", \"tea\", 3.14159, \"hi\")\n\tfmt.Println(s)\n\n\tfmt.Printf(\"%v %d %s %t %T\\n\", 7, 7, \"go\", true, 3.5)\n\tfmt.Printf(\"%d%%\\n\", 50)\n\tfmt.Println(\"a\", 1, \"b\")\n}\n",
          "output": "tea   | 3.14|\"hi\"\n7 7 go true float64\n50%\na 1 b\n",
          "explanation": "%-6s writes tea plus three spaces, %5.2f writes 3.14 with one leading space to reach width 5, and %q wraps hi in quotes. The second line shows five verbs with five arguments, and %T reports float64 for 3.5. %% prints a single percent sign. Println adds the spaces between its arguments itself."
        }
      ],
      "productionNote": "Sprintf builds log lines, error messages and aligned tables printed in the terminal. Always end Printf templates with \\n, and run go vet in your build, since it checks verb and argument types for you.",
      "commonMistakes": [
        "Forgetting \\n in Printf, so the next output continues on the same line.",
        "Having more verbs than arguments, which prints %!d(MISSING), or the reverse, which appends %!(EXTRA ...) to the output.",
        "Using the wrong verb for the type, such as %d with a string. The output is garbled, and go vet reports it."
      ],
      "sources": [
        {
          "title": "fmt: Printing",
          "url": "https://pkg.go.dev/fmt#hdr-Printing"
        },
        {
          "title": "fmt.Sprintf",
          "url": "https://pkg.go.dev/fmt#Sprintf"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "What does len(\"héllo\") return, given that é is stored in 2 bytes?",
      "options": [
        "5",
        "6",
        "7",
        "4"
      ],
      "answerIndex": 1,
      "explanation": "len counts bytes, not characters. h, l, l and o take 1 byte each and é takes 2, so the total is 6."
    },
    {
      "question": "What does for i, r := range s yield when s is a string?",
      "options": [
        "Each byte, with i as the character count so far",
        "Each rune (character), with i as the byte position where it starts",
        "Each word, with i as the word number",
        "Each line, with i as the line number"
      ],
      "answerIndex": 1,
      "explanation": "range over a string decodes UTF-8 and gives a rune r plus the starting byte index i. That is why the indexes in \"héllo\" skip from 1 to 3."
    },
    {
      "question": "What does k, v, ok := strings.Cut(\"port=8080\", \"=\") produce?",
      "options": [
        "k is \"port=8080\", v is \"\", ok is false",
        "k is \"8080\", v is \"port\", ok is true",
        "k is \"port\", v is \"8080\", ok is true",
        "It panics, because Cut needs at least two separators"
      ],
      "answerIndex": 2,
      "explanation": "Cut splits once at the first separator and returns the text before, the text after (the separator itself is dropped) and true because the separator was found."
    },
    {
      "question": "How do you correctly convert the string \"123\" into an int?",
      "options": [
        "int(\"123\")",
        "string(123)",
        "n, err := strconv.Atoi(\"123\") and then check err",
        "strconv.Itoa(\"123\")"
      ],
      "answerIndex": 2,
      "explanation": "strconv.Atoi parses text into an int and returns an error value you must check. int(\"123\") does not compile for a string, and Itoa goes the opposite direction, from int to string."
    },
    {
      "question": "What does fmt.Sprintf(\"%5.2f\", 3.14159) return?",
      "options": [
        "\"3.14159\"",
        "\"3.142\", rounded to 3 digits after the point",
        "\" 3.14\", which is 5 characters wide with 2 digits after the point",
        "\"  3.1\""
      ],
      "answerIndex": 2,
      "explanation": "The precision .2 gives 3.14, which is 4 characters. The width 5 pads it on the left with one space to reach 5 characters."
    }
  ]
});
