# 01. How Backends Work
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: none

## Learning goals
- Learner can explain what a program, runtime, client, server and backend are.
- Learner can describe one HTTP request/response pair (method, path, headers, body, status).
- Learner can read and write a small JSON document.
- Learner can run a TypeScript file with `bun run` and predict its printed output.
- Learner knows the course project: an orders/users REST JSON API on Bun + PostgreSQL (no install steps; Bun 1.4.5 and PostgreSQL 19.0 assumed present).

## Sub-topics
### What a program is
- Concept: program = ordered list of instructions computer follows top to bottom; source code = text file humans write; statement = one instruction; output = what program prints/returns. Terms: code, file, statement, output, terminal (text window where you type commands).
- Analogy: recipe card — steps in order, cook (computer) follows exactly, no guessing; typo in recipe = cook stops (error). Contrast: recipe text (source code) vs meal (running program/output).
- Code example: `hello.ts` — two statements `console.log("Kitchen open")`, `console.log("Orders: 0")` → output exactly two lines `Kitchen open` / `Orders: 0` in that order. Gloss `console.log` as "print a line" (full treatment in 02).
- Production use: every backend service is just a program that never stops waiting for requests.
- Common mistakes: expecting lines to run in any order other than top-to-bottom; forgetting quotes around text.
- Sources: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/What_is_JavaScript

### Bun as a JavaScript/TypeScript runtime
- Concept: JavaScript = language; TypeScript = JavaScript + type labels checked by editor; runtime = program that runs your code outside a browser. Bun = runtime + package manager + test runner in one tool; runs `.ts` files directly (strips types, no separate compile step). Bun does NOT type-check at run time (editor / `tsc` does). Course uses Bun 1.4.5.
- Analogy: language = sheet music; runtime = musician who plays it; Bun = one musician who also tunes instruments and checks rehearsals (package manager, test runner). Contrast: browser = musician in a concert hall (web pages), Bun = musician in a studio (servers, scripts).
- Code example: `runtime.ts` — `console.log(Bun.version)` → prints `1.4.5` (on Bun 1.4.5). Explain `Bun` = global object Bun provides.
- Production use: Bun runs the API server, migration scripts and tests in this course.
- Common mistakes: thinking Bun checks types at run time (it strips them; a type error still runs); confusing JavaScript with Java.
- Sources: https://bun.com/docs ; https://bun.com/docs/runtime/typescript

### Clients, servers & HTTP requests/responses
- Concept: client = program that asks (browser, mobile app, curl); server = program that answers; backend = server-side program + database. HTTP = agreed message format. Request parts: method (GET read, POST create, PATCH update part, PUT replace, DELETE remove), URL path (`/orders/42`), query string (`?status=paid`), headers (key: value metadata, e.g. `Content-Type: application/json`), optional body. Response: status code (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Server Error), headers, body. REST = convention: URLs name resources (`/orders`), methods name actions.
- Analogy: restaurant — customer (client) gives waiter an order slip (request: what dish = path, action = method, notes = headers, extra details = body); kitchen (server) sends back plate + note "served"/"out of stock" (response body + status code). Database = pantry the kitchen reads from; customers never enter pantry.
- Code example: `request.txt` (plain text, not run) — show raw request `POST /orders HTTP/1.1` + `Content-Type: application/json` + body `{"productId": 7, "quantity": 2}` and raw response `HTTP/1.1 201 Created` + body `{"id": 101, "status": "pending", "totalCents": 4998}`. Explain each line.
- Production use: every endpoint built from topic 08 on is one request → response pair.
- Common mistakes: using GET to change data; treating 200 as the only success code; thinking status code is in the body.
- Sources: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status

### JSON as the data format
- Concept: JSON = text format for data: objects `{ "key": value }`, arrays `[ ... ]`, strings in double quotes, numbers, `true`/`false`, `null`. Keys must be double-quoted; no trailing commas; no comments. `JSON.stringify(value)` → text; `JSON.parse(text)` → value. Gloss "object" and "array" briefly (full in 04).
- Analogy: standard shipping form — every courier (language) reads same boxes in same places; strict format so nothing is misread. Contrast: stringify = filling the form, parse = reading it.
- Code example: `json.ts` — `const text = JSON.stringify({ id: 101, status: "pending", items: [7, 9] });` `console.log(text);` → `{"id":101,"status":"pending","items":[7,9]}`; then `const back = JSON.parse(text); console.log(back.status);` → `pending`. Gloss `const` as "name a value" (full in 02).
- Production use: request and response bodies of the API; JSONB column in topic 16.
- Common mistakes: single quotes in JSON text; trailing comma → `JSON.parse` throws SyntaxError (gloss: error raised when text breaks format rules).
- Sources: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/JSON ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse

### Running a file with bun run
- Concept: terminal command `bun run hello.ts` (or shorter `bun hello.ts`) runs file; output appears in terminal; program ends when last line done. Error stops program and prints message + line number. `bun --watch hello.ts` re-runs on save (dev convenience). No installation steps in course; Bun 1.4.5 assumed installed.
- Analogy: pressing play on a recording — `bun run` = play button, `--watch` = auto-replay every time you edit the tape.
- Code example: `order-total.ts` — `const priceCents = 2499; const quantity = 2; console.log("Total cents:", priceCents * quantity);` run `bun run order-total.ts` → `Total cents: 4998`. Note money stored as whole cents (integers) to avoid decimal rounding — through-line for course.
- Production use: `bun run src/index.ts` starts the API; `bun run migrate` runs migrations (topic 14).
- Common mistakes: running from wrong folder (file not found error); forgetting `.ts` extension in path.
- Sources: https://bun.com/docs/cli/run ; https://bun.com/docs/runtime/hot (watch mode)

## Quiz
1. Which program sends the request and which answers it? — tests client vs server
2. Which HTTP method + status fits "create an order succeeded"? (POST, 201) — tests methods/status codes
3. Is `{'id': 1,}` valid JSON? why not — tests JSON rules
4. What does `bun run order-total.ts` print for priceCents 1000, quantity 3? (`Total cents: 3000`) — tests running + reading output
5. Does Bun stop a program with a type error before running it? (no) — tests runtime vs type checking
