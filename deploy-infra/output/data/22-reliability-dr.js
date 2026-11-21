window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "22-reliability-dr",
  "order": 22,
  "title": "Reliability & Disaster Recovery",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Learn what happens to each layer of the shop when one Availability Zone fails, and how to write a retry helper that survives short outages without making them worse. Then define RTO (how fast you recover) and RPO (how much data you can lose), choose a disaster recovery strategy to match, and prove it with a restore drill. Finally, extend to a second region with Aurora Global Database and break things on purpose, safely, with AWS Fault Injection Service (FIS).",
  "prerequisites": ["08-vpc-networking", "11-aurora-postgresql", "14-elasticache-valkey", "18-observability", "19-autoscaling-performance"],
  "subtopics": [
    {
      "id": "multi-az-failure-handling",
      "title": "Multi-AZ failure handling",
      "explanation": "A failure domain is a group of things that can fail together. An Availability Zone (AZ, one or more separate data centers inside a region, from topic 03) is a failure domain: power, cooling or networking trouble can take out everything inside one AZ while the other AZs keep running. Reliability work starts by asking: if this one AZ disappears, what happens to each layer of the shop?\n\nLayer 1, the load balancer. The Application Load Balancer (ALB, topic 10) health-checks every target. When the targets in the failed AZ stop answering, they are marked unhealthy and the ALB stops sending them traffic. Users keep being served by targets in the other AZs.\n\nLayer 2, ECS (topic 09). The ECS service notices that tasks died and starts replacements in the healthy AZs. This only works if the healthy side has room: enough Fargate quota (topic 19), enough free IP addresses in the remaining subnets, and enough spare capacity (headroom, topic 01) to carry the load of the lost AZ. With three AZs, losing one removes one third of your capacity, so each AZ must be sized to let the other two absorb its share.\n\nLayer 3, Aurora (topic 11). If the writer instance was in the failed AZ, Aurora promotes a reader instance (a read-only copy in another AZ) to be the new writer. The cluster endpoint is a DNS name, and Aurora updates it to point at the new writer. AWS documents that this DNS update typically takes less than 30 seconds. Your app must reconnect: its old connections point at a dead server. Setting a maximum connection lifetime on the Bun SQL pool (the `maxLifetime` option, in seconds, from topic 11) forces old connections to be recycled, so they eventually re-resolve DNS. RDS Proxy (topic 12) also helps because it keeps the app's connection to the proxy and handles reconnecting to the database for you.\n\nLayer 4, Valkey (topic 14). A replication group with automatic failover and replicas in other AZs promotes a replica to primary if the primary's AZ fails. Layer 5, egress (traffic leaving to the internet): with one NAT gateway per AZ (topic 08), the surviving AZs keep their own path out. With a single NAT gateway in the failed AZ, every private subnet loses internet access.\n\nThe last piece is in your code. During the failover window some calls fail. The app should retry briefly, waiting longer between attempts (backoff), and only for operations that are safe to repeat. An operation is idempotent if doing it twice has the same effect as doing it once. Reading a product list is idempotent. Charging a card is not.",
      "analogy": "A three-engine plane. Lose one engine and the other two keep flying, but only if they were sized to carry the whole plane's load (headroom), the second engine was not already running flat out, and the pilot has rehearsed the drill. In the shop: the engines are the AZs, headroom is spare task capacity, and the drill is your retry and reconnect behavior.",
      "code": [
        {
          "language": "typescript",
          "filename": "retry.ts",
          "source": "// Calls fn up to `tries` times. Waits baseMs, then 2x, then 4x... between attempts.\n// `async` marks a function that returns a Promise (a value that arrives later);\n// `await` pauses until that value is ready. `<T>` means \"whatever type fn returns\".\nasync function retry<T>(fn: () => Promise<T>, tries = 3, baseMs = 100): Promise<T> {\n  for (let i = 0; ; i++) {\n    try {\n      return await fn();\n    } catch (e) {\n      if (i >= tries - 1) throw e; // out of attempts: give up and pass the error on\n      await Bun.sleep(baseMs * 2 ** i); // 100 ms, then 200 ms, ...\n    }\n  }\n}\n\n// Demo 1: fails twice, succeeds on the 3rd call (waits 100 ms + 200 ms in total).\nlet calls = 0;\nasync function flaky(): Promise<string> {\n  calls++;\n  if (calls <= 2) throw new Error(`failure ${calls}`);\n  return `ok after ${calls} calls`;\n}\nconsole.log(await retry(flaky));\n\n// Demo 2: always fails, so retry throws after the 3rd call (waits 100 ms + 200 ms).\ncalls = 0;\nasync function alwaysFails(): Promise<string> {\n  calls++;\n  throw new Error(`failure ${calls}`);\n}\ntry {\n  await retry(alwaysFails);\n} catch (e) {\n  console.log(\"gave up:\", (e as Error).message, \"after\", calls, \"calls\");\n}\n",
          "output": "ok after 3 calls\ngave up: failure 3 after 3 calls",
          "explanation": "Run it with `bun run retry.ts`. The loop tries `fn`. If it throws (a `catch` block receives the error), the helper checks whether attempts are used up. If not, it sleeps with `Bun.sleep` (Bun's built-in pause, in milliseconds) for `baseMs * 2 ** i`, which is 100 then 200. In demo 1 the third call succeeds and its value is returned. In demo 2 the third failure is rethrown, so the caller sees the last error and can decide what to do. The retries are bounded: three tries, not forever. Use this only around idempotent reads such as a database `SELECT` or a cache `GET`."
        }
      ],
      "productionNote": "Wrap database and cache client calls in the api with a bounded retry for reads only, and keep the total retry time shorter than your request timeout. Test the whole chain for real with a controlled failover (see the AWS FIS sub-topic). Check headroom with arithmetic: with 3 AZs, each AZ should be able to lose one third of the tasks and the rest must still handle peak traffic, so autoscaling maximums and Fargate quotas must allow that.",
      "commonMistakes": [
        "Retrying non-idempotent writes such as POST /payments. The first attempt may have succeeded before the connection broke, so a retry can charge the customer twice. Retry writes only with an idempotency key, a unique id the server uses to ignore duplicates.",
        "Retrying forever or with no waiting. Thousands of clients hammering a recovering database add load exactly when it is weakest (a retry storm). Limit attempts and use backoff.",
        "Having no headroom for losing one third of capacity. If each AZ runs at 80% load, the survivors would need 120% and requests fail even though failover worked.",
        "Using a single NAT gateway or a single AZ for an important dependency, which quietly puts the whole shop in one failure domain."
      ],
      "sources": [
        { "title": "Aurora PostgreSQL fast failover best practices", "url": "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.BestPractices.FastFailover.html" },
        { "title": "ElastiCache: minimizing downtime with Multi-AZ and automatic failover", "url": "https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/AutoFailover.html" },
        { "title": "Well-Architected Reliability: limit retries", "url": "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_limit_retries.html" }
      ]
    },
    {
      "id": "rto-and-rpo",
      "title": "RTO and RPO",
      "explanation": "Disaster recovery (DR) is the plan for getting the shop working again after a large failure, such as a whole region being unavailable, data being deleted, or a bad deployment corrupting data. Two numbers define the goal.\n\nRTO (Recovery Time Objective) is the longest time the business accepts the service being down. RPO (Recovery Point Objective) is the longest span of recent data the business accepts losing, measured in time. An RPO of 5 minutes means that after recovery you may lose at most the last 5 minutes of orders.\n\nThe business sets these numbers, not the engineers, because they trade money for risk. For the shop we use this example: for a regional outage, RTO 1 hour and RPO 5 minutes. This is a business example, not an AWS guarantee.\n\nBackup is not the same as DR. A backup is a copy of data. DR is the whole ability to run the service again: infrastructure, data, secrets, DNS, container images and the people who know the steps.\n\nAWS describes four DR strategies, from cheapest and slowest to costliest and fastest. Backup and restore: keep backups (copied to another region), rebuild everything when needed; recovery takes hours. Pilot light: the data is continuously replicated to the second region, but the application there is switched off or minimal, ready to start. Warm standby: a scaled-down but running full copy of the stack in the second region. Multi-site active/active: both regions serve real traffic all the time; recovery is near zero but cost and complexity are highest.\n\nTo choose: pick the cheapest strategy whose RTO and RPO meet the business numbers. For RPO 5 minutes and RTO 1 hour across regions, nightly backups fail (RPO would be up to a day), so you need continuous cross-region data replication, such as Aurora Global Database (next sub-topics), with a second-region stack that is pre-built or quick to start.\n\nA DR plan that only covers the database is incomplete. Also cover the cache (it can be rebuilt but starts empty, which loads the database), DNS changes, secrets, and container images in the recovery region.",
      "analogy": "House fire planning. RPO is how many days of photos you can afford to lose, which is decided by when you last made a backup. RTO is how long until you are living somewhere again. A hotel booked in advance (warm standby) gets you housed faster than a house you still have to find (backup and restore), but it costs money every month.",
      "code": [
        {
          "language": "typescript",
          "filename": "dr.ts",
          "source": "// Each row: [strategy name, typical RTO, typical RPO]\nconst strategies = [\n  [\"backup-restore\", \"hours\", \"hours\"],\n  [\"pilot-light\", \"tens of minutes\", \"minutes\"],\n  [\"warm-standby\", \"minutes\", \"seconds-minutes\"],\n  [\"active-active\", \"near zero\", \"near zero\"],\n];\n\n// `const [s, rto, rpo]` unpacks each row into three named variables.\n// The backtick string drops each variable in place of ${...}.\nfor (const [s, rto, rpo] of strategies) {\n  console.log(`${s}: RTO ${rto}, RPO ${rpo}`);\n}\n",
          "output": "backup-restore: RTO hours, RPO hours\npilot-light: RTO tens of minutes, RPO minutes\nwarm-standby: RTO minutes, RPO seconds-minutes\nactive-active: RTO near zero, RPO near zero",
          "explanation": "Run with `bun run dr.ts`. The list is ordered by cost, cheapest first, and the printed lines are the decision table: find the row whose RTO and RPO are at or below the business target. The values are typical orders of magnitude, not guarantees; your own restore drills (next sub-topic) measure your real numbers. Decision summary for the shop: RTO 1 hour and RPO 5 minutes for a regional outage means pilot light or warm standby using Aurora Global Database for data."
        }
      ],
      "productionNote": "Write the agreed RTO and RPO per failure type (one AZ, one region, bad data) at the top of the runbook (a written step-by-step guide for a known problem, covered in topic 23). For the shop, choose Aurora Global Database as the data layer of a cross-region warm standby only if the business numbers require surviving a whole region; if a single-region multi-AZ setup meets them, do not pay for a second region.",
      "commonMistakes": [
        "Having no agreed numbers, so nobody can say whether the design is good enough.",
        "Claiming an RTO that was never tested. Only a drill produces a real number.",
        "Ignoring the cache, DNS, secrets and container images in the DR plan. A restored database with no app images in the recovery region does not serve anyone.",
        "Treating multi-AZ as disaster recovery. Multi-AZ survives an AZ failure; it does not survive a region outage, accidental deletion or corrupt data."
      ],
      "sources": [
        { "title": "Disaster recovery options in the cloud (AWS whitepaper)", "url": "https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html" },
        { "title": "Well-Architected Reliability: define recovery objectives", "url": "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_for_recovery_objective_defined_recovery.html" }
      ]
    },
    {
      "id": "restore-drills",
      "title": "Restore drills",
      "explanation": "An untested backup is a hope, not a backup. Files can be corrupt, permissions missing, the restore may take far longer than your RTO, or the data may be missing something nobody noticed. A restore drill is a scheduled practice where you restore for real and check the result.\n\nThe drill for the shop's database, run monthly in staging (topic 01 environments): restore the cluster to a point in time into a brand-new cluster (PITR, point-in-time recovery, from topic 11: Aurora rebuilds the data as it was at a chosen moment within the backup retention period). Start a timer. Add a database instance to the new cluster, because restoring through the CLI creates only the cluster, not a writer instance. Wait until it is available. Run verification queries. Stop the timer. Delete the restored cluster so you do not keep paying for it.\n\nThe elapsed time is your measured real RTO for a database restore. The verification query checks the data itself, not just that the database started. Record the result in the runbook (a written step-by-step guide for a known problem, covered in topic 23) and compare it to the agreed RTO and RPO.\n\nIn the script below, `SECONDS` is a bash built-in variable that counts seconds since it was set to 0, so it works as a free stopwatch. `set -euo pipefail` makes the script stop at the first failing command. The password is supplied through the `PGPASSWORD` environment variable (which `psql`, the PostgreSQL command-line client, reads), so it never appears in the script. All names and numbers are illustrative.",
      "analogy": "A fire drill. Everyone walks out of the building, someone holds a stopwatch, and afterwards you fix whatever blocked the exit (a locked door, a missing map). You do it on a calm day so the real emergency is not the first time.",
      "code": [
        {
          "language": "bash",
          "filename": "restore-drill.sh",
          "source": "#!/usr/bin/env bash\nset -euo pipefail\n\nSOURCE=shop-staging            # cluster we restore FROM (never the drill name)\nDRILL=shop-drill               # NEW cluster we create and then delete\nRESTORE_TIME=2026-11-20T10:00:00Z\nEXPECTED=1048576               # count from the source for the same query, taken beforehand\nSECONDS=0                      # start the stopwatch\n\naws rds restore-db-cluster-to-point-in-time \\\n  --source-db-cluster-identifier \"$SOURCE\" \\\n  --db-cluster-identifier \"$DRILL\" \\\n  --restore-to-time \"$RESTORE_TIME\" \\\n  --db-subnet-group-name shop-drill-subnets \\\n  --vpc-security-group-ids sg-0123456789abcdef0 > /dev/null\n\n# PITR via the CLI creates only the cluster; add a writer instance.\naws rds create-db-instance \\\n  --db-instance-identifier \"${DRILL}-1\" \\\n  --db-cluster-identifier \"$DRILL\" \\\n  --engine aurora-postgresql \\\n  --db-instance-class db.r6g.large > /dev/null\n\naws rds wait db-instance-available --db-instance-identifier \"${DRILL}-1\"\necho \"restore took ${SECONDS} s\"\n\nHOST=$(aws rds describe-db-clusters --db-cluster-identifier \"$DRILL\" \\\n  --query \"DBClusters[0].Endpoint\" --output text)\n\n# PGPASSWORD must already be exported (read it from Secrets Manager).\nACTUAL=$(psql \"postgres://shop_admin@${HOST}/shop?sslmode=require\" -t -A \\\n  -c \"SELECT count(*) FROM orders WHERE created_at < '${RESTORE_TIME}';\")\n\nif [ \"$ACTUAL\" = \"$EXPECTED\" ]; then\n  echo \"count matches: ${ACTUAL}\"\nelse\n  echo \"MISMATCH: expected ${EXPECTED}, got ${ACTUAL}\"\nfi\n\n# Clean up so the drill cluster stops costing money.\naws rds delete-db-instance --db-instance-identifier \"${DRILL}-1\" > /dev/null\naws rds wait db-instance-deleted --db-instance-identifier \"${DRILL}-1\"\naws rds delete-db-cluster --db-cluster-identifier \"$DRILL\" --skip-final-snapshot > /dev/null\n",
          "output": "restore took 1260 s\ncount matches: 1048576",
          "explanation": "The output is illustrative: your restore time depends on cluster size. Here 1260 seconds is 21 minutes, which you would compare with the 1 hour RTO. The query counts orders created before the restore time, a value that should be identical on the source and on the restored cluster. `psql -t -A` prints just the bare number so the shell can compare it. The last three commands delete the drill resources; `--skip-final-snapshot` is acceptable here only because the cluster is a throwaway copy.\n\nSave this as `restore-drill.sh` in a folder, run `export PGPASSWORD=...` with the value from Secrets Manager in your terminal, then run `bash restore-drill.sh` in that same terminal."
        }
      ],
      "productionNote": "Run the drill monthly in staging and after any big change to the database. Many audits and compliance programs require evidence that restores work, so keep the recorded times and results in the runbook (topic 23). Give the drill its own distinct cluster name and its own IAM permissions so it cannot touch production.",
      "commonMistakes": [
        "Restoring into production by mistake: a drill must always create a new cluster with a different identifier and never overwrite the source.",
        "Forgetting to delete the drill cluster, so it keeps costing money after the drill. Put deletion in the script and verify it.",
        "Checking only that the restored database starts, not that the data is right. Always run a verification query and compare it with a known value.",
        "Never timing the drill, so there is no real RTO to compare against the target."
      ],
      "sources": [
        { "title": "Restoring an Aurora cluster to a point in time", "url": "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-pitr.html" },
        { "title": "AWS CLI: rds wait db-instance-available", "url": "https://docs.aws.amazon.com/cli/latest/reference/rds/wait/db-instance-available.html" }
      ]
    },
    {
      "id": "cross-region-aurora-global-database",
      "title": "Cross-region with Aurora Global Database",
      "explanation": "Everything so far survives an AZ failure or a mistake, but not a whole region going down. Aurora Global Database spans regions: one primary cluster (here in us-east-1) accepts reads and writes, and one or more secondary clusters in other regions (for example us-west-2) are read-only copies. Replication happens at the storage layer, so it is fast and puts little load on the database instances.\n\nIf the primary region fails, you promote (fail over) the secondary cluster so it becomes the writer. Promotion is only the database part. To actually serve users from region 2, you also need the rest of the stack there: a VPC, an ECS service with the container image, an ALB, a Valkey cluster, and secrets. Then DNS (topic 10, Route 53) is pointed at the second region's ALB. That full second-region stack, kept small and running, is the warm standby strategy from the previous sub-topic, and it is what makes it expensive.\n\nIn CDK, there is no friendly high-level construct for global databases. You use the L1 construct (a direct mapping of a CloudFormation resource, topic 07) `rds.CfnGlobalCluster`. It accepts properties such as `engine`, `engineVersion`, `sourceDbClusterIdentifier`, `deletionProtection` and `storageEncrypted`. Passing `sourceDbClusterIdentifier` turns an existing regional cluster into the primary of a new global cluster. The secondary cluster in the other region's stack is then created by joining it to the global cluster by its `globalClusterIdentifier`; see the CDK and Aurora Global Database docs for the secondary's exact wiring.\n\nOne limitation to know: Aurora replica auto scaling (topic 19) is not supported on secondary clusters, so size the secondary's readers yourself.",
      "analogy": "A second warehouse in another city that receives a copy of every delivery note as it is written. If the first city floods, the second warehouse already knows every order and can open its doors, provided it also has trucks, staff and stock (the rest of the stack) and someone has rehearsed the switch.",
      "code": [
        {
          "language": "typescript",
          "filename": "global-db-stack.ts",
          "source": "import { App, Stack } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport * as rds from \"aws-cdk-lib/aws-rds\";\n\nconst app = new App();\nconst stack = new Stack(app, \"ShopDb\", { env: { account: \"222222222222\", region: \"us-east-1\" } });\n\nconst vpc = new ec2.Vpc(stack, \"Vpc\", { maxAzs: 3 });\n\nconst cluster = new rds.DatabaseCluster(stack, \"Cluster\", {\n  engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_17_7 }),\n  writer: rds.ClusterInstance.provisioned(\"Writer\", {\n    instanceType: ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.LARGE),\n  }),\n  vpc,\n});\n\n// Turn this regional cluster into the primary of a global cluster.\nnew rds.CfnGlobalCluster(stack, \"Global\", {\n  globalClusterIdentifier: \"shop-global\",\n  sourceDbClusterIdentifier: cluster.clusterArn,\n  deletionProtection: true,\n});\n\n// The secondary cluster in us-west-2 lives in a second stack and joins by\n// globalClusterIdentifier \"shop-global\" (see the Aurora Global Database docs for its wiring).\n",
          "output": "",
          "explanation": "The file prints nothing; it describes infrastructure that `cdk deploy` creates (topic 07). `deletionProtection: true` stops someone deleting the global cluster by accident. After the secondary region is added, check the setup with `aws rds describe-global-clusters --global-cluster-identifier shop-global --query \"GlobalClusters[0].GlobalClusterMembers[].IsWriter\"`. The expected result is a list with one writer and one non-writer: `[true, false]`, printed by the CLI as `[`, `true,`, `false`, `]` on separate lines."
        }
      ],
      "productionNote": "Add a global database only if the business RTO and RPO really need cross-region protection, because it brings a full second stack and its cost. Rehearse the failover in staging before you need it, and time it like a restore drill.",
      "commonMistakes": [
        "Creating a global database without the rest of the stack in region 2 (VPC, ECS, ALB, Valkey). The data is safe but nothing can serve it.",
        "Forgetting secrets and container images (ECR) in region 2, so tasks cannot start after failover.",
        "Never rehearsing the failover, so the first attempt happens during a real outage.",
        "Expecting Aurora replica auto scaling on the secondary cluster. It is not supported there."
      ],
      "sources": [
        { "title": "Using Amazon Aurora Global Database", "url": "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html" },
        { "title": "CDK: CfnGlobalCluster", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.CfnGlobalCluster.html" },
        { "title": "Aurora replica auto scaling (limitations)", "url": "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Integrating.AutoScaling.html" }
      ]
    },
    {
      "id": "fault-injection-with-aws-fis",
      "title": "Fault injection with AWS FIS",
      "explanation": "Chaos engineering means breaking things on purpose, in a controlled way, to prove your system survives. Reading a diagram that says \"multi-AZ\" proves nothing; stopping tasks and failing over a database while watching the dashboards does. AWS Fault Injection Service (FIS) is the managed tool for this.\n\nAn FIS experiment template describes one experiment. Its parts: actions (what to break), targets (which resources, chosen by resource type plus a selection rule), stop conditions, and an IAM role (topic 03) that FIS assumes to perform the actions.\n\nUseful actions for the shop: `aws:ecs:stop-task` stops ECS tasks and needs no parameters. `aws:rds:failover-db-cluster` forces an Aurora failover. `aws:ecs:task-cpu-stress` burns CPU in tasks but only works on tasks managed by AWS Systems Manager (SSM), so it needs extra setup.\n\nA stop condition is an emergency brake: a CloudWatch alarm (topic 18). If that alarm goes into the alarm state during the experiment, FIS stops the experiment immediately, and a stopped experiment cannot be resumed. Always define one, for example an alarm on the API's 5XX error rate.\n\nWork like a scientist. First write a hypothesis, such as \"5XX responses stay under 0.5% when 30% of API tasks stop\". Run in staging, under load from k6 (topic 20) so there is real traffic to hurt. Measure against the hypothesis on your dashboard. If it fails, fix the weakness and run again.\n\nThe first template stops 30% of the tasks of the API service. Tasks selected by `resourceTags` need the tag `service` = `shop-api`. The ECS service must propagate its tags to tasks (`propagateTags: ecs.PropagatedTagSource.SERVICE` in CDK), or the target matches nothing. Create and start it with the AWS CLI; the second template below fails over the staging Aurora cluster, and you measure how long the error spike lasts.",
      "analogy": "A fire brigade setting a controlled fire in a training building, with a big red stop button (the stop condition) that ends the exercise instantly if the fire spreads beyond the plan. The goal is to learn how the building and the crew cope, without risking a real building.",
      "code": [
        {
          "language": "json",
          "filename": "experiment.json",
          "source": "{\n  \"description\": \"stop 30% api tasks\",\n  \"roleArn\": \"arn:aws:iam::222222222222:role/fis-shop\",\n  \"stopConditions\": [\n    { \"source\": \"aws:cloudwatch:alarm\", \"value\": \"arn:aws:cloudwatch:us-east-1:222222222222:alarm:Api5xx\" }\n  ],\n  \"targets\": {\n    \"apiTasks\": {\n      \"resourceType\": \"aws:ecs:task\",\n      \"resourceTags\": { \"service\": \"shop-api\" },\n      \"selectionMode\": \"PERCENT(30)\"\n    }\n  },\n  \"actions\": {\n    \"stopTasks\": {\n      \"actionId\": \"aws:ecs:stop-task\",\n      \"targets\": { \"Tasks\": \"apiTasks\" }\n    }\n  }\n}\n",
          "output": "",
          "explanation": "`roleArn` is the role FIS uses; it needs permission for `ecs:DescribeTasks`, `ecs:ListTasks`, `ecs:StopTask` and `tag:GetResources`. The stop condition points at the `Api5xx` alarm. The target picks tasks by resource type and tag, and `PERCENT(30)` selects 30% of the matching tasks. The action `stopTasks` runs `aws:ecs:stop-task` on that target (the action's `Tasks` slot receives the `apiTasks` target)."
        },
        {
          "language": "bash",
          "filename": "run-experiment.sh",
          "source": "# Create the template from the JSON file; note the template id in the response.\naws fis create-experiment-template --cli-input-json file://experiment.json\n\n# Start an experiment from that template (EXT123456789abc is the id from the previous step).\naws fis start-experiment --experiment-template-id EXT123456789abc\n",
          "output": "{\n    \"experiment\": {\n        \"id\": \"EXP987654321def\",\n        \"experimentTemplateId\": \"EXT123456789abc\",\n        \"state\": {\n            \"status\": \"initiating\"\n        }\n    }\n}",
          "explanation": "Output is shortened and the ids are illustrative. The experiment state moves from `initiating` to `running` and then `completed`; if the stop condition alarm fires it moves to `stopped` instead. Check progress with `aws fis get-experiment --id EXP987654321def` while you watch your dashboard."
        },
        {
          "language": "json",
          "filename": "failover-experiment.json",
          "source": "{\n  \"description\": \"fail over staging aurora cluster\",\n  \"roleArn\": \"arn:aws:iam::222222222222:role/fis-shop\",\n  \"stopConditions\": [\n    { \"source\": \"aws:cloudwatch:alarm\", \"value\": \"arn:aws:cloudwatch:us-east-1:222222222222:alarm:Api5xx\" }\n  ],\n  \"targets\": {\n    \"dbCluster\": {\n      \"resourceType\": \"aws:rds:cluster\",\n      \"resourceArns\": [\"arn:aws:rds:us-east-1:222222222222:cluster:shop-staging\"],\n      \"selectionMode\": \"ALL\"\n    }\n  },\n  \"actions\": {\n    \"failover\": {\n      \"actionId\": \"aws:rds:failover-db-cluster\",\n      \"targets\": { \"Clusters\": \"dbCluster\" }\n    }\n  }\n}\n",
          "output": "",
          "explanation": "The same structure with a different action. `aws:rds:failover-db-cluster` calls the RDS failover on the target cluster and needs no parameters; the role needs `rds:FailoverDBCluster`, `rds:DescribeDBClusters` and `tag:GetResources`. Create and start it with the same two commands, then measure how long errors last on the dashboard: that is the app's real reconnect time, which tells you whether the retry helper and `maxLifetime` setting from the first sub-topic work."
        }
      ],
      "productionNote": "Run game days (planned team sessions where you run experiments and observe) quarterly. Start every new experiment in staging with load running, with a stop condition and a written hypothesis, and only later consider carefully scoped experiments in production.",
      "commonMistakes": [
        "Running an experiment with no stop condition, so there is no automatic brake if the damage is bigger than expected.",
        "Making the first experiment in production instead of staging.",
        "Having no hypothesis and no measurement, so afterwards nobody can say whether the system passed.",
        "Running with no traffic. A quiet staging environment hides problems that real load would show."
      ],
      "sources": [
        { "title": "FIS actions reference: aws:ecs:stop-task", "url": "https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html#stop-task" },
        { "title": "FIS actions reference: aws:rds:failover-db-cluster", "url": "https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html#failover-db-cluster" },
        { "title": "FIS stop conditions", "url": "https://docs.aws.amazon.com/fis/latest/userguide/stop-conditions.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "us-east-1a fails and the Aurora writer instance was running there. What happens?",
      "options": [
        "The cluster stays read-only until an engineer manually restores a backup",
        "A reader in another AZ is promoted to writer and the cluster endpoint DNS is updated, typically in under 30 seconds; the app must reconnect",
        "All data in the cluster is lost because storage lives in one AZ",
        "The ALB automatically moves the database to another AZ"
      ],
      "answerIndex": 1,
      "explanation": "Aurora promotes a reader in a healthy AZ and updates the cluster endpoint DNS name. The app's old connections are dead, so it needs retry and reconnect behavior (for example a `maxLifetime` on the pool, or RDS Proxy)."
    },
    {
      "question": "The business requires RPO 5 minutes and RTO 1 hour for a regional outage. Which approach fits?",
      "options": [
        "Nightly snapshots kept only in the primary region",
        "A single-AZ cluster with a larger instance class",
        "Continuous cross-region data replication (Aurora Global Database) with a pre-built or quickly started second-region stack (pilot light or warm standby)",
        "Doing nothing until the outage, then building from scratch"
      ],
      "answerIndex": 2,
      "explanation": "RPO 5 minutes needs data copied continuously to another region, and RTO 1 hour needs the second-region stack to be ready or quick to start. Nightly snapshots would lose up to a day of data and stay in the failed region."
    },
    {
      "question": "Why is a backup you have never restored risky?",
      "options": [
        "You do not know that it restores correctly, how long it takes (your real RTO), or whether the data is complete",
        "Backups expire after 30 days unless restored",
        "Restoring a backup always deletes the original cluster",
        "AWS charges extra for backups that were never used"
      ],
      "answerIndex": 0,
      "explanation": "Only a restore drill proves the backup works, measures real recovery time and lets you check the data with verification queries. The other statements are not true of Aurora backups."
    },
    {
      "question": "A short failover causes errors. Which call is safe to retry automatically with backoff?",
      "options": [
        "POST /payments, because the customer expects it to work",
        "POST /orders without any idempotency key",
        "Any request, as long as you retry forever",
        "GET /products, because reading is idempotent (repeating it changes nothing)"
      ],
      "answerIndex": 3,
      "explanation": "Retrying a read is harmless. Retrying a payment could charge twice if the first attempt actually succeeded. Retries must also be bounded, never infinite."
    },
    {
      "question": "What does an AWS FIS stop condition do when its CloudWatch alarm fires?",
      "options": [
        "It pauses the experiment so you can resume it later",
        "It stops the experiment immediately, and it cannot be resumed",
        "It doubles the number of tasks being stopped",
        "Nothing, it only sends a notification email"
      ],
      "answerIndex": 1,
      "explanation": "The stop condition is the emergency brake. When the alarm triggers, FIS ends the experiment right away; a stopped experiment cannot be resumed, so you start a new one after fixing the cause."
    }
  ]
});
