# 11. Aurora PostgreSQL
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 06-app-production-readiness, 08-vpc-networking, 09-ecs-fargate

Engine: `rds.AuroraPostgresEngineVersion.VER_17_7` (exists in CDK 2.278). 17.7 = LTS; AWS itself recommends latest minor for most clusters, LTS for long test cycles — course follows brief: LTS + autoMinorVersionUpgrade false on every instance. App connects via RDS Proxy (topic 12); this topic connects to cluster endpoints first.

## Learning goals
- Learner can explain Aurora writer, readers and the two cluster endpoints.
- Learner can define an encrypted, deletion-protected DatabaseCluster pinned to 17.7 LTS in CDK.
- Learner can manage credentials in Secrets Manager with rotation.
- Learner can set parameters via a parameter group.
- Learner can run backups/PITR restores and split reads/writes in Bun.sql.

## Sub-topics
### Aurora writer and reader instances
- Concept: Aurora = AWS-built PostgreSQL-compatible DB with shared storage across 3 AZs. One writer (reads+writes), up to 15 readers (read-only replicas) sharing storage; replica lag usually small but non-zero. Cluster endpoint → writer (read/write); reader endpoint → load-balanced readers. On writer failure a reader is promoted; endpoint DNS update typically < 30 s.
- Analogy: a library with one librarian allowed to write in the catalogue (writer) and several assistants who can only read it to visitors (readers); all look at the same catalogue book (shared storage), the assistants' copy may be a few seconds behind.
- Code example: `aws rds describe-db-clusters --db-cluster-identifier shop-prod --query "DBClusters[0].[Endpoint,ReaderEndpoint]" --output text` → two hostnames, `shop-prod.cluster-xxxx.us-east-1.rds.amazonaws.com` and `shop-prod.cluster-ro-xxxx.us-east-1.rds.amazonaws.com` (xxxx varies). Point out `cluster-ro`.
- Production use: reads (product pages, order history) to readers; writes (checkout) to writer.
- Common mistakes: all traffic on writer; readers all in writer's AZ; expecting reader to show a write instantly.
- Sources: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Overview.Endpoints.html ; https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Replication.html ; https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.BestPractices.FastFailover.html

