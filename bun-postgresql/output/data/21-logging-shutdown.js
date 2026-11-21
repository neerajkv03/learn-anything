window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "21-logging-shutdown",
  "order": 21,
  "title": "Logging, Health Checks & Graceful Shutdown",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "You will write a small structured logger that prints one JSON object per line, tag every request with an ID and a duration, and add liveness (is the process alive?) and readiness (can it take traffic?) endpoints that check the database with a timeout. Then you will make the server shut down gracefully on SIGTERM and SIGINT (the two operating-system messages that mean 'please stop'), and read the final src/index.ts that wires everything together.",
  "prerequisites": ["20-auth"],
  "subtopics": [
    {
      "id": "structured-json-logging",
      "title": "Structured JSON logging",
      "explanation": "A log is a record of what your program did, written while it runs. When something goes wrong at 3am, the log is often the only evidence you have. The simplest log is free text such as console.log(\"user 5 ordered 3 items\"). That is easy to write and very hard to search: every developer words the sentence differently, and a program cannot reliably pull the user number out of it.\n\nA structured log writes one JSON object per line (JSON was introduced in topic 01). Each object has the same core fields: time (an ISO date-time string), level, msg (the message), plus any context such as requestId, userId or durationMs. Log tools can then filter, count and alert on fields, for example 'all lines where level is error and durationMs is above 1000'. The line must be a single line, so never print multi-line text; JSON.stringify escapes newlines inside strings for you, so even a stack trace stays on one line.\n\nA level says how important a line is. The four we use, from least to most important, are debug (details for developers), info (normal events), warn (something odd but handled) and error (something failed). The logger has a minimum level, and lines below it are dropped. In production you usually run at info; while debugging you switch to debug. The minimum comes from the logLevel setting in your config (topic 07), so you change it with an environment variable and no code edit.\n\nThe logger lives in src/logger.ts and exports createLogger(minLevel). It returns an object with debug, info, warn and error methods plus child(fields). A child logger is a copy that automatically adds fixed fields to every line, so you can create one per request that always carries the requestId. The next sub-topic uses that.\n\nA few TypeScript pieces appear in the code. Record<K, V> describes an object whose keys are of type K and whose values are of type V, so Record<string, unknown> is 'an object with any string keys'. The third parameter, now, is a function that returns the current Date. It defaults to the real clock; passing a fixed one lets us show exact output, and lets tests in topic 22 control time. The spread syntax ...base copies the fields of another object (topic 04); because base and fields come after time, level and msg in the object, they appear after them in the printed line.\n\nThe file also exports errorFields(err), which turns a caught error into loggable fields: the error name, message and stack. Log these three, never the whole request. Never log passwords, tokens, session cookies or full request bodies: logs are copied to many systems and read by many people, so anything you print there is effectively public inside the company.",
      "analogy": "A ship's logbook has fixed columns: time, event, position. Because every entry uses the same columns, anyone can later search 'all storms in March' in seconds. A free-text diary ('rough day, waves everywhere') cannot be searched reliably. The log level is the captain's rule for what deserves an entry: in calm weather only important events, in a storm everything. A child logger is a page pre-printed with the ship's name, so each entry on it already carries it.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/logger.ts",
          "source": "export type LogLevel = \"debug\" | \"info\" | \"warn\" | \"error\";\nexport type Fields = Record<string, unknown>;\n\nexport interface Logger {\n  debug(msg: string, fields?: Fields): void;\n  info(msg: string, fields?: Fields): void;\n  warn(msg: string, fields?: Fields): void;\n  error(msg: string, fields?: Fields): void;\n  child(fields: Fields): Logger;\n}\n\nconst rank: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };\n\nexport function createLogger(\n  minLevel: LogLevel,\n  base: Fields = {},\n  now: () => Date = () => new Date(),\n): Logger {\n  function write(level: LogLevel, msg: string, fields: Fields = {}): void {\n    if (rank[level] < rank[minLevel]) return;\n    console.log(JSON.stringify({ time: now().toISOString(), level, msg, ...base, ...fields }));\n  }\n  return {\n    debug: (msg, fields) => write(\"debug\", msg, fields),\n    info: (msg, fields) => write(\"info\", msg, fields),\n    warn: (msg, fields) => write(\"warn\", msg, fields),\n    error: (msg, fields) => write(\"error\", msg, fields),\n    child: (extra) => createLogger(minLevel, { ...base, ...extra }, now),\n  };\n}\n\nexport function errorFields(err: unknown): Fields {\n  if (err instanceof Error) {\n    return { err: { name: err.name, message: err.message, stack: err.stack } };\n  }\n  return { err: String(err) };\n}",
          "output": "",
          "explanation": "This file prints nothing by itself; it only defines the logger. write() first drops lines below the minimum level by comparing their numbers in rank. Then it prints one JSON line. child() returns a new logger whose base fields are the old ones plus the extra ones."
        },
        {
          "language": "typescript",
          "filename": "src/logger-demo.ts",
          "source": "import { createLogger } from \"./logger.ts\";\n\nconst fixedClock = () => new Date(\"2026-01-01T00:00:00.000Z\");\nconst log = createLogger(\"info\", {}, fixedClock);\n\nlog.info(\"server started\", { port: 3000 });\nlog.debug(\"hidden\");\nlog.child({ requestId: \"abc\" }).warn(\"slow query\", { durationMs: 812 });",
          "output": "{\"time\":\"2026-01-01T00:00:00.000Z\",\"level\":\"info\",\"msg\":\"server started\",\"port\":3000}\n{\"time\":\"2026-01-01T00:00:00.000Z\",\"level\":\"warn\",\"msg\":\"slow query\",\"requestId\":\"abc\",\"durationMs\":812}",
          "explanation": "Save this next to logger.ts and run it with bun run src/logger-demo.ts from the project folder. The minimum level is info, so log.debug(\"hidden\") prints nothing. The child logger adds requestId to its line. In the real server you do not pass a fixed clock, so time is the real current time."
        }
      ],
      "productionNote": "Production platforms collect whatever your process writes to stdout (the normal output stream) and ship it to a search system, so writing JSON lines with console.log is enough; no log files and no extra library are needed. Keep field names consistent (always requestId, never sometimes request_id) so queries and alerts keep working. Log at info for normal operation, and treat every error-level line as something a person may be paged for.",
      "commonMistakes": [
        "Logging secrets: passwords, session tokens, cookies, Authorization headers or whole request bodies. Log ids and counts instead.",
        "Printing multi-line text (for example console.log(err) with a stack trace). Log aggregators (services that collect logs from many machines into one searchable place) treat each line as a separate entry, so the trace is shredded. Put the stack in a JSON field.",
        "Calling console.log with a plain object in production. It prints a developer-friendly format that is not valid JSON, so tools cannot parse it. Always go through JSON.stringify, which the logger does."
      ],
      "sources": [
        { "title": "MDN: JSON.stringify()", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify" },
        { "title": "OWASP Logging Cheat Sheet", "url": "https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html" }
      ]
    },
    {
      "id": "request-ids-and-timing",
      "title": "Request IDs & request timing",
      "explanation": "When many requests run at once, their log lines are interleaved. A request ID is a unique label given to each request and put on every log line that request produces. It is also sent back to the client in a response header named X-Request-Id. If a customer reports a problem, they give you that ID and you search the logs for it to see everything that happened.\n\nThe ID is made with crypto.randomUUID(), a built-in function that returns a random, practically unique 36-character string. A caller (such as a gateway in front of your server) may already have sent an X-Request-Id request header, and reusing it lets one ID follow a request across several services. But the header is input from outside, so it is untrusted: someone could send a very long value or text meant to confuse your logs (log injection). We accept it only if it matches the pattern /^[A-Za-z0-9-]{1,64}$/, meaning 1 to 64 letters, digits or dashes. Anything else is ignored and we generate our own.\n\nTiming uses performance.now(), which returns the milliseconds elapsed on a precise clock (used in topic 05). Read it before and after the handler runs, subtract, and round: that is durationMs.\n\nThe code is a wrapper function, withRequestContext, that sits around your request handler. A wrapper is a function that takes another function and returns a new one that does extra work before and after calling it. Ours creates the ID and a child logger, runs the handler, adds the X-Request-Id header to the response, and logs one 'request completed' line with the method, path, status and durationMs. We log only the path (new URL(req.url).pathname) and never the query string, because query strings can contain tokens.\n\nIn topic 19 your handle() wrapper already turns expected errors (validation, not found, conflict) into proper 4xx responses. The handler you pass to withRequestContext is that already-wrapped function, so only genuinely unexpected failures reach the catch block here. Those are logged at error level with the ID, and the 500 response body includes the same requestId so a user can quote it to support. The body never contains the stack or the internal message.\n\nOne limit: response.headers.set works on responses you create with Response.json or new Response, but a few responses (for example the one returned by fetch) have read-only headers and would throw. Our handlers build their own responses, so this is fine.",
      "analogy": "A parcel tracking number. Every scan along the route (warehouse, truck, depot, doorstep) records the same number, so when a parcel goes missing you can reconstruct its whole journey. Printing the number on the customer's receipt is the X-Request-Id header: the customer quotes it and the courier finds the journey. Checking the stopwatch at the first and last scan gives the delivery time, which is durationMs. And just as a courier would not accept a made-up tracking number scribbled by a stranger, we only reuse an incoming ID if it looks safe.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/request-context.ts",
          "source": "import { errorFields, type Logger } from \"./logger.ts\";\n\nconst SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;\n\nexport function getRequestId(req: Request): string {\n  const incoming = req.headers.get(\"x-request-id\");\n  return incoming !== null && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();\n}\n\nexport type Handler = (req: Request, log: Logger) => Response | Promise<Response>;\n\nexport function withRequestContext(log: Logger, handler: Handler) {\n  return async (req: Request): Promise<Response> => {\n    const requestId = getRequestId(req);\n    const reqLog = log.child({ requestId });\n    const started = performance.now();\n\n    let res: Response;\n    try {\n      res = await handler(req, reqLog);\n    } catch (err) {\n      reqLog.error(\"unhandled error\", errorFields(err));\n      res = Response.json(\n        { error: { code: \"INTERNAL\", message: \"Internal server error\", requestId } },\n        { status: 500 },\n      );\n    }\n\n    res.headers.set(\"X-Request-Id\", requestId);\n    reqLog.info(\"request completed\", {\n      method: req.method,\n      path: new URL(req.url).pathname,\n      status: res.status,\n      durationMs: Math.round(performance.now() - started),\n    });\n    return res;\n  };\n}",
          "output": "",
          "explanation": "getRequestId reuses a safe incoming ID or makes a new UUID. withRequestContext returns a function with the signature Bun.serve expects (a Request in, a Response out). The handler receives reqLog, the child logger that already carries requestId, so every line it writes is tagged automatically."
        },
        {
          "language": "typescript",
          "filename": "src/request-context-demo.ts",
          "source": "import { createLogger } from \"./logger.ts\";\nimport { getRequestId, withRequestContext } from \"./request-context.ts\";\n\nconst good = getRequestId(new Request(\"http://localhost/x\", { headers: { \"X-Request-Id\": \"abc-123\" } }));\nconst bad = getRequestId(new Request(\"http://localhost/x\", { headers: { \"X-Request-Id\": \"not safe!\" } }));\nconsole.log(good);\nconsole.log(bad.length, bad === \"not safe!\");\n\n// Minimum level \"error\" keeps the info line quiet so the output is stable.\nconst log = createLogger(\"error\");\nconst handler = withRequestContext(log, () => Response.json({ ok: true }));\nconst res = await handler(new Request(\"http://localhost/orders/1\", { headers: { \"X-Request-Id\": \"abc-123\" } }));\nconsole.log(res.status, res.headers.get(\"X-Request-Id\"));",
          "output": "abc-123\n36 false\n200 abc-123",
          "explanation": "The safe ID abc-123 is kept. The value \"not safe!\" contains a space and an exclamation mark, so it is rejected and a fresh 36-character UUID is used instead. The wrapped handler returns status 200 and the response carries the same X-Request-Id header we sent in."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "curl -i http://localhost:3000/orders/1 -b jar.txt",
          "output": "HTTP/1.1 200 OK\nX-Request-Id: 6f1c2b9e-8a4d-4c3e-9b57-2d0e1a7c4f10\n...\n\n(server log line, ID and durationMs differ on every run)\n{\"time\":\"2026-11-22T10:15:03.120Z\",\"level\":\"info\",\"msg\":\"request completed\",\"requestId\":\"6f1c2b9e-8a4d-4c3e-9b57-2d0e1a7c4f10\",\"method\":\"GET\",\"path\":\"/orders/1\",\"status\":200,\"durationMs\":3}",
          "explanation": "curl -i prints the response headers; -b jar.txt sends the session cookie saved in topic 20. The ID in the header matches the requestId in the server's log line. The ID, time and durationMs shown here are examples."
        }
      ],
      "productionNote": "In a system made of several services, the first service in the chain creates (or accepts) the ID and passes it on in the X-Request-Id header of every call it makes, so one ID spans the whole journey. Slow requests then show up as high durationMs values you can chart or alert on. Keep health-check requests out of this wrapper if they would flood the logs, as the next sub-topic does.",
      "commonMistakes": [
        "Trusting any incoming X-Request-Id. A huge or specially crafted value ends up in your logs (log injection). Validate it against a strict pattern and fall back to a generated UUID.",
        "Logging the full URL with its query string. Query strings can hold tokens or personal data; log req.url's pathname only.",
        "Forgetting to use the child logger inside handlers, so their lines have no requestId and cannot be matched to the request."
      ],
      "sources": [
        { "title": "MDN: Crypto.randomUUID()", "url": "https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID" },
        { "title": "MDN: Performance.now()", "url": "https://developer.mozilla.org/en-US/docs/Web/API/Performance/now" }
      ]
    },
    {
      "id": "health-and-readiness",
      "title": "Health & readiness endpoints with a DB check",
      "explanation": "Platforms that run your server (Docker, Kubernetes, a cloud load balancer, which is the machine that spreads traffic over several copies of your server) (Docker and Kubernetes are popular tools that run copies of your app; each timed call of this kind is called a probe) need a way to ask 'is this copy okay?'. They do it by calling a URL on a timer. The convention is two endpoints with different meanings.\n\nLiveness, GET /health/live, answers 'is the process running and able to respond at all?'. It returns 200 with {\"status\":\"ok\"} and checks nothing else. If it ever fails, the platform restarts the process. Because it is a fixed answer, it can be a simple route in the routes object (topic 08).\n\nReadiness, GET /health/ready, answers 'should I send traffic to this copy right now?'. It runs the query SELECT 1 (a query that just returns the number 1, proving the database connection works). If that succeeds it returns 200 with {\"status\":\"ready\",\"db\":\"ok\"}. If it fails it returns 503 (Service Unavailable) with {\"status\":\"unavailable\",\"db\":\"down\"}, and the load balancer simply stops sending requests to this copy until it is ready again. Nothing is restarted.\n\nNever let a check wait forever. If the database is unreachable, a query can hang, and then the health check hangs too. checkDb races the query against a timer with Promise.race(list), which settles as soon as the first promise does.\n\nThe timer is a promise built by hand with new Promise((resolve, reject) => ...) that calls reject after timeoutMs. The finally block cancels it with clearTimeout, and Promise<never> means a promise that never produces a value, only an error.\n\nThe routes also use a shared state object, { shuttingDown: false }, created once in src/index.ts and passed to everything that needs it. While the flag is true, readiness answers 503 with {\"status\":\"shutting_down\"}. The next sub-topic is where the flag gets flipped. Add the routes to your server by spreading them into the routes object: ...createHealthRoutes({ sql, state }).\n\nThe endpoints need no login (the platform has no session) and must not print secrets, connection strings or error messages; the fixed words above are enough.",
      "analogy": "A shop's front sign. The light being on means 'someone is inside' (liveness: if the lights are out, the owner is called to check on the shop). The 'Open' sign means 'ready for business' (readiness: the till works and the stock has arrived). If the till breaks, you flip the sign to 'Closed' but you do not fire the staff. When the shop is closing for the night, you flip the sign to 'Closed' first, before anyone leaves the building. Liveness and readiness are two different signs because they trigger two different reactions.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/routes/health.routes.ts",
          "source": "import type { SQL } from \"bun\";\n\nexport interface ShutdownState {\n  shuttingDown: boolean;\n}\n\nexport async function checkDb(ping: () => Promise<unknown>, timeoutMs: number): Promise<boolean> {\n  let timer: ReturnType<typeof setTimeout> | undefined; // the type setTimeout returns\n  const timeout = new Promise<never>((_, reject) => {\n    timer = setTimeout(() => reject(new Error(\"database check timed out\")), timeoutMs);\n  });\n  try {\n    await Promise.race([ping(), timeout]);\n    return true;\n  } catch {\n    return false;\n  } finally {\n    clearTimeout(timer);\n  }\n}\n\nexport function createHealthRoutes(deps: { sql: SQL; state: ShutdownState }) {\n  const { sql, state } = deps;\n  return {\n    \"/health/live\": {\n      GET: () => Response.json({ status: \"ok\" }),\n    },\n    \"/health/ready\": {\n      GET: async () => {\n        if (state.shuttingDown) {\n          return Response.json({ status: \"shutting_down\" }, { status: 503 });\n        }\n        const dbUp = await checkDb(async () => {\n          await sql`SELECT 1`;\n        }, 1000);\n        if (!dbUp) {\n          return Response.json({ status: \"unavailable\", db: \"down\" }, { status: 503 });\n        }\n        return Response.json({ status: \"ready\", db: \"ok\" });\n      },\n    },\n  };\n}",
          "output": "",
          "explanation": "checkDb takes a function that performs the check (ping) so the timeout logic is separate from the database. The readiness route checks the shutdown flag first, so it can answer 503 without touching the database. The timeout is 1000 ms (one second)."
        },
        {
          "language": "typescript",
          "filename": "src/health-demo.ts",
          "source": "import { checkDb } from \"./routes/health.routes.ts\";\n\nconsole.log(\"ok:\", await checkDb(async () => \"fine\", 50));\nconsole.log(\"failing:\", await checkDb(async () => { throw new Error(\"connection refused\"); }, 50));\nconsole.log(\"hanging:\", await checkDb(() => new Promise<never>(() => {}), 50));",
          "output": "ok: true\nfailing: false\nhanging: false",
          "explanation": "No database is needed to see the logic. A check that succeeds gives true. A check that throws gives false. A check that never finishes (a promise that is never resolved) loses the race to the 50 ms timer, so it also gives false instead of hanging."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "curl -i http://localhost:3000/health/ready\n# now stop PostgreSQL, then run the same command again\ncurl -i http://localhost:3000/health/ready",
          "output": "HTTP/1.1 200 OK\n...\n{\"status\":\"ready\",\"db\":\"ok\"}\n\nHTTP/1.1 503 Service Unavailable\n...\n{\"status\":\"unavailable\",\"db\":\"down\"}",
          "explanation": "With the database up, readiness returns 200. After PostgreSQL stops, the query fails or hangs, the one-second timeout fires, and the endpoint returns 503. The server itself keeps running, and /health/live still returns 200."
        }
      ],
      "productionNote": "Point the platform's liveness probe at /health/live and its readiness probe at /health/ready (Kubernetes calls these probes). During a rolling deploy, where new copies replace old ones gradually, the new copy receives traffic only after readiness passes, and the old copy is taken out of rotation when its readiness turns 503 at shutdown. Health requests arrive every few seconds, so these routes are deliberately not wrapped in withRequestContext, to keep the logs readable.",
      "commonMistakes": [
        "Making liveness check the database. A short database outage would then make the platform restart perfectly healthy servers, which makes the outage worse. Only readiness should look at dependencies.",
        "No timeout on the database check, so a hung database makes the health endpoint hang and the platform marks the check as failed in unpredictable ways.",
        "Returning error messages or connection details in the health body. Anyone who can reach the endpoint can read it."
      ],
      "sources": [
        { "title": "Bun: Routing", "url": "https://bun.com/docs/runtime/http/routing" },
        { "title": "Kubernetes: Configure liveness, readiness and startup probes", "url": "https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/" }
      ]
    },
    {
      "id": "graceful-shutdown",
      "title": "Handling SIGTERM/SIGINT: server.stop() & closing the pool",
      "explanation": "A signal is a short message the operating system sends to a running process. SIGINT is what your terminal sends when you press Ctrl+C. SIGTERM means 'please terminate'; platforms send it when they deploy a new version or scale down.\n\nBoth can be caught: process.on(\"SIGTERM\", handler) registers a function to run when the signal arrives (process.on is the same signal API that Node.js (another JavaScript runtime) provides, and Bun supports it too). If you do not catch them, the process dies immediately, cutting off requests that are half answered and leaving database connections open.\n\nA graceful shutdown does these steps in a strict order. First, set state.shuttingDown = true so readiness answers 503 and the load balancer stops sending new traffic. Second, await server.stop(). In Bun 1.4 this closes idle connections and waits for requests that are already running (in-flight requests) to finish; calling server.stop(true) instead force-closes everything immediately. Third, await sql.close({ timeout: 5 }), which waits up to 5 seconds for running queries and then closes the connection pool. Fourth, log 'shutdown complete' and call process.exit(0), where exit code 0 means success.\n\nThe order matters: the pool must close after the server, because in-flight requests may still be using the database. Closing it first makes those requests fail.\n\nTwo safety measures. A guard: if (state.shuttingDown) return makes a second signal (someone pressing Ctrl+C twice) do nothing instead of starting a second shutdown. A hard timeout: setTimeout(() => { ...; process.exit(1); }, 10_000) forces exit with code 1 (failure) after 10 seconds if something hangs, such as a request that never finishes. .unref() on that timer means the timer alone does not keep the process alive, so a normal shutdown can end earlier. The number 10_000 is just 10000 with an underscore for readability.\n\nprocess.on(\"SIGTERM\", () => void shutdown(\"SIGTERM\")): shutdown is an async function, so calling it returns a promise. The void operator evaluates an expression and throws the result away; here it shows that we are deliberately not waiting for that promise. Inside shutdown, a try/catch logs unexpected failures and exits with code 1 so the error is never silently lost.\n\nThe file src/index.ts is the entry point from topic 06, and it is now complete. It loads config (07), creates the logger, creates the database pool (the same new SQL(...) as in src/db.ts from topic 13, shown inline so this file is whole), builds the server with createServer (topics 08 and 18), logs that it started, and registers the signal handlers. The config field names below (databaseUrl, logLevel) follow the config.ts you wrote in topic 07; adjust them if yours differ.",
      "analogy": "Closing a restaurant. First you flip the sign to 'Closed' and lock the door to new guests (readiness 503, server stops accepting). Seated diners are allowed to finish their meals (in-flight requests complete). Only when the last diner has left do you turn off the kitchen gas (close the database pool), and finally the lights (process exits). If one diner never leaves, the manager calls time after a fixed limit and everyone goes home (the hard 10-second timeout). Turning off the gas while diners are still eating would be the wrong order.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/index.ts",
          "source": "import { SQL } from \"bun\";\nimport { loadConfig } from \"./config.ts\";\nimport { createLogger, errorFields } from \"./logger.ts\";\nimport { createServer } from \"./server.ts\";\n\nconst config = loadConfig();\nconst log = createLogger(config.logLevel);\nconst sql = new SQL(config.databaseUrl, { max: 10 });\nconst state = { shuttingDown: false };\n\nconst server = createServer({ config, sql, log, state });\nlog.info(\"server started\", { url: server.url.href });\n\nasync function shutdown(signal: string): Promise<void> {\n  if (state.shuttingDown) return; // ignore a second signal\n  state.shuttingDown = true; // readiness now answers 503\n  log.info(\"shutting down\", { signal });\n\n  // Hard stop if something hangs. unref() lets a normal shutdown end sooner.\n  setTimeout(() => {\n    log.error(\"shutdown timed out, forcing exit\");\n    process.exit(1);\n  }, 10_000).unref();\n\n  try {\n    await server.stop(); // let in-flight requests finish\n    await sql.close({ timeout: 5 }); // then close the database pool\n    log.info(\"shutdown complete\");\n    process.exit(0);\n  } catch (err) {\n    log.error(\"shutdown failed\", errorFields(err));\n    process.exit(1);\n  }\n}\n\nprocess.on(\"SIGTERM\", () => void shutdown(\"SIGTERM\"));\nprocess.on(\"SIGINT\", () => void shutdown(\"SIGINT\"));",
          "output": "",
          "explanation": "Nothing is printed at import time except the 'server started' line when you actually run it (shown in the terminal example below). The order inside shutdown is: flag, log, safety timer, server.stop(), sql.close(), log, exit."
        },
        {
          "language": "typescript",
          "filename": "src/stop-demo.ts",
          "source": "const server = Bun.serve({\n  port: 0,\n  async fetch() {\n    await Bun.sleep(200);\n    return new Response(\"finished\");\n  },\n});\n\nconst pending = fetch(server.url); // starts a slow request\nawait Bun.sleep(50); // make sure it is in flight\nawait server.stop(); // waits for it, refuses new ones\nconsole.log(\"stop returned\");\nconsole.log(await (await pending).text());\n\ntry {\n  await fetch(server.url);\n} catch {\n  console.log(\"new connections refused\");\n}",
          "output": "stop returned\nfinished\nnew connections refused",
          "explanation": "Run it with bun run src/stop-demo.ts. The slow request that was already running still gets its full answer, which is the point of a graceful stop. A request made after stop() cannot connect, so fetch throws and we print the last line. Port 0 asks the operating system for any free port."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "bun run src/index.ts\n# press Ctrl+C in this terminal",
          "output": "{\"time\":\"2026-11-22T10:15:00.512Z\",\"level\":\"info\",\"msg\":\"server started\",\"url\":\"http://localhost:3000/\"}\n^C{\"time\":\"2026-11-22T10:15:07.044Z\",\"level\":\"info\",\"msg\":\"shutting down\",\"signal\":\"SIGINT\"}\n{\"time\":\"2026-11-22T10:15:07.061Z\",\"level\":\"info\",\"msg\":\"shutdown complete\"}",
          "explanation": "Open a terminal in the project folder, start the server, then press Ctrl+C. The ^C is your terminal echoing the key. Times and the port are examples. A platform's SIGTERM produces the same two lines with \"signal\":\"SIGTERM\"."
        }
      ],
      "productionNote": "Platforms send SIGTERM and then wait a limited time before force-killing the process, so your own hard timeout should be shorter than that wait. During a deploy, readiness flips to 503 first, the load balancer drains traffic, in-flight requests finish, the pool closes cleanly and no user sees a dropped request. Always test it locally: start the server, fire a slow request, press Ctrl+C, and confirm the request still completes.",
      "commonMistakes": [
        "Closing the database pool before the server has finished its requests, so in-flight requests fail with connection errors.",
        "Calling process.exit() straight away in the signal handler. That is exactly the abrupt stop graceful shutdown is meant to avoid.",
        "No hard timeout, so one hung request keeps the process alive until the platform kills it without any log line.",
        "Not guarding against a second signal, which starts two shutdowns at once and closes things twice."
      ],
      "sources": [
        { "title": "Bun: HTTP server (server.stop)", "url": "https://bun.com/docs/api/http" },
        { "title": "Node.js: process signal events", "url": "https://nodejs.org/api/process.html#signal-events" },
        { "title": "Bun: SQL client (sql.close)", "url": "https://bun.com/docs/api/sql" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why does a structured logger write exactly one JSON object per line?",
      "options": [
        "It makes the log file smaller than any other format.",
        "Each line can be parsed on its own and searched or filtered by field, such as level or requestId.",
        "JSON lines are encrypted, so secrets in them are safe.",
        "Bun refuses to print anything to stdout that is not JSON."
      ],
      "answerIndex": 1,
      "explanation": "One object per line lets log tools parse each line independently and query fields like level or durationMs. It is not about size, encryption, or any Bun restriction."
    },
    {
      "question": "What problem does returning an X-Request-Id response header to the client solve?",
      "options": [
        "The client can quote the ID in a bug report, and you can find every log line from that request.",
        "It makes the response arrive faster.",
        "It proves to the server that the user is logged in.",
        "It stops the database from running slow queries."
      ],
      "answerIndex": 0,
      "explanation": "The ID links what the client saw to what the server logged. It has no effect on speed, authentication or query performance."
    },
    {
      "question": "Should the liveness endpoint (/health/live) query the database? Why or why not?",
      "options": [
        "Yes, because a server without a database is already dead and must be restarted at once.",
        "Yes, but only with no timeout so the result is accurate.",
        "No, because liveness endpoints are not allowed to return JSON.",
        "No, because a short database outage would make the platform restart healthy servers; only readiness should check dependencies."
      ],
      "answerIndex": 3,
      "explanation": "Liveness failure triggers a restart, and restarting the app does not fix a database problem. Readiness failure only stops traffic, which is the right reaction to a dependency being down."
    },
    {
      "question": "What is the correct graceful shutdown order?",
      "options": [
        "Close the database pool, stop the server, then set the shuttingDown flag.",
        "Set the shuttingDown flag, stop the server and let in-flight requests finish, then close the database pool.",
        "Stop the server, call process.exit(0) at once, then close the pool.",
        "Close the pool and the server at the same moment with Promise.race."
      ],
      "answerIndex": 1,
      "explanation": "The flag makes readiness 503 so new traffic stops, the server finishes running requests (which may still need the database), and only then is the pool closed. Closing the pool first breaks in-flight requests."
    },
    {
      "question": "In Bun 1.4, what does await server.stop() (without true) do with requests that are already in flight?",
      "options": [
        "It cancels them immediately and sends each client an error.",
        "It ignores them and returns before they finish, leaving them running forever.",
        "It closes idle connections and waits for the in-flight requests to finish.",
        "It restarts the server on a new port and moves the requests there."
      ],
      "answerIndex": 2,
      "explanation": "Plain stop() is the graceful form: idle connections are closed and running requests complete. Only stop(true) force-closes everything immediately."
    }
  ]
});
