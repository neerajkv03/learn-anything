# 12. Connection Pooling with RDS Proxy
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 11-aurora-postgresql

## Learning goals
- Learner can explain why many tasks × pools overwhelm PostgreSQL and how a pooler fixes it.
- Learner can add an RDS Proxy with a read-only endpoint in CDK.
- Learner can connect with IAM database authentication from Bun.
- Learner can compute a connection budget for 120 tasks.
- Learner can avoid and detect session pinning.

## Sub-topics
### Why connection pooling
- Concept: each PostgreSQL connection = a server process + memory; opening is slow (TCP+TLS+auth). App pool (Bun.sql `max` 10) reuses connections inside one process, but 120 tasks × 2 processes × 2 pools × 10 = 4,800 connections; scale-out bursts and failovers cause connection storms. RDS Proxy sits between: many client connections → fewer DB connections, reused across clients (multiplexing), survives failover faster.
- Analogy: a taxi rank. Without it, every passenger phones for a private car (new connection). With it, a fixed fleet of taxis (DB connections) shuttles many passengers in turns; the rank manager (proxy) queues people when all taxis are busy.
- Code example: `conn-math.ts` — `const tasks=120, procsPerTask=2, poolsPerProc=2, max=10; console.log("client connections:", tasks*procsPerTask*poolsPerProc*max);` → `client connections: 4800`.
- Production use: all app DB traffic goes through the proxy; migrations go direct (topic 13).
- Common mistakes: raising max_connections instead of pooling; huge app pools "for performance"; no idle timeout so dead connections pile up.
- Sources: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/rds-proxy.html ; https://bun.com/docs/runtime/sql

### RDS Proxy setup in CDK
- Concept: `cluster.addProxy(id, { secrets: [cluster.secret!], vpc, securityGroups: [proxySg], vpcSubnets PRIVATE_ISOLATED, requireTLS true (default), maxConnectionsPercent 90 (default 100), maxIdleConnectionsPercent 50, borrowTimeout 120 s default, idleClientTimeout 30 min default })`. Default endpoint → writer. Read-only endpoint: `proxy.addEndpoint("Read", { vpc, targetRole: rds.ProxyEndpointTargetRole.READ_ONLY })` — needs ≥1 reader or requests error; extra endpoints add PrivateLink cost; max 20. initQuery not supported for PostgreSQL.
- Analogy: hiring the taxi-rank manager and opening a second rank door just for "read-only" passengers going to the assistant librarians.
- Code example: `const proxy = cluster.addProxy("Proxy", { secrets: [appSecret], vpc, vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }, securityGroups: [proxySg], requireTLS: true, iamAuth: true, maxConnectionsPercent: 90 }); const readEp = proxy.addEndpoint("ReadEndpoint", { vpc, vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }, securityGroups: [proxySg], targetRole: rds.ProxyEndpointTargetRole.READ_ONLY });` Pass `proxy.endpoint` → DB_HOST and read endpoint's address → DB_READ_HOST (topic 11 db.ts). Assertion: `resourceCountIs("AWS::RDS::DBProxyEndpoint", 1)` and `hasResourceProperties("AWS::RDS::DBProxy", { RequireTLS: true })`.
- Production use: replaces direct cluster endpoints in app env vars.
- Common mistakes: proxySg not allowed into dbSg:5432; read endpoint with zero readers; requireTLS true but client TLS disabled.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.DatabaseProxyOptions.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.DatabaseProxyEndpointOptions.html ; https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/rds-proxy-endpoints.html#rds-proxy-endpoints-reader

### IAM database authentication
- Concept: instead of a static password, app gets a 15-minute auth token signed with its task role; token checked only at connect (open connections unaffected). Proxy `iamAuth: true`; `proxy.grantConnect(taskDef.taskRole, "shop_app")`. Proxy still uses Secrets Manager secret to reach DB. Bun.sql `password` accepts a function → new token per new connection. Token generation via `@aws-sdk/rds-signer` `Signer.getAuthToken()` (AWS SDK v3). CLI equivalent `aws rds generate-db-auth-token`.
- Analogy: a hotel key card that the front desk re-encodes every 15 minutes; your room door only checks it as you enter, not while you're inside.
- Code example: `iam-db.ts` — `import { Signer } from "@aws-sdk/rds-signer"; import { SQL } from "bun"; const signer = new Signer({ hostname: process.env.DB_HOST!, port: 5432, username: "shop_app", region: "us-east-1" }); export const writer = new SQL({ hostname: process.env.DB_HOST, port: 5432, username: "shop_app", database: "shop", password: () => signer.getAuthToken(), tls: "require", prepare: false, max: 10, maxLifetime: 600 });` CLI check: `aws rds generate-db-auth-token --hostname <proxy-endpoint> --port 5432 --username shop_app --region us-east-1` → one long string starting with the hostname, containing `X-Amz-Signature=` (value varies). Note: verify `password` function returning a Promise works in your Bun version (docs say string or function).
- Production use: no DB password in app env; rotation-proof.
- Common mistakes: generating token once at boot and reusing after 15 min for new connections; using a custom DNS name for token hostname; IAM auth without TLS.
- Sources: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/UsingWithRDS.IAMDBAuth.html ; https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/rds-proxy-iam.html ; https://docs.aws.amazon.com/cli/latest/reference/rds/generate-db-auth-token.html ; https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-rds-signer/ ; https://bun.com/docs/runtime/sql

