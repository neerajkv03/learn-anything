# 21. Logging, Health Checks & Graceful Shutdown
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 20-auth

## Learning goals
- Learner can write a small structured JSON logger with levels from config.
- Learner can attach a request ID to every request/log line/response and log request duration.
- Learner can expose liveness and readiness endpoints with a DB check and timeout.
- Learner can shut down gracefully on SIGTERM/SIGINT: stop accepting, finish in-flight, close pool, exit.
- Learner can read the final `src/index.ts` bootstrap.

## Sub-topics
### Structured JSON logging
- Concept: structured log = one JSON object per line (machine-searchable) instead of free text. Fields: `time` (ISO), `level`, `msg`, plus context (`requestId`, `userId`, `durationMs`). Levels debug < info < warn < error; config `logLevel` (07) filters. `src/logger.ts` exports `createLogger(level)` returning `{ debug, info, warn, error, child(fields) }`; writes via `console.log(JSON.stringify(...))` (stdout) — platform collects. Never log passwords, tokens, cookies, full bodies; errors logged with `err.name`, `err.message`, `err.stack`.
- Analogy: ship's logbook with fixed columns (time, event, position) — anyone can search "all storms in March"; free-text diary entries can't be searched reliably.
- Code example: `const log = createLogger("info"); log.info("server started", { port: 3000 }); log.debug("hidden");` → one line `{"time":"<ISO>","level":"info","msg":"server started","port":3000}` (debug suppressed). Child: `log.child({ requestId: "abc" }).warn("slow query", { durationMs: 812 })` → `{"time":"<ISO>","level":"warn","msg":"slow query","requestId":"abc","durationMs":812}`. Author: key order follows object construction `{ time, level, msg, ...base, ...fields }`.
- Production use: log aggregation/search, alerts.
- Common mistakes: logging secrets; multi-line logs; `console.log` of objects in prod (not JSON).
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify ; https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

### Request IDs & request timing
- Concept: request ID = unique id per request (`crypto.randomUUID()`, or reuse incoming `X-Request-Id` if it matches a safe pattern like `/^[A-Za-z0-9-]{1,64}$/`), included in every log line and returned as `X-Request-Id` response header → correlate client reports with logs. Timing: `performance.now()` before/after → `durationMs` rounded. Extend 19's `handle()` wrapper (or a `withRequestContext` wrapper) to: create requestId + child logger, call handler, set header, log `request completed` with method, path, status, durationMs; errors logged at error level with requestId (500 body may include `requestId` so support can find it).
- Analogy: parcel tracking number — every scan along the route records the same number, so a lost parcel's whole journey can be traced.
- Code example: `curl -i http://localhost:3000/orders/1 -b jar.txt` → response header `X-Request-Id: <uuid>`; log line `{"time":"<ISO>","level":"info","msg":"request completed","requestId":"<uuid>","method":"GET","path":"/orders/1","status":200,"durationMs":3}` (durationMs illustrative).
- Production use: debugging incidents across services.
- Common mistakes: trusting arbitrary incoming ids (log injection); logging query strings with tokens.
- Sources: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID ; https://developer.mozilla.org/en-US/docs/Web/API/Performance/now

### Health & readiness endpoints with a DB check
- Concept: liveness `GET /health/live` → 200 `{"status":"ok"}` if process responds (static route OK); readiness `GET /health/ready` → runs `SELECT 1` with timeout (`Promise.race` with `Bun.sleep(1000)` → throws) → 200 `{"status":"ready","db":"ok"}` or 503 `{"status":"unavailable","db":"down"}`; also 503 while shutting down (flag). Load balancers/orchestrators route traffic only to ready instances. No auth, no secrets in output.
- Analogy: shop sign — "lights on" (live: someone's inside) vs "open for business" (ready: till works, stock arrived); during closing the sign flips to "closed" before staff leave.
- Code example: `src/routes/health.routes.ts` `createHealthRoutes({ sql, state })`; DB up → `curl -i .../health/ready` → `200` `{"status":"ready","db":"ok"}`; PostgreSQL stopped → `503` `{"status":"unavailable","db":"down"}`.
- Production use: deploy checks, rolling updates.
- Common mistakes: liveness that checks DB (restarts healthy app during DB blip); no timeout (check hangs).
- Sources: https://bun.com/docs/runtime/http/routing ; https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/

### Handling SIGTERM/SIGINT: server.stop() & closing the pool
- Concept: signal = OS message to a process; SIGTERM = "please stop" (sent by platforms on deploy), SIGINT = Ctrl+C. `process.on("SIGTERM", handler)` (Node-compatible API; cite Node docs). Graceful order: set `state.shuttingDown = true` (readiness → 503) → `await server.stop()` (1.4: closes idle connections, waits for in-flight requests; `stop(true)` force-closes) → `await sql.close({ timeout: 5 })` → log → `process.exit(0)`. Guard against double signals; hard timeout (e.g. 10 s `setTimeout(() => process.exit(1), 10_000).unref()`) in case something hangs. Final `src/index.ts`: load config → logger → `new SQL` (db.ts) → `createServer` → log started → register signals.
- Analogy: closing a restaurant — lock the door to new guests, let seated diners finish, then turn off the kitchen gas (DB pool), then switch off the lights; if a diner never leaves, the manager calls time after 10 minutes.
- Code example: `src/index.ts` final — `const state = { shuttingDown: false }; const server = createServer({ config, sql, log, state }); log.info("server started", { url: server.url.href }); async function shutdown(signal: string) { if (state.shuttingDown) return; state.shuttingDown = true; log.info("shutting down", { signal }); setTimeout(() => process.exit(1), 10_000).unref(); await server.stop(); await sql.close({ timeout: 5 }); log.info("shutdown complete"); process.exit(0); } process.on("SIGTERM", () => void shutdown("SIGTERM")); process.on("SIGINT", () => void shutdown("SIGINT"));` → on Ctrl+C logs `{"...","level":"info","msg":"shutting down","signal":"SIGINT"}` then `{"...","msg":"shutdown complete"}`. Gloss `void` (ignore returned promise deliberately).
- Production use: zero dropped requests during deploys.
- Common mistakes: closing pool before server finishes requests; `process.exit()` immediately on signal; no hard timeout.
- Sources: https://bun.com/docs/api/http ; https://nodejs.org/api/process.html#signal-events ; https://bun.com/docs/api/sql

## Quiz
1. Why one JSON object per log line? — tests structured logging
2. What problem does returning `X-Request-Id` to clients solve? — tests request IDs
3. Should liveness check the database? why not — tests health endpoints
4. Correct shutdown order: pool, server, readiness flag? — tests graceful shutdown
5. What does `server.stop()` without `true` do with in-flight requests? — tests server.stop
