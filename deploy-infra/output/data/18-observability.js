window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "18-observability",
  "order": 18,
  "title": "Observability",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Observability means being able to ask your running system questions and get answers from the data it emits: logs (text records of events), metrics (numbers over time) and traces (the path of one request). You will query JSON logs with CloudWatch Logs Insights, read ALB and ECS metrics, create alarms that notify through SNS (a message-fan-out service), build a dashboard in CDK, send traces from Bun through the ADOT collector to AWS X-Ray (the AWS service that stores and draws traces), and turn all this into SLOs with error budgets (the failure allowance an SLO leaves you).",
  "prerequisites": ["06-app-production-readiness", "09-ecs-fargate", "10-alb-dns"],
  "subtopics": [
    {
      "id": "cloudwatch-logs-insights",
      "title": "CloudWatch Logs and Logs Insights",
      "explanation": "Observability is how well you can understand what your running system is doing from the outside. It rests on three kinds of data: logs (timestamped text records of events), metrics (numbers measured over time, such as requests per minute) and traces (the recorded journey of one request through your system). This sub-topic covers logs; the next ones cover metrics and traces.\n\nIn topic 06 your app wrote one JSON object per log line, and in topic 09 the awslogs driver sent those lines to CloudWatch Logs, in a log group (a named container for log streams). We assume the log group is called `shop-api`. Logs Insights is the CloudWatch feature that lets you run queries over a log group. Because each line is JSON, Logs Insights automatically discovers the fields (such as `status` and `ms`) so you can use them by name. If your logs were plain text, you would get no fields and would have to cut them out with `parse`.\n\nA query is a series of commands joined by the pipe character `|`, each command taking the previous one's output. The commands you need most are: `fields` (choose columns to show), `filter` (keep only matching rows), `stats` (aggregate rows into numbers, optionally `by` a grouping), `sort`, `limit` and `parse` (extract a value out of free text into a new field).\n\nInside `stats` you can use `count(*)`, `avg(field)` and `pct(field, 99)`. `pct(ms, 99)` is the 99th percentile (p99, taught in topic 01): the value that 99% of requests are faster than. `bin(1m)` groups rows into one-minute time buckets, so `stats count(*) by bin(1m)` gives one count per minute. A query may contain at most 10 `stats` commands, and `sort` and `limit` must come after the last `stats`.",
      "analogy": "A searchable CCTV archive. Instead of watching hours of tape, you ask the system: show every moment someone dropped a tray, grouped by minute. `filter` is 'only the tray drops', `stats ... by bin(1m)` is 'count them per minute', and `sort` and `limit` are 'show me the worst five minutes'.",
      "code": [
        {
          "language": "json",
          "filename": "sample-log-line.json",
          "source": "{\"level\":\"info\",\"msg\":\"request\",\"method\":\"GET\",\"path\":\"/products\",\"status\":200,\"ms\":42}",
          "output": "",
          "explanation": "One line as your app writes it (the exact field names depend on what you built in topic 06; this course assumes `msg`, `path`, `status` and `ms`). Each key becomes a queryable field in Logs Insights."
        },
        {
          "language": "bash",
          "filename": "run-query.sh",
          "source": "START=$(date -d '1 hour ago' +%s)\nEND=$(date +%s)\n\naws logs start-query \\\n  --log-group-name shop-api \\\n  --start-time \"$START\" --end-time \"$END\" \\\n  --query-string 'fields @timestamp, path, status, ms | filter status >= 500 | stats count(*) as errors by bin(1m) | sort errors desc | limit 5'",
          "output": "{\n    \"queryId\": \"12ab3456-12ab-123a-789e-1234567890ab\"\n}",
          "explanation": "Query 1: the five worst minutes by count of 5XX responses (status 500 and above, meaning server errors). `--start-time` and `--end-time` are epoch seconds (seconds since 1 January 1970); `date -d` is the GNU date syntax available in Linux and Git Bash. Run these bash commands in Git Bash, not PowerShell; date -d does not exist in PowerShell. The command only starts the query and returns a `queryId`, which differs on every run."
        },
        {
          "language": "bash",
          "filename": "get-results.sh",
          "source": "aws logs get-query-results --query-id 12ab3456-12ab-123a-789e-1234567890ab",
          "output": "{\n    \"results\": [\n        [\n            { \"field\": \"bin(1m)\", \"value\": \"2026-11-22 10:14:00.000\" },\n            { \"field\": \"errors\", \"value\": \"37\" }\n        ],\n        [\n            { \"field\": \"bin(1m)\", \"value\": \"2026-11-22 10:15:00.000\" },\n            { \"field\": \"errors\", \"value\": \"12\" }\n        ]\n    ],\n    \"status\": \"Complete\"\n}",
          "explanation": "Fetching the results. The numbers shown are illustrative; yours depend on your traffic. If `status` is `Running`, wait a moment and run it again."
        },
        {
          "language": "bash",
          "filename": "p99-query.sh",
          "source": "aws logs start-query \\\n  --log-group-name shop-api \\\n  --start-time \"$(date -d '3 hours ago' +%s)\" --end-time \"$(date +%s)\" \\\n  --query-string 'filter msg = \"request\" | stats pct(ms, 99) as p99 by bin(5m)'",
          "output": "{\n    \"queryId\": \"98zy7654-98zy-987z-321a-0987654321zy\"\n}",
          "explanation": "Query 2: the p99 latency in milliseconds for each five-minute window, using only lines where `msg` equals `request`. Fetch it with `aws logs get-query-results` exactly as above. You can also paste either query into the CloudWatch console under Logs, then Logs Insights."
        }
      ],
      "productionNote": "Logs Insights is the first stop in an incident (topic 23): find when errors started and which paths are affected. You are billed by the amount of log data scanned, so always pick the narrowest time range and log group you can. At very high traffic, logging every successful request is expensive and slow to query; consider logging errors and slow requests in full and only a sample of the rest.",
      "commonMistakes": [
        "Logging plain text instead of JSON, so no fields are discovered and every query needs `parse`.",
        "Querying a huge time range (days or weeks) for a quick question: slower and more costly because more data is scanned.",
        "Logging every request at peak traffic, which inflates cost and makes queries slow.",
        "Putting `sort` or `limit` before the last `stats`; they must come after it."
      ],
      "sources": [
        { "title": "CloudWatch Logs Insights query syntax", "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html" },
        { "title": "Logs Insights stats command and functions", "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax-Stats.html" },
        { "title": "Logs Insights discovered fields", "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_AnalyzeLogData-discoverable-fields.html" }
      ]
    },
    {
      "id": "metrics-container-insights",
      "title": "Metrics and Container Insights",
      "explanation": "A metric is a number tracked over time. Every metric in CloudWatch is identified by a namespace (the owning service, such as `AWS/ApplicationELB`, `AWS/ECS` or `AWS/RDS`), a name (such as `RequestCount`) and dimensions (key/value labels that pick one specific resource, such as which load balancer). To read a metric you also choose a statistic (how to combine the raw data points: `Sum`, `Average`, `p99`...) and a period (the length of each time bucket, for example 1 minute).\n\nThe ALB metrics you will use most: `RequestCount` (requests received), `TargetResponseTime` (how long your containers took to respond, in seconds, not milliseconds), `HTTPCode_Target_5XX_Count` (5XX responses generated by your app) and `UnHealthyHostCount` (targets failing health checks). Do not confuse `HTTPCode_Target_5XX_Count` with `HTTPCode_ELB_5XX_Count`: the latter counts errors produced by the load balancer itself, for example when no healthy target exists. Different cause, different fix.\n\nThe ALB dimension is `LoadBalancer`, whose value is the load balancer's 'full name' (`app/name/id`). In CDK you get it from `alb.loadBalancerFullName`. The code below assumes `alb` is the load balancer from topic 10 and sits inside your stack class (topic 07).\n\nContainer Insights is an ECS feature that collects per-cluster, per-service and per-task CPU, memory, network and storage metrics. You turn it on for the cluster; AWS recommends the enhanced mode, which adds more detail at the task and container level. Metric math lets you compute a new series from others: give each input a short id and write an expression such as `100 * errors / requests`. Ids must start with a lowercase letter.",
      "analogy": "A car dashboard. The speedometer is `RequestCount`, the engine temperature is CPU, and the warning lights are the 5XX counts. Each gauge has a unit (seconds, count, percent) and a time window, and you read the right gauge for the right problem.",
      "code": [
        {
          "language": "typescript",
          "filename": "lib/metrics.ts",
          "source": "import { Duration } from \"aws-cdk-lib\";\nimport * as cloudwatch from \"aws-cdk-lib/aws-cloudwatch\";\nimport * as ecs from \"aws-cdk-lib/aws-ecs\";\n\n// Inside your Stack constructor; `vpc` and `alb` come from topics 08 and 10.\nconst cluster = new ecs.Cluster(this, \"Cluster\", {\n  vpc,\n  containerInsightsV2: ecs.ContainerInsights.ENHANCED,\n});\n\nconst dimensionsMap = { LoadBalancer: alb.loadBalancerFullName };\n\nconst p99 = new cloudwatch.Metric({\n  namespace: \"AWS/ApplicationELB\",\n  metricName: \"TargetResponseTime\",\n  dimensionsMap,\n  statistic: \"p99\",\n  period: Duration.minutes(1),\n});\n\nconst requestCount = new cloudwatch.Metric({\n  namespace: \"AWS/ApplicationELB\",\n  metricName: \"RequestCount\",\n  dimensionsMap,\n  statistic: \"Sum\",\n  period: Duration.minutes(1),\n});\n\nconst target5xx = new cloudwatch.Metric({\n  namespace: \"AWS/ApplicationELB\",\n  metricName: \"HTTPCode_Target_5XX_Count\",\n  dimensionsMap,\n  statistic: \"Sum\",\n  period: Duration.minutes(1),\n});\n\nconst errorPercent = new cloudwatch.MathExpression({\n  expression: \"100 * errors / requests\",\n  usingMetrics: { errors: target5xx, requests: requestCount },\n  label: \"5XX %\",\n  period: Duration.minutes(1),\n});",
          "output": "",
          "explanation": "Creating these objects prints nothing; they only describe metrics. They become useful when you pass them to alarms and dashboards in the next sub-topics. `errorPercent` evaluates to, for example, 2 when 20 of 1000 requests in a minute were 5XX. `containerInsightsV2: ENHANCED` turns on enhanced Container Insights for the cluster, after which you can read per-task CPU and memory in the CloudWatch console."
        }
      ],
      "productionNote": "These metrics feed three things: alarms (next sub-topic), dashboards (after that) and autoscaling (topic 19, which scales on request count and CPU). Always look at percentiles for latency: the average hides the slow tail that real users feel.",
      "commonMistakes": [
        "Watching average latency instead of p99, which hides slow requests.",
        "Confusing `HTTPCode_ELB_5XX_Count` (load balancer errors) with `HTTPCode_Target_5XX_Count` (your app's errors) and debugging the wrong layer.",
        "Reading `TargetResponseTime` as milliseconds; it is in seconds.",
        "Giving a metric math id an uppercase first letter (use `errors`, not `Errors`)."
      ],
      "sources": [
        { "title": "Application Load Balancer CloudWatch metrics", "url": "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html" },
        { "title": "Amazon ECS Container Insights", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cloudwatch-container-insights.html" },
        { "title": "CloudWatch metric math", "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-metric-math.html" }
      ]
    },
    {
      "id": "alarms-sns",
      "title": "Alarms and SNS notifications",
      "explanation": "A CloudWatch alarm watches one metric and compares it to a threshold (a limit value). The alarm has three states: OK, ALARM and INSUFFICIENT_DATA. `evaluationPeriods` is how many recent periods are examined, and `datapointsToAlarm` is how many of them must breach the threshold for the alarm to fire (an 'M out of N' rule). With `evaluationPeriods: 3` and `datapointsToAlarm: 3`, the metric must be bad three minutes in a row.\n\n`treatMissingData` decides what happens when a period has no data point. The default is `MISSING` (the alarm keeps its state and may go INSUFFICIENT_DATA). Error counts are usually absent, not zero, when nothing went wrong, so use `NOT_BREACHING` there: no data means no errors. Avoid `BREACHING` on sparse metrics, or quiet periods raise false alarms.\n\nAn alarm does nothing by itself; you attach an action. SNS (Simple Notification Service) is the AWS service for this: an SNS topic is a named channel, and subscriptions deliver each message published to it by email, chat, or a paging tool. The alarm publishes to the topic when it enters ALARM. For email, the recipient must click the confirmation link AWS sends first, or nothing arrives.\n\nAlarm on symptoms users feel: 5XX rate, p99 latency, unhealthy hosts (for `UnHealthyHostCount`, use the `Minimum` statistic and alarm when it stays above 0 for more than one data point, so a single blip is ignored). Do not alarm on every CPU spike.",
      "analogy": "A smoke detector that needs smoke on three checks in a row before it rings, so burnt toast does not evacuate the building. `datapointsToAlarm` is the number of consecutive smoky checks required, and the SNS topic is the building's alarm bell wired to everyone's phone.",
      "code": [
        {
          "language": "typescript",
          "filename": "lib/alarms.ts",
          "source": "import * as cloudwatch from \"aws-cdk-lib/aws-cloudwatch\";\nimport * as cw_actions from \"aws-cdk-lib/aws-cloudwatch-actions\";\nimport * as sns from \"aws-cdk-lib/aws-sns\";\nimport * as subs from \"aws-cdk-lib/aws-sns-subscriptions\";\n\n// Inside your Stack constructor; `target5xx` is the metric from the previous sub-topic.\nconst topic = new sns.Topic(this, \"OpsTopic\");\ntopic.addSubscription(new subs.EmailSubscription(\"ops@example.com\"));\n\nconst api5xx = new cloudwatch.Alarm(this, \"Api5xx\", {\n  metric: target5xx,\n  threshold: 50,\n  evaluationPeriods: 3,\n  datapointsToAlarm: 3,\n  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,\n  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,\n});\napi5xx.addAlarmAction(new cw_actions.SnsAction(topic));",
          "output": "",
          "explanation": "Deploying this creates the topic, an email subscription (replace the address with a real one and confirm it), and an alarm that goes to ALARM when the per-minute 5XX sum is at least 50 for three consecutive minutes. Then it publishes to the topic, which emails the subscriber."
        },
        {
          "language": "typescript",
          "filename": "alarm-sim.ts",
          "source": "// Plain simulation of the alarm rule above, to see how 3-of-3 behaves.\nfunction state(sums: number[], threshold: number, datapointsToAlarm: number): string {\n  const breaching = sums.filter((n) => n >= threshold).length;\n  return breaching >= datapointsToAlarm ? \"ALARM\" : \"OK\";\n}\n\nconsole.log(state([60, 70, 55], 50, 3));\nconsole.log(state([60, 10, 70], 50, 3));",
          "output": "ALARM\nOK",
          "explanation": "Run it with `bun run alarm-sim.ts`. Three consecutive minutes of 60, 70 and 55 errors all reach 50, so the alarm fires. In `[60, 10, 70]` the middle minute is below 50, only two of three data points breach, so the alarm stays OK. (This simulation counts how many values in the array you pass reach the threshold; here the array is the three minutes being checked.)"
        }
      ],
      "productionNote": "Alarms are what wake the on-call person (topic 23), and later they act as stop conditions for chaos experiments (topic 22). Keep the set small and actionable: every alarm should mean someone has to do something. Verify the SNS subscription is confirmed by sending a test alarm; an alarm nobody receives is worse than none.",
      "commonMistakes": [
        "Alarm fatigue: too many alarms or thresholds that are too sensitive, so people start ignoring them.",
        "Using `treatMissingData: BREACHING` on sparse metrics, which fires false alarms in quiet periods.",
        "Creating the topic but never subscribing anyone, or never confirming the email subscription.",
        "Alarming on causes (a CPU blip) instead of symptoms users feel (error rate, p99 latency, unhealthy hosts)."
      ],
      "sources": [
        { "title": "CDK Alarm class", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch.Alarm.html" },
        { "title": "CDK TreatMissingData", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch.TreatMissingData.html" },
        { "title": "CDK SnsAction", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch_actions.SnsAction.html" }
      ]
    },
    {
      "id": "dashboards",
      "title": "Dashboards",
      "explanation": "A CloudWatch dashboard is a single page of graphs (widgets) built from your metrics. The goal is to see the health of the whole system at a glance, so make one dashboard per environment (for example `shop-prod`, `shop-staging`), laid out in rows from the user's view down to the data stores.\n\nA good layout: row 1 is traffic, errors and p99 latency; row 2 is ECS CPU, memory and running tasks; row 3 is Aurora CPU and connections plus the RDS Proxy pinned-connections metric (topic 12); row 4 is Valkey CPU and cache hits (topic 14).\n\nIn CDK, `dashboard.addWidgets(a, b, c)` puts all widgets passed in the same call side by side in one row, and a separate `addWidgets` call starts a new row. The dashboard grid is 24 units wide, so three widgets with `width: 8` fill a row, and one widget with `width: 12` fills half of one. A `GraphWidget` draws a line graph; `left` lists the metrics on the left Y axis.",
      "analogy": "An airport departures board that summarises every flight at a glance. Each row is a layer of your system; a glance tells you which 'flight' is delayed without opening any individual log.",
      "code": [
        {
          "language": "typescript",
          "filename": "lib/dashboard.ts",
          "source": "import { Duration } from \"aws-cdk-lib\";\nimport * as cloudwatch from \"aws-cdk-lib/aws-cloudwatch\";\n\n// Inside your Stack constructor; requestCount, target5xx and p99 are from the Metrics sub-topic.\nconst pinnedMetric = new cloudwatch.Metric({\n  namespace: \"AWS/RDS\",\n  metricName: \"DatabaseConnectionsCurrentlySessionPinned\",\n  dimensionsMap: { ProxyName: \"shop-proxy\" },\n  statistic: \"Maximum\",\n  period: Duration.minutes(1),\n});\n\nconst dash = new cloudwatch.Dashboard(this, \"ShopDash\", {\n  dashboardName: \"shop-prod\",\n});\n\ndash.addWidgets(\n  new cloudwatch.GraphWidget({ title: \"Requests\", left: [requestCount], width: 8 }),\n  new cloudwatch.GraphWidget({ title: \"5XX\", left: [target5xx], width: 8 }),\n  new cloudwatch.GraphWidget({ title: \"p99 latency (s)\", left: [p99], width: 8 }),\n);\n\ndash.addWidgets(\n  new cloudwatch.GraphWidget({ title: \"Proxy pinned\", left: [pinnedMetric], width: 12 }),\n);",
          "output": "",
          "explanation": "After `cdk deploy` the console shows a dashboard named `shop-prod` with two rows: three graphs side by side (8 + 8 + 8 = 24 units), then one graph below. `\"shop-proxy\"` is the name you gave the RDS Proxy in topic 12; use your own name. Add further rows for ECS, Aurora and Valkey the same way."
        }
      ],
      "productionNote": "Dashboards are what you open first during a load test (topic 20) and during an incident (topic 23). Because they are defined in CDK, every environment gets the same layout, and changes go through code review.",
      "commonMistakes": [
        "Building 40 graphs that nobody reads; keep it to the signals that drive decisions.",
        "Showing only the web layer and leaving out the database and cache, so a slow query looks like a mystery.",
        "Sharing one dashboard across environments, so staging noise hides production problems."
      ],
      "sources": [
        { "title": "CDK Dashboard class", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch.Dashboard.html" },
        { "title": "CDK GraphWidget class", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch.GraphWidget.html" }
      ]
    },
    {
      "id": "tracing-otel-adot-xray",
      "title": "Tracing with OpenTelemetry, ADOT and X-Ray",
      "explanation": "A trace is the recorded journey of one request. It is made of spans, where each span is one timed step (handling the HTTP request, one database query, one cache call) with a start time, a duration and attributes (key/value details). A trace tells you which layer made a slow request slow, something metrics and logs cannot show.\n\nTo link steps across services, a trace ID travels in an HTTP header called `traceparent` (part of the W3C Trace Context standard). Each service reads it from the incoming request and passes it on. This is called propagation, and the default propagators are `tracecontext` and `baggage`.\n\nOpenTelemetry (OTel) is the vendor-neutral standard and set of libraries for producing traces. The older SDKs and daemon for AWS X-Ray (the AWS service that stores and draws traces) entered maintenance mode on 2026-02-25 (security fixes only), and AWS recommends OpenTelemetry instead. The flow in this course: your app sends spans with OTLP (the OpenTelemetry wire protocol) over HTTP to the ADOT collector, a sidecar container (a helper container in the same task) listening on `localhost:4318`, which forwards them to X-Ray. ADOT is the AWS Distro for OpenTelemetry. Because Fargate tasks share one network, `localhost` reaches the sidecar.\n\nImportant for Bun: the OpenTelemetry JavaScript docs support Node.js LTS and never mention Bun, and Bun lacks the `http.server.*` diagnostics channels (event hooks) that Node's HTTP auto-instrumentation relies on. So treat `Bun.serve` as not auto-instrumented: you create the server span yourself (the `traced` function below). `AsyncLocalStorage` (Node's tool for carrying context through async code) is implemented in Bun, so child spans should attach to the right parent; verify it locally: send one request through your app that makes a database call, and check that the database span appears under the same trace as the server span.\n\nThe SDK is set up in a file loaded before your app: `bun --preload ./instrumentation.ts index.ts`. Install `@opentelemetry/sdk-node` 0.301.2, `@opentelemetry/exporter-trace-otlp-proto` and `@opentelemetry/api` . Keep @opentelemetry/sdk-node and the OTLP exporter on the same release line; @opentelemetry/api stays at 1.10.0 or newer.\n\nConfiguration comes from standard environment variables: `OTEL_SERVICE_NAME=shop-api`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`, `OTEL_LOGS_EXPORTER=none` (the collector setup here does not accept logs), `OTEL_TRACES_SAMPLER=parentbased_traceidratio` and `OTEL_TRACES_SAMPLER_ARG=0.01`. Sampling means recording only a fraction of traces: `0.01` keeps 1%, and 'parent-based' means a request keeps its parent's decision. At 250,000 requests per second, 100% sampling would be extremely costly.\n\nOn the AWS side, the collector's task role needs `xray:PutTraceSegments`, `xray:PutTelemetryRecords`, `xray:GetSamplingRules`, `xray:GetSamplingTargets`, `xray:GetSamplingStatisticSummaries` and `cloudwatch:PutMetricData`; the managed policy `CloudWatchAgentServerPolicy` covers these.\n\nThe ECS setup also requires CloudWatch Transaction Search (the CloudWatch feature that must be on to show spans) to be enabled in the account. In AWS X-Ray, server spans become segments (X-Ray's record of one server span), and span attributes become metadata (extra details stored but not searchable) unless the key is listed in `aws.xray.annotations`, which makes them annotations (searchable details, listed under aws.xray.annotations).",
      "analogy": "A parcel tracking number stamped on a package. Each depot scans it with a timestamp (a span), and the tracking page shows the whole route and where the parcel sat the longest. The `traceparent` header is the number printed on the label, and the sampler decides how many parcels get a tracking label at all.",
      "code": [
        {
          "language": "typescript",
          "filename": "instrumentation.ts",
          "source": "import { NodeSDK } from \"@opentelemetry/sdk-node\";\nimport { OTLPTraceExporter } from \"@opentelemetry/exporter-trace-otlp-proto\";\n\n// The exporter reads OTEL_EXPORTER_OTLP_ENDPOINT; the default is http://localhost:4318/v1/traces.\nconst sdk = new NodeSDK({ traceExporter: new OTLPTraceExporter() });\nsdk.start();",
          "output": "",
          "explanation": "Starts the OpenTelemetry SDK. Run your app with `bun --preload ./instrumentation.ts index.ts` so this file runs first. It prints nothing. Name, endpoint and sampler come from the OTEL_* environment variables above."
        },
        {
          "language": "typescript",
          "filename": "traced.ts",
          "source": "import { trace, context, propagation, SpanKind, SpanStatusCode } from \"@opentelemetry/api\";\n\nconst tracer = trace.getTracer(\"shop-api\");\n\nexport async function traced(\n  req: Request,\n  handle: () => Promise<Response>,\n): Promise<Response> {\n  // Read `traceparent` from the incoming headers so we join the caller's trace.\n  const parent = propagation.extract(context.active(), Object.fromEntries(req.headers));\n  const name = `${req.method} ${new URL(req.url).pathname}`;\n\n  return tracer.startActiveSpan(name, { kind: SpanKind.SERVER }, parent, async (span) => {\n    try {\n      const res = await handle();\n      span.setAttribute(\"http.response.status_code\", res.status);\n      return res;\n    } catch (e) {\n      span.recordException(e as Error);\n      span.setStatus({ code: SpanStatusCode.ERROR });\n      throw e;\n    } finally {\n      span.end();\n    }\n  });\n}",
          "output": "",
          "explanation": "Because Bun.serve is not auto-instrumented, this wrapper creates the server span by hand. It extracts the incoming trace context, starts a span of kind SERVER named like `GET /products`, records the status code, marks the span as an error (and records the exception) if the handler throws, and always ends the span. Use it from your server: `Bun.serve({ fetch: (req) => traced(req, () => handleRequest(req)) })`, where `handleRequest` is your existing handler."
        },
        {
          "language": "typescript",
          "filename": "lib/otel-sidecar.ts",
          "source": "import * as ecs from \"aws-cdk-lib/aws-ecs\";\nimport * as iam from \"aws-cdk-lib/aws-iam\";\n\n// Inside your Stack constructor; `taskDef` is the Fargate task definition from topic 09.\ntaskDef.taskRole.addManagedPolicy(\n  iam.ManagedPolicy.fromAwsManagedPolicyName(\"CloudWatchAgentServerPolicy\"),\n);\n\ntaskDef.addContainer(\"otel\", {\n  image: ecs.ContainerImage.fromRegistry(\n    \"public.ecr.aws/aws-observability/aws-otel-collector:v0.51.0\",\n  ),\n  command: [\"--config=/etc/ecs/ecs-default-config.yaml\"],\n  essential: false,\n  memoryReservationMiB: 256,\n  logging: ecs.LogDrivers.awsLogs({ streamPrefix: \"otel\" }),\n});",
          "output": "",
          "explanation": "Adds the ADOT collector as a second container in the same task. The image tag is pinned to `v0.51.0` (never `latest`). The default ECS config receives OTLP and sends traces to X-Ray. `essential: false` means that if the collector stops, the app container keeps running. Also add the OTEL_* variables to your app container's `environment` option when you call `addContainer` for it, e.g. `OTEL_SERVICE_NAME: \"shop-api\"`, `OTEL_EXPORTER_OTLP_ENDPOINT: \"http://localhost:4318\"`, `OTEL_LOGS_EXPORTER: \"none\"`, `OTEL_TRACES_SAMPLER: \"parentbased_traceidratio\"` and `OTEL_TRACES_SAMPLER_ARG: \"0.01\"`. After deploying and sending traffic, the X-Ray trace map in the CloudWatch console shows a `shop-api` node (about 1% of requests are sampled)."
        }
      ],
      "productionNote": "Traces answer 'which layer makes p99 slow?': the database, the cache or server-side rendering. Sample at a low rate in production (1% at 250,000 requests per second is 2,500 traces per second, still plenty), pin the collector image tag, and keep the OTel packages on one consistent release line.",
      "commonMistakes": [
        "Assuming auto-instrumentation works on `Bun.serve`; it does not, so create the server span manually.",
        "Sampling 100% of requests at high traffic, which is very costly.",
        "Using the collector image tag `latest` instead of a pinned version, so a deploy can silently change behaviour.",
        "Mixing OpenTelemetry 2.x packages with 0.301.x packages; use the matching release line.",
        "Forgetting the task role permissions or Transaction Search, so spans reach the collector but never appear in X-Ray."
      ],
      "sources": [
        { "title": "ADOT setup for Amazon ECS", "url": "https://aws-otel.github.io/docs/setup/ecs" },
        { "title": "OpenTelemetry JS instrumentation", "url": "https://opentelemetry.io/docs/languages/js/instrumentation/" },
        { "title": "OpenTelemetry JS context propagation", "url": "https://opentelemetry.io/docs/languages/js/propagation/" }
      ]
    },
    {
      "id": "slo-alerting",
      "title": "SLO-based alerting",
      "explanation": "Three related ideas (the terms SLA and SLO were introduced in topic 01). An SLI (service level indicator) is a measured ratio of good events to total events, for example non-5XX requests divided by all requests. An SLO (service level objective) is the target for that ratio over a window, for example 99.9% over 30 days. The error budget is what the SLO allows to fail: 1 minus the SLO, so 0.1%. Over 30 days, 0.1% is 43.2 minutes of full outage-equivalent (30 x 24 x 60 x 0.001).\n\nThe burn rate is how fast you spend that budget: the actual error rate divided by the budget rate. A burn rate of 1 uses exactly the whole budget by the end of the window. Higher is faster. With an SLO of 99.9% and an error rate of 1.44%, the burn rate is 14.4 and the 30-day budget is gone in 720 / 14.4 = 50 hours.\n\nAlert on burn rate instead of a raw threshold: a fast burn (for example 14.4 or more over a short window) pages a human right now, while a slow burn (a small but steady excess) opens a ticket to fix during working hours. CloudWatch Application Signals can hold SLOs for you: period-based (judged per time window) or request-based (judged per request count), with any CloudWatch metric or metric math expression as the SLI and an attainment goal (the target percentage the SLI must meet) over an interval.",
      "analogy": "A monthly allowance. The SLO says 0.1% of requests may fail, which is your spending money. The burn rate says how fast you are spending it: at 14 times the sustainable pace you empty the wallet in about two days, which is worth a phone call. Slowly overspending is a note to yourself to fix it this week.",
      "code": [
        {
          "language": "typescript",
          "filename": "burn.ts",
          "source": "const slo = 0.999;\nconst budget = 1 - slo; // allowed failure fraction, about 0.001\nconst errorRate = 0.0144; // 1.44% of requests are failing right now\n\nconst burn = errorRate / budget;\nconsole.log(\"burn rate:\", burn.toFixed(1));\nconsole.log(\"budget gone in hours:\", ((30 * 24) / burn).toFixed(0));\n\n// Requests view: how many failed requests per month does 99.9% allow at 250,000 RPS?\nconst requestsPerMonth = 250000 * 2592000; // 2,592,000 seconds in 30 days\nconsole.log(\"allowed failed requests:\", Math.round(requestsPerMonth * budget));",
          "output": "burn rate: 14.4\nbudget gone in hours: 50\nallowed failed requests: 648000000",
          "explanation": "Run with `bun run burn.ts`. A 1.44% error rate against a 0.1% budget burns 14.4 times too fast, emptying the 30-day (720-hour) budget in 50 hours. At 250,000 requests per second, 99.9% still allows 648 million failed requests a month, which shows why a percentage alone is not enough: you also need to know what the failures were. `Math.round` removes tiny floating-point noise."
        }
      ],
      "productionNote": "Page on fast burn of availability and latency SLOs, ticket on slow burn, and review the remaining budget in postmortems (topic 23). When the budget is nearly spent, slow down risky deploys and spend time on reliability work.",
      "commonMistakes": [
        "Setting a 100% SLO: there is then no error budget, so every deploy or hiccup breaks it.",
        "Alerting only on raw thresholds (for example 'CPU above 80%') instead of on how fast the budget burns.",
        "Defining an SLO on something users never feel, such as CPU, rather than a user-facing signal like successful requests or latency."
      ],
      "sources": [
        { "title": "CloudWatch Service Level Objectives (SLOs)", "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-ServiceLevelObjectives.html" },
        { "title": "CloudWatch metric math", "url": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/using-metric-math.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Which Logs Insights query returns the count of 5XX responses per minute, assuming a numeric `status` field?",
      "options": [
        "filter status >= 500 | stats count(*) as errors by bin(1m)",
        "stats count(*) as errors by bin(1m) | filter status >= 500",
        "fields status | sort status >= 500 | limit 1m",
        "filter status >= 500 | stats pct(status, 99) by errors"
      ],
      "answerIndex": 0,
      "explanation": "`filter` first keeps only rows with status 500 or higher, then `stats count(*) ... by bin(1m)` counts them in one-minute buckets. Option 2 filters after the stats, when `status` no longer exists. Options 3 and 4 misuse `sort`, `limit` and `pct`."
    },
    {
      "question": "Why alarm on `HTTPCode_Target_5XX_Count` with `treatMissingData: NOT_BREACHING`?",
      "options": [
        "Because the alarm would otherwise never be able to leave the ALARM state",
        "Because this count has no data points in minutes with zero errors, and no data should mean 'no errors', not a breach",
        "Because NOT_BREACHING makes the alarm fire faster",
        "Because SNS only delivers messages when data is missing"
      ],
      "answerIndex": 1,
      "explanation": "Error counts are often absent rather than zero when nothing fails. Treating the gaps as not breaching stops quiet periods from causing false alarms or INSUFFICIENT_DATA."
    },
    {
      "question": "Why are `Bun.serve` requests not traced automatically, and what do you do about it?",
      "options": [
        "Bun cannot run OpenTelemetry at all, so you must switch to Node.js",
        "X-Ray rejects spans that come from Bun",
        "Bun lacks the `http.server.*` diagnostics channels that HTTP auto-instrumentation uses, so you create the server span manually and pass on the incoming trace context",
        "Tracing only works if sampling is set to 100%"
      ],
      "answerIndex": 2,
      "explanation": "The OTel JS docs target Node LTS, and Bun does not provide the server diagnostics channels auto-instrumentation hooks into. A manual wrapper like `traced()` creates the SERVER span and extracts `traceparent`. AsyncLocalStorage exists in Bun, so child spans should still attach; verify locally."
    },
    {
      "question": "With 1% sampling at 250,000 requests per second, about how many traces per second are recorded?",
      "options": [
        "25",
        "250",
        "25,000",
        "2,500"
      ],
      "answerIndex": 3,
      "explanation": "250,000 x 0.01 = 2,500 traces per second."
    },
    {
      "question": "Your SLO is 99.9% and the current error rate is 0.5%. What is the burn rate?",
      "options": [
        "5",
        "0.5",
        "50",
        "99.4"
      ],
      "answerIndex": 0,
      "explanation": "The error budget is 1 - 0.999 = 0.1% (0.001). Burn rate = actual error rate / budget rate = 0.5% / 0.1% = 5, so the budget is spent 5 times faster than sustainable."
    }
  ]
});
