# 02. TypeScript Values & Variables
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 01-how-backends-work

## Learning goals
- Learner can name values with `const` and `let` and pick the right one.
- Learner can use string, number and boolean values and predict operator results.
- Learner can add type annotations and read inferred types.
- Learner can build text with template literals.
- Learner can tell `null` from `undefined`.
- Learner can print values and labels with `console.log`.

## Sub-topics
### const vs let
- Concept: variable = name bound to a value. `const` = cannot be reassigned (default choice); `let` = can be reassigned. Never `var` (legacy; mention once as "older keyword, avoid"). Assignment `=`. Reassigning `const` → TypeError at run time ("Assignment to constant variable") and editor error. `const` does not freeze object contents (forward pointer to 04).
- Analogy: labels on jars — `const` = label glued on (jar always the same), `let` = sticky note you can move to another jar.
- Code example: `variables.ts` — `const shopName = "Corner Shop"; let ordersToday = 0; ordersToday = ordersToday + 1; ordersToday += 1; console.log(shopName, ordersToday);` → `Corner Shop 2`.
- Production use: nearly all bindings in service code are `const`; `let` for counters/accumulators.
- Common mistakes: using `let` everywhere; trying to reassign a `const`.
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let

### Strings, numbers & booleans
- Concept: primitive types. string = text in quotes (`"..."` or `'...'`; course uses double); `.length`, `.toUpperCase()`, `.trim()`, `.includes()`. number = one type for integers & decimals; operators `+ - * / %`; `0.1 + 0.2` → `0.30000000000000004` (why money = integer cents). `Number("42")` → 42, `Number("abc")` → NaN (gloss: "Not a Number" value). `Number.isInteger`. boolean = `true`/`false`. `+` with a string concatenates: `"2" + 3` → `"23"`. `typeof` returns type name.
- Analogy: different containers in a kitchen — strings = labelled spice jars (text), numbers = measuring cups (amounts you calculate with), booleans = light switch (on/off). Pouring text into a measuring cup (`"2" + 3`) gives glued text, not a sum.
- Code example: `primitives.ts` — `const email = "  Asha@Example.com "; console.log(email.trim().toLowerCase());` → `asha@example.com`; `console.log(0.1 + 0.2);` → `0.30000000000000004`; `console.log(1999 + 500);` → `2499`; `console.log("2" + 3);` → `23`; `console.log(typeof true);` → `boolean`; `console.log(Number("abc"));` → `NaN`.
- Production use: normalizing emails before saving; counting money in cents.
- Common mistakes: decimal money (floats); forgetting `+` concatenates strings; `NaN` checks with `===` (use `Number.isNaN`).
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types#data_structures_and_types ; https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#the-primitives-string-number-and-boolean

### Type annotations & inference
- Concept: annotation `: type` after a name says what may go there; TypeScript checks in editor/`tsc`, Bun just strips it. Inference = TS guesses type from value (`const n = 5` → `number`; `const` string literal infers literal type `"paid"`). Write annotations on function parameters and when declaring without a value; let inference handle the rest. `any` = turns checking off — avoid. `unknown` named here only as "safe 'don't know yet'", full use in 19.
- Analogy: luggage tags at an airport — tag says "fragile/liquids" and the checker (TypeScript) stops wrong items at security before the flight; Bun (the plane) doesn't re-check tags in the air.
- Code example: `annotations.ts` — `let quantity: number = 2; const status = "pending"; let note: string; note = "leave at door"; console.log(quantity, status, note);` → `2 pending leave at door`. Show (commented) `// quantity = "two";` → editor error `Type 'string' is not assignable to type 'number'.` — and note Bun would still run it if uncommented.
- Production use: annotated types are the API contract between layers (topic 18).
- Common mistakes: annotating everything redundantly; using `any` to silence errors; believing types are checked at run time.
- Sources: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-annotations-on-variables ; https://www.typescriptlang.org/docs/handbook/type-inference.html

### Template literals
- Concept: backtick strings `` `...` `` with `${expression}` placeholders; can span lines. Preferred over `+` concatenation. Forward pointer: Bun.sql uses backtick "tagged templates" (topic 13) — same backticks, different job.
- Analogy: fill-in-the-blanks form letter — "Dear ___, your order ___ ships today"; `${}` are the blanks.
- Code example: `templates.ts` — `const name = "Asha"; const orderId = 101; const totalCents = 4998; console.log(\`Hi ${name}, order #${orderId} total: ${totalCents / 100}\`);` → `Hi Asha, order #101 total: 49.98`.
- Production use: log messages, error messages.
- Common mistakes: using `"..."` quotes and expecting `${}` to work (prints literally); never build SQL with template literals + string values (forward pointer: SQL injection, topic 13).
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals

### null & undefined
- Concept: `undefined` = "no value assigned yet / missing" (JS gives it automatically: missing property, unset variable, function with no return). `null` = "intentionally empty" (you set it; also what PostgreSQL NULL becomes in Bun, topic 13). `===` strict equality (gloss; full in 03). `??` (nullish coalescing) gives fallback only for null/undefined; contrast `||` which also replaces `0` and `""`. With `strict` TS, `string` excludes null → write `string | null` (gloss `|` = "or", full in 04).
- Analogy: parking spots — `undefined` = spot never painted (no info), `null` = painted spot with "reserved: empty" sign (deliberately nothing). `??` = "if spot empty, park here instead".
- Code example: `nullish.ts` — `let couponCode: string | null = null; const discount = 0; console.log(couponCode ?? "NONE");` → `NONE`; `console.log(discount || 10);` → `10`; `console.log(discount ?? 10);` → `0`; `let deliveredAt; console.log(deliveredAt);` → `undefined`.
- Production use: optional DB columns come back `null`; config defaults with `??`.
- Common mistakes: using `||` for defaults and losing valid `0`; mixing null/undefined meaning.
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing ; https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#null-and-undefined

### Printing with console.log
- Concept: `console.log(a, b)` prints values separated by space; `console.error` for errors (goes to stderr — gloss: separate error output channel); objects print in readable form. Logging in production is structured JSON (forward pointer topic 21).
- Analogy: shouting updates across the kitchen — `log` = normal call-out, `error` = alarm bell on a separate line.
- Code example: `printing.ts` — `console.log("Order", 101, "paid:", true);` → `Order 101 paid: true`; `console.error("Payment failed for order", 102);` → `Payment failed for order 102` (shown on stderr).
- Production use: debugging during dev; replaced by a JSON logger in topic 21.
- Common mistakes: leaving noisy debug logs in production code; logging secrets (passwords, tokens).
- Sources: https://developer.mozilla.org/en-US/docs/Web/API/console/log_static ; https://bun.com/docs/api/console

## Quiz
1. Which keyword for a value that never changes: const or let? — tests const vs let
2. What does `"5" + 5` print? (`55`) — tests string concatenation
3. Why store prices as cents (`2499`) not `24.99`? — tests number precision
4. What prints: `const qty = 0; console.log(qty ?? 1, qty || 1)`? (`0 1`) — tests ?? vs ||
5. Does `let x: number = "hi"` stop Bun from running? (no; editor/tsc flags it) — tests annotations vs runtime
