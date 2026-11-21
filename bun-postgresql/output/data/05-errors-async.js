window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "05-errors-async",
  "order": 5,
  "title": "Errors & Async Code",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Things go wrong in real programs: bad input, missing records, a database that is down. This topic teaches you to signal and handle failures with errors, including your own error types, and to work with code that finishes later (Promises, async and await), which is how every database query and network call behaves.",
  "prerequisites": ["04-arrays-objects-types"],
  "subtopics": [
    {
      "id": "throw-try-catch-finally",
      "title": "throw, try / catch / finally",
      "explanation": "An error is an object that describes a failure. It has a message (text saying what went wrong) and a stack trace (the list of function calls that led to the failure, which helps you find the bug). You create one with `new Error(\"message\")`.\n\n`throw` stops the current work immediately and hands the error upward. The program jumps out of the current function, then the function that called it, and so on, until it finds a `catch` block that handles it. If nothing catches the error, the program crashes and prints the message and stack trace.\n\nThe `try { } catch (err) { } finally { }` statement is how you handle errors. Code inside `try` runs normally. If anything inside it throws, the rest of the `try` block is skipped and the `catch` block runs, with the thrown value in the variable you named (here `err`). The `finally` block runs always: after a successful `try`, after a `catch`, even if the `catch` itself throws. Use it for cleanup, such as releasing a resource.\n\nIn TypeScript with strict checking on, the variable in `catch (err)` has type `unknown` (it could be anything, because JavaScript lets you throw any value). So you must check what it is before using it. `err instanceof Error` asks \"was this value created from the Error blueprint (the template that makes Error objects)?\", and inside the `if` TypeScript then lets you read `err.message`. This checking step is called narrowing (you saw it in the previous topic).\n\nTo try the example, create a file named `try-catch.ts` in your project folder, paste the code in, then run `bun run try-catch.ts` in a terminal opened in that folder.",
      "analogy": "A fire alarm. `throw` is pulling the alarm: everyone stops what they are doing. `catch` is the assembly point, where one person takes charge of the situation. `finally` is closing the doors on the way out, which happens whether or not there was a fire.",
      "code": [
        {
          "language": "typescript",
          "filename": "try-catch.ts",
          "source": "function parseQuantity(raw: string): number {\n  const n = Number(raw);\n  if (!Number.isInteger(n) || n <= 0) {\n    throw new Error(`invalid quantity: ${raw}`);\n  }\n  return n;\n}\n\ntry {\n  console.log(parseQuantity(\"3\"));\n  console.log(parseQuantity(\"abc\"));\n  console.log(\"not reached\");\n} catch (err) {\n  if (err instanceof Error) {\n    console.log(\"caught:\", err.message);\n  }\n} finally {\n  console.log(\"done\");\n}",
          "output": "3\ncaught: invalid quantity: abc\ndone",
          "explanation": "`parseQuantity(\"3\")` returns 3, which is printed. `Number(\"abc\")` is `NaN`, which is not an integer, so the second call throws. The line printing \"not reached\" is skipped, the `catch` block prints the message, and `finally` prints \"done\" in every case."
        }
      ],
      "productionNote": "In a backend you throw on validation failures (a quantity of -5, a missing field) and catch in one central place that turns the error into an HTTP response. Database failures are handled the same way; topic 19 builds that central handler. Always throw `Error` objects, not strings, because only Error objects carry a stack trace.",
      "commonMistakes": [
        "Writing an empty `catch { }` block. The failure disappears silently and the bug becomes very hard to find. At minimum log the error, or re-throw it.",
        "Throwing a string (`throw \"bad\"`) instead of an Error object. A string has no stack trace and no `.message`.",
        "Reading `err.message` directly in `catch`. The variable is `unknown`, so TypeScript rejects it until you check `err instanceof Error`."
      ],
      "sources": [
        { "title": "MDN: try...catch", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch" },
        { "title": "MDN: throw", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw" }
      ]
    },
    {
      "id": "error-classes-custom-errors",
      "title": "Error classes & custom errors",
      "explanation": "JavaScript has built-in error kinds that all build on `Error`: `TypeError` (a value is not the type an operation needs), `RangeError` (a number is outside its allowed range) and `SyntaxError` (text could not be parsed, for example invalid JSON). Your own code often needs more specific kinds, such as \"the record was not found\", so you can define them.\n\nA class is a blueprint for making objects. This course uses classes almost only for errors. `class NotFoundError extends Error` means \"a NotFoundError is a kind of Error that adds more\". Because it extends Error, `instanceof Error` is still true for it, and it has `.message` and a stack trace.\n\nInside the class, `constructor` is the function that runs on `new NotFoundError(...)`. It must call `super(message)` first, which runs the parent Error's setup and stores the message. Then you set `this.name` (a label shown in stack traces) and any extra fields. `this` means \"the object being created\". `readonly` means the field can be set once and never changed afterwards. Fields are declared explicitly at the top of the class, which keeps the code plain.\n\nTo tell error kinds apart, use `instanceof` in `catch`. Handle the kinds you expect, and `throw err` again for everything else, so unknown failures are not swallowed.\n\nWhen you catch a low-level error and throw a higher-level one, keep the original with the `cause` option: `new Error(\"msg\", { cause: err })`. The original stays available as `.cause`. The second example shows this using `JSON.parse`, which throws a `SyntaxError` for invalid JSON text.",
      "analogy": "Hospital triage tags. Every arrival is a patient (an Error), but a red, yellow or green tag (a subclass such as NotFoundError) tells the staff which room to send them to. A patient whose tag you do not recognise is not turned away; you pass them on to someone who does (re-throw).",
      "code": [
        {
          "language": "typescript",
          "filename": "custom-errors.ts",
          "source": "class NotFoundError extends Error {\n  readonly resource: string;\n\n  constructor(resource: string, id: string) {\n    super(`${resource} ${id} not found`);\n    this.name = \"NotFoundError\";\n    this.resource = resource;\n  }\n}\n\ntry {\n  throw new NotFoundError(\"order\", \"999\");\n} catch (err) {\n  if (err instanceof NotFoundError) {\n    console.log(err.name, err.message, err.resource);\n  } else {\n    throw err;\n  }\n}",
          "output": "NotFoundError order 999 not found order",
          "explanation": "The constructor builds the message \"order 999 not found\", sets the name, and stores `resource`. In `catch`, `instanceof NotFoundError` is true, so TypeScript allows reading `err.resource`. The `else` branch would re-throw any other kind of error."
        },
        {
          "language": "typescript",
          "filename": "error-cause.ts",
          "source": "try {\n  JSON.parse(\"{bad\");\n} catch (err) {\n  const wrapped = new Error(\"could not read config\", { cause: err });\n  console.log(wrapped.message);\n  console.log(wrapped.cause instanceof SyntaxError);\n}",
          "output": "could not read config\ntrue",
          "explanation": "`JSON.parse` fails on the invalid text and throws a SyntaxError. We wrap it in a new, more meaningful Error and keep the original in `cause`, so nothing is lost for debugging."
        }
      ],
      "productionNote": "Real backends define a small hierarchy of application errors (not found, validation failed, conflict) and map each to an HTTP status code in one place. Topic 19 builds exactly that on top of this pattern.",
      "commonMistakes": [
        "Forgetting `super(message)` as the first line of the constructor. JavaScript throws a ReferenceError (a variable or `this` used before it is ready) as soon as the class is used.",
        "Catching everything and handling it as if it were the expected kind. Check with `instanceof` and re-throw the rest, otherwise real bugs are hidden.",
        "Forgetting to set `this.name`. Logs then show the generic name \"Error\" instead of your class name."
      ],
      "sources": [
        { "title": "MDN: Error (custom error types)", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#custom_error_types" },
        { "title": "MDN: Error cause", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause" }
      ]
    },
    {
      "id": "promises",
      "title": "Promises",
      "explanation": "Some work does not finish immediately: reading a file, calling another server, running a database query. This is called asynchronous (async) work. Instead of freezing the whole program until it finishes, JavaScript starts the work and keeps running other code. Your server stays able to answer other requests meanwhile.\n\nA Promise is an object that stands for a result that will exist later. It is always in one of three states: pending (still working), fulfilled (finished, and it holds a value), or rejected (failed, and it holds an error). Once it is fulfilled or rejected it never changes again. The type `Promise<string>` means \"a Promise that will eventually hold a string\".\n\n`Bun.sleep(ms)` is a Bun function that returns a Promise which becomes fulfilled after `ms` milliseconds. It is handy for pretending that slow work is happening. The method `.then(callback)` on a Promise registers a function (a callback, from topic 3) to run when the Promise is fulfilled. `.then` returns a new Promise holding the callback's result.\n\nThe example prints \"waiting...\" first even though it was set up before. That shows the program did not stop and wait. The next sub-topic introduces `await`, which is how this course normally works with Promises; `.then` is shown here once so you can recognise it.\n\nFor failures, `.catch(callback)` registers a function that runs when the Promise is rejected. `Promise.reject(error)` creates a Promise that is already rejected, which is useful for demonstrations.",
      "analogy": "A restaurant buzzer. You order (start the work) and receive a buzzer (the Promise). You sit down and chat (other code keeps running). When the buzzer goes off, either your food is ready (fulfilled, with a value) or the kitchen says \"sorry, sold out\" (rejected, with an error).",
      "code": [
        {
          "language": "typescript",
          "filename": "promises.ts",
          "source": "const ready: Promise<string> = Bun.sleep(100).then(() => \"order ready\");\n\nconsole.log(\"waiting...\");\n\nready.then((msg) => console.log(msg));",
          "output": "waiting...\norder ready",
          "explanation": "`Bun.sleep(100)` starts a 100 ms wait and returns a Promise immediately. `.then` turns it into a Promise of the text \"order ready\". The `console.log(\"waiting...\")` line runs right away; about 100 ms later the callback prints the message."
        },
        {
          "language": "typescript",
          "filename": "promise-rejected.ts",
          "source": "const failing: Promise<string> = Promise.reject(new Error(\"sold out\"));\n\nfailing.catch((err) => console.log(\"rejected:\", err.message));",
          "output": "rejected: sold out",
          "explanation": "The Promise starts already rejected with an Error. `.catch` registers the handler that receives that error and prints its message."
        }
      ],
      "productionNote": "Every database query and every `fetch` (the built-in function for HTTP requests) returns a Promise, so everything in later topics builds on this. A rejected Promise that nobody handles is a bug that can crash the program or lose an error, so every Promise needs either a handler or an `await` inside `try/catch`.",
      "commonMistakes": [
        "Logging a Promise and expecting its value. `console.log(promise)` prints `Promise { <pending> }`, not the result. You must wait for it.",
        "Forgetting to handle rejection. A failed Promise with no `.catch` and no `try/catch` is an unhandled rejection.",
        "Thinking code after `.then(...)` runs after the callback. It does not; it runs immediately, and the callback runs later."
      ],
      "sources": [
        { "title": "MDN: Using promises", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises" },
        { "title": "Bun docs: Bun.sleep", "url": "https://bun.com/docs/api/utils#bun-sleep" }
      ]
    },
    {
      "id": "async-await",
      "title": "async / await",
      "explanation": "`async` and `await` let you write code that waits for Promises in a normal top-to-bottom style. Putting `async` before a function makes it always return a Promise. If the function returns `5`, the caller gets a Promise that is fulfilled with 5. If the function throws, the caller gets a Promise that is rejected with that error. The return type is written `Promise<T>`, for example `Promise<string>`.\n\n`await somePromise` pauses only the async function it is written in until the Promise settles (is fulfilled or rejected). If it is fulfilled you get the value. If it is rejected, the rejection is thrown as an ordinary error at that line, so a normal `try/catch` handles it. Other work in the program keeps running while one function waits. In Bun you can also use `await` at the top level of a file, outside any function. For TypeScript's editor checks to accept this, the file must count as a module, so add the line `export {};` at the top of such a file (Bun runs it either way).\n\nIn the first example, `(err as Error)` is a type assertion: `as` tells TypeScript \"trust me, treat this value as that type\". TypeScript does not check it, so use it sparingly. It is safe here only because we know our own code throws an Error. The safer pattern remains `err instanceof Error`.\n\nThe second example shows that calling an async function returns a Promise, and that `await` unwraps it into the value.",
      "analogy": "Waiting at the pickup counter. `await` is standing at the counter until your number is called. You wait, but the kitchen keeps cooking other customers' orders, so nobody else is blocked by your waiting.",
      "code": [
        {
          "language": "typescript",
          "filename": "async-await.ts",
          "source": "export {};\n\nasync function fetchOrderStatus(id: string): Promise<string> {\n  await Bun.sleep(50);\n  if (id === \"999\") {\n    throw new Error(\"order 999 not found\");\n  }\n  return \"paid\";\n}\n\ntry {\n  console.log(await fetchOrderStatus(\"101\"));\n  console.log(await fetchOrderStatus(\"999\"));\n} catch (err) {\n  console.log(\"failed:\", (err as Error).message);\n}",
          "output": "paid\nfailed: order 999 not found",
          "explanation": "The first call waits 50 ms and returns \"paid\". The second call throws inside the async function, which rejects its Promise; `await` rethrows that error at the call site, and `catch` prints the message."
        },
        {
          "language": "typescript",
          "filename": "async-returns-promise.ts",
          "source": "export {};\n\nasync function double(n: number): Promise<number> {\n  return n * 2;\n}\n\nconst p = double(4);\nconsole.log(p instanceof Promise);\nconsole.log(await p);",
          "output": "true\n8",
          "explanation": "Even though the function just returns a number, the call gives back a Promise. `await p` unwraps it to the number 8."
        }
      ],
      "productionNote": "In the backend you will build, every route handler, service function and repository (database access) function is `async`, because they all end up waiting on the database. Rejected Promises from the database flow into your `try/catch` or central error handler exactly like thrown errors.",
      "commonMistakes": [
        "Forgetting `await`. You get a Promise instead of the value, and if that Promise rejects, your `try/catch` does not catch it because the error happens later, outside the `try` block. It becomes an unhandled rejection.",
        "Using `await` inside `array.forEach(async ...)`. `forEach` does not wait for the callbacks, so the code after it runs too early. Use a `for...of` loop instead.",
        "Using `as` to silence TypeScript errors. It hides real type problems; prefer checks such as `instanceof`."
      ],
      "sources": [
        { "title": "MDN: async function", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function" },
        { "title": "MDN: await", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await" }
      ]
    },
    {
      "id": "promise-all-parallel",
      "title": "Running work in parallel with Promise.all",
      "explanation": "If you `await` two independent tasks one after the other, their times add up: two 100 ms tasks take about 200 ms. Independent tasks can instead be started together so they wait at the same time.\n\n`Promise.all([p1, p2])` takes an array of Promises and returns one Promise. It is fulfilled when all of them are fulfilled, with an array of the results in the same order as the input array (not the order they finished in). The example uses array destructuring (from topic 4) to name the results.\n\nPromise.all fails fast: as soon as any one Promise rejects, the combined Promise rejects with that error right away, and you do not get the other results.\n\nWhen you need the outcome of every task, even failed ones, use `Promise.allSettled`. It never rejects. It gives an array of result objects, each with `status` set to `\"fulfilled\"` (and a `value`) or `\"rejected\"` (and a `reason`). Check `status` to tell them apart.\n\nOnly run tasks in parallel when they do not depend on each other. If step 2 needs the result of step 1, it must wait for it. Also, steps that must happen inside one database transaction (a group of database steps that all succeed or all fail together, covered in topic 15) should not be run in parallel.\n\nThe first example uses `performance.now()`, a built-in function that returns a timestamp in milliseconds with sub-millisecond precision, to measure elapsed time. The printed `true` says the total was under 190 ms, i.e. about 100 ms rather than 200.",
      "analogy": "Cooking a meal. You boil the pasta and fry the sauce at the same time instead of one after another. `Promise.all` is dinner being served only when both are done, but if the sauce burns the whole dinner is cancelled. `Promise.allSettled` is a cook who lets you see what happened to each dish, burnt or not.",
      "code": [
        {
          "language": "typescript",
          "filename": "parallel.ts",
          "source": "export {};\n\nasync function load(name: string, ms: number): Promise<string> {\n  await Bun.sleep(ms);\n  return name;\n}\n\nconst start = performance.now();\nconst [user, orders] = await Promise.all([load(\"user\", 100), load(\"orders\", 100)]);\nconst elapsed = performance.now() - start;\n\nconsole.log(user, orders, elapsed < 190);",
          "output": "user orders true",
          "explanation": "Both `load` calls start immediately and wait at the same time, so the total is about 100 ms. The results arrive in input order: `user` first, `orders` second."
        },
        {
          "language": "typescript",
          "filename": "parallel-failures.ts",
          "source": "export {};\n\nasync function job(name: string, fail: boolean): Promise<string> {\n  await Bun.sleep(10);\n  if (fail) {\n    throw new Error(`${name} failed`);\n  }\n  return name;\n}\n\ntry {\n  await Promise.all([job(\"a\", false), job(\"b\", true)]);\n} catch (err) {\n  console.log(\"Promise.all rejected:\", (err as Error).message);\n}\n\nconst results = await Promise.allSettled([job(\"a\", false), job(\"b\", true)]);\nfor (const r of results) {\n  if (r.status === \"fulfilled\") {\n    console.log(\"ok\", r.value);\n  } else {\n    console.log(\"failed\", r.reason.message);\n  }\n}",
          "output": "Promise.all rejected: b failed\nok a\nfailed b failed",
          "explanation": "`Promise.all` rejects with the error from job \"b\" and gives no results. `Promise.allSettled` instead reports both outcomes, and the `for...of` loop prints each one in input order."
        }
      ],
      "productionNote": "Typical uses are loading a user and their order count at once, or a health check that pings several dependencies together. Remember the failure rule: with `Promise.all` one failure rejects the whole group, so decide whether that is what you want or whether `allSettled` fits better.",
      "commonMistakes": [
        "Using `Promise.all` for dependent steps, such as creating an order and then its items. The second step needs the first one's result, so it must be awaited in sequence.",
        "Expecting results in the order tasks finish. They always come back in the order of the input array.",
        "Forgetting that `Promise.all` rejects as soon as one task fails, so the other results are lost."
      ],
      "sources": [
        { "title": "MDN: Promise.all()", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all" },
        { "title": "MDN: Promise.allSettled()", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "In try-catch.ts, `parseQuantity(\"3\")` is printed, then `parseQuantity(\"abc\")` throws. What is the full output, in order?",
      "options": [
        "3, then \"not reached\", then done",
        "3, then caught: invalid quantity: abc, then done",
        "caught: invalid quantity: abc, then done",
        "3, then done (the error message is never printed)"
      ],
      "answerIndex": 1,
      "explanation": "The first call prints 3. The second throws, so the rest of `try` is skipped, `catch` prints the message, and `finally` always runs, printing \"done\"."
    },
    {
      "question": "Why should a `catch` block re-throw (`throw err`) an error it does not recognise?",
      "options": [
        "Otherwise unexpected failures (real bugs) are silently swallowed and become hard to find",
        "Because `catch` blocks only work if they throw something at the end",
        "Because re-throwing makes the program run faster",
        "Because TypeScript refuses to compile a `catch` without `throw`"
      ],
      "answerIndex": 0,
      "explanation": "Handling only the kinds you expect and re-throwing the rest means unknown problems still surface to a higher-level handler or crash visibly, instead of being hidden."
    },
    {
      "question": "What are the three states of a Promise?",
      "options": [
        "started, running, stopped",
        "open, closed, waiting",
        "true, false, null",
        "pending, fulfilled, rejected"
      ],
      "answerIndex": 3,
      "explanation": "A Promise starts pending, and then becomes either fulfilled (with a value) or rejected (with an error). After that it never changes."
    },
    {
      "question": "Inside `try { const status = fetchOrderStatus(\"999\"); } catch (err) { ... }` the async function `fetchOrderStatus` rejects, but `await` was forgotten. What happens?",
      "options": [
        "The `catch` block runs normally and handles the error",
        "The program waits automatically, so nothing goes wrong",
        "`status` is a Promise, `catch` does not run, and the rejection goes unhandled",
        "TypeScript converts the rejection into the number 0"
      ],
      "answerIndex": 2,
      "explanation": "Without `await` the call returns a Promise immediately and the `try` block finishes. The failure happens later, outside the `try`, so `catch` never sees it and it becomes an unhandled rejection."
    },
    {
      "question": "Two independent tasks each take about 100 ms. Roughly how long do they take awaited one after the other, versus together with `Promise.all`?",
      "options": [
        "About 100 ms sequentially and about 200 ms with Promise.all",
        "About 200 ms sequentially and about 100 ms with Promise.all",
        "About 200 ms in both cases",
        "About 100 ms in both cases"
      ],
      "answerIndex": 1,
      "explanation": "Sequential awaits add the times (about 200 ms). `Promise.all` lets both wait at the same time, so the total is about the longest single task (about 100 ms)."
    }
  ]
});
