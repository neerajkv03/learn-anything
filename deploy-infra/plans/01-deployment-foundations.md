# 01. Deployment Foundations
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: none

Course frame (state once in intro): learner already has a Bun.serve API (raw Bun, PostgreSQL) + TanStack Start SSR frontend; course = put it on AWS, keep it running at 100K–250K requests/second. No app features written here. Running example app name: `shop` (api + web).

## Learning goals
- Learner can explain what "deploying" an app means and name the pieces between a user's browser and their code.
- Learner can read an HTTP request/response (method, URL, status, headers, body).
- Learner can say why dev, staging and prod are separate.
- Learner can compute p50/p95/p99 latency and a monthly downtime budget from availability %.
- Learner can estimate in-flight requests and task count for 250,000 RPS.

## Sub-topics
### What deployment means
- Concept: code on laptop = only you can use it; deployment = copying a built version to always-on computers (servers) in a data center, reachable by a public address, plus everything that keeps it alive (restarts, updates, monitoring). Build → ship → run → watch. Gloss "server" (a computer that waits for requests and answers them).
- Analogy: home kitchen vs restaurant. Recipe works at home (laptop); a restaurant needs a fixed address (domain), a front door (load balancer), many cooks (servers), a pantry (database), a menu board near the door (cache), and a manager watching (monitoring). Deploying = opening the restaurant, not inventing the recipe.
- Code example: `hello.ts` — `Bun.serve({ port: 3000, fetch() { return new Response("hello from shop"); } }); console.log("listening on 3000");` Run `bun run hello.ts` → prints `listening on 3000`; in another terminal `curl -s http://localhost:3000/` → `hello from shop`. Gloss curl (a terminal tool that sends a web request and prints the answer) and localhost (this same computer).
- Production use: every release of the shop API/web goes through build → ship → run → watch, automated later by CI/CD (topics 16–17).
- Common mistakes: thinking "it works on my laptop" = deployable; deploying by hand-copying files (no repeatability); no plan for watching it after launch.
- Sources: https://bun.com/docs/api/http ; https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Web_standards/How_the_web_works

