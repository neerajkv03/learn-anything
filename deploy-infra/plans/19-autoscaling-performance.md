# 19. Auto Scaling & Performance
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 01-deployment-foundations, 09-ecs-fargate, 10-alb-dns, 11-aurora-postgresql, 18-observability

Example sizing (label as illustrative until k6 proves it, topic 20): API task 2 vCPU / 4 GiB ARM64, 2 Bun processes, ~5,000 RPS per task. Prod min 20, max 120 tasks.

## Learning goals
- Learner can add target-tracking scaling to an ECS service.
- Learner can scale on ALB requests per target with correct per-minute units.
- Learner can size tasks and use all vCPUs with multiple Bun processes.
- Learner can auto scale Aurora readers.
- Learner can plan service quotas and decide where Fargate Spot fits.

## Sub-topics
### ECS service auto scaling policies
- Concept: Application Auto Scaling adjusts desiredCount between min and max. Target tracking (keep a metric near a target, like a thermostat) — preferred; step scaling (rules per alarm band, 2–40 steps); scheduled (known peaks). `service.autoScaleTaskCount({ minCapacity, maxCapacity })` (maxCapacity required; minCapacity default 1) → `scaleOnCpuUtilization`, `scaleOnMemoryUtilization`, `scaleOnRequestCount`, `scaleOnSchedule`. Cooldowns default 300 s; scale out fast (60 s), scale in slow (300 s).
- Analogy: a thermostat for staff: when the shop gets crowded, call in more cashiers quickly; send them home slowly in case the rush returns.
- Code example: `const scaling = apiService.autoScaleTaskCount({ minCapacity: cfg.minTasks, maxCapacity: cfg.maxTasks }); scaling.scaleOnCpuUtilization("Cpu", { targetUtilizationPercent: 60, scaleOutCooldown: Duration.seconds(60), scaleInCooldown: Duration.seconds(300) }); scaling.scaleOnSchedule("SalePrewarm", { schedule: appscaling.Schedule.cron({ hour: "8", minute: "45" }), minCapacity: 60 });` Assertion: `resourceCountIs("AWS::ApplicationAutoScaling::ScalingPolicy", 1)` plus a ScheduledActions entry on the ScalableTarget.
- Production use: api and web services.
- Common mistakes: min 1 in prod; equal cooldowns causing flapping; scaling on memory for a CPU-bound Bun API.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.ScalableTaskCount.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.CpuUtilizationScalingProps.html ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html

### Request count per target scaling
- Concept: `scaleOnRequestCount(id, { requestsPerTarget, targetGroup })` tracks ALB `RequestCountPerTarget`, which counts requests per target per minute (verify on ALB metrics page). Per-task capacity 5,000 RPS at 70% target → 3,500 RPS × 60 = 210,000 requests/minute. Combine with CPU policy (scale-out wins, scale-in needs all policies agree).
- Analogy: one cashier per 30 customers an hour: count customers per cashier, not how sweaty cashiers look.
- Code example: `scaling.scaleOnRequestCount("Rps", { requestsPerTarget: 210_000, targetGroup: apiTg, scaleOutCooldown: Duration.seconds(60), scaleInCooldown: Duration.seconds(300) });` math file `rpt.ts`: `const perTaskRps=5000, target=0.7; console.log(perTaskRps*target*60);` → `210000`; at 250,000 RPS → tasks = `Math.ceil(250000/(5000*0.7))` → `72`.
- Production use: main scaling signal for the API.
- Common mistakes: putting per-second value (3,500) → massive over-scaling; scaling web on requests when SSR is CPU-bound; ignoring that min tasks must cover a sudden spike while new tasks start.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.RequestCountScalingProps.html ; https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-autoscaling-targettracking.html

### Task sizing and Bun multi-core
- Concept: one Bun process mostly uses one CPU core for JS. On 2 vCPU task run 2 processes sharing port 3000 with `reusePort: true` (SO_REUSEPORT; Linux kernel balances connections; Fargate is Linux). Launcher `start.ts` spawns N children with Bun.spawn; parent waits for children and forwards SIGTERM. node:cluster in Bun is partial/"not battle-tested" → prefer reusePort. Valid Fargate sizes: 2048 CPU → 4–16 GiB; up to 16 vCPU (32 vCPU in ECS guide, platform 1.4.0+). Bigger tasks = fewer IPs/ENIs but bigger blast radius per task loss; 1–4 vCPU a good default.
- Analogy: one kitchen with two cooks sharing the same order window; the window hands each new order to whichever cook is free.
- Code example: `start.ts` — `const n = Number(process.env.WORKERS ?? 2); const kids = Array.from({ length: n }, () => Bun.spawn(["bun", "run", "index.ts"], { stdout: "inherit", stderr: "inherit", env: process.env })); process.on("SIGTERM", () => { for (const k of kids) k.kill("SIGTERM"); }); await Promise.all(kids.map(k => k.exited)); process.exit(0);` and in index.ts `Bun.serve({ port: 3000, reusePort: true, ... })`. Expected: WORKERS=2 → two `listening` log lines with different pids; Container Insights CPU can now exceed 50% of task.
- Production use: Dockerfile CMD `["bun","run","start.ts"]`; WORKERS env = vCPU count.
- Common mistakes: 4 vCPU task with one process (75% idle); forgetting to forward SIGTERM (children killed hard); pool size × workers blowing DB budget (topic 12).
- Sources: https://github.com/oven-sh/bun/blob/main/packages/bun-types/serve.d.ts ; https://bun.com/docs/runtime/child-process ; https://bun.com/docs/runtime/nodejs-compat ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateTaskDefinition.html

