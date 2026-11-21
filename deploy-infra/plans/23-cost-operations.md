# 23. Cost & Operations
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 03-aws-fundamentals, 18-observability, 19-autoscaling-performance, 22-reliability-dr

No real prices (not fetched): cost math uses placeholder unit prices clearly labelled "example price — check the AWS pricing page".

## Learning goals
- Learner can tag resources and break down spend by service/env in Cost Explorer.
- Learner can decide on Savings Plans and right-size tasks/instances.
- Learner can write a runbook for a common alert.
- Learner can run an incident and write a blameless postmortem.
- Learner can plan day-2 maintenance: patches, upgrades, cleanups.

## Sub-topics
### Cost Explorer, budgets and tagging
- Concept: tags (key/value) on resources; CDK `Tags.of(app).add("project", "shop")` and per stack `env`; activate as cost allocation tags in Billing (takes time to appear) → Cost Explorer group by tag/service. Budgets per account (topic 03) + anomaly detection (mention). Biggest lines at this scale usually: Fargate, Aurora, data transfer/CloudFront, NAT processing, ALB, logs.
- Analogy: colour-coded receipts per department so the accountant sees who spent what.
- Code example: `infra/bin/app.ts` — `Tags.of(app).add("project", "shop"); Tags.of(devStack).add("env", "dev"); Tags.of(prodStack).add("env", "prod");` Assertion: `hasResourceProperties("AWS::S3::Bucket", { Tags: Match.arrayWith([{ Key: "project", Value: "shop" }]) })`. CLI: `aws ce get-cost-and-usage --time-period Start=2026-11-01,End=2026-11-22 --granularity MONTHLY --metrics UnblendedCost --group-by Type=TAG,Key=env` → groups `env$dev`, `env$prod` with amounts (values vary).
- Production use: monthly cost review.
- Common mistakes: tags not activated for billing; inconsistent keys (Env vs env); untaggable costs (data transfer) ignored.
- Sources: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html ; https://docs.aws.amazon.com/cdk/v2/guide/tagging.html ; https://docs.aws.amazon.com/cli/latest/reference/ce/get-cost-and-usage.html

### Savings Plans and right-sizing
- Concept: Compute Savings Plans = commit to $/hour of compute for 1 or 3 years for a discount; applies to Fargate (and EC2/Lambda). Commit only to the steady baseline (min tasks), not peaks. Aurora: reserved instances for steady writer/readers (mention). Right-sizing: Container Insights CPU/memory per task; if task memory < 40% used, drop to smaller size; ARM64 already chosen. Spot for web extras (topic 19). Delete idle: old ECR images (lifecycle), log retention, unused endpoints in dev, load-test leftovers.
- Analogy: a monthly train pass for your daily commute (baseline), paying per ride only for occasional extra trips.
- Code example: `commit.ts` — `const minTasks=20, vcpu=2, hours=730; const examplePricePerVcpuHour=0.03; console.log("baseline vCPU-hours/month:", minTasks*vcpu*hours); console.log("example on-demand $:", (minTasks*vcpu*hours*examplePricePerVcpuHour).toFixed(2));` → `baseline vCPU-hours/month: 29200`, `example on-demand $: 876.00` (label price as illustrative; memory also billed).
- Production use: quarterly review.
- Common mistakes: committing to peak; right-sizing from one quiet day; ignoring NAT/data transfer.
- Sources: https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cloudwatch-container-insights.html ; https://aws.amazon.com/fargate/pricing/

