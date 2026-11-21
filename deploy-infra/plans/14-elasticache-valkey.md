# 14. Caching with Valkey
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 06-app-production-readiness, 08-vpc-networking, 11-aurora-postgresql

Key design fact: Bun's built-in Redis client lists Redis Cluster as unsupported → use ElastiCache **cluster mode disabled** (1 shard: primary + replicas; scale reads with replicas, scale writes by bigger node). CDK has only L1 (`CfnReplicationGroup`). Engine version: course VERSION is Valkey 9.1; CloudFormation examples show `"9.0"` — write `engineVersion: "9.1"` and tell learner to confirm accepted strings with `aws elasticache describe-cache-engine-versions --engine valkey`. Omit cacheParameterGroupName (default group).

## Learning goals
- Learner can implement cache-aside with TTLs in Bun.
- Learner can define a TLS-encrypted multi-AZ Valkey replication group in CDK.
- Learner can connect from Bun with TLS and an auth token.
- Learner can invalidate cache entries on writes.
- Learner can build a fixed-window rate limiter and protect against cache stampedes.

## Sub-topics
### Cache-aside pattern
- Concept: cache = fast in-memory key/value store (Valkey, Redis-compatible open source). Cache-aside: read key → hit → return; miss → read DB → store with TTL → return. Hit ratio = hits/(hits+misses); at 250K RPS a 90% hit ratio sends only 25K RPS to Aurora. Only cache data that tolerates seconds of staleness.
- Analogy: a chef's mise-en-place tray: frequently used chopped onions kept at hand; if the tray is empty, fetch from the walk-in fridge (DB), refill the tray, and throw out anything older than a set time (TTL).
- Code example: `cache.ts` — `import { RedisClient } from "bun"; export const redis = new RedisClient(process.env.REDIS_URL!); export async function getProduct(id: string) { const key = \`product:${id}\`; const hit = await redis.get(key); if (hit) return { source: "cache", data: JSON.parse(hit) }; const [row] = await reader\`SELECT id, name, price_cents FROM products WHERE id = ${id}\`; await redis.send("SET", [key, JSON.stringify(row), "EX", "60"]); return { source: "db", data: row }; }` Call twice for id "p1" (row {id:"p1",name:"Mug",price_cents:1200}) → first `db`, second `cache`. hit-ratio math: `console.log(250000*(1-0.9))` → `25000`.
- Production use: product/catalogue reads, SSR page data.
- Common mistakes: caching without TTL (stale forever); caching per-user secrets in shared keys; treating cache as source of truth.
- Sources: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html ; https://bun.com/docs/runtime/redis ; https://valkey.io/commands/set/

### ElastiCache Valkey in CDK
- Concept: `CfnSubnetGroup` (data subnets) + `CfnReplicationGroup`: engine "valkey", cacheNodeType e.g. cache.r7g.large, numCacheClusters 3 (1 primary + 2 replicas; max 6), automaticFailoverEnabled true (needs ≥2), multiAzEnabled true, transitEncryptionEnabled true (required for new valkey groups), atRestEncryptionEnabled true (default false; replace on change), authToken (16–128 printable chars, needs TLS) from a generated Secrets Manager secret. Endpoints (cluster mode disabled): PrimaryEndPoint (writes), ReaderEndPoint (DNS round-robin over replicas, not a load balancer). Serverless alternative (CfnServerlessCache, MajorEngineVersion integer "9") — mention only.
- Analogy: renting a fridge unit with one main door for loading (primary) and two viewing windows (replicas); a spare unit takes over if the main one fails (failover).
- Code example: `const cacheSecret = new secretsmanager.Secret(this, "CacheAuth", { generateSecretString: { passwordLength: 32, excludePunctuation: true } }); const subnets = new elasticache.CfnSubnetGroup(this, "CacheSubnets", { description: "shop cache", subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds }); const cache = new elasticache.CfnReplicationGroup(this, "Cache", { replicationGroupDescription: "shop valkey", engine: "valkey", engineVersion: "9.1", cacheNodeType: "cache.r7g.large", numCacheClusters: 3, automaticFailoverEnabled: true, multiAzEnabled: true, transitEncryptionEnabled: true, atRestEncryptionEnabled: true, authToken: cacheSecret.secretValue.unsafeUnwrap(), cacheSubnetGroupName: subnets.ref, securityGroupIds: [cacheSg.securityGroupId] });` Explain unsafeUnwrap here renders a CloudFormation dynamic reference (`{{resolve:secretsmanager:...}}`), not plain text. Outputs: `cache.attrPrimaryEndPointAddress`, `cache.attrReaderEndPointAddress`. Assertion: `hasResourceProperties("AWS::ElastiCache::ReplicationGroup", { Engine: "valkey", TransitEncryptionEnabled: true, MultiAZEnabled: true })`.
- Production use: shared cache + rate-limit + session store.
- Common mistakes: cluster mode enabled with a client that can't do Cluster; no TLS (deploy fails for valkey); single node with no replica in prod.
- Sources: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-elasticache-replicationgroup.html ; https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Endpoints.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticache-readme.html ; https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/engine-versions.html

