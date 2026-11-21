window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "01-deployment-foundations",
  "order": 1,
  "title": "Deployment Foundations",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "This course assumes you already have a working API (built with Bun.serve, Bun's built-in web server function, and a PostgreSQL database (a database server)) and a web frontend (the part users see in the browser) built with TanStack Start (a JavaScript web framework), together called the running example `shop` (an api part and a web part). You will put it on AWS and keep it running at 100,000 to 250,000 requests per second. This first topic gives you the vocabulary and the arithmetic: what deploying means, how a web request works, why environments are separate, how to measure speed and uptime, and how to estimate how many servers you need. No app features are written here.",
  "prerequisites": [],
  "subtopics": [
    {
      "id": "what-deployment-means",
      "title": "What deployment means",
      "explanation": "Code that runs on your laptop can only be used by you, and only while the laptop is on. Deployment means copying a built version of your program to always-on computers in a data center, making it reachable at a public address, and setting up everything that keeps it alive: automatic restarts, updates and monitoring.\n\nA server is a computer (or a program on one) that waits for requests and answers them. A data center is a building full of such computers that you rent by the hour. In this course the rented computers belong to AWS (Amazon Web Services, Amazon's cloud platform).\n\nDeployment is a loop of four steps. Build: turn your source code into something runnable. Ship: copy that to the servers. Run: start it and keep it running. Watch: collect measurements and alarms so you notice problems before users do. Later topics automate each step; here you only need the shape of the loop.\n\nThe tiny program below is the smallest possible web server. Create a folder, create a file called `hello.ts` in it with the code below. TypeScript is the programming language this course uses (a version of JavaScript, the language web browsers run). Open a terminal (a text window where you type commands) in that folder. Bun is already installed for the course app; `bun --version` should print a version number. `Bun.serve` starts a server listening on a port (a numbered door on a computer; each server program uses its own number). The `fetch` function inside it is called once per incoming request and returns the reply as a `Response` object.",
      "analogy": "A home kitchen versus a restaurant. A recipe that tastes great at home (your laptop) is not a restaurant. A restaurant needs a fixed address people can find (a domain name), a front door that sends guests to a free table (a load balancer, which spreads requests across many servers), many cooks (servers), a pantry (the database), a menu board near the door for popular items (a cache, a fast store of recent answers) and a manager watching the floor (monitoring). Deploying means opening the restaurant, not inventing the recipe. Build, ship, run, watch is the daily routine of getting food from the kitchen to the guests and checking that nobody is unhappy.",
      "code": [
        {
          "language": "typescript",
          "filename": "hello.ts",
          "source": "Bun.serve({\n  port: 3000,\n  fetch() {\n    return new Response(\"hello from shop\");\n  },\n});\n\nconsole.log(\"listening on 3000\");\n",
          "output": "listening on 3000",
          "explanation": "Run it with `bun run hello.ts`. The program prints one line and then keeps running, waiting for requests; stop it with Ctrl+C. `console.log` prints text to the terminal. `fetch()` ignores the request and always answers with the text `hello from shop`."
        },
        {
          "language": "bash",
          "filename": "try-hello.sh",
          "source": "curl -s http://localhost:3000/",
          "output": "hello from shop",
          "explanation": "Leave the server running, open a second terminal and run this. `curl` is a terminal tool that sends a web request and prints the answer (`-s` means silent: hide the progress meter). `localhost` means this same computer. `:3000` is the port from the code, and `/` is the path (the part of the address after the host name). If curl is missing, open `http://localhost:3000/` in a browser instead."
        }
      ],
      "productionNote": "Every release of the shop API and web app goes through build, ship, run, watch. At first you will do this by hand to learn it; later topics replace the hand steps with CI/CD (continuous integration and continuous delivery: automatic pipelines that test and release every change) so that every release is repeatable and nobody copies files onto servers manually.",
      "commonMistakes": [
        "Thinking that \"it works on my laptop\" means it is ready to deploy. A laptop has one user, no restarts, no crashes under load and no public address.",
        "Deploying by hand-copying files onto a server. Nobody can repeat it exactly, and nobody can say what version is running.",
        "Having no plan to watch the app after launch. Without monitoring you learn about outages from angry users."
      ],
      "sources": [
        { "title": "Bun docs: HTTP server (Bun.serve)", "url": "https://bun.com/docs/api/http" },
        { "title": "MDN: How the web works", "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Web_standards/How_the_web_works" }
      ]
    },
    {
      "id": "client-server-http",
      "title": "Client, server and HTTP requests",
      "explanation": "A client is whatever asks: a browser, a phone app, or curl. A server answers. They talk using HTTP (HyperText Transfer Protocol), the agreed format for web requests and replies.\n\nA request has four parts. The method says what you want: `GET` reads something, `POST` sends something new, such as an order. The URL says where: scheme (`http` or `https`), host (the computer's name, such as `localhost`), and path (such as `/health`). Headers are `key: value` lines of extra information about the request. The body is optional data, such as the order itself; a GET normally has none.\n\nThe reply has three parts. The status code is a three-digit verdict: `200 OK` worked, `404 Not Found` means that path does not exist, `500 Internal Server Error` means the server crashed or failed, and `503 Service Unavailable` means the server is too busy or not ready. Then come headers, then a body (the page, JSON data or text).\n\nCodes starting with 4 (`4XX`) mean the client made a mistake. Codes starting with 5 (`5XX`) mean the server failed. HTTP is stateless: the server does not remember earlier requests, so each request must carry everything the server needs.\n\nThe example below answers `/health` with a fixed `ok`. The `routes` option maps exact paths to answers. The `fetch` function handles every path that has no route, and here returns 404.",
      "analogy": "Posting a letter. The envelope carries the method (what you want done) and the address (the URL), plus stamps and labels (headers). The letter inside is the body. The reply letter starts with a one-line verdict, the status code. A GET is like writing \"please send me your catalogue\": nothing is inside the envelope except the request. A POST is like mailing an order form: the envelope has a filled-in form inside, which is the body. Each letter must make sense on its own, which is what stateless means: the post office keeps no memory of your last letter.",
      "code": [
        {
          "language": "typescript",
          "filename": "health.ts",
          "source": "Bun.serve({\n  port: 3000,\n  routes: {\n    \"/health\": new Response(\"ok\"),\n  },\n  fetch() {\n    return new Response(\"not found\", { status: 404 });\n  },\n});\n\nconsole.log(\"listening on 3000\");\n",
          "output": "listening on 3000",
          "explanation": "Stop the earlier server first (Ctrl+C), because two programs cannot use port 3000 at the same time. Then run `bun run health.ts`. Requests to `/health` get the fixed `ok` reply with status 200 (the default). Any other path reaches `fetch`, which sets the status to 404."
        },
        {
          "language": "bash",
          "filename": "try-health.sh",
          "source": "curl -i http://localhost:3000/health\ncurl -s -o /dev/null -w \"%{http_code}\\n\" http://localhost:3000/nope",
          "output": "HTTP/1.1 200 OK\n(more header lines, such as Date, vary and are omitted here)\n\nok\n404",
          "explanation": "`curl -i` also prints the reply's status line and headers; the first line is the verdict `HTTP/1.1 200 OK`, and the body `ok` comes last. In the second command, `-s` hides progress, `-o /dev/null` throws the body away, and `-w \"%{http_code}\\n\"` prints only the status code. `/dev/null` exists on macOS, Linux and Git Bash on Windows."
        }
      ],
      "productionNote": "The load balancer (the front door that spreads traffic across servers, covered later) calls a health URL like `/health` every few seconds and stops sending users to a server that does not answer 200. Status codes also drive alarms: later you will alert on the count of 5XX replies.",
      "commonMistakes": [
        "Returning status 200 with an error message in the body. Monitoring only looks at status codes, so these failures become invisible.",
        "Confusing 4XX with 5XX. A 404 or 400 means the client asked for something wrong; a 500 or 503 means your server has a problem and you need to act."
      ],
      "sources": [
        { "title": "MDN: An overview of HTTP", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview" },
        { "title": "MDN: HTTP response status codes", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status" },
        { "title": "Bun docs: HTTP server (Bun.serve)", "url": "https://bun.com/docs/api/http" }
      ]
    },
    {
      "id": "environments",
      "title": "Environments: dev, staging, prod",
      "explanation": "An environment is a separate, complete copy of your running system. You will normally have three.\n\nDev (development) is the playground for developers. It can break at any time and holds fake data.\n\nStaging is a full-size rehearsal copy of production, also with fake data. You test releases here exactly as they will run for real.\n\nProd (production) serves real users and real money. A mistake here is an incident.\n\nThe code is the same in all three. What differs is configuration: values such as the database address or the log level. Configuration is passed in through environment variables, named values that the operating system hands to a program when it starts. In code you read one with `process.env.NAME`, which gives `undefined` (no value) when it is not set. The `??` operator means \"use the right side if the left side is undefined\", so it provides a default.\n\nLater in the course each environment will live in its own AWS account, so a mistake in dev cannot touch prod.\n\nCreate `env.ts` in the same folder as `hello.ts`, with the code below.",
      "analogy": "A theatre. Dev is the rehearsal room: you can stop mid-scene and start over. Staging is the dress rehearsal on the real stage with costumes and lights but no audience. Prod is opening night with a paying audience. The script (the code) is identical in all three; only the venue settings (the config) change, such as stage size and lighting.",
      "code": [
        {
          "language": "typescript",
          "filename": "env.ts",
          "source": "const env = process.env.APP_ENV ?? \"dev\";\nconsole.log(`Running in ${env}`);\n",
          "output": "Running in dev",
          "explanation": "`const env = ...` creates a named value. The text in backticks is a template string: `${env}` is replaced by the value of `env`. With no `APP_ENV` set, the default `dev` is used, so a plain `bun run env.ts` prints `Running in dev`."
        },
        {
          "language": "bash",
          "filename": "try-env.sh",
          "source": "bun run env.ts\nAPP_ENV=staging bun run env.ts",
          "output": "Running in dev\nRunning in staging",
          "explanation": "Putting `APP_ENV=staging` in front of a command sets that variable for that one run only (macOS, Linux and Git Bash syntax). In Windows PowerShell use `$env:APP_ENV=\"staging\"; bun run env.ts` instead. The program is unchanged; only the configuration differs."
        }
      ],
      "productionNote": "Later you will define three copies of the shop infrastructure (named ShopDev, ShopStaging and ShopProd) from the same code, and a pipeline will promote each release from dev to staging to prod. Configuration, not code, is what changes between them.",
      "commonMistakes": [
        "Testing only in dev and being surprised in prod. Staging exists so the surprise happens there.",
        "Making staging much smaller than prod. Load problems then stay hidden until real users arrive.",
        "Sharing one database between environments. A test in staging can then damage real customer data."
      ],
      "sources": [
        { "title": "AWS whitepaper: Organizing workload-oriented OUs", "url": "https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/organizing-workload-oriented-ous.html" },
        { "title": "Bun docs: Environment variables", "url": "https://bun.com/docs/runtime/environment-variables" }
      ]
    },
    {
      "id": "latency-throughput-availability",
      "title": "Latency, throughput and availability",
      "explanation": "Three numbers describe how well a service performs.\n\nLatency is how long one request takes, measured in milliseconds (ms; one millisecond is 1/1000 of a second). Throughput is how many requests the system handles per second (RPS, requests per second). Availability is the percentage of time the service works.\n\nAn average hides slow outliers, so we use percentiles. Sort all latencies from fastest to slowest. The p50 (median) is the value that half the requests beat. The p95 is the value that 95% of requests beat, and p99 means only 1 request in 100 was slower. The example below uses the nearest-rank method: p-th percentile is the value at position `ceil(p x count)` in the sorted list (`ceil` rounds up).\n\nAvailability turns into a downtime budget: the time you may be down. Budget = period x (1 - availability). For a 30-day month (43,200 minutes), 99% allows 432 minutes, 99.9% allows 43.2 minutes and 99.99% allows 4.32 minutes. Each extra nine is ten times harder to achieve.\n\nAn SLO (service level objective) is an internal target such as \"99.9% of requests succeed\". An SLA (service level agreement) is a contract with the customer that promises a level and usually pays a penalty if you miss it. Set your SLO stricter than your SLA.",
      "analogy": "A pizza shop. Latency is the minutes from placing an order to the doorbell for one customer. Throughput is how many pizzas the whole shop delivers per hour. Availability is the share of opening hours in which someone answers the phone. The average delivery time can look fine while one customer in a hundred waits an hour. That unlucky customer is the p99, and they are the one who writes the bad review.",
      "code": [
        {
          "language": "typescript",
          "filename": "percentile.ts",
          "source": "const ms = [12, 15, 11, 40, 13, 14, 12, 300, 16, 13];\nconst s = [...ms].sort((a, b) => a - b);\nconst p = (q: number) => s[Math.ceil(q * s.length) - 1];\nconst avg = ms.reduce((a, b) => a + b, 0) / ms.length;\nconsole.log(`avg=${avg} p50=${p(0.5)} p90=${p(0.9)} p99=${p(0.99)}`);\n",
          "output": "avg=44.6 p50=13 p90=40 p99=300",
          "explanation": "`ms` is a list (array) of ten latencies in ms. `[...ms]` copies it and `.sort((a, b) => a - b)` orders it from smallest to largest: 11, 12, 12, 13, 13, 14, 15, 16, 40, 300. `p(q)` picks the item at position `ceil(q x 10)`; the `- 1` converts that position to a list index, which starts at 0. `reduce` adds up all values, so avg is 446 / 10 = 44.6. The average of 44.6 ms looks bad for no clear reason, while p50 shows the typical request took 13 ms and p99 exposes the single 300 ms outlier."
        },
        {
          "language": "typescript",
          "filename": "downtime.ts",
          "source": "for (const a of [99, 99.9, 99.99]) {\n  console.log(`${a}% -> ${(43200 * (100 - a) / 100).toFixed(2)} min/month`);\n}\n",
          "output": "99% -> 432.00 min/month\n99.9% -> 43.20 min/month\n99.99% -> 4.32 min/month",
          "explanation": "The loop runs once for each availability value. 43,200 is the minutes in 30 days (30 x 24 x 60). `(100 - a)` is the unavailable percentage, dividing by 100 turns it into a fraction, and `.toFixed(2)` prints two decimal places."
        }
      ],
      "productionNote": "Later you will set alarms on the p99 of the load balancer's response time, write load-test pass/fail rules such as `p(95)<200` (95% of requests faster than 200 ms) in the k6 load-testing tool, and track an error budget, the downtime your SLO still allows this month.",
      "commonMistakes": [
        "Watching only averages. They hide the slow tail that real users feel.",
        "Promising 99.99% availability without a design that survives a whole AZ (availability zone, a separate data center within an AWS region) failing. A single-AZ system cannot honestly promise it.",
        "Mixing up latency (how fast one request is) and throughput (how many per second). A system can have low latency and low throughput, or the reverse."
      ],
      "sources": [
        { "title": "Amazon CloudWatch concepts: Percentiles", "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_concepts.html#Percentiles" },
        { "title": "AWS Well-Architected Reliability Pillar: Availability", "url": "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/availability.html" }
      ]
    },
    {
      "id": "capacity-math",
      "title": "Capacity math for 100K-250K RPS",
      "explanation": "Before building, estimate how big the system must be. Start with in-flight requests: the requests that have arrived but not yet been answered. Little's law says in-flight = RPS x average latency in seconds. At 250,000 RPS and 20 ms (0.02 s) average latency, 5,000 requests are being worked on at any instant.\n\nNext, the number of servers. Divide the target RPS by the RPS that one server (here, one task, a running copy of your container) can sustain, then multiply by headroom: spare capacity for traffic spikes and for losing part of the system, such as one of three AZs (which removes a third of capacity). Headroom 1.3 means 30% extra.\n\nThis is horizontal scaling: adding more copies of the same server, instead of buying one bigger machine. It works well for stateless programs like the shop API, where any copy can answer any request.\n\n250,000 RPS is 21.6 billion requests per day. No single database can serve that, so caches (CloudFront and Valkey, covered in later topics) must answer most requests before they reach the database.\n\nThe code below uses 5,000 RPS per task as an example only. The real number must come from a load test of your own app, which you will do with k6 later.",
      "analogy": "Supermarket checkouts. Customers arriving per minute (RPS) times the minutes each one spends at the till (latency) gives the number of customers at the tills at once (in-flight). The number of tills you open is arrivals divided by the customers one till can handle, plus spare tills for the Saturday rush and for the one that breaks. Opening more identical tills is horizontal scaling; the shared stockroom behind them (the database) cannot be copied like that.",
      "code": [
        {
          "language": "typescript",
          "filename": "capacity.ts",
          "source": "const rps = 250_000;\nconst latencySec = 0.02;\nconst perTaskRps = 5_000;\nconst headroom = 1.3;\n\nconsole.log(\"in-flight:\", rps * latencySec);\nconsole.log(\"tasks:\", Math.ceil(rps / perTaskRps * headroom));\nconsole.log(\"per day:\", rps * 86_400);\n",
          "output": "in-flight: 5000\ntasks: 65\nper day: 21600000000",
          "explanation": "Underscores in numbers (`250_000`) are only for readability. In-flight = 250,000 x 0.02 = 5,000. Tasks = 250,000 / 5,000 = 50, times 1.3 = 65, and `Math.ceil` rounds up to whole tasks. Per day = 250,000 x 86,400 seconds in a day = 21.6 billion. The `perTaskRps` of 5,000 is a made-up example; replace it with a measured value."
        }
      ],
      "productionNote": "These numbers feed later decisions: the maximum number of tasks your ECS service (AWS's container runner) may scale to, the Fargate vCPU quota (a limit AWS puts on your account that you must ask to raise), how many database connections the tasks will open, and the request rate your k6 load test must aim for.",
      "commonMistakes": [
        "Sizing for average traffic instead of peak traffic.",
        "Forgetting headroom for losing one of three AZs. After that failure the other two must carry all the traffic.",
        "Assuming the database scales like stateless servers. You cannot simply add copies of a database; this is why the cache and connection limits matter."
      ],
      "sources": [
        { "title": "AWS Well-Architected Performance Efficiency Pillar", "url": "https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/welcome.html" },
        { "title": "Grafana k6: Running large tests", "url": "https://grafana.com/docs/k6/latest/testing-guides/running-large-tests/" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "A user opens the shop in a browser. Which order shows the path of the request from the user to your code?",
      "options": [
        "Load balancer, browser, DNS, server process",
        "Browser, DNS (turns the name into an address), load balancer, server process",
        "Server process, load balancer, DNS, browser",
        "DNS, server process, browser, load balancer"
      ],
      "answerIndex": 1,
      "explanation": "The browser starts the request. DNS (the system that turns a domain name into the address of a computer) tells it where to send it. The load balancer receives it at the front door and forwards it to one server process, which runs your code."
    },
    {
      "question": "Sorted latencies in ms: 10, 10, 11, 12, 12, 13, 14, 20, 90, 400. Using the nearest-rank method, what are p50 and p90?",
      "options": [
        "p50 = 12.5, p90 = 245",
        "p50 = 13, p90 = 400",
        "p50 = 12, p90 = 90",
        "p50 = 10, p90 = 20"
      ],
      "answerIndex": 2,
      "explanation": "There are 10 values. p50 is at position ceil(0.5 x 10) = 5, which is 12. p90 is at position ceil(0.9 x 10) = 9, which is 90. The 400 is the p100 (the maximum)."
    },
    {
      "question": "A service promises 99.95% availability. How many minutes of downtime does a 30-day month (43,200 minutes) allow?",
      "options": [
        "21.6 minutes",
        "2.16 minutes",
        "216 minutes",
        "0.5 minutes"
      ],
      "answerIndex": 0,
      "explanation": "Budget = 43,200 x (1 - 0.9995) = 43,200 x 0.0005 = 21.6 minutes."
    },
    {
      "question": "Traffic is 100,000 RPS and the average latency is 50 ms. About how many requests are in flight at any moment?",
      "options": [
        "50",
        "500",
        "100,000",
        "5,000"
      ],
      "answerIndex": 3,
      "explanation": "Little's law: in-flight = RPS x latency in seconds = 100,000 x 0.05 = 5,000."
    },
    {
      "question": "Why keep staging separate from prod?",
      "options": [
        "Staging is required by AWS to use more than one server.",
        "So that releases can be tested as in production, with fake data, without risking real users or real data.",
        "Because staging and prod must run different code.",
        "To make the real application run faster."
      ],
      "answerIndex": 1,
      "explanation": "Staging is a rehearsal copy of prod. Problems found there cost nothing, while the same problems found in prod hurt real users. The code is the same in both; only the configuration differs, and AWS does not require staging."
    }
  ]
});