### Connection limit math
- Concept: DB side: max_connections = LEAST(DBInstanceClassMemory/9531392, 5000); proxy uses up to maxConnectionsPercent of it. db.r6g.large (16 GiB) → ≈1,800; r6g.2xlarge (64 GiB) → capped 5,000; 90% → 4,500. Client side: proxy accepts many client connections and multiplexes; set Bun pool max small (10) and maxLifetime so connections rebalance. Borrow timeout = how long a client waits for a DB connection before error.
- Analogy: number of taxis allowed on the road (DB limit) vs number of passengers in line (client connections); manager keeps 10% of road space free for maintenance vehicles (admin connections).
- Code example: `db-limit.ts` — `const mem = (gib:number)=>gib*1024**3; const maxConn = (gib:number)=>Math.min(Math.floor(mem(gib)/9531392), 5000); console.log(16, maxConn(16)); console.log(64, maxConn(64)); console.log("proxy 90%:", Math.floor(maxConn(64)*0.9));` → `16 1802`, `64 5000`, `proxy 90%: 4500`. Say real value slightly lower for 16 GiB because DBInstanceClassMemory < total RAM.
- Production use: choose instance size + proxy % before load test (topic 20).
- Common mistakes: forgetting readers have their own limits; ignoring admin/migration headroom; huge pools that time out at borrowTimeout under load.
- Sources: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Managing.html#AuroraPostgreSQL.Managing.MaxConnections ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.DatabaseProxyOptions.html

### Session pinning pitfalls
- Concept: proxy can only share a DB connection between clients if no session state lingers. PostgreSQL pinning triggers: any `SET` (except `SET LOCAL` inside BEGIN..COMMIT; `set_config(...,true)` still pins), PREPARE/EXECUTE/DEALLOCATE/DISCARD, temp tables/sequences/views, cursors, LISTEN, session advisory locks (xact-level fine), statements > 16 KB. Pinned = connection reserved for that client → multiplexing lost. Session pinning filters are MySQL-only. Mitigation: Bun.sql `prepare: false` (unnamed statements; disables pipelining, one command per query), SET LOCAL in transactions, keep queries < 16 KB. Watch CloudWatch `DatabaseConnectionsCurrentlySessionPinned`; confirm with metric whether prepare:false is needed for your workload.
- Analogy: a passenger who leaves luggage in the taxi — the taxi can't take anyone else until that passenger is done for the day.
- Code example: bad vs good: `await sql\`SET statement_timeout = 2000\`` (pins) vs `await sql.begin(async tx => { await tx\`SET LOCAL statement_timeout = 2000\`; return tx\`SELECT * FROM orders WHERE id = ${id}\`; })` (no pin). CloudWatch check: `aws cloudwatch get-metric-statistics --namespace AWS/RDS --metric-name DatabaseConnectionsCurrentlySessionPinned --dimensions Name=ProxyName,Value=shop-proxy --start-time 2026-11-22T10:00:00Z --end-time 2026-11-22T11:00:00Z --period 300 --statistics Maximum` → datapoints; target value `0` (or near 0).
- Production use: keeps 4,800 client connections served by a few hundred DB connections.
- Common mistakes: per-connection SET search_path/timezone on connect; ORMs using named prepared statements; long text queries > 16 KB.
- Sources: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/rds-proxy-pinning.html#rds-proxy-pinning.postgres ; https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/rds-proxy-pinning.html#rds-proxy-pinning.minimizing ; https://bun.com/docs/runtime/sql

## Quiz
1. 60 tasks × 1 process × 2 pools × max 10 = how many client connections? — tests math (1,200).
2. Why does `SET timezone = 'UTC'` hurt proxy efficiency? — tests pinning.
3. Read-only proxy endpoint on a cluster with only a writer — what happens? — tests reader requirement.
4. IAM token is 15 min; does a connection opened at minute 1 drop at minute 16? — tests token at connect only.
5. Which metric shows pinning? — tests DatabaseConnectionsCurrentlySessionPinned.
