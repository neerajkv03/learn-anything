# 08. HTTP Servers with Bun.serve
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 07-config-environment

## Learning goals
- Learner can start a server with `Bun.serve` and explain the `fetch` fallback handler.
- Learner can read `Request` data (method, URL, headers, JSON body) and build `Response`s.
- Learner can define `routes` with per-method handlers and know route precedence.
- Learner can read path params (`req.params`) and query strings (`URL.searchParams`).
- Learner can return JSON with correct status codes and headers, plus consistent 404 and 500 responses.
- Learner can test endpoints with `curl` and predict the output.

## Sub-topics
### Bun.serve & the fetch handler
- Concept: `Bun.serve({ port, fetch })` starts an HTTP server; `fetch(req)` called for every request, returns `Response` or `Promise<Response>`. Returns `server` object: `server.url`, `server.port`. Port default chain: `$BUN_PORT`, `$PORT`, `$NODE_PORT`, else 3000; `port: 0` = random (tests). `hostname` default `"0.0.0.0"`. Program stays alive while server runs; Ctrl+C stops. Course passes `config.port` explicitly. `createServer(deps)` in `src/server.ts` returns the server; `index.ts` calls it.
- Analogy: shop front door with a receptionist — `Bun.serve` opens the door at an address (port); `fetch` = the receptionist who greets every visitor and hands back an answer.
- Code example: `src/server.ts` (v1) — `export function createServer(port: number) { return Bun.serve({ port, fetch(req) { return new Response("orders-api is running"); } }); }`; `src/index.ts`: `const server = createServer(config.port); console.log(\`listening on ${server.url}\`);` → `listening on http://localhost:3000/`; `curl http://localhost:3000/anything` → `orders-api is running`. (Author: `server.url` href ends with `/`; hostname shown may be `localhost` — verify wording against docs example and avoid claiming exact host string if docs differ.)
- Production use: one server per process; behind a load balancer.
- Common mistakes: port already in use (EADDRINUSE error — gloss); forgetting to return a Response.
- Sources: https://bun.com/docs/api/http ; https://bun.com/docs/runtime/http/routing

### Request & Response objects
- Concept: Web-standard classes. `req.method`, `req.url` (full URL string), `req.headers.get("content-type")`, `await req.json()` (throws on invalid JSON → handle; topic 19), `await req.text()`. Body can be read once. `new Response(body, { status, headers })`; `Response.json(data, { status: 201, headers: {...} })` sets `Content-Type: application/json`.
- Analogy: letters in envelopes — request envelope has sender notes (headers), the letter (body) can only be opened once; response = reply letter with a stamped grade (status).
- Code example: `echo.ts` handler — `async fetch(req) { if (req.method === "POST") { const body = await req.json(); return Response.json({ received: body, contentType: req.headers.get("content-type") }, { status: 200 }); } return new Response("send a POST", { status: 405 }); }`; `curl -X POST http://localhost:3000/ -H "Content-Type: application/json" -d '{"productId":7,"quantity":2}'` → `{"received":{"productId":7,"quantity":2},"contentType":"application/json"}`.
- Production use: every handler reads Request and returns Response.
- Common mistakes: reading body twice; forgetting `await` on `req.json()`; returning plain object instead of Response.
- Sources: https://developer.mozilla.org/en-US/docs/Web/API/Request ; https://developer.mozilla.org/en-US/docs/Web/API/Response/json_static ; https://bun.com/docs/api/http

### The routes object & per-method handlers
- Concept: `routes: { "/health": new Response("OK"), "/orders": { GET: handler, POST: handler }, "/orders/:id": { GET, PATCH, DELETE } }`. Static Response routes; per-method objects; 1.4: HEAD answered by GET handler when no HEAD key. Precedence: exact → `:param` → `/prefix/*` → `/*`. `fetch` = fallback for unmatched requests. Split routes per feature: `src/routes/orders.routes.ts` exports `ordersRoutes` object, spread into `server.ts` `routes: { ...healthRoutes, ...ordersRoutes }`. In-memory array store in this topic (replaced by PostgreSQL in 13/18). Do not claim behaviour for a method missing from a per-method object (not documented).
- Analogy: building directory in a lobby — floor list (routes) sends each visitor to the right office; per-method = each office has separate windows for "pick up" (GET) and "drop off" (POST); visitors not on the list go to the help desk (fetch fallback).
- Code example: `src/routes/orders.routes.ts` — `type Order = { id: string; productId: number; quantity: number; status: "pending" }; const orders: Order[] = []; let nextId = 1; export const ordersRoutes = { "/orders": { GET: () => Response.json(orders), POST: async (req: Request) => { const body = (await req.json()) as { productId: number; quantity: number }; const order: Order = { id: String(nextId++), productId: body.productId, quantity: body.quantity, status: "pending" }; orders.push(order); return Response.json(order, { status: 201 }); } } };` `curl -X POST ... -d '{"productId":7,"quantity":2}'` → status 201, `{"id":"1","productId":7,"quantity":2,"status":"pending"}`; `curl http://localhost:3000/orders` → `[{"id":"1","productId":7,"quantity":2,"status":"pending"}]`. Note `as` cast is unsafe — replaced by validation in topic 19.
- Production use: route table = readable map of the API.
- Common mistakes: in-memory data lost on restart (why we need a DB); trusting `as` casts for input.
- Sources: https://bun.com/docs/runtime/http/routing ; https://bun.com/docs/api/http

