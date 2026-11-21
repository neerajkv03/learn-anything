window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "19-validation-errors",
  "order": 19,
  "title": "Input Validation & Error Handling",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Everything a client sends can be wrong or hostile, so this topic teaches you to check it before use (validation) and to turn every failure into one predictable JSON error with the right HTTP status. You will build hand-written validators, a small family of error classes, one place that maps any error to a response, and a translator for PostgreSQL constraint errors.",
  "prerequisites": ["18-layered-architecture"],
  "subtopics": [
    {
      "id": "input-as-unknown",
      "title": "Treating request input as unknown",
      "explanation": "Anything that comes from a client is untrusted: the body, the URL parameters, the query string, the headers and the cookies. A client can be a buggy app, an old version of your front end, or someone deliberately sending garbage. Your server must never assume the data has the shape you hoped for.\n\nIn TypeScript, `await req.json()` reads the request body and parses it as JSON, but its type is `any`. `any` switches off type checking, so TypeScript would let you use the value in any way and never warn you. The type `unknown` is the safe opposite: it means \"some value, shape not known yet\". TypeScript refuses to let you read properties from an `unknown` value until you have checked what it is. So assign the result to `unknown` immediately and let the compiler force you to validate.\n\nA type assertion such as `const body = await req.json() as CreateOrderInput` (the `as` keyword from the errors topic) does not check anything. It only tells the compiler to stop complaining. If the client sent `{\"items\": 5}`, the program would carry on believing it has a valid order and fail somewhere deeper, or worse, store bad data.\n\nThe body may also not be valid JSON at all. In that case `req.json()` throws a `SyntaxError` (the error JavaScript raises when text cannot be parsed). We catch it and rethrow a clear client error with the code `INVALID_JSON`, which the server will answer with HTTP status 400 (\"bad request\"). We wrap this in a helper `readJson(req): Promise<unknown>` so every handler does it the same way.\n\nThe example below uses a tiny `ValidationError` class so it runs on its own. Sub-topic 3 builds the full error family; here only the idea matters. Note `catch {` with no variable: when you do not need the caught error you can leave out the `(err)` part.",
      "analogy": "Airport security. Every bag is put through the scanner, even bags from frequent flyers. A bag with a sealed label saying \"safe\" is the `as` cast: the label is only a claim, so it still goes through the scanner. `unknown` is the rule that says no bag enters the departure hall until it has been scanned.",
      "code": [
        {
          "language": "typescript",
          "filename": "read-json.ts",
          "source": "class ValidationError extends Error {\n  readonly code: string;\n  constructor(message: string, code = \"VALIDATION_ERROR\") {\n    super(message);\n    this.name = \"ValidationError\";\n    this.code = code;\n  }\n}\n\nasync function readJson(req: Request): Promise<unknown> {\n  try {\n    return await req.json();\n  } catch {\n    throw new ValidationError(\"body must be valid JSON\", \"INVALID_JSON\");\n  }\n}\n\nconst url = \"http://localhost/orders\";\nconst headers = { \"Content-Type\": \"application/json\" };\n\nconst good = new Request(url, { method: \"POST\", headers, body: '{\"items\":[]}' });\nconst bad = new Request(url, { method: \"POST\", headers, body: \"{bad\" });\n\nconsole.log(await readJson(good));\n\ntry {\n  await readJson(bad);\n} catch (err) {\n  if (err instanceof ValidationError) {\n    console.log(err.code, err.message);\n  }\n}\n",
          "output": "{ items: [] }\nINVALID_JSON body must be valid JSON",
          "explanation": "We build two `Request` objects by hand so no network is needed. The valid body parses and comes back typed as `unknown`. The broken body `{bad` makes `req.json()` throw, and `readJson` converts that into a `ValidationError` with the code `INVALID_JSON`. Put `readJson` in `src/http.ts` and call it as the first line of every handler that reads a body. Run the file with `bun run read-json.ts`."
        }
      ],
      "productionNote": "Make `await readJson(req)` the first line of every handler that accepts a body, and pass its result straight into a validator (next sub-topic). Do not trust the `Content-Type` header either: a client can label a body as JSON and send something else, so rely on the parse result, not the label.",
      "commonMistakes": [
        "Writing `const body = await req.json() as CreateOrderInput`. The `as` cast performs no check at run time, so invalid data flows into your services.",
        "Trusting the `Content-Type` header to mean the body is valid. The header is just another client-supplied value.",
        "Letting the `SyntaxError` from a bad body escape. The client would then get a 500 (server fault) for what is really their mistake (400)."
      ],
      "sources": [
        { "title": "MDN: Request.json()", "url": "https://developer.mozilla.org/en-US/docs/Web/API/Request/json" },
        { "title": "TypeScript Handbook: unknown", "url": "https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown" }
      ]
    },
    {
      "id": "validators-type-guards",
      "title": "Hand-written validators & type guards",
      "explanation": "A validator is a function that takes `unknown` input and either returns a correctly typed value or throws an error listing what is wrong. We write them by hand, with no library, so you see exactly what is checked.\n\nThe building block is a type guard: a function whose return type is `value is T`. When it returns `true`, TypeScript narrows the variable to type `T` inside the `if`. Our first guard is `isRecord(v): v is Record<string, unknown>`. `Record<string, unknown>` means \"an object whose keys are strings and whose values are not yet known\". The guard checks that the value is an object, is not `null` and is not an array.\n\nA good validator collects all problems instead of stopping at the first. Each problem is a `FieldError`: `{ field, message }`, where `field` names the bad part, for example `items[0].quantity`. At the end, if the list is not empty, the validator throws one `ValidationError` carrying the whole list as `details`. The client can then fix everything in one round trip.\n\nChecks used here: `Number.isInteger(quantity)` rejects `1.5` (a plain `typeof` check would accept it). The regular expression (a pattern for matching text) `/^[1-9][0-9]*$/` accepts only positive whole-number strings with no leading zero, such as `\"7\"` or `\"120\"`.\n\nA `Set` (a collection of unique values, written `new Set<string>()`, where `<string>` says it holds strings) detects duplicate product ids. Checking ids this way also prevents PostgreSQL error `22P02` (invalid text for a number, which you would get by sending `\"abc\"` to a `bigint` column).\n\nAlways bound sizes: here 1 to 50 items and quantity 1 to 100. Without limits, a client could send a million items and tie up your server and database. Validators also normalise: for example, trim whitespace and lowercase an email before use. Topic 20 applies that to signup.\n\nThe example below defines a compact `ValidationError` again so the file runs alone; in the project it is imported from `src/errors.ts` (sub-topic 3), and validators live in files such as `src/validation/orders.validation.ts`.",
      "analogy": "A form checker at a passport office. The officer checks every box on your application and hands the form back with all the mistakes circled at once, rather than sending you away after the first error and making you queue again for each one.",
      "code": [
        {
          "language": "typescript",
          "filename": "orders.validation.ts",
          "source": "type FieldError = { field: string; message: string };\ntype CreateOrderInput = { items: { productId: string; quantity: number }[] };\n\nclass ValidationError extends Error {\n  readonly details: FieldError[];\n  constructor(message: string, details: FieldError[] = []) {\n    super(message);\n    this.name = \"ValidationError\";\n    this.details = details;\n  }\n}\n\nconst ID_RE = /^[1-9][0-9]*$/;\n\nfunction isRecord(v: unknown): v is Record<string, unknown> {\n  return typeof v === \"object\" && v !== null && !Array.isArray(v);\n}\n\nfunction validateCreateOrder(input: unknown): CreateOrderInput {\n  if (!isRecord(input)) {\n    throw new ValidationError(\"invalid body\", [{ field: \"items\", message: \"must be an array\" }]);\n  }\n  const rawItems: unknown = input.items;\n  if (!Array.isArray(rawItems)) {\n    throw new ValidationError(\"invalid body\", [{ field: \"items\", message: \"must be an array\" }]);\n  }\n  const list: unknown[] = rawItems;\n  const errors: FieldError[] = [];\n  if (list.length < 1 || list.length > 50) {\n    errors.push({ field: \"items\", message: \"must have 1-50 entries\" });\n  }\n\n  const items: CreateOrderInput[\"items\"] = [];\n  const seen = new Set<string>();\n  for (let i = 0; i < list.length; i++) {\n    const raw = list[i];\n    if (!isRecord(raw)) {\n      errors.push({ field: `items[${i}]`, message: \"must be an object\" });\n      continue;\n    }\n    const { productId, quantity } = raw;\n    let ok = true;\n    if (typeof productId !== \"string\" || !ID_RE.test(productId)) {\n      errors.push({ field: `items[${i}].productId`, message: \"must be a numeric id string\" });\n      ok = false;\n    } else if (seen.has(productId)) {\n      errors.push({ field: `items[${i}].productId`, message: \"must not repeat\" });\n      ok = false;\n    } else {\n      seen.add(productId);\n    }\n    if (typeof quantity !== \"number\" || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {\n      errors.push({ field: `items[${i}].quantity`, message: \"must be an integer 1-100\" });\n      ok = false;\n    }\n    if (ok && typeof productId === \"string\" && typeof quantity === \"number\") {\n      items.push({ productId, quantity });\n    }\n  }\n\n  if (errors.length > 0) throw new ValidationError(\"invalid body\", errors);\n  return { items };\n}\n\nfunction show(input: unknown): void {\n  try {\n    console.log(JSON.stringify(validateCreateOrder(input)));\n  } catch (err) {\n    if (err instanceof ValidationError) console.log(JSON.stringify(err.details));\n  }\n}\n\nshow({ items: [{ productId: \"7\", quantity: 2 }] });\nshow({ items: [{ productId: \"x\", quantity: 0 }] });\nshow({ items: [{ productId: \"7\", quantity: 1.5 }, { productId: \"7\", quantity: 1 }] });\nshow(\"nope\");\n",
          "output": "{\"items\":[{\"productId\":\"7\",\"quantity\":2}]}\n[{\"field\":\"items[0].productId\",\"message\":\"must be a numeric id string\"},{\"field\":\"items[0].quantity\",\"message\":\"must be an integer 1-100\"}]\n[{\"field\":\"items[0].quantity\",\"message\":\"must be an integer 1-100\"},{\"field\":\"items[1].productId\",\"message\":\"must not repeat\"}]\n[{\"field\":\"items\",\"message\":\"must be an array\"}]",
          "explanation": "The first call is valid and returns a typed `CreateOrderInput`. The second shows both bad fields of one item reported together. The third has a non-integer quantity on item 0 and a repeated product id on item 1, and both are reported. The last input is not even an object, so the validator stops early because there is nothing to inspect further. The `ok` flag ensures only fully valid items are added to the result."
        }
      ],
      "productionNote": "Write one validator per endpoint input and call it right after `readJson`. Keep the limits (array length, string length, number range) in the validator so abusive requests are rejected before touching the database. Validate path parameters like `:id` with the same id pattern so a bad id gives a 400 instead of a PostgreSQL error.",
      "commonMistakes": [
        "Stopping at the first error. The client then has to fix and resend once per mistake.",
        "Forgetting `Number.isInteger`. `typeof 1.5 === \"number\"` is true, so a fractional quantity slips through.",
        "Not bounding arrays and strings, which lets one request carry huge payloads.",
        "Using `as` instead of narrowing with a type guard, which hides invalid data from the compiler."
      ],
      "sources": [
        { "title": "TypeScript Handbook: type predicates", "url": "https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates" },
        { "title": "OWASP Input Validation Cheat Sheet", "url": "https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html" }
      ]
    },
    {
      "id": "app-error-hierarchy",
      "title": "An application error hierarchy",
      "explanation": "Plain `Error` objects carry only a message. A web API also needs to know which HTTP status and which machine-readable code each failure deserves. A class hierarchy (a base class plus subclasses that `extends` it, as in the errors topic) solves this once.\n\nIn `src/errors.ts`, the base class `AppError extends Error` has three read-only fields: `status` (the HTTP status number), `code` (a short stable string such as `NOT_FOUND` that client code can switch on) and optional `details` (extra structured information, such as the list of field errors). Subclasses fix the status and a default code:\n\n`ValidationError` is 400 `VALIDATION_ERROR`, `UnauthorizedError` is 401 `UNAUTHORIZED`, `ForbiddenError` is 403 `FORBIDDEN`, `NotFoundError` is 404 `NOT_FOUND` and `ConflictError` is 409 `CONFLICT`.\n\nEvery subclass accepts an optional `code` to override its default, for example `new ConflictError(\"email already registered\", \"EMAIL_TAKEN\")`, so clients can tell two kinds of 409 apart. Each constructor also sets `this.name` to its class name so logs are readable.\n\nServices and repositories throw these errors. They never build a `Response`: deciding how an error looks over HTTP is the job of the HTTP layer (next sub-topic). The `message` must be safe to show to a client: no SQL text, no file paths, no secrets.",
      "analogy": "Colour-coded hospital wristbands, now with the ward number printed on them. The wristband (error class) already says which ward (status) the patient belongs to, so the porter (the error mapper) can take every patient to the right place without asking questions.",
      "code": [
        {
          "language": "typescript",
          "filename": "errors.ts",
          "source": "type FieldError = { field: string; message: string };\n\nexport class AppError extends Error {\n  readonly status: number;\n  readonly code: string;\n  readonly details?: unknown;\n  constructor(status: number, code: string, message: string, details?: unknown) {\n    super(message);\n    this.name = \"AppError\";\n    this.status = status;\n    this.code = code;\n    this.details = details;\n  }\n}\n\nexport class ValidationError extends AppError {\n  constructor(message: string, details: FieldError[] = [], code = \"VALIDATION_ERROR\") {\n    super(400, code, message, details);\n    this.name = \"ValidationError\";\n  }\n}\n\nexport class UnauthorizedError extends AppError {\n  constructor(message: string, code = \"UNAUTHORIZED\") {\n    super(401, code, message);\n    this.name = \"UnauthorizedError\";\n  }\n}\n\nexport class ForbiddenError extends AppError {\n  constructor(message: string, code = \"FORBIDDEN\") {\n    super(403, code, message);\n    this.name = \"ForbiddenError\";\n  }\n}\n\nexport class NotFoundError extends AppError {\n  constructor(message: string, code = \"NOT_FOUND\") {\n    super(404, code, message);\n    this.name = \"NotFoundError\";\n  }\n}\n\nexport class ConflictError extends AppError {\n  constructor(message: string, code = \"CONFLICT\") {\n    super(409, code, message);\n    this.name = \"ConflictError\";\n  }\n}\n\nconst e = new ConflictError(\"only pending orders can be cancelled\");\nconsole.log(e instanceof AppError, e.status, e.code);\nconsole.log(e instanceof Error, e.name, e.message);\n\nconst taken = new ConflictError(\"email already registered\", \"EMAIL_TAKEN\");\nconsole.log(taken.status, taken.code);\n\nfunction findOrder(id: number): never {\n  throw new NotFoundError(`order ${id} not found`);\n}\n\ntry {\n  findOrder(999);\n} catch (err) {\n  if (err instanceof AppError) console.log(err.status, err.code, err.message);\n}\n",
          "output": "true 409 CONFLICT\ntrue ConflictError only pending orders can be cancelled\n409 EMAIL_TAKEN\n404 NOT_FOUND order 999 not found",
          "explanation": "A `ConflictError` is also an `AppError` and an `Error`, so one `instanceof AppError` check in the catch block recognises every error in the family. The `code` override changes only the code, not the 409 status. `never` as a return type means the function never returns normally, because it always throws."
        }
      ],
      "productionNote": "Replace the plain `Error`s thrown in the services and repositories of topics 15 and 18 with these classes, so a missing order becomes a `NotFoundError` and a cancel of a non-pending order becomes a `ConflictError`. Keep status numbers inside this one file instead of scattering them through the code.",
      "commonMistakes": [
        "Writing ad-hoc status numbers (`status: 404`) throughout services instead of throwing a class that already knows its status.",
        "Putting SQL text, table names or internal ids that should stay private into `message`, which is shown to clients.",
        "Throwing a `Response` from a service. That ties business logic to HTTP; throw an `AppError` and let the HTTP layer convert it."
      ],
      "sources": [
        { "title": "MDN: Error, custom error types", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#custom_error_types" }
      ]
    },
    {
      "id": "error-mapping",
      "title": "Mapping errors to HTTP status & one JSON error shape",
      "explanation": "With errors thrown from everywhere, you need exactly one place that converts them to responses. That place is `toErrorResponse(err: unknown): Response` in `src/http.ts`. Every error response then has the same JSON shape as in the HTTP topic: `{ \"error\": { \"code\", \"message\", \"details\"? } }`, where `details` appears only when present.\n\nThe rules are short. If the error is an `AppError`, use its `status` and send its `code`, `message` and `details`. Anything else is a bug or an infrastructure failure we did not plan for: log the full error on the server, and send the client a generic 500 with code `INTERNAL` and the message `internal server error`. Never send `err.message` for unknown errors, because it might contain a password, a SQL statement or a file path. The next sub-topic adds one more rule for PostgreSQL errors.\n\nTo avoid copying `try/catch` into every route, wrap each handler with `handle(fn)`. It returns a new function that calls your handler and, if anything throws, answers with `toErrorResponse`. The signature uses a generic `<R extends Request>`: a type placeholder `R` meaning \"whatever request type this handler takes, as long as it is a `Request`\". That lets route handlers keep their `BunRequest` typing (the request type with `params`). If inference gets awkward, annotate the handler parameter explicitly, for example `BunRequest<\"/orders/:id\">`.\n\nIn a route table you use it like this: `\"/orders/:id\": { GET: handle(async (req) => ...) }`. The error handler option of `Bun.serve` stays in place only as a last resort for failures outside any wrapped handler.",
      "analogy": "A single complaints desk. Every department sends its problems there, and the desk replies on one standard letterhead. Internal memos (stack traces, secrets) are filed privately and never forwarded to the customer.",
      "code": [
        {
          "language": "typescript",
          "filename": "http.ts",
          "source": "class AppError extends Error {\n  readonly status: number;\n  readonly code: string;\n  readonly details?: unknown;\n  constructor(status: number, code: string, message: string, details?: unknown) {\n    super(message);\n    this.name = \"AppError\";\n    this.status = status;\n    this.code = code;\n    this.details = details;\n  }\n}\n\nclass NotFoundError extends AppError {\n  constructor(message: string) {\n    super(404, \"NOT_FOUND\", message);\n    this.name = \"NotFoundError\";\n  }\n}\n\nfunction toErrorResponse(err: unknown): Response {\n  if (err instanceof AppError) {\n    const body: { code: string; message: string; details?: unknown } = {\n      code: err.code,\n      message: err.message,\n    };\n    if (err.details !== undefined) body.details = err.details;\n    return Response.json({ error: body }, { status: err.status });\n  }\n  console.error(\"unhandled error:\", err instanceof Error ? err.message : err);\n  return Response.json(\n    { error: { code: \"INTERNAL\", message: \"internal server error\" } },\n    { status: 500 },\n  );\n}\n\nfunction handle<R extends Request>(fn: (req: R) => Promise<Response>) {\n  return async (req: R): Promise<Response> => {\n    try {\n      return await fn(req);\n    } catch (err) {\n      return toErrorResponse(err);\n    }\n  };\n}\n\nconst getOrder = handle(async (req: Request) => {\n  const id = new URL(req.url).searchParams.get(\"id\");\n  if (id !== \"1\") throw new NotFoundError(`order ${id} not found`);\n  return Response.json({ id: 1 });\n});\n\nconst crash = handle(async (_req: Request) => {\n  throw new Error(\"db password is hunter2\");\n});\n\nasync function show(res: Response): Promise<void> {\n  console.log(res.status, JSON.stringify(await res.json()));\n}\n\nawait show(await getOrder(new Request(\"http://localhost/orders?id=1\")));\nawait show(await getOrder(new Request(\"http://localhost/orders?id=999\")));\nawait show(await crash(new Request(\"http://localhost/boom\")));\n",
          "output": "200 {\"id\":1}\n404 {\"error\":{\"code\":\"NOT_FOUND\",\"message\":\"order 999 not found\"}}\nunhandled error: db password is hunter2\n500 {\"error\":{\"code\":\"INTERNAL\",\"message\":\"internal server error\"}}",
          "explanation": "The first call succeeds normally. The second throws a `NotFoundError`, which `handle` catches and `toErrorResponse` turns into a 404 with the standard shape. The third throws a plain `Error` whose message contains a secret. The line `unhandled error: ...` is written to the server's own error output (stderr) only; the client body contains just the generic `INTERNAL` message. The leading underscore in `_req` signals an intentionally unused parameter."
        }
      ],
      "productionNote": "Wrap every route handler in `handle` so clients always get the same JSON shape and never see stack traces. Topic 21 replaces the `console.error` line with structured logging that includes a request id.",
      "commonMistakes": [
        "Returning `err.message` for unknown errors. It can leak secrets, SQL or paths.",
        "Copy-pasting `try/catch` into every route, so one route eventually forgets and answers in a different format.",
        "Using different error JSON shapes in different routes, which forces clients to handle each separately."
      ],
      "sources": [
        { "title": "Bun docs: error handling", "url": "https://bun.com/docs/runtime/http/error-handling" },
        { "title": "MDN: HTTP response status codes", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status" }
      ]
    },
    {
      "id": "postgres-error-translation",
      "title": "Translating PostgreSQL errors (e.g. unique violation 23505 → 409)",
      "explanation": "When a query breaks a database rule, PostgreSQL raises an error carrying a five-character SQLSTATE code (a standard error code, introduced in the constraints topic). Bun.sql surfaces it as an instance of `SQL.PostgresError`, whose documented properties are `code`, `errno` (the SQLSTATE string, such as `\"23505\"`), `detail` and `hint`. Do not rely on any other property such as a constraint name.\n\nOur translator checks `err instanceof SQL.PostgresError` and switches on `err.errno`:\n\n`23505` (unique violation) becomes a 409 `ConflictError`. `23503` (foreign key violation) becomes a 409 `ConflictError` with the course message \"referenced record missing or in use\". `23514` (check violation) and `22P02` (invalid text representation, such as `\"abc\"` for a number) become a 400 `ValidationError`. Anything else returns `null`, so the normal 500 path handles it.\n\n`40001` (serialization failure, from the transactions topic) is not translated here. The right response is to retry the transaction with the helper from topic 15, and only if retries run out to answer 503 (service unavailable).\n\nPlug the translator into `toErrorResponse` with one line: `const mapped = err instanceof AppError ? err : fromPostgres(err);` and then respond from `mapped` if it is not `null`.\n\nNever put the error's `detail` into the response: it can contain actual values, for example `Key (email)=(ann@example.com) already exists`. For a friendly message per constraint, catch the error in the one service where only one constraint can fail (for example signup) and throw a specific error such as `new ConflictError(\"email already registered\", \"EMAIL_TAKEN\")`.\n\nThe constraint is also the only race-proof uniqueness check. If two requests both run `SELECT` to see whether an email exists, both can see \"not found\" and both then insert. A `UNIQUE` constraint lets exactly one insert win and fails the other with `23505`, which you map to 409.\n\nThe example separates the pure part, `fromSqlState(state)`, so it runs without a database. Run it with `bun run postgres-errors.ts`.",
      "analogy": "An interpreter at a border. The PostgreSQL code \"23505\" is a foreign language that travellers (API clients) do not speak. The interpreter turns it into \"this already exists\" with a standard 409 stamp, and keeps the confidential details of the original statement to themself. If two travellers rush the desk with the same name at the same moment, the desk serves only the first and tells the second the name is taken, so arriving together cannot get anyone past it.",
      "code": [
        {
          "language": "typescript",
          "filename": "postgres-errors.ts",
          "source": "import { SQL } from \"bun\";\n\nclass AppError extends Error {\n  readonly status: number;\n  readonly code: string;\n  constructor(status: number, code: string, message: string) {\n    super(message);\n    this.name = \"AppError\";\n    this.status = status;\n    this.code = code;\n  }\n}\n\nclass ConflictError extends AppError {\n  constructor(message: string, code = \"CONFLICT\") {\n    super(409, code, message);\n  }\n}\n\nclass ValidationError extends AppError {\n  constructor(message: string, code = \"VALIDATION_ERROR\") {\n    super(400, code, message);\n  }\n}\n\nfunction fromSqlState(state: string): AppError | null {\n  switch (state) {\n    case \"23505\":\n      return new ConflictError(\"resource already exists\");\n    case \"23503\":\n      return new ConflictError(\"referenced record missing or in use\");\n    case \"23514\":\n    case \"22P02\":\n      return new ValidationError(\"invalid value\");\n    default:\n      return null;\n  }\n}\n\nfunction fromPostgres(err: unknown): AppError | null {\n  if (!(err instanceof SQL.PostgresError)) return null;\n  return fromSqlState(String(err.errno));\n}\n\nfor (const state of [\"23505\", \"23503\", \"23514\", \"22P02\", \"40001\"]) {\n  const mapped = fromSqlState(state);\n  console.log(state, mapped ? `${mapped.status} ${mapped.code}` : \"not mapped\");\n}\n\nconsole.log(fromPostgres(new Error(\"plain error\")));\n",
          "output": "23505 409 CONFLICT\n23503 409 CONFLICT\n23514 400 VALIDATION_ERROR\n22P02 400 VALIDATION_ERROR\n40001 not mapped\nnull",
          "explanation": "`fromSqlState` is the table of translations. `fromPostgres` adds the safety check that the error really came from PostgreSQL, using `instanceof SQL.PostgresError`, and passes its `errno` on (`String(...)` guarantees we hold text). A plain `Error` is not a `PostgresError`, so it returns `null` and would fall through to the generic 500. The `40001` case is deliberately unmapped here because it is handled by retrying."
        }
      ],
      "productionNote": "Let the database constraint be the real uniqueness check and translate its error, instead of a `SELECT` before the `INSERT`. This stays correct under concurrent requests. Keep `detail` and `hint` in server logs only.",
      "commonMistakes": [
        "Checking uniqueness with `SELECT` then `INSERT`. Two simultaneous requests can both pass the check; only the constraint is race-proof.",
        "Sending the PostgreSQL `detail` text to the client, which can reveal stored values.",
        "Relying on undocumented error properties such as a constraint name instead of `errno` plus a per-service catch.",
        "Mapping every `PostgresError` to 409 regardless of `errno`, which hides real server problems behind a client error."
      ],
      "sources": [
        { "title": "PostgreSQL docs: error codes appendix", "url": "https://www.postgresql.org/docs/19/errcodes-appendix.html" },
        { "title": "Bun docs: SQL", "url": "https://bun.com/docs/api/sql" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why do we assign the result of `req.json()` to `unknown` instead of casting it to `CreateOrderInput`?",
      "options": [
        "`unknown` makes the JSON parse faster.",
        "`unknown` forces us to check the data before use, while a cast only silences the compiler and checks nothing.",
        "`CreateOrderInput` cannot be used as a type for JSON.",
        "`unknown` automatically rejects invalid data with a 400 response."
      ],
      "answerIndex": 1,
      "explanation": "The client controls the body, so its shape is not guaranteed. `unknown` makes TypeScript require checks (a validator) before the value is used. An `as` cast has no effect at run time."
    },
    {
      "question": "A request has `\"quantity\": 1.5`. Which check in the validator rejects it?",
      "options": [
        "`typeof quantity !== \"number\"`",
        "`isRecord(raw)`",
        "`!Number.isInteger(quantity)`",
        "`ID_RE.test(productId)`"
      ],
      "answerIndex": 2,
      "explanation": "`1.5` is a number, so the `typeof` check passes. Only `Number.isInteger` rejects fractions. `isRecord` checks the item is an object, and `ID_RE` checks the product id string."
    },
    {
      "question": "Which HTTP status and default code does `new NotFoundError(\"order 999 not found\")` produce?",
      "options": [
        "404 and `NOT_FOUND`",
        "400 and `VALIDATION_ERROR`",
        "409 and `CONFLICT`",
        "500 and `INTERNAL`"
      ],
      "answerIndex": 0,
      "explanation": "`NotFoundError` is the 404 subclass with the default code `NOT_FOUND`. 400 is `ValidationError`, 409 is `ConflictError`, and 500 `INTERNAL` is the generic answer for unexpected errors."
    },
    {
      "question": "A handler throws a plain `Error` with the message \"db password is hunter2\". What does the client receive?",
      "options": [
        "Status 500 with the message \"db password is hunter2\", so the client can report it.",
        "Status 400 with the message \"db password is hunter2\".",
        "Status 404 with an empty body.",
        "Status 500 with `{\"error\":{\"code\":\"INTERNAL\",\"message\":\"internal server error\"}}`, while the real message is only logged on the server."
      ],
      "answerIndex": 3,
      "explanation": "Unknown errors are logged privately and answered with a generic 500 so internal details never leak to clients."
    },
    {
      "question": "Why is relying on the `23505` unique-violation error better than running a `SELECT` before the `INSERT` to check whether an email exists?",
      "options": [
        "The `SELECT` is always slower than the `INSERT`.",
        "Two concurrent requests can both pass the `SELECT` check, whereas the `UNIQUE` constraint lets only one insert succeed.",
        "`23505` errors never need to be translated for the client.",
        "PostgreSQL does not allow `SELECT` statements on tables with a `UNIQUE` constraint."
      ],
      "answerIndex": 1,
      "explanation": "A check-then-insert has a gap in which another request can insert the same value. The constraint is enforced atomically by the database; you translate the resulting `23505` error into a 409."
    }
  ]
});
