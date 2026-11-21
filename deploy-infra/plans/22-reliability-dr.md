# 22. Reliability & Disaster Recovery
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 08-vpc-networking, 11-aurora-postgresql, 14-elasticache-valkey, 18-observability, 19-autoscaling-performance

## Learning goals
- Learner can describe what happens to each layer when one AZ fails.
- Learner can define RTO and RPO and pick a DR strategy to match.
- Learner can run and verify a restore drill.
- Learner can explain cross-region DR with Aurora Global Database.
- Learner can run a fault-injection experiment with AWS FIS and a stop condition.

## Sub-topics
### Multi-AZ failure handling
- Concept: AZ outage: ALB stops routing to that AZ's targets (health checks); ECS replaces tasks in healthy AZs (needs quota + IPs + headroom); Aurora writer in failed AZ → reader promoted, endpoint DNS update typically < 30 s (apps reconnect: Bun.sql pool maxLifetime, RDS Proxy helps); Valkey automatic failover to replica (multi-AZ); NAT per AZ keeps egress. App must retry idempotent requests briefly with backoff.
- Analogy: a three-engine plane: lose one engine and the other two keep flying, but only if they were sized to carry the load (headroom) and the pilot knows the drill.
- Code example: retry helper `retry.ts` — `export async function retry<T>(fn: () => Promise<T>, tries = 3, baseMs = 100): Promise<T> { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= tries - 1) throw e; await Bun.sleep(baseMs * 2 ** i); } } }` Demo with fn failing twice then succeeding → waits 100 ms, 200 ms, returns value; with 3 failures → throws after waits 100 + 200 ms. Use only for idempotent reads.
- Production use: DB/cache client calls in api.
- Common mistakes: retrying non-idempotent writes (double charge); infinite retries amplifying outage; no headroom for 1/3 capacity loss.
- Sources: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.BestPractices.FastFailover.html ; https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/AutoFailover.html ; https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_limit_retries.html

### RTO and RPO
- Concept: RTO = max acceptable time to restore service; RPO = max acceptable data loss (time). Business sets them. DR strategies by cost: backup & restore (hours) → pilot light → warm standby → multi-site active/active (seconds, most cost). Example targets for the shop: regional outage RTO 1 h, RPO 5 min (business example, not an AWS guarantee).
- Analogy: house fire planning: RPO = how many days of photos you can lose (last backup); RTO = how long until you're living somewhere again.
- Code example: decision table: target RTO/RPO → strategy → services. Plus `dr.ts` — `const strategies = [["backup-restore","hours","hours"],["pilot-light","tens of minutes","minutes"],["warm-standby","minutes","seconds-minutes"],["active-active","near zero","near zero"]]; for (const [s, rto, rpo] of strategies) console.log(\`${s}: RTO ${rto}, RPO ${rpo}\`);` → 4 lines in that order.
- Production use: choose Aurora Global Database for a cross-region warm standby.
- Common mistakes: no agreed numbers; claiming RTO never tested; ignoring cache/DNS/secrets in DR plan.
- Sources: https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html ; https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_for_recovery_objective_defined_recovery.html

### Restore drills
- Concept: untested backups don't count. Monthly drill in staging: PITR prod snapshot/cluster to a new cluster (topic 11), run verification queries, time it (measures real RTO), delete restored cluster. Record results in runbook (topic 23).
- Analogy: a fire drill: everyone walks out, someone holds a stopwatch, and you fix whatever blocked the exit.
- Code example: drill script outline (bash): restore-db-cluster-to-point-in-time → create-db-instance → `aws rds wait db-instance-available` → `psql "postgres://...@<restored>/shop?sslmode=require" -c "SELECT count(*) FROM orders WHERE created_at < '2026-11-20T10:00:00Z';"` → compare with expected count from prod at that time (e.g. both `1048576`) → record elapsed `SECONDS` (bash builtin) e.g. `restore took 1260 s` → delete-db-cluster. Values illustrative.
- Production use: proves RPO/RTO; required by many audits.
- Common mistakes: restoring into prod by mistake; forgetting to delete the drill cluster (cost); not checking data, only that it starts.
- Sources: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-pitr.html ; https://docs.aws.amazon.com/cli/latest/reference/rds/wait/db-instance-available.html

