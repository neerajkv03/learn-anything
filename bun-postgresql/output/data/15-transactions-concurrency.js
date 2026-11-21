window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "15-transactions-concurrency",
  "order": 15,
  "title": "Transactions & Concurrency",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "A transaction groups several SQL statements so they all succeed or all disappear. You will use BEGIN, COMMIT and ROLLBACK in psql, then `sql.begin` and savepoints in Bun. Finally you will see how two requests running at the same time can corrupt data (a race condition), and how row locks (a lock on one table row, held until the transaction ends) and isolation levels prevent it.",
  "prerequisites": ["14-migrations"],
  "subtopics": [
    {
      "id": "acid-why-transactions",
      "title": "ACID and why transactions matter",
      "explanation": "A transaction is a group of SQL statements that the database treats as one unit: either every statement takes effect, or none does. Placing an order is a good example. You insert the order row, insert its line items, decrease the product stock and store the total. If the stock update fails after the order row was inserted, you would be left with an order that was never paid for and never reserved any stock. Those four steps must be one transaction.\n\nDatabases promise four guarantees for transactions, summarised as ACID. Atomicity: all statements succeed or none do. Consistency: the rules you declared (constraints such as NOT NULL, CHECK and foreign keys) hold after every committed transaction. Isolation: transactions running at the same time do not see each other's half-finished work. Durability: once a transaction is committed (permanently saved), it survives a crash or power loss.\n\nYou are already using transactions without knowing it. In PostgreSQL every single statement that is not inside an explicit transaction runs in its own tiny transaction that commits automatically. This is called autocommit. The problem only appears when you run several related statements as separate queries: each one commits on its own, so a failure in the third leaves the first two permanently saved.\n\nThe script below places an order for 10 Backpacks (product 3) when only 5 are in stock. It assumes the `products` table has a CHECK constraint `stock >= 0`, which you added in the constraints topic, and that `orders` currently holds 3 rows. The `sql.begin(async tx => ...)` part is explained fully in the Bun sub-topic that follows; for now read it as \"run everything in this function as one transaction\". The `count(*)::int` cast turns the bigint count into a normal number. The `!` after a value such as `row!` tells TypeScript the value cannot be undefined; the next sub-topic explains it fully. Save the file as `scripts/acid-demo.ts` and run it with `bun run scripts/acid-demo.ts`.\n\nWithout the transaction, the INSERT would already be saved when the UPDATE fails, and `orders` would hold a 4th, orphan row (a row that points at nothing useful). With the transaction, the failed UPDATE cancels the INSERT too, so the count stays at 3. One side note: a cancelled INSERT still uses up an identity number, so the next real order may get id 5 instead of 4. Identity numbers are never handed back.",
      "analogy": "A bank transfer. Taking 50 pounds from one account and adding 50 pounds to another must both happen or neither. If the bank crashed between the two steps, money would vanish. A transaction is the bank's promise that the two steps are one indivisible action.",
      "code": [
        {
          "language": "typescript",
          "filename": "scripts/acid-demo.ts",
          "source": "import { SQL } from \"bun\";\nimport { sql } from \"../src/db\";\n\nasync function countOrders(): Promise<number> {\n  const [row]: { n: number }[] = await sql`SELECT count(*)::int AS n FROM orders`;\n  return row!.n;\n}\n\nconsole.log(\"orders before:\", await countOrders());\n\ntry {\n  await sql.begin(async tx => {\n    await tx`INSERT INTO orders (user_id, status, total_cents) VALUES ('3', 'pending', 49990)`;\n    // Only 5 in stock: stock would become -5 and violate CHECK (stock >= 0).\n    await tx`UPDATE products SET stock = stock - 10 WHERE id = 3`;\n  });\n} catch (err) {\n  if (err instanceof SQL.PostgresError) {\n    console.log(\"failed with SQLSTATE\", err.errno);\n  }\n}\n\nconsole.log(\"orders after:\", await countOrders());\nawait sql.close();",
          "output": "orders before: 3\nfailed with SQLSTATE 23514\norders after: 3",
          "explanation": "The INSERT succeeded inside the transaction, but the UPDATE broke the CHECK constraint (SQLSTATE 23514). Because the failure happened inside `sql.begin`, PostgreSQL rolled back the INSERT as well. The order count is 3 before and after. `SQL.PostgresError` and its `errno` field were introduced in the Bun.sql topic."
        }
      ],
      "productionNote": "Checkout, money transfers and stock changes all need a transaction. Schema migrations also run inside one, as you saw in the migrations topic, so a half-applied migration never stays behind. Keep transactions short: do not call an external service (a payment API, an email provider) while a transaction is open. The transaction keeps its locks and a database connection the whole time, so a slow API call blocks other requests.",
      "commonMistakes": [
        "Running related writes as separate queries on `sql`. Each query commits on its own, so a failure in the middle leaves half the work saved.",
        "Holding a transaction open while waiting for a slow external API. Other requests queue up behind the locks and the connection pool (the fixed set of reusable database connections) can run out of connections.",
        "Thinking ROLLBACK also hands back identity numbers. It does not, so gaps in ids are normal."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Transactions (tutorial)", "url": "https://www.postgresql.org/docs/19/tutorial-transactions.html" },
        { "title": "PostgreSQL docs: Glossary, ACID", "url": "https://www.postgresql.org/docs/19/glossary.html#GLOSSARY-ACID" }
      ]
    },
    {
      "id": "begin-commit-rollback",
      "title": "BEGIN, COMMIT and ROLLBACK in psql",
      "explanation": "In psql (the PostgreSQL command-line client from the relational-database topic) you control a transaction with three commands. `BEGIN;` starts a transaction. `COMMIT;` saves everything done since BEGIN. `ROLLBACK;` discards everything done since BEGIN, as if it never happened.\n\nInside a transaction you can see your own changes, but other sessions (other connections to the database) cannot. They keep seeing the old data until you COMMIT. That is the Isolation part of ACID.\n\nCreate a file called `rollback-demo.sql` in your project folder and paste the first example below. Then run it with `psql \"$DATABASE_URL\" -f rollback-demo.sql` in a terminal opened in that folder. In PowerShell run `psql $env:DATABASE_URL -f rollback-demo.sql` instead. The `-f` option tells psql to run the statements in a file. The file assumes product 1 has stock 10.\n\nIf any statement inside a transaction fails, PostgreSQL marks the whole transaction as aborted (broken). Every later statement is refused with the message `current transaction is aborted, commands ignored until end of transaction block`. The only way out is ROLLBACK. The second example shows this using a division by zero, which always fails.",
      "analogy": "A shopping cart versus checkout. BEGIN is picking up a cart and filling it. COMMIT is paying at the till, and only then do other shoppers see the items as sold. ROLLBACK is putting everything back on the shelves. While you are still shopping, nobody else sees the items as taken.",
      "code": [
        {
          "language": "sql",
          "filename": "rollback-demo.sql",
          "source": "BEGIN;\nUPDATE products SET stock = stock - 2 WHERE id = 1;\nSELECT stock FROM products WHERE id = 1;\nROLLBACK;\nSELECT stock FROM products WHERE id = 1;",
          "output": "BEGIN\nUPDATE 1\n stock \n-------\n     8\n(1 row)\n\nROLLBACK\n stock \n-------\n    10\n(1 row)\n",
          "explanation": "Inside the transaction the stock reads 8, because you see your own uncommitted change. After ROLLBACK the change is gone and the stock is 10 again."
        },
        {
          "language": "sql",
          "filename": "aborted-demo.sql",
          "source": "BEGIN;\nSELECT 1 / 0;\nSELECT 1;\nROLLBACK;",
          "output": "BEGIN\npsql:aborted-demo.sql:2: ERROR:  division by zero\npsql:aborted-demo.sql:3: ERROR:  current transaction is aborted, commands ignored until end of transaction block\nROLLBACK\n",
          "explanation": "The division by zero fails, so the transaction is aborted. Even the harmless `SELECT 1` on line 3 is refused. Only ROLLBACK ends the broken transaction."
        }
      ],
      "productionNote": "You rarely type these commands in application code, but `sql.begin` in Bun sends exactly BEGIN, then your queries, then COMMIT or ROLLBACK. Knowing the raw commands helps you read database logs and debug a stuck session in psql.",
      "commonMistakes": [
        "Typing BEGIN in psql and then closing psql without COMMIT. The changes are rolled back and vanish.",
        "Continuing to send statements after an error inside a transaction. They all fail with the aborted-transaction message until you ROLLBACK."
      ],
      "sources": [
        { "title": "PostgreSQL docs: BEGIN", "url": "https://www.postgresql.org/docs/19/sql-begin.html" },
        { "title": "PostgreSQL docs: ROLLBACK", "url": "https://www.postgresql.org/docs/19/sql-rollback.html" }
      ]
    },
    {
      "id": "bun-sql-begin-savepoints",
      "title": "Transactions in Bun.sql (sql.begin) and savepoints",
      "explanation": "In Bun you write a transaction with `await sql.begin(async tx => { ... })`. The function you pass in is a callback (a function handed to another function to be called later). Bun reserves one database connection, sends BEGIN, and calls your callback with `tx`, a client that works like `sql` but is tied to that one connection. If the callback finishes normally, Bun sends COMMIT. If it throws an error, Bun sends ROLLBACK and `sql.begin` rejects (fails) with that same error. Whatever the callback returns becomes the value that `sql.begin` resolves to.\n\nInside the callback, run every query with `tx`, never with `sql`. A query on `sql` may use a different connection from the pool, so it would run outside your transaction: it cannot see your uncommitted rows and it will not be rolled back. Also `await` every query. And once the transaction has ended, using `tx` rejects with the error code `ERR_POSTGRES_INVALID_TRANSACTION_STATE`.\n\nHere is a service function that places an order. Save it as `src/services/orders.service.ts`. The first statement is an atomic conditional UPDATE: it only subtracts stock when `stock >= quantity`, and `RETURNING` gives back the price. If no row matched (not enough stock), `product` is `undefined` and we throw, which rolls everything back. Otherwise we insert the order and its line item and return the new id and total. The `as Error` used in the demo is a type assertion (telling TypeScript the type of a value) from the errors topic.\n\nThen save the demo as `scripts/place-order-demo.ts` and run it with `bun run scripts/place-order-demo.ts`. It assumes the freshly seeded data: Backpack (product 3) costs 4999 cents and has stock 5, and `orders` has 3 rows, so the next id is 4. If you ran the earlier demo, a cancelled insert used up an id number and you will see a higher id. A later topic changes the thrown `Error` into a custom `AppError`.\n\nSometimes one step inside a transaction may fail without ruining the whole thing. A savepoint is a named bookmark inside a transaction: you can roll back to it and keep everything before it. In Bun, `await tx.savepoint(async sp => { ... })` does this. If the callback throws, only the work done inside it is undone and the error is rethrown to you, so wrap the call in `try/catch` to carry on. Use `sp` for the queries inside. Without a savepoint, catching a database error inside a transaction does not help: the transaction is already aborted, as you saw in psql.\n\nThe savepoint demo below creates a real order with one line item, then tries to insert the same line item again. It assumes `order_items` has the composite primary key `(order_id, product_id)` from the constraints topic, so the duplicate fails. Only the duplicate is undone, and the outer transaction still commits. Functions that run queries can also take a parameter typed `SQL` (imported with `import type { SQL } from \"bun\"`) so the same function can be called with either `sql` or `tx`; the layered-architecture topic uses this pattern.",
      "analogy": "A sealed envelope at the post office. Everything inside (your queries) is posted together, and if one page is wrong the clerk hands the whole envelope back (rollback). A savepoint is a paper clip on one section: you can remove just that section without rewriting the whole letter.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/services/orders.service.ts",
          "source": "import { sql } from \"../db\";\n\nexport async function placeOrder(userId: string, productId: string, quantity: number) {\n  return sql.begin(async tx => {\n    const [product]: { price_cents: number }[] = await tx`UPDATE products SET stock = stock - ${quantity} WHERE id = ${productId} AND stock >= ${quantity} RETURNING price_cents`;\n    if (!product) throw new Error(\"out of stock\");\n\n    const total = product.price_cents * quantity;\n    const [order]: { id: string }[] = await tx`INSERT INTO orders (user_id, status, total_cents) VALUES (${userId}, 'pending', ${total}) RETURNING id`;\n    await tx`INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (${order!.id}, ${productId}, ${quantity}, ${product.price_cents})`;\n\n    return { orderId: order!.id, totalCents: total };\n  });\n}",
          "output": "",
          "explanation": "The file only defines a function, so it prints nothing. All four queries use `tx`. The `!` after `order` tells TypeScript the value is not undefined, which is safe here because the INSERT always returns a row."
        },
        {
          "language": "typescript",
          "filename": "scripts/place-order-demo.ts",
          "source": "import { sql } from \"../src/db\";\nimport { placeOrder } from \"../src/services/orders.service\";\n\nasync function backpackStock(): Promise<number> {\n  const [row]: { stock: number }[] = await sql`SELECT stock FROM products WHERE id = 3`;\n  return row!.stock;\n}\n\nconsole.log(await placeOrder(\"3\", \"3\", 2));\nconsole.log(\"stock:\", await backpackStock());\n\ntry {\n  await placeOrder(\"3\", \"3\", 10);\n} catch (err) {\n  console.log(\"rejected:\", (err as Error).message);\n}\nconsole.log(\"stock:\", await backpackStock());\nawait sql.close();",
          "output": "{ orderId: \"4\", totalCents: 9998 }\nstock: 3\nrejected: out of stock\nstock: 3",
          "explanation": "The first call succeeds: 2 x 4999 = 9998 cents, and stock drops from 5 to 3. The ids are strings because PostgreSQL bigint values arrive as strings in Bun. The second call asks for 10 but only 3 are left, so the conditional UPDATE matches no row, the function throws, and no order row is created. Stock stays at 3."
        },
        {
          "language": "typescript",
          "filename": "scripts/savepoint-demo.ts",
          "source": "import { sql } from \"../src/db\";\n\nawait sql.begin(async tx => {\n  const [order]: { id: string }[] = await tx`INSERT INTO orders (user_id, status, total_cents) VALUES ('3', 'pending', 1000) RETURNING id`;\n  await tx`INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (${order!.id}, '1', 1, 1000)`;\n\n  try {\n    await tx.savepoint(async sp => {\n      // Same order_id + product_id again: violates the composite primary key.\n      await sp`INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (${order!.id}, '1', 1, 1000)`;\n    });\n  } catch {\n    console.log(\"line skipped\");\n  }\n\n  const [count]: { n: number }[] = await tx`SELECT count(*)::int AS n FROM order_items WHERE order_id = ${order!.id}`;\n  console.log(\"items in order:\", count!.n);\n});\nawait sql.close();",
          "output": "line skipped\nitems in order: 1",
          "explanation": "The duplicate INSERT fails inside the savepoint, so only that INSERT is undone and the error reaches the `catch`. The transaction itself is still healthy: the first line item is kept, the count query works, and the transaction commits. This script creates a real order, so it leaves one extra order in your database."
        }
      ],
      "productionNote": "Every service method that writes to more than one row or table should use `sql.begin`. Throwing an error is how you cancel: you do not call ROLLBACK yourself. Keep the callback short and free of slow work such as network calls.",
      "commonMistakes": [
        "Using `sql` instead of `tx` inside the callback. That query runs on another connection, outside the transaction, so it is never rolled back.",
        "Forgetting `await` on a query inside the callback, so the transaction may commit before the query has run.",
        "Catching a database error inside a transaction and carrying on without a savepoint. The transaction is already aborted and every later statement fails."
      ],
      "sources": [
        { "title": "Bun docs: SQL (transactions and savepoints)", "url": "https://bun.com/docs/api/sql" },
        { "title": "PostgreSQL docs: SAVEPOINT", "url": "https://www.postgresql.org/docs/19/sql-savepoint.html" }
      ]
    },
    {
      "id": "race-conditions-row-locks",
      "title": "Race conditions and row locks (SELECT ... FOR UPDATE)",
      "explanation": "A race condition is a bug where the result depends on the exact timing of requests that run at the same time. A web server handles many requests concurrently (overlapping in time), so two buyers can reach your code together.\n\nThe classic version is the lost update. Two requests both read `stock = 1`. Both decide there is enough. Both write. One purchase is lost, and you either oversell or end with a negative number. Reading a value, deciding in your code, and then writing is the dangerous pattern, because the value can change between the read and the write.\n\nThere are two fixes. The first and preferred one is an atomic conditional UPDATE, where the database checks and changes the value in one step: `UPDATE products SET stock = stock - 2 WHERE id = 3 AND stock >= 2`. You used this in `placeOrder`. PostgreSQL locks the row while it updates it, so a second request waits and then re-checks the condition against the new value.\n\nThe second fix is for when your code must read first and decide afterwards. `SELECT ... FOR UPDATE` inside a transaction reads the row and locks it until the transaction ends. Any other transaction that tries to lock or change that row waits. Here is the timeline for product 3 with stock 5, using two psql sessions A and B:\n\n1. A runs `BEGIN; SELECT stock FROM products WHERE id = 3 FOR UPDATE;` and sees 5.\n2. B runs `BEGIN; SELECT stock FROM products WHERE id = 3 FOR UPDATE;` and waits.\n3. A runs `UPDATE products SET stock = stock - 5 WHERE id = 3; COMMIT;`.\n4. B's query unblocks and sees 0, so B knows nothing is left.\n\nThe Bun script below does the same with two concurrent calls that each want 6 of the 10 units of product 1. `Promise.allSettled` (from the async topic) waits for both calls and reports each as fulfilled or rejected. Whichever call locks the row first wins; the other waits, then sees only 4 and fails. Which one wins does not matter, so the script prints only totals, which are always the same. It resets the stock at the end so you can run it again.\n\nA deadlock happens when two transactions each hold a lock the other needs, so both wait forever. PostgreSQL detects this, aborts one of them with SQLSTATE `40P01`, and lets the other continue. You avoid deadlocks by always locking rows in the same order, for example sorted by id.",
      "analogy": "The last concert ticket. Two cashiers both look at the screen, see \"1 left\" and both sell it. FOR UPDATE is the first cashier putting a hand on the ticket: the second cashier has to wait until the sale finishes, then sees \"0 left\".",
      "code": [
        {
          "language": "typescript",
          "filename": "scripts/race-demo.ts",
          "source": "import { sql } from \"../src/db\";\n\nasync function reserveStock(productId: string, quantity: number): Promise<void> {\n  await sql.begin(async tx => {\n    // FOR UPDATE locks the row until this transaction ends.\n    const [p]: { stock: number }[] = await tx`SELECT stock FROM products WHERE id = ${productId} FOR UPDATE`;\n    if (!p || p.stock < quantity) throw new Error(\"not enough stock\");\n    await tx`UPDATE products SET stock = ${p.stock - quantity} WHERE id = ${productId}`;\n  });\n}\n\nconst results = await Promise.allSettled([reserveStock(\"1\", 6), reserveStock(\"1\", 6)]);\n\nconsole.log(\"succeeded:\", results.filter(r => r.status === \"fulfilled\").length);\nconsole.log(\"rejected:\", results.filter(r => r.status === \"rejected\").length);\n\nconst [row]: { stock: number }[] = await sql`SELECT stock FROM products WHERE id = 1`;\nconsole.log(\"final stock:\", row!.stock);\n\nawait sql`UPDATE products SET stock = 10 WHERE id = 1`; // reset for the next run\nawait sql.close();",
          "output": "succeeded: 1\nrejected: 1\nfinal stock: 4",
          "explanation": "Both calls want 6 of the 10 units, which cannot both succeed. Because of FOR UPDATE, the second transaction waits for the first to commit and then reads 4, so it throws. Without FOR UPDATE both could read 10 and both write 4, and one sale would be silently lost. The script assumes product 1 starts with stock 10."
        }
      ],
      "productionNote": "Use the atomic conditional UPDATE for counters, stock and balances whenever the rule fits in the WHERE clause. Reach for FOR UPDATE when you must read, run application logic, then write, as in seat booking or balance checks across several rows. Keep the locked section short, because every other request for that row waits.",
      "commonMistakes": [
        "Read, check in code, then write, without a lock or an atomic UPDATE. Two concurrent requests both pass the check.",
        "Running `SELECT ... FOR UPDATE` outside a transaction. With autocommit the statement finishes at once and the lock is released immediately, so it protects nothing.",
        "Locking several rows in a different order in different code paths, which invites deadlocks (SQLSTATE 40P01)."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Explicit locking, row-level locks", "url": "https://www.postgresql.org/docs/19/explicit-locking.html#LOCKING-ROWS" },
        { "title": "PostgreSQL docs: SELECT, the locking clause", "url": "https://www.postgresql.org/docs/19/sql-select.html#SQL-FOR-UPDATE-SHARE" }
      ]
    },
    {
      "id": "isolation-levels",
      "title": "Isolation levels in practice",
      "explanation": "The isolation level of a transaction decides how much of other transactions' concurrent changes it can see. PostgreSQL offers three that matter in practice.\n\nREAD COMMITTED is the default. Each statement sees the data that was committed before that statement started, so two statements in the same transaction can see different data if someone else commits in between.\n\nREPEATABLE READ gives the whole transaction one snapshot (a frozen view of the data) taken at its first query. If it later tries to change a row that someone else changed after that snapshot, it fails with a serialization error.\n\nSERIALIZABLE behaves as if transactions ran one after another. To guarantee that, PostgreSQL may abort a transaction with a serialization failure, SQLSTATE `40001`. This is not a bug in your code: the correct response is to run the whole transaction again from the start. REPEATABLE READ can also raise 40001.\n\nTo change the level, run `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` as the first statement inside the transaction. Setting it after another query has run is an error. The helper below wraps `sql.begin`, sets the level, runs your function, and retries up to 3 attempts when the error is 40001. It checks `err instanceof SQL.PostgresError` first, because the caught `err` could be anything. `<T>` is a type parameter: a placeholder that TypeScript fills with whatever type the function returns (you met `Promise<T>` in the async topic). Save it as `scripts/isolation-demo.ts`; the demo at the bottom prints the current level in the default mode and inside the helper.\n\nA sensible default stance is to stay on READ COMMITTED and protect your invariants (rules that must always hold, like \"stock never goes negative\") with atomic UPDATEs, constraints and FOR UPDATE. Use SERIALIZABLE only for rules that span several rows and cannot be expressed that way, and always together with a retry.",
      "analogy": "A shop shelf seen through photos or live video. READ COMMITTED is watching the live feed before each step. REPEATABLE READ is working from one photo taken at the start. SERIALIZABLE is a referee who cancels your turn if someone else's change would make your photo wrong, and you simply try again.",
      "code": [
        {
          "language": "typescript",
          "filename": "scripts/isolation-demo.ts",
          "source": "import { SQL } from \"bun\";\nimport { sql } from \"../src/db\";\n\nexport async function withSerializableRetry<T>(fn: (tx: SQL) => Promise<T>, attempts = 3): Promise<T> {\n  for (let i = 1; ; i++) {\n    try {\n      return await sql.begin(async tx => {\n        await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;\n        return fn(tx);\n      });\n    } catch (err) {\n      // 40001 = serialization failure: run the whole transaction again.\n      if (err instanceof SQL.PostgresError && err.errno === \"40001\" && i < attempts) continue;\n      throw err;\n    }\n  }\n}\n\nasync function currentLevel(db: SQL): Promise<string> {\n  const [row]: { transaction_isolation: string }[] = await db`SHOW transaction_isolation`;\n  return row!.transaction_isolation;\n}\n\nconsole.log(await currentLevel(sql));\nconsole.log(await withSerializableRetry(tx => currentLevel(tx)));\nawait sql.close();",
          "output": "read committed\nserializable",
          "explanation": "`SHOW transaction_isolation` reports the level in effect. Outside a transaction it is the default, `read committed`. Inside the helper it is `serializable`. When the error is 40001 and attempts remain, `continue` starts the loop again, which runs a fresh transaction. Any other error, or the last failed attempt, is rethrown."
        }
      ],
      "productionNote": "Use SERIALIZABLE for financial invariants that span several rows, such as \"the sum of these balances must stay constant\". The retry wrapper is mandatory: under load, 40001 errors are normal. Make sure the function you retry has no side effects outside the database (sending an email, calling an API), because it may run more than once. Bun's `sql.begin` option strings for isolation are not documented, which is why the course uses `SET TRANSACTION`.",
      "commonMistakes": [
        "Using SERIALIZABLE without a retry. Some requests will fail with 40001 for no fault of the user.",
        "Running `SET TRANSACTION ISOLATION LEVEL` after the first query of the transaction. PostgreSQL rejects it, because it must be called before any query.",
        "Retrying only the failed statement instead of the whole transaction. After a serialization failure the transaction is aborted, so you must start over."
      ],
      "sources": [
        { "title": "PostgreSQL docs: Transaction isolation", "url": "https://www.postgresql.org/docs/19/transaction-iso.html" },
        { "title": "PostgreSQL docs: SET TRANSACTION", "url": "https://www.postgresql.org/docs/19/sql-set-transaction.html" },
        { "title": "Bun docs: SQL", "url": "https://bun.com/docs/api/sql" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "A server crashes after inserting an order row but before inserting its items, and the order row stays in the database. Which ACID property was lost because no transaction was used?",
      "options": [
        "Atomicity: the steps should all succeed or all be undone",
        "Durability: committed data should survive a crash",
        "Isolation: other sessions should not see unfinished work",
        "Consistency: the database should reject unknown column names"
      ],
      "answerIndex": 0,
      "explanation": "Atomicity means a group of statements takes effect as one unit. Without a transaction, the first INSERT was committed alone, leaving half an order."
    },
    {
      "question": "Inside `sql.begin(async tx => { ... })` you run a query with `sql` instead of `tx`. What happens to that query?",
      "options": [
        "It runs on the same connection and is rolled back with the rest",
        "It runs outside the transaction, so it is committed on its own and is not rolled back if the callback throws",
        "Bun automatically rewrites it to use `tx`",
        "It is queued and runs only after the transaction ends, in a new transaction"
      ],
      "answerIndex": 1,
      "explanation": "`tx` is tied to one reserved connection. `sql` takes any connection from the pool, so its query is not part of the transaction and is not undone by a rollback."
    },
    {
      "question": "Two requests try to buy the last Backpack at the same moment. How does `UPDATE products SET stock = stock - ${q} WHERE id = ${id} AND stock >= ${q}` prevent overselling?",
      "options": [
        "It sorts the requests by arrival time in the Bun server",
        "It copies the stock value into JavaScript so both requests share it",
        "The database locks the row while updating, so the second request re-checks `stock >= q` against the new value and matches no row",
        "It turns the CHECK constraint off for the duration of the statement"
      ],
      "answerIndex": 2,
      "explanation": "The check and the change happen in one atomic statement. The second request waits for the row lock, then sees the reduced stock, the WHERE condition is false, and zero rows are updated."
    },
    {
      "question": "Session A holds `SELECT stock FROM products WHERE id = 3 FOR UPDATE` on stock 5, session B waits for the same lock, then A subtracts 5 and commits. What does B's query return once it unblocks?",
      "options": [
        "5, because B started before A committed",
        "An error, because the row was changed",
        "0, because B sees the row as committed by A",
        "Nothing, the row is deleted"
      ],
      "answerIndex": 2,
      "explanation": "B waits for A's lock to end. In READ COMMITTED, B's statement then reads the latest committed value, which is 0."
    },
    {
      "question": "Which SQLSTATE tells you a SERIALIZABLE transaction should simply be retried from the start?",
      "options": [
        "23505",
        "22P02",
        "23503",
        "40001"
      ],
      "answerIndex": 3,
      "explanation": "40001 is a serialization failure. The other codes are a unique violation (23505), an invalid text representation such as a malformed id (22P02) and a foreign key violation (23503); retrying those would fail again."
    }
  ]
});
