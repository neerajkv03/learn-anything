# 06. Production-Ready App
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 05-docker-containers

Small changes to existing app code so it behaves well on ECS behind an ALB. Bun.sql glossed here (full in topic 11): `import { SQL } from "bun"`.

## Learning goals
- Learner can load and validate config from env vars, failing fast on missing values.
- Learner can add /healthz (liveness) and /readyz (readiness) endpoints.
- Learner can shut down gracefully on SIGTERM without dropping requests.
- Learner can emit one-line JSON logs.
- Learner can explain why servers must be stateless and set Bun.serve production options.

## Sub-topics
### Config from environment variables
- Concept: 12-factor style: all env-specific settings (DB URL, Valkey URL, log level) from env vars; secrets injected by ECS from Secrets Manager (topic 09). Validate at startup; crash with clear message if missing → ECS shows the failure immediately. In prod disable .env loading (`--no-env-file` or bunfig `env = false`).
- Analogy: a pilot's pre-flight checklist: if fuel isn't confirmed, the plane doesn't take off — better than discovering it mid-air.
- Code example: `config.ts` — `function required(name: string): string { const v = process.env[name]; if (!v) throw new Error(\`Missing env var ${name}\`); return v; } export const config = { port: Number(process.env.PORT ?? 3000), databaseUrl: required("DATABASE_URL"), redisUrl: required("REDIS_URL"), logLevel: process.env.LOG_LEVEL ?? "info" };` Run without DATABASE_URL: `bun run index.ts` → crashes with `error: Missing env var DATABASE_URL` (Bun prints the Error message; exact stack lines vary). With vars set → starts.
- Production use: same image, different env per account.
- Common mistakes: default values for secrets; reading config lazily deep in code (fails on first request, not at boot); relying on .env files in containers.
- Sources: https://bun.com/docs/runtime/environment-variables ; https://12factor.net/config

### Health and readiness endpoints
- Concept: liveness `/healthz` = process alive, cheap, no dependencies (200 "ok"). Readiness `/readyz` = can serve traffic now (DB `SELECT 1` ok, not shutting down) → 200 or 503. ALB health check uses /healthz (avoid whole fleet failing when DB blips); readiness flips to 503 during shutdown. Gloss 503.
- Analogy: shop staff: "are you awake?" (liveness) vs "is your till open?" (readiness). A cashier counting the drawer is awake but not ready.
- Code example: `health.ts` — `let shuttingDown = false; Bun.serve({ routes: { "/healthz": new Response("ok"), "/readyz": async () => { if (shuttingDown) return new Response("draining", { status: 503 }); try { await sql\`SELECT 1\`; return new Response("ready"); } catch { return new Response("db down", { status: 503 }); } } }, fetch() { return new Response("not found", { status: 404 }); } });` `curl -s localhost:3000/healthz` → `ok`; with DB up `curl -s localhost:3000/readyz` → `ready`; with DB stopped → `db down` and status 503.
- Production use: ALB target group health check path /healthz (topic 10); container healthCheck (topic 09).
- Common mistakes: health check hits DB → DB hiccup marks every task unhealthy → total outage; slow/expensive health checks at high frequency; health route behind auth.
- Sources: https://bun.com/docs/api/http ; https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html