### Aurora replica auto scaling
- Concept: Aurora Auto Scaling (Application Auto Scaling) adds/removes readers (min/max 0–15, ≥1 reader must exist) on average reader CPU or connections; new replica same class, promotion tier 15; writer excluded from metric; default cooldown 300 s; not for global DB secondaries. CDK: `appscaling.ScalableTarget` + `scaleToTrackMetric` with PredefinedMetric RDS_READER_AVERAGE_CPU_UTILIZATION. Adding a reader takes minutes → keep caching as first defence.
- Analogy: hiring temp library assistants during exam season; they take a while to arrive, so you also keep popular books at the front desk (cache).
- Code example: `const readers = new appscaling.ScalableTarget(this, "ReaderScaling", { serviceNamespace: appscaling.ServiceNamespace.RDS, scalableDimension: "rds:cluster:ReadReplicaCount", resourceId: \`cluster:${cluster.clusterIdentifier}\`, minCapacity: 2, maxCapacity: 8 }); readers.scaleToTrackMetric("ReaderCpu", { targetValue: 60, predefinedMetric: appscaling.PredefinedMetric.RDS_READER_AVERAGE_CPU_UTILIZATION });` Assertion: `hasResourceProperties("AWS::ApplicationAutoScaling::ScalableTarget", { ScalableDimension: "rds:cluster:ReadReplicaCount", MaxCapacity: 8 })`.
- Production use: read spikes from flash sales.
- Common mistakes: max beyond proxy/reader budget; scaling readers instead of fixing slow queries; minCapacity 0 breaks the read-only proxy endpoint.
- Sources: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Integrating.AutoScaling.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_applicationautoscaling.ScalableTarget.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_applicationautoscaling.PredefinedMetric.html

### Service quotas and capacity planning
- Concept: default Fargate On-Demand vCPU quota 6 per region (Spot 6), new accounts may be lower → 120 tasks × 2 vCPU = 240 vCPU, plus 2× during deploys = 480 → request increase weeks before launch. Launch rate: burst 100, sustained 20 tasks/s (5 in newer regions); service launch 500/min. Tasks per service 5,000. Also check ALB, NAT, Aurora connections, Valkey node limits. Request via Service Quotas console/CLI.
- Analogy: booking enough seats at a venue before selling tickets; the venue's fire limit (quota) is set by them, so ask early.
- Code example: `quota.ts` — `const maxTasks=120, vcpu=2, deployFactor=2; console.log("steady vCPU:", maxTasks*vcpu); console.log("during deploy:", maxTasks*vcpu*deployFactor);` → `steady vCPU: 240`, `during deploy: 480`. CLI: `aws service-quotas list-service-quotas --service-code fargate --query "Quotas[].[QuotaName,Value]" --output text` → rows incl. `Fargate On-Demand vCPU resource count  6.0` (value depends on account).
- Production use: launch checklist item; per-account.
- Common mistakes: discovering quota during the launch-day spike; forgetting staging needs quota for load tests; deploy doubling not counted.
- Sources: https://docs.aws.amazon.com/general/latest/gr/ecs-service.html ; https://docs.aws.amazon.com/servicequotas/latest/userguide/request-quota-increase.html ; https://docs.aws.amazon.com/cli/latest/reference/service-quotas/list-service-quotas.html

### Fargate Spot
- Concept: spare AWS capacity at a discount; tasks can be stopped when AWS needs capacity back (SIGTERM, graceful shutdown matters). Cluster `enableFargateCapacityProviders: true`; service `capacityProviderStrategies` with weights (e.g. FARGATE weight 1 base on-demand share, FARGATE_SPOT weight 2). Good for web SSR extra capacity, k6 load generators, dev; keep API minimum on on-demand.
- Analogy: standby airline tickets: cheap, but you may be bumped off the flight — fine for flexible trips, not for the pilot.
- Code example: `const webService = new ecs.FargateService(this, "WebService", { ..., capacityProviderStrategies: [{ capacityProvider: "FARGATE", weight: 1 }, { capacityProvider: "FARGATE_SPOT", weight: 2 }] });` → roughly 1/3 on-demand, 2/3 Spot as tasks are placed (e.g. 30 tasks → ~10 FARGATE, ~20 FARGATE_SPOT).
- Production use: cost savings (topic 23) without risking core API.
- Common mistakes: all-Spot prod API; forgetting `enableFargateCapacityProviders`; Spot quota separate (6 vCPU default).
- Sources: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.ClusterProps.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateServiceProps.html

## Quiz
1. Task capacity 4,000 RPS, target 75%: requestsPerTarget value? — tests per-minute (180,000).
2. Why two Bun processes on a 2 vCPU task, and what option lets them share a port? — tests reusePort.
3. 80 tasks × 4 vCPU — steady vCPU quota needed? — tests quota (320).
4. Why not run the whole API on Fargate Spot? — tests Spot interruption.
5. Why keep min Aurora readers ≥ 1 with a read-only proxy endpoint? — tests reader requirement.
