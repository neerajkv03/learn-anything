# 20. Load Testing with k6
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 01-deployment-foundations, 18-observability, 19-autoscaling-performance

Test target: staging (prod-sized), never prod without a plan. k6 2.x notes: externally-controlled executor and `k6 cloud script.js` removed; HTTP API server off by default; InfluxDB/Prometheus remote-write outputs deprecated → `-o opentelemetry`. Learner installs k6 2.4.0 manually. WAF rate rules (topic 21) may block load generators → allow-list their IPs in staging's WAF or test origin-side.

## Learning goals
- Learner can write a k6 script with checks.
- Learner can model 250,000 RPS with arrival-rate executors and size VUs.
- Learner can make the test pass/fail with thresholds.
- Learner can split load across machines with execution segments.
- Learner can read results and find the bottleneck layer.

## Sub-topics
### k6 scripts and checks
- Concept: k6 = load tool; script in JavaScript. Lifecycle: init code (imports, options; no HTTP) → `setup()` once → `export default function` per VU iteration → `teardown()`. VU = virtual user running iterations. `http.get` from `k6/http`; `check(res, { "status 200": r => r.status === 200 })` — failed checks don't fail the run (thresholds do).
- Analogy: a crowd of robot shoppers each following the same shopping list, ticking boxes (checks) on what they saw.
- Code example: `smoke.js` — `import http from "k6/http"; import { check } from "k6"; export const options = { vus: 5, duration: "30s" }; export default function () { const res = http.get("https://staging.example.com/api/products/p1"); check(res, { "status 200": r => r.status === 200 }); }` `k6 run smoke.js` → summary includes `✓ status 200` and `checks.........: 100.00%` (counts vary).
- Production use: smoke test after each staging deploy.
- Common mistakes: HTTP calls in init code; testing localhost instead of the real path through CloudFront/ALB; ignoring failed checks.
- Sources: https://grafana.com/docs/k6/latest/using-k6/test-lifecycle/ ; https://grafana.com/docs/k6/latest/using-k6/checks/ ; https://grafana.com/docs/k6/latest/javascript-api/k6-http/