### Client, server and HTTP requests
- Concept: client (browser, phone app, curl) sends request: method (GET read, POST create), URL (scheme, host, path), headers (key: value metadata), optional body. Server replies: status code (200 OK, 404 Not Found, 500 Internal Server Error, 503 Service Unavailable), headers, body. Stateless protocol: each request carries what it needs.
- Analogy: posting a letter. Envelope = method + address (URL) + stamps/labels (headers); letter inside = body. Reply letter starts with a one-line verdict (status code). Contrast: GET = "please send me your catalogue" (no letter inside); POST = "here is my order form" (letter inside).
- Code example: `health.ts` — Bun.serve port 3000 with `routes: { "/health": new Response("ok"), }` and `fetch() { return new Response("not found", { status: 404 }); }`. `curl -i http://localhost:3000/health` → first line `HTTP/1.1 200 OK`, body `ok` (other headers like Date vary). `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/nope` → `404`.
- Production use: the load balancer (topic 10) calls a health URL like this every few seconds; status codes drive alarms (5XX count, topic 18).
- Common mistakes: returning 200 with an error message in the body (monitoring can't see failures); confusing 4XX (client's fault) with 5XX (server's fault).
- Sources: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status ; https://bun.com/docs/api/http

### Environments: dev, staging, prod
- Concept: dev = playground for developers, can break; staging = full-size rehearsal copy of prod with fake data; prod = real users, real money. Same code, different config (env vars, topic 02/06). Later each env = its own AWS account (topic 04).
- Analogy: theatre. Dev = rehearsal room (stop anytime), staging = dress rehearsal on the real stage with costumes but no audience, prod = opening night with paying audience. Same script (code), different venue settings (config).
- Code example: `env.ts` — `const env = process.env.APP_ENV ?? "dev"; console.log(\`Running in ${env}\`);` `APP_ENV=staging bun run env.ts` → `Running in staging`; `bun run env.ts` → `Running in dev`.
- Production use: CDK stacks `ShopDev`/`ShopStaging`/`ShopProd` (topic 07); pipeline promotes dev → staging → prod (topic 17).
- Common mistakes: testing only in dev, then surprises in prod; staging much smaller than prod so load problems hide; sharing one database across envs.
- Sources: https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/organizing-workload-oriented-ous.html ; https://bun.com/docs/runtime/environment-variables

### Latency, throughput and availability
- Concept: latency = time for one request (ms, gloss millisecond = 1/1000 s). Average hides slow outliers → percentiles: p50 (median: half faster), p95, p99 (1 in 100 slower). Throughput = requests per second (RPS). Availability = % of time working; downtime budget = period × (1 − availability). SLO (gloss: an internal target like "99.9% of requests succeed") vs SLA (contract with penalty).
- Analogy: pizza delivery. Latency = minutes from order to doorbell; throughput = pizzas delivered per hour by the whole shop; availability = % of opening hours the phone is answered. p99 = the unlucky 1-in-100 customer who waited longest — the one who writes the review.
- Code example: `percentile.ts` — `const ms = [12,15,11,40,13,14,12,300,16,13]; const s = [...ms].sort((a,b)=>a-b); const p = (q:number)=> s[Math.ceil(q*s.length)-1]; const avg = ms.reduce((a,b)=>a+b,0)/ms.length; console.log(\`avg=${avg} p50=${p(0.5)} p90=${p(0.9)} p99=${p(0.99)}\`);` → `avg=44.6 p50=13 p90=40 p99=300` (nearest-rank method; sorted 11,12,12,13,13,14,15,16,40,300). Second part `downtime.ts`: 30-day month = 43,200 min; `for (const a of [99, 99.9, 99.99]) console.log(\`${a}% -> ${(43200*(100-a)/100).toFixed(2)} min/month\`)` → `99% -> 432.00 min/month`, `99.9% -> 43.20 min/month`, `99.99% -> 4.32 min/month`.
- Production use: alarms on p99 TargetResponseTime (topic 18); k6 thresholds `p(95)<200` (topic 20); SLO error budgets (topic 18).
- Common mistakes: watching averages only; promising 99.99% without multi-AZ design; mixing up latency (speed of one) and throughput (volume).
- Sources: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_concepts.html#Percentiles ; https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/availability.html

### Capacity math for 100K–250K RPS
- Concept: in-flight (concurrent) requests = RPS × average latency in seconds (Little's law, gloss). Servers needed = target RPS ÷ RPS one server sustains (measure with k6, topic 20) × headroom (spare for spikes and one AZ failing). Horizontal scaling (gloss: more copies, not a bigger machine). 250K RPS = 21.6 billion requests/day → caching (CloudFront, Valkey) cuts work reaching the database.
- Analogy: supermarket checkouts. Customers arriving per minute (RPS) × minutes each takes at the till (latency) = customers at tills at once (in-flight). Number of tills = arrivals ÷ customers one till handles, plus spare tills for a rush and for a till breaking.
- Code example: `capacity.ts` — `const rps=250_000, latencySec=0.02, perTaskRps=5_000, headroom=1.3; console.log("in-flight:", rps*latencySec); console.log("tasks:", Math.ceil(rps/perTaskRps*headroom)); console.log("per day:", rps*86_400);` → `in-flight: 5000`, `tasks: 65`, `per day: 21600000000`. State clearly perTaskRps=5,000 is an example; real value comes from load testing.
- Production use: sets ECS max task count (topic 19), Fargate vCPU quota request (topic 19), DB connection math (topic 12), k6 target rate (topic 20).
- Common mistakes: sizing for average traffic not peak; forgetting headroom for losing one of three AZs (lose 1/3 capacity); assuming the database scales like stateless servers.
- Sources: https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/welcome.html ; https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/

## Quiz
1. Order these from user to code: load balancer, browser, server process, DNS — tests request path.
2. Sorted latencies 10,10,11,12,12,13,14,20,90,400 — what is p50 and p90 (nearest-rank)? — tests percentiles (answer 12 and 90).
3. 99.95% availability allows how many minutes of downtime in a 30-day month? — tests downtime budget (21.6).
4. 100,000 RPS at 50 ms average latency → how many in-flight requests? — tests Little's law (5,000).
5. Why keep staging separate from prod? — tests environments.
