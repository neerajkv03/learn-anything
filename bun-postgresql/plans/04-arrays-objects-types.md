# 04. Arrays, Objects & Types
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 03-control-flow-functions

## Learning goals
- Learner can create arrays and transform them with `map`, `filter`, `find`, `reduce` (sum only), `length`.
- Learner can create objects, read/update properties with dot and bracket access.
- Learner can describe data shapes with `type` aliases and `interface`.
- Learner can use optional properties, union types and literal unions, and narrow them.
- Learner can destructure arrays/objects and copy/merge with spread.

## Sub-topics
### Arrays & array methods (map, filter, find)
- Concept: array = ordered list `[a, b]`, index from 0, `.length`, `.push()`. Type `number[]` / `Order[]`. Callback methods return new arrays without changing original: `map` (transform each), `filter` (keep matching), `find` (first match or `undefined`), `some`, `reduce` (fold to one value; show sum only). `.includes()`.
- Analogy: conveyor belt in a factory — `map` = paint every box, `filter` = inspector removes faulty boxes, `find` = grab first red box (or nothing), `reduce` = weigh all boxes into one total.
- Code example: `arrays.ts` — `const pricesCents = [1200, 450, 3000]; console.log(pricesCents.map(p => p / 100));` → `[ 12, 4.5, 30 ]`; `console.log(pricesCents.filter(p => p >= 1000));` → `[ 1200, 3000 ]`; `console.log(pricesCents.find(p => p > 5000));` → `undefined`; `console.log(pricesCents.reduce((sum, p) => sum + p, 0));` → `4650`; `console.log(pricesCents[0], pricesCents.length);` → `1200 3`.
- Production use: shaping DB rows into API output; summing order lines.
- Common mistakes: index starts at 0 not 1; forgetting `find` may return `undefined`; `reduce` without initial value.
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find

### Objects & property access
- Concept: object = named fields `{ key: value }`; dot access `order.status`; bracket access `order["status"]` for dynamic keys; assign to change; add/remove keys; `const` object can still have its fields changed (binding constant, not contents). Nested objects. `Object.keys`, `Object.entries`. Missing key → `undefined`. Optional chaining `?.` gloss.
- Analogy: filing card with labelled boxes — label = key, written content = value; `const` = card glued to the shelf, but you can still erase and rewrite boxes.
- Code example: `objects.ts` — `const order = { id: 101, status: "pending", customer: { name: "Asha" } }; order.status = "paid"; console.log(order.status, order.customer.name);` → `paid Asha`; `const field = "id"; console.log(order[field]);` → `101`; `console.log(Object.keys(order));` → `[ "id", "status", "customer" ]`.
- Production use: request bodies, DB rows (each row is an object), config.
- Common mistakes: thinking `const` makes object immutable; accessing nested field of `undefined` (TypeError) — use `?.`.
- Sources: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Object_basics ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining

### Type aliases & interfaces
- Concept: `type Order = { id: string; status: string; totalCents: number }` names a shape; `interface Order { ... }` similar for object shapes (can be extended with `extends`). Course convention: `type` for data shapes (works for unions too). Structural typing: any object with the right fields fits. Extra properties in object literals flagged. Arrays of types `Order[]`. Note: ids typed `string` because PostgreSQL bigint arrives as string (forward pointer 13).
- Analogy: cookie cutter — the type is the cutter shape; any dough piece that matches the outline passes, whatever bakery made it.
- Code example: `types.ts` — `type User = { id: string; email: string; name: string }; interface Product { id: string; name: string; priceCents: number } const u: User = { id: "1", email: "asha@example.com", name: "Asha" }; const p: Product = { id: "7", name: "Notebook", priceCents: 2499 }; console.log(\`${u.name} bought ${p.name}\`);` → `Asha bought Notebook`. Show commented-out `// const bad: Product = { id: "8", name: "Pen" };` → editor error `Property 'priceCents' is missing in type ...`.
- Production use: row types, input/output DTO types (topic 18).
- Common mistakes: thinking types exist at runtime (they are erased); mixing type and interface without reason.
- Sources: https://www.typescriptlang.org/docs/handbook/2/objects.html ; https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#differences-between-type-aliases-and-interfaces

### Optional properties & union types
- Concept: optional `note?: string` (may be missing → `string | undefined`). Union `A | B` = one of. Literal union `type OrderStatus = "pending" | "paid" | "shipped" | "cancelled"` — only those strings allowed (mirrors DB CHECK, topic 11). Narrowing: `if (typeof x === "string")`, `=== null` checks, `in` operator; TS knows type inside the branch.
- Analogy: menu with fixed choices — literal union = drop-down list, can't type a dish that isn't listed; optional property = "add a note (optional)" field on the order form.
- Code example: `unions.ts` — `type OrderStatus = "pending" | "paid" | "shipped" | "cancelled"; type Order = { id: string; status: OrderStatus; couponCode?: string; shippedAt: Date | null }; function label(o: Order): string { if (o.shippedAt === null) return \`${o.status} (not shipped)\`; return \`${o.status} on ${o.shippedAt.toISOString().slice(0, 10)}\`; } console.log(label({ id: "1", status: "paid", shippedAt: null }));` → `paid (not shipped)`; `console.log(label({ id: "2", status: "shipped", shippedAt: new Date("2026-11-20T10:00:00Z") }));` → `shipped on 2026-11-20`. Gloss `Date` (date-time object) + `toISOString`.
- Production use: status fields, nullable DB columns, PATCH bodies with optional fields.
- Common mistakes: using plain `string` where a literal union fits; forgetting to handle `null`/`undefined` branch.
- Sources: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types ; https://www.typescriptlang.org/docs/handbook/2/narrowing.html

### Destructuring & spread
- Concept: object destructuring `const { id, status } = order;` rename `{ id: orderId }`, default `{ limit = 20 }`; array destructuring `const [first] = rows;` (handy for "one row" query results). Spread `{ ...a, status: "paid" }` copies + overrides (shallow copy — gloss); array spread `[...a, x]`. Rest `const { passwordHash, ...safeUser } = user;` to strip a field.
- Analogy: unpacking a delivery box — destructuring = take out only the items you need and put each on its own shelf; spread = photocopy a form and change one box on the copy; rest = everything left in the box after removing the secret letter.
- Code example: `destructure.ts` — `const user = { id: "1", email: "asha@example.com", passwordHash: "$argon2id$..." }; const { passwordHash, ...safeUser } = user; console.log(safeUser);` → `{ id: "1", email: "asha@example.com" }`; `const rows = [{ id: "101" }]; const [first] = rows; console.log(first?.id);` → `101`; `const updated = { ...{ id: "101", status: "pending" }, status: "paid" }; console.log(updated.status);` → `paid`.
- Production use: removing `passwordHash` before sending users out; reading first row of query result.
- Common mistakes: thinking spread deep-copies nested objects; destructuring from `undefined` (TypeError).
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax

## Quiz
1. `[5, 10, 15].filter(n => n > 5).map(n => n * 2)` result? (`[20, 30]`) — tests array methods
2. Can you change `order.status` if `order` is `const`? why — tests const vs object contents
3. Which is allowed for `OrderStatus`: `"refunded"`? — tests literal unions
4. How do you remove `passwordHash` from a user object? — tests rest destructuring
5. What does `find` return when nothing matches? — tests find/undefined
