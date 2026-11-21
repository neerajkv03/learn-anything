window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "22-testing",
  "order": 22,
  "title": "Testing with bun:test",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "You will write automated tests with Bun's built-in test runner: small unit tests with fake dependencies (stand-in objects in place of the real database code), integration tests against a separate PostgreSQL test database, and end-to-end tests that call a real running server over HTTP. Together they let you change the orders API and find out within seconds whether something broke.",
  "prerequisites": ["21-logging-shutdown"],
  "subtopics": [
    {
      "id": "test-describe-expect",
      "title": "test, describe & expect",
      "explanation": "An automated test is a small piece of code that runs other code and checks the result. If the result is what you expected, the test passes silently. If not, the test fails loudly and tells you which check broke. You write the test once, and from then on it re-checks your code every time you run it.\n\nBun has a test runner built in. You import its tools from the built-in module `bun:test` (a module is a file of code you can import from; this one ships inside Bun, so there is nothing to install). `test(name, fn)` defines one test: `name` describes it and `fn` is a function holding the checks. `describe(name, fn)` groups related tests under one heading. `expect(value)` starts a check, and you finish it with a matcher, a method that says what you expect, such as `.toBe(...)`. A single `expect(...).toBe(...)` line is called an assertion.\n\nBun finds test files by their names: any file ending in `.test.ts`, `_test.ts`, `.spec.ts` or `_spec.ts` (and the same for `.js`, `.tsx` and so on). In this course they live under `tests/unit` (no database) and `tests/integration` (real database and server). To run them, open a terminal in the project folder (the one that contains `package.json`) and type `bun test`. You can narrow the run with a path: `bun test tests/unit` runs only the files under that folder. `bun run test` works too once you add a `\"test\": \"bun test\"` entry to the `scripts` in `package.json`.\n\nThe example below first adds a tiny function, `formatCents`, to `src/money.ts`. It turns an amount in integer cents (topic 1) into a dollar string. Create that file, then create `tests/unit/money.test.ts` next to the other folders and run `bun test tests/unit`.\n\nA good test follows Arrange-Act-Assert. Arrange: set up the input. Act: call the code under test. Assert: check the outcome. Keeping these three steps visible makes a test easy to read months later.\n\nThe second example shows the matchers you will use most. `toBe` compares by identity (like Object.is): fine for numbers, strings and booleans, but two separately created objects are never `toBe` equal even when their contents match. `toEqual` compares contents deeply (every property, and nested objects and arrays). `toMatchObject` checks only the properties you list and ignores the rest. `toThrow` checks that a function throws an error, optionally with a message that contains your text. `.not` in front of a matcher flips it.\n\nFor async code, a promise is a value that arrives later (topic 5). `await expect(promise).rejects.toThrow(\"message\")` waits for the promise to fail and checks the error message. The `await` is essential. Each test gets 5000 ms (5 seconds) by default and fails if it takes longer. A slow test can ask for more time with a third argument: `test(\"name\", fn, 10_000)`, where the number is milliseconds.",
      "analogy": "A test suite is a smoke detector. It sits silent while everything is fine and screams the moment something starts to burn. You install it once, and it then guards every future change you make to the house, including the ones you forgot to worry about. `describe` is the label on each room's detector, and `expect` is the sensor reading.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/money.ts",
          "source": "// Turns integer cents into a dollar string, e.g. 4998 -> \"$49.98\".\nexport function formatCents(cents: number): string {\n  const dollars = Math.floor(cents / 100); // Math.floor drops the fraction: 49.98 -> 49\n  const rest = cents % 100; // % gives the remainder after dividing: 4998 % 100 = 98\n  return `$${dollars}.${rest < 10 ? \"0\" : \"\"}${rest}`;\n}\n",
          "output": "",
          "explanation": "The function under test. It prints nothing; the test file calls it and checks what it returns. The `rest < 10` check adds a leading zero so that 5 cents becomes \".05\" and not \".5\"."
        },
        {
          "language": "typescript",
          "filename": "tests/unit/money.test.ts",
          "source": "import { describe, test, expect } from \"bun:test\";\nimport { formatCents } from \"../../src/money\";\n\ndescribe(\"formatCents\", () => {\n  test(\"formats whole cents\", () => {\n    // Arrange\n    const cents = 4998;\n    // Act\n    const text = formatCents(cents);\n    // Assert\n    expect(text).toBe(\"$49.98\");\n  });\n\n  test(\"pads small amounts\", () => {\n    expect(formatCents(5)).toBe(\"$0.05\");\n  });\n});\n",
          "output": " 2 pass\n 0 fail",
          "explanation": "Run with `bun test tests/unit`. Bun prints a line per test and then a summary; the summary shows 2 tests passed and 0 failed. If you change `formatCents` so it returns \"$49.9\", the first test fails and Bun shows the expected and received values."
        },
        {
          "language": "typescript",
          "filename": "tests/unit/matchers.test.ts",
          "source": "import { describe, test, expect } from \"bun:test\";\n\nfunction makeOrder() {\n  return { id: \"1\", status: \"pending\", totalCents: 9998 };\n}\n\nasync function loadOrder(id: string) {\n  if (id !== \"1\") throw new Error(\"order not found\");\n  return makeOrder();\n}\n\ndescribe(\"matchers\", () => {\n  test(\"toEqual compares contents, toBe compares identity\", () => {\n    expect(makeOrder()).toEqual({ id: \"1\", status: \"pending\", totalCents: 9998 });\n    expect(makeOrder()).not.toBe(makeOrder()); // two different objects\n  });\n\n  test(\"toMatchObject checks only the listed properties\", () => {\n    expect(makeOrder()).toMatchObject({ status: \"pending\" });\n  });\n\n  test(\"toThrow checks a thrown error\", () => {\n    expect(() => {\n      throw new Error(\"boom\");\n    }).toThrow(\"boom\");\n  });\n\n  test(\"rejects checks a failed promise\", async () => {\n    await expect(loadOrder(\"9\")).rejects.toThrow(\"order not found\");\n  });\n\n  test(\"a test can ask for more time\", async () => {\n    await Bun.sleep(50);\n    expect((await loadOrder(\"1\")).status).toBe(\"pending\");\n  }, 10_000);\n});\n",
          "output": " 5 pass\n 0 fail",
          "explanation": "This file defines its own tiny functions so it runs on its own. Each test uses a different matcher. The last test passes `10_000` (10 seconds, the underscore is just a readable separator) as its third argument to raise its time limit."
        }
      ],
      "productionNote": "Teams run `bun test` automatically on every push to the shared repository, using a CI (continuous integration) service, a machine that checks out the code and runs your checks. A red test blocks the change from being merged, so broken code never reaches users.",
      "commonMistakes": [
        "Using `toBe` to compare objects or arrays. `toBe` asks whether two values are the very same object, so two equal-looking objects fail. Use `toEqual` (all properties) or `toMatchObject` (some properties).",
        "Forgetting `await` before `expect(promise).rejects...`. The test function finishes before the check does, so the test can pass even though the check would have failed. Always `await` async expectations and mark the test function `async`.",
        "Writing a test that cannot fail, for example one with no `expect` at all. A test only protects you if you have seen it fail at least once: change the code on purpose and confirm the test goes red."
      ],
      "sources": [
        { "title": "Bun docs: Test runner", "url": "https://bun.com/docs/test" },
        { "title": "Bun docs: Writing tests", "url": "https://bun.com/docs/test/writing-tests" }
      ]
    },
    {
      "id": "unit-testing-services-with-mocks",
      "title": "Unit-testing services with mocks",
      "explanation": "A unit test checks one unit, here one service, in isolation. It must not need PostgreSQL or a network, so it runs in milliseconds and gives the same answer every time. In topic 18 you built services with factory functions that receive their dependencies (the repositories and the `sql` client) as arguments. That design pays off now: in a test you pass in fakes, simple objects with the same method names that return prepared answers.\n\nA mock is a function that records how it was called. `mock(fn)` from `bun:test` wraps a function `fn` and adds a `.mock.calls` list: one entry per call, each entry being the array of arguments. You can then assert behaviour with `expect(fake).toHaveBeenCalledTimes(1)`, or read an argument with `fake.mock.calls[0]?.[2]` (first call, third argument; the `?.` stops a crash if there was no call).\n\nThe example tests the cancel rule from topic 18: a pending order may be cancelled, a paid one may not. The first block is a simplified copy of the service so the example is self-contained; your real service in `src/services/orders.ts` has more methods and uses the error classes from topic 19 (`ConflictError` means HTTP 409). The fake `sql` only needs `begin`, which calls the callback with a dummy transaction object `{}`. We cast it with `as unknown as SQL` (a type assertion, topic 5) because the fake has only one of the real client's many methods. The cast only affects type checking, not what runs.\n\nA `setup(status)` helper builds fresh fakes for every test, so no call history leaks from one test into the next. The fakes are typed with the argument names the service passes.\n\nBun also has `mock.module(path, factory)`, which replaces a whole imported file for the rest of that test file. It exists, but prefer injected fakes: module mocks are global to the file and harder to reason about. If you do reuse mocks across tests, know the 1.4 difference between two cleanup calls: `mock.clearAllMocks()` erases only the call history, while `jest.resetAllMocks()` (`jest` is imported from \"bun:test\") also removes the implementations you gave the mocks, leaving functions that return `undefined`.",
      "analogy": "A flight simulator. Pilots (services) practise against a simulated airport (fake repositories), so a crash costs nothing and every scenario, from a perfect landing to an engine failure, can be replayed exactly. The simulator's control panel is the mock: it also records every lever the pilot touched, so the instructor can check what happened.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/services/orders.ts",
          "source": "import type { SQL } from \"bun\";\n\n// Simplified: the course's real versions live in the errors module (topic 19).\nexport class ConflictError extends Error {}\nexport class NotFoundError extends Error {}\n\nexport type OrderRow = {\n  id: string;\n  userId: string;\n  status: string;\n  totalCents: number;\n  createdAt: string;\n};\n\nexport type OrdersRepo = {\n  findById(db: unknown, id: string): Promise<OrderRow | null>;\n  updateStatus(db: unknown, id: string, status: string): Promise<OrderRow>;\n};\n\nexport function createOrdersService(deps: { sql: SQL; ordersRepo: OrdersRepo }) {\n  return {\n    async cancelOrder(userId: string, orderId: string): Promise<OrderRow> {\n      return deps.sql.begin(async (tx) => {\n        const order = await deps.ordersRepo.findById(tx, orderId);\n        if (!order || order.userId !== userId) throw new NotFoundError(\"order not found\");\n        if (order.status !== \"pending\") {\n          throw new ConflictError(\"only pending orders can be cancelled\");\n        }\n        return deps.ordersRepo.updateStatus(tx, orderId, \"cancelled\");\n      });\n    },\n  };\n}\n",
          "output": "",
          "explanation": "The unit under test: it opens a transaction, loads the order, applies the rule, and updates the status. Nothing here runs by itself, so there is no output."
        },
        {
          "language": "typescript",
          "filename": "tests/unit/orders.service.test.ts",
          "source": "import { describe, test, expect, mock } from \"bun:test\";\nimport type { SQL } from \"bun\";\nimport { createOrdersService } from \"../../src/services/orders\";\n\nconst createdAt = \"2026-11-15T09:30:00.000Z\";\n\n// Fresh fakes for every test, so call history never leaks between tests.\nfunction setup(status: string) {\n  const ordersRepo = {\n    findById: mock(async (_db: unknown, _id: string) => ({\n      id: \"2\", userId: \"1\", status, totalCents: 199, createdAt,\n    })),\n    updateStatus: mock(async (_db: unknown, id: string, newStatus: string) => ({\n      id, userId: \"1\", status: newStatus, totalCents: 199, createdAt,\n    })),\n  };\n  // The fake only has `begin`; the cast tells TypeScript to treat it as a SQL client.\n  const sql = {\n    begin: mock(async (fn: (tx: unknown) => unknown) => fn({})),\n  } as unknown as SQL;\n  const service = createOrdersService({ sql, ordersRepo });\n  return { ordersRepo, service };\n}\n\ndescribe(\"cancelOrder\", () => {\n  test(\"cancels a pending order\", async () => {\n    const { ordersRepo, service } = setup(\"pending\");\n\n    const order = await service.cancelOrder(\"1\", \"2\");\n\n    expect(order.status).toBe(\"cancelled\");\n    expect(ordersRepo.updateStatus).toHaveBeenCalledTimes(1);\n    expect(ordersRepo.updateStatus.mock.calls[0]?.[2]).toBe(\"cancelled\");\n  });\n\n  test(\"refuses to cancel a paid order\", async () => {\n    const { ordersRepo, service } = setup(\"paid\");\n\n    await expect(service.cancelOrder(\"1\", \"2\")).rejects.toThrow(\n      \"only pending orders can be cancelled\",\n    );\n\n    expect(ordersRepo.findById).toHaveBeenCalledTimes(1);\n    expect(ordersRepo.updateStatus).toHaveBeenCalledTimes(0);\n  });\n\n  test(\"treats another user's order as not found\", async () => {\n    const { service } = setup(\"pending\");\n\n    await expect(service.cancelOrder(\"99\", \"2\")).rejects.toThrow(\"order not found\");\n  });\n});\n",
          "output": " 3 pass\n 0 fail",
          "explanation": "No database is touched. The paid-order test asserts behaviour (the error, and that no update happened) rather than internals. Run it with `bun test tests/unit/orders.service.test.ts`."
        }
      ],
      "productionNote": "Unit tests cover business rules (who may cancel, which states are allowed) and finish in milliseconds, so developers run them constantly while editing. Keep the slower database tests for what only a database can prove.",
      "commonMistakes": [
        "Mocking the thing under test. If you replace `cancelOrder` itself with a mock, the test checks your mock, not your code. Fake only the dependencies.",
        "Asserting internals instead of behaviour, such as the exact number of internal helper calls. Such tests break whenever you refactor, even though nothing is wrong. Assert results, thrown errors and the calls that matter (was the update skipped for a paid order?).",
        "Sharing mock state across tests. Calls pile up on one shared mock and later tests see earlier calls. Create fakes inside each test or in a `beforeEach` hook (a function that runs before every test).",
        "Calling `jest.resetAllMocks()` and expecting only the history to be cleared. In Bun 1.4 it also drops the implementations; use `mock.clearAllMocks()` to keep them."
      ],
      "sources": [
        { "title": "Bun docs: Mocks", "url": "https://bun.com/docs/test/mocks" },
        { "title": "Bun docs: Writing tests", "url": "https://bun.com/docs/test/writing-tests" }
      ]
    },
    {
      "id": "a-separate-test-database",
      "title": "A separate test database",
      "explanation": "Integration tests write rows and then wipe tables. If they ran against your development database they would erase your data, and against production they would be a disaster. So tests get their own PostgreSQL database named `orders_test`. Create it once. In a terminal, using a PostgreSQL superuser (the `postgres` role here) with `psql`, the command-line client from topic 9:\n\n`psql -U postgres -c \"CREATE DATABASE orders_test OWNER app\"`\n\nThe `OWNER app` part makes the course's `app` role the owner so it can create tables there.\n\nNext, tell the app to use it. When you run `bun test`, Bun automatically loads the file `.env.test` (topic 7) and skips `.env.local` when `NODE_ENV` is `test`. Create `.env.test` in the project root with the three values shown below. `config.databaseUrl` (from `src/config.ts`, topic 7) then points at `orders_test` during tests, without any code change.\n\nA file can still point at the wrong place by mistake, and values set in your terminal win over `.env` files. So add a safety guard: code that throws unless the database name ends in `_test`. A guard turns a silent disaster into an immediate, readable error.\n\nWhere does the guard go? In a preload file: a script Bun runs once before any test file. Register it in `bunfig.toml` (Bun's own settings file, in the project root) with `[test]` and `preload = [\"./tests/setup.ts\"]`; this is the same as passing `--preload ./tests/setup.ts` on every run. `beforeAll(fn)` runs `fn` once before the tests and `afterAll(fn)` once after them. Hooks registered in a preload file apply to the whole test run, so the setup file migrates the test database once at the start and closes the connection pool at the end.\n\nThe setup file needs the migration runner from topic 14. That script currently runs when launched, so refactor `scripts/migrate.ts`: wrap the existing logic in `export async function migrate(db: SQL)`, and call it at the bottom only `if (import.meta.main)` (true when the file is run directly, topic 6). Importing it from the setup file then does not run it a second time.\n\nOne warning for Bun 1.4: it can run test files in parallel (`--parallel`) and run tests concurrently (`test.concurrent`). Do not use either with one shared test database; the tests would wipe each other's rows. By default Bun runs the tests in a file one after another, which is what database tests need.",
      "analogy": "A crash-test track. Cars (your code) are deliberately smashed on a private track built for it, never on the public motorway where real traffic (your development and production data) drives. The safety guard is the locked gate that refuses to let a test car onto any road that is not the test track.",
      "code": [
        {
          "language": "bash",
          "filename": ".env.test",
          "source": "NODE_ENV=test\nDATABASE_URL=postgres://app:app_password@localhost:5432/orders_test\nJWT_SECRET=test-secret-0123456789abcdef0123456789\n",
          "output": "",
          "explanation": "Loaded automatically by `bun test`. The secret is a throwaway value that is fine only because it is for tests; never reuse it elsewhere."
        },
        {
          "language": "toml",
          "filename": "bunfig.toml",
          "source": "[test]\npreload = [\"./tests/setup.ts\"]\n",
          "output": "",
          "explanation": "Tells `bun test` to run `tests/setup.ts` before any test file."
        },
        {
          "language": "typescript",
          "filename": "scripts/migrate.ts",
          "source": "import type { SQL } from \"bun\";\nimport { sql } from \"../src/db\";\n\n// Exported so tests can call it. The body is the topic 14 runner with the global sql replaced by the db parameter.\nexport async function migrate(db: SQL): Promise<void> {\n  // ...create schema_migrations, read the .sql files, apply the ones not yet applied...\n}\n\n// Only runs for `bun run scripts/migrate.ts`, not when another file imports it.\nif (import.meta.main) {\n  await migrate(sql);\n  await sql.close();\n}\n",
          "output": "",
          "explanation": "Illustrative skeleton: keep your existing migration code inside `migrate`, replacing its use of the global `sql` with the `db` parameter."
        },
        {
          "language": "typescript",
          "filename": "tests/setup.ts",
          "source": "import { beforeAll, afterAll } from \"bun:test\";\nimport { loadConfig } from \"../src/config\";\nimport { sql } from \"../src/db\";\nimport { migrate } from \"../scripts/migrate\";\n\nconst config = loadConfig();\n\n// Safety guard: refuse to run if the database name does not end in _test.\nif (!new URL(config.databaseUrl).pathname.endsWith(\"_test\")) {\n  throw new Error(\"refusing to run tests against non-test database\");\n}\n\nbeforeAll(async () => {\n  await migrate(sql); // bring the test database up to the latest schema\n});\n\nafterAll(async () => {\n  await sql.close(); // let the process exit\n});\n",
          "output": "",
          "explanation": "`new URL(...).pathname` of `postgres://.../orders_test` is `/orders_test`, so `endsWith(\"_test\")` is true. For a URL ending in `orders_dev` it is false and the file throws before any test runs."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "DATABASE_URL=postgres://app:app_password@localhost:5432/orders_dev bun test",
          "output": "",
          "explanation": "Here the terminal value overrides `.env.test` and the guard stops the run with the thrown error message \"refusing to run tests against non-test database\" before any test runs. (This is Bash/macOS/Linux syntax. In PowerShell, set `$env:DATABASE_URL` first.)"
        }
      ],
      "productionNote": "In CI the pipeline starts a disposable PostgreSQL server (often in a container), creates a `_test` database, and runs `bun test`. Nothing there is precious, and the guard still protects a developer who runs the suite on a laptop.",
      "commonMistakes": [
        "Pointing tests at the development database, so a test run erases the data you were working with. Use `.env.test` and the `_test` guard.",
        "Forgetting to migrate the test database, so tests fail with errors like a missing table. The `beforeAll` in the setup file prevents this.",
        "Enabling `--parallel` or `test.concurrent` for tests that share one database. They truncate each other's tables mid-test and fail at random."
      ],
      "sources": [
        { "title": "Bun docs: Test configuration", "url": "https://bun.com/docs/test/configuration" },
        { "title": "Bun docs: Environment variables", "url": "https://bun.com/docs/runtime/env" },
        { "title": "Bun docs: Lifecycle hooks", "url": "https://bun.com/docs/test/lifecycle" }
      ]
    },
    {
      "id": "integration-tests-against-postgresql",
      "title": "Integration tests against PostgreSQL (setup & cleanup)",
      "explanation": "An integration test uses the real repositories and a real database, so it can catch what a mock never will: a typo in SQL, a violated constraint, a transaction that forgot to roll back. It is slower than a unit test, so write fewer of them and aim them at the risky spots.\n\nEvery test must start from the same known state, otherwise results depend on which test ran before. The simplest way is to empty the tables before each test. Do this in a `beforeEach` hook: a function Bun runs before every single test in the file. The SQL command is `TRUNCATE`, which empties tables very quickly. Add `RESTART IDENTITY` to reset the identity counters (the auto-numbering of ids, topic 9) so the first row of every test gets id 1, which makes expected values predictable. Add `CASCADE` to also empty tables that reference the listed ones through foreign keys (topic 11). Without it, PostgreSQL refuses with `cannot truncate a table referenced in a foreign key constraint`. Do not truncate `schema_migrations`; it records which migrations have run.\n\nWrite the cleanup once as a helper, along with small factory functions that insert a minimal valid row and return it. Put them in `tests/helpers/factories.ts`. Each factory accepts overrides, a partial object whose values replace the defaults. Adjust the column lists to match your own schema from topics 11 and 20.\n\nCreate tests/helpers/services.ts with `import { sql } from \"../../src/db\";` and `export const ordersService = <your orders service factory>({ sql, ordersRepo: <your orders repository factory>() });`, using the factory names from your composition root (topic 18).\n\nThe tests then follow Arrange-Act-Assert against the real service. `ordersService` comes from `tests/helpers/services.ts`, a short file that calls the same factory functions as your composition root (topic 18) with the shared `sql` from `src/db.ts`. The first test places an order for 2 backpacks priced 4999 cents and checks the returned order and the stock left in the table. The second asks for more than is in stock, expects the call to fail, and checks that no order row was left behind, which proves the transaction rolled back (topic 15).\n\nNotice that these tests do not depend on each other. Each one builds exactly the rows it needs, so you can run any one alone or in any order.",
      "analogy": "Resetting a chess board before each game. Every game starts from the same position, so a result tells you about the moves played and not about leftover pieces from the last game.",
      "code": [
        {
          "language": "typescript",
          "filename": "tests/helpers/factories.ts",
          "source": "import { sql } from \"../../src/db\";\n\n// Empties all data tables and restarts their id counters at 1.\nexport async function resetDb(): Promise<void> {\n  await sql`TRUNCATE sessions, order_items, orders, products, users RESTART IDENTITY CASCADE`;\n}\n\nexport async function createUser(overrides: { email?: string; name?: string } = {}) {\n  const email = overrides.email ?? \"user@example.com\";\n  const name = overrides.name ?? \"Test User\";\n  const [row] = await sql`\n    INSERT INTO users (email, name, password_hash)\n    VALUES (${email}, ${name}, ${\"not-a-real-hash\"})\n    RETURNING id::text AS id, email\n  `;\n  return row as { id: string; email: string };\n}\n\nexport async function createProduct(\n  overrides: { name?: string; priceCents?: number; stock?: number } = {},\n) {\n  const name = overrides.name ?? \"Test Product\";\n  const priceCents = overrides.priceCents ?? 1000;\n  const stock = overrides.stock ?? 10;\n  const [row] = await sql`\n    INSERT INTO products (name, price_cents, stock)\n    VALUES (${name}, ${priceCents}, ${stock})\n    RETURNING id::text AS id, name\n  `;\n  return row as { id: string; name: string };\n}\n",
          "output": "",
          "explanation": "`id::text` casts the bigint id to text so it arrives as a string, matching how the course treats ids. The `row as { ... }` casts tell TypeScript the shape of the first returned row. These helpers print nothing; the tests use them."
        },
        {
          "language": "typescript",
          "filename": "tests/integration/orders.repo.test.ts",
          "source": "import { describe, test, expect, beforeEach } from \"bun:test\";\nimport { sql } from \"../../src/db\";\nimport { createUser, createProduct, resetDb } from \"../helpers/factories\";\nimport { ordersService } from \"../helpers/services\";\n\ndescribe(\"orders against PostgreSQL\", () => {\n  beforeEach(resetDb);\n\n  test(\"placeOrder decrements stock and stores items\", async () => {\n    const user = await createUser({ email: \"asha@example.com\" });\n    const product = await createProduct({ name: \"Backpack\", priceCents: 4999, stock: 5 });\n\n    const order = await ordersService.placeOrder(user.id, {\n      items: [{ productId: product.id, quantity: 2 }],\n    });\n\n    expect(order).toMatchObject({ id: \"1\", status: \"pending\", totalCents: 9998 });\n    const [p] = await sql`SELECT stock FROM products WHERE id = ${product.id}`;\n    expect(p.stock).toBe(3);\n  });\n\n  test(\"out of stock leaves no order\", async () => {\n    const user = await createUser({ email: \"asha@example.com\" });\n    const product = await createProduct({ name: \"Backpack\", priceCents: 4999, stock: 5 });\n\n    await expect(\n      ordersService.placeOrder(user.id, {\n        items: [{ productId: product.id, quantity: 10 }],\n      }),\n    ).rejects.toThrow();\n\n    const [c] = await sql`SELECT count(*)::int AS n FROM orders`;\n    expect(c.n).toBe(0);\n  });\n});\n",
          "output": " 2 pass\n 0 fail",
          "explanation": "`beforeEach(resetDb)` gives each test an empty database, so the first order always has id \"1\". `count(*)::int` makes the count a JavaScript number instead of a string (topic 12). Run with `bun test tests/integration/orders.repo.test.ts`."
        }
      ],
      "productionNote": "These tests catch SQL typos, constraint violations and transaction bugs that unit tests with fakes cannot see. A common team rule is: many fast unit tests for rules, a smaller set of integration tests for each repository and each multi-step transaction.",
      "commonMistakes": [
        "Tests that depend on run order or on data left behind by an earlier test. Reset before each test and create exactly what the test needs.",
        "Leaving out `CASCADE` in the TRUNCATE. PostgreSQL then fails with `cannot truncate a table referenced in a foreign key constraint`.",
        "Truncating `schema_migrations` along with the data tables. The runner would then try to apply every migration again."
      ],
      "sources": [
        { "title": "PostgreSQL docs: TRUNCATE", "url": "https://www.postgresql.org/docs/19/sql-truncate.html" },
        { "title": "Bun docs: Lifecycle hooks", "url": "https://bun.com/docs/test/lifecycle" }
      ]
    },
    {
      "id": "testing-http-endpoints-end-to-end",
      "title": "Testing HTTP endpoints end to end",
      "explanation": "An end-to-end test drives the system the way a real client does: it starts the real server and sends real HTTP requests to it. It proves that routing, validation, authentication and the database work together.\n\nStart the server in `beforeAll` using your `createServer` factory (topic 8), but override the port with `0`. Port 0 means \"pick any free port\", so the test never collides with another program or with a parallel CI job that wants the same fixed port. The returned server object has a `url` property holding the address it chose, so build each request URL with `new URL(\"/orders\", server.url)`. In `afterAll`, call `await server.stop(true)`; the `true` closes open connections immediately. A server you forget to stop keeps the process alive and the test run hangs.\n\nThe example uses the shape of your own app: `createServer({ sql, config: { ...config, port: 0 } })`. `{ ...config, port: 0 }` copies the config and replaces just `port` (spread, topic 4). Pass whatever other dependencies your composition root gives it. The signup and login paths below are the ones from topic 20; change them if yours differ.\n\nAuthentication uses a cookie (topic 20). The helper `signupAndLogin` signs up, logs in, and reads the `set-cookie` response header, which looks like `session=<token>; HttpOnly; ...`. Splitting at the first `;` keeps just `session=<token>`. Sending that text back in a `Cookie` request header is the cookie round-trip a browser would do for you.\n\nThe three tests check: no cookie gives 401 (not authenticated); a full flow of POST `/orders` and then GET `/orders/1` works, including the 201 status and the `Location` header (topic 8); and a second user asking for that order gets 404, not 403, so they cannot tell it exists (topic 20). Assert the status, headers and JSON fields that matter, but never exact timestamps; they change on every run.",
      "analogy": "A mystery shopper. They walk in through the front door like a real customer, buy something, and judge the whole experience from entrance to receipt, not just one department. If the lobby, the till or the stockroom is broken, they notice.",
      "code": [
        {
          "language": "typescript",
          "filename": "tests/integration/orders.http.test.ts",
          "source": "import { describe, test, expect, beforeAll, afterAll, beforeEach } from \"bun:test\";\nimport { loadConfig } from \"../../src/config\";\nimport { sql } from \"../../src/db\";\nimport { createServer } from \"../../src/server\";\nimport { createProduct, resetDb } from \"../helpers/factories\";\n\nconst config = loadConfig();\n\nlet server: ReturnType<typeof createServer>;\n\nbeforeAll(() => {\n  server = createServer({ sql, config: { ...config, port: 0 } }); // port 0 = any free port\n});\n\nafterAll(async () => {\n  await server.stop(true); // close everything, or the test run would hang\n});\n\nbeforeEach(resetDb);\n\nconst json = { \"Content-Type\": \"application/json\" };\n\nasync function signupAndLogin(email: string): Promise<string> {\n  const credentials = JSON.stringify({ email, password: \"correct-horse-battery\" });\n  await fetch(new URL(\"/auth/signup\", server.url), { method: \"POST\", headers: json, body: credentials });\n  const res = await fetch(new URL(\"/auth/login\", server.url), { method: \"POST\", headers: json, body: credentials });\n  // \"session=<token>; HttpOnly; ...\" -> keep only \"session=<token>\"\n  return (res.headers.get(\"set-cookie\") ?? \"\").split(\";\")[0] ?? \"\";\n}\n\nasync function placeOrder(cookie: string) {\n  return fetch(new URL(\"/orders\", server.url), {\n    method: \"POST\",\n    headers: { ...json, Cookie: cookie },\n    body: JSON.stringify({ items: [{ productId: \"1\", quantity: 1 }] }),\n  });\n}\n\ndescribe(\"orders over HTTP\", () => {\n  test(\"rejects a request without a session cookie\", async () => {\n    const res = await fetch(new URL(\"/orders\", server.url), { method: \"POST\", headers: json, body: \"{}\" });\n    expect(res.status).toBe(401);\n  });\n\n  test(\"signup, login, create and read an order\", async () => {\n    await createProduct({ name: \"Notebook\", priceCents: 2499, stock: 10 }); // gets id \"1\"\n    const cookie = await signupAndLogin(\"asha@example.com\");\n\n    const created = await placeOrder(cookie);\n    expect(created.status).toBe(201);\n    expect(created.headers.get(\"location\")).toBe(\"/orders/1\");\n    expect(await created.json()).toMatchObject({ id: \"1\", totalCents: 2499 });\n\n    const fetched = await fetch(new URL(\"/orders/1\", server.url), { headers: { Cookie: cookie } });\n    expect(fetched.status).toBe(200);\n    expect(await fetched.json()).toMatchObject({ id: \"1\", status: \"pending\" });\n  });\n\n  test(\"another user gets 404 for someone else's order\", async () => {\n    await createProduct({ name: \"Notebook\", priceCents: 2499, stock: 10 });\n    const ashaCookie = await signupAndLogin(\"asha@example.com\");\n    await placeOrder(ashaCookie);\n    const bobCookie = await signupAndLogin(\"bob@example.com\");\n\n    const res = await fetch(new URL(\"/orders/1\", server.url), { headers: { Cookie: bobCookie } });\n    expect(res.status).toBe(404);\n  });\n});\n",
          "output": " 3 pass\n 0 fail",
          "explanation": "The server really listens on a free port and every request goes through routing, validation, auth, the service and PostgreSQL. `product 1` exists because `resetDb` restarts the identity counter and the Notebook is the first product inserted in each test. Run with `bun test tests/integration/orders.http.test.ts`."
        }
      ],
      "productionNote": "End-to-end tests give the most confidence that a deploy will work, because they exercise everything except the network between machines. Keep them few and focused on key user journeys, since they are the slowest tests.",
      "commonMistakes": [
        "Hard-coding a port such as 3000. It collides with a running dev server or a parallel CI job. Use `port: 0` and read `server.url`.",
        "Not stopping the server in `afterAll`. The open server keeps the process alive and `bun test` never finishes.",
        "Asserting exact timestamps or generated tokens in responses. They differ on each run, so the test fails randomly. Check status codes, headers and stable fields instead."
      ],
      "sources": [
        { "title": "Bun docs: HTTP server (Bun.serve)", "url": "https://bun.com/docs/api/http" },
        { "title": "MDN: Using the Fetch API", "url": "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Two separately created order objects have exactly the same properties and values. Which assertion passes when you compare them?",
      "options": [
        "expect(a).toBe(b), because toBe compares all properties deeply",
        "expect(a).toEqual(b), because toEqual compares contents while toBe checks they are the very same object",
        "Neither can pass; objects can never be compared in a test",
        "expect(a).toThrow(b), because both objects are errors"
      ],
      "answerIndex": 1,
      "explanation": "`toEqual` compares contents deeply, so equal-looking objects pass. `toBe` asks whether both sides are the same object, which two separately created objects are not."
    },
    {
      "question": "How does the orders service unit test avoid needing a real database?",
      "options": [
        "The service is created with fake repositories and a fake sql client (made with mock()) passed in as dependencies",
        "Bun automatically replaces PostgreSQL with an in-memory copy during bun test",
        "The test deletes the database before calling the service",
        "The test imports the real repository and hopes the query is never run"
      ],
      "answerIndex": 0,
      "explanation": "Because the service is built by a factory that receives its dependencies, the test passes in fake objects whose methods are mocks that return prepared values. No connection is ever opened."
    },
    {
      "question": "What stops the test suite from wiping your development database?",
      "options": [
        "TRUNCATE refuses to run on any database with data in it",
        "Bun refuses to run tests while a development server is running",
        ".env.test points DATABASE_URL at orders_test, and the setup file throws unless the database name ends in _test",
        "The test files are only allowed to run on Fridays"
      ],
      "answerIndex": 2,
      "explanation": "`bun test` loads `.env.test`, which selects `orders_test`, and the preload setup file adds a guard that throws before any test runs if the name does not end in `_test`, even when the URL was overridden from the terminal."
    },
    {
      "question": "Why does the TRUNCATE between tests include RESTART IDENTITY?",
      "options": [
        "It makes PostgreSQL restart the whole server",
        "It deletes the migration history so migrations run again",
        "It encrypts the rows that were deleted",
        "It resets the id counters so the first row of each test gets id 1, making expected values like \"/orders/1\" predictable"
      ],
      "answerIndex": 3,
      "explanation": "Without it, ids keep counting up across tests, so a test could see order 7 where it expected order 1. Resetting the identity counters gives every test the same starting point."
    },
    {
      "question": "Why does the HTTP test start the server with port: 0?",
      "options": [
        "Port 0 turns the server off so only the handler is tested",
        "The operating system picks any free port, so the test never collides with another program or a parallel CI job; the test reads the address from server.url",
        "Port 0 is the only port that works with fetch",
        "It makes requests faster by skipping the network"
      ],
      "answerIndex": 1,
      "explanation": "A fixed port can already be in use. With port 0 the operating system chooses a free one, and `server.url` tells the test where to send requests."
    }
  ]
});
