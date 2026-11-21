# 19. Input Validation & Error Handling
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 18-layered-architecture

## Learning goals
- Learner can treat all request input as `unknown` and handle invalid JSON.
- Learner can write hand-written validators and type guards that return typed input or collect field errors.
- Learner can build an `AppError` hierarchy (400/401/403/404/409).
- Learner can map any error to one JSON error shape and status in one place, never leaking internals.
- Learner can translate PostgreSQL errors (23505, 23503, 23514, 22P02) to API errors.

## Sub-topics
### Treating request input as unknown
- Concept: anything from the client (body, params, query, headers, cookies) is untrusted. `await req.json()` returns `any` in Bun types — assign to `unknown` immediately so TS forces checks; `as` casts check nothing. Invalid JSON → `req.json()` throws (SyntaxError) → 400 `INVALID_JSON`. Helper `readJson(req): Promise<unknown>`.
- Analogy: airport security — every bag is scanned, even from frequent flyers; a sealed bag labelled "safe" (`as` cast) still goes through the scanner.
- Code example: `src/http.ts` add `export async function readJson(req: Request): Promise<unknown> { try { return await req.json(); } catch { throw new ValidationError("body must be valid JSON", [], "INVALID_JSON"); } }`; `curl -X POST .../orders -H "Content-Type: application/json" -d '{bad'` → `400` `{"error":{"code":"INVALID_JSON","message":"body must be valid JSON"}}`.
- Production use: first line of every write handler.
- Common mistakes: `const body = await req.json() as CreateOrderInput`; trusting `Content-Type`.
- Sources: https://developer.mozilla.org/en-US/docs/Web/API/Request/json ; https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown

### Hand-written validators & type guards
- Concept: type guard = function returning `value is T` that narrows (`isRecord(v): v is Record<string, unknown>`). Validator = `validateX(input: unknown): X` collecting all field problems `{ field, message }[]` then throwing one `ValidationError`; normalizes (trim, lowercase email). Id param check `/^[1-9][0-9]*$/` (prevents PostgreSQL 22P02 on bad bigint). Limits: 1-50 items, quantity integer 1-100, no duplicate productIds. Files `src/validation/orders.validation.ts`, `auth.validation.ts` (20). No library (course rule: raw Bun).
- Analogy: form checker at a passport office — checks every box, returns the form with ALL mistakes circled at once, not one at a time.
- Code example: `validateCreateOrder` — `export function validateCreateOrder(input: unknown): CreateOrderInput { const errors: FieldError[] = []; if (!isRecord(input) || !Array.isArray(input.items)) throw new ValidationError("invalid body", [{ field: "items", message: "must be an array" }]); if (input.items.length < 1 || input.items.length > 50) errors.push({ field: "items", message: "must have 1-50 entries" }); const items = input.items.map((raw, i) => { if (!isRecord(raw)) { errors.push({ field: \`items[${i}]\`, message: "must be an object" }); return null; } const { productId, quantity } = raw; if (typeof productId !== "string" || !ID_RE.test(productId)) errors.push({ field: \`items[${i}].productId\`, message: "must be a numeric id string" }); if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) errors.push({ field: \`items[${i}].quantity\`, message: "must be an integer 1-100" }); return { productId: productId as string, quantity: quantity as number }; }); if (errors.length) throw new ValidationError("invalid body", errors); return { items: items as CreateOrderInput["items"] }; }` — author may restructure but keep behaviour; duplicate-id check included. Input `{"items":[{"productId":"x","quantity":0}]}` → 400 `{"error":{"code":"VALIDATION_ERROR","message":"invalid body","details":[{"field":"items[0].productId","message":"must be a numeric id string"},{"field":"items[0].quantity","message":"must be an integer 1-100"}]}}`.
- Production use: one validator per endpoint input.
- Common mistakes: stopping at first error; forgetting `Number.isInteger` (accepts 1.5); not bounding arrays/strings (abuse).
- Sources: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates ; https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html

