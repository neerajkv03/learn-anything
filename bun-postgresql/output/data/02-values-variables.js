window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "02-values-variables",
  "order": 2,
  "title": "TypeScript Values & Variables",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Learn how to give names to values with const and let, work with text, numbers and true/false values, and add TypeScript type annotations. You will also build text with template literals, tell null from undefined, and print values with console.log.",
  "prerequisites": ["01-how-backends-work"],
  "subtopics": [
    {
      "id": "const-vs-let",
      "title": "const vs let",
      "explanation": "A variable is a name attached to a value. Instead of writing the number 4998 everywhere, you give it a name such as totalCents and use the name. Creating a variable is called declaring it, and putting a value into it with the single equals sign `=` is called assignment.\n\nTypeScript has two keywords (reserved words with a fixed meaning) for declaring a variable. `const` means the name can never be pointed at a different value after the first assignment. `let` means the name can be reassigned later. There is also an older keyword, `var`. It is a legacy keyword with confusing rules, so avoid it.\n\nMake `const` your default. Switch to `let` only when the value really must change, such as a counter that goes up. If you try to reassign a `const`, your editor shows an error straight away. If you run the code anyway, Bun stops with an error (the exact wording depends on the engine).\n\nThe shortcut `+=` means \"add to the variable itself\": `ordersToday += 1` is the same as `ordersToday = ordersToday + 1`.\n\nTo try the code, make a folder for the course, open a terminal in that folder, create a file called `variables.ts` in your editor, paste the code in, save it, and run it with `bun run variables.ts`.\n\nOne warning for later: `const` stops the name from being moved to another value, but it does not freeze the inside of bigger values such as objects. Topic 04 covers that.",
      "analogy": "Think of jars on a shelf with labels. A `const` label is glued onto its jar, so that name always means that same jar. A `let` label is a sticky note: you can peel it off and stick it on a different jar whenever you need to.",
      "code": [
        {
          "language": "typescript",
          "filename": "variables.ts",
          "source": "const shopName = \"Corner Shop\";\nlet ordersToday = 0;\n\nordersToday = ordersToday + 1;\nordersToday += 1;\n\n// shopName = \"Other Shop\"; // error: cannot assign to a const\n\nconsole.log(shopName, ordersToday);",
          "output": "Corner Shop 2",
          "explanation": "shopName never changes, so it is a const. ordersToday starts at 0 and is increased twice (once with the long form, once with +=), so it ends at 2. The commented-out line would fail if you removed the leading //. console.log prints both values separated by a space."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "bun run variables.ts",
          "output": "Corner Shop 2",
          "explanation": "Run this in the terminal, in the folder that contains variables.ts."
        }
      ],
      "productionNote": "In real service code nearly every binding is a `const`. `let` appears for counters and for accumulators (a variable that collects a running total inside a loop).",
      "commonMistakes": [
        "Using `let` for everything. Reaching for `const` first tells readers (and the editor) that the name never moves.",
        "Trying to reassign a `const`. Your editor flags it, and Bun stops with an error if you run it.",
        "Using the old `var` keyword because an older tutorial did."
      ],
      "sources": [
        { "title": "MDN: const", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const" },
        { "title": "MDN: let", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let" }
      ]
    },
    {
      "id": "strings-numbers-booleans",
      "title": "Strings, numbers & booleans",
      "explanation": "Values come in kinds, called types. The three simplest kinds are called primitives (basic values that are not made of other values).\n\nA string is text inside quotes, either \"double\" or 'single'. This course uses double quotes. A string has a `.length` (how many characters), and methods (functions attached to a value, called with a dot) such as `.trim()` (remove spaces at both ends), `.toLowerCase()`, `.toUpperCase()` and `.includes(\"x\")` (does it contain this text? gives true or false).\n\nA number is one type for both whole numbers and decimals. The arithmetic operators (symbols that calculate) are `+`, `-`, `*`, `/` and `%` (remainder after division, so `10 % 3` is `1`).\n\nComputers store decimals in binary (the 0s and 1s that all computer data is built from), so some decimals are slightly off: `0.1 + 0.2` gives `0.30000000000000004`. This is why money is stored as whole cents (`2499`, not `24.99`). Whole-number maths is exact.\n\n`Number(\"42\")` turns text into the number 42. `Number(\"abc\")` cannot, so it gives `NaN`, a special number value meaning \"Not a Number\". `Number.isInteger(x)` checks for a whole number, and `Number.isNaN(x)` checks for NaN. Never test for NaN with `===`, because NaN is not equal to anything, not even itself.\n\nA boolean is either `true` or `false`. The `typeof` operator gives the name of a value's type as text, such as `\"boolean\"`.\n\nBe careful with `+`: between two numbers it adds, but if either side is a string it glues the pieces together. So `\"2\" + 3` is the text `\"23\"`, not 5.",
      "analogy": "A kitchen has different containers. Strings are labelled spice jars (text you read). Numbers are measuring cups (amounts you calculate with). Booleans are a light switch, on or off. If you pour text into a measuring cup, as in `\"2\" + 3`, you do not get a sum, you get the two things glued together as text.",
      "code": [
        {
          "language": "typescript",
          "filename": "primitives.ts",
          "source": "const email = \"  Asha@Example.com \";\nconsole.log(email.trim().toLowerCase());\nconsole.log(email.trim().length);\nconsole.log(email.includes(\"@\"));\n\nconsole.log(0.1 + 0.2);\nconsole.log(1999 + 500);\nconsole.log(10 % 3);\nconsole.log(\"2\" + 3);\n\nconsole.log(typeof true);\nconsole.log(Number(\"42\"));\nconsole.log(Number(\"abc\"));\nconsole.log(Number.isNaN(Number(\"abc\")));\nconsole.log(Number.isInteger(2499));",
          "output": "asha@example.com\n16\ntrue\n0.30000000000000004\n2499\n1\n23\nboolean\n42\nNaN\ntrue\ntrue",
          "explanation": "The first line trims the spaces and lowercases the email, the way a service normalizes emails before saving. After trimming, the text Asha@Example.com has 16 characters. 0.1 + 0.2 shows the decimal problem, while 1999 + 500 (cents) is exact. \"2\" + 3 glues text to give 23. Number(\"abc\") gives NaN, and Number.isNaN is the correct way to detect it."
        }
      ],
      "productionNote": "Services normalize emails (trim and lowercase) before saving them, so that the same address is not stored twice in different forms. Money is always counted in whole cents.",
      "commonMistakes": [
        "Storing money as decimals such as 24.99 and getting tiny rounding errors. Use integer cents.",
        "Forgetting that `+` glues text when one side is a string, so `\"5\" + 5` is `\"55\"`.",
        "Checking for NaN with `=== NaN`. This is never true. Use `Number.isNaN(value)`."
      ],
      "sources": [
        { "title": "MDN: Grammar and types, data structures and types", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types#data_structures_and_types" },
        { "title": "TypeScript Handbook: Everyday Types", "url": "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#the-primitives-string-number-and-boolean" }
      ]
    },
    {
      "id": "type-annotations-inference",
      "title": "Type annotations & inference",
      "explanation": "TypeScript is JavaScript plus a type checker. A type annotation is a colon and a type name written after a variable name, such as `let quantity: number = 2`. It says what kind of value may be stored there.\n\nThe checker runs in your editor, and also when you run the TypeScript compiler `tsc` (the official type-checking program). Bun does not check types. It just strips the annotations away and runs the JavaScript underneath. So a type error is a warning from the checker, not a crash at run time.\n\nInference means TypeScript works out the type from the value, so you often do not need to write it. `const n = 5` is inferred as `number`. A `const` holding a string, like `const status = \"pending\"`, gets an even narrower literal type: exactly the text `\"pending\"` and nothing else.\n\nA good habit: let inference do the work, and write annotations in two places. The first is when you declare a variable without a value (`let note: string;`), because there is nothing to infer from. The second is on the inputs of functions (called parameters), which the next topic introduces.\n\nThe type `any` switches checking off for that value, so avoid it. There is also `unknown`, a safe way of saying \"I do not know the type yet\". Topic 19 uses it properly.\n\nThe checks described here assume strict mode, a TypeScript setting that turns on the strictest checks. Topic 06 shows where it is set.",
      "analogy": "Luggage tags at an airport. A tag such as \"fragile\" or \"liquids\" lets the security checker (TypeScript) stop the wrong item before the flight. Bun is the plane: once in the air it does not re-read the tags, it just flies whatever was loaded.",
      "code": [
        {
          "language": "typescript",
          "filename": "annotations.ts",
          "source": "let quantity: number = 2;\nconst status = \"pending\";\nlet note: string;\nnote = \"leave at door\";\n\n// quantity = \"two\"; // editor error: Type 'string' is not assignable to type 'number'.\n\nconsole.log(quantity, status, note);",
          "output": "2 pending leave at door",
          "explanation": "quantity has an explicit annotation. status needs none: TypeScript infers the literal type \"pending\". note has no value yet, so it needs an annotation. If you remove the // before quantity = \"two\", your editor and tsc report the error in the comment, but Bun would still run the line, because Bun does not check types."
        }
      ],
      "productionNote": "Annotated types are the contract between the layers of a service (topic 18): they describe exactly what shape of data each part promises to give or accept.",
      "commonMistakes": [
        "Annotating every variable even when the type is obvious from the value.",
        "Using `any` to silence an error instead of fixing the cause. That switches off checking.",
        "Believing types are checked while the program runs. They are not: the data from a request or database is not verified by an annotation."
      ],
      "sources": [
        { "title": "TypeScript Handbook: Type annotations on variables", "url": "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-annotations-on-variables" },
        { "title": "TypeScript Handbook: Type Inference", "url": "https://www.typescriptlang.org/docs/handbook/type-inference.html" }
      ]
    },
    {
      "id": "template-literals",
      "title": "Template literals",
      "explanation": "A template literal is a string written with backticks (the ` character, usually next to the 1 key) instead of quotes. Inside it, `${...}` is a placeholder: whatever expression (a piece of code that produces a value) you put between the braces is calculated and inserted into the text.\n\nTemplate literals can also span several lines, and the line breaks are kept. They are easier to read than gluing pieces with `+`, so prefer them for any text with values inside.\n\nOnly backticks do this. A normal \"double-quoted\" string treats `${name}` as ordinary characters and prints it exactly as written.\n\nLater, Bun.sql (topic 13) also uses backticks for database queries, in a special form called a tagged template. The backticks look the same, but the job is different. One safety rule to remember now: never build database queries by pasting values into a template literal yourself. Topic 13 explains why (SQL injection) and the safe way.",
      "analogy": "A fill-in-the-blanks form letter: \"Dear ___, your order ___ ships today.\" The text stays the same and each `${}` is a blank that gets filled in for every customer.",
      "code": [
        {
          "language": "typescript",
          "filename": "templates.ts",
          "source": "const name = \"Asha\";\nconst orderId = 101;\nconst totalCents = 4998;\n\nconsole.log(`Hi ${name}, order #${orderId} total: ${totalCents / 100}`);\n\nconst receipt = `Receipt\nItem: Tea\nQty: 2`;\nconsole.log(receipt);\n\nconsole.log(\"Hi ${name}\");",
          "output": "Hi Asha, order #101 total: 49.98\nReceipt\nItem: Tea\nQty: 2\nHi ${name}",
          "explanation": "The first line fills three blanks, and the last blank even calculates 4998 / 100. The second string spans three lines and prints on three lines. The final line uses normal double quotes, so ${name} is not replaced and prints literally."
        }
      ],
      "productionNote": "Template literals are the standard way to write log messages and error messages that include values.",
      "commonMistakes": [
        "Using \"...\" or '...' quotes and expecting `${}` to work. It prints the characters literally.",
        "Building SQL text (SQL is the language for asking a database questions) by pasting values into a template literal. This allows SQL injection (an attacker's text becoming part of your query). Topic 13 shows the safe way."
      ],
      "sources": [
        { "title": "MDN: Template literals", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals" }
      ]
    },
    {
      "id": "null-and-undefined",
      "title": "null & undefined",
      "explanation": "JavaScript has two values that mean \"nothing here\", with different meanings.\n\n`undefined` means \"no value was given\". JavaScript produces it for you: a variable declared without a value, a property that does not exist, or a function that returns nothing.\n\n`null` means \"intentionally empty\". You write it yourself on purpose. When a PostgreSQL database column (a named field in a table) holds NULL (an empty cell), Bun gives it to your code as `null` (topic 13).\n\nWith strict mode on, a `string` variable cannot hold null. If null is allowed, say so in the type with `string | null`. The `|` means \"or\", so this reads \"a string or null\". Topic 04 covers this in full.\n\nThe operator `??` (nullish coalescing) gives a fallback value, but only when the left side is `null` or `undefined`. The older `||` operator replaces any falsy value (one that counts as false), including `0` and the empty string `\"\"`. So `discount || 10` throws away a real discount of 0, while `discount ?? 10` keeps it. Use `??` for defaults.",
      "analogy": "Parking spots. `undefined` is a spot that was never painted, so you have no information about it. `null` is a spot painted with a \"reserved: empty\" sign: someone deliberately says there is nothing there. `??` is \"if the spot is empty, park here instead\".",
      "code": [
        {
          "language": "typescript",
          "filename": "nullish.ts",
          "source": "const couponCode: string | null = null;\nconst discount = 0;\nlet deliveredAt;\n\nconsole.log(couponCode ?? \"NONE\");\nconsole.log(discount || 10);\nconsole.log(discount ?? 10);\nconsole.log(deliveredAt);",
          "output": "NONE\n10\n0\nundefined",
          "explanation": "couponCode is null, so ?? uses the fallback NONE. discount is 0: || treats 0 as falsy and wrongly replaces it with 10, while ?? keeps the real 0. deliveredAt was declared without a value, so JavaScript gives it undefined."
        }
      ],
      "productionNote": "Optional database columns come back as `null`. Use `??` to apply config defaults without losing valid values like 0 or an empty string.",
      "commonMistakes": [
        "Using `||` for defaults and accidentally replacing valid values such as `0` or `\"\"`.",
        "Mixing the meanings of null and undefined in the same code base. Pick one meaning for each and keep it."
      ],
      "sources": [
        { "title": "MDN: Nullish coalescing operator (??)", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing" },
        { "title": "TypeScript Handbook: null and undefined", "url": "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#null-and-undefined" }
      ]
    },
    {
      "id": "printing-with-console-log",
      "title": "Printing with console.log",
      "explanation": "`console.log(a, b, c)` prints all its values on one line, separated by single spaces. Strings are printed without quotes. You can pass any number of values, which makes it easy to print a label followed by a value.\n\n`console.error(...)` prints in the same way but sends the text to stderr (the standard error stream, a separate output channel for problems). The normal channel is called stdout. In your terminal both appear on screen, but tools and servers can collect them separately, so errors do not get mixed into normal output.\n\nWhen you print an object (a bundle of named values, topic 04), Bun shows it in a readable form.\n\nConsole printing is fine while you build and debug. In production, services write structured logs (one JSON object per line), which topic 21 covers.",
      "analogy": "Calling updates across a busy kitchen. `console.log` is the normal call-out (\"order 101 is paid\"). `console.error` is the alarm bell, which rings on its own separate line so nobody mistakes it for routine chatter.",
      "code": [
        {
          "language": "typescript",
          "filename": "printing.ts",
          "source": "console.log(\"Order\", 101, \"paid:\", true);\nconsole.error(\"Payment failed for order\", 102);",
          "output": "Order 101 paid: true\nPayment failed for order 102",
          "explanation": "The first line prints four values separated by spaces, to stdout. The second prints to stderr. In a terminal you see both lines, but the second one travels on the error channel."
        }
      ],
      "productionNote": "Plain console printing is for development. Production services switch to a JSON logger (topic 21), and they must never print secrets such as passwords or tokens.",
      "commonMistakes": [
        "Leaving noisy debug printing in code that ships to production.",
        "Logging secrets such as passwords or access tokens, which then sit in log files for anyone to read."
      ],
      "sources": [
        { "title": "MDN: console.log()", "url": "https://developer.mozilla.org/en-US/docs/Web/API/console/log_static" },
        { "title": "Bun docs: console", "url": "https://bun.com/docs/api/console" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Which keyword should you use for a variable whose value never changes?",
      "options": ["let", "const", "var", "assign"],
      "answerIndex": 1,
      "explanation": "`const` stops the name from being reassigned and is the default choice. `let` is for values that must change, `var` is an old keyword to avoid, and `assign` is not a keyword."
    },
    {
      "question": "What does `console.log(\"5\" + 5)` print?",
      "options": ["10", "NaN", "55", "An error"],
      "answerIndex": 2,
      "explanation": "When one side of `+` is a string, `+` glues the pieces together as text, so you get the string 55, not the sum 10."
    },
    {
      "question": "Why should a price of 24.99 be stored as 2499 cents?",
      "options": [
        "Whole-number maths is exact, while decimals can have tiny binary rounding errors such as 0.1 + 0.2 giving 0.30000000000000004",
        "Because TypeScript does not allow decimal numbers",
        "Because integers use less text when printed",
        "Because strings cannot hold a decimal point"
      ],
      "answerIndex": 0,
      "explanation": "Decimals are stored in binary and can be slightly off. Integer cents avoid that. TypeScript does allow decimals, so the other reasons are wrong."
    },
    {
      "question": "What does this print?\n\nconst qty = 0;\nconsole.log(qty ?? 1, qty || 1);",
      "options": ["1 1", "0 0", "1 0", "0 1"],
      "answerIndex": 3,
      "explanation": "`??` only replaces null or undefined, so it keeps 0. `||` replaces any falsy value, and 0 is falsy, so it gives 1. The output is 0 1."
    },
    {
      "question": "Does `let x: number = \"hi\"` stop Bun from running the file?",
      "options": [
        "Yes, Bun type-checks and refuses to start",
        "No, the editor and tsc report the error, but Bun strips types and still runs the code",
        "Yes, but only when the file is saved",
        "No, because TypeScript allows text in a number variable"
      ],
      "answerIndex": 1,
      "explanation": "Type annotations are checked by the editor and by `tsc`, not by Bun. Bun removes them and runs the JavaScript. The assignment is still a real error that the checker reports, so fix it anyway."
    }
  ]
});
