window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "20-load-testing-k6",
  "order": 20,
  "title": "Load Testing with k6",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "A load test sends artificial traffic at your system to prove it can handle the traffic you expect. You will write k6 scripts with checks, model 250,000 requests per second with arrival-rate executors (settings that send new requests at a fixed speed, whether or not earlier ones have finished), turn targets into pass/fail thresholds, split the load across eight machines, and read the results to find the first layer that saturates.",
  "prerequisites": ["01-deployment-foundations", "18-observability", "19-autoscaling-performance"],
  "subtopics": [
    {
      "id": "k6-scripts-and-checks",
      "title": "k6 scripts and checks",
      "explanation": "A load test is an experiment where a program sends many artificial requests to your application, so you find its limits before real users do. k6 is a load-testing tool. You describe the traffic in a script written in JavaScript (a programming language; you only need to read a few lines of it here) and run it with `k6 run <file>`. Install k6 2.4.0 yourself from Grafana's k6 installation docs, then open a terminal and run `k6 version` to confirm it works.\n\nA VU (virtual user) is one simulated user. Each VU repeatedly runs your script's main function. One full run of that function is called an iteration. With 5 VUs for 30 seconds, k6 starts 5 VUs and each one loops over the function until the time is up.\n\nA k6 script has four lifecycle stages. Init code is everything at the top level of the file: `import` lines (which load ready-made features from a module, meaning a bundle of code, such as `k6/http`) and the `options` object (a set of named settings). Init code runs once per VU before the test starts, and it must not make HTTP calls. Then `setup()`, an optional function, runs once for the whole test, for example to create test data. Then `export default function`, which is the function every VU runs per iteration. Finally `teardown()`, optional, runs once at the end to clean up.\n\nInside the default function, `http.get(url)` sends a GET request and returns the response. `check(res, { \"status 200\": (r) => r.status === 200 })` tests the response. The second argument is an object whose keys are labels and whose values are small functions (written with the arrow `=>`) that return true or false. A failed check is only counted and shown in the summary. It does not fail the run and does not change the exit code (the number a program returns to the shell, where 0 means success). Making a run fail is the job of thresholds, covered in a later sub-topic.\n\nA smoke test is a very small load test (a few VUs for a short time) that only proves the script and the path to the system work. Aim it at staging, the production-like environment, and never at production without a plan.",
      "analogy": "Picture a crowd of robot shoppers who each follow the same shopping list. Every robot walks the same route (the iteration) again and again, and ticks boxes on a clipboard about what it saw: \"shelf was stocked\", \"till answered\". Unticked boxes are written down, but the robots keep shopping. A manager who decides whether the store passed is a separate rule, and that is what thresholds are.",
      "code": [
        {
          "language": "javascript",
          "filename": "smoke.js",
          "source": "import http from 'k6/http';\nimport { check } from 'k6';\n\nexport const options = { vus: 5, duration: '30s' };\n\nexport default function () {\n  const res = http.get('https://staging.example.com/api/products/p1');\n  check(res, { 'status 200': (r) => r.status === 200 });\n}\n",
          "output": "     ✓ status 200\n\n     ... (other summary lines and all counts vary per run)",
          "explanation": "Save this as smoke.js, replace staging.example.com with your real staging hostname, and run `k6 run smoke.js` in the same folder. 5 VUs loop for 30 seconds. Each iteration sends one GET and checks the status code. The summary lists `✓ status 200` when every check passed and shows a checks percentage; a failed check shows `✗` and a lower percentage. The request counts differ on every run, so only the check line is shown. This script has no `sleep()` call, so each VU sends its next request as soon as the previous one returns; add `sleep(1)` (imported from `k6`) if you want each VU to pause like a human between actions."
        }
      ],
      "productionNote": "Run a smoke test automatically after every staging deploy so a broken release is caught before a big load test. Point it at the real public path (CloudFront and the ALB), since that is the path users take.",
      "commonMistakes": [
        "Making HTTP calls in init code. Init code runs once per VU before the test starts and is not meant for requests; put requests in the default function or in setup().",
        "Testing localhost instead of the real path through CloudFront and the ALB. You then skip TLS, the CDN, the load balancer and the network, so the numbers do not describe what users get.",
        "Ignoring failed checks. They never fail the run by themselves, so a run can print results and exit with 0 while many responses were wrong. Add a threshold on the `checks` metric."
      ],
      "sources": [
        { "title": "k6 docs: Test lifecycle", "url": "https://grafana.com/docs/k6/latest/using-k6/test-lifecycle/" },
        { "title": "k6 docs: Checks", "url": "https://grafana.com/docs/k6/latest/using-k6/checks/" },
        { "title": "k6 docs: k6/http", "url": "https://grafana.com/docs/k6/latest/javascript-api/k6-http/" }
      ]
    },
    {
      "id": "scenarios-arrival-rate",
      "title": "Scenarios and arrival-rate executors",
      "explanation": "There are two ways to generate load. In a closed model you fix the number of VUs. Each VU sends a request, waits for the answer, then sends the next. If the server slows down, every VU waits longer, so fewer requests per second are sent. The test quietly eases off exactly when the server struggles. In an open model you fix the arrival rate: new requests start at, say, 1,000 per second whether or not earlier ones have finished. Real users behave like this, because they do not wait for other users, so an open model is what you need to prove a requests-per-second (RPS) number.\n\nIn k6 a scenario is a named block inside `options.scenarios` that describes one traffic pattern. Its executor is the setting that chooses how k6 schedules iterations. The `vus` and `duration` options from the last sub-topic use a closed model. The two open-model executors you need are `constant-arrival-rate` (a steady rate for a duration) and `ramping-arrival-rate` (a rate that moves between targets over stages).\n\nA `constant-arrival-rate` scenario takes `rate`, `timeUnit` (the period the rate is counted in, such as \"1s\"), `duration`, `preAllocatedVUs` and `maxVUs`. A `ramping-arrival-rate` scenario takes `startRate`, `timeUnit`, `stages` (a list of objects, each with a `target` rate and a `duration` to reach it), `preAllocatedVUs` and `maxVUs`. `preAllocatedVUs` are VUs created before the test starts; k6 may add more, up to `maxVUs`, if iterations pile up. Do not put `sleep()` at the end of the function with these executors, because the executor already controls the pacing.\n\nHow many VUs do you need? Use Little's law from topic 01: requests in flight = rate x time each takes. Needed VUs is about rate x p95 latency in seconds. At 31,250 requests per second and a 200 ms (0.2 s) p95 latency you need about 6,250 requests in flight, so about 6,250 VUs. Set `maxVUs` above that for headroom, for example 10,000. If k6 runs out of VUs it cannot start an iteration on time and skips it. That skipped work is counted in the `dropped_iterations` metric, and it means your generator, not your application, limited the test.\n\nShape the ramp the way real traffic will arrive. Autoscaling (topic 19) takes minutes to add tasks, so a ramp that is far faster than reality tests a situation you will not have.",
      "analogy": "A closed model is a fixed group of shoppers who only return to the shelves after they have finished paying: if the tills are slow, fewer shoppers arrive per minute. An open model is a store whose door opens and lets a new shopper in every second, whether or not the tills are free. The queue grows, and that growing queue is what you want to see.",
      "code": [
        {
          "language": "javascript",
          "filename": "ramp.js",
          "source": "import http from 'k6/http';\nimport { check } from 'k6';\n\n// One generator machine's share: peak 31,250 requests per second.\nexport const options = {\n  scenarios: {\n    ramp: {\n      executor: 'ramping-arrival-rate',\n      startRate: 1000,\n      timeUnit: '1s',\n      preAllocatedVUs: 4000,\n      maxVUs: 10000,\n      stages: [\n        { target: 15000, duration: '5m' },\n        { target: 31250, duration: '10m' },\n        { target: 31250, duration: '15m' },\n        { target: 0, duration: '2m' },\n      ],\n    },\n  },\n};\n\nexport default function () {\n  const res = http.get('https://staging.example.com/api/products/p1');\n  check(res, { 'status 200': (r) => r.status === 200 });\n}\n",
          "output": "",
          "explanation": "The file only defines the test, so nothing is printed until you run it with `k6 run ramp.js` (about 32 minutes in total). The rate starts at 1,000 per second, climbs to 15,000 over 5 minutes, then to 31,250 over 10 minutes, holds 31,250 for 15 minutes, and drops to 0 over 2 minutes. 4,000 VUs are ready at the start and k6 can grow to 10,000. Do not run this at full size from a laptop; lower the numbers for a first try and run the full size from proper generator machines."
        },
        {
          "language": "javascript",
          "filename": "vu-math.js",
          "source": "const rate = 31250; // requests per second\nconst p95Ms = 200; // p95 latency in milliseconds\nconst inFlight = (rate * p95Ms) / 1000; // Little's law\nconsole.log(inFlight);\n",
          "output": "6250",
          "explanation": "Run it with `bun run vu-math.js`. 31,250 requests per second times 0.2 seconds gives 6,250 requests in flight, so you need about 6,250 VUs. Setting maxVUs to 10,000 leaves room for slower responses during the test."
        }
      ],
      "productionNote": "Use ramping-arrival-rate to prove a target such as 250,000 RPS: eight generators, each with a peak of 31,250. Ramp at the speed your autoscaling will really face.",
      "commonMistakes": [
        "Using a fixed `vus` setting to claim an RPS figure. In a closed model the request rate depends on server speed, so you did not prove any particular rate.",
        "Setting `preAllocatedVUs` and `maxVUs` too low. k6 then drops iterations and the real rate is lower than you configured.",
        "Ramping much faster than autoscaling would respond in real life, which tests an unrealistic situation."
      ],
      "sources": [
        { "title": "k6 docs: Constant arrival rate executor", "url": "https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/" },
        { "title": "k6 docs: Ramping arrival rate executor", "url": "https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-arrival-rate/" },
        { "title": "k6 docs: Built-in metrics reference", "url": "https://grafana.com/docs/k6/latest/using-k6/metrics/reference/" }
      ]
    },
    {
      "id": "thresholds-pass-fail",
      "title": "Thresholds as pass/fail",
      "explanation": "A threshold is a pass/fail rule on a metric (a number k6 measures during the run). You list thresholds in `options.thresholds`, where each key is a metric name and each value is an array of rule strings. If any rule is broken at the end of the run, k6 exits with a non-zero exit code, and a CI job (a pipeline step from topic 16) that runs k6 fails. That makes a load test a release gate.\n\nThe metrics you will use most: `http_req_duration` is the time each request took, and you can write percentile rules such as `p(95)<200` (95% of requests faster than 200 ms). `http_req_failed` is the fraction of requests that failed, so `rate<0.01` allows under 1% failures. `checks` is the fraction of checks that passed, so `rate>0.99` requires over 99%. `dropped_iterations` counts iterations k6 could not start, so `count<100` allows fewer than 100. A threshold on this one tells you whether the generator kept up.\n\nPut every rule for one metric in a single array, as in `http_req_duration: ['p(95)<200', 'p(99)<500']`. If you repeat the same key in the object, JavaScript keeps only the last one and the earlier rules silently disappear.\n\nThe long form of a rule is an object, for example `{ threshold: 'p(99)<500', abortOnFail: true, delayAbortEval: '1m' }`. With `abortOnFail: true` k6 stops the whole test as soon as that rule is broken, which saves time and money on a test that has already failed. `delayAbortEval` waits that long before judging, so the noisy first minute of a ramp does not abort the run.\n\nPrefer percentiles over averages. An average hides the slow tail that real users feel.",
      "analogy": "Thresholds are the pass marks of a driving test: stay within the speed limit, stop at every red light, park in the bay. Fail any single one and you do not get the licence, however well the rest went. The long form with abortOnFail is the examiner who ends the test on the spot when you run a red light.",
      "code": [
        {
          "language": "javascript",
          "filename": "ramp.js",
          "source": "import http from 'k6/http';\nimport { check } from 'k6';\n\nexport const options = {\n  scenarios: {\n    ramp: {\n      executor: 'ramping-arrival-rate',\n      startRate: 1000,\n      timeUnit: '1s',\n      preAllocatedVUs: 4000,\n      maxVUs: 10000,\n      stages: [\n        { target: 15000, duration: '5m' },\n        { target: 31250, duration: '10m' },\n        { target: 31250, duration: '15m' },\n        { target: 0, duration: '2m' },\n      ],\n    },\n  },\n  thresholds: {\n    http_req_duration: [\n      'p(95)<200',\n      { threshold: 'p(99)<500', abortOnFail: true, delayAbortEval: '1m' },\n    ],\n    http_req_failed: ['rate<0.01'],\n    checks: ['rate>0.99'],\n    dropped_iterations: ['count<100'],\n  },\n};\n\nexport default function () {\n  const res = http.get('https://staging.example.com/api/products/p1');\n  check(res, { 'status 200': (r) => r.status === 200 });\n}\n",
          "output": "",
          "explanation": "Same scenario as before plus a thresholds block. http_req_duration has one array with two rules, and the second is in long form so it aborts the test. The other three metrics each have their own rule. Running it prints the result; see the next example."
        },
        {
          "language": "bash",
          "filename": "run-gate.sh",
          "source": "k6 run ramp.js\necho $?\n",
          "output": "  █ THRESHOLDS\n\n    checks\n    ✓ 'rate>0.99' rate=99.97%\n\n    dropped_iterations\n    ✓ 'count<100' count=0\n\n    http_req_duration\n    ✗ 'p(95)<200' p(95)=250.31ms\n    ✓ 'p(99)<500' p(99)=410.02ms\n\n    http_req_failed\n    ✓ 'rate<0.01' rate=0.00%\n\n(then a non-zero number from echo $?)",
          "explanation": "The numbers are illustrative. Here the p95 latency was 250 ms, so the rule `p(95)<200` is marked with `✗` and k6 finishes with a non-zero exit code. `echo $?` prints the exit code of the last command in a Bash shell; 0 would mean every threshold passed. A CI step sees the non-zero code and fails the build."
        }
      ],
      "productionNote": "Make the staging load test a release gate in CI: if any threshold fails, the promotion to production does not happen. Keep the numbers tied to your SLOs from topic 18.",
      "commonMistakes": [
        "Setting thresholds on the average response time. Averages hide slow outliers; use p(95) and p(99).",
        "Writing the `http_req_duration` key twice in the thresholds object. The second silently replaces the first; put all rules in one array.",
        "Having no threshold on `dropped_iterations`. A run can look healthy while the generator, not the app, was the limit."
      ],
      "sources": [
        { "title": "k6 docs: Thresholds", "url": "https://grafana.com/docs/k6/latest/using-k6/thresholds/" }
      ]
    },
    {
      "id": "distributed-load-generation",
      "title": "Distributed load generation",
      "explanation": "One k6 process has limits. A single instance can run roughly 30,000 to 40,000 VUs and, in ideal cases, up to about 300,000 requests per second, but real limits arrive sooner. CPU is the first: keep it at or under 80%, because a saturated generator measures itself instead of your app. The network card is next, since a 1 Gbit/s link (1 gigabit of network traffic per second) can cap throughput. Memory is the third, at about 1 to 5 MB per VU. TLS encryption costs extra CPU. For 250,000 RPS through HTTPS, use several machines.\n\nAn execution segment tells one k6 instance to run only a slice of the test. `--execution-segment 2/8:3/8` means \"run the part from two eighths to three eighths of the work\". Alongside it you pass `--execution-segment-sequence` listing all the boundaries, so every instance agrees how the whole is cut: `0,1/8,2/8,3/8,4/8,5/8,6/8,7/8,1`. Every machine runs the same script with the same sequence and only changes its own segment. Each instance then does its share of the request rate and VUs.\n\nBecause each instance does a fraction, the script has to describe the whole test. For 250,000 RPS the script carries the total numbers (eight times the per-generator values), and 250,000 / 8 = 31,250 requests per second land on each generator.\n\nEach instance judges thresholds only on its own data. To see the whole test, send metrics from all generators to one place with `-o opentelemetry`. This output sends metrics in the OpenTelemetry format (from topic 18) to a collector, by default over gRPC (a fast protocol for sending data between programs) to `localhost:4317`. Point it at your collector or backend using the settings in the k6 OpenTelemetry output docs. Note that in k6 2.x the older InfluxDB and Prometheus remote-write outputs are deprecated in favour of this one.\n\nRun the generators as Fargate tasks or EC2 instances in the same region as the target but outside the target VPC, so traffic enters through CloudFront like real users. If a firewall that limits request rates (a WAF, covered later in the course) sits in front, allow-list the generators' IP addresses on staging or the firewall will block your test. Kubernetes has a k6-operator for this job, but this course does not use Kubernetes.",
      "analogy": "One choir cannot fill a stadium with sound. Eight choirs each sing their own section from the same sheet music, and a sound engineer at the mixing desk combines their microphones into one broadcast. The engineer is your OpenTelemetry collector: listening to one choir alone tells you little about the whole stadium.",
      "code": [
        {
          "language": "javascript",
          "filename": "ramp-total.js",
          "source": "import http from 'k6/http';\nimport { check } from 'k6';\n\n// Whole-test numbers: peak 250,000 requests per second across all 8 generators.\nexport const options = {\n  scenarios: {\n    ramp: {\n      executor: 'ramping-arrival-rate',\n      startRate: 8000,\n      timeUnit: '1s',\n      preAllocatedVUs: 32000,\n      maxVUs: 80000,\n      stages: [\n        { target: 120000, duration: '5m' },\n        { target: 250000, duration: '10m' },\n        { target: 250000, duration: '15m' },\n        { target: 0, duration: '2m' },\n      ],\n    },\n  },\n};\n\nexport default function () {\n  const res = http.get('https://staging.example.com/api/products/p1');\n  check(res, { 'status 200': (r) => r.status === 200 });\n}\n",
          "output": "",
          "explanation": "This is ramp.js multiplied by 8 (15,000 x 8 = 120,000; 31,250 x 8 = 250,000; 4,000 x 8 = 32,000; 10,000 x 8 = 80,000). Each generator runs this same file and takes one eighth of it."
        },
        {
          "language": "bash",
          "filename": "generator-3.sh",
          "source": "k6 run \\\n  --execution-segment \"2/8:3/8\" \\\n  --execution-segment-sequence \"0,1/8,2/8,3/8,4/8,5/8,6/8,7/8,1\" \\\n  -o opentelemetry \\\n  ramp-total.js\n",
          "output": "",
          "explanation": "This is generator number 3 of 8 (it takes the slice from 2/8 to 3/8). The other seven machines run the same command with their own `--execution-segment` (0:1/8, 1/8:2/8, 3/8:4/8, and so on up to 7/8:1). At peak each generator's own summary shows about 31,250 requests per second, and the eight together make about 250,000. The terminal summary is long and its numbers vary, so it is not shown."
        },
        {
          "language": "javascript",
          "filename": "split-math.js",
          "source": "const totalRps = 250000;\nconst generators = 8;\nconsole.log(totalRps / generators);\n",
          "output": "31250",
          "explanation": "Run it with `bun run split-math.js`. Each of the eight generators carries 31,250 requests per second at peak."
        }
      ],
      "productionNote": "Run a distributed test before launches and again after major changes (new database layout, new cache rules, new instance sizes). Tear the generators down when the test ends so they do not keep costing money.",
      "commonMistakes": [
        "Letting generator CPU reach 100%. Then k6 itself is the bottleneck and your results describe the generator, not the app.",
        "Adding or averaging p95 values from different instances. A percentile cannot be combined from percentiles; you need the merged raw measurements in one backend.",
        "Forgetting to stop generator tasks after the test, which keeps billing you."
      ],
      "sources": [
        { "title": "k6 docs: Running large tests", "url": "https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/" },
        { "title": "k6 docs: OpenTelemetry output", "url": "https://grafana.com/docs/k6/latest/results-output/real-time/opentelemetry/" }
      ]
    },
    {
      "id": "reading-results-bottlenecks",
      "title": "Reading results and finding bottlenecks",
      "explanation": "A bottleneck is the one part of the system that runs out of capacity first and so limits everything else. While the test runs, watch the dashboard you built in topic 18 next to k6's numbers. Check, in this order of the request path: ALB RequestCount against what you are sending, TargetResponseTime p99, 5XX errors (split into those from targets and those from the load balancer itself (ELB, the AWS service behind the ALB)), ECS CPU and the number of running tasks (to see scaling lag), RDS Proxy connections and pinned connections, Aurora CPU and replica lag, Valkey CPU, evictions (Valkey deleting keys to make room) and hit ratio, and bytes through the NAT gateway.\n\nThe rule: the first resource to saturate is the bottleneck. Fix that one thing, then run the same test again. Fixing something further down the path does nothing until the first limit is removed.\n\nk6 itself gives clues. Rising `http_req_duration` while the request rate stays flat means the server side is saturated. A growing `dropped_iterations` means the generator ran out of VUs or CPU. A rise in `http_req_failed` with HTTP 503 responses (503 means the service is unavailable) usually means no healthy targets, or scaling that was too slow.\n\nThe worked example below uses made-up numbers to show the reasoning. Latency is fine until about 180K RPS, then p99 jumps from 80 ms to 900 ms. At that moment ECS CPU is only 55%, so the application tasks are not the limit. Aurora writer CPU is at 95%. The product reads were sent to the writer endpoint, so every cache miss landed on the writer rather than a reader. The Valkey hit ratio is only 60%, so 40% of reads fall through to the database. The conclusion: the database writer is saturated because the cache misses too much. The fix is to cache product reads and raise the TTL. After retesting, p99 is back to 90 ms at 250K RPS.",
      "analogy": "A traffic jam on a road network. You follow the cars back to the first narrow bridge where they start to queue. Widening the roads after that bridge does not help, because cars still crawl through the bridge. Widen the bridge, then drive the route again to see where the next narrow point is.",
      "code": [
        {
          "language": "text",
          "filename": "run-notes.txt",
          "source": "Illustrative numbers, not real measurements.\n\nRun 1, ramp to 250,000 RPS\nRPS sent   p99 (ms)   ECS CPU   Aurora writer CPU   Valkey hit ratio\n 60,000       70        30%            25%                 92%\n120,000       75        42%            40%                 85%\n180,000       80        55%            70%                 75%\n190,000      900        55%            95%                 60%\n\nBottleneck: Aurora writer (95% CPU) caused by cache misses.\nFix (one change only): cache product reads, raise the TTL.\n\nRun 2, same ramp\n250,000       90        62%            45%                 94%\n",
          "output": "",
          "explanation": "This is a notes table you would keep per run, not a program. At 190K RPS the p99 explodes while ECS CPU stays at 55%, so the app tasks are not the problem. The database writer is saturated and the cache hit ratio dropped, which links the two. Only one change was made between run 1 and run 2, so the improvement can be credited to that change."
        }
      ],
      "productionNote": "Turn what you learn into a capacity plan and scaling targets (topic 19): the RPS where the first resource saturated, and how much headroom you want below it. Keep the per-run notes so later tests can be compared.",
      "commonMistakes": [
        "Changing several things between runs. You then cannot tell which change helped; change one thing and retest.",
        "Testing with an empty cache in one run and a warm cache in another without noticing. The results are not comparable.",
        "Ignoring limits downstream of your own system, such as a third-party API that rate-limits you, which can saturate before anything of yours does."
      ],
      "sources": [
        { "title": "k6 docs: Built-in metrics reference", "url": "https://grafana.com/docs/k6/latest/using-k6/metrics/reference/" },
        { "title": "AWS docs: Application Load Balancer CloudWatch metrics", "url": "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "You want to prove the system handles 20,000 requests per second. Why use an arrival-rate executor instead of a fixed number of VUs?",
      "options": [
        "It uses less memory on the generator, which is the only difference between the two",
        "It sends new requests at a fixed rate whether or not the server is slow, like real users, so the rate you claim is the rate you actually sent",
        "It makes failed checks fail the run automatically",
        "It lets you skip setting preAllocatedVUs and maxVUs"
      ],
      "answerIndex": 1,
      "explanation": "Arrival-rate executors model an open system: arrivals do not wait for earlier requests to finish. With a fixed number of VUs, a slow server reduces the request rate, so you cannot claim an RPS figure. Arrival-rate executors still need preAllocatedVUs and maxVUs, and thresholds, not the executor, decide pass or fail."
    },
    {
      "question": "Your target is 20,000 RPS per instance at a 150 ms p95 latency. Using Little's law, about how many VUs do you need at minimum?",
      "options": [
        "150",
        "20,000",
        "3,000",
        "133,333"
      ],
      "answerIndex": 2,
      "explanation": "VUs needed is about rate x latency in seconds: 20,000 x 0.15 = 3,000. Add headroom with maxVUs above that."
    },
    {
      "question": "The k6 summary shows many dropped_iterations. What does it mean?",
      "options": [
        "The application returned errors, so you should scale the application first",
        "The database ran out of connections",
        "k6 did not have enough free VUs or CPU to start iterations on time, so the generator, not the app, limited the test",
        "The checks in the script contain a typing mistake"
      ],
      "answerIndex": 2,
      "explanation": "Dropped iterations are iterations k6 wanted to start but could not because no VU was free. Raise preAllocatedVUs and maxVUs, check generator CPU, or add generators. Application errors appear in http_req_failed, not in dropped_iterations."
    },
    {
      "question": "Eight generators each report their own p95 latency. Why can't you add the eight values together (or average them) to get the overall p95?",
      "options": [
        "Because k6 only reports p95 on the first generator",
        "Because a percentile is a position in the ordered list of all requests, so it cannot be built from other percentiles; you need the merged measurements from all generators in one backend",
        "Because the generators use different units of time",
        "Because p95 values are always identical across machines"
      ],
      "answerIndex": 1,
      "explanation": "A percentile depends on the whole distribution. Combining pre-computed percentiles gives a wrong number, so send all raw metrics to one place with -o opentelemetry and let the backend compute the percentile."
    },
    {
      "question": "During a test Aurora writer CPU is 95% and ECS CPU is 40%. Where do you look first?",
      "options": [
        "The ECS tasks: add more of them first, since ECS has the lower CPU",
        "The generators' network cards",
        "The database writer and what drives its load, such as cache hit ratio and write queries",
        "The CloudFront price class"
      ],
      "answerIndex": 2,
      "explanation": "The first resource to saturate is the bottleneck. The writer at 95% is saturated while ECS has plenty of room, so adding tasks would only send more load to the database. Check what is hitting the writer, for example cache misses, and fix that."
    }
  ]
});
