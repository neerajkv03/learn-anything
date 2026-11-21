# 18. Observability
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 06-app-production-readiness, 09-ecs-fargate, 10-alb-dns

Tracing on Bun: OTel JS docs support Node LTS only and never mention Bun; Bun lacks `http.server.*` diagnostics channels → treat Bun.serve as NOT auto-instrumented; create server spans manually; AsyncLocalStorage is implemented in Bun (context propagation should work) — tell learner to verify locally. Packages: @opentelemetry/sdk-node 0.301.2 (pairs with stable 3.x packages, @opentelemetry/api ≥ 1.10.0), @opentelemetry/exporter-trace-otlp-proto. X-Ray SDKs/daemon in maintenance since 2026-02-25 → OpenTelemetry. Collector: ADOT sidecar `public.ecr.aws/aws-observability/aws-otel-collector:v0.51.0` (pin tag), default ECS config `--config=/etc/ecs/ecs-default-config.yaml` (traces via awsxray). Preload instrumentation with `bun --preload ./instrumentation.ts index.ts`.

## Learning goals
- Learner can query JSON logs with Logs Insights for errors and p99 latency.
- Learner can enable Container Insights and read ECS/ALB metrics.
- Learner can create alarms that notify via SNS.
- Learner can build a CloudWatch dashboard in CDK.
- Learner can send traces from Bun through ADOT to X-Ray and define SLOs with error budgets.

## Sub-topics
### CloudWatch Logs and Logs Insights
- Concept: logs (topic 06 JSON) land in log group `shop-api`; Logs Insights query language: `fields`, `filter` (alias where), `stats` with `count(*)`, `avg`, `pct(field, 99)`, `by bin(1m)`, `sort`, `limit`, `parse`; max 10 stats; sort/limit after last stats. JSON fields auto-discovered.
- Analogy: a searchable CCTV archive: instead of watching hours of tape, ask "show every moment someone dropped a tray, grouped by minute".
- Code example: query 1 `fields @timestamp, path, status, ms | filter status >= 500 | stats count(*) as errors by bin(1m) | sort errors desc | limit 5` → table of minute buckets with error counts. Query 2 `filter msg = "request" | stats pct(ms, 99) as p99 by bin(5m)` → 5-minute p99 values. Run via CLI `aws logs start-query --log-group-name shop-api --start-time <epoch> --end-time <epoch> --query-string '<query>'` → returns `queryId`; `aws logs get-query-results --query-id <id>` → results (values vary).
- Production use: first stop in incidents (topic 23).
- Common mistakes: non-JSON logs (no fields); querying huge time ranges (cost/slow); logging every request at peak.
- Sources: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html ; https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax-Stats.html ; https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_AnalyzeLogData-discoverable-fields.html

### Metrics and Container Insights
- Concept: metric = number over time with namespace (AWS/ApplicationELB, AWS/ECS, AWS/RDS), name, dimensions (LoadBalancer `app/name/id`, TargetGroup), statistic (Sum, Average, p99), period. Key ALB: RequestCount, TargetResponseTime (seconds), HTTPCode_Target_5XX_Count (target-generated) vs HTTPCode_ELB_5XX_Count (LB-generated), UnHealthyHostCount. Container Insights: cluster `containerInsightsV2: ENHANCED` (AWS recommends enhanced) → per-task CPU/memory.
- Analogy: a car dashboard: speedometer (RequestCount), engine temperature (CPU), warning lights (5XX); each gauge has a unit and a time window.
- Code example: CDK metric: `const p99 = new cloudwatch.Metric({ namespace: "AWS/ApplicationELB", metricName: "TargetResponseTime", dimensionsMap: { LoadBalancer: alb.loadBalancerFullName }, statistic: "p99", period: Duration.minutes(1) });` and `const target5xx = new cloudwatch.Metric({ namespace: "AWS/ApplicationELB", metricName: "HTTPCode_Target_5XX_Count", dimensionsMap: { LoadBalancer: alb.loadBalancerFullName }, statistic: "Sum", period: Duration.minutes(1) });` Error-rate metric math: `new cloudwatch.MathExpression({ expression: "100 * errors / requests", usingMetrics: { errors: target5xx, requests: requestCount } })` → % 5XX.
- Production use: alarms, dashboards, autoscaling (topic 19).
- Common mistakes: Average latency instead of p99; confusing ELB vs target 5XX; ids in metric math starting uppercase.
- Sources: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cloudwatch-container-insights.html ; https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-metric-math.html

