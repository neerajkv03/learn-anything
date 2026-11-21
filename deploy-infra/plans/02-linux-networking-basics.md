# 02. Linux & Networking Basics
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 01-deployment-foundations

Note: containers on Fargate run Linux; learner's own OS may be Windows/macOS — commands shown for bash (Linux/macOS terminal, Windows via WSL or Git Bash). State this once.

## Learning goals
- Learner can move around and run commands in a bash terminal.
- Learner can set an environment variable and read it from Bun.
- Learner can explain process, port, and why 0.0.0.0 matters in containers.
- Learner can count addresses in a CIDR block.
- Learner can describe what DNS and TLS do for a request to https://www.example.com.

## Sub-topics
### Terminal and shell basics
- Concept: terminal = text window; shell (bash) = program reading typed commands. Command + arguments + flags. `pwd` (where am I), `cd` (move), `ls` (list), `echo` (print), `mkdir`, `cat`. Exit code 0 = success (`echo $?`).
- Analogy: giving instructions to a very literal assistant over an intercom: one sentence at a time, exact words, replies "0" for done or a number for "couldn't".
- Code example: `cd /tmp && mkdir -p shop-demo && cd shop-demo && pwd` → `/tmp/shop-demo`; `ls /does-not-exist; echo $?` → error message then `2` (GNU ls exit code 2 for serious trouble). Keep to Linux/macOS bash.
- Production use: CI runners (topic 16) and container commands are shell commands; runbooks (topic 23) list them.
- Common mistakes: running commands in the wrong folder; spaces in paths without quotes; ignoring non-zero exit codes.
- Sources: https://www.gnu.org/software/bash/manual/bash.html#Shell-Commands ; https://www.gnu.org/software/coreutils/manual/html_node/ls-invocation.html

### Processes, ports and environment variables
- Concept: process = running program with PID. Server process "listens" on a port (number 1–65535) on an IP. Two processes can't bind the same port (EADDRINUSE) unless SO_REUSEPORT (topic 19). 127.0.0.1 = only this machine; 0.0.0.0 = all network interfaces (needed inside containers; Bun default hostname is 0.0.0.0). Env var = named setting passed to a process (`export NAME=value`, `NAME=value cmd`); Bun reads via `process.env`/`Bun.env` (aliases). Bun port default: $BUN_PORT, $PORT, $NODE_PORT, else 3000.
- Analogy: an office building. IP = street address, port = door number, process = the employee sitting behind a door, env vars = sticky notes handed to the employee each morning. 127.0.0.1 = an internal door only staff can reach; 0.0.0.0 = doors open to the street.
- Code example: `server.ts` — `const server = Bun.serve({ fetch() { return new Response("ok"); } }); console.log(\`listening on ${server.port}\`);` `PORT=4000 bun run server.ts` → `listening on 4000`; `bun run server.ts` (no PORT) → `listening on 3000`. Then `export APP_ENV=dev; echo $APP_ENV` → `dev`.
- Production use: ECS passes config as env vars (topic 09); container must listen on 0.0.0.0:3000 for the load balancer to reach it.
- Common mistakes: binding to 127.0.0.1 in a container (unreachable); hardcoding port; putting secrets in committed .env files.
- Sources: https://bun.com/docs/api/http ; https://bun.com/docs/runtime/environment-variables ; https://github.com/oven-sh/bun/blob/main/packages/bun-types/serve.d.ts

### IP addresses and CIDR ranges
- Concept: IPv4 = 4 numbers 0–255 (32 bits). Private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) not reachable from internet. CIDR `/n` = first n bits fixed; addresses = 2^(32−n). /16 = 65,536; /20 = 4,096; /24 = 256. AWS reserves 5 addresses per subnet (topic 08).
- Analogy: phone numbers. `10.0.x.x` with /16 = "all numbers starting 10-0", like an area code; longer prefix = smaller neighbourhood with fewer numbers.
- Code example: `cidr.ts` — `for (const n of [16, 20, 24, 28]) console.log(\`/${n}: ${2 ** (32 - n)} addresses, ${2 ** (32 - n) - 5} usable in an AWS subnet\`);` → `/16: 65536 addresses, 65531 usable in an AWS subnet`, `/20: 4096 addresses, 4091 usable in an AWS subnet`, `/24: 256 addresses, 251 usable in an AWS subnet`, `/28: 16 addresses, 11 usable in an AWS subnet`.
- Production use: VPC 10.0.0.0/16 split into /20 app subnets (each Fargate task uses one IP) — topic 08.
- Common mistakes: subnets too small for 100+ tasks during deploys (double count); overlapping CIDRs between VPCs/accounts that later need to connect.
- Sources: https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html ; https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html ; https://www.rfc-editor.org/rfc/rfc1918

### DNS and domain names
- Concept: DNS turns names (www.example.com) into IPs. Records: A (name → IPv4), CNAME (name → another name), alias (AWS Route 53 special, topic 10). TTL = seconds resolvers may cache an answer → DNS changes are not instant.
- Analogy: phone contacts app. You tap "Pizza Place" (domain), phone dials the stored number (IP). TTL = how long your phone trusts its saved number before re-checking the directory.
- Code example: `dig +short A example.com` → one or more IPv4 addresses (values vary; show shape like `93.184.215.14`); `dig example.com A` answer section shows `example.com.  <TTL>  IN  A  <ip>`. Say output varies by time and location.
- Production use: www.example.com → CloudFront, origin.example.com → ALB (topics 10, 15); low TTL before migrations.
- Common mistakes: expecting a DNS change to apply instantly; pointing a CNAME at the zone apex (example.com) — use Route 53 alias instead.
- Sources: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/welcome-dns-service.html ; https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/ResourceRecordTypes.html

### TCP, TLS and HTTPS
- Concept: TCP = reliable ordered byte stream (connection, handshake). TLS = encryption + identity on top of TCP; server presents a certificate proving it owns the domain, signed by a trusted authority. HTTPS = HTTP over TLS (port 443). Keep-alive reuses one connection for many requests (saves handshakes — matters at 250K RPS).
- Analogy: TCP = a phone call (connect, then talk in order); TLS = both speaking a secret language after showing the receptionist an ID badge (certificate) issued by a trusted agency; keep-alive = staying on the line for the next question instead of hanging up and redialling.
- Code example: `curl -sI https://example.com | head -n 1` → `HTTP/2 200` (may be `HTTP/1.1 200 OK` depending on curl build); `curl -v https://example.com 2>&1 | grep -i "subject:"` shows certificate subject line (value varies).
- Production use: ACM certificates on ALB/CloudFront (topics 10, 15); TLS to Aurora/RDS Proxy and Valkey (topics 11, 12, 14).
- Common mistakes: terminating TLS but sending plain text across the internet to origin; expired certificates; disabling certificate verification in clients.
- Sources: https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Connection_management_in_HTTP_1.x

## Quiz
1. What does `PORT=4000 bun run server.ts` change and why does the server see it? — tests env vars.
2. A container server listens on 127.0.0.1:3000; the load balancer can't reach it. Why? — tests 0.0.0.0.
3. How many usable addresses does an AWS /24 subnet have? — tests CIDR (251).
4. You changed a DNS record with TTL 3600; why do some users still hit the old IP? — tests TTL.
5. What does TLS add on top of TCP? — tests TLS.