### Cross-region with Aurora Global Database
- Concept: primary cluster in us-east-1 + read-only secondary cluster in another region (e.g. us-west-2) with storage-level replication; on regional outage, promote/fail over secondary to primary; repoint app (second region stack: VPC, ECS, ALB, Valkey) and DNS. CDK has only L1 `CfnGlobalCluster` (engine, engineVersion, sourceDbClusterIdentifier, deletionProtection, storageEncrypted). Aurora replica auto scaling not supported on secondary clusters. Cost: second region's full stack (warm standby).
- Analogy: a second warehouse in another city receiving a copy of every delivery note; if the first city floods, the second opens its doors.
- Code example: `new rds.CfnGlobalCluster(this, "Global", { globalClusterIdentifier: "shop-global", sourceDbClusterIdentifier: cluster.clusterArn, deletionProtection: true });` (secondary cluster created in us-west-2 stack joined via globalClusterIdentifier — say "see docs for the secondary's CDK wiring"). Check: `aws rds describe-global-clusters --global-cluster-identifier shop-global --query "GlobalClusters[0].GlobalClusterMembers[].IsWriter"` → `[true, false]`.
- Production use: only if business RTO/RPO need cross-region.
- Common mistakes: global DB without the rest of the stack in region 2; forgetting secrets/ECR images in region 2; never rehearsing failover.
- Sources: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.CfnGlobalCluster.html ; https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Integrating.AutoScaling.html

### Fault injection with AWS FIS
- Concept: chaos engineering = break things on purpose, safely, to prove resilience. FIS experiment template: actions (`aws:ecs:stop-task` no params; `aws:ecs:task-cpu-stress` needs SSM-managed tasks; `aws:rds:failover-db-cluster`), targets (resource type + selection), stop conditions (CloudWatch alarm ARN → stops experiment immediately, can't resume), IAM role. Start in staging during load (topic 20); hypothesis first ("5XX stays < 0.5% when 30% of tasks stop").
- Analogy: a fire brigade setting a controlled fire in a training building, with a big red stop button (stop condition) if it spreads.
- Code example: `experiment.json` — `{"description":"stop 30% api tasks","roleArn":"arn:aws:iam::222222222222:role/fis-shop","stopConditions":[{"source":"aws:cloudwatch:alarm","value":"arn:aws:cloudwatch:us-east-1:222222222222:alarm:Api5xx"}],"targets":{"apiTasks":{"resourceType":"aws:ecs:task","resourceTags":{"service":"shop-api"},"selectionMode":"PERCENT(30)"}},"actions":{"stopTasks":{"actionId":"aws:ecs:stop-task","targets":{"Tasks":"apiTasks"}}}}`; `aws fis create-experiment-template --cli-input-json file://experiment.json` then `aws fis start-experiment --experiment-template-id <id>` → JSON with state `initiating`→`running`→`completed`. Second experiment: `aws:rds:failover-db-cluster` on staging cluster; measure error spike duration in dashboard.
- Production use: quarterly game days.
- Common mistakes: no stop condition; first experiment in prod; no hypothesis/measurement.
- Sources: https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html#stop-task ; https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html#failover-db-cluster ; https://docs.aws.amazon.com/fis/latest/userguide/stop-conditions.html ; https://docs.aws.amazon.com/fis/latest/userguide/targets.html

## Quiz
1. us-east-1a fails: what happens to the Aurora writer that was in 1a? — tests failover.
2. RPO 5 min, RTO 1 h for a regional outage: which strategy? — tests DR strategy.
3. Why is a backup you've never restored risky? — tests drills.
4. Which retry is safe: GET /products or POST /payments? — tests idempotency.
5. What does a FIS stop condition do when its alarm fires? — tests stop conditions.