### DatabaseCluster in CDK
- Concept: `rds.DatabaseCluster` with engine auroraPostgres({version: VER_17_7}), writer + readers via `rds.ClusterInstance.provisioned(id, { instanceType, autoMinorVersionUpgrade: false })`, vpc + vpcSubnets PRIVATE_ISOLATED, securityGroups [dbSg], storageEncrypted true (default false without key!), deletionProtection true, removalPolicy SNAPSHOT (default) or RETAIN for prod. `instances`/`instanceProps` deprecated → use writer/readers. Instance class example db.r6g.2xlarge (Graviton; 64 GiB).
- Analogy: ordering a custom safe: you specify the lock (engine version), number of keyholders (readers), that it's fire-proof (encrypted) and can't be thrown away by accident (deletion protection).
- Code example: `const cluster = new rds.DatabaseCluster(this, "Db", { engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_17_7 }), writer: rds.ClusterInstance.provisioned("writer", { instanceType: ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.XLARGE2), autoMinorVersionUpgrade: false }), readers: [rds.ClusterInstance.provisioned("reader1", { instanceType: ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.XLARGE2), autoMinorVersionUpgrade: false }), rds.ClusterInstance.provisioned("reader2", { ... same })], vpc, vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }, securityGroups: [dbSg], credentials: rds.Credentials.fromGeneratedSecret("shop_admin"), defaultDatabaseName: "shop", storageEncrypted: true, deletionProtection: true, removalPolicy: RemovalPolicy.SNAPSHOT, backup: { retention: Duration.days(14), preferredWindow: "03:00-04:00" }, parameterGroup });` Assertion: `hasResourceProperties("AWS::RDS::DBCluster", { EngineVersion: "17.7", StorageEncrypted: true, DeletionProtection: true })`.
- Production use: prod data tier; dev uses one small writer, no readers.
- Common mistakes: forgetting storageEncrypted (can't enable later without restore); autoMinorVersionUpgrade left true (leaves LTS); Aurora in PRIVATE_WITH_EGRESS for no reason.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.DatabaseCluster.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.ClusterInstance.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.AuroraPostgresEngineVersion.html ; https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Updates.LTS.html

### Credentials and rotation in Secrets Manager
- Concept: `Credentials.fromGeneratedSecret("shop_admin")` → secret JSON with username, password, host, port, dbname. `cluster.addRotationSingleUser()` rotates on schedule (rotation Lambda needs network path to Secrets Manager: endpoint or NAT). Separate app user `shop_app` with fewer privileges (created by migration, topic 13; its secret rotated too). Tasks read secrets at start only.
- Analogy: changing the office door code every month automatically and posting the new code only in the locked key cabinet.
- Code example: `cluster.addRotationSingleUser({ automaticallyAfter: Duration.days(30) });` then `aws secretsmanager get-secret-value --secret-id <arn> --query SecretString --output text | jq -r .username` → `shop_admin`. (Gloss jq: JSON picker tool.)
- Production use: ECS secrets (topic 09), RDS Proxy auth (topic 12).
- Common mistakes: app using master user; rotation Lambda without network route (rotation fails silently-ish); hard-coding password in a URL env var.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.DatabaseCluster.html ; https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html ; https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/rds-secrets-manager.html

### Parameter groups
- Concept: DB settings live in parameter groups (cluster-level and instance-level); defaults fine for most. `parameterGroup` or `parameters` map, not both. Useful: `log_min_duration_statement` (ms; log slow queries), `max_connections` (default LEAST(DBInstanceClassMemory/9531392, 5000)) — change needs custom group + writer reboot.
- Analogy: the dashboard settings on a rented car: sensible defaults, tweak a few knobs you understand.
- Code example: `const parameterGroup = new rds.ParameterGroup(this, "DbParams", { engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_17_7 }), parameters: { log_min_duration_statement: "500" } });` Effect: queries slower than 500 ms appear in PostgreSQL log (`duration: 812.345 ms  statement: SELECT ...`, values vary). max_connections math for r6g.2xlarge (64 GiB = 68,719,476,736 bytes): `Math.min(Math.floor(68719476736/9531392), 5000)` → `5000` (DBInstanceClassMemory is a bit lower than total RAM, still capped at 5000).
- Production use: slow-query visibility; connection budget for RDS Proxy (topic 12).
- Common mistakes: raising max_connections instead of pooling; editing default group (can't); forgetting reboot for static params.
- Sources: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/USER_WorkingWithParamGroups.html ; https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Managing.html#AuroraPostgreSQL.Managing.MaxConnections ; https://www.postgresql.org/docs/17/runtime-config-logging.html

### Backups, snapshots and point-in-time restore
- Concept: automated continuous backups for retention days (default 1 → set 14); manual snapshots kept until deleted; PITR creates a NEW cluster at a chosen second within retention; via CLI you then create the writer instance yourself. App must be repointed (or data copied back). Restore drills in topic 22.
- Analogy: a video recorder of the whole shop: you can't rewind the real shop, but you can build an identical shop as it was at 10:00 yesterday and walk across to fetch what you lost.
- Code example: `aws rds restore-db-cluster-to-point-in-time --source-db-cluster-identifier shop-prod --db-cluster-identifier shop-restore-1120 --restore-to-time 2026-11-20T10:00:00Z --db-subnet-group-name <name> --vpc-security-group-ids sg-0abc` then `aws rds create-db-instance --db-instance-identifier shop-restore-1120-w --db-cluster-identifier shop-restore-1120 --engine aurora-postgresql --db-instance-class db.r6g.large` → JSON describing creating resources; `aws rds wait db-instance-available --db-instance-identifier shop-restore-1120-w` → returns when ready (no output).
- Production use: recover from bad migration or accidental delete.
- Common mistakes: expecting PITR to overwrite the existing cluster; retention 1 day; never testing restore.
- Sources: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-pitr.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.BackupProps.html ; https://docs.aws.amazon.com/cli/latest/reference/rds/restore-db-cluster-to-point-in-time.html

### Read/write splitting with Bun.sql
- Concept: two `SQL` instances: `writer` (cluster/proxy write endpoint) and `reader` (reader endpoint). Pool `max` default 10 per instance; set idleTimeout 30, maxLifetime 600 (s) so connections recycle after failover; `tls: "verify-full"` style ssl mode with Amazon RDS CA bundle, or `require` minimum (default disable — must set!). `prepare: false` behind RDS Proxy (topic 12). Read-your-writes: after a write, read from writer for that request.
- Analogy: two queues at the bank: deposits (writes) at the one teller who updates the ledger, balance enquiries (reads) at any of the info desks — but right after depositing, ask the teller, because the info desk may not have the update yet.
- Code example: `db.ts` — `import { SQL } from "bun"; const base = { username: process.env.DB_USER, password: process.env.DB_PASSWORD, database: "shop", port: 5432, max: 10, idleTimeout: 30, maxLifetime: 600, tls: "require", prepare: false }; export const writer = new SQL({ ...base, hostname: process.env.DB_HOST }); export const reader = new SQL({ ...base, hostname: process.env.DB_READ_HOST });` usage: `const rows = await reader\`SELECT 1 AS ok\`; console.log(rows[0].ok);` → `1`; `await writer.begin(async tx => { await tx\`INSERT INTO orders (id, total_cents) VALUES (${id}, ${2599})\`; });`.
- Production use: offload 80–90% read traffic from the writer at 250K RPS (with caching, topic 14).
- Common mistakes: TLS left at default disable; reading own write from reader (stale); pool max × tasks exceeding DB connections (topic 12).
- Sources: https://bun.com/docs/runtime/sql ; https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/UsingWithRDS.SSL.html ; https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Overview.Endpoints.html

## Quiz
1. Which endpoint for a checkout write, and which for a product list read? — tests endpoints.
2. Why set autoMinorVersionUpgrade false here? — tests LTS.
3. PITR restore finished — is prod data rolled back? — tests PITR creates new cluster.
4. Bun.sql default TLS setting and why change it? — tests tls.
5. A user saves profile then immediately sees old data. Cause and fix? — tests replica lag/read-your-writes.