### Path params (req.params) & query strings
- Concept: `"/orders/:id"` → `req.params.id` (string, typed from the literal path when the handler is inline; `BunRequest<"/orders/:id">` type for standalone handlers). Query string via `new URL(req.url).searchParams.get("status")` → `string | null`; convert numbers (`Number(...)`), defaults with `??`.
- Analogy: apartment address — path param = flat number in the address itself (`/orders/42`), query string = sticky note on the envelope with extra preferences (`?status=paid&limit=10`).
- Code example: add to ordersRoutes `"/orders/:id": { GET: (req: BunRequest<"/orders/:id">) => { const order = orders.find(o => o.id === req.params.id); if (!order) return Response.json({ error: { code: "NOT_FOUND", message: \`order ${req.params.id} not found\` } }, { status: 404 }); return Response.json(order); } }` (import type `BunRequest` from "bun"); `curl http://localhost:3000/orders/1` → order JSON; `curl -i http://localhost:3000/orders/99` → `HTTP/1.1 404 Not Found` + `{"error":{"code":"NOT_FOUND","message":"order 99 not found"}}`. Query demo in GET /orders: `const limit = Number(new URL(req.url).searchParams.get("limit") ?? "20");` `/orders?limit=1` → first order only (use `orders.slice(0, limit)`).
- Production use: `/orders/:id`, filtering & pagination params (topic 17).
- Common mistakes: treating params as numbers; not handling missing query param (`null`).
- Sources: https://bun.com/docs/runtime/http/routing ; https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/get

### JSON bodies, status codes & headers
- Concept: status map used course-wide: 200 OK (read/update), 201 Created (+ optional `Location` header), 204 No Content (delete, empty body: `new Response(null, { status: 204 })`), 400 bad input, 401 not logged in, 403 not allowed, 404 missing, 409 conflict, 422 not used (course uses 400 for validation — state convention), 500 server bug. One JSON error shape everywhere: `{ "error": { "code": "...", "message": "..." } }`. `src/http.ts` helpers: `json(data, status = 200)` and `errorResponse(status, code, message)`. Headers via `headers: { "Location": "/orders/1" }`.
- Analogy: report-card grades — the status code is the grade on the top line, readable without reading the essay (body); the error shape = school's standard comment form.
- Code example: `src/http.ts` — `export function json(data: unknown, status = 200, headers?: HeadersInit): Response { return Response.json(data, { status, headers }); } export function errorResponse(status: number, code: string, message: string): Response { return Response.json({ error: { code, message } }, { status }); }` used: `errorResponse(400, "VALIDATION_ERROR", "quantity must be a positive integer")` → status 400, body `{"error":{"code":"VALIDATION_ERROR","message":"quantity must be a positive integer"}}`; DELETE `/orders/1` → `204`, empty body.
- Production use: clients rely on stable status codes and error shape.
- Common mistakes: 200 with `{ error }` body; body on 204; inconsistent error shapes per route.
- Sources: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Location

### 404 & fallback handling
- Concept: `fetch` fallback returns JSON 404 for unknown paths. `error(err)` option returns a Response when a handler throws; with `development` on (default unless NODE_ENV=production or `development: false`) Bun shows a detailed error page otherwise; in production uncaught errors → plain 500. Course: always provide `error` returning generic 500 JSON (never leak stack traces) and log the error. Full error mapping in topic 19.
- Analogy: hotel front desk — guest asks for a room that doesn't exist → polite "no such room" card (404); a pipe bursts in the kitchen → manager apologizes with a standard notice (500), doesn't show guests the plumbing (stack trace).
- Code example: `src/server.ts` (v2) — `Bun.serve({ port, routes: { ...ordersRoutes }, fetch() { return errorResponse(404, "NOT_FOUND", "route not found"); }, error(err) { console.error(err); return errorResponse(500, "INTERNAL", "internal server error"); } })`; `curl -i http://localhost:3000/nope` → `404` + `{"error":{"code":"NOT_FOUND","message":"route not found"}}`; a handler that `throw new Error("boom")` → `500` + `{"error":{"code":"INTERNAL","message":"internal server error"}}`.
- Production use: no HTML error pages from a JSON API.
- Common mistakes: leaking `err.message`/stack to clients; forgetting fallback → Bun's default response.
- Sources: https://bun.com/docs/runtime/http/error-handling ; https://bun.com/docs/runtime/http/routing

## Quiz
1. Which runs for `GET /unknown` when routes don't match? (fetch) — tests fallback
2. `/orders/:id` vs `/orders/*` vs `/orders/recent` — which wins for `/orders/recent`? (exact) — tests precedence
3. What type is `req.params.id`, and what does `searchParams.get("limit")` return when absent? — tests params/query
4. Correct status for successful DELETE with no body? (204) — tests status codes
5. Why return a generic 500 message instead of `err.message`? — tests error handler safety