### Runbooks
- Concept: runbook = step-by-step guide for a known alert: symptoms, dashboards/queries, checks, fixes, escalation. Linked from alarm description. Starts with `aws sts get-caller-identity` (right account). Keep in repo (`docs/runbooks/*.md`), reviewed like code.
- Analogy: the laminated emergency card in a plane seat pocket — written calmly in advance, used under stress.
- Code example: `docs/runbooks/api-5xx.md` outline: Trigger: alarm Api5xx (≥50 5XX/min for 3 min). 1) confirm account + dashboard shop-prod; 2) Logs Insights query (topic 18) for top error msgs; 3) recent deploy? `aws ecs describe-services ... deployments` → if new revision failing and circuit breaker didn't roll back → redeploy previous imageTag via pipeline; 4) DB? check proxy pinned + Aurora CPU; 5) cache? Valkey CPU/evictions; 6) escalate after 15 min. Plus alarm `alarmDescription: "Runbook: https://github.com/acme/shop/blob/main/docs/runbooks/api-5xx.md"`.
- Production use: on-call for every paging alarm.
- Common mistakes: alarms with no runbook; stale commands; steps needing tribal knowledge.
- Sources: https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ready_to_support_use_runbooks.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch.Alarm.html

### Incident response and postmortems
- Concept: severity levels (SEV1 full outage/data loss, SEV2 major degradation, SEV3 minor); roles: incident commander (coordinates), ops lead (hands on keyboard), comms (status updates). Mitigate first (rollback, scale up, block bad traffic), diagnose later. Blameless postmortem within days: timeline, impact (requests failed, error budget used), root cause(s), what went well, action items with owners and dates.
- Analogy: an emergency room: triage by severity, one doctor in charge, nurses with clear tasks; afterwards a case review that improves procedures, not a blame session.
- Code example: postmortem template headings + filled example: impact `2026-11-20 14:02–14:19 UTC, 17 min, ~12% of requests 5XX`; error budget used: `console.log((17*0.12/43.2*100).toFixed(1) + "% of monthly budget")` → `4.7% of monthly budget`; root cause: migration added NOT NULL column without default → old tasks' inserts failed; actions: lint migrations for NOT NULL without default (owner, due date).
- Production use: every SEV1/SEV2.
- Common mistakes: debugging before mitigating; blame culture (people hide mistakes); action items never done.
- Sources: https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_event_response_event_incident_problem_process.html ; https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_evolve_ops_perform_rca_process.html

### Day-2 maintenance and upgrades
- Concept: ongoing work after launch: Aurora LTS patches (LTS clusters patched ~yearly, sooner for critical; autoMinorVersionUpgrade off → plan maintenance windows; PG17 community EOL Nov 2029 / Aurora standard support 2030-02-28 → plan major upgrade), Bun patch upgrades (pin + rebuild), CDK lib/CLI monthly bumps with `cdk diff` review, GitHub Action major bumps, k6/ADOT/OTel versions, ECR lifecycle, log retention, quota reviews before peaks, restore drills (topic 22), cost review. Calendar it.
- Analogy: car servicing schedule: oil every 10,000 km, tyres every season, MOT yearly — skipped maintenance becomes a breakdown.
- Code example: `maintenance.md` table: cadence → task → command/link, e.g. weekly: rebuild images (`on: schedule`), monthly: `bun update` + `npm view aws-cdk-lib version` + `cdk diff`, quarterly: restore drill + FIS game day + Savings Plan review, yearly: Aurora LTS patch window + major-version plan. `npm view aws-cdk-lib version` → prints latest version (e.g. `2.278.0` at time of writing).
- Production use: keeps the system secure and supported.
- Common mistakes: "set and forget" infra; big-bang upgrades after years; upgrading prod first.
- Sources: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Updates.LTS.html ; https://docs.aws.amazon.com/AmazonRDS/latest/AuroraPostgreSQLReleaseNotes/aurorapostgresql-release-calendar.html ; https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-diff.html ; https://bun.com/blog

## Quiz
1. Why must cost allocation tags be activated, not just applied? — tests billing tags.
2. Min 20 tasks, peak 120: what should a Savings Plan cover? — tests baseline commit.
3. First three things a runbook step should confirm? — tests runbook basics.
4. During a SEV1, rollback or root-cause first? — tests mitigate first.
5. Name two day-2 tasks with a yearly cadence. — tests maintenance.
