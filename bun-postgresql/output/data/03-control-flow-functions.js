window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "03-control-flow-functions",
  "order": 3,
  "title": "Control Flow & Functions",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Learn to compare values, make decisions with if and switch, repeat work with loops, and package logic into typed functions. These are the building blocks of every request handler (the function that answers one web address) and database helper you will write later in the course.",
  "prerequisites": ["02-values-variables"],
  "subtopics": [
    {
      "id": "comparisons-logical-operators",
      "title": "Comparisons & logical operators",
      "explanation": "An operator is a symbol that does something with values, such as `+` or `>=`. A comparison operator compares two values and produces a boolean (`true` or `false`). The ones you will use constantly are `<`, `>`, `<=` (less than or equal) and `>=` (greater than or equal).\n\nFor equality, always use `===` (equal) and `!==` (not equal). These are called strict because they never convert types: `0 === \"\"` is `false` because a number is not a string. The older `==` operator converts types first, so `0 == \"\"` is `true`. That surprise is why you should avoid `==` entirely.\n\nLogical operators combine booleans. `&&` means AND (both sides must be true), `||` means OR (at least one side must be true), and `!` means NOT (flips true to false and back).\n\nThese operators short-circuit, which means they stop as soon as the answer is known. In `a && b`, if `a` is falsy, JavaScript never looks at `b`. In `a || b`, if `a` is truthy, `b` is never evaluated. You already used `||` in the last topic to supply a fallback value; this is the same behaviour.\n\nThe values that count as falsy (treated like `false` in a condition) are include: `false`, `0`, `\"\"` (empty string), `null`, `undefined` and `NaN` (plus `-0` and `0n`, the BigInt zero). Almost every other value is truthy, including the string `\"0\"` and the string `\"false\"`. `Boolean(value)` is a built-in function that converts any value to `true` or `false`, which lets you see how JavaScript judges it.\n\nSetup: create a file named `compare.ts` in your project folder, then run it from a terminal opened in that folder with `bun run compare.ts`. Note that Bun runs TypeScript without checking types, but your editor may underline `0 == \"\"` and `0 === \"\"` because comparing a number with a string looks like a mistake. The lines are here only to demonstrate the difference.",
      "analogy": "Think of a nightclub bouncer with a checklist. `&&` is \"must be on the guest list AND be over 18\". `||` is \"on the guest list OR has a VIP pass\". `!` is \"must NOT be banned\". Strict `===` is a bouncer who checks the photo on the ID and the name; loose `==` is a bouncer who only glances at the name and lets people in after quietly rewriting their ID to match. A falsy value is a guest the bouncer turns away at once: false, 0, empty text, null, undefined and NaN. Every other value gets in, short-circuit style, as soon as the answer is known.",
      "code": [
        {
          "language": "typescript",
          "filename": "compare.ts",
          "source": "const totalCents = 6000;\nconst isMember = false;\n\n// Comparison + logical operators produce booleans\nconsole.log(totalCents >= 5000 && !isMember);\n\n// Loose vs strict equality\nconsole.log(0 == \"\");\nconsole.log(0 === \"\");\n\n// Truthy / falsy\nconsole.log(Boolean(\"\"), Boolean(\"0\"));\n\n// Short-circuit: \"\" is falsy, so || returns the right side\nconst couponCode: string = \"\";\nconsole.log(couponCode || \"no coupon\");",
          "output": "true\ntrue\nfalse\nfalse true\nno coupon",
          "explanation": "`totalCents >= 5000` is `true` and `!isMember` is `true` (not a member), so `&&` gives `true`. Loose `0 == \"\"` converts the empty string to the number 0 and says `true`; strict `0 === \"\"` says `false`. `Boolean(\"\")` is `false` because an empty string is falsy, but `Boolean(\"0\")` is `true` because any non-empty string is truthy. Finally `\"\" || \"no coupon\"` skips the falsy left side and returns the right side."
        }
      ],
      "productionNote": "Permission checks are built from these operators, for example `isOwner || isAdmin` to allow an action, and validation rules combine comparisons such as `quantity >= 1 && quantity <= 100`. Linters (tools that scan code for likely mistakes) are commonly configured to forbid `==`, so using `===` from day one keeps your code consistent.",
      "commonMistakes": [
        "Using `==` instead of `===`. Loose equality converts types and gives results like `0 == \"\"` being `true`.",
        "Writing `=` (assignment, which stores a value) inside a condition when you meant `===` (comparison).",
        "Forgetting that the string `\"0\"` is truthy. Only the empty string `\"\"` is a falsy string."
      ],
      "sources": [
        { "title": "MDN: Expressions and operators (comparison operators)", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators#comparison_operators" },
        { "title": "MDN: Falsy", "url": "https://developer.mozilla.org/en-US/docs/Glossary/Falsy" }
      ]
    },
    {
      "id": "if-else-switch",
      "title": "if / else & switch",
      "explanation": "A statement that chooses which code to run is called a branch. `if (condition) { ... }` runs the block in braces only when the condition is truthy. You can chain `else if (...) { ... }` for more cases and finish with `else { ... }` as the catch-all. JavaScript checks the conditions from top to bottom and runs only the first block that matches.\n\nWhen you compare one value against many fixed options, `switch` reads more clearly. `switch (value)` jumps to the `case` whose label equals the value (using strict equality). `break` ends the case and leaves the switch. `default` runs when no case matched.\n\nIf you leave out `break`, execution falls through, meaning it keeps running the next case's code too. This is sometimes useful on purpose: stacking `case \"paid\":` directly above `case \"shipped\":` with no code between them lets two values share one block, as the example shows. Inside a function (next sub-topics), `return` also exits a switch.\n\nA guard clause is an early exit placed at the top of a function: check for the bad or simple case first, leave immediately, and keep the main logic un-nested. It avoids deep `if` inside `if` structures. We will write one as soon as we meet functions.\n\nSetup: create `shipping.ts` and run it with `bun run shipping.ts`.",
      "analogy": "A railway track switch sends a train down exactly one track depending on the signal; an `if / else if / else` chain is that switch, and the train (your program) takes the first track whose signal matches. A `switch` is the station departure board: one row per destination, each pointing to one platform, and `default` is the last row, \"all other trains: platform 9\".",
      "code": [
        {
          "language": "typescript",
          "filename": "shipping.ts",
          "source": "const totalCents = 3500;\nlet shippingCents: number;\n\nif (totalCents >= 5000) {\n  shippingCents = 0; // free shipping\n} else if (totalCents >= 2000) {\n  shippingCents = 299;\n} else {\n  shippingCents = 599;\n}\nconsole.log(shippingCents);\n\nconst status: string = \"shipped\";\n\nswitch (status) {\n  case \"pending\":\n    console.log(\"Waiting for payment\");\n    break;\n  case \"paid\":\n  case \"shipped\":\n    console.log(\"On its way\");\n    break;\n  default:\n    console.log(\"Unknown status\");\n}",
          "output": "299\nOn its way",
          "explanation": "3500 is not `>= 5000`, so the first block is skipped; it is `>= 2000`, so `shippingCents` becomes 299 and the rest of the chain is ignored. In the `switch`, `\"shipped\"` matches the second label, which shares its code with `\"paid\"`, so it prints `On its way` and `break` leaves the switch."
        }
      ],
      "productionNote": "You will map order status to actions with `switch` (for example, only `pending` orders may be cancelled), and later dispatch on the HTTP method of a request. Prefer guard clauses over nesting: rejecting invalid input at the top of a function keeps the successful path easy to read.",
      "commonMistakes": [
        "Forgetting `break` in a `switch`, so execution falls through into the next case and runs code you did not intend.",
        "Nesting many `if` statements inside each other instead of exiting early with a guard clause.",
        "Putting broader conditions first in an `else if` chain. Because the first match wins, `totalCents >= 2000` listed before `>= 5000` would catch every large order."
      ],
      "sources": [
        { "title": "MDN: if...else", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/if...else" },
        { "title": "MDN: switch", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/switch" }
      ]
    },
    {
      "id": "loops",
      "title": "Loops (for, for...of, while)",
      "explanation": "A loop repeats a block of code. Each repetition is called an iteration. There are three forms you will use.\n\n`for...of` visits every item of an array, one at a time. An array is an ordered list of values written in square brackets, like `[1200, 450, 3000]`; the next topic covers arrays fully. In `for (const p of pricesCents)`, the variable `p` holds the current item on each turn.\n\nThe classic `for (let i = 0; i < 3; i++)` loop has three parts separated by semicolons: a starting statement (`let i = 0`), a condition checked before every turn (`i < 3`), and an update run after every turn (`i++`, which adds 1 to `i`). Use it when you need the counter itself, for example to number attempts.\n\n`while (condition)` repeats as long as the condition stays truthy. Use it when you do not know in advance how many turns it will take. Make sure something inside the loop eventually makes the condition false, otherwise you create an infinite loop that never ends (press Ctrl+C in the terminal to stop it).\n\nTwo keywords steer a loop. `break` exits the whole loop immediately. `continue` skips the rest of the current turn and jumps to the next one.\n\nSetup: create `loops.ts` and run it with `bun run loops.ts`.",
      "analogy": "A supermarket checkout. `for...of` is the cashier scanning each item on the belt exactly once. The classic `for` is handing out numbered tickets: you count 1, 2, 3 and stop at a set number. `while` is the cashier who keeps serving as long as the queue is not empty, without knowing how long it will take. `continue` is setting aside one item and moving on; `break` is closing the till.",
      "code": [
        {
          "language": "typescript",
          "filename": "loops.ts",
          "source": "const pricesCents = [1200, 450, 3000];\nlet sum = 0;\nfor (const p of pricesCents) {\n  sum += p;\n}\nconsole.log(sum);\n\nfor (let i = 0; i < 3; i++) {\n  console.log(`attempt ${i + 1}`);\n}\n\nlet stock = 3;\nwhile (stock > 0) {\n  stock -= 2;\n}\nconsole.log(stock);\n\nfor (let n = 1; n <= 5; n++) {\n  if (n === 2) continue; // skip 2\n  if (n === 4) break; // stop before printing 4\n  console.log(n);\n}",
          "output": "4650\nattempt 1\nattempt 2\nattempt 3\n-1\n1\n3",
          "explanation": "The `for...of` loop adds 1200 + 450 + 3000 to get 4650. The classic loop runs with `i` = 0, 1, 2 and prints `i + 1`, so attempts 1 to 3. The `while` loop turns `stock` from 3 to 1 (still greater than 0, so it repeats), then to -1, then stops and prints -1. In the last loop, `n` = 1 prints 1; `n` = 2 hits `continue`; `n` = 3 prints 3; `n` = 4 hits `break` and the loop ends."
        }
      ],
      "productionNote": "Loops sum order lines to compute a total and implement retry logic (try an operation up to N times). Prefer `for...of` whenever you do not need the index. In later topics you will often replace loops with array methods like `map` and `filter`.",
      "commonMistakes": [
        "Off-by-one errors: using `<=` instead of `<` (or the reverse) runs the loop one time too many or too few.",
        "Using `for...in` on an array. It gives the position numbers (0, 1, 2 ...) as text strings (\"0\", \"1\", ...) rather than the items; use `for...of`.",
        "Writing a `while` loop whose condition never becomes false, creating an infinite loop."
      ],
      "sources": [
        { "title": "MDN: for...of", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of" },
        { "title": "MDN: Loops and iteration", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Loops_and_iteration" }
      ]
    },
    {
      "id": "functions-parameters-return-types",
      "title": "Functions, parameters & return types",
      "explanation": "A function is a named, reusable block of code. You define it once with the `function` keyword and run it (call it) as often as you like by writing its name followed by parentheses.\n\nParameters are the named inputs listed in the definition, each with a type annotation: `priceCents: number`. Arguments are the actual values you pass when calling. In `lineTotalCents(2499, 2)`, 2499 and 2 are arguments. The return type is written after the parentheses: `): number`. The `return` keyword sends a value back to the caller and ends the function.\n\nA function that does work but gives back nothing useful has the return type `void`. If you forget `return` in a function that should produce a value, the caller receives `undefined`; TypeScript flags this when a return type is declared.\n\nA default value makes an argument optional: `quantity: number = 1` is used when the caller passes nothing. A parameter followed by `?` (such as `title?: string`) may also be omitted, but then its value is `undefined` inside the function and you must handle that case.\n\nScope means where a variable can be seen. A variable declared inside a function exists only inside it; code outside cannot read it. Keep each function focused on one job, so it is easy to name, test and reuse.\n\nSetup: create `functions.ts` and run it with `bun run functions.ts`.",
      "analogy": "A vending machine. You put in coins and press a button (the arguments) through slots shaped to accept only the right things (typed parameters). One snack comes out (the return value). A default parameter is the machine pre-selecting a standard size if you press nothing. You never see the machinery inside, which is scope: its internals are hidden from you.",
      "code": [
        {
          "language": "typescript",
          "filename": "functions.ts",
          "source": "function lineTotalCents(priceCents: number, quantity: number = 1): number {\n  return priceCents * quantity;\n}\n\nconsole.log(lineTotalCents(2499, 2));\nconsole.log(lineTotalCents(800));\n\nfunction logOrder(id: number): void {\n  console.log(`order ${id} saved`);\n}\nlogOrder(101);\n\nfunction greet(name: string, title?: string): string {\n  if (!title) return name; // guard clause: no title, leave early\n  return `${title} ${name}`;\n}\nconsole.log(greet(\"Ada\"));\nconsole.log(greet(\"Ada\", \"Dr.\"));",
          "output": "4998\n800\norder 101 saved\nAda\nDr. Ada",
          "explanation": "`lineTotalCents(2499, 2)` returns 2499 * 2 = 4998. With one argument, `quantity` takes its default of 1, so the result is 800. `logOrder` returns nothing; it only prints. In `greet`, the first call has no `title`, so the guard clause returns `Ada` at once; the second call builds `Dr. Ada`."
        }
      ],
      "productionNote": "Almost every piece of backend code you write later, such as a service or repository method, is a typed function: clear inputs, a declared return type, one job. When a function needs many parameters, group them into a single object (covered in the next topic) instead of a long positional list.",
      "commonMistakes": [
        "Forgetting `return`, so the caller gets `undefined` instead of the computed value.",
        "Giving a function too many parameters. Past three or four, callers mix up the order; use one object instead.",
        "Trying to use a variable declared inside a function from outside it. It is out of scope and does not exist there."
      ],
      "sources": [
        { "title": "MDN: Functions", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions" },
        { "title": "TypeScript Handbook: More on Functions", "url": "https://www.typescriptlang.org/docs/handbook/2/functions.html" }
      ]
    },
    {
      "id": "arrow-functions",
      "title": "Arrow functions",
      "explanation": "An arrow function is a shorter way to write a function, using `=>`. You usually store it in a `const`: `const double = (a: number): number => a * 2;`.\n\nIf the body is a single expression (a piece of code that produces a value) written without braces, its result is returned automatically. This is called an implicit return. If you use a block body with braces `{ ... }`, you must write `return` yourself, exactly like a normal function.\n\nTo return an object literal (an object written with `{ ... }`) from an expression body, wrap it in parentheses: `() => ({ ok: true })`. Without them, JavaScript reads the braces as a block body, not an object.\n\nA callback is a function you pass as an argument to another function, which then calls it. Arrow functions shine here because they are short. The parameter type `(n: number) => number` describes such a function: it takes a number and returns a number.\n\nUse a `function` declaration for named, top-level building blocks, and arrow functions for small callbacks and inline handlers. Both are fine; consistency within a project matters most.\n\n`Math.round` is a built-in function that rounds a number to the nearest whole number. Setup: create `arrows.ts` and run it with `bun run arrows.ts`.",
      "analogy": "A `function` declaration is a named chapter in an instruction manual: it has a title and you can look it up and reuse it. An arrow function is a sticky note you hand to someone for a quick job (\"double this number\"). Passing a callback is giving a helper a sticky note and saying \"do this to each item\".",
      "code": [
        {
          "language": "typescript",
          "filename": "arrows.ts",
          "source": "const toCents = (amount: number): number => Math.round(amount * 100);\nconsole.log(toCents(24.99));\n\n// Parentheses around the braces: return an object\nconst makeError = (message: string) => ({ error: message });\nconsole.log(makeError(\"Not found\"));\n\n// Callback: a function passed into another function\nfunction applyTwice(value: number, fn: (n: number) => number): number {\n  return fn(fn(value));\n}\nconsole.log(applyTwice(3, (n) => n * 2));\nconsole.log(applyTwice(3, (n) => n + 10));",
          "output": "2499\n{ error: \"Not found\" }\n12\n23",
          "explanation": "`toCents(24.99)` multiplies by 100 and rounds to the whole number 2499, which is how you convert dollars to integer cents safely. `makeError` has an implicit return of an object, shown by Bun's `console.log` as `{ error: \"Not found\" }`. `applyTwice(3, ...)` calls the callback on 3, then on the result: doubling twice gives 12; adding 10 twice gives 23."
        }
      ],
      "productionNote": "Arrow functions appear everywhere in server code: route handlers such as `(req) => Response.json(...)` and callbacks for array methods like `map` and `filter`. Prefer an expression body for one-liners and a block body as soon as you need several statements.",
      "commonMistakes": [
        "Writing `() => { ok: true }` to return an object. The braces become a block body, `ok:` is read as a label, and the function returns `undefined`. Use `() => ({ ok: true })`.",
        "Using a block body `{ ... }` and forgetting to write `return`, so the function returns `undefined`."
      ],
      "sources": [
        { "title": "MDN: Arrow function expressions", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "What do `0 == \"\"` and `0 === \"\"` return, and which operator should you use?",
      "options": [
        "Both return `true`; use `==` because it is more flexible",
        "`true` and `false`; use `===` because it never converts types",
        "`false` and `true`; use `==` because it is the stricter choice",
        "Both return `false`; the choice makes no difference"
      ],
      "answerIndex": 1,
      "explanation": "Loose `==` converts the empty string to 0 and returns `true`. Strict `===` compares without conversion, so a number and a string are never equal. Use `===` to avoid surprises."
    },
    {
      "question": "In shipping.ts, what is `shippingCents` when `totalCents` is 5000?",
      "options": [
        "299",
        "599",
        "5000",
        "0"
      ],
      "answerIndex": 3,
      "explanation": "5000 satisfies the first condition `totalCents >= 5000`, so shipping is 0 (free) and the other branches are skipped."
    },
    {
      "question": "What happens in a `switch` when a matching `case` has no `break`?",
      "options": [
        "Execution falls through and also runs the code of the next case",
        "JavaScript throws an error when the file starts",
        "The `switch` skips that case and jumps to `default`",
        "Only that case runs, exactly as if `break` were there"
      ],
      "answerIndex": 0,
      "explanation": "Without `break`, execution continues into the following case's code (fall-through) until a `break`, a `return` or the end of the switch."
    },
    {
      "question": "Using the `lineTotalCents` function from this topic, what does `lineTotalCents(100, 3)` return?",
      "options": [
        "103",
        "100",
        "300",
        "`undefined`"
      ],
      "answerIndex": 2,
      "explanation": "The function returns `priceCents * quantity`, which is 100 * 3 = 300."
    },
    {
      "question": "Why does `const f = () => { ok: true };` return `undefined` when called?",
      "options": [
        "Arrow functions can never return objects",
        "The `true` value is falsy so nothing is returned",
        "The braces are read as a block body with no `return`, so wrap the object in parentheses",
        "`ok` is a reserved word that cannot be used as a property name"
      ],
      "answerIndex": 2,
      "explanation": "After `=>`, braces start a block body, not an object. `ok:` is just a label and there is no `return`, so the result is `undefined`. Writing `() => ({ ok: true })` returns the object."
    }
  ]
});