### Graceful shutdown on SIGTERM
- Concept: ECS stops a task by sending SIGTERM, waits stopTimeout (default 30 s), then SIGKILL. On SIGTERM: mark not ready, `await server.stop()` (graceful: in-flight finish, idle keep-alive closed), `await sql.close({ timeout: 5 })`, exit 0. ALB deregistration delay (topic 10) drains new traffic first. `process.on("SIGTERM")` is the Node process API Bun implements (Bun HTTP docs don't cover signals — cite Node docs).
- Analogy: closing a restaurant for the night: lock the door to new guests, let seated diners finish, then turn off the stove.
- Code example: `shutdown.ts` — `process.on("SIGTERM", async () => { shuttingDown = true; console.log(JSON.stringify({ level: "info", msg: "shutdown start", pending: server.pendingRequests })); await server.stop(); await sql.close({ timeout: 5 }); console.log(JSON.stringify({ level: "info", msg: "shutdown done" })); process.exit(0); });` Test: run, then `kill -TERM <pid>` → two log lines, e.g. `{"level":"info","msg":"shutdown start","pending":0}` then `{"level":"info","msg":"shutdown done"}`.
- Production use: every deploy/scale-in stops tasks; done right = zero 5XX during deploys.
- Common mistakes: `server.stop(true)` (kills in-flight); ignoring SIGTERM → SIGKILL after 30 s with dropped requests; work taking longer than stopTimeout.
- Sources: https://bun.com/docs/api/http ; https://bun.com/docs/runtime/sql ; https://nodejs.org/api/process.html#signal-events ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definition_timeout

### Structured JSON logging
- Concept: one JSON object per line on stdout (no files); fields: time, level, msg, method, path, status, ms, requestId. CloudWatch Logs Insights auto-parses JSON fields (topic 18). Log levels debug/info/warn/error; avoid logging secrets/PII. At 250K RPS, per-request info logs cost money → sample or log only errors/slow.
- Analogy: a ship's logbook with fixed columns (time, position, weather) instead of free-form diary; anyone can search "all entries where weather = storm".
- Code example: `log.ts` — `export function log(level: string, msg: string, fields: Record<string, unknown> = {}) { console.log(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields })); }` with a fixed time for the demo: `console.log(JSON.stringify({ time: "2026-11-22T10:00:00.000Z", level: "info", msg: "request", method: "GET", path: "/api/orders", status: 200, ms: 3 }))` → `{"time":"2026-11-22T10:00:00.000Z","level":"info","msg":"request","method":"GET","path":"/api/orders","status":200,"ms":3}`.
- Production use: awslogs driver ships stdout to CloudWatch (topic 09); Logs Insights queries (topic 18).
- Common mistakes: multi-line logs (stack traces split into many events — put stack in one field); logging every request at peak (cost); logging tokens/passwords.
- Sources: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_AnalyzeLogData-discoverable-fields.html ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_awslogs.html

### Stateless servers
- Concept: any task may receive any request and may be killed anytime → no in-memory sessions, carts, uploads, or rate-limit counters; store in Valkey/Aurora/S3. Enables horizontal scaling to 65+ tasks.
- Analogy: call-centre agents: any agent can take your call because your case notes are in the shared system, not in one agent's notebook.
- Code example: contrast `bad-session.ts` `const sessions = new Map<string, string>(); sessions.set("abc", "user-1");` (lost on restart, invisible to other tasks) vs `good-session.ts` `await redis.send("SET", ["session:abc", "user-1", "EX", "3600"]); console.log(await redis.get("session:abc"));` → `user-1` (Bun RedisClient; full in topic 14).
- Production use: ALB spreads requests round-robin; no sticky sessions needed.
- Common mistakes: sticky sessions as a crutch; local file uploads; per-process caches that disagree.
- Sources: https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_prevent_interaction_failure_stateless.html ; https://bun.com/docs/runtime/redis

### Bun.serve production settings
- Concept: NODE_ENV=production turns off dev mode (no detailed error pages; plain 500 on uncaught errors); custom `error(err)` handler logs and returns 500. `idleTimeout` (default 10 s, max 255) must be longer than ALB idle timeout (default 60 s) or the server closes connections the ALB still thinks are open → sporadic 502s → set 65. `maxRequestBodySize` default 128 MB → lower to 1 MB for a JSON API. hostname 0.0.0.0 default.
- Analogy: a shop keeping its back door open a little longer than the delivery driver waits, so the driver never finds it shut mid-delivery.
- Code example: `index.ts` — `const server = Bun.serve({ port: config.port, idleTimeout: 65, maxRequestBodySize: 1024 * 1024, routes: { ... }, error(err) { log("error", "unhandled", { err: String(err) }); return new Response("internal error", { status: 500 }); }, fetch() { return new Response("not found", { status: 404 }); } }); log("info", "listening", { port: server.port, development: server.development });` with NODE_ENV=production → log has `"development":false`. Sending a 2 MB body → request rejected (413 Payload Too Large; say "rejected" if unsure of exact code).
- Production use: matches ALB idleTimeout 60 (topic 10).
- Common mistakes: idleTimeout shorter than ALB timeout (502s); shipping dev mode; huge body limit (memory abuse).
- Sources: https://bun.com/docs/api/http ; https://bun.com/docs/runtime/http/error-handling ; https://github.com/oven-sh/bun/blob/main/packages/bun-types/serve.d.ts ; https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-load-balancer-attributes.html#connection-idle-timeout

## Quiz
1. Why should the ALB health check not query the database? — tests liveness vs readiness.
2. What happens to in-flight requests with `server.stop()` vs `server.stop(true)`? — tests graceful stop.
3. ALB idle timeout is 60 s and Bun idleTimeout is 10 s. What symptom appears? — tests keep-alive (502s).
4. Why is an in-memory Map session store broken with 3 tasks? — tests statelessness.
5. What does the app do if REDIS_URL is missing at startup, and why is that good? — tests fail-fast config.
