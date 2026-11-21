# 03. Control Flow & Functions
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 02-values-variables

## Learning goals
- Learner can compare values with `===`, `!==`, `<`, `>=` and combine conditions with `&&`, `||`, `!`.
- Learner can branch with `if / else if / else` and `switch`.
- Learner can repeat work with `for`, `for...of` and `while`.
- Learner can write functions with typed parameters and return types.
- Learner can write arrow functions and know when each style is used.

## Sub-topics
### Comparisons & logical operators
- Concept: comparison returns boolean. Always `===`/`!==` (strict: no type conversion); `==` converts types (`0 == ""` true) — avoid. `< > <= >=`. Logical: `&&` (both), `||` (either), `!` (not). Short-circuit: `a && b` stops if `a` falsy. Truthy/falsy: falsy = `false, 0, "", null, undefined, NaN`; everything else truthy.
- Analogy: nightclub bouncer checklist — `&&` = must be on list AND over 18; `||` = on list OR has VIP pass; `!` = NOT banned. Strict `===` = bouncer checks ID photo AND name; loose `==` = only glances at name.
- Code example: `compare.ts` — `const totalCents = 6000; const isMember = false; console.log(totalCents >= 5000 && !isMember);` → `true`; `console.log(0 == "");` → `true`; `console.log(0 === "");` → `false`; `console.log(Boolean(""), Boolean("0"));` → `false true`.
- Production use: permission checks (`isOwner || isAdmin`), validation.
- Common mistakes: `==` instead of `===`; `=` (assign) inside a condition instead of `===`; forgetting `"0"` is truthy.
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators#comparison_operators ; https://developer.mozilla.org/en-US/docs/Glossary/Falsy

### if / else & switch
- Concept: `if (cond) {...} else if (...) {...} else {...}` runs first matching block. `switch (value) { case "a": ...; break; default: ... }` for one value vs many fixed options; `break` stops fall-through; `return` inside a function also exits. Early-return ("guard clause") style.
- Analogy: train track switches — train (program) goes down exactly one track depending on the signal; `switch` = station departure board listing one platform per destination, `default` = "all other trains: platform 9".
- Code example: `shipping.ts` — `const totalCents = 3500; let shippingCents: number; if (totalCents >= 5000) { shippingCents = 0; } else if (totalCents >= 2000) { shippingCents = 299; } else { shippingCents = 599; } console.log(shippingCents);` → `299`. Then `const status: string = "shipped"; switch (status) { case "pending": console.log("Waiting for payment"); break; case "paid": case "shipped": console.log("On its way"); break; default: console.log("Unknown status"); }` → `On its way`.
- Production use: mapping order status to actions; HTTP method dispatch.
- Common mistakes: missing `break` in switch (falls into next case); deeply nested ifs instead of early returns.
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/if...else ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/switch

### Loops (for, for...of, while)
- Concept: loop = repeat block. Classic `for (let i = 0; i < n; i++)` when index needed; `for...of` over items of an array (preferred); `while (cond)` when count unknown; `break` exits, `continue` skips to next turn. Infinite loop risk. Gloss array `[...]` minimally (full in 04).
- Analogy: supermarket checkout — `for...of` = scan each item on the belt once; classic `for` = count items with a numbered ticket; `while` = keep serving while the queue isn't empty.
- Code example: `loops.ts` — `const pricesCents = [1200, 450, 3000]; let sum = 0; for (const p of pricesCents) { sum += p; } console.log(sum);` → `4650`; `for (let i = 0; i < 3; i++) { console.log(\`attempt ${i + 1}\`); }` → `attempt 1` / `attempt 2` / `attempt 3`; `let stock = 3; while (stock > 0) { stock -= 2; } console.log(stock);` → `-1`.
- Production use: summing order lines; retry loops.
- Common mistakes: off-by-one (`<=` vs `<`); `for...in` on arrays (gives index strings; avoid); while loop never ending.
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Loops_and_iteration

### Functions, parameters & return types
- Concept: function = named, reusable block; parameters = inputs (typed), arguments = actual values passed; `return` gives a value back; return type annotation `(): number`; `void` = returns nothing useful. Default parameter values `(qty: number = 1)`. Optional parameter `?`. Functions should do one thing. Scope: variables inside not visible outside.
- Analogy: vending machine — put in coins + button choice (arguments) into slots shaped for them (typed parameters), get one snack back (return value); you don't see inside.
- Code example: `functions.ts` — `function lineTotalCents(priceCents: number, quantity: number = 1): number { return priceCents * quantity; } console.log(lineTotalCents(2499, 2));` → `4998`; `console.log(lineTotalCents(800));` → `800`; `function logOrder(id: number): void { console.log(\`order ${id} saved\`); } logOrder(101);` → `order 101 saved`.
- Production use: every service/repository method (topic 18) is a typed function.
- Common mistakes: forgetting `return` (gets `undefined`); too many parameters (use an object, topic 04).
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions ; https://www.typescriptlang.org/docs/handbook/2/functions.html

### Arrow functions
- Concept: `const f = (a: number): number => a * 2;` short syntax; expression body returns implicitly; block body `{ return ... }` needs `return`. Used for callbacks (function passed to another function — gloss; used in 04 `map`, 08 handlers). Returning an object literal needs parentheses `() => ({ ok: true })`.
- Analogy: sticky-note instructions vs bound manual — arrow function = quick note you hand someone ("double this"), `function` declaration = named chapter in the manual.
- Code example: `arrows.ts` — `const toCents = (amount: number): number => Math.round(amount * 100); console.log(toCents(24.99));` → `2499`; `const makeError = (message: string) => ({ error: message }); console.log(makeError("Not found"));` → `{ error: "Not found" }` (Bun's console.log object format).
- Production use: route handlers `(req) => Response.json(...)`, array callbacks.
- Common mistakes: forgetting parens around returned object (returns `undefined`); forgetting `return` in block body.
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions

## Quiz
1. What does `0 == ""` vs `0 === ""` return, and which to use? — tests strict equality
2. Shipping for totalCents 5000 in shipping.ts? (`0`) — tests if/else chain
3. What happens in a switch without `break`? — tests fall-through
4. Output of `lineTotalCents(100, 3)`? (`300`) — tests functions/params
5. Why does `() => { ok: true }` return undefined? — tests arrow object return
