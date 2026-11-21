window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "18-layered-architecture",
  "order": 18,
  "title": "Layered Architecture",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Split a backend feature into three layers: routes talk HTTP, services hold business rules, repositories run SQL. You will define separate input, stored and output types, pass dependencies in through factory functions (functions that build and return objects), and build the whole orders feature (create, read, list, cancel) on that pattern.",
  "prerequisites": ["17-indexes-performance"],
  "subtopics": [
    {
      "id": "routes-services-repositories",
      "title": "Routes, services and repositories",
      "explanation": "So far each topic put its code wherever was convenient. A real backend grows to dozens of endpoints, and without a structure the HTTP parsing, the business rules and the SQL end up tangled in one function. The fix is to give every piece of code exactly one job. We use three layers (a layer is a group of files with one responsibility).\n\nThe route layer (src/routes) speaks HTTP. It reads the path parameters, query string and JSON body out of the request, calls exactly one service method, and turns the result into a Response with the right status code. It contains no SQL and no business rules.\n\nThe service layer (src/services) holds the business rules: is there enough stock, what is the order total, which status changes are allowed. It also decides where transactions start and end. A service never sees a Request or a Response, so it does not know it is being used over HTTP.\n\nThe repository layer (src/repositories) holds the SQL. Each method runs one query and converts the database rows into the shapes the rest of the program uses. A repository makes no decisions about the business and never produces HTTP errors.\n\nThe dependency rule is one-way: routes call services, services call repositories, repositories call the database (`db`). A lower layer never imports a higher one. This is the layer dependency rule from the folder-structure topic, now with real code behind it.\n\nOne rule we will use: a user may only change an order from `pending` to `cancelled`. That rule belongs in the service. The route only reports the outcome (as 409 Conflict, the status for a request that clashes with the current state), and the repository only runs the update the service asks for.\n\nThe payoff: you can test the service with a fake repository and no database (topic 22), you can change SQL without touching HTTP code, and each file is short enough to read in one go.",
      "analogy": "A restaurant again. The waiter (route) takes the order from the customer and carries the plate back, but never cooks. The chef (service) decides how the dish is made and whether it can be made at all, but never talks to customers. The pantry (repository) hands over and stores ingredients, but never decides the menu. Each person has a job contract, and breaking it (a waiter cooking, a pantry deciding the menu) is what makes a kitchen chaotic.",
      "code": [
        {
          "language": "text",
          "filename": "who-does-what.txt",
          "source": "POST /orders  (body: items with productId and quantity, header: X-User-Id)\n\nLayer        File                       Does                                            Must NOT do\n-----------  -------------------------  ----------------------------------------------  ----------------------\nRoute        src/routes/orders.ts       read JSON body and userId                        SQL, stock checks,\n                                        call ordersService.placeOrder(userId, input)     totals\n                                        return 201 + Location, or an error response\n\nService      src/services/orders.ts     start a transaction                              touch Request/Response\n                                        take stock for each product\n                                        compute the total from product prices\n\nRepository   src/repositories/*.ts      UPDATE products (take stock)                     decide rules,\n                                        INSERT order, INSERT order items                 build HTTP responses\n                                        map snake_case rows to camelCase objects\n\nDatabase     PostgreSQL                 store rows, enforce constraints                  -",
          "output": "",
          "explanation": "This is a plain-text table, not code to run. It traces one request, POST /orders, through the layers. Notice that every row has a column of things it must not do: the discipline is as much about what a layer leaves out as what it contains."
        }
      ],
      "productionNote": "Every feature in a production backend follows this same shape (users, products, orders, payments). New teammates can predict where code lives, reviewers can spot a rule that landed in the wrong layer, and tests stay fast because the service layer needs no HTTP server and no real database.",
      "commonMistakes": [
        "Putting business rules in the route handler, for example checking the order status inside the route. The rule then gets duplicated when a second entry point (a background job or a command-line tool) needs it.",
        "Having a repository throw an HTTP error or return a Response. Repositories do not know about HTTP; return data (or null) and let the route choose the status code.",
        "Letting a service accept a Request object. Then the service cannot be tested or reused without building fake HTTP requests."
      ],
      "sources": [
        { "title": "Bun docs: HTTP routing", "url": "https://bun.com/docs/runtime/http/routing" },
        { "title": "Martin Fowler: Repository", "url": "https://martinfowler.com/eaaCatalog/repository.html" },
        { "title": "Martin Fowler: Service Layer", "url": "https://martinfowler.com/eaaCatalog/serviceLayer.html" }
      ]
    },
    {
      "id": "data-transfer-types",
      "title": "Data transfer types: input, stored and output",
      "explanation": "One entity (here, an order) needs three different shapes, and mixing them up causes security bugs. Put them in src/types/order.ts.\n\nInput type: what a client is allowed to send. `CreateOrderInput` has only a list of items, each with a productId and a quantity. It never contains an id, a status or a total, because the server decides those.\n\nStored type: what the database returns. `OrderRow` uses snake_case column names (user_id, total_cents) and database-style values such as a `Date` object for created_at. It is private to the repository layer.\n\nOutput type: what the API returns. `Order` uses camelCase, ids as strings and dates as ISO strings. `OrderDetail` is an `Order` plus its items. The `&` in a type means intersection: `Order & { items: OrderItem[] }` is a type that has everything in `Order` and also an `items` property.\n\nA mapper is a small function that converts one shape to another, for example `toOrder(row: OrderRow): Order`. Mappers live in the repository, so rows never leave that layer. Output types also never include secrets: a user object returned by the API must not contain `password_hash`.\n\nTotals are always computed on the server from the product prices in the database. If you accepted `totalCents` from the client, anyone could buy a laptop for 1 cent.\n\nThe example below defines the types (in your project the `export type` lines go into src/types/order.ts) and a mapper, then runs it. It is a single file so you can run it with `bun run order-types-demo.ts`.",
      "analogy": "A passport. The application form (input) has only the fields you may fill in. The government record (stored) has many more fields, in the government's own format, including internal ones. The printed passport (output) shows a chosen subset in a readable layout. You never get to write the 'approved' stamp on the application form yourself.",
      "code": [
        {
          "language": "typescript",
          "filename": "order-types-demo.ts",
          "source": "export type OrderStatus = \"pending\" | \"paid\" | \"shipped\" | \"cancelled\";\n\n// Input: what the client may send. No id, status or total.\nexport type CreateOrderInput = { items: { productId: string; quantity: number }[] };\n\n// Stored: database shape, snake_case. Private to repositories.\nexport type OrderRow = {\n  id: string;\n  user_id: string;\n  status: OrderStatus;\n  total_cents: number;\n  created_at: Date;\n};\nexport type OrderItemRow = {\n  product_id: string;\n  name: string;\n  quantity: number;\n  unit_price_cents: number;\n};\n\n// Output: API shape, camelCase, date as ISO string.\nexport type OrderItem = { productId: string; name: string; quantity: number; unitPriceCents: number };\nexport type Order = {\n  id: string;\n  userId: string;\n  status: OrderStatus;\n  totalCents: number;\n  createdAt: string;\n};\n// & combines types: OrderDetail has all Order fields plus items.\nexport type OrderDetail = Order & { items: OrderItem[] };\n\n// Mapper: stored -> output.\nfunction toOrder(row: OrderRow): Order {\n  return {\n    id: row.id,\n    userId: row.user_id,\n    status: row.status,\n    totalCents: row.total_cents,\n    createdAt: row.created_at.toISOString(),\n  };\n}\n\nconst row: OrderRow = {\n  id: \"1\",\n  user_id: \"1\",\n  status: \"paid\",\n  total_cents: 4998,\n  created_at: new Date(\"2026-11-01T10:00:00Z\"),\n};\n\nconsole.log(JSON.stringify(toOrder(row)));\n\nconst detail: OrderDetail = {\n  ...toOrder(row),\n  items: [{ productId: \"1\", name: \"Notebook\", quantity: 1, unitPriceCents: 2499 }],\n};\nconsole.log(detail.items.length);",
          "output": "{\"id\":\"1\",\"userId\":\"1\",\"status\":\"paid\",\"totalCents\":4998,\"createdAt\":\"2026-11-01T10:00:00.000Z\"}\n1",
          "explanation": "The mapper renames user_id to userId and total_cents to totalCents and turns the Date into an ISO string with toISOString(). JSON.stringify prints the object on one line. The second part builds an OrderDetail by spreading (copying) the mapped order and adding an items array; TypeScript checks that the result has every field of both parts."
        }
      ],
      "productionNote": "Separate input, stored and output types prevent mass assignment (a client sneaking in fields like status or totalCents that you never meant it to control) and accidental data leaks (returning password_hash or internal columns). They also let you rename database columns without breaking the public API, because only the mapper changes.",
      "commonMistakes": [
        "Returning database rows straight to the client. You leak snake_case names, internal columns and raw Date values, and every schema change becomes an API change.",
        "Trusting a client-sent totalCents or unitPriceCents. Always read prices from the products table and compute the total on the server.",
        "Reusing one big type for input, stored and output. Optional fields then creep in, and nobody knows which fields the client may set."
      ],
      "sources": [
        { "title": "TypeScript Handbook: Intersection types", "url": "https://www.typescriptlang.org/docs/handbook/2/objects.html#intersection-types" },
        { "title": "OWASP Mass Assignment Cheat Sheet", "url": "https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html" }
      ]
    },
    {
      "id": "passing-dependencies",
      "title": "Passing dependencies into layers",
      "explanation": "A dependency is anything a piece of code needs from outside itself, such as the database client or the config. Dependency injection is a plain idea: instead of a file importing the database from a global module, the code receives it as an argument. Nothing more.\n\nA factory function is a function that builds and returns something, here an object of functions. For example `createOrdersService({ sql, ordersRepo, productsRepo })` returns an object with methods like `placeOrder`. The methods use `deps` even after the factory has returned, because of a closure: an inner function remembers the variables of the outer function that created it.\n\nRepository methods take `db: SQL` as their first parameter (the `SQL` type is the Bun database client class). That way the same method works with the normal `sql` client or with the `tx` object inside a transaction, as in the transactions topic.\n\nThe wiring happens in one place, the composition root: the single spot that creates every repository, service and route set and connects them. In our project that is `createServer(deps)` in src/server.ts. No classes are needed.\n\nFirst a small runnable demo of the idea. The service receives its repository as an argument, so we can hand it a fake one that needs no database.",
      "analogy": "A chef who has ingredients delivered to the station (injected) versus a chef who must drive to one fixed supplier (global import). With delivery, swapping suppliers for a tasting (a test) is trivial: just deliver different ingredients. With the fixed supplier you must rebuild the kitchen.",
      "code": [
        {
          "language": "typescript",
          "filename": "di-demo.ts",
          "source": "type Product = { id: string; name: string; priceCents: number };\ntype ProductsRepo = { findById(id: string): Promise<Product | null> };\n\n// Factory function: receives its dependencies, returns an object of functions.\nfunction createPriceService(deps: { productsRepo: ProductsRepo }) {\n  // priceOf is a closure: it keeps using deps after createPriceService returns.\n  async function priceOf(id: string, quantity: number): Promise<number> {\n    const product = await deps.productsRepo.findById(id);\n    if (product === null) throw new Error(`product ${id} not found`);\n    return product.priceCents * quantity;\n  }\n  return { priceOf };\n}\n\n// A fake repository: no database involved.\nconst fakeRepo: ProductsRepo = {\n  async findById(id) {\n    return id === \"2\" ? { id: \"2\", name: \"Pen\", priceCents: 199 } : null;\n  },\n};\n\nasync function main() {\n  const service = createPriceService({ productsRepo: fakeRepo });\n  console.log(await service.priceOf(\"2\", 2));\n  try {\n    await service.priceOf(\"9\", 1);\n  } catch (err) {\n    console.log(err instanceof Error ? err.message : \"unknown error\");\n  }\n}\n\nmain();",
          "output": "398\nproduct 9 not found",
          "explanation": "createPriceService never imports a database. It only says what it needs (a ProductsRepo) and the caller supplies it. Here the caller supplies a fake, so the service logic runs with no PostgreSQL at all. In production the caller supplies the real repository, and the service code does not change."
        },
        {
          "language": "typescript",
          "filename": "src/server.ts",
          "source": "import type { SQL } from \"bun\";\nimport type { Config } from \"./config\";\nimport { errorResponse } from \"./http\";\nimport { createOrdersRepo } from \"./repositories/orders\";\nimport { createProductsRepo } from \"./repositories/products\";\nimport { createOrdersService } from \"./services/orders\";\nimport { createOrdersRoutes } from \"./routes/orders\";\n\n// Composition root: the one place where everything is created and connected.\nexport function createServer(deps: { config: Config; sql: SQL }) {\n  const ordersRepo = createOrdersRepo();\n  const productsRepo = createProductsRepo();\n  const ordersService = createOrdersService({ sql: deps.sql, ordersRepo, productsRepo });\n\n  return Bun.serve({\n    port: deps.config.port,\n    routes: { ...createOrdersRoutes({ ordersService }) },\n    fetch: () => errorResponse(404, \"NOT_FOUND\", \"route not found\"),\n    error: () => errorResponse(500, \"INTERNAL\", \"internal server error\"),\n  });\n}",
          "output": "",
          "explanation": "This is the composition root. Config and sql come in through deps; the repositories, the service and the routes are built from them, in dependency order. It prints nothing and is not runnable on its own: it imports the repository, service and routes files that the next sub-topic writes. A test can call createServer with port 0 and a test database. The `...` (spread) copies the route entries into the routes object."
        }
      ],
      "productionNote": "Passing dependencies in lets you start several servers with different configs (a test server on port 0 with a test database next to the real one) and lets tests replace the database layer with fakes. Keep the wiring in one place so it is obvious what depends on what.",
      "commonMistakes": [
        "Importing the global `sql` in every file. Hidden module-level shared objects (singletons, one copy for the whole program) make tests need a real database and make it unclear what a function depends on.",
        "Passing one giant bag of dependencies to every function. Each factory should receive only what it uses; a repository needs only the `db` argument.",
        "Creating the repositories or services inside a route handler, so they are rebuilt on every request. Build them once in the composition root."
      ],
      "sources": [
        { "title": "MDN: Closures", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures" },
        { "title": "Bun docs: HTTP server", "url": "https://bun.com/docs/api/http" }
      ]
    },
    {
      "id": "orders-feature-end-to-end",
      "title": "Building the orders feature end to end",
      "explanation": "Now we put the pattern to work. The feature has four endpoints: POST /orders, GET /orders/:id, GET /orders (list with keyset pagination) and PATCH /orders/:id/cancel.\n\nThe code assumes the course schema: products(id, name, price_cents, stock), orders(id, user_id, status, total_cents, created_at) and order_items(order_id, product_id, quantity, unit_price_cents). It also uses the types from the previous sub-topic, imported from src/types/order.ts.\n\nPlacing an order works in one transaction. For each product the service runs one atomic conditional UPDATE that subtracts the stock only if enough remains and returns the product's name and price (the atomic update pattern from the concurrency topic). It then computes the total, inserts the order, and bulk inserts the items with `db(rows)`. If any product cannot supply the quantity, the service throws inside `sql.begin`, which rolls everything back, so no stock is lost.\n\nThe service sorts the items by productId first. Every order then locks products in the same order, so two orders for the same products can never wait on each other in a circle (a deadlock). Which order you use does not matter, only that it is always the same.\n\nCancelling is the status rule from the first sub-topic. The service asks the repository to change the status from `pending` to `cancelled` in one UPDATE with `WHERE status = 'pending'`. If no row changes, the service runs a follow-up SELECT to find out why: no such order for this user means not found (404), an existing order means it is not pending (409). When the update works, the service puts the stock back (restock) in the same transaction.\n\nTwo temporary choices to be aware of. The user comes from an `X-User-Id` request header. This is an INSECURE placeholder: anyone can send any id. Real authentication replaces it in the auth topic. Also, bodies are not validated yet (the validation topic does that), and the service reports failures as plain results instead of the AppError types of the next topic.\n\nStart with the repositories. They take `db` first and only run SQL and map rows.",
      "analogy": "Follow one parcel. It is handed over at the shop counter (route), the warehouse clerk checks the shelf and prices it (service), a picker takes items off shelves and writes the ledger (repositories), and a receipt comes back to the counter and out to the customer. If the clerk finds a shelf empty, the whole parcel goes back untouched (rollback).",
      "code": [
        {
          "language": "typescript",
          "filename": "src/repositories/orders.ts",
          "source": "import type { SQL } from \"bun\";\nimport type { Order, OrderItem, OrderItemRow, OrderRow, OrderStatus } from \"../types/order\";\n\nfunction toOrder(row: OrderRow): Order {\n  return {\n    id: row.id,\n    userId: row.user_id,\n    status: row.status,\n    totalCents: row.total_cents,\n    createdAt: row.created_at.toISOString(),\n  };\n}\n\nfunction toOrderItem(row: OrderItemRow): OrderItem {\n  return {\n    productId: row.product_id,\n    name: row.name,\n    quantity: row.quantity,\n    unitPriceCents: row.unit_price_cents,\n  };\n}\n\nfunction firstOrder(rows: OrderRow[]): Order | null {\n  const row = rows[0];\n  return row === undefined ? null : toOrder(row);\n}\n\nexport function createOrdersRepo() {\n  return {\n    async insertOrder(db: SQL, userId: string, totalCents: number): Promise<Order> {\n      const rows: OrderRow[] = await db`\n        INSERT INTO orders (user_id, status, total_cents)\n        VALUES (${userId}, 'pending', ${totalCents})\n        RETURNING id, user_id, status, total_cents, created_at`;\n      const order = firstOrder(rows);\n      if (order === null) throw new Error(\"insert returned no row\");\n      return order;\n    },\n\n    async insertItems(db: SQL, orderId: string, items: OrderItem[]): Promise<void> {\n      const rows = items.map((item) => ({\n        order_id: orderId,\n        product_id: item.productId,\n        quantity: item.quantity,\n        unit_price_cents: item.unitPriceCents,\n      }));\n      await db`INSERT INTO order_items ${db(rows)}`;\n    },\n\n    async findOrder(db: SQL, userId: string, id: string): Promise<Order | null> {\n      const rows: OrderRow[] = await db`\n        SELECT id, user_id, status, total_cents, created_at\n        FROM orders WHERE id = ${id} AND user_id = ${userId}`;\n      return firstOrder(rows);\n    },\n\n    // One JOIN query for all item names: no N+1.\n    async findItems(db: SQL, orderId: string): Promise<OrderItem[]> {\n      const rows: OrderItemRow[] = await db`\n        SELECT oi.product_id, p.name, oi.quantity, oi.unit_price_cents\n        FROM order_items oi\n        JOIN products p ON p.id = oi.product_id\n        WHERE oi.order_id = ${orderId}\n        ORDER BY oi.product_id`;\n      return rows.map(toOrderItem);\n    },\n\n    // Keyset pagination on id: newest first, rows after the cursor.\n    async list(db: SQL, userId: string, limit: number, cursor: string | null): Promise<Order[]> {\n      const after = cursor === null ? db`` : db`AND id < ${cursor}`;\n      const rows: OrderRow[] = await db`\n        SELECT id, user_id, status, total_cents, created_at\n        FROM orders WHERE user_id = ${userId} ${after}\n        ORDER BY id DESC LIMIT ${limit}`;\n      return rows.map(toOrder);\n    },\n\n    // Changes status only if it currently equals `from`. null = no row changed.\n    async updateStatus(\n      db: SQL, userId: string, id: string, from: OrderStatus, to: OrderStatus,\n    ): Promise<Order | null> {\n      const rows: OrderRow[] = await db`\n        UPDATE orders SET status = ${to}\n        WHERE id = ${id} AND user_id = ${userId} AND status = ${from}\n        RETURNING id, user_id, status, total_cents, created_at`;\n      return firstOrder(rows);\n    },\n  };\n}",
          "output": "",
          "explanation": "Every method takes db first, so it works inside a transaction. The mappers toOrder and toOrderItem stay private to this file. Because noUncheckedIndexedAccess is on, rows[0] may be undefined, which firstOrder handles. list uses a SQL fragment for the optional cursor condition. The repository asks no business questions: updateStatus just does what it is told and returns null when nothing matched."
        },
        {
          "language": "typescript",
          "filename": "src/repositories/products.ts",
          "source": "import type { SQL } from \"bun\";\n\nexport function createProductsRepo() {\n  return {\n    // Atomic: subtracts stock only if enough remains. null = unknown product or not enough stock.\n    async takeStock(\n      db: SQL, productId: string, quantity: number,\n    ): Promise<{ name: string; priceCents: number } | null> {\n      const rows: { name: string; price_cents: number }[] = await db`\n        UPDATE products SET stock = stock - ${quantity}\n        WHERE id = ${productId} AND stock >= ${quantity}\n        RETURNING name, price_cents`;\n      const row = rows[0];\n      return row === undefined ? null : { name: row.name, priceCents: row.price_cents };\n    },\n\n    async restock(db: SQL, productId: string, quantity: number): Promise<void> {\n      await db`UPDATE products SET stock = stock + ${quantity} WHERE id = ${productId}`;\n    },\n  };\n}",
          "output": "",
          "explanation": "takeStock combines the check and the decrement in one statement, so two simultaneous orders cannot both take the last item. The UPDATE also locks the row until the surrounding transaction ends, which is why the lock order matters. The price comes from the database row, never from the client."
        },
        {
          "language": "typescript",
          "filename": "src/services/orders.ts",
          "source": "import type { SQL } from \"bun\";\nimport type { CreateOrderInput, Order, OrderDetail, OrderItem } from \"../types/order\";\nimport type { createOrdersRepo } from \"../repositories/orders\";\nimport type { createProductsRepo } from \"../repositories/products\";\n\nexport type PlaceOrderResult = { ok: true; order: OrderDetail } | { ok: false; reason: \"unavailable\" };\nexport type CancelResult =\n  | { ok: true; order: OrderDetail }\n  | { ok: false; reason: \"not_found\" | \"not_pending\" };\n\n// Thrown inside the transaction so that sql.begin rolls everything back.\nclass StockUnavailable extends Error {}\n\nexport function createOrdersService(deps: {\n  sql: SQL;\n  ordersRepo: ReturnType<typeof createOrdersRepo>;\n  productsRepo: ReturnType<typeof createProductsRepo>;\n}) {\n  const { sql, ordersRepo, productsRepo } = deps;\n\n  async function placeOrder(userId: string, input: CreateOrderInput): Promise<PlaceOrderResult> {\n    // Always lock products in the same order to avoid deadlocks.\n    const items = [...input.items].sort((a, b) => a.productId.localeCompare(b.productId));\n    try {\n      const order = await sql.begin(async (tx): Promise<OrderDetail> => {\n        const lines: OrderItem[] = [];\n        for (const item of items) {\n          const product = await productsRepo.takeStock(tx, item.productId, item.quantity);\n          if (product === null) throw new StockUnavailable(`product ${item.productId} unavailable`);\n          lines.push({\n            productId: item.productId,\n            name: product.name,\n            quantity: item.quantity,\n            unitPriceCents: product.priceCents,\n          });\n        }\n        const totalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);\n        const created = await ordersRepo.insertOrder(tx, userId, totalCents);\n        await ordersRepo.insertItems(tx, created.id, lines);\n        return { ...created, items: lines };\n      });\n      return { ok: true, order };\n    } catch (err) {\n      if (err instanceof StockUnavailable) return { ok: false, reason: \"unavailable\" };\n      throw err;\n    }\n  }\n\n  async function getOrder(userId: string, id: string): Promise<OrderDetail | null> {\n    const order = await ordersRepo.findOrder(sql, userId, id);\n    if (order === null) return null;\n    const items = await ordersRepo.findItems(sql, id);\n    return { ...order, items };\n  }\n\n  // Fetch limit + 1 rows: the extra row tells us whether another page exists.\n  async function listOrders(\n    userId: string, limit: number, cursor: string | null,\n  ): Promise<{ items: Order[]; nextCursor: string | null }> {\n    const rows = await ordersRepo.list(sql, userId, limit + 1, cursor);\n    const items = rows.slice(0, limit); // slice copies the first `limit` elements\n    const last = items[items.length - 1];\n    const nextCursor = rows.length > limit && last !== undefined ? last.id : null;\n    return { items, nextCursor };\n  }\n\n  // Business rule: users may only cancel a pending order.\n  async function cancelOrder(userId: string, id: string): Promise<CancelResult> {\n    return sql.begin(async (tx): Promise<CancelResult> => {\n      const cancelled = await ordersRepo.updateStatus(tx, userId, id, \"pending\", \"cancelled\");\n      if (cancelled === null) {\n        const existing = await ordersRepo.findOrder(tx, userId, id);\n        return { ok: false, reason: existing === null ? \"not_found\" : \"not_pending\" };\n      }\n      const items = await ordersRepo.findItems(tx, id);\n      for (const item of items) {\n        await productsRepo.restock(tx, item.productId, item.quantity);\n      }\n      return { ok: true, order: { ...cancelled, items } };\n    });\n  }\n\n  return { placeOrder, getOrder, listOrders, cancelOrder };\n}\n\nexport type OrdersService = ReturnType<typeof createOrdersService>;",
          "output": "",
          "explanation": "`ReturnType<typeof createOrdersRepo>` means 'whatever type createOrdersRepo returns'. `localeCompare` compares two strings in alphabetical order, returning a negative number, zero or a positive number. This file has the rules and the transactions, and no Request, Response or SQL text. placeOrder sorts the items, takes stock inside sql.begin, computes the total from the prices it got back, and inserts. Throwing StockUnavailable makes sql.begin roll back and reject, and the service converts that into a plain result for the route. cancelOrder passes the allowed transition (pending to cancelled) to the repository, then tells apart not found and not pending with a follow-up SELECT, and restocks in the same transaction. A later topic replaces these result objects with AppError types."
        },
        {
          "language": "typescript",
          "filename": "src/routes/orders.ts",
          "source": "import type { BunRequest } from \"bun\";\nimport { errorResponse } from \"../http\";\nimport type { OrdersService } from \"../services/orders\";\nimport type { CreateOrderInput } from \"../types/order\";\n\n// INSECURE placeholder: trusts whatever the client sends. Replaced by real auth later.\nfunction currentUserId(req: Request): string | null {\n  return req.headers.get(\"X-User-Id\");\n}\n\nconst unauthorized = () => errorResponse(401, \"UNAUTHORIZED\", \"missing X-User-Id header\");\n\nexport function createOrdersRoutes(deps: { ordersService: OrdersService }) {\n  const { ordersService } = deps;\n\n  return {\n    \"/orders\": {\n      POST: async (req: Request) => {\n        const userId = currentUserId(req);\n        if (userId === null) return unauthorized();\n        const input = (await req.json()) as CreateOrderInput; // unchecked until the validation topic\n        const result = await ordersService.placeOrder(userId, input);\n        if (!result.ok) {\n          return errorResponse(409, \"CONFLICT\", \"a product is unavailable or out of stock\");\n        }\n        return Response.json(result.order, {\n          status: 201,\n          headers: { Location: `/orders/${result.order.id}` },\n        });\n      },\n\n      GET: async (req: Request) => {\n        const userId = currentUserId(req);\n        if (userId === null) return unauthorized();\n        const url = new URL(req.url);\n        const rawLimit = Number(url.searchParams.get(\"limit\") ?? \"20\");\n        // Math.max / Math.min keep the limit between 1 and 100.\n        const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;\n        const cursor = url.searchParams.get(\"cursor\");\n        return Response.json(await ordersService.listOrders(userId, limit, cursor));\n      },\n    },\n\n    \"/orders/:id\": {\n      GET: async (req: BunRequest<\"/orders/:id\">) => {\n        const userId = currentUserId(req);\n        if (userId === null) return unauthorized();\n        const order = await ordersService.getOrder(userId, req.params.id);\n        if (order === null) return errorResponse(404, \"NOT_FOUND\", \"order not found\");\n        return Response.json(order);\n      },\n    },\n\n    \"/orders/:id/cancel\": {\n      PATCH: async (req: BunRequest<\"/orders/:id/cancel\">) => {\n        const userId = currentUserId(req);\n        if (userId === null) return unauthorized();\n        const result = await ordersService.cancelOrder(userId, req.params.id);\n        if (result.ok) return Response.json(result.order);\n        if (result.reason === \"not_found\") return errorResponse(404, \"NOT_FOUND\", \"order not found\");\n        return errorResponse(409, \"CONFLICT\", \"only pending orders can be cancelled\");\n      },\n    },\n  };\n}",
          "output": "",
          "explanation": "The routes only translate. Each handler reads the user, params, query or body, calls one service method and maps the outcome to a status code: 201 with a Location header for a new order, 404 for a missing one, 409 when the state forbids the action. The `as CreateOrderInput` is a type assertion (telling TypeScript to trust you), which is unsafe on untrusted input; the validation topic replaces it. The cursor is a plain order id here; you can wrap it in the opaque base64url form from the indexes topic."
        },
        {
          "language": "bash",
          "filename": "orders-session.sh",
          "source": "# Start the server first with your entry point (it calls createServer), then in a bash-style terminal:\ncurl -i -X POST http://localhost:3000/orders -H \"Content-Type: application/json\" -H \"X-User-Id: 3\" -d '{\"items\":[{\"productId\":\"2\",\"quantity\":2},{\"productId\":\"1\",\"quantity\":1}]}'\n\ncurl -X PATCH http://localhost:3000/orders/4/cancel -H \"X-User-Id: 3\"\n\ncurl -X PATCH http://localhost:3000/orders/4/cancel -H \"X-User-Id: 3\"",
          "output": "HTTP/1.1 201 Created\nLocation: /orders/4\n(other headers omitted)\n\n{\"id\":\"4\",\"userId\":\"3\",\"status\":\"pending\",\"totalCents\":2897,\"createdAt\":\"<ISO time>\",\"items\":[{\"productId\":\"1\",\"name\":\"Notebook\",\"quantity\":1,\"unitPriceCents\":2499},{\"productId\":\"2\",\"name\":\"Pen\",\"quantity\":2,\"unitPriceCents\":199}]}\n{\"id\":\"4\",\"userId\":\"3\",\"status\":\"cancelled\",\"totalCents\":2897,\"createdAt\":\"<ISO time>\",\"items\":[{\"productId\":\"1\",\"name\":\"Notebook\",\"quantity\":1,\"unitPriceCents\":2499},{\"productId\":\"2\",\"name\":\"Pen\",\"quantity\":2,\"unitPriceCents\":199}]}\n{\"error\":{\"code\":\"CONFLICT\",\"message\":\"only pending orders can be cancelled\"}}",
          "explanation": "This assumes the seeded dataset from the earlier topics (Notebook is product 1 at 2499 cents, Pen is product 2 at 199 cents, user 3 exists, three orders already exist and enough stock is left). The total is 2499 + 2 x 199 = 2897 cents, computed by the server. The items come back sorted by productId. The first cancel succeeds and restocks; the second finds the order no longer pending and returns 409. In Windows PowerShell write curl.exe instead of curl and put the JSON in a file passed as -d @body.json, because PowerShell mangles the quotes."
        }
      ],
      "productionNote": "Treat this feature as the template for every new one: types first, then repository methods taking db, then a service factory with the rules and transactions, then routes that only translate, then one line in the composition root. Stock changes and order inserts always share one transaction, so a crash can never leave stock taken without an order.",
      "commonMistakes": [
        "Decrementing stock outside the transaction. If the order insert then fails, the stock is gone for good. Do all the writes inside one sql.begin.",
        "Forgetting to restock when an order is cancelled, so cancelled orders slowly drain the inventory.",
        "Loading item names with one query per item (the N+1 problem). Use one JOIN, as findItems does.",
        "Locking products in the order the client sent them. Two orders listing the same products in opposite order can deadlock; sort first.",
        "Treating the X-User-Id header as real authentication. It is a placeholder for development only."
      ],
      "sources": [
        { "title": "Bun docs: SQL", "url": "https://bun.com/docs/api/sql" },
        { "title": "PostgreSQL 19 docs: Explicit locking (deadlocks)", "url": "https://www.postgresql.org/docs/19/explicit-locking.html#LOCKING-DEADLOCKS" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Where should the rule \"only pending orders can be cancelled\" live?",
      "options": [
        "In the route handler, because it returns the 409 response",
        "In the service, which decides the allowed status change; the route only reports the outcome",
        "In the CreateOrderInput type",
        "In the mapper that converts rows to API objects"
      ],
      "answerIndex": 1,
      "explanation": "Business rules belong to the service layer. The route turns the result into 409, and the repository just runs the update it is asked to run."
    },
    {
      "question": "Why must CreateOrderInput not contain totalCents?",
      "options": [
        "The client could choose its own price; the server must compute totals from the product prices in the database",
        "JSON cannot carry numbers",
        "TypeScript does not allow number fields in input types",
        "PostgreSQL cannot store totals as integers"
      ],
      "answerIndex": 0,
      "explanation": "Anything the client controls can be forged. Prices and totals are decided on the server, which prevents mass assignment and price tampering."
    },
    {
      "question": "How does a test give the orders service a fake repository?",
      "options": [
        "By editing the real database before the test",
        "By importing the fake in the route file so it replaces the real one globally",
        "By passing the fake object as an argument to the factory function, for example createOrdersService({ sql, ordersRepo: fake, productsRepo })",
        "By sending a special HTTP header with the test request"
      ],
      "answerIndex": 2,
      "explanation": "The service receives its dependencies as arguments, so a test simply hands it different ones. No global import has to be replaced."
    },
    {
      "question": "What is the total for 1 Notebook (2499 cents) and 2 Pens (199 cents each)?",
      "options": [
        "2499",
        "2698",
        "4998",
        "2897"
      ],
      "answerIndex": 3,
      "explanation": "2499 + 2 x 199 = 2897 cents. The server computes it from the product prices inside the transaction."
    },
    {
      "question": "Why does placeOrder sort the items by productId before taking stock?",
      "options": [
        "PostgreSQL refuses UPDATE statements that are not sorted",
        "So every order locks products in the same order and two orders cannot wait on each other in a circle (deadlock)",
        "To make the total come out correct",
        "To make the response JSON shorter"
      ],
      "answerIndex": 1,
      "explanation": "Each stock UPDATE locks its product row until the transaction ends. If all transactions lock rows in one consistent order, a cycle of waiting cannot form."
    }
  ]
});