### Connecting from Bun
- Concept: `rediss://` URL enables TLS; auth token as password (`rediss://:TOKEN@host:6379`). Build URL from env parts (REDIS_HOST + secret REDIS_AUTH). autoReconnect default true (backoff 50 ms → 2 s cap, maxRetries 20), enableOfflineQueue true (commands queue while reconnecting — set false to fail fast at high RPS), enableAutoPipelining true. Optional second client on reader endpoint for read-heavy keys.
- Analogy: phoning the fridge-unit's intercom over an encrypted line with a passcode; if the line drops, the phone redials automatically.
- Code example: `redis.ts` — `import { RedisClient } from "bun"; const url = \`rediss://:${encodeURIComponent(process.env.REDIS_AUTH!)}@${process.env.REDIS_HOST}:6379\`; export const redis = new RedisClient(url, { enableOfflineQueue: false, connectionTimeout: 2000 }); console.log(await redis.send("PING", []));` → `PONG`.
- Production use: one client per process, created at boot.
- Common mistakes: `redis://` (no TLS) to a TLS-only group (connection fails); new client per request; offline queue growing unbounded during outage.
- Sources: https://bun.com/docs/runtime/redis ; https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/auth.html

### TTLs and invalidation
- Concept: TTL bounds staleness; on write, delete the key (`DEL`) so next read refills (delete, don't update — avoids race writing stale data). Add random jitter to TTLs so keys don't all expire together. Key naming `product:p1`, versioned prefix `v2:product:p1` to invalidate all after a format change.
- Analogy: "best before" stickers on the tray; when the recipe changes, you throw out that tray immediately instead of waiting for the sticker.
- Code example: `async function updatePrice(id: string, cents: number) { await writer\`UPDATE products SET price_cents = ${cents} WHERE id = ${id}\`; await redis.del(\`product:${id}\`); }` then `getProduct("p1")` → `source: "db"` with new price. Jitter: `const ttl = 60 + Math.floor(Math.random() * 15);` → value 60–74.
- Production use: product edits, CMS content.
- Common mistakes: updating cache before DB commit; no jitter → synchronized expiry spikes; forgetting to invalidate list keys that contain the item.
- Sources: https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html ; https://valkey.io/commands/expire/ ; https://valkey.io/commands/del/

### Rate limiting
- Concept: fixed window: key `rl:<clientId>:<minute>`, `INCR`; if result is 1 set `EXPIRE 60`; over limit → 429 Too Many Requests with Retry-After. Valkey shared across tasks (in-memory per task would let a client get N×limit). Edge rate limiting by IP also in WAF (topic 21); app limiter for per-user/API-key limits.
- Analogy: a nightclub clicker at the door per guest: count entries per hour; past the limit, wait outside until the hour resets.
- Code example: `ratelimit.ts` — `export async function allow(clientId: string, limit = 100) { const window = Math.floor(Date.now() / 60000); const key = \`rl:${clientId}:${window}\`; const n = await redis.incr(key); if (n === 1) await redis.expire(key, 60); return n <= limit; }` Loop 101 calls for "k1" within one minute → first 100 `true`, 101st `false` → respond `new Response("rate limited", { status: 429, headers: { "Retry-After": "60" } })`.
- Production use: protect login, write endpoints, expensive queries.
- Common mistakes: per-task in-memory counters; forgetting EXPIRE (keys live forever); limiting by IP behind CloudFront without using the client IP header.
- Sources: https://valkey.io/commands/incr/ ; https://bun.com/docs/runtime/redis ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429

### Cache stampede protection
- Concept: hot key expires → thousands of concurrent misses hit DB at once. Fixes: (1) short lock `SET lock:key 1 NX PX 5000` — only winner rebuilds, others briefly wait/serve stale; (2) TTL jitter; (3) serve-stale while refreshing. Show lock version.
- Analogy: a bakery runs out of bread; without a rule 50 staff all start baking the same loaf. Rule: whoever grabs the "baking" flag bakes; others tell customers "2 minutes".
- Code example: `async function getHot(key: string, load: () => Promise<string>) { const v = await redis.get(key); if (v) return v; const got = await redis.send("SET", [\`lock:${key}\`, "1", "NX", "PX", "5000"]); if (got === "OK") { const fresh = await load(); await redis.send("SET", [key, fresh, "EX", "60"]); await redis.del(\`lock:${key}\`); return fresh; } await Bun.sleep(50); return (await redis.get(key)) ?? load(); }` Behaviour: 1,000 concurrent misses → `load()` called about once (plus rare fallbacks), not 1,000 times. `SET ... NX` reply is `OK` on success, null when key exists.
- Production use: homepage data, popular product keys at peak.
- Common mistakes: lock without expiry (stuck forever if holder crashes); everyone falling back to DB anyway; giant values making SET slow.
- Sources: https://valkey.io/commands/set/ ; https://bun.com/docs/runtime/redis ; https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html

## Quiz
1. Why is cluster mode disabled in this course? — tests Bun client limitation.
2. 200K RPS, 95% hit ratio: DB RPS? — tests hit ratio (10,000).
3. On product update, why DEL instead of SET new value? — tests invalidation race.
4. In-memory rate limiter on 20 tasks with limit 100/min — real limit a client gets? — tests shared state (up to 2,000).
5. Why must a stampede lock have an expiry? — tests lock TTL.