### Alarms and SNS notifications
- Concept: alarm = metric vs threshold over evaluationPeriods, M-of-N via datapointsToAlarm, treatMissingData (MISSING default; NOT_BREACHING for error counts that are absent when 0). SNS topic → email/chat/pager. Alarm on symptoms users feel (5XX rate, p99 latency, unhealthy hosts — Minimum > 0 for more than one datapoint), not on every CPU blip.
- Analogy: a smoke detector that needs smoke for 3 checks in a row before ringing, so burnt toast doesn't evacuate the building.
- Code example: `const topic = new sns.Topic(this, "OpsTopic"); topic.addSubscription(new subs.EmailSubscription("ops@example.com")); const a = new cloudwatch.Alarm(this, "Api5xx", { metric: target5xx, threshold: 50, evaluationPeriods: 3, datapointsToAlarm: 3, comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD, treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING }); a.addAlarmAction(new cw_actions.SnsAction(topic));` Behaviour: 5XX sums 60, 70, 55 in three consecutive minutes → ALARM, email sent; 60, 10, 70 → stays OK.
- Production use: on-call paging (topic 23); FIS stop conditions (topic 22).
- Common mistakes: alarm fatigue (too many, too sensitive); treatMissingData BREACHING on sparse metrics; nobody subscribed.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch.Alarm.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch.TreatMissingData.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch_actions.SnsAction.html

### Dashboards
- Concept: one dashboard per env: row 1 traffic + errors + p99; row 2 ECS CPU/memory + running tasks; row 3 Aurora CPU/connections + proxy pinned; row 4 Valkey CPU/hits. `addWidgets` in same call = side by side; separate calls = new row.
- Analogy: an airport departures board summarising every flight at a glance.
- Code example: `const dash = new cloudwatch.Dashboard(this, "ShopDash", { dashboardName: "shop-prod" }); dash.addWidgets(new cloudwatch.GraphWidget({ title: "Requests", left: [requestCount], width: 8 }), new cloudwatch.GraphWidget({ title: "5XX", left: [target5xx], width: 8 }), new cloudwatch.GraphWidget({ title: "p99 latency (s)", left: [p99], width: 8 })); dash.addWidgets(new cloudwatch.GraphWidget({ title: "Proxy pinned", left: [pinnedMetric], width: 12 }));` Result: 2 rows, first with 3 graphs side by side (24-unit grid).
- Production use: load tests (topic 20), incidents (topic 23).
- Common mistakes: 40 graphs no one reads; missing DB/cache layers; no per-env separation.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch.Dashboard.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch.GraphWidget.html

