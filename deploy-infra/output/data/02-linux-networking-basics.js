window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "02-linux-networking-basics",
  "order": 2,
  "title": "Linux & Networking Basics",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Containers on AWS Fargate (AWS's service that runs your containers without you managing servers) run Linux, and every deployed service talks over a network. This topic teaches the bash terminal, processes, ports and environment variables, IP addresses and CIDR blocks (the notation used to size networks), DNS, and how TCP, TLS and HTTPS secure a request. These are the building blocks you need before touching AWS networking.",
  "prerequisites": ["01-deployment-foundations"],
  "subtopics": [
    {
      "id": "terminal-and-shell-basics",
      "title": "Terminal and shell basics",
      "explanation": "A terminal is a text window where you type instructions to the computer instead of clicking. Inside it runs a shell, a program that reads each line you type, runs it, and prints the result. The most common shell on Linux and macOS is bash. Containers on AWS Fargate run Linux, so almost everything you do later (build steps, container commands, runbooks) is a bash command.\n\nAll commands in this course are shown for bash. On Linux or macOS, open the Terminal app. On Windows, use WSL (Windows Subsystem for Linux, a real Linux environment inside Windows) or Git Bash (a bash terminal that comes with Git for Windows). This is stated once here and applies to every topic.\n\nA command has a name, then optional arguments (the things it works on, such as a folder name), then optional flags (switches that change its behaviour, written with a leading dash, such as `-p`). Words are separated by spaces, so a path containing a space must be wrapped in quotes.\n\nFive commands cover most daily work. `pwd` prints the folder you are in (the working directory). `cd <folder>` moves into a folder. `ls <folder>` lists what is inside a folder. `mkdir <name>` creates a folder, and with the flag `-p` it creates missing parent folders and does not complain if the folder already exists. `echo <text>` prints text.\n\nTwo more are useful straight away. `cat <file>` prints the contents of a file. The symbol `>` after a command sends that command's output into a file instead of the screen (creating or overwriting the file).\n\nEvery command finishes with an exit code, a number it hands back to the shell. `0` means success and any other number means some kind of failure. The shell stores the exit code of the last command in `$?`, and you read it with `echo $?`. Scripts, CI runners and deployment tools all decide pass or fail from this number.",
      "analogy": "Giving instructions to a very literal assistant over an intercom. You speak one sentence at a time and must use the exact words, because the assistant never guesses what you meant. After each job the assistant answers with a number: \"0\" means done, and any other number means \"I could not do that\". The terminal is the intercom and the shell is the assistant; flags are the small modifiers you add to a sentence, like \"and create the shelf if it does not exist\".",
      "code": [
        {
          "language": "bash",
          "filename": "shell-basics.sh",
          "source": "cd /tmp && mkdir -p shop-demo && cd shop-demo && pwd",
          "output": "/tmp/shop-demo",
          "explanation": "Moves to `/tmp` (a folder for temporary files on Linux and macOS), creates `shop-demo` there if needed, enters it, and prints where you are. `&&` means \"run the next command only if the previous one succeeded (exit code 0)\"."
        },
        {
          "language": "bash",
          "filename": "files.sh",
          "source": "echo \"hello shop\" > note.txt\ncat note.txt\nls",
          "output": "hello shop\nnote.txt",
          "explanation": "Run this inside the `shop-demo` folder from the previous example, assuming it was empty. `echo ... > note.txt` writes the text into a new file, `cat` prints it back, and `ls` lists the folder, which now contains only `note.txt`."
        },
        {
          "language": "bash",
          "filename": "exit-code.sh",
          "source": "ls /does-not-exist\necho $?",
          "output": "ls: cannot access '/does-not-exist': No such file or directory\n2",
          "explanation": "Listing a folder that does not exist fails. GNU `ls` (the Linux version) prints an error and exits with code 2, which `echo $?` shows. On macOS the message wording differs and the exit code is 1; the point is that it is not 0."
        }
      ],
      "productionNote": "CI runners (automated machines that build and test your code, covered in a later topic) and container start-up commands are just shell commands, and their pass or fail status is the exit code. Runbooks (step-by-step incident instructions, covered in a later topic) list exact commands for the on-call person to paste. Write commands so a non-zero exit code is never silently ignored.",
      "commonMistakes": [
        "Running a command in the wrong folder. Run `pwd` first when something says a file is missing.",
        "Typing a path with spaces without quotes. `cd my folder` passes two arguments; write `cd \"my folder\"`.",
        "Ignoring a non-zero exit code. If the command before the next one failed, the next one may do damage on bad assumptions; chain with `&&` so it stops at the first failure."
      ],
      "sources": [
        { "title": "Bash manual: Shell Commands", "url": "https://www.gnu.org/software/bash/manual/bash.html#Shell-Commands" },
        { "title": "GNU coreutils: ls invocation (exit status)", "url": "https://www.gnu.org/software/coreutils/manual/html_node/ls-invocation.html" }
      ]
    },
    {
      "id": "processes-ports-env-vars",
      "title": "Processes, ports and environment variables",
      "explanation": "A process is a running program. The operating system gives each process a PID (process ID), a unique number, so it can track and stop it. When you run `bun run server.ts`, a new process starts and lives until the program ends or you stop it (press Ctrl+C in the terminal).\n\nA server process listens on a port, a number from 1 to 65535 that picks one service on a machine. Programs reach a service with an IP address (which machine) plus a port (which service on it). Only one process can listen on a given address and port at a time. A second one fails with `EADDRINUSE` (\"address already in use\"), the error name you will see if you start two servers on the same port.\n\nWhich addresses does the server accept connections on? That is its hostname setting. `127.0.0.1` (also called localhost) means only this same machine can connect. `0.0.0.0` means \"all network interfaces\", so connections from other machines are accepted too. Bun's `Bun.serve` (the function that starts an HTTP server, introduced in the previous topic) defaults to `0.0.0.0`. Inside a container this matters: a server bound only to `127.0.0.1` is unreachable from outside the container, even from the load balancer.\n\nAn environment variable is a named setting that the operating system hands to a process when it starts, such as `PORT=4000`. In bash, `export NAME=value` sets a variable for the current terminal and every program started from it, and `$NAME` reads it back. Writing `NAME=value command` sets it for that one command only.\n\nBun reads environment variables through `process.env` (an object whose keys are the variable names). `Bun.env` is another name for the same object. For `Bun.serve`, the port comes from the `port` option if you pass one; otherwise from the variables `BUN_PORT`, `PORT` or `NODE_PORT` (checked in that order), and if none is set, 3000. This is how the same program runs on different ports without editing code.\n\nBun also automatically loads a file named `.env` in the folder you run from, so values written there become environment variables too. Never put real secrets in a `.env` file that you commit to Git.",
      "analogy": "An office building. The IP address is the street address, the port is the door number, and the process is the employee sitting behind one door. Environment variables are sticky notes handed to the employee each morning (\"today use door 4000\"). `127.0.0.1` is an internal door only staff inside can reach; `0.0.0.0` means the doors are open to the street. Two employees cannot sit behind the same door, which is `EADDRINUSE`.",
      "code": [
        {
          "language": "typescript",
          "filename": "server.ts",
          "source": "const server = Bun.serve({\n  fetch() {\n    return new Response(\"ok\");\n  },\n});\n\nconsole.log(`listening on ${server.port}`);",
          "output": "listening on 3000",
          "explanation": "Starts an HTTP server whose handler `fetch` answers every request with the text `ok`. It passes no `port` option, so Bun picks the port from the environment, and `server.port` reports the one it chose. The output shown is for a run where no `BUN_PORT`, `PORT` or `NODE_PORT` is set. The process keeps running until you press Ctrl+C."
        },
        {
          "language": "bash",
          "filename": "run-server.sh",
          "source": "PORT=4000 bun run server.ts",
          "output": "listening on 4000",
          "explanation": "`PORT=4000` in front of the command sets the variable for this one run only. Bun sees it in `process.env` and listens on 4000 instead of 3000."
        },
        {
          "language": "typescript",
          "filename": "envdemo.ts",
          "source": "const env = process.env.APP_ENV ?? \"not set\";\nconsole.log(`APP_ENV is ${env}`);",
          "output": "APP_ENV is dev",
          "explanation": "Reads the variable `APP_ENV`. The `??` operator means \"use the right side if the left side is missing\". The output shown is for the command `APP_ENV=dev bun run envdemo.ts`; with no variable set it prints `APP_ENV is not set`."
        },
        {
          "language": "bash",
          "filename": "export-demo.sh",
          "source": "export APP_ENV=dev\necho $APP_ENV",
          "output": "dev",
          "explanation": "`export` sets the variable for the whole terminal session, so every program you start afterwards (including `bun run envdemo.ts`) can read it."
        }
      ],
      "productionNote": "Amazon ECS (the AWS service that runs your containers, covered later) passes configuration into containers as environment variables, so your code must read its settings from `process.env`. Your container must listen on `0.0.0.0` and the port the load balancer is configured to send traffic to (3000 in this course), or health checks fail.",
      "commonMistakes": [
        "Binding the server to `127.0.0.1` inside a container. It runs but nothing outside the container can reach it.",
        "Hardcoding the port number in code instead of reading it from the environment, which blocks running several copies or changing it per environment.",
        "Putting secrets (passwords, keys) in a `.env` file that is committed to Git. Anyone with repository access then has them."
      ],
      "sources": [
        { "title": "Bun docs: HTTP server (Bun.serve)", "url": "https://bun.com/docs/api/http" },
        { "title": "Bun docs: Environment variables", "url": "https://bun.com/docs/runtime/environment-variables" }
      ]
    },
    {
      "id": "ip-addresses-and-cidr",
      "title": "IP addresses and CIDR ranges",
      "explanation": "An IPv4 address (version 4 of the Internet Protocol) is four numbers from 0 to 255 separated by dots, such as `10.0.3.17`. Each number is 8 bits (a bit is one binary digit, 0 or 1), so the whole address is 32 bits. Every machine on a network needs one so traffic knows where to go.\n\nSome ranges are private: they are reserved for use inside an organisation and are not reachable from the public internet. The three ranges defined by RFC 1918 (the standards document that reserves them) are `10.0.0.0/8`, `172.16.0.0/12` and `192.168.0.0/16`. AWS networks use these ranges.\n\nThe `/n` part is CIDR notation (Classless Inter-Domain Routing). It says that the first n bits of the address are fixed, and the remaining bits can vary. A block with the fixed part `10.0` and `/16` fixes the first 16 bits (the first two numbers), so it covers `10.0.0.0` to `10.0.255.255`. The number of addresses is 2 to the power of (32 minus n). So `/16` gives 65,536, `/20` gives 4,096, `/24` gives 256 and `/28` gives 16. A bigger n means a smaller block.\n\nA subnet is a smaller slice carved out of a bigger network, also written as a CIDR block. In an AWS subnet, AWS reserves 5 addresses for its own use, so you can use the block size minus 5. The next code example computes this table. In it, `**` is the power operator, `for (const n of [...])` repeats the body once per list item, and the backtick string with `${...}` inserts values into text.",
      "analogy": "Phone numbers. A CIDR block like `10.0.x.x` with `/16` is \"every number starting with 10-0\", like an area code that owns all numbers after it. A longer prefix is a smaller neighbourhood with fewer numbers: a `/24` is like a single street's worth of numbers. Private ranges are like internal office extensions that only work inside the building.",
      "code": [
        {
          "language": "typescript",
          "filename": "cidr.ts",
          "source": "for (const n of [16, 20, 24, 28]) {\n  const total = 2 ** (32 - n);\n  console.log(`/${n}: ${total} addresses, ${total - 5} usable in an AWS subnet`);\n}",
          "output": "/16: 65536 addresses, 65531 usable in an AWS subnet\n/20: 4096 addresses, 4091 usable in an AWS subnet\n/24: 256 addresses, 251 usable in an AWS subnet\n/28: 16 addresses, 11 usable in an AWS subnet",
          "explanation": "Run it with `bun run cidr.ts`. For each prefix length it computes 2 to the power of (32 minus n) addresses, then subtracts the 5 that AWS reserves in every subnet."
        }
      ],
      "productionNote": "A typical AWS design is one VPC (your private network in AWS, covered later) with CIDR `10.0.0.0/16`, split into `/20` subnets for the application. Each running Fargate task uses one IP address from its subnet, so the subnet size caps how many tasks can run at once. Sizing is revisited in the VPC topic.",
      "commonMistakes": [
        "Choosing subnets too small. During a deployment old and new tasks run together, so you need roughly double the addresses of normal operation (100+ tasks need well over 100 free addresses).",
        "Giving two networks overlapping CIDR ranges. If they ever need to connect (different VPCs or AWS accounts), overlapping ranges cannot be routed, and changing a CIDR later usually means rebuilding.",
        "Forgetting the 5 reserved addresses per AWS subnet, so a `/28` holds 11 usable addresses, not 16."
      ],
      "sources": [
        { "title": "Amazon VPC: CIDR blocks", "url": "https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html" },
        { "title": "Amazon VPC: Subnet sizing", "url": "https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html" },
        { "title": "RFC 1918: Address Allocation for Private Internets", "url": "https://www.rfc-editor.org/rfc/rfc1918" }
      ]
    },
    {
      "id": "dns-and-domain-names",
      "title": "DNS and domain names",
      "explanation": "Computers connect by IP address, but people remember names. A domain name such as `www.example.com` is a human-friendly name, and DNS (the Domain Name System) is the worldwide directory that translates names into IP addresses. Before your browser can send a request to `https://www.example.com`, it asks DNS for the IP.\n\nThe directory stores records, each with a type. An A record maps a name to an IPv4 address. A CNAME record maps a name to another name (an alias that DNS follows). Amazon Route 53 (AWS's DNS service, covered later) adds its own record type called an alias record, which behaves like a CNAME but is allowed at the zone apex, the bare domain `example.com` with no `www` in front.\n\nEvery answer carries a TTL (time to live), a number of seconds that resolvers (the servers that look up names for users) and devices may remember the answer before asking again. Caching makes DNS fast, but it also means a changed record is not instant: users keep getting the old IP until their cached copy expires.\n\nTo look up a name by hand, use `dig` (a DNS lookup tool, preinstalled on most Linux and macOS systems; in WSL you may need to install it). If dig is not found (Git Bash does not include it), run `nslookup example.com` in PowerShell instead, or use WSL. The `+short` flag prints just the answers. The values printed depend on time and location, so your output will differ from the sample below.",
      "analogy": "The contacts app on your phone. You tap \"Pizza Place\" (the domain name) and the phone dials the stored number (the IP address). TTL is how long your phone trusts its saved number before re-checking the directory. If the pizza place changes its number, your phone keeps dialling the old one until that time is up.",
      "code": [
        {
          "language": "bash",
          "filename": "dig-short.sh",
          "source": "dig +short A example.com",
          "output": "93.184.215.14",
          "explanation": "Asks for the A records of `example.com` and prints only the IPv4 addresses. The value shown is an example of the shape; real output varies by time and location, and may list several addresses."
        },
        {
          "language": "bash",
          "filename": "dig-full.sh",
          "source": "dig example.com A",
          "output": ";; ANSWER SECTION:\nexample.com.    3600    IN    A    93.184.215.14",
          "explanation": "The full output has more sections; only the answer line is shown here. Its columns are: name, TTL in seconds (3600 here means resolvers may cache it for an hour), class `IN` (Internet), record type `A`, and the IP. All values vary by time and location."
        }
      ],
      "productionNote": "A typical production layout points `www.example.com` at the CDN (CloudFront, a global caching service covered later) and `origin.example.com` at the load balancer. Before a planned migration, teams lower the TTL ahead of time (at least as long as the old TTL) so that the switch takes effect quickly.",
      "commonMistakes": [
        "Expecting a DNS change to apply instantly. Cached answers survive until the old TTL expires; with TTL 3600 some users see the old IP for up to an hour.",
        "Pointing a CNAME at the zone apex (`example.com`). The DNS rules do not allow it; use a Route 53 alias record there instead."
      ],
      "sources": [
        { "title": "Amazon Route 53: What is DNS?", "url": "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/welcome-dns-service.html" },
        { "title": "Amazon Route 53: Supported DNS record types", "url": "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/ResourceRecordTypes.html" }
      ]
    },
    {
      "id": "tcp-tls-https",
      "title": "TCP, TLS and HTTPS",
      "explanation": "TCP (Transmission Control Protocol) gives two machines a reliable, ordered stream of bytes. First they perform a handshake, a short exchange of messages that sets up the connection. After that, data arrives complete and in order, with lost pieces re-sent automatically. HTTP requests travel inside a TCP connection.\n\nTLS (Transport Layer Security) adds two things on top of TCP: encryption, so nobody on the path can read or alter the data, and identity, so you know you reached the real server. The server proves who it is by presenting a certificate, a digital document stating that it owns the domain, signed by a trusted certificate authority. Your client checks the signature and the domain name before sending anything private.\n\nHTTPS is simply HTTP carried over TLS. It uses port 443 by default, where plain HTTP uses port 80. The address bar padlock means this check succeeded.\n\nSetting up TCP and TLS takes several network round trips. Keep-alive keeps one connection open and reuses it for many requests, instead of hanging up after each. At high traffic (hundreds of thousands of requests per second) the saved handshakes matter a lot.\n\nIn the commands below, `curl` (introduced earlier) sends a request. `-s` hides its progress meter, `-I` asks for only the response headers, and `|` (a pipe) feeds one command's output into the next. `head -n 1` keeps only the first line, which is the status line. Your output may differ slightly by curl version and by what the server sends.",
      "analogy": "TCP is a phone call: you dial, the other side picks up (the handshake), and then you talk and hear each sentence in order. TLS is both of you switching to a secret language after the receptionist shows an ID badge (the certificate) issued by a trusted agency. Keep-alive is staying on the line to ask your next question instead of hanging up and redialling every time.",
      "code": [
        {
          "language": "bash",
          "filename": "https-status.sh",
          "source": "curl -sI https://example.com | head -n 1",
          "output": "HTTP/2 200",
          "explanation": "Makes an HTTPS request and prints only the status line. `HTTP/2 200` means the TLS handshake worked and the server answered successfully; some curl builds print `HTTP/1.1 200 OK` instead."
        },
        {
          "language": "bash",
          "filename": "cert-subject.sh",
          "source": "curl -v https://example.com 2>&1 | grep -i \"subject:\"",
          "output": "*  subject: CN=example.com",
          "explanation": "`-v` makes curl print connection details, including the certificate, to its error stream. `2>&1` merges that stream into normal output so the pipe can see it, and `grep -i \"subject:\"` keeps lines containing that text, ignoring case. The exact subject text varies by site and over time."
        }
      ],
      "productionNote": "In AWS, certificates come from ACM (AWS Certificate Manager, covered later) and attach to the load balancer and CloudFront. Connections to the database and cache should also use TLS. Keep-alive is on by default in HTTP/1.1 and HTTP/2, so make sure clients reuse connections instead of creating one per request.",
      "commonMistakes": [
        "Terminating TLS at the edge (the front layer that receives connections from users, such as a load balancer or CDN) but sending plain text across the public internet to the origin (the backend server behind the edge).",
        "Letting a certificate expire. Browsers then show a full-page warning and API clients fail; monitor expiry dates or use managed, auto-renewing certificates.",
        "Turning off certificate verification in a client to \"make the error go away\". That removes the identity check, so anyone can impersonate the server."
      ],
      "sources": [
        { "title": "MDN: Transport Layer Security", "url": "https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security" },
        { "title": "MDN: Connection management in HTTP/1.x", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Connection_management_in_HTTP_1.x" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "You run `PORT=4000 bun run server.ts` where the server calls `Bun.serve` without a `port` option. What changes, and why does the server see it?",
      "options": [
        "Bun rewrites server.ts to use 4000 in its source code.",
        "The terminal forwards port 4000 to port 3000 for you.",
        "The variable `PORT` is set in that process's environment, and Bun reads it (via `process.env`) as the port to listen on, so it listens on 4000 instead of 3000.",
        "Nothing changes; the server always listens on 3000."
      ],
      "answerIndex": 2,
      "explanation": "An environment variable placed before a command is handed to that process only. Without an explicit `port` option, Bun checks `BUN_PORT`, `PORT` and `NODE_PORT`, then falls back to 3000."
    },
    {
      "question": "A container's server listens on 127.0.0.1:3000, but the load balancer cannot reach it. Why?",
      "options": [
        "127.0.0.1 accepts connections only from inside the same machine or container, so outside traffic is refused. It should listen on 0.0.0.0.",
        "Port 3000 is reserved by Linux and cannot be used.",
        "Load balancers can only talk to port 80.",
        "127.0.0.1 is a public address that the load balancer blocks."
      ],
      "answerIndex": 0,
      "explanation": "127.0.0.1 is the loopback address, reachable only locally. 0.0.0.0 means all network interfaces, which is what a container server needs so that traffic from outside can arrive."
    },
    {
      "question": "How many usable addresses does an AWS subnet with CIDR /24 have?",
      "options": [
        "256, because AWS lets you use all of them.",
        "16,777,216, because a /24 means 2^24 addresses.",
        "24, because the number after the slash is the address count.",
        "251: 2^(32-24) = 256 addresses minus the 5 that AWS reserves in every subnet."
      ],
      "answerIndex": 3,
      "explanation": "A /24 fixes 24 of 32 bits, leaving 8 bits, so 2^8 = 256 addresses. AWS reserves 5 in each subnet, leaving 251."
    },
    {
      "question": "You changed a DNS record whose TTL was 3600. Why do some users still reach the old IP?",
      "options": [
        "The new IP must be approved by the internet registry first.",
        "Resolvers and devices may cache the old answer for up to 3600 seconds (one hour), so they do not re-check until it expires.",
        "DNS only updates once per day at midnight.",
        "TLS keeps the old IP inside the certificate."
      ],
      "answerIndex": 1,
      "explanation": "TTL is the number of seconds an answer may be cached. Until it expires, cached copies keep returning the old IP, which is why teams lower the TTL before a migration."
    },
    {
      "question": "What does TLS add on top of TCP?",
      "options": [
        "Faster delivery of every packet.",
        "Automatic resending of lost data, which TCP does not do.",
        "Encryption of the data plus proof of the server's identity through a certificate.",
        "A new IP address for the server for each request."
      ],
      "answerIndex": 2,
      "explanation": "TCP already provides reliable, ordered delivery. TLS adds encryption so others cannot read or alter the traffic, and a certificate so the client can verify it reached the real domain."
    }
  ]
});
