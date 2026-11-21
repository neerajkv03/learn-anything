window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "06-app-production-readiness",
  "order": 6,
  "title": "Production-Ready App",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "A server that works on your laptop is not yet ready to run on AWS behind a load balancer. This topic makes small changes to the app so it reads its settings from the environment, reports its own health, shuts down without dropping requests, writes searchable logs and keeps no private state. It finishes with the Bun.serve options that matter in production.",
  "prerequisites": ["05-docker-containers"],
  "subtopics": [
    {
      "id": "config-from-environment-variables",
      "title": "Config from environment variables",
      "explanation": "Config (short for configuration) is every setting that changes between environments: the database address, the cache address, the log level, the port. The 12-factor approach (a well-known checklist for cloud apps) says to keep config out of the code and read it from environment variables. You met environment variables in the Linux topic: named values the shell hands to every program it starts. The same Docker image then runs in dev, staging and prod, and only the environment variables differ.\n\nIn code, `process.env` is an object holding all environment variables. `process.env.DATABASE_URL` is the value, or `undefined` (JavaScript's \"nothing here\") when the variable is not set. The example below defines a small function `required` that reads a variable and throws an error when it is missing or empty. An error that is thrown and not handled stops the program.\n\nThis is called failing fast: validate everything once, when the program starts, and crash with a clear message if something is missing. On ECS (the AWS container service from a later topic) a task that crashes at boot shows the failure immediately in the deployment, so a bad release never receives traffic. The alternative is reading `process.env` deep in the code, where a missing value only breaks the first request that needs it, possibly hours after deploy.\n\nSecrets such as database passwords reach the app in exactly the same way: ECS will inject them from AWS Secrets Manager as environment variables (you set that up in the ECS topic). The app does not know or care where the value came from.\n\nBun also loads a `.env` file automatically if one exists in the working directory. That is handy on your laptop, but a production container should get its config only from real environment variables. You switch the automatic loading off with `env = false` in a file named `bunfig.toml` (Bun's own settings file, placed next to your `package.json`), or with the `--no-env-file` flag on the `bun` command. Your `.dockerignore` from the Docker topic already keeps `.env` files out of the image.",
      "analogy": "A pilot's pre-flight checklist. If fuel is not confirmed, the plane does not take off. That is far better than discovering the problem mid-air, which is what reading config lazily in the middle of a request does. The same plane (the same image) flies many routes (environments); only the checklist inputs change.",
      "code": [
        {
          "language": "typescript",
          "filename": "config.ts",
          "source": "function required(name: string): string {\n  const v = process.env[name];\n  if (!v) throw new Error(`Missing env var ${name}`);\n  return v;\n}\n\nexport const config = {\n  port: Number(process.env.PORT ?? 3000),\n  databaseUrl: required(\"DATABASE_URL\"),\n  redisUrl: required(\"REDIS_URL\"),\n  logLevel: process.env.LOG_LEVEL ?? \"info\",\n};\n\n// Print only non-secret fields: never log a database URL.\nconsole.log(JSON.stringify({ port: config.port, logLevel: config.logLevel }));",
          "output": "{\"port\":3000,\"logLevel\":\"info\"}",
          "explanation": "Run with both required variables set: `DATABASE_URL=postgres://app@db:5432/app REDIS_URL=redis://cache:6379 bun run config.ts`. `required` is called while the `config` object is being built, so the checks run at startup, as soon as the file loads. `PORT` and `LOG_LEVEL` have harmless defaults (`??` means \"use the right side if the left is undefined\"). The two addresses have no default on purpose: a wrong silent default could point production at the wrong database. The final line prints only the two non-secret fields."
        },
        {
          "language": "bash",
          "filename": "run-without-database-url.sh",
          "source": "REDIS_URL=redis://cache:6379 bun run config.ts",
          "output": "error: Missing env var DATABASE_URL",
          "explanation": "With `DATABASE_URL` unset, the program crashes before doing any work, and the process exits with a non-zero exit code (a number a program returns when it ends; anything other than 0 means failure), which is what ECS reacts to. Bun also prints extra lines around this message (a source excerpt, stack lines and a version line); they vary, so only the message is shown."
        },
        {
          "language": "toml",
          "filename": "bunfig.toml",
          "source": "env = false",
          "output": "",
          "explanation": "Put this in `bunfig.toml` in the project root to stop Bun from reading `.env` files automatically. The flag `--no-env-file` does the same for a single run. Real environment variables, such as those ECS injects, are still read through `process.env`."
        }
      ],
      "productionNote": "Same image, different environment variables per AWS account: staging and prod run the identical image and differ only in the values ECS injects. Because the app crashes at boot on missing config, a mistake in the task definition shows up as a failed deployment rather than as errors for users.",
      "commonMistakes": [
        "Giving secrets a default value (for example `process.env.DB_PASSWORD ?? \"password\"`). A forgotten variable then silently runs with a guessable secret instead of failing.",
        "Reading `process.env` lazily deep in the code. A missing value then fails on the first request that needs it, not at boot, so the bad release already receives traffic.",
        "Relying on `.env` files inside containers. They are easy to bake into an image by accident and leak secrets; inject real environment variables and keep `.env` out of the image."
      ],
      "sources": [
        { "title": "Bun docs: Environment variables", "url": "https://bun.com/docs/runtime/environment-variables" },
        { "title": "The Twelve-Factor App: Config", "url": "https://12factor.net/config" }
      ]
    },
    {
      "id": "health-and-readiness-endpoints",
      "title": "Health and readiness endpoints",
      "explanation": "A load balancer (the ALB you will build in a later topic) needs a way to ask each server \"are you OK?\". You provide that as two ordinary HTTP routes. An endpoint is simply a URL path your server answers.\n\nLiveness, conventionally `/healthz`, answers \"is the process alive?\". It must be cheap and must not touch any other system. It returns status 200 with the body `ok`.\n\nReadiness, conventionally `/readyz`, answers \"can this instance serve real traffic right now?\". It may check dependencies, for example running `SELECT 1` (the smallest possible SQL query; SQL is the language used to ask a database questions, and it proves the database answers). It returns 200 when ready and 503 when not. 503 is the HTTP status code \"Service Unavailable\": the server is running but cannot handle requests at the moment. Readiness also returns 503 once the server has begun shutting down, so it stops receiving new requests.\n\nThe example uses Bun's built-in SQL client: `import { sql } from \"bun\"` gives you `sql`, a tagged template: you write a query between backticks after the word `sql`, and awaiting it sends it to the database. Bun reads the database address from the `DATABASE_URL` environment variable. The full SQL client is covered in a later topic. `async` and `await` mark code that waits for something slow (like a database) without freezing the server, and `try`/`catch` runs the `catch` block if the `try` block throws an error.\n\nThe ALB health check should point at `/healthz`, not `/readyz`. If it called the database-checking route and the database blinked for 10 seconds, every task would be marked unhealthy at once and the whole service would go down because of a short blip. Readiness is for deciding whether this one instance should be given new work, for example when it is shutting down (draining: finishing current requests while taking no new ones).",
      "analogy": "Shop staff. Liveness asks \"are you awake?\": a yes means the person is there. Readiness asks \"is your till open?\": a cashier who is awake but still counting the drawer is alive and not ready to serve customers. You would not send the cashier home for being busy counting, which is why the load balancer checks liveness, not readiness.",
      "code": [
        {
          "language": "typescript",
          "filename": "health.ts",
          "source": "import { sql } from \"bun\";\n\n// Flag the shutdown code will set (next sub-topic); stays false here.\nlet shuttingDown = false;\n\nBun.serve({\n  port: 3000,\n  routes: {\n    \"/healthz\": new Response(\"ok\"),\n    \"/readyz\": async () => {\n      if (shuttingDown) return new Response(\"draining\", { status: 503 });\n      try {\n        await sql`SELECT 1`;\n        return new Response(\"ready\");\n      } catch {\n        return new Response(\"db down\", { status: 503 });\n      }\n    },\n  },\n  fetch() {\n    return new Response(\"not found\", { status: 404 });\n  },\n});",
          "output": "",
          "explanation": "`routes` maps a path to a fixed `Response` or to a function that builds one; `fetch` answers everything else with 404. The program prints nothing itself; it just keeps serving. Start it with `bun run health.ts` and query it from a second terminal (see next block)."
        },
        {
          "language": "bash",
          "filename": "check-health.sh",
          "source": "curl -s -w \"\\n\" localhost:3000/healthz\ncurl -s -w \" (status %{http_code})\\n\" localhost:3000/readyz",
          "output": "ok\ndb down (status 503)",
          "explanation": "This output is for a machine with no PostgreSQL listening and no `DATABASE_URL`: liveness still says `ok` because it checks nothing else, while readiness reports `db down` with status 503. With a reachable database set in `DATABASE_URL`, the second command prints `ready (status 200)`. `-w` tells curl to append extra text after the response."
        }
      ],
      "productionNote": "In the ECS and ALB topics you will point the ALB target group health check at `/healthz`, and use a similar liveness command for the container health check. Readiness is what your own code flips to 503 while shutting down.",
      "commonMistakes": [
        "Making the ALB health check query the database. A short database blip marks every task unhealthy at once and turns it into a full outage.",
        "Slow or expensive health checks. Every task is probed every few seconds, so a heavy check adds real load at high request rates.",
        "Putting the health route behind authentication. The load balancer sends no credentials, gets a 401 or 403 and marks the task unhealthy."
      ],
      "sources": [
        { "title": "Bun docs: HTTP server (Bun.serve)", "url": "https://bun.com/docs/api/http" },
        { "title": "AWS docs: Health checks for Application Load Balancer target groups", "url": "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html" }
      ]
    },
    {
      "id": "graceful-shutdown-on-sigterm",
      "title": "Graceful shutdown on SIGTERM",
      "explanation": "Every deploy, scale-in and crash replacement ends with ECS stopping a task. It first sends the process a SIGTERM: a signal, which is a short message the operating system delivers to a process, meaning \"please stop\". A program may catch SIGTERM and clean up. If the process is still running after the stop timeout (stopTimeout, 30 seconds by default), ECS sends SIGKILL, which cannot be caught and ends the process instantly, dropping any request still in progress.\n\nGraceful shutdown means using that window well. In order: mark the server as not ready (so readiness returns 503), call `await server.stop()`, close the database connections with `await sql.close({ timeout: 5 })`, and exit with code 0.\n\n`server.stop()` with no argument is graceful: it stops accepting new connections, lets requests that are already running finish, and closes idle keep-alive connections right away (a keep-alive connection is one the client keeps open to send several requests). `server.pendingRequests` is the number of requests currently in progress. `sql.close({ timeout: 5 })` waits up to 5 seconds for queries that already started, then closes. `process.exit(0)` ends the program with exit code 0, meaning success.\n\nThe handler is registered with `process.on(\"SIGTERM\", ...)`, which is the process.on function from Node.js (another JavaScript runtime, whose built-in functions Bun also provides). The ALB also helps: its deregistration delay (from the ALB topic) stops sending new requests to a task that is being removed, and keeps waiting for its in-flight ones.\n\nWhy this matters: with correct shutdown, deploys cause no 5XX errors (server-side error responses). Make sure your slowest legitimate request finishes in less than the stopTimeout.",
      "analogy": "Closing a restaurant for the night. First you lock the door to new guests (stop accepting connections), then you let the seated diners finish their meals (in-flight requests), and only then you turn off the stove (close database connections) and go home. Force-stopping would be turning off the lights while people are still eating.",
      "code": [
        {
          "language": "typescript",
          "filename": "shutdown.ts",
          "source": "import { sql } from \"bun\";\n\nlet shuttingDown = false;\n\nconst server = Bun.serve({\n  port: 3000,\n  routes: {\n    \"/healthz\": new Response(\"ok\"),\n    \"/readyz\": () =>\n      shuttingDown\n        ? new Response(\"draining\", { status: 503 })\n        : new Response(\"ready\"),\n  },\n  fetch() {\n    return new Response(\"not found\", { status: 404 });\n  },\n});\n\nprocess.on(\"SIGTERM\", async () => {\n  shuttingDown = true;\n  console.log(JSON.stringify({ level: \"info\", msg: \"shutdown start\", pending: server.pendingRequests }));\n  await server.stop();\n  await sql.close({ timeout: 5 });\n  console.log(JSON.stringify({ level: \"info\", msg: \"shutdown done\" }));\n  process.exit(0);\n});",
          "output": "",
          "explanation": "On its own the program prints nothing while it runs. The handler sets the flag first so `/readyz` starts returning 503 immediately, then stops the server and closes the database pool in order. Both log lines are written as JSON; the next sub-topic explains why."
        },
        {
          "language": "bash",
          "filename": "test-shutdown.sh",
          "source": "bun run shutdown.ts &\nsleep 1\nkill -TERM $!\nwait",
          "output": "{\"level\":\"info\",\"msg\":\"shutdown start\",\"pending\":0}\n{\"level\":\"info\",\"msg\":\"shutdown done\"}",
          "explanation": "`&` starts the server in the background, `$!` is the PID (process id) of that background process, and `kill -TERM` sends it SIGTERM. `wait` returns when it exits. Your shell may print an extra job line such as `[1] 12345`. `pending` is 0 because no request was in progress when the signal arrived."
        }
      ],
      "productionNote": "Every deploy and every scale-in stops tasks. Done right, you get zero 5XX errors during deploys: the ALB drains the task, readiness goes to 503, in-flight requests finish and the process exits 0 well before ECS would send SIGKILL.",
      "commonMistakes": [
        "Calling `server.stop(true)`. The `true` forces all connections closed immediately, killing requests that are in progress.",
        "Ignoring SIGTERM. The process keeps running until ECS sends SIGKILL after the stop timeout, and requests in progress are dropped.",
        "Letting work take longer than stopTimeout (30 seconds by default). Anything still running at that point is killed, so keep request time well below it."
      ],
      "sources": [
        { "title": "Bun docs: HTTP server (Bun.serve)", "url": "https://bun.com/docs/api/http" },
        { "title": "Bun docs: SQL", "url": "https://bun.com/docs/runtime/sql" },
        { "title": "Node.js docs: process signal events", "url": "https://nodejs.org/api/process.html#signal-events" },
        { "title": "AWS docs: ECS task definition parameters (container timeouts)", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definition_timeout" }
      ]
    },
    {
      "id": "structured-json-logging",
      "title": "Structured JSON logging",
      "explanation": "A log is the running record of what your program did. The simplest log is free text such as `GET /api/orders took 3ms`, which a human can read but a tool cannot query reliably. Structured logging writes each event as one JSON object on one line. JSON (JavaScript Object Notation) is a text format of named fields, like `{\"status\":200}`.\n\nIn a container, write logs to stdout (standard output, the stream `console.log` prints to), not to files. The awslogs driver (from the ECS topic) ships stdout to CloudWatch Logs, AWS's log storage service. CloudWatch Logs Insights, its query tool, discovers fields in JSON lines automatically, so you can later ask for \"all entries where status = 500\". A common set of fields is `time`, `level`, `msg`, `method`, `path`, `status`, `ms` and `requestId`.\n\n`JSON.stringify` turns an object into a JSON string on one line. The `log` function below puts `time`, `level` and `msg` first and spreads any extra fields after them (`...fields` copies the keys of `fields` into the new object). Log levels rank importance: `debug`, `info`, `warn`, `error`. A setting such as `LOG_LEVEL` lets you hide the noisy ones in production.\n\nTwo cost and safety rules. Never log secrets or personal data (passwords, tokens, full card or email data). And at high traffic, an info line per request is expensive: at 250,000 requests per second it produces a huge volume of paid log storage. Sample the logs (log only a fraction), or log only errors and slow requests.\n\nPut an error's stack trace (the list of calls that led to the error, normally many lines) inside one field. If you print it as raw multi-line text, each line becomes a separate log event and searching breaks.",
      "analogy": "A ship's logbook with fixed columns (time, position, weather) instead of a free-form diary. Anyone can then search \"all entries where weather = storm\" without reading every page.",
      "code": [
        {
          "language": "typescript",
          "filename": "log.ts",
          "source": "export function log(level: string, msg: string, fields: Record<string, unknown> = {}) {\n  console.log(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }));\n}\n\n// Demo only: a fixed time makes the output the same on every run.\nlog(\"info\", \"request\", { time: \"2026-11-22T10:00:00.000Z\", method: \"GET\", path: \"/api/orders\", status: 200, ms: 3 });\nlog(\"error\", \"unhandled\", { time: \"2026-11-22T10:00:01.000Z\", stack: \"Error: boom\\n    at handler\" });",
          "output": "{\"time\":\"2026-11-22T10:00:00.000Z\",\"level\":\"info\",\"msg\":\"request\",\"method\":\"GET\",\"path\":\"/api/orders\",\"status\":200,\"ms\":3}\n{\"time\":\"2026-11-22T10:00:01.000Z\",\"level\":\"error\",\"msg\":\"unhandled\",\"stack\":\"Error: boom\\n    at handler\"}",
          "explanation": "Normally you would call `log(\"info\", \"request\", { method, path, status, ms })` and let the function add the current time. Here a `time` field is passed in so the output is predictable: because `...fields` comes last, it replaces the generated time while the key keeps its first position. In the second line the two-line stack is stored in one `stack` field; the line break appears as the two characters `\\n` inside the JSON string, so the event stays on one line."
        }
      ],
      "productionNote": "The awslogs driver ships every stdout line to CloudWatch (ECS topic), and Logs Insights queries over the JSON fields come in the observability topic. Decide early how many request lines you really need to keep.",
      "commonMistakes": [
        "Multi-line logs. A stack trace printed as plain text becomes many separate events; put it in one field of one JSON line.",
        "Logging every request at peak traffic. The storage cost grows with request volume; sample, or log errors and slow requests only.",
        "Logging tokens, passwords or personal data. Logs are widely readable and kept for a long time."
      ],
      "sources": [
        { "title": "AWS docs: CloudWatch Logs discovered fields in JSON logs", "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_AnalyzeLogData-discoverable-fields.html" },
        { "title": "AWS docs: Send Amazon ECS logs to CloudWatch (awslogs driver)", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_awslogs.html" }
      ]
    },
    {
      "id": "stateless-servers",
      "title": "Stateless servers",
      "explanation": "State is anything your server remembers between requests: who is logged in (a session), what is in a shopping cart, a half-uploaded file, how many requests an address made recently. A stateless server keeps none of that in its own memory or disk. Any server (task) can then handle any request, and any task can be killed at any time without losing data.\n\nThis is required for the scaling you will do later. With many tasks behind the load balancer, consecutive requests from one user land on different tasks, and tasks start and stop constantly. State that lives in one task's memory is invisible to the others and disappears when that task stops.\n\nPut shared state in a shared store: sessions and counters in Valkey (a fast in-memory key-value database, covered in a later topic), durable records in Aurora (the PostgreSQL database service), uploads in S3 (AWS file storage).\n\nThe first example simulates two tasks with two separate JavaScript `Map`s (a `Map` is a built-in key-to-value lookup table held in memory). The second example stores the session in Valkey through Bun's built-in Redis client; Valkey is a copy of Redis, another key-value store, and speaks the same protocol (the message format clients use to talk to it), so the same client works. `redis.send(\"SET\", [...])` sends a raw command: `SET key value EX 3600` stores the value and makes it expire after 3600 seconds. Details of the client come in the Valkey topic.",
      "analogy": "Call-centre agents. Any agent can pick up your call because your case notes are in the shared system, not in one agent's private notebook. If an agent goes home (a task stops) or you reach a different agent (the load balancer picks another task), nothing is lost.",
      "code": [
        {
          "language": "typescript",
          "filename": "bad-session.ts",
          "source": "// Two tasks, each with its own memory.\nconst taskA = new Map<string, string>();\nconst taskB = new Map<string, string>();\n\n// The login request happened to reach task A.\ntaskA.set(\"abc\", \"user-1\");\n\n// The next request from the same user reaches task B.\nconsole.log(\"task A sees:\", taskA.get(\"abc\"));\nconsole.log(\"task B sees:\", taskB.get(\"abc\"));",
          "output": "task A sees: user-1\ntask B sees: undefined",
          "explanation": "Task B knows nothing about the session, so the user looks logged out. The same loss happens to task A's data when it restarts."
        },
        {
          "language": "typescript",
          "filename": "good-session.ts",
          "source": "import { redis } from \"bun\";\n\n// Shared store: every task talks to the same Valkey.\nawait redis.send(\"SET\", [\"session:abc\", \"user-1\", \"EX\", \"3600\"]);\nconsole.log(await redis.get(\"session:abc\"));\nredis.close();",
          "output": "user-1",
          "explanation": "This needs a Valkey or Redis server reachable at the address in `REDIS_URL` (default `redis://localhost:6379`). Any task running this code reads the same value, because the data lives outside the task. The last line closes the connection so the script can exit."
        }
      ],
      "productionNote": "The ALB spreads requests across tasks; with stateless tasks it needs no sticky sessions (a setting that pins each user to one task). That keeps load even and lets you add or remove tasks freely.",
      "commonMistakes": [
        "Using sticky sessions as a crutch. They hide in-memory state instead of removing it, and the data is still lost when that task stops.",
        "Saving uploaded files to the container's local disk. Other tasks cannot see them and they vanish on restart; use S3.",
        "Per-process caches and counters that disagree. Each task has its own copy, so users and rate limits behave inconsistently."
      ],
      "sources": [
        { "title": "AWS Well-Architected Reliability Pillar: Make services stateless where possible", "url": "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_prevent_interaction_failure_stateless.html" },
        { "title": "Bun docs: Redis client", "url": "https://bun.com/docs/runtime/redis" }
      ]
    },
    {
      "id": "bun-serve-production-settings",
      "title": "Bun.serve production settings",
      "explanation": "Bun.serve has a development mode (the default) that is helpful on a laptop: it shows detailed error pages in the browser. Setting the environment variable `NODE_ENV=production` turns it off, so uncaught errors produce a plain 500 response (500 means \"internal server error\") and no internal details leak. `server.development` tells you which mode is active. Note that Bun's `--production` flag does not turn dev mode off for `bun run`; use `NODE_ENV`.\n\nAdd an `error(err)` handler: Bun calls it when your code throws, so you can log the problem and return your own 500 response.\n\n`idleTimeout` is how many seconds Bun keeps a connection open with no activity before closing it. The default is 10 and the maximum is 255. The ALB keeps connections to your tasks open for its own idle timeout, 60 seconds by default. If Bun closes the connection first, the ALB may try to reuse a connection that is already closed, and the user receives a 502 (\"Bad Gateway\": the load balancer got no valid answer from the task). The sporadic 502s are hard to reproduce. Set `idleTimeout` above the ALB value; 65 works.\n\n`maxRequestBodySize` is the largest request body, in bytes, that Bun accepts. The default is 128 MB. For a JSON API, 1 MB is plenty, and a lower limit stops one client from using up your memory with a huge upload. Requests above the limit are rejected before your code sees them. `hostname` already defaults to `0.0.0.0`, meaning \"listen on all network interfaces\", which a container needs.",
      "analogy": "A shop keeping its back door open slightly longer than the delivery driver is willing to wait, so the driver never finds the door shut mid-delivery. The ALB is the driver: Bun must always outlast it. The size limit is the sign saying \"no deliveries bigger than a van\". Dev mode is the shop leaving its internal notes on the counter; production hides them behind a plain \"something went wrong\" sign.",
      "code": [
        {
          "language": "typescript",
          "filename": "index.ts",
          "source": "function log(level: string, msg: string, fields: Record<string, unknown> = {}) {\n  console.log(JSON.stringify({ level, msg, ...fields }));\n}\n\nconst server = Bun.serve({\n  port: Number(process.env.PORT ?? 3000),\n  idleTimeout: 65,\n  maxRequestBodySize: 1024 * 1024,\n  routes: {\n    \"/healthz\": new Response(\"ok\"),\n  },\n  error(err) {\n    log(\"error\", \"unhandled\", { err: String(err) });\n    return new Response(\"internal error\", { status: 500 });\n  },\n  fetch() {\n    return new Response(\"not found\", { status: 404 });\n  },\n});\n\nlog(\"info\", \"listening\", { port: server.port, development: server.development });",
          "output": "{\"level\":\"info\",\"msg\":\"listening\",\"port\":3000,\"development\":false}",
          "explanation": "Run with `NODE_ENV=production bun run index.ts`. Without `NODE_ENV=production` the last field would be `\"development\":true`. `idleTimeout: 65` is just above the ALB's 60 seconds, and `maxRequestBodySize` is 1024 * 1024 bytes, which is 1 MB. Sending a 2 MB body to this server is rejected by Bun before any of your handlers run. The `log` helper here is a trimmed copy of the one from the logging sub-topic, without the time field, so the output is predictable."
        }
      ],
      "productionNote": "These values pair with the load balancer: you will leave the ALB idle timeout at its 60 second default in the ALB topic, and the app's 65 keeps it safely above. Set `NODE_ENV=production` in the container image or task definition.",
      "commonMistakes": [
        "An `idleTimeout` shorter than the ALB idle timeout (the default 10 versus 60). The result is sporadic 502 errors on connections the ALB thought were still open.",
        "Shipping dev mode to production by forgetting `NODE_ENV=production`. Errors then expose internal detail.",
        "Leaving the body limit at the 128 MB default for a small JSON API. A client can force the server to hold huge bodies in memory."
      ],
      "sources": [
        { "title": "Bun docs: HTTP server (Bun.serve)", "url": "https://bun.com/docs/api/http" },
        { "title": "Bun docs: HTTP error handling", "url": "https://bun.com/docs/runtime/http/error-handling" },
        { "title": "AWS docs: ALB attributes (connection idle timeout)", "url": "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-load-balancer-attributes.html#connection-idle-timeout" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why should the ALB health check call /healthz and not a route that queries the database?",
      "options": [
        "A database query is not allowed over HTTP",
        "A short database blip would mark every task unhealthy at once and cause a full outage",
        "The ALB cannot read response bodies",
        "The database check would make the response too large"
      ],
      "answerIndex": 1,
      "explanation": "Liveness checks only that the process is alive. If the shared database stumbles briefly, a check that depends on it fails on every task together, and the load balancer would take the whole service out."
    },
    {
      "question": "A task receives SIGTERM while requests are running. What happens to them with server.stop() versus server.stop(true)?",
      "options": [
        "Both let in-flight requests finish",
        "Both close in-flight requests immediately",
        "stop() lets in-flight requests finish and closes idle connections; stop(true) terminates all connections now",
        "stop() terminates all connections now; stop(true) lets requests finish"
      ],
      "answerIndex": 2,
      "explanation": "The default `server.stop()` is graceful. Passing `true` forces everything closed at once, which drops in-flight requests and defeats a graceful shutdown."
    },
    {
      "question": "The ALB idle timeout is 60 seconds and the Bun idleTimeout is 10 seconds. What symptom do users see?",
      "options": [
        "Sporadic 502 errors, because Bun closes connections the ALB still considers open",
        "Every request is slow by 10 seconds",
        "Requests are rejected as too large",
        "The server refuses to start"
      ],
      "answerIndex": 0,
      "explanation": "Bun closes idle connections after 10 seconds, but the ALB may reuse them up to 60 seconds. When it sends a request on a connection Bun already closed, the user gets a 502. Setting idleTimeout to 65 avoids it."
    },
    {
      "question": "Why is an in-memory Map session store broken when three tasks run behind the load balancer?",
      "options": [
        "A Map cannot store strings",
        "The ALB deletes Map contents on every request",
        "Maps are limited to one entry per task",
        "Each task has its own Map, so a session created on one task is invisible to the other two and lost when it restarts"
      ],
      "answerIndex": 3,
      "explanation": "Memory is private to each process. Requests are spread across tasks, so the next request may reach a task that never saw the session. Shared state belongs in Valkey, Aurora or S3."
    },
    {
      "question": "REDIS_URL is missing when the app starts. What does the app do, and why is that good?",
      "options": [
        "It starts and uses a built-in default address, so users are never affected",
        "It throws a clear error at startup and crashes, so the bad release is visible in the deployment before it receives traffic",
        "It waits until the first request that needs Redis and then fails only that request",
        "It silently disables caching and logs nothing"
      ],
      "answerIndex": 1,
      "explanation": "Failing fast surfaces a configuration mistake immediately and at the deployment, instead of hours later on a user's request. A silent default could also point production at the wrong server."
    }
  ]
});
