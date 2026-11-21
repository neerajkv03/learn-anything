# 22. Testing with bun:test
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 21-logging-shutdown

## Learning goals
- Learner can write tests with `test`, `describe`, `expect` and run them with `bun test`.
- Learner can unit-test a service by injecting fake repositories and `mock()` functions.
- Learner can configure a separate test database via `.env.test` and a safety guard.
- Learner can write integration tests against PostgreSQL with migrations in setup and truncation between tests.
- Learner can test HTTP endpoints end to end with a real server on a random port.

## Sub-topics
### test, describe & expect
- Concept: automated test = code that checks other code and fails loudly. `import { test, describe, expect } from "bun:test"`. Files `*.test.ts` (also `_test`, `.spec`, `_spec`) under `tests/unit`, `tests/integration`. `bun test` (or `bun run test`) finds and runs them; filter `bun test tests/unit`. Matchers: `toBe` (same value/===-like), `toEqual` (deep equal), `toMatchObject` (subset), `toThrow`, `await expect(p).rejects.toThrow("msg")`. Default timeout 5000 ms; per-test third arg (`test("x", fn, 10_000)`). Arrange-Act-Assert pattern.
- Analogy: smoke detector — silent while all is well, screams the moment something burns; you install it once and it guards every future change.
- Code example: `tests/unit/money.test.ts` — `import { describe, test, expect } from "bun:test"; import { formatCents } from "../../src/money"; describe("formatCents", () => { test("formats whole cents", () => { expect(formatCents(4998)).toBe("$49.98"); }); test("pads small amounts", () => { expect(formatCents(5)).toBe("$0.05"); }); });` → `bun test tests/unit` summary includes `2 pass` and `0 fail` (author: don't invent full output layout beyond these counts).
- Production use: CI runs `bun test` on every push.
- Common mistakes: `toBe` for objects (use `toEqual`); forgetting `await` on async expectations (test passes falsely).
- Sources: https://bun.com/docs/test ; https://bun.com/docs/test/writing-tests

### Unit-testing services with mocks
- Concept: unit test = one unit (service) in isolation, no DB. Thanks to factories (18), pass fake repos: objects whose methods are `mock(async () => value)`; assert results and calls (`expect(fake).toHaveBeenCalledTimes(1)`, `.mock.calls[0]`). Prefer injected fakes over `mock.module` (module mocking is global per file and harder to reason about; mention it exists). 1.4: `resetAllMocks()` drops implementations, `clearAllMocks()` clears history only (version notes). Test the cancel rule (18): pending → cancelled; paid → ConflictError.
- Analogy: flight simulator — pilots (services) practise against a simulated airport (fake repos), so crashes cost nothing and every scenario is repeatable.
- Code example: `tests/unit/orders.service.test.ts` — build `ordersRepo` fake with `findById: mock(async () => ({ id: "2", userId: "1", status: "paid", totalCents: 199, createdAt: "2026-11-15T09:30:00.000Z" }))`; `sql` fake whose `begin` calls the callback with a dummy tx: `begin: mock(async (fn: (tx: unknown) => unknown) => fn({}))` (author adapts to the service's actual dependency shape and casts the fake `as unknown as SQL` with a one-line note); `await expect(service.cancelOrder("1", "2")).rejects.toThrow("only pending orders can be cancelled")` → passes; `expect(ordersRepo.findById).toHaveBeenCalledTimes(1)`.
- Production use: fast tests for business rules (milliseconds).
- Common mistakes: mocking the thing under test; asserting internals instead of behaviour; sharing mock state across tests (create fakes per test / `beforeEach`).
- Sources: https://bun.com/docs/test/mocks ; https://bun.com/docs/test/writing-tests

### A separate test database
- Concept: integration tests write and wipe data → must use `orders_test`, never dev/prod. `bun test` auto-loads `.env.test` (and skips `.env.local` when NODE_ENV=test): `NODE_ENV=test`, `DATABASE_URL=postgres://app:app_password@localhost:5432/orders_test`, `JWT_SECRET=test-secret-0123456789abcdef0123456789`. Safety guard in setup: throw unless `new URL(config.databaseUrl).pathname.endsWith("_test")`. Preload: `bunfig.toml` `[test]` `preload = ["./tests/setup.ts"]` (= `--preload`). Refactor `scripts/migrate.ts`: export `migrate(db)` and run only `if (import.meta.main)` (06) so setup can import it. Don't use 1.4's `--parallel` / concurrent tests with one shared test DB (tests would wipe each other's data) — run DB tests serially (default per-file sequential).
- Analogy: crash-test track — cars (code) are deliberately smashed on a private track, never on the public motorway (dev/prod data).
- Code example: `tests/setup.ts` — `import { beforeAll, afterAll } from "bun:test"; import { config } from "../src/config"; import { sql } from "../src/db"; import { migrate } from "../scripts/migrate"; if (!new URL(config.databaseUrl).pathname.endsWith("_test")) throw new Error("refusing to run tests against non-test database"); beforeAll(async () => { await migrate(sql); }); afterAll(async () => { await sql.close(); });` — hooks in a preload file scope to the whole test run (lifecycle docs; reviewer confirms). With `DATABASE_URL=.../orders_dev` → `bun test` fails with `refusing to run tests against non-test database`.
- Production use: CI spins up a disposable PostgreSQL with a `_test` database.
- Common mistakes: tests pointing at dev DB; forgetting to migrate test DB.
- Sources: https://bun.com/docs/test/configuration ; https://bun.com/docs/runtime/env ; https://bun.com/docs/test/lifecycle

### Integration tests against PostgreSQL (setup & cleanup)
- Concept: integration test = real repo + real DB. Clean slate per test: `beforeEach` → `TRUNCATE sessions, order_items, orders, products, users RESTART IDENTITY CASCADE` (gloss: empties tables fast, resets identity counters so ids start at 1 → predictable expectations). Test helpers `tests/helpers/factories.ts`: `createUser(overrides)`, `createProduct(...)` inserting minimal valid rows. Test constraint behaviour (409 on duplicate email via service), transactions (out-of-stock leaves no order row).
- Analogy: resetting a chess board before each game — every game starts from the same position so results are comparable.
- Code example: `tests/integration/orders.repo.test.ts` — `beforeEach(async () => { await sql\`TRUNCATE sessions, order_items, orders, products, users RESTART IDENTITY CASCADE\`; }); test("placeOrder decrements stock and stores items", async () => { const user = await createUser({ email: "asha@example.com" }); const product = await createProduct({ name: "Backpack", priceCents: 4999, stock: 5 }); const order = await ordersService.placeOrder(user.id, { items: [{ productId: product.id, quantity: 2 }] }); expect(order).toMatchObject({ id: "1", status: "pending", totalCents: 9998 }); const [p] = await sql\`SELECT stock FROM products WHERE id = ${product.id}\`; expect(p.stock).toBe(3); }); test("out of stock leaves no order", async () => { ...quantity: 10 → await expect(...).rejects.toThrow(); const [c] = await sql\`SELECT count(*)::int AS n FROM orders\`; expect(c.n).toBe(0); });` → both pass.
- Production use: catches SQL typos, constraint and transaction bugs unit tests can't.
- Common mistakes: tests depending on order or leftover data; forgetting CASCADE (`cannot truncate a table referenced in a foreign key constraint`).
- Sources: https://www.postgresql.org/docs/19/sql-truncate.html ; https://bun.com/docs/test/lifecycle

### Testing HTTP endpoints end to end
- Concept: start real server with `createServer({ ..., config: { ...config, port: 0 } })` (random free port) in `beforeAll`; call it with `fetch(new URL("/orders", server.url))`; assert status, headers, JSON; `afterAll` → `await server.stop(true)`. Full flow: signup → login (read `set-cookie` header, send back as `Cookie`) → POST /orders → GET /orders/:id; unauthenticated → 401; other user's order → 404 (20).
- Analogy: mystery shopper — walks in through the front door like a real customer and checks the whole experience, not just one department.
- Code example: `tests/integration/orders.http.test.ts` — `const res = await fetch(new URL("/orders", server.url), { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ items: [{ productId: "1", quantity: 1 }] }) }); expect(res.status).toBe(201); expect(res.headers.get("location")).toBe("/orders/1"); expect(await res.json()).toMatchObject({ id: "1", totalCents: 2499 });` (product 1 created in test with priceCents 2499); no cookie → `expect(res.status).toBe(401)`. Cookie extraction: `res.headers.get("set-cookie")!.split(";")[0]` → `session=<token>`.
- Production use: confidence that routing, validation, auth and DB work together.
- Common mistakes: fixed port collisions in CI; not stopping server (test run hangs); asserting exact timestamps.
- Sources: https://bun.com/docs/api/http ; https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch

## Quiz
1. `toBe` vs `toEqual` for comparing two order objects? — tests matchers
2. How does the service unit test avoid a real database? — tests mocks/DI
3. What stops tests from wiping the dev database? — tests test DB guard
4. Why `RESTART IDENTITY` in the TRUNCATE? — tests cleanup/predictable ids
5. Why `port: 0` for the HTTP test server? — tests e2e setup
