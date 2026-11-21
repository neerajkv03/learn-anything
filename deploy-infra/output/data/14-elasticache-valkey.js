window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "14-elasticache-valkey",
  "order": 14,
  "title": "Caching with Valkey",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "A cache is a fast in-memory store that sits in front of your database so most reads never reach it. You will implement the cache-aside pattern with expiry times (TTLs), define an encrypted, multi-AZ Valkey replication group in CDK, and connect to it from Bun over TLS with a password. You will also invalidate entries on writes, build a fixed-window rate limiter (a request counter that resets every minute), and protect the database from cache stampedes (many requests rebuilding one expired entry at the same moment).",
  "prerequisites": ["06-app-production-readiness", "08-vpc-networking", "11-aurora-postgresql"],
  "subtopics": [
    {
      "id": "cache-aside-pattern",
      "title": "Cache-aside pattern",
      "explanation": "A cache is a small, very fast store that keeps copies of data you read often, so you do not have to fetch it from the slower original source every time. Valkey is an open-source, in-memory key/value store. Key/value means you save a value (for example a piece of text) under a name (the key) and later ask for it by that name. \"Redis-compatible\" means Valkey speaks the same protocol and commands as the older Redis software, so Redis client libraries (including Bun's) work with it. Amazon ElastiCache is the AWS service that runs Valkey servers for you.\n\nThe most common way to use a cache is called cache-aside. Your code does the work, not the cache. To read: ask the cache for the key. If it has the key, that is a cache hit and you return the value. If not, that is a cache miss: you read the database, store the result in the cache with a TTL (time to live, the number of seconds after which the cache deletes the entry on its own), and return it.\n\nThe hit ratio is hits divided by (hits plus misses). It decides how much load your database sees. At 250,000 requests per second (RPS) with a 90% hit ratio, only 10% of requests miss, so Aurora receives 25,000 RPS instead of 250,000.\n\nOnly cache data that can be a few seconds out of date, such as product details. The cache holds copies; the database stays the source of truth. The first example below simulates the pattern in memory with a fake clock so you can run it without a server. The second shows the real version against Valkey.",
      "analogy": "A chef keeps a mise-en-place tray (chopped onions, herbs) next to the stove. If the tray has what you need, you grab it instantly (hit). If it is empty, you walk to the walk-in fridge (the database), refill the tray, and carry on (miss). Anything on the tray older than a set time gets thrown out (TTL) so the food never gets stale. The tray is a convenience copy; the fridge is where the real stock lives.",
      "code": [
        {
          "language": "typescript",
          "filename": "cache-demo.ts",
          "source": "// Fake database and fake cache so this runs with no server.\nconst db = new Map([[\"p1\", { id: \"p1\", name: \"Mug\", price_cents: 1200 }]]);\nconst cache = new Map<string, { value: string; expiresAt: number }>();\nlet now = 0; // fake clock, in seconds\n\nfunction getProduct(id: string) {\n  const key = `product:${id}`;\n  const entry = cache.get(key);\n  if (entry && entry.expiresAt > now) {\n    return { source: \"cache\", data: JSON.parse(entry.value) };\n  }\n  const row = db.get(id); // cache miss: read the database\n  cache.set(key, { value: JSON.stringify(row), expiresAt: now + 60 }); // TTL 60 s\n  return { source: \"db\", data: row };\n}\n\nconsole.log(getProduct(\"p1\").source);\nconsole.log(getProduct(\"p1\").source);\nnow = 61; // 61 seconds later the entry has expired\nconsole.log(getProduct(\"p1\").source);\n\n// Hit-ratio math: requests per second that reach the database\nconsole.log(250000 * (100 - 90) / 100);",
          "output": "db\ncache\ndb\n25000",
          "explanation": "Run it with `bun run cache-demo.ts`. A Map is JavaScript's built-in key/value collection. The first call misses and reads the database, the second hits, and after the fake clock passes the 60-second TTL the entry counts as expired and the database is read again. JSON.stringify turns an object into text, because Valkey stores text (strings), and JSON.parse turns it back. The last line is the hit-ratio calculation: 10% of 250,000 is 25,000."
        },
        {
          "language": "typescript",
          "filename": "cache.ts",
          "source": "import { RedisClient } from \"bun\";\nimport { reader } from \"./db\"; // your read-only Bun.sql instance from the Aurora topic\n\nexport const redis = new RedisClient(process.env.REDIS_URL!);\n\nexport async function getProduct(id: string) {\n  const key = `product:${id}`;\n  const hit = await redis.get(key);\n  if (hit) return { source: \"cache\", data: JSON.parse(hit) };\n\n  const [row] = await reader`SELECT id, name, price_cents FROM products WHERE id = ${id}`;\n  await redis.send(\"SET\", [key, JSON.stringify(row), \"EX\", \"60\"]);\n  return { source: \"db\", data: row };\n}\n\n// Calling it twice for the same id (needs a running Valkey and database):\nconsole.log((await getProduct(\"p1\")).source);\nconsole.log((await getProduct(\"p1\")).source);",
          "output": "db\ncache",
          "explanation": "This is the real version and needs a reachable Valkey server (REDIS_URL set) and a products table, so it is not runnable on its own. `async` marks a function that can pause at `await` while it waits for the network without blocking other work. `redis.get` returns the stored text, or null when the key is missing. `redis.send(\"SET\", [...])` sends a raw command: `SET key value EX 60` stores the value and makes it expire after 60 seconds. Each part of the command is a separate string in the array, so the number 60 is written \"60\". The key name `product:p1` uses a colon-separated naming habit that keeps keys readable."
        }
      ],
      "productionNote": "Use cache-aside for product and catalogue reads and for server-rendered page data, where a few seconds of staleness is acceptable. Always set a TTL, and track hit and miss counts so you know your real hit ratio.",
      "commonMistakes": [
        "Caching without a TTL, so a stale value stays forever if an invalidation is ever missed.",
        "Putting per-user secrets or personal data under a shared key such as product:p1, so another user can read it.",
        "Treating the cache as the source of truth. Cache entries can be evicted (removed to free memory) or lost on failover, so the database must always be able to rebuild them."
      ],
      "sources": [
        { "title": "ElastiCache caching strategies", "url": "https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html" },
        { "title": "Bun Redis client", "url": "https://bun.com/docs/runtime/redis" },
        { "title": "Valkey SET command", "url": "https://valkey.io/commands/set/" }
      ]
    },
    {
      "id": "elasticache-valkey-in-cdk",
      "title": "ElastiCache Valkey in CDK",
      "explanation": "In ElastiCache, a replication group is one primary node (accepts writes) plus replica nodes (copies that serve reads and take over if the primary fails). This course uses cluster mode disabled: a single shard (one data partition) holding all keys, with one primary and several replicas. The reason is the client: Bun's built-in Redis client lists Redis Cluster (the mode that spreads keys over many shards) as unsupported. With one shard you scale reads by adding replicas and scale writes by choosing a bigger node type.\n\nCDK has no high-level (L2) construct for this, so you use the L1 constructs, which map one-to-one to CloudFormation resources: `CfnSubnetGroup` (which subnets the nodes may use) and `CfnReplicationGroup`. Put the nodes in the isolated data subnets from the VPC topic.\n\nThe key settings:\n\n- `engine: \"valkey\"` and `engineVersion: \"9.1\"` (this course's version; confirm which strings your region accepts with `aws elasticache describe-cache-engine-versions --engine valkey`).\n\n- `numCacheClusters: 3` means 1 primary plus 2 replicas (maximum 6).\n\n- `automaticFailoverEnabled` promotes a replica when the primary fails (needs at least 2 nodes).\n\n- `multiAzEnabled` spreads nodes over availability zones.\n\n- `transitEncryptionEnabled` turns on TLS (required for new Valkey groups).\n\n- `atRestEncryptionEnabled` encrypts stored data and defaults to false; changing it later replaces the group, so set it from day one.\n\n- Leave `cacheParameterGroupName` out to use the default parameter group.\n\n`authToken` is a password the client must send, 16 to 128 printable characters, and it requires TLS. Generate it as a Secrets Manager secret. `secretValue.unsafeUnwrap()` is named \"unsafe\" because it turns the secret into a plain value; here it renders a CloudFormation dynamic reference (`{{resolve:secretsmanager:...}}`), not the password text, so the secret is not written into the template.\n\nWith cluster mode disabled you get two endpoints (DNS names): the primary endpoint for writes and the reader endpoint for reads. The reader endpoint is DNS round-robin over the replicas, not a load balancer, so it does not check how busy each replica is. Allow your app's security group to reach port 6379 on `cacheSg` with `cacheSg.connections.allowFrom(appSg, ec2.Port.tcp(6379))`, and give the task the secret with `ecs.Secret.fromSecretsManager(cacheSecret)`. ElastiCache also offers a serverless variant (`CfnServerlessCache`); this course does not use it.",
      "analogy": "You rent a fridge unit with one main door for loading food (the primary) and two viewing windows where customers look inside (the replicas). Both windows show the same contents. If the main unit breaks, a spare unit in another building takes over the loading door (failover), and the passcode on the door (auth token) plus the sealed, encrypted corridor (TLS) keep strangers out.",
      "code": [
        {
          "language": "typescript",
          "filename": "lib/cache-stack.ts",
          "source": "import { CfnOutput, Stack, StackProps } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport * as elasticache from \"aws-cdk-lib/aws-elasticache\";\nimport * as secretsmanager from \"aws-cdk-lib/aws-secretsmanager\";\nimport { Construct } from \"constructs\";\n\ninterface CacheStackProps extends StackProps {\n  vpc: ec2.IVpc;\n  cacheSg: ec2.ISecurityGroup;\n}\n\nexport class CacheStack extends Stack {\n  constructor(scope: Construct, id: string, props: CacheStackProps) {\n    super(scope, id, props);\n    const { vpc, cacheSg } = props;\n\n    const cacheSecret = new secretsmanager.Secret(this, \"CacheAuth\", {\n      generateSecretString: { passwordLength: 32, excludePunctuation: true },\n    });\n\n    const subnets = new elasticache.CfnSubnetGroup(this, \"CacheSubnets\", {\n      description: \"shop cache\",\n      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,\n    });\n\n    const cache = new elasticache.CfnReplicationGroup(this, \"Cache\", {\n      replicationGroupDescription: \"shop valkey\",\n      engine: \"valkey\",\n      engineVersion: \"9.1\",\n      cacheNodeType: \"cache.r7g.large\",\n      numCacheClusters: 3, // 1 primary + 2 replicas\n      automaticFailoverEnabled: true,\n      multiAzEnabled: true,\n      transitEncryptionEnabled: true,\n      atRestEncryptionEnabled: true,\n      authToken: cacheSecret.secretValue.unsafeUnwrap(), // becomes a {{resolve:secretsmanager:...}} reference\n      cacheSubnetGroupName: subnets.ref,\n      securityGroupIds: [cacheSg.securityGroupId],\n    });\n\n    new CfnOutput(this, \"PrimaryEndpoint\", { value: cache.attrPrimaryEndPointAddress });\n    new CfnOutput(this, \"ReaderEndpoint\", { value: cache.attrReaderEndPointAddress });\n  }\n}",
          "output": "",
          "explanation": "The stack takes the VPC and a security group as props and prints nothing when run. It creates the secret, the subnet group in the isolated subnets, and the replication group, then exposes both endpoint addresses as CloudFormation outputs that `cdk deploy` prints after deploying. The `cache.r7g.large` node type is an example; size it from your data volume and traffic."
        },
        {
          "language": "typescript",
          "filename": "test/cache-stack.test.ts",
          "source": "import { test } from \"bun:test\";\nimport { App, Stack } from \"aws-cdk-lib\";\nimport { Template } from \"aws-cdk-lib/assertions\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport { CacheStack } from \"../lib/cache-stack\";\n\ntest(\"cache is TLS-encrypted and multi-AZ\", () => {\n  const app = new App();\n  const base = new Stack(app, \"Base\");\n  const vpc = new ec2.Vpc(base, \"Vpc\", {\n    maxAzs: 2,\n    subnetConfiguration: [{ name: \"data\", subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],\n  });\n  const cacheSg = new ec2.SecurityGroup(base, \"CacheSg\", { vpc });\n\n  const template = Template.fromStack(new CacheStack(app, \"Cache\", { vpc, cacheSg }));\n  template.hasResourceProperties(\"AWS::ElastiCache::ReplicationGroup\", {\n    Engine: \"valkey\",\n    TransitEncryptionEnabled: true,\n    MultiAZEnabled: true,\n  });\n});",
          "output": "",
          "explanation": "Run it with `bun test`. It builds a small VPC, synthesises the cache stack into a CloudFormation template, and checks the three properties you must never lose. If someone removes TLS or multi-AZ, the test fails before anything is deployed. A passing run prints a summary from the test runner, which is omitted here."
        }
      ],
      "productionNote": "One replication group serves as a shared cache, a rate-limit counter store and a session store for all your tasks. Always run at least one replica in a different AZ in production, and keep the nodes in isolated subnets reachable only from the app's security group.",
      "commonMistakes": [
        "Enabling cluster mode with a client that cannot speak Cluster. Bun's built-in client cannot, so keep cluster mode disabled.",
        "Turning TLS off. New Valkey groups require transit encryption, so the deployment fails.",
        "Running a single node with no replica in production: a node failure then means an empty cache and a flood of requests to the database."
      ],
      "sources": [
        { "title": "CloudFormation AWS::ElastiCache::ReplicationGroup", "url": "https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-elasticache-replicationgroup.html" },
        { "title": "ElastiCache endpoints", "url": "https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Endpoints.html" },
        { "title": "aws-cdk-lib aws_elasticache module", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticache-readme.html" }
      ]
    },
    {
      "id": "connecting-from-bun",
      "title": "Connecting from Bun",
      "explanation": "Bun ships a Redis client, `RedisClient`, that also works with Valkey. You give it a URL. The scheme `redis://` is a plain connection; `rediss://` (two s) switches on TLS. Your replication group has TLS and an auth token, so the URL has the form `rediss://:TOKEN@HOST:6379`: empty username, the token as the password after the colon, and 6379 as the standard port. Wrap the token in `encodeURIComponent` so special characters cannot break the URL.\n\nBuild the URL from environment variables set on your ECS task: REDIS_HOST (the primary endpoint address from the CDK output) and REDIS_AUTH (the token, injected from Secrets Manager as in the ECS topic).\n\nThe client connects lazily, on the first command. It reconnects automatically after a dropped connection (`autoReconnect` is true by default, with a wait that starts at 50 ms and doubles up to 2 seconds, giving up after 20 attempts). By default `enableOfflineQueue` is true, which means commands issued while disconnected wait in memory and run after reconnecting. At high request rates that queue can grow without limit during an outage, so set it to false to fail fast: commands then error immediately and your code can fall back to the database. `enableAutoPipelining` (default true) automatically batches commands sent close together into fewer network round trips.\n\nCreate one client per process when the app boots and reuse it everywhere. If you want to read read-heavy keys from the replicas, create a second client pointed at the reader endpoint.",
      "analogy": "You phone the fridge unit's intercom over an encrypted line and say the passcode first. If the line drops, your phone redials by itself, waiting a little longer between attempts. With the offline queue on, you keep talking and your messages pile up until the line returns; with it off, you hang up on the spot and use the walk-in fridge instead.",
      "code": [
        {
          "language": "typescript",
          "filename": "redis.ts",
          "source": "import { RedisClient } from \"bun\";\n\nconst url = `rediss://:${encodeURIComponent(process.env.REDIS_AUTH!)}@${process.env.REDIS_HOST}:6379`;\n\nexport const redis = new RedisClient(url, {\n  enableOfflineQueue: false, // fail fast instead of queueing during an outage\n  connectionTimeout: 2000, // milliseconds\n});\n\nconsole.log(await redis.send(\"PING\", []));",
          "output": "PONG",
          "explanation": "Needs REDIS_HOST and REDIS_AUTH set and network access from inside your VPC, so run it from an ECS task (for example with ECS Exec) rather than your laptop. `process.env.REDIS_AUTH!` reads the environment variable; the `!` tells TypeScript it is definitely set. PING is the standard health command, and a healthy server answers PONG. Importing this file from other modules gives the whole process one shared client."
        }
      ],
      "productionNote": "Create the client once at boot and share it. Consider treating a failed PING as not-ready in your /readyz check only if the app truly cannot serve without the cache; usually a cache outage should degrade to database reads, not take the service down.",
      "commonMistakes": [
        "Using redis:// (no TLS) against a group that only accepts TLS: the connection fails or hangs.",
        "Creating a new client for every request, which opens a fresh TLS connection each time and exhausts connections.",
        "Leaving the offline queue on during an outage so thousands of pending commands pile up in memory and then all fire at once."
      ],
      "sources": [
        { "title": "Bun Redis client", "url": "https://bun.com/docs/runtime/redis" },
        { "title": "ElastiCache authentication (AUTH token)", "url": "https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/auth.html" }
      ]
    },
    {
      "id": "ttls-and-invalidation",
      "title": "TTLs and invalidation",
      "explanation": "A TTL puts an upper limit on how stale a cached value can be. But sometimes you must remove a value sooner: when a product's price changes, you do not want customers to see the old price for another minute. Removing an entry on purpose is called invalidation.\n\nThe safe rule is: write to the database first, then delete the cache key (the `DEL` command). The next read misses and refills the cache from the fresh database row. Delete rather than update the cached value, because two concurrent writers could finish in a different order in the cache than in the database and leave an old value cached.\n\nAdd jitter, a small random amount, to TTLs. If you cache 10,000 products with exactly 60 seconds, they all expire together and the database gets a spike. With 60 plus a random 0 to 14 seconds, expiries spread out.\n\nName keys consistently, such as `product:p1`. Putting a version in front, `v2:product:p1`, lets you invalidate everything at once after you change the stored format: deploy code that uses `v2:` and the old `v1:` keys are simply never read again and expire on their own. Remember that list keys (such as `products:featured`) that contain an item also need invalidating when that item changes.",
      "analogy": "Every tray in the kitchen has a best-before sticker (TTL). If the recipe changes, you do not wait for the sticker: you throw that tray out immediately so the next order is made fresh (invalidation). And you stamp the stickers with slightly different times so all the trays do not expire during the same lunch rush (jitter).",
      "code": [
        {
          "language": "typescript",
          "filename": "invalidate-demo.ts",
          "source": "// In-memory stand-ins for the database and the cache.\nconst db = new Map([[\"p1\", 1200]]); // price in cents\nconst cache = new Map<string, number>();\n\nfunction read(id: string) {\n  const key = `product:${id}`;\n  if (cache.has(key)) return `cache ${cache.get(key)}`;\n  const price = db.get(id)!;\n  cache.set(key, price);\n  return `db ${price}`;\n}\n\nfunction updatePrice(id: string, cents: number) {\n  db.set(id, cents); // 1. write the source of truth first\n  cache.delete(`product:${id}`); // 2. then delete the cached copy\n}\n\nconsole.log(read(\"p1\"));\nconsole.log(read(\"p1\"));\nupdatePrice(\"p1\", 1500);\nconsole.log(read(\"p1\"));\nconsole.log(read(\"p1\"));\n\n// TTL with jitter: base seconds plus 0..14 extra seconds.\nfunction ttlWithJitter(base: number, random: number) {\n  return base + Math.floor(random * 15);\n}\nconsole.log(ttlWithJitter(60, 0));\nconsole.log(ttlWithJitter(60, 0.5));\nconsole.log(ttlWithJitter(60, 0.999));",
          "output": "db 1200\ncache 1200\ndb 1500\ncache 1500\n60\n67\n74",
          "explanation": "Run it with `bun run invalidate-demo.ts`. After the update the cached copy is gone, so the next read goes to the database and sees 1500, then the refilled cache serves it. The jitter function takes the random number as a parameter so the output is predictable here; in real code you pass `Math.random()`, which gives a number from 0 up to (not including) 1, so the TTL is between 60 and 74."
        },
        {
          "language": "typescript",
          "filename": "products.ts",
          "source": "import { redis } from \"./redis\";\nimport { writer } from \"./db\"; // your read-write Bun.sql instance from the Aurora topic\n\nexport async function updatePrice(id: string, cents: number) {\n  await writer`UPDATE products SET price_cents = ${cents} WHERE id = ${id}`;\n  await redis.del(`product:${id}`);\n}\n\nexport function productTtl() {\n  return 60 + Math.floor(Math.random() * 15); // 60 to 74 seconds\n}",
          "output": "",
          "explanation": "The real version: the database write completes before the key is deleted, so no reader can refill the cache with the old row after the delete. Use `productTtl()` as the EX value in the cache-aside SET from the first sub-topic. Nothing is printed because these are definitions that other code calls."
        }
      ],
      "productionNote": "Invalidate on every write path for the entity: admin edits, imports and background jobs. For CMS content or product edits, write to the database, delete the keys, and let the next reader refill.",
      "commonMistakes": [
        "Updating or deleting the cache before the database commit. A reader can then refill the cache with the old row and it stays stale until the TTL.",
        "No jitter, so many keys expire in the same second and cause a database spike.",
        "Forgetting list or search keys that contain the changed item, which keep showing the old data."
      ],
      "sources": [
        { "title": "ElastiCache caching strategies", "url": "https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html" },
        { "title": "Valkey EXPIRE command", "url": "https://valkey.io/commands/expire/" },
        { "title": "Valkey DEL command", "url": "https://valkey.io/commands/del/" }
      ]
    },
    {
      "id": "rate-limiting",
      "title": "Rate limiting",
      "explanation": "Rate limiting caps how many requests a client may make in a period, protecting login pages, write endpoints and expensive queries from abuse or runaway scripts. The simplest design is a fixed window: divide time into one-minute slots and count requests per client in the current slot.\n\nThe key is `rl:<clientId>:<minute>`. For each request run `INCR`, which adds 1 to the number stored at the key (creating it as 0 first if missing) and returns the new count. If the result is 1, this is the first request in the window, so run `EXPIRE key 60` to delete the counter after 60 seconds. If the count is over the limit, reject with status 429 Too Many Requests and a `Retry-After` header telling the client how many seconds to wait.\n\nThe counter must live in Valkey, not in each task's memory. With 20 tasks each keeping its own counter, a client whose requests are spread by the load balancer could make up to 20 times the limit. Valkey is shared, so every task sees the same count. The first example simulates the logic in memory; the second is the Valkey version.\n\nTwo honest limits of this design: a client can send the full limit at the end of one window and again at the start of the next (up to twice the limit in a short burst), and if the process crashes between INCR and EXPIRE the key has no expiry. For most per-user or per-API-key limits that is acceptable. Blocking by IP address at the network edge is done with WAF in the security topic; the app limiter is for per-user and per-API-key rules. Behind a load balancer or a CDN (a worldwide cache network; CloudFront is covered in topic 15), the client's real IP is in a forwarded header, not the connection address.",
      "analogy": "A nightclub bouncer with a clicker counts guests admitted per hour for each guest list. Once the count passes the limit, the next guest waits outside until the hour rolls over and the clicker resets. If every door had its own bouncer with a separate clicker, the same guest could enter through all the doors; one shared clicker (Valkey) prevents that.",
      "code": [
        {
          "language": "typescript",
          "filename": "ratelimit-demo.ts",
          "source": "// In-memory simulation of the fixed-window logic.\nconst counters = new Map<string, number>();\n\nfunction allow(clientId: string, nowMs: number, limit = 100) {\n  const window = Math.floor(nowMs / 60000); // which minute we are in\n  const key = `rl:${clientId}:${window}`;\n  const n = (counters.get(key) ?? 0) + 1; // like INCR\n  counters.set(key, n);\n  return n <= limit;\n}\n\nconst results: boolean[] = [];\nfor (let i = 0; i < 101; i++) results.push(allow(\"k1\", 5000));\n\nconsole.log(results.slice(0, 100).every(Boolean)); // first 100 allowed?\nconsole.log(results[100]); // the 101st\nconsole.log(allow(\"k1\", 65000)); // next minute: new window\nconsole.log(allow(\"k2\", 5000)); // different client",
          "output": "true\nfalse\ntrue\ntrue",
          "explanation": "Run it with `bun run ratelimit-demo.ts`. `??` means \"use the right side if the left is missing\", so a new key starts at 0. The time is passed in (5000 ms is inside minute 0, 65000 ms is inside minute 1) so the result is predictable. The first 100 calls pass, the 101st is refused, a later minute starts fresh, and another client has its own counter."
        },
        {
          "language": "typescript",
          "filename": "ratelimit.ts",
          "source": "import { redis } from \"./redis\";\n\nexport async function allow(clientId: string, limit = 100) {\n  const window = Math.floor(Date.now() / 60000);\n  const key = `rl:${clientId}:${window}`;\n  const n = await redis.incr(key);\n  if (n === 1) await redis.expire(key, 60);\n  return n <= limit;\n}\n\nexport async function handle(req: Request) {\n  const clientId = req.headers.get(\"x-api-key\") ?? \"anonymous\";\n  if (!(await allow(clientId))) {\n    return new Response(\"rate limited\", { status: 429, headers: { \"Retry-After\": \"60\" } });\n  }\n  return new Response(\"ok\");\n}",
          "output": "",
          "explanation": "The Valkey version. `redis.incr` and `redis.expire` (seconds) are Bun client methods for the INCR and EXPIRE commands. With a running Valkey, 101 calls to `allow(\"k1\")` inside one minute return true 100 times and then false, and `handle` answers the 101st request with status 429. The 60 in Retry-After is a simple upper bound for the remaining wait. Nothing prints here because these are functions that your server calls."
        }
      ],
      "productionNote": "Protect login, write endpoints and expensive queries. Pick the client identifier carefully (user id or API key where possible), and decide whether to fail open (allow requests) or fail closed (reject) if Valkey is unreachable.",
      "commonMistakes": [
        "Keeping counters in each task's memory, which multiplies the real limit by the number of tasks.",
        "Forgetting EXPIRE, so counters live forever and fill memory.",
        "Limiting by IP address behind a load balancer or a CDN (a worldwide cache network) while reading the connection address, so every user appears to come from the proxy. Read the client IP from the forwarded header instead."
      ],
      "sources": [
        { "title": "Valkey INCR command", "url": "https://valkey.io/commands/incr/" },
        { "title": "Bun Redis client", "url": "https://bun.com/docs/runtime/redis" },
        { "title": "MDN: 429 Too Many Requests", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429" }
      ]
    },
    {
      "id": "cache-stampede-protection",
      "title": "Cache stampede protection",
      "explanation": "A cache stampede happens when a very popular key expires and thousands of concurrent requests all miss at the same moment. Every one of them runs the same expensive database query, and the database that the cache was protecting gets flooded.\n\nThe main fix is a short lock. Use `SET lock:<key> 1 NX PX 5000`. `NX` means \"only set if the key does not exist\", so exactly one request wins; the reply is `OK` for the winner and null for everyone else. `PX 5000` makes the lock expire after 5000 milliseconds. The winner rebuilds the value, stores it, and releases the lock with DEL. The others wait briefly and read the freshly stored value.\n\nThe lock must have an expiry. If the winner crashes while holding it, the lock would otherwise block rebuilds forever.\n\nTwo other tools help. TTL jitter (previous sub-topic) stops many keys expiring together. Serving stale data while one request refreshes it in the background avoids waiting at all.\n\nThe first example uses an in-memory store and a fake slow loader so you can see the difference: 1,000 simultaneous requests cause 1,000 loads without a lock and 1 with it. `Bun.sleep(ms)` returns a promise that completes after that many milliseconds, and `Promise.all` waits for many async calls running at the same time.",
      "analogy": "A bakery runs out of bread at the busiest moment. Without a rule, all 50 staff start baking the same loaf. With a rule, whoever grabs the \"baking\" flag bakes (and the flag has a timer in case they faint), and everyone else tells customers \"two minutes\" and then serves from the new batch.",
      "code": [
        {
          "language": "typescript",
          "filename": "stampede-demo.ts",
          "source": "const store = new Map<string, string>();\nlet loads = 0;\n\nasync function load() {\n  loads++;\n  await Bun.sleep(20); // pretend this is a slow database query\n  return \"homepage-data\";\n}\n\n// No protection: every miss runs load().\nasync function getNaive(key: string) {\n  const v = store.get(key);\n  if (v) return v;\n  const fresh = await load();\n  store.set(key, fresh);\n  return fresh;\n}\n\n// Lock: only the request that creates the lock runs load().\nasync function getLocked(key: string) {\n  const v = store.get(key);\n  if (v) return v;\n  const lockKey = `lock:${key}`;\n  if (!store.has(lockKey)) {\n    store.set(lockKey, \"1\"); // like SET NX\n    try {\n      const fresh = await load();\n      store.set(key, fresh);\n      return fresh;\n    } finally {\n      store.delete(lockKey);\n    }\n  }\n  await Bun.sleep(50); // losers wait, then read the winner's value\n  return store.get(key) ?? load();\n}\n\nawait Promise.all(Array.from({ length: 1000 }, () => getNaive(\"home\")));\nconsole.log(\"naive loads:\", loads);\n\nstore.clear();\nloads = 0;\nawait Promise.all(Array.from({ length: 1000 }, () => getLocked(\"home\")));\nconsole.log(\"locked loads:\", loads);",
          "output": "naive loads: 1000\nlocked loads: 1",
          "explanation": "Run it with `bun run stampede-demo.ts`. All 1,000 calls start before any load finishes. In the naive version every call misses, so load() runs 1,000 times. In the locked version the first call creates the lock and loads; the other 999 see the lock, wait 50 ms (longer than the 20 ms load) and then find the value in the store. The `finally` block removes the lock even if load() throws."
        },
        {
          "language": "typescript",
          "filename": "hot.ts",
          "source": "import { redis } from \"./redis\";\n\nexport async function getHot(key: string, load: () => Promise<string>) {\n  const v = await redis.get(key);\n  if (v) return v;\n\n  const got = await redis.send(\"SET\", [`lock:${key}`, \"1\", \"NX\", \"PX\", \"5000\"]);\n  if (got === \"OK\") {\n    try {\n      const fresh = await load();\n      await redis.send(\"SET\", [key, fresh, \"EX\", \"60\"]);\n      return fresh;\n    } finally {\n      await redis.del(`lock:${key}`);\n    }\n  }\n\n  await Bun.sleep(50);\n  return (await redis.get(key)) ?? load();\n}",
          "output": "",
          "explanation": "The Valkey version of the same idea. SET with NX replies `OK` for the one request that gets the lock and null for the rest; PX 5000 is the lock's expiry in milliseconds. With 1,000 concurrent misses, `load()` runs about once, plus the occasional fallback when a waiter does not find the value yet. Nothing prints because `getHot` is a function your handlers call."
        }
      ],
      "productionNote": "Apply it to homepage data and popular product keys that are read at peak. Keep cached values small: very large values make SET slow and block other commands.",
      "commonMistakes": [
        "A lock without an expiry: if the holder crashes, nobody can rebuild the key until someone deletes the lock by hand.",
        "Letting every waiter fall back to the database straight away, which recreates the stampede. Wait briefly first.",
        "Caching giant values, which makes every SET and GET slow for all clients."
      ],
      "sources": [
        { "title": "Valkey SET command", "url": "https://valkey.io/commands/set/" },
        { "title": "Bun Redis client", "url": "https://bun.com/docs/runtime/redis" },
        { "title": "ElastiCache caching strategies", "url": "https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why does this course run ElastiCache with cluster mode disabled?",
      "options": [
        "Cluster mode is not available for Valkey on ElastiCache.",
        "Cluster mode disables TLS, which the course requires.",
        "Bun's built-in Redis client lists Redis Cluster as unsupported, so a single shard with replicas is used.",
        "Cluster mode cannot use replicas, so it has no failover."
      ],
      "answerIndex": 2,
      "explanation": "Bun's Redis client does not support Redis Cluster, so one shard (primary plus replicas) is used. You scale reads with replicas and writes with a bigger node type."
    },
    {
      "question": "Your site receives 200,000 requests per second and the cache hit ratio is 95%. About how many requests per second reach the database?",
      "options": [
        "10,000",
        "95,000",
        "190,000",
        "200,000"
      ],
      "answerIndex": 0,
      "explanation": "Only the 5% of requests that miss reach the database: 200,000 x 5 / 100 = 10,000."
    },
    {
      "question": "When a product is updated, why delete the cache key instead of writing the new value into the cache?",
      "options": [
        "Valkey cannot overwrite an existing key.",
        "Deleting is required so that the TTL is reset to zero.",
        "A SET command is slower than DEL on large values.",
        "Two concurrent updates can reach the cache in a different order than the database and leave an old value cached; deleting makes the next read refill from the database."
      ],
      "answerIndex": 3,
      "explanation": "Concurrent writers can finish in a different order in the cache than in the database. Deleting avoids caching a stale value, because the next reader reloads the current row."
    },
    {
      "question": "You keep rate-limit counters in each task's own memory, with a limit of 100 per minute, and you run 20 tasks behind a load balancer. What is the most requests per minute one client could get through?",
      "options": [
        "100, because each client has one limit.",
        "Up to 2,000, because each of the 20 tasks counts separately.",
        "20, because the load balancer divides the limit.",
        "Unlimited, because in-memory counters never reset."
      ],
      "answerIndex": 1,
      "explanation": "Each task only sees its own requests, so each allows up to 100. Twenty tasks allow up to 2,000. A shared counter in Valkey makes all tasks see the same count."
    },
    {
      "question": "Why must the lock used to prevent a cache stampede have an expiry?",
      "options": [
        "Valkey refuses to store keys without a TTL.",
        "Locks without an expiry make the cached value expire faster.",
        "If the request holding the lock crashes before releasing it, the lock would block rebuilds of that key forever.",
        "The expiry is what makes the SET reply OK instead of null."
      ],
      "answerIndex": 2,
      "explanation": "A crashed lock holder never calls DEL. With PX the lock disappears by itself after a few seconds, so another request can take over and rebuild the value."
    }
  ]
});
