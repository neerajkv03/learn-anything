window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "03-control-flow",
  "order": 3,
  "title": "Operators and Control Flow",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Learn the symbols Go uses for maths, comparing and combining yes/no answers. Then learn how a program chooses a path with if and switch, and repeats work with for loops, using break and continue to steer them.",
  "prerequisites": [
    "02-variables-types"
  ],
  "subtopics": [
    {
      "id": "operators",
      "title": "Arithmetic, comparison and logical operators",
      "explanation": "An operator is a symbol that does something to values, which are called its operands. In 3 + 4 the operator is + and the operands are 3 and 4. An expression is any piece of code that produces a value, such as 3 + 4. A statement is a complete instruction that does something but does not produce a value you can reuse.\n\nArithmetic operators: + (add), - (subtract), * (multiply), / (divide) and % (remainder after division, so 7 % 2 is 1). When both operands are integers, / throws away the fractional part: 7 / 2 is 3, not 3.5. If at least one operand is a decimal number, you get a decimal result: 7.0 / 2 is 3.5.\n\nx++ adds 1 to x and x-- subtracts 1. In Go these are statements, not expressions, so you cannot write y := x++ . That line is a compile error (the compiler, the tool that turns your code into a program, refuses to build it).\n\nComparison operators ask a yes/no question and give a bool (true or false): == equal, != not equal, < less than, <= less than or equal, > greater than, >= greater than or equal. Note that == compares, while a single = is not used for comparing at all.\n\nLogical operators combine bool values: && means 'and' (both must be true), || means 'or' (at least one must be true), and ! flips true to false and back. && and || short-circuit: Go evaluates the left side first, and if that already decides the answer, it never evaluates the right side. This lets you guard a risky check, for example 'd != 0 && 10/d > 2' never divides by zero when d is 0.\n\nSave each example as its own file, such as ops.go, in the module folder from topic 01, and run it with `go run ops.go` (not `go run .`).",
      "analogy": "Arithmetic operators are a pocket calculator, and comparisons are yes/no questions you ask about two numbers. Short-circuit is two locked doors in a row joined by 'and': if the first door is locked you never walk to the second, because you already know you cannot get through both.",
      "code": [
        {
          "language": "go",
          "filename": "ops.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(7/2, 7%2, 7.0/2, 3 < 5 && 2 > 1, !true)\n\n\tcount := 5\n\tcount++\n\tfmt.Println(count)\n\n\tpage, size := 3, 20\n\toffset := (page - 1) * size\n\tfmt.Println(offset)\n\n\td := 0\n\tsafe := d != 0 && 10/d > 2\n\tfmt.Println(safe)\n}\n",
          "output": "3 1 3.5 true false\n6\n40\nfalse",
          "explanation": "The first line prints integer division (3), remainder (1), decimal division (3.5), a combined comparison (true) and a negation (false). count++ turns 5 into 6. The offset line is pagination maths: page 3 with 20 items per page skips the first 40 items. In the last block d != 0 is false, so && skips 10/d entirely and no divide-by-zero crash happens."
        }
      ],
      "productionNote": "Pagination (showing a long list one page at a time) maths such as offset := (page-1) * size is everywhere in web APIs (an API is a service other programs call). Validation checks combine comparisons with && and ||, for example 'size >= 1 && size <= 100'. Put the cheap or safe check on the left so short-circuiting protects the right side.",
      "commonMistakes": [
        "Expecting 3.5 from 7 / 2. With two integers Go gives 3. Make one operand a decimal (7.0 / 2) to get 3.5.",
        "Writing y := x++ . ++ is a statement, not an expression, so this is a compile error. Write x++ on its own line, then use x.",
        "Using = (assign) where == (compare) is meant."
      ],
      "sources": [
        {
          "title": "Go spec: Arithmetic operators",
          "url": "https://go.dev/ref/spec#Arithmetic_operators"
        },
        {
          "title": "Go spec: Comparison operators",
          "url": "https://go.dev/ref/spec#Comparison_operators"
        },
        {
          "title": "Go spec: Logical operators",
          "url": "https://go.dev/ref/spec#Logical_operators"
        }
      ]
    },
    {
      "id": "if-else",
      "title": "if/else with an init statement",
      "explanation": "An if statement runs a block of code only when a condition (an expression giving true or false) is true. A block is the code between { and }. The shape is: if condition { ... } else if condition { ... } else { ... }. Go uses no parentheses around the condition, and the braces are always required.\n\nThe else keyword must sit on the same line as the closing }. Writing else on a new line is a syntax error (the code is not valid Go grammar, so the compiler stops).\n\nAn if can start with an init statement, a short statement followed by a semicolon, before the condition: if n := len(\"gopher\"); n > 3 { ... }. The built-in len gives the number of bytes in a string; for plain English letters that equals the number of letters (strings are covered fully in a later topic). The variable n exists only inside this if and its else branches. That limit is called its scope: the region of code where a name can be used. Using n after the closing } is a compile error.",
      "analogy": "An if is a bouncer at a door who checks one rule and sends you one way or the other. The init statement is a wristband handed out at that door: it is valid only inside that venue, and it is gone once you leave.",
      "code": [
        {
          "language": "go",
          "filename": "grade.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tscore := 72\n\tif score >= 90 {\n\t\tfmt.Println(\"A\")\n\t} else if score >= 70 {\n\t\tfmt.Println(\"B\")\n\t} else {\n\t\tfmt.Println(\"C\")\n\t}\n\n\tif n := len(\"gopher\"); n > 3 {\n\t\tfmt.Println(\"long name\", n)\n\t}\n}\n",
          "output": "B\nlong name 6",
          "explanation": "72 is not >= 90, but it is >= 70, so B prints and the else branch is skipped. In the second if, n is set to 6 (the length of gopher), 6 > 3 is true, so the message prints. Trying to print n after that if would not compile."
        }
      ],
      "productionNote": "The init form is the standard way to handle failures: if err := save(); err != nil { ... } (error handling is covered in a later topic). It keeps the temporary variable from leaking into the rest of the function.",
      "commonMistakes": [
        "Putting else on a new line after the closing }. It must be written as } else {.",
        "Using the init variable after the if statement. It is out of scope there, so the compiler reports an undefined name.",
        "Adding parentheses and omitting braces, as in other languages. Go needs braces and does not need parentheses."
      ],
      "sources": [
        {
          "title": "Go spec: If statements",
          "url": "https://go.dev/ref/spec#If_statements"
        }
      ]
    },
    {
      "id": "for-loops",
      "title": "for loops: classic, condition-only, infinite and range over an int",
      "explanation": "A loop repeats a block of code. Each pass through the block is called an iteration. Go has only one loop keyword, for, with several forms. There is no while keyword.\n\nClassic form: for i := 0; i < 3; i++ { ... }. It has three parts: a start (i := 0, run once), a condition (i < 3, checked before each iteration) and a step (i++, run after each iteration). This prints i as 0, 1, 2.\n\nCondition-only form: for n > 1 { ... }. This is Go's 'while': it repeats as long as the condition is true. You must change something inside the loop so the condition eventually becomes false.\n\nInfinite form: for { ... } repeats forever until the code leaves it with break (a statement that exits the nearest loop immediately).\n\nRange over an int (Go 1.22 and newer): for i := range 3 { ... } gives i the values 0, 1, 2. It is the shortest way to say 'do this N times'. Also since Go 1.22, every iteration gets its own fresh copy of the loop variable, which avoids a class of confusing bugs.",
      "analogy": "Laps on a running track. Classic is 'count laps 0 to 2'. Condition-only is 'keep running while you still have energy'. Infinite is 'run until the coach blows the whistle', which is the break.",
      "code": [
        {
          "language": "go",
          "filename": "loops.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfor i := 0; i < 3; i++ {\n\t\tfmt.Println(i)\n\t}\n\n\tn := 8\n\tfor n > 1 {\n\t\tfmt.Println(n)\n\t\tn /= 2\n\t}\n\n\tfor i := range 3 {\n\t\tfmt.Println(i)\n\t}\n\n\ttotal := 0\n\tfor {\n\t\ttotal++\n\t\tif total == 3 {\n\t\t\tbreak\n\t\t}\n\t}\n\tfmt.Println(\"total\", total)\n}\n",
          "output": "0\n1\n2\n8\n4\n2\n0\n1\n2\ntotal 3",
          "explanation": "The classic loop prints 0, 1, 2. In the condition-only loop, n /= 2 is shorthand for n = n / 2, so n goes 8, 4, 2 and the loop stops when n becomes 1. The range loop prints 0, 1, 2 again. The infinite loop adds 1 to total each time and leaves via break when total reaches 3."
        }
      ],
      "productionNote": "Real programs use these forms for retry loops (try again up to N times), polling (check a condition repeatedly) and processing N items. An infinite for { } with a break (or a return, which ends the function) is also the usual shape of a long-running worker.",
      "commonMistakes": [
        "Looking for a while keyword. Use for condition { }.",
        "Off-by-one errors: i <= 3 runs four times (0, 1, 2, 3), not three.",
        "Writing an infinite loop with no break (or return, which ends the whole function), so the program never finishes. Also check that a condition-only loop changes the variable it tests."
      ],
      "sources": [
        {
          "title": "Go spec: For statements",
          "url": "https://go.dev/ref/spec#For_statements"
        },
        {
          "title": "Go spec: For statements with range clause",
          "url": "https://go.dev/ref/spec#For_range"
        }
      ]
    },
    {
      "id": "switch",
      "title": "switch",
      "explanation": "A switch replaces a long chain of if / else if when you compare one value against many options. Write switch day { case \"sat\", \"sun\": ... default: ... }. Go compares day with each case from top to bottom, runs the first one that matches, then leaves the switch. A case can list several values separated by commas. default runs when nothing matches.\n\nUnlike in many other programming languages, Go does not fall into the next case automatically, so you never need a break at the end of each case.\n\nA tagless switch has no value after the word switch, and each case holds its own yes/no condition: switch { case temp < 10: ... }. Go runs the first case whose condition is true. This is a tidy replacement for an if / else if chain.\n\nThe fallthrough keyword, written as the last statement in a case, forces execution to continue into the next case's body without checking its condition. It is rarely needed, but it shows what Go does not do by default.",
      "analogy": "A station departure board. Your ticket matches exactly one platform and you board only that train, never the next one as well. Fallthrough would be a rule that says 'also board the next train', and you have to ask for it explicitly.",
      "code": [
        {
          "language": "go",
          "filename": "day.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tday := \"sun\"\n\tswitch day {\n\tcase \"sat\", \"sun\":\n\t\tfmt.Println(\"weekend\")\n\tdefault:\n\t\tfmt.Println(\"weekday\")\n\t}\n\n\ttemp := 31\n\tswitch {\n\tcase temp < 10:\n\t\tfmt.Println(\"cold\")\n\tcase temp < 25:\n\t\tfmt.Println(\"mild\")\n\tdefault:\n\t\tfmt.Println(\"hot\")\n\t}\n\n\tswitch 2 {\n\tcase 2:\n\t\tfmt.Println(\"two\")\n\t\tfallthrough\n\tcase 3:\n\t\tfmt.Println(\"three\")\n\tcase 4:\n\t\tfmt.Println(\"four\")\n\t}\n}\n",
          "output": "weekend\nhot\ntwo\nthree",
          "explanation": "\"sun\" matches the first case, so weekend prints and the switch ends. In the tagless switch, 31 is neither < 10 nor < 25, so default prints hot. In the last switch, case 2 matches and prints two; fallthrough then runs the body of case 3 (three) without testing it, and case 4 is never reached."
        }
      ],
      "productionNote": "Switch is used to dispatch on a command name or an HTTP method (GET, POST and similar words that say what kind of web request arrived), to implement state machines (a state machine moves between named states such as pending, paid, shipped) and to map codes to messages.",
      "commonMistakes": [
        "Writing break at the end of every case. It is unnecessary in Go.",
        "Expecting the next case to run as well, as in many other languages, where a matched case also runs the next one. Go stops after the matched case unless you write fallthrough."
      ],
      "sources": [
        {
          "title": "Go spec: Switch statements",
          "url": "https://go.dev/ref/spec#Switch_statements"
        }
      ]
    },
    {
      "id": "break-continue",
      "title": "break and continue",
      "explanation": "Two statements steer a loop from the inside. continue skips the rest of the current iteration and jumps to the next one. break leaves the loop entirely.\n\nWith nested loops (a loop inside a loop), break only leaves the innermost one. To leave an outer loop, put a label, a name followed by a colon, on the line before that loop, then write break label. For example outer: before the outer for, and break outer inside.\n\nThe same trap applies to switch: a break inside a switch that sits inside a for only leaves the switch, not the loop. Use a labeled break on the for loop to leave the loop itself.",
      "analogy": "A playlist. continue is 'skip this song and play the next one'. break is 'switch the music off'. A labeled break is switching off the whole stereo, not just the track in the room you are standing in.",
      "code": [
        {
          "language": "go",
          "filename": "skip.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfor i := range 10 {\n\t\tif i%2 == 1 {\n\t\t\tcontinue\n\t\t}\n\t\tif i > 6 {\n\t\t\tbreak\n\t\t}\n\t\tfmt.Println(i)\n\t}\n\nouter:\n\tfor i := range 3 {\n\t\tfor j := range 3 {\n\t\t\tif i*j == 2 {\n\t\t\t\tfmt.Println(\"found\", i, j)\n\t\t\t\tbreak outer\n\t\t\t}\n\t\t}\n\t}\n}\n",
          "output": "0\n2\n4\n6\nfound 1 2",
          "explanation": "In the first loop, odd numbers hit continue and are skipped. Even numbers print until i reaches 8, where i > 6 triggers break, so the output is 0, 2, 4, 6. In the nested loops, i*j first equals 2 when i is 1 and j is 2. break outer stops both loops at once; a plain break would only have ended the inner loop."
        }
      ],
      "productionNote": "Use continue to skip invalid records in a batch, and break to stop at the first match when searching. Labeled break is the clean way out of a search through a grid or a nested structure.",
      "commonMistakes": [
        "Expecting break inside a switch inside a for to end the loop. It only leaves the switch; use a label.",
        "Defining a label and never using it. Go reports an unused label as a compile error."
      ],
      "sources": [
        {
          "title": "Go spec: Break statements",
          "url": "https://go.dev/ref/spec#Break_statements"
        },
        {
          "title": "Go spec: Continue statements",
          "url": "https://go.dev/ref/spec#Continue_statements"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "What does 7 / 2 evaluate to when both numbers are integers?",
      "options": [
        "3.5",
        "3",
        "4",
        "1"
      ],
      "answerIndex": 1,
      "explanation": "Integer division discards the fractional part, so 7 / 2 is 3. The remainder 1 is what 7 % 2 gives."
    },
    {
      "question": "In if n := len(s); n > 3 { ... }, where can the variable n be used?",
      "options": [
        "Anywhere in the file",
        "Anywhere in the rest of the function",
        "Only inside the if and its else branches",
        "Only in the condition n > 3, not in the braces"
      ],
      "answerIndex": 2,
      "explanation": "A variable declared in an init statement is scoped to the whole if / else statement and disappears after it."
    },
    {
      "question": "How do you write a 'while' loop in Go?",
      "options": [
        "for condition { ... }",
        "while condition { ... }",
        "loop condition { ... }",
        "do { ... } while condition"
      ],
      "answerIndex": 0,
      "explanation": "Go has no while keyword. The condition-only form of for does the same job."
    },
    {
      "question": "In a Go switch, a case matches. Does the next case's body also run?",
      "options": [
        "Yes, always, unless you write break",
        "Yes, if its condition is also true",
        "Yes, but only for the default case",
        "No, unless the matched case ends with fallthrough"
      ],
      "answerIndex": 3,
      "explanation": "Go leaves the switch after the matched case. Only an explicit fallthrough continues into the next body."
    },
    {
      "question": "What does this print?\n\nfor i := range 10 {\n\tif i%2 == 1 {\n\t\tcontinue\n\t}\n\tif i > 6 {\n\t\tbreak\n\t}\n\tfmt.Println(i)\n}",
      "options": [
        "0 1 2 3 4 5 6 (one per line)",
        "1 3 5",
        "0 2 4 6 (one per line)",
        "0 1 2 3 4 5 6 7 8 9 (one per line)"
      ],
      "answerIndex": 2,
      "explanation": "Odd numbers are skipped by continue. At i = 8 the check i > 6 runs break, so 8 is never printed. The output is 0, 2, 4, 6."
    }
  ]
});
