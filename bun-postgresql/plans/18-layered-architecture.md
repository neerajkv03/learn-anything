# 18. Layered Architecture
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 17-indexes-performance

## Learning goals
- Learner can state each layer's job (routes, services, repositories) and the one-way dependency rule.
- Learner can define separate input, stored-row and output types and map between them.
- Learner can pass dependencies (`db`, `config`) into layers with factory functions instead of global imports.
- Learner can build the orders feature end to end: POST /orders, GET /orders/:id, GET /orders (keyset), PATCH /orders/:id/cancel.

## Sub-topics
### Routes, services & repositories
- Concept: routes = parse HTTP (params, body, query), call one service method, turn result into Response; no SQL, no business rules. Services = business rules (stock check, totals, status transitions), transactions; no Request/Response. Repositories = SQL + row mapping; no rules. Dependency direction routes → services → repositories → db. Benefits: testable (22), swappable, readable. Status transition rule in service: only `pending` → `cancelled` allowed by user.
- Analogy: restaurant again (06) — waiter, chef, pantry; now the job contracts: waiter never cooks, chef never talks to customers, pantry never decides the menu.
- Code example: table of "who does what" for POST /orders: route reads JSON & userId → service validates stock, computes total in tx → repo inserts order + items → route returns 201. No output.
- Production use: every feature follows this shape.
- Common mistakes: business rules leaking into routes; repositories throwing HTTP errors.
- Sources: https://bun.com/docs/runtime/http/routing ; https://martinfowler.com/eaaCatalog/repository.html ; https://martinfowler.com/eaaCatalog/serviceLayer.html

### Data transfer types (input vs stored vs output)
- Concept: three shapes per entity in `src/types/order.ts`: `CreateOrderInput = { items: { productId: string; quantity: number }[] }` (what client may send — never ids/status/totals), `OrderRow` (DB columns snake_case, repo-private), `Order`/`OrderDetail` (API output camelCase; dates ISO strings; ids strings). User output never includes `password_hash`. Mappers live in repositories. Totals always computed server-side from product prices.
- Analogy: passport application form (input) vs government records (stored) vs printed passport (output) — each has different fields; you never let the applicant fill in the "approved" stamp.
- Code example: `src/types/order.ts` — `export type OrderStatus = "pending" | "paid" | "shipped" | "cancelled"; export type CreateOrderInput = { items: { productId: string; quantity: number }[] }; export type OrderItem = { productId: string; name: string; quantity: number; unitPriceCents: number }; export type Order = { id: string; userId: string; status: OrderStatus; totalCents: number; createdAt: string }; export type OrderDetail = Order & { items: OrderItem[] };` gloss `&` (combine types). Mapper demo: row `{ id: "1", user_id: "1", status: "paid", total_cents: 4998, created_at: new Date("2026-11-01T10:00:00Z") }` → `{ id: "1", userId: "1", status: "paid", totalCents: 4998, createdAt: "2026-11-01T10:00:00.000Z" }`.
- Production use: prevents mass-assignment and data leaks.
- Common mistakes: returning DB rows straight to clients; trusting client-sent `totalCents`.
- Sources: https://www.typescriptlang.org/docs/handbook/2/objects.html#intersection-types ; https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html

### Passing dependencies (db, config) into layers
- Concept: dependency injection (plain words: pass what a function needs as arguments rather than importing globals). Factory functions return objects of functions (closures — gloss: inner function remembers outer variables): `createOrdersRepo()` (methods take `db: SQL` first so they work with `sql` or `tx`, 15), `createOrdersService({ sql, ordersRepo, productsRepo })`, `createOrdersRoutes({ ordersService })`. Wiring ("composition root") in `src/server.ts` `createServer(deps: { config, sql })` builds everything. No classes needed. Tests pass fakes (22).
- Analogy: chef who receives ingredients delivered to the station (injected) vs chef who must drive to one fixed supplier (global import) — swapping suppliers for a tasting (test) is trivial in the first case.
- Code example: `src/server.ts` — `import type { SQL } from "bun"; import type { Config } from "./config"; export function createServer(deps: { config: Config; sql: SQL }) { const ordersRepo = createOrdersRepo(); const productsRepo = createProductsRepo(); const ordersService = createOrdersService({ sql: deps.sql, ordersRepo, productsRepo }); return Bun.serve({ port: deps.config.port, routes: { ...createOrdersRoutes({ ordersService }) }, fetch: () => errorResponse(404, "NOT_FOUND", "route not found"), error: () => errorResponse(500, "INTERNAL", "internal server error") }); }`. No output.
- Production use: testability, multiple configs (test server on port 0).
- Common mistakes: hidden module-level singletons everywhere; giant dependency bags passed to every function.
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures ; https://bun.com/docs/api/http

### Building the orders feature end to end
- Concept: full flow for POST /orders with multiple items in one transaction: lock/decrement stock per product with atomic UPDATE (15), sort items by productId to lock in consistent order (deadlock avoidance), insert order with total, bulk insert items via `sql(rows)`, return OrderDetail (201 + Location). GET /orders/:id via JSON-shaping query (16) or two queries; GET /orders keyset pagination (17); PATCH /orders/:id/cancel: `UPDATE orders SET status = 'cancelled' WHERE id = ${id} AND user_id = ${userId} AND status = 'pending' RETURNING ...` + restock items in same tx; no row → 404 or 409 (distinguish by a follow-up SELECT — service rule). Temporary identity: route reads `X-User-Id` header — clearly marked INSECURE placeholder replaced by real auth in 20. Errors thrown as plain `Error` for now; topic 19 replaces with AppError types.
- Analogy: following one parcel from the shop counter, through the warehouse, onto the shelf and back as a receipt.
- Code example: curl session against seeded DB (09 dataset): `curl -i -X POST http://localhost:3000/orders -H "Content-Type: application/json" -H "X-User-Id: 3" -d '{"items":[{"productId":"2","quantity":2},{"productId":"1","quantity":1}]}'` → `HTTP/1.1 201 Created`, `Location: /orders/4`, body `{"id":"4","userId":"3","status":"pending","totalCents":2897,"createdAt":"<ISO time>","items":[{"productId":"1","name":"Notebook","quantity":1,"unitPriceCents":2499},{"productId":"2","name":"Pen","quantity":2,"unitPriceCents":199}]}` (2499 + 2×199 = 2897); `curl -X PATCH http://localhost:3000/orders/4/cancel -H "X-User-Id: 3"` → `{"id":"4",...,"status":"cancelled",...}`; repeat → 409 `{"error":{"code":"CONFLICT","message":"only pending orders can be cancelled"}}`. Author gives full code for repo, service, routes files; keep each function short.
- Production use: template for every new feature.
- Common mistakes: decrementing stock outside the tx; forgetting restock on cancel; N+1 when loading item names.
- Sources: https://bun.com/docs/api/sql ; https://www.postgresql.org/docs/19/explicit-locking.html#LOCKING-DEADLOCKS

## Quiz
1. Where does the "only pending orders can be cancelled" rule live? — tests layer responsibilities
2. Why must `CreateOrderInput` not contain `totalCents`? — tests DTO safety
3. How does a test give the service a fake repository? — tests dependency injection
4. Total for 1 Notebook + 2 Pens? (2897) — tests end-to-end logic
5. Why sort items by productId before decrementing stock? — tests deadlock avoidance