### Tracing with OpenTelemetry, ADOT and X-Ray
- Concept: trace = one request's journey; span = one step (HTTP handler, DB query) with timing/attributes; W3C `traceparent` header carries IDs across services (OTEL_PROPAGATORS default tracecontext,baggage). App → OTLP HTTP → ADOT sidecar at localhost:4318 → X-Ray. Env: OTEL_SERVICE_NAME=shop-api, OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318, OTEL_LOGS_EXPORTER=none, sampler `parentbased_traceidratio` with OTEL_TRACES_SAMPLER_ARG=0.01 at 250K RPS (1%). Sidecar: container image pinned, `command: ["--config=/etc/ecs/ecs-default-config.yaml"]`; task role needs xray:PutTraceSegments, PutTelemetryRecords, GetSamplingRules/Targets/StatisticSummaries, cloudwatch:PutMetricData (or managed CloudWatchAgentServerPolicy). X-Ray: server spans → segments, attributes → metadata unless listed in `aws.xray.annotations`. Requires CloudWatch Transaction Search enabled (ECS prerequisite).
- Analogy: a parcel tracking number stamped on a package: each depot scans it with a timestamp; the tracking page shows where it was slow.
- Code example: `instrumentation.ts` — `import { NodeSDK } from "@opentelemetry/sdk-node"; import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto"; const sdk = new NodeSDK({ traceExporter: new OTLPTraceExporter() }); sdk.start();` (exporter default URL http://localhost:4318/v1/traces). Handler wrap: `import { trace, context, propagation, SpanKind, SpanStatusCode } from "@opentelemetry/api"; const tracer = trace.getTracer("shop-api"); async function traced(req: Request, handle: () => Promise<Response>) { const parent = propagation.extract(context.active(), Object.fromEntries(req.headers)); return tracer.startActiveSpan(\`${req.method} ${new URL(req.url).pathname}\`, { kind: SpanKind.SERVER }, parent, async span => { try { const res = await handle(); span.setAttribute("http.response.status_code", res.status); return res; } catch (e) { span.recordException(e as Error); span.setStatus({ code: SpanStatusCode.ERROR }); throw e; } finally { span.end(); } }); }` Run: `bun --preload ./instrumentation.ts index.ts`. CDK sidecar: `taskDef.addContainer("otel", { image: ecs.ContainerImage.fromRegistry("public.ecr.aws/aws-observability/aws-otel-collector:v0.51.0"), command: ["--config=/etc/ecs/ecs-default-config.yaml"], essential: false, memoryReservationMiB: 256, logging: ecs.LogDrivers.awsLogs({ streamPrefix: "otel" }) });` Expected: X-Ray trace map shows `shop-api` node with traces (sampled ~1%).
- Production use: find which layer (DB, cache, SSR) makes p99 slow.
- Common mistakes: assuming auto-instrumentation works on Bun.serve; 100% sampling at 250K RPS (cost); collector image `latest` unpinned; mixing OTel 2.x and 0.301.x packages.
- Sources: https://aws-otel.github.io/docs/setup/ecs ; https://opentelemetry.io/docs/languages/js/instrumentation/ ; https://opentelemetry.io/docs/languages/js/propagation/ ; https://opentelemetry.io/docs/languages/sdk-configuration/general/ ; https://docs.aws.amazon.com/xray/latest/devguide/xray-sdk-migration.html ; https://bun.com/docs/runtime/nodejs-compat

### SLO-based alerting
- Concept: SLI = measured good/total (e.g. non-5XX requests ÷ all); SLO = target over window (99.9% over 30 days); error budget = 1 − SLO = 0.1% of requests (43.2 min of full outage-equivalent). Burn rate = actual error rate ÷ budget rate; alert on fast burn (page) and slow burn (ticket). CloudWatch Application Signals SLOs: period-based or request-based, any CloudWatch metric/expression as SLI, attainment goal over interval.
- Analogy: a monthly allowance: 0.1% of requests may fail; burn rate says how fast you're spending it — spending 14× too fast empties the wallet in about two days.
- Code example: `burn.ts` — `const slo=0.999, budget=1-slo, errorRate=0.0144; const burn = errorRate/budget; console.log("burn rate:", burn.toFixed(1)); console.log("budget gone in hours:", (30*24/burn).toFixed(0));` → `burn rate: 14.4`, `budget gone in hours: 50`. Requests view: 250,000 RPS × 2,592,000 s/month × 0.001 → `console.log(250000*2592000*0.001)` → `648000000` allowed failed requests/month.
- Production use: page on fast burn of availability/latency SLOs; review budget in postmortems.
- Common mistakes: 100% SLO (no room to deploy); alerting on raw thresholds only; SLO not tied to user-facing signal.
- Sources: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-ServiceLevelObjectives.html ; https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-metric-math.html

## Quiz
1. Write a Logs Insights query for count of 5XX per minute. — tests query syntax.
2. Why alarm on HTTPCode_Target_5XX_Count with treatMissingData NOT_BREACHING? — tests missing data.
3. Why are Bun.serve requests not traced automatically, and what do you do? — tests manual spans.
4. Sampling 1% at 250K RPS sends how many traces/s? — tests sampling (2,500).
5. SLO 99.9%, current error rate 0.5%: burn rate? — tests burn rate (5).