### An application error hierarchy
- Concept: `src/errors.ts`: `class AppError extends Error { readonly status: number; readonly code: string; readonly details?: unknown }` + subclasses `ValidationError` (400, VALIDATION_ERROR; optional code override for INVALID_JSON), `UnauthorizedError` (401, UNAUTHORIZED), `ForbiddenError` (403, FORBIDDEN), `NotFoundError` (404, NOT_FOUND), `ConflictError` (409, CONFLICT). Every subclass accepts an optional `code` override (e.g. `new ConflictError("email already registered", "EMAIL_TAKEN")` in 20). Services/repos throw these (no Response). Message = safe for clients. Explicit field declarations (05 style); `this.name = new.target.name` or explicit string.
- Analogy: colour-coded hospital wristbands (05) now printed with the ward number (status) so the porter (error mapper) routes patients without asking.
- Code example: `throw new NotFoundError("order 999 not found")`; `const e = new ConflictError("only pending orders can be cancelled"); console.log(e instanceof AppError, e.status, e.code);` → `true 409 CONFLICT`.
- Production use: replace plain `Error`s from 15/18.
- Common mistakes: many ad-hoc status numbers sprinkled in services; putting SQL text in messages.
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#custom_error_types

### Mapping errors to HTTP status & one JSON error shape
- Concept: one function `toErrorResponse(err: unknown): Response` in `src/http.ts`: AppError → its status + `{ error: { code, message, details? } }`; known PostgreSQL errors → translated (next sub-topic); everything else → log full error, return 500 `INTERNAL` generic. Handler wrapper `handle(fn)` wraps every route handler in try/catch → `toErrorResponse`; Bun.serve `error` stays as last resort. Same shape as 08.
- Analogy: single complaints desk — every department sends problems there; the desk replies on one standard letterhead and never forwards internal memos to customers.
- Code example: `export function handle<R extends Request>(fn: (req: R) => Promise<Response>) { return async (req: R): Promise<Response> => { try { return await fn(req); } catch (err) { return toErrorResponse(err); } }; }`; route use `"/orders/:id": { GET: handle(async (req) => ...) }` (author ensures `req.params` typing still works; if generic typing gets awkward, annotate handler param as `BunRequest<"/orders/:id">`). `toErrorResponse(new Error("db password is hunter2"))` → `500` `{"error":{"code":"INTERNAL","message":"internal server error"}}`.
- Production use: consistent client experience; no stack traces leaked.
- Common mistakes: returning `err.message` for unknown errors; try/catch copy-pasted in every route.
- Sources: https://bun.com/docs/runtime/http/error-handling ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status

### Translating PostgreSQL errors (e.g. unique violation 23505 → 409)
- Concept: `err instanceof SQL.PostgresError` → switch on `err.errno` (SQLSTATE): `23505` unique_violation → 409; `23503` foreign_key_violation → 409 or 400 per context (course: 409 CONFLICT "referenced record missing or in use"); `23514` check_violation → 400; `22P02` invalid_text_representation → 400; `40001` serialization_failure → retry (15) else 503 — mention; others → 500. Documented PostgresError props are only `code`, `errno`, `detail`, `hint` — don't rely on constraint-name properties; for a friendly message per constraint, catch in the specific service (e.g. signup) and throw a specific ConflictError. Never echo `detail` to clients (may contain values).
- Analogy: interpreter at a border — the PostgreSQL code "23505" is in a foreign language; the interpreter turns it into "this already exists" (409) for travellers.
- Code example: `function fromPostgres(err: unknown): AppError | null { if (!(err instanceof SQL.PostgresError)) return null; switch (err.errno) { case "23505": return new ConflictError("resource already exists"); case "23503": return new ConflictError("referenced record missing or in use"); case "23514": case "22P02": return new ValidationError("invalid value"); default: return null; } }` (`import { SQL } from "bun"`). Demo: inserting duplicate email via repo → mapped response `409` `{"error":{"code":"CONFLICT","message":"resource already exists"}}`.
- Production use: race-proof uniqueness (constraint is the real check, not a pre-SELECT).
- Common mistakes: SELECT-then-INSERT to check uniqueness (race); leaking `detail`.
- Sources: https://www.postgresql.org/docs/19/errcodes-appendix.html ; https://bun.com/docs/api/sql

## Quiz
1. Why assign `req.json()` result to `unknown`, not `CreateOrderInput`? — tests unknown input
2. `quantity: 1.5` — which check rejects it? — tests validators
3. Which status/code does `NotFoundError` produce? — tests error hierarchy
4. What does the client see when an unexpected error contains a secret in its message? — tests safe mapping
5. Why rely on the 23505 constraint error rather than a SELECT before INSERT? — tests PG error translation
