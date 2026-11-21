# 05. Errors & Async Code
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 04-arrays-objects-types

## Learning goals
- Learner can throw errors and handle them with `try / catch / finally`.
- Learner can write a custom error class with extra fields and check it with `instanceof`.
- Learner can explain what a Promise is and its three states.
- Learner can write `async` functions and use `await` inside `try/catch`.
- Learner can run independent async work in parallel with `Promise.all` and know it fails fast.

## Sub-topics
### throw, try / catch / finally
- Concept: error = object describing a failure; `throw new Error("msg")` stops current flow and jumps to nearest `catch`; uncaught → program crashes with stack trace (gloss: list of function calls that led there). `try { } catch (err) { } finally { }` — finally always runs (cleanup). In TS `catch (err)` is `unknown` (strict) → check `err instanceof Error` before `err.message`.
- Analogy: fire alarm — `throw` = pulling the alarm, everyone leaves current work; `catch` = assembly point where someone takes charge; `finally` = closing the doors, done whether there was a fire or not.
- Code example: `try-catch.ts` — `function parseQuantity(raw: string): number { const n = Number(raw); if (!Number.isInteger(n) || n <= 0) throw new Error(\`invalid quantity: ${raw}\`); return n; } try { console.log(parseQuantity("3")); console.log(parseQuantity("abc")); } catch (err) { if (err instanceof Error) console.log("caught:", err.message); } finally { console.log("done"); }` → `3` / `caught: invalid quantity: abc` / `done`.
- Production use: validation failures, DB failures handled centrally (topic 19).
- Common mistakes: empty catch blocks that hide failures; throwing strings instead of Error objects; accessing `err.message` without narrowing.
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw

### Error classes & custom errors
- Concept: `class` gloss (blueprint for objects; course uses classes mainly for errors). `class NotFoundError extends Error { readonly resource: string; constructor(resource: string, id: string) { super(\`${resource} ${id} not found\`); this.name = "NotFoundError"; this.resource = resource; } }` — explicit field declarations (no constructor parameter-properties shortcut; keeps code plain-JS-like). `instanceof` to tell kinds apart. `cause` option: `new Error("msg", { cause: err })` wraps a lower error. Built-ins: TypeError, RangeError, SyntaxError.
- Analogy: hospital triage tags — every patient is a patient (Error), but a red/yellow/green tag (subclass) tells staff which room to send them to.
- Code example: `custom-errors.ts` — define `NotFoundError` with explicit fields as above; `try { throw new NotFoundError("order", "999"); } catch (err) { if (err instanceof NotFoundError) console.log(err.name, err.message, err.resource); else throw err; }` → `NotFoundError order 999 not found order`.
- Production use: application error hierarchy mapped to HTTP status (topic 19).
- Common mistakes: forgetting `super(message)`; catching everything and swallowing unknown errors (re-throw).
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#custom_error_types ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause

### Promises
- Concept: async = work that finishes later (network, DB, disk); program keeps going meanwhile. Promise = object representing a future result; states pending → fulfilled (value) or rejected (error). `Promise<number>` type. `.then` mentioned once; course uses `await`. Built in demo with `Bun.sleep(ms)` (returns Promise). Order of output demonstrates non-blocking.
- Analogy: restaurant buzzer — you order (start work), get a buzzer (Promise), sit down and chat (other code runs); buzzer buzzes = fulfilled (food ready) or "sorry, sold out" = rejected.
- Code example: `promises.ts` — `const ready: Promise<string> = Bun.sleep(100).then(() => "order ready"); console.log("waiting..."); ready.then(msg => console.log(msg));` → `waiting...` then `order ready`.
- Production use: every DB query and fetch returns a Promise.
- Common mistakes: logging a Promise and expecting a value (`Promise { <pending> }`); forgetting rejection handling.
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises ; https://bun.com/docs/api/utils#bun-sleep

### async / await
- Concept: `async function` always returns a Promise; `await p` pauses that function until p settles, gives value or throws the rejection → use normal `try/catch`. Return type `Promise<T>`. Top-level `await` allowed in Bun modules. Forgetting `await` = bug (gets Promise, errors escape catch).
- Analogy: waiting at the pickup counter — `await` = you stand at the counter until your number is called, but the kitchen keeps cooking other orders (other requests are not blocked).
- Code example: `async-await.ts` — `async function fetchOrderStatus(id: string): Promise<string> { await Bun.sleep(50); if (id === "999") throw new Error("order 999 not found"); return "paid"; } try { console.log(await fetchOrderStatus("101")); console.log(await fetchOrderStatus("999")); } catch (err) { console.log("failed:", (err as Error).message); }` → `paid` / `failed: order 999 not found`. Gloss `as` (type assertion: "trust me" — use sparingly).
- Production use: every handler/service/repository function is `async`.
- Common mistakes: missing `await` (unhandled rejection); `await` inside `forEach` (doesn't wait — use `for...of`).
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await

### Running work in parallel with Promise.all
- Concept: sequential awaits add up times; `Promise.all([p1, p2])` runs together, resolves to array of results in input order; rejects as soon as any rejects (fail-fast). `Promise.allSettled` when you need every outcome. Don't parallelize steps that depend on each other or that must share one DB transaction (forward pointer 15).
- Analogy: cooking a meal — boil pasta and fry sauce at the same time instead of one after another; `Promise.all` = dinner served when both are done, but if the sauce burns the whole dinner is cancelled.
- Code example: `parallel.ts` — `async function load(name: string, ms: number): Promise<string> { await Bun.sleep(ms); return name; } const start = performance.now(); const [user, orders] = await Promise.all([load("user", 100), load("orders", 100)]); console.log(user, orders, performance.now() - start < 190);` → `user orders true` (≈100 ms not 200).
- Production use: loading a user and their order count at once; health checks.
- Common mistakes: using `Promise.all` for dependent steps; expecting results in finishing order (it's input order).
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled

## Quiz
1. Output order of try-catch.ts? — tests throw/catch/finally flow
2. Why re-throw errors you don't recognize? — tests custom error handling
3. Name the three Promise states — tests Promise basics
4. What goes wrong when you forget `await` before a call that throws? — tests async/await
5. Two independent 100 ms loads: total time sequential vs Promise.all? (~200 vs ~100) — tests parallelism