### Scenarios and arrival-rate executors
- Concept: closed model (fixed VUs; slow server = fewer requests) vs open model (arrival-rate: fixed requests/s regardless of server speed — like real users). `constant-arrival-rate` (rate, timeUnit "1s", duration, preAllocatedVUs, maxVUs), `ramping-arrival-rate` (startRate, stages [{target, duration}]). No `sleep()` at end with arrival-rate. VUs needed ≈ rate × p95 latency (s) (Little's law); too few → `dropped_iterations`.
- Analogy: closed = a fixed group of shoppers who only return after finishing; open = new shoppers walk in every second whether or not tills are free.
- Code example: `ramp.js` per load generator — `export const options = { scenarios: { ramp: { executor: "ramping-arrival-rate", startRate: 1000, timeUnit: "1s", preAllocatedVUs: 4000, maxVUs: 10000, stages: [ { target: 15000, duration: "5m" }, { target: 31250, duration: "10m" }, { target: 31250, duration: "15m" }, { target: 0, duration: "2m" } ] } } };` VU math: `console.log(31250*0.2)` → `6250` VUs at 200 ms p95 → maxVUs 10,000 for headroom.
- Production use: prove 250K RPS (8 generators × 31,250).
- Common mistakes: using `vus` model to claim RPS; preAllocatedVUs too low; ramp too fast for autoscaling (test the ramp you expect).
- Sources: https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/ ; https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-arrival-rate/ ; https://grafana.com/docs/k6/latest/using-k6/metrics/reference/

### Thresholds as pass/fail
- Concept: `options.thresholds`: `http_req_duration: ["p(95)<200", "p(99)<500"]`, `http_req_failed: ["rate<0.01"]`, `checks: ["rate>0.99"]`, `dropped_iterations: ["count<100"]`; long form `{ threshold: "p(99)<500", abortOnFail: true, delayAbortEval: "1m" }`. Repeating a key drops earlier entries — one array per metric. Failing threshold → non-zero exit → CI job fails.
- Analogy: a driving test's pass marks: fail any one and you don't get the licence.
- Code example: thresholds block in ramp.js; run result with p95 250 ms → summary marks `✗ http_req_duration ... p(95)<200` and `echo $?` → non-zero (k6 uses exit code 99 for thresholds failure — say "non-zero (99)" only if confirmed; otherwise "non-zero").
- Production use: release gate on staging load test.
- Common mistakes: thresholds on average; two `http_req_duration` keys; no threshold on dropped_iterations (generator was the bottleneck).
- Sources: https://grafana.com/docs/k6/latest/using-k6/thresholds/

### Distributed load generation
- Concept: one k6 instance: ~30–40K VUs, up to ~300K RPS in ideal cases; real limits: CPU (keep ≤ 80%), network (1 Gbit/s NIC can bottleneck), memory 1–5 MB per VU. For 250K RPS through TLS use several machines: execution segments `--execution-segment 0:1/8` … `7/8:1` with `--execution-segment-sequence 0,1/8,2/8,...,1`; same script, each runs its share of the rate. Thresholds/metrics evaluated per instance → aggregate via `-o opentelemetry` (default grpc localhost:4317) into a collector/backend. Run generators as Fargate tasks or EC2 in same region but outside the target VPC (through CloudFront). k6-operator exists for Kubernetes — not used here.
- Analogy: one choir can't fill a stadium with sound; eight choirs each sing their section, and a sound engineer mixes their microphones.
- Code example: generator #3 of 8: `k6 run --execution-segment "2/8:3/8" --execution-segment-sequence "0,1/8,2/8,3/8,4/8,5/8,6/8,7/8,1" -o opentelemetry ramp.js`; each generator's summary shows ~31,250 req/s at peak; total ≈ 250,000. Math: `console.log(250000/8)` → `31250`.
- Production use: pre-launch capacity proof; repeat after major changes.
- Common mistakes: generator CPU at 100% (k6 is the bottleneck, not the app); summing p95s across instances (invalid); forgetting cost of the test (tasks left running).
- Sources: https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/ ; https://grafana.com/docs/k6/latest/results-output/real-time/opentelemetry/

### Reading results and finding bottlenecks
- Concept: watch dashboard (topic 18) during the test: ALB RequestCount vs target, TargetResponseTime p99, 5XX (target vs ELB), ECS CPU and running tasks (scaling lag?), RDS Proxy connections/pinned, Aurora CPU/replica lag, Valkey CPU/evictions, NAT bytes. Rule: first resource to saturate = bottleneck; fix, retest. k6 signals: rising http_req_duration with flat RPS = server saturated; dropped_iterations = generator short of VUs; http_req_failed with 503 = no healthy targets/scaling too slow.
- Analogy: a traffic jam: follow the cars back to the first narrow bridge; widening roads after it doesn't help.
- Code example: worked table: at 180K RPS p99 jumps 80 → 900 ms; ECS CPU 55%; Aurora writer CPU 95%; Valkey hit ratio 60% → bottleneck = DB writer due to cache misses → fix: cache product reads + raise TTL → retest p99 back to 90 ms at 250K. Mark values as illustrative.
- Production use: capacity plan + scaling targets (topic 19).
- Common mistakes: changing several things between runs; testing with empty cache vs warm cache unknowingly; ignoring downstream limits (third-party APIs).
- Sources: https://grafana.com/docs/k6/latest/using-k6/metrics/reference/ ; https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html

## Quiz
1. Why use an arrival-rate executor to prove RPS? — tests open model.
2. Target 20,000 RPS per instance at 150 ms p95: minimum VUs? — tests Little's law (3,000).
3. Summary shows many dropped_iterations; what's wrong? — tests generator capacity.
4. Why can't you add p95 values from 8 generators? — tests distributed metrics.
5. Aurora writer CPU 95%, ECS CPU 40%: where to look first? — tests bottleneck.
