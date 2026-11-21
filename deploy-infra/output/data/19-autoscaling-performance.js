window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "19-autoscaling-performance",
  "order": 19,
  "title": "Auto Scaling & Performance",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Your API cannot run the same number of tasks at 3 a.m. and during a flash sale. This topic teaches you to let AWS add and remove ECS tasks and Aurora readers automatically, to size each task so every vCPU does work, and to plan the account limits (quotas) and the cheaper Fargate Spot capacity. All sizing numbers are illustrative until the load test in the next topic proves them.",
  "prerequisites": ["01-deployment-foundations", "09-ecs-fargate", "10-alb-dns", "11-aurora-postgresql", "18-observability"],
  "subtopics": [
    {
      "id": "ecs-service-auto-scaling-policies",
      "title": "ECS service auto scaling policies",
      "explanation": "Auto scaling means a system changes how many copies of something run, without a human clicking a button. For an ECS service (topic 9), the number of running copies of your task is its desiredCount. AWS Application Auto Scaling is the AWS service that changes that number for you, always staying between a minimum and a maximum that you choose.\n\nThere are three kinds of scaling rule (a scaling policy). Target tracking is the preferred one: you pick a metric (a number CloudWatch measures, topic 18) and a target value, for example average CPU 60%. AWS then adds or removes tasks to keep the metric near that target, like a thermostat holding a room at 21 degrees. Step scaling lets you write bands yourself: when an alarm fires, add 1 task if the metric is between 50 and 70, add 3 if it is above 70. You must give between 2 and 40 steps. Scheduled scaling changes the minimum or maximum at a fixed time, for peaks you know about in advance.\n\nIn CDK (topic 7), `service.autoScaleTaskCount({ minCapacity, maxCapacity })` switches auto scaling on and returns a scaling object. `maxCapacity` is required. `minCapacity` defaults to 1, which is far too low for production. On that object you call `scaleOnCpuUtilization`, `scaleOnMemoryUtilization`, `scaleOnRequestCount` (next sub-topic) or `scaleOnSchedule`.\n\nA cooldown is the pause after a scaling action during which AWS will not repeat that kind of action. The CDK default is 300 seconds for both directions. A good production pattern is to scale out fast (60 seconds) and scale in slowly (300 seconds), because an extra task costs a little money, but too few tasks during a rush costs you users. If the two cooldowns are equal, the service can flap, meaning it keeps adding and removing tasks in a loop.\n\nWhen auto scaling owns the task count, do not also set `desiredCount` in your stack. Otherwise every `cdk deploy` would reset the count to your fixed number.\n\nScheduled scaling uses a cron expression. Cron is a compact way to say when something runs: here `hour: \"8\", minute: \"45\"` means 08:45 every day, in UTC (Coordinated Universal Time, the standard world clock AWS uses). The example raises the minimum to 60 tasks before a sale and lowers it back afterwards.",
      "analogy": "A shop with a thermostat for staff. When the shop gets crowded you call in more cashiers quickly, and you send them home slowly in case the rush returns. Target tracking is the manager who keeps the queue at a steady length. Step scaling is a rulebook (queue over 10: call 1 person, over 30: call 3). Scheduled scaling is the note on the wall saying: sale starts at 09:00, have 60 cashiers ready by 08:45.",
      "code": [
        {
          "language": "typescript",
          "filename": "scaling-demo.ts",
          "source": "import { App, Duration, Stack } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport * as ecs from \"aws-cdk-lib/aws-ecs\";\nimport * as appscaling from \"aws-cdk-lib/aws-applicationautoscaling\";\nimport { Match, Template } from \"aws-cdk-lib/assertions\";\n\nconst cfg = { minTasks: 20, maxTasks: 120 };\n\nconst app = new App();\nconst stack = new Stack(app, \"ApiScalingDemo\");\nconst vpc = new ec2.Vpc(stack, \"Vpc\", { maxAzs: 2 });\nconst cluster = new ecs.Cluster(stack, \"Cluster\", { vpc });\n\nconst taskDef = new ecs.FargateTaskDefinition(stack, \"ApiTask\", {\n  cpu: 2048,\n  memoryLimitMiB: 4096,\n  runtimePlatform: {\n    cpuArchitecture: ecs.CpuArchitecture.ARM64,\n    operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,\n  },\n});\ntaskDef.addContainer(\"api\", {\n  image: ecs.ContainerImage.fromRegistry(\"oven/bun:1\"),\n  portMappings: [{ containerPort: 3000 }],\n});\n\n// No desiredCount here: auto scaling owns the task count.\nconst apiService = new ecs.FargateService(stack, \"ApiService\", {\n  cluster,\n  taskDefinition: taskDef,\n});\n\nconst scaling = apiService.autoScaleTaskCount({\n  minCapacity: cfg.minTasks,\n  maxCapacity: cfg.maxTasks,\n});\n\n// Target tracking: keep average CPU near 60%. Out fast, in slow.\nscaling.scaleOnCpuUtilization(\"Cpu\", {\n  targetUtilizationPercent: 60,\n  scaleOutCooldown: Duration.seconds(60),\n  scaleInCooldown: Duration.seconds(300),\n});\n\n// Scheduled: raise the minimum before a sale, restore it afterwards (UTC).\nscaling.scaleOnSchedule(\"SalePrewarm\", {\n  schedule: appscaling.Schedule.cron({ hour: \"8\", minute: \"45\" }),\n  minCapacity: 60,\n});\nscaling.scaleOnSchedule(\"SaleEnd\", {\n  schedule: appscaling.Schedule.cron({ hour: \"12\", minute: \"0\" }),\n  minCapacity: cfg.minTasks,\n});\n\nconst template = Template.fromStack(stack);\ntemplate.resourceCountIs(\"AWS::ApplicationAutoScaling::ScalingPolicy\", 1);\ntemplate.hasResourceProperties(\"AWS::ApplicationAutoScaling::ScalableTarget\", {\n  MinCapacity: 20,\n  MaxCapacity: 120,\n  ScheduledActions: Match.arrayWith([\n    Match.objectLike({ ScalableTargetAction: { MinCapacity: 60 } }),\n  ]),\n});\nconsole.log(\"assertions passed\");",
          "output": "assertions passed",
          "explanation": "Run it with `bun run scaling-demo.ts` from a folder where `bun add aws-cdk-lib constructs` has been run. It builds a small stack in memory (no AWS account is touched) and checks the generated CloudFormation. `cfg` stands in for the per-environment config from topic 7. There is exactly one scaling policy (the CPU one), and the scalable target carries min 20, max 120 and the scheduled action that raises the minimum to 60. The two cooldowns differ on purpose: 60 seconds out, 300 seconds in."
        }
      ],
      "productionNote": "Use target tracking as the base policy for both the api and web services, and add scheduled actions only for peaks you can predict. Always set a minimum that can absorb a sudden spike on its own, because new Fargate tasks take a minute or more to start and pass health checks. Pick the metric that matches the bottleneck (the part of the system that runs out of capacity first). A Bun API doing JSON work is CPU-bound, meaning its speed is limited by the processor rather than memory, so CPU is a better signal than memory.",
      "commonMistakes": [
        "Leaving minCapacity at the default of 1 in production, so one task failure or a sudden spike leaves almost no capacity while new tasks are still starting.",
        "Using the same cooldown for scale out and scale in, which makes the service flap (add, remove, add...). Scale out quickly (for example 60 s) and in slowly (for example 300 s).",
        "Scaling on memory for a CPU-bound Bun API. Memory usually stays flat while CPU saturates, so the policy never reacts.",
        "Setting desiredCount in the stack as well as using auto scaling, so each deploy resets the task count."
      ],
      "sources": [
        { "title": "AWS CDK: ScalableTaskCount", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.ScalableTaskCount.html" },
        { "title": "AWS CDK: CpuUtilizationScalingProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.CpuUtilizationScalingProps.html" },
        { "title": "Amazon ECS: Automatically scale your Amazon ECS service", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html" }
      ]
    },
    {
      "id": "request-count-per-target-scaling",
      "title": "Request count per target scaling",
      "explanation": "CPU is a symptom: it rises after the load has already arrived. A second signal is the load itself. The ALB (topic 10) publishes a metric called RequestCountPerTarget: how many requests each healthy target (here, each task) received in a period of one minute. Target tracking on it says: keep each task at about N requests per minute, and add tasks when the average goes above that.\n\nIn CDK you write `scaling.scaleOnRequestCount(id, { requestsPerTarget, targetGroup })`. Both properties are required. The units are the trap: `requestsPerTarget` is per minute, not per second.\n\nWork it out like this. Suppose one task handles 5,000 requests per second (RPS, from topic 1). You do not want tasks at 100% busy, so you aim for 70%, which leaves headroom (topic 1). That gives 5,000 x 0.70 = 3,500 RPS per task. Multiply by 60 seconds to get the per-minute value: 3,500 x 60 = 210,000 requests per task per minute. Typing 3,500 would tell AWS each task should only see 3,500 requests a minute, about 58 per second, so it would run roughly 60 times too many tasks.\n\nThe same sum gives the number of tasks for a given load: at 250,000 RPS you need 250,000 / 3,500 = 71.4, rounded up to 72 tasks. Check that 72 fits under your maxCapacity.\n\nYou can attach several policies to one scaling object, for example request count and CPU. Scale out happens if any policy asks for more tasks. Scale in happens only when all policies agree that fewer tasks are enough. That makes the combination safe: request count catches traffic growth, CPU catches expensive requests.\n\nTwo cautions. Your minimum task count must cover a sudden spike on its own, because scaling reacts after the metric moves and new tasks need time to start. And request count suits an API where each request costs about the same; a server-side rendered web app (SSR, where the server builds the HTML) is CPU-bound, so scale it on CPU instead.",
      "analogy": "One cashier per 30 customers an hour. Instead of watching how sweaty the cashiers look (CPU), you count customers per cashier and call in another cashier when the count passes 30. The unit matters: if the rule says 30 per hour but you write 30 per minute, you hire 60 times too many cashiers.",
      "code": [
        {
          "language": "typescript",
          "filename": "rpt.ts",
          "source": "const perTaskRps = 5000; // requests per second one task can handle (illustrative)\nconst targetPercent = 70; // keep tasks at 70% of that\n\nconst targetRps = (perTaskRps * targetPercent) / 100;\nconsole.log(\"per second:\", targetRps);\nconsole.log(\"requestsPerTarget (per minute):\", targetRps * 60);\n\nconst loadRps = 250000;\nconsole.log(\"tasks at 250000 RPS:\", Math.ceil(loadRps / targetRps));",
          "output": "per second: 3500\nrequestsPerTarget (per minute): 210000\ntasks at 250000 RPS: 72",
          "explanation": "Run with `bun run rpt.ts`. The per-second value is 3,500 and the value you give AWS is 210,000. The last line rounds 71.4 up with `Math.ceil`, since you cannot run 0.4 of a task. Treat 5,000 RPS per task as a guess until the k6 load test (topic 20) measures it."
        },
        {
          "language": "typescript",
          "filename": "rps-scaling-demo.ts",
          "source": "import { App, Duration, Stack } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport * as ecs from \"aws-cdk-lib/aws-ecs\";\nimport * as elbv2 from \"aws-cdk-lib/aws-elasticloadbalancingv2\";\nimport { Template } from \"aws-cdk-lib/assertions\";\n\nconst app = new App();\nconst stack = new Stack(app, \"ApiRpsDemo\");\nconst vpc = new ec2.Vpc(stack, \"Vpc\", { maxAzs: 2 });\nconst cluster = new ecs.Cluster(stack, \"Cluster\", { vpc });\n\nconst taskDef = new ecs.FargateTaskDefinition(stack, \"ApiTask\", {\n  cpu: 2048,\n  memoryLimitMiB: 4096,\n});\ntaskDef.addContainer(\"api\", {\n  image: ecs.ContainerImage.fromRegistry(\"oven/bun:1\"),\n  portMappings: [{ containerPort: 3000 }],\n});\nconst apiService = new ecs.FargateService(stack, \"ApiService\", {\n  cluster,\n  taskDefinition: taskDef,\n});\n\nconst alb = new elbv2.ApplicationLoadBalancer(stack, \"Alb\", { vpc, internetFacing: true });\nconst listener = alb.addListener(\"Http\", { port: 80 });\nconst apiTg = listener.addTargets(\"Api\", {\n  port: 3000,\n  protocol: elbv2.ApplicationProtocol.HTTP,\n  targets: [apiService],\n});\n\nconst scaling = apiService.autoScaleTaskCount({ minCapacity: 20, maxCapacity: 120 });\nscaling.scaleOnRequestCount(\"Rps\", {\n  requestsPerTarget: 210_000, // per MINUTE, not per second\n  targetGroup: apiTg,\n  scaleOutCooldown: Duration.seconds(60),\n  scaleInCooldown: Duration.seconds(300),\n});\nscaling.scaleOnCpuUtilization(\"Cpu\", { targetUtilizationPercent: 60 });\n\nconst template = Template.fromStack(stack);\ntemplate.resourceCountIs(\"AWS::ApplicationAutoScaling::ScalingPolicy\", 2);\ntemplate.hasResourceProperties(\"AWS::ApplicationAutoScaling::ScalingPolicy\", {\n  TargetTrackingScalingPolicyConfiguration: {\n    TargetValue: 210000,\n    PredefinedMetricSpecification: { PredefinedMetricType: \"ALBRequestCountPerTarget\" },\n  },\n});\nconsole.log(\"assertions passed\");",
          "output": "assertions passed",
          "explanation": "The service is registered as a target of the ALB listener (`listener.addTargets` returns the target group). `scaleOnRequestCount` then tracks the ALB metric for that group. A CPU policy sits beside it, so the stack has two scaling policies, and the test checks the 210,000 value reached CloudFormation unchanged."
        }
      ],
      "productionNote": "Request count per target is the main scaling signal for the API, with CPU as a safety net. Recompute requestsPerTarget whenever you change the task size or after a load test gives a real per-task capacity. Keep minCapacity high enough that a sudden spike is served while new tasks are launching.",
      "commonMistakes": [
        "Entering the per-second number (3,500) instead of the per-minute number (210,000). AWS would then see every task as permanently overloaded and scale to your maximum.",
        "Scaling a CPU-bound server-side rendered web service on request count. Page cost varies a lot, so use CPU there.",
        "Assuming scaling is instant. New tasks need time to start and pass health checks, so the minimum must cover a sudden spike by itself.",
        "Choosing the per-task capacity without measuring. Treat 5,000 RPS as a placeholder until the load test."
      ],
      "sources": [
        { "title": "AWS CDK: RequestCountScalingProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.RequestCountScalingProps.html" },
        { "title": "Application Load Balancer CloudWatch metrics", "url": "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html" },
        { "title": "Amazon ECS: Target tracking scaling policies", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-autoscaling-targettracking.html" }
      ]
    },
    {
      "id": "task-sizing-and-bun-multi-core",
      "title": "Task sizing and Bun multi-core",
      "explanation": "A Fargate task has a size: a number of vCPUs (virtual CPU cores, the units that run your code at the same time) and an amount of memory. Only certain pairs are allowed. For example, 2 vCPU (written cpu: 2048 in CDK) takes 4 to 16 GiB (gibibytes, a unit of memory) of memory. Fargate Linux tasks go up to 32 vCPU on platform version 1.4.0 or newer (8 vCPU and above need it).\n\nBigger tasks use fewer network interfaces and IP addresses, but losing one task removes more capacity (a bigger blast radius, meaning the amount of service one failure takes down). Small tasks spread risk but waste more on per-task overhead. 1 to 4 vCPU is a good default.\n\nHere is the catch for Bun. One Bun process runs your JavaScript mostly on one CPU core. On a 2 vCPU task, one process leaves about half the CPU idle, and on 4 vCPU it leaves three quarters idle. CPU-based scaling then thinks the task is fine while the one busy core is saturated.\n\nThe fix is to run one process per vCPU, all listening on the same port. Normally the operating system refuses a second process on a port in use (you met EADDRINUSE in topic 2). Setting `reusePort: true` in `Bun.serve` turns on a Linux feature called SO_REUSEPORT, which lets several processes bind the same port while the kernel (the core of the operating system) shares new connections between them. Fargate runs Linux, so it works there.\n\nA small launcher file, `start.ts`, starts N child processes with `Bun.spawn` (a Bun function that starts another program as a child process). It reads N from a `WORKERS` environment variable. Bun's `node:cluster` module (Node's built-in way to run several worker processes, which Bun supports only partly) is listed as partly implemented and not battle-tested, so prefer this approach.\n\nThe launcher is the container's main process, so it receives SIGTERM (topic 6) when ECS stops the task. It must pass the signal on to the children, or they would be killed hard without finishing in-flight requests. It also stops everything if any child dies, so ECS replaces the whole task instead of running at half capacity. Each worker also needs its own SIGTERM handler that stops the server gracefully.\n\nWatch your database budget. Each process has its own connection pool (topic 12), so connections = pool max x workers x tasks. With a pool max of 10, two workers and 120 tasks that is 2,400 connections.",
      "analogy": "One kitchen with two cooks sharing the same order window. The window hands each new order to whichever cook is free, so both cooks stay busy. With one cook in a two-cook kitchen, half the stoves stay cold however long the queue grows.",
      "code": [
        {
          "language": "typescript",
          "filename": "index.ts",
          "source": "const workerId = process.env.WORKER_ID ?? \"0\";\n\nconst server = Bun.serve({\n  port: 3000,\n  reusePort: true, // let several processes share port 3000 (Linux SO_REUSEPORT)\n  fetch() {\n    return new Response(`hello from worker ${workerId}\\n`);\n  },\n});\n\nprocess.on(\"SIGTERM\", async () => {\n  await server.stop(); // finish in-flight requests, then stop\n  process.exit(0);\n});",
          "output": "",
          "explanation": "This is one worker: a normal Bun server, with `reusePort: true` as the only multi-core change. `WORKER_ID` is set by the launcher so you can tell the workers apart. It prints nothing when it starts."
        },
        {
          "language": "typescript",
          "filename": "start.ts",
          "source": "const n = Number(process.env.WORKERS ?? 2);\n\nconst kids = Array.from({ length: n }, (_, i) =>\n  Bun.spawn([\"bun\", \"run\", \"index.ts\"], {\n    stdout: \"inherit\",\n    stderr: \"inherit\",\n    env: { ...process.env, WORKER_ID: String(i) },\n  }),\n);\nconsole.log(`launcher: started ${n} workers`);\n\n// ECS sends SIGTERM to this process: pass it on to every worker.\nprocess.on(\"SIGTERM\", () => {\n  for (const k of kids) k.kill(\"SIGTERM\");\n});\n\n// If any worker exits, stop the others and exit so ECS replaces the task.\nconst firstExit = await Promise.race(kids.map((k) => k.exited));\nfor (const k of kids) k.kill(\"SIGTERM\");\nawait Promise.all(kids.map((k) => k.exited));\nprocess.exit(firstExit);",
          "output": "launcher: started 2 workers",
          "explanation": "Run it with `bun run start.ts` from the folder holding both files. `Array.from({ length: n }, ...)` builds n children, each given `WORKER_ID` 0, 1, ... The launcher prints one line and then waits. With the default of 2 workers, requests to port 3000 are answered by worker 0 or worker 1, chosen by the kernel. On a 4 vCPU task you set `WORKERS=4`. `k.exited` is a promise that resolves with the child's exit code."
        },
        {
          "language": "docker",
          "filename": "Dockerfile",
          "source": "FROM oven/bun:1\nWORKDIR /usr/src/app\nCOPY index.ts start.ts ./\nENV WORKERS=2\nUSER bun\nEXPOSE 3000\nCMD [\"bun\", \"run\", \"start.ts\"]",
          "output": "",
          "explanation": "The container's main command is the launcher, not the server. Set WORKERS to the task's vCPU count; in CDK you would pass it with the container's `environment` option. After scaling to multiple workers, Container Insights (topic 18) CPU for the task can rise well above 50% on a 2 vCPU task."
        }
      ],
      "productionNote": "Use WORKERS equal to the task's vCPU count and keep the launcher as the container CMD. Remember that pool size x workers x tasks must stay under the database connection budget (topic 12). Confirm the real per-task throughput with the load test (topic 20), then recompute requestsPerTarget.",
      "commonMistakes": [
        "Running a 4 vCPU task with a single Bun process, leaving about 75% of the CPU idle and CPU-based scaling blind to the saturated core.",
        "Forgetting to forward SIGTERM from the launcher to the workers, so they are killed hard and in-flight requests fail on every deploy.",
        "Multiplying workers without recalculating the database pool: pool max x workers x tasks can exceed max_connections.",
        "Relying on node:cluster in Bun for HTTP balancing instead of reusePort."
      ],
      "sources": [
        { "title": "Bun: Bun.serve types (reusePort)", "url": "https://github.com/oven-sh/bun/blob/main/packages/bun-types/serve.d.ts" },
        { "title": "Bun: Spawn a child process", "url": "https://bun.com/docs/runtime/child-process" },
        { "title": "Bun: Node.js compatibility (node:cluster)", "url": "https://bun.com/docs/runtime/nodejs-compat" },
        { "title": "AWS CDK: FargateTaskDefinition (valid cpu/memory pairs)", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateTaskDefinition.html" }
      ]
    },
    {
      "id": "aurora-replica-auto-scaling",
      "title": "Aurora replica auto scaling",
      "explanation": "When your API scales out, reads on the database grow too. Aurora can add and remove reader instances (replicas that serve read-only queries, topic 11) automatically. It uses the same Application Auto Scaling service as ECS, so the model is the same: a scalable target with a minimum and maximum, and a target tracking policy.\n\nThe rules: the number of readers can range from 0 to 15, and the cluster must keep at least one reader for auto scaling to work. Aurora measures the average over all readers (the writer is excluded), either reader CPU utilisation or reader connections. A new reader has the same instance class as the writer (primary) instance and promotion tier 15 (the lowest priority to become the writer in a failover). The default cooldown is 300 seconds. Auto scaling is not supported for the secondary clusters of an Aurora Global Database (topic 22).\n\nIn CDK there is no helper for this, so you describe the target yourself: `new appscaling.ScalableTarget(...)` with `serviceNamespace: RDS`, the dimension `rds:cluster:ReadReplicaCount`, and a `resourceId` of `cluster:` followed by the cluster identifier. Then `scaleToTrackMetric` attaches the policy, with `PredefinedMetric.RDS_READER_AVERAGE_CPU_UTILIZATION` as the metric and 60 as the target percent.\n\nA new reader takes minutes to appear and warm up, so auto scaling cannot answer a sudden spike. Caching (topic 14) is the first defence, and replicas are the second. Do not use extra readers to hide slow queries: fix the query or add an index first.\n\nAlso set the maximum within your budget. Each reader adds connections that RDS Proxy (topic 12) and connection limits must handle.",
      "analogy": "Hiring temporary library assistants during exam season. They take a while to arrive, so you also keep the popular books on the front desk (the cache). Assistants help with steady growth, not with the first five minutes of a stampede.",
      "code": [
        {
          "language": "typescript",
          "filename": "reader-scaling-demo.ts",
          "source": "import { App, Stack } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport * as rds from \"aws-cdk-lib/aws-rds\";\nimport * as appscaling from \"aws-cdk-lib/aws-applicationautoscaling\";\nimport { Template } from \"aws-cdk-lib/assertions\";\n\nconst app = new App();\nconst stack = new Stack(app, \"ReaderScalingDemo\");\nconst vpc = new ec2.Vpc(stack, \"Vpc\", { maxAzs: 2 });\n\nconst instanceType = ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.LARGE);\nconst cluster = new rds.DatabaseCluster(stack, \"Db\", {\n  engine: rds.DatabaseClusterEngine.auroraPostgres({\n    version: rds.AuroraPostgresEngineVersion.VER_17_7,\n  }),\n  vpc,\n  writer: rds.ClusterInstance.provisioned(\"Writer\", { instanceType }),\n  readers: [\n    rds.ClusterInstance.provisioned(\"Reader1\", { instanceType }),\n    rds.ClusterInstance.provisioned(\"Reader2\", { instanceType }),\n  ],\n});\n\nconst readers = new appscaling.ScalableTarget(stack, \"ReaderScaling\", {\n  serviceNamespace: appscaling.ServiceNamespace.RDS,\n  scalableDimension: \"rds:cluster:ReadReplicaCount\",\n  resourceId: `cluster:${cluster.clusterIdentifier}`,\n  minCapacity: 2, // matches the two readers declared above\n  maxCapacity: 8,\n});\nreaders.scaleToTrackMetric(\"ReaderCpu\", {\n  targetValue: 60,\n  predefinedMetric: appscaling.PredefinedMetric.RDS_READER_AVERAGE_CPU_UTILIZATION,\n});\n\nTemplate.fromStack(stack).hasResourceProperties(\"AWS::ApplicationAutoScaling::ScalableTarget\", {\n  ScalableDimension: \"rds:cluster:ReadReplicaCount\",\n  MaxCapacity: 8,\n});\nconsole.log(\"assertions passed\");",
          "output": "assertions passed",
          "explanation": "The cluster declares a writer and two readers. The ScalableTarget lets Aurora grow the reader count between 2 and 8, adding a reader when average reader CPU stays above 60%. The check confirms the scalable dimension and the maximum made it into the template."
        }
      ],
      "productionNote": "Reader auto scaling is for read spikes such as flash sales. Keep the minimum at two or more readers across availability zones, set the maximum to what your connection budget supports, and keep a cache in front of the readers. Never set the minimum to 0 if you use a read-only RDS Proxy endpoint, because that endpoint needs at least one reader.",
      "commonMistakes": [
        "Setting a maximum larger than the proxy or reader connection budget allows.",
        "Adding readers to cover for slow queries instead of fixing the queries or adding indexes.",
        "Setting minCapacity to 0. A read-only proxy endpoint needs at least one reader, or requests to it fail.",
        "Expecting a new reader within seconds. It takes minutes, so caching must absorb the first part of a spike."
      ],
      "sources": [
        { "title": "Aurora: Amazon Aurora Auto Scaling with Aurora Replicas", "url": "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Integrating.AutoScaling.html" },
        { "title": "AWS CDK: ScalableTarget", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_applicationautoscaling.ScalableTarget.html" },
        { "title": "AWS CDK: PredefinedMetric", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_applicationautoscaling.PredefinedMetric.html" }
      ]
    },
    {
      "id": "service-quotas-and-capacity-planning",
      "title": "Service quotas and capacity planning",
      "explanation": "A service quota is a limit AWS puts on your account in each region, for example how many Fargate vCPUs you may run at once. Auto scaling can only add tasks while you are under the quota. When you hit it, new tasks silently fail to launch, and that usually happens at the worst moment, during a traffic spike.\n\nThe default Fargate On-Demand quota is 6 vCPUs per region, and Fargate Spot has a separate 6 vCPU quota. New accounts may start lower. Your plan needs far more: 120 tasks x 2 vCPU = 240 vCPU in steady state. A rolling deploy (topic 17) runs old and new tasks together, so allow a factor of 2 while deploying: 480 vCPU. Staging needs quota too, because load tests (topic 20) run many tasks.\n\nAWS also limits how fast tasks can launch. The Fargate On-Demand burst rate is 100 tasks and the sustained rate is 20 tasks per second (5 in regions added after 20 May 2025). A single service can launch 500 tasks per minute (125 in those newer regions). A service may have at most 5,000 tasks. Scaling from 20 to 120 tasks is within the burst, but huge jumps are not instant.\n\nVCPU is not the only limit. Before launch, also check the ALB (target and rule limits), NAT gateways, Aurora connections (topic 12), and ElastiCache node capacity (topic 14).\n\nYou view and request increases in the Service Quotas console or with the AWS CLI (topic 3). Increase requests are reviewed by AWS and can take days, so file them weeks before launch.",
      "analogy": "Booking enough seats at a venue before selling tickets. The venue sets the fire limit, not you, and the venue's office needs days to approve a bigger hall. You ask early, not when the queue is already at the door.",
      "code": [
        {
          "language": "typescript",
          "filename": "quota.ts",
          "source": "const maxTasks = 120;\nconst vcpu = 2;\nconst deployFactor = 2; // old + new tasks run together during a rolling deploy\n\nconsole.log(\"steady vCPU:\", maxTasks * vcpu);\nconsole.log(\"during deploy:\", maxTasks * vcpu * deployFactor);",
          "output": "steady vCPU: 240\nduring deploy: 480",
          "explanation": "Run with `bun run quota.ts`. The second number is the one to put in the quota request. Do the same sum for Spot tasks, because their quota is counted separately."
        },
        {
          "language": "bash",
          "filename": "check-quota.sh",
          "source": "aws service-quotas list-service-quotas --service-code fargate --query \"Quotas[].[QuotaName,Value]\" --output text",
          "output": "Fargate On-Demand vCPU resource count\t6.0",
          "explanation": "The command lists every Fargate quota and its current value for your account and region. The output is abbreviated to one representative row; the number depends on your account, and further rows (for example the Spot quota) follow."
        }
      ],
      "productionNote": "Treat quota review as a launch checklist item, per account and per region. Staging and production accounts each need their own increases, and the vCPU figure must include deploy overlap. File requests weeks ahead.",
      "commonMistakes": [
        "Discovering the quota only during the launch-day spike, when tasks fail to start.",
        "Forgetting that staging needs quota for load tests.",
        "Not counting the doubling during deploys, so a deploy at peak hits the limit.",
        "Checking only Fargate vCPU and forgetting ALB, NAT, Aurora connection and cache limits."
      ],
      "sources": [
        { "title": "Amazon ECS endpoints and quotas", "url": "https://docs.aws.amazon.com/general/latest/gr/ecs-service.html" },
        { "title": "Service Quotas: Request a quota increase", "url": "https://docs.aws.amazon.com/servicequotas/latest/userguide/request-quota-increase.html" },
        { "title": "AWS CLI: service-quotas list-service-quotas", "url": "https://docs.aws.amazon.com/cli/latest/reference/service-quotas/list-service-quotas.html" }
      ]
    },
    {
      "id": "fargate-spot",
      "title": "Fargate Spot",
      "explanation": "Fargate Spot runs your tasks on spare AWS capacity at a discount. The catch: AWS can take that capacity back, and then your task is stopped after a short warning (about two minutes). Your process receives SIGTERM (topic 6) first, so graceful shutdown matters. A task that is interrupted is simply replaced by the service.\n\nTo use it, turn on capacity providers (named sources of Fargate capacity: FARGATE for On-Demand, FARGATE_SPOT for Spot). In CDK, set `enableFargateCapacityProviders: true` on the cluster. Then give the service a `capacityProviderStrategies` list, where each entry has a provider and a weight. Weights split tasks in proportion: FARGATE weight 1 and FARGATE_SPOT weight 2 means about one third On-Demand and two thirds Spot, so 30 tasks become roughly 10 and 20. An entry may also have a `base`, the number of tasks that always go to that provider first.\n\nSpot suits work that can be interrupted without harm: extra web (SSR) capacity, k6 load-test machines (topic 20; a load test sends artificial traffic to your app), and dev environments. Keep the minimum capacity of the main API on On-Demand. The cost effect is covered in topic 23.\n\nThe Spot vCPU quota is separate from On-Demand and also defaults to 6.",
      "analogy": "Standby airline tickets. They are cheap, but you may be bumped off the flight. That is fine for a flexible trip, but you would never seat the pilot on a standby ticket.",
      "code": [
        {
          "language": "typescript",
          "filename": "spot-demo.ts",
          "source": "import { App, Stack } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport * as ecs from \"aws-cdk-lib/aws-ecs\";\nimport { Template } from \"aws-cdk-lib/assertions\";\n\nconst app = new App();\nconst stack = new Stack(app, \"SpotDemo\");\nconst vpc = new ec2.Vpc(stack, \"Vpc\", { maxAzs: 2 });\nconst cluster = new ecs.Cluster(stack, \"Cluster\", {\n  vpc,\n  enableFargateCapacityProviders: true, // required for FARGATE / FARGATE_SPOT strategies\n});\n\nconst taskDef = new ecs.FargateTaskDefinition(stack, \"WebTask\", {\n  cpu: 1024,\n  memoryLimitMiB: 2048,\n});\ntaskDef.addContainer(\"web\", {\n  image: ecs.ContainerImage.fromRegistry(\"oven/bun:1\"),\n  portMappings: [{ containerPort: 3000 }],\n});\n\nnew ecs.FargateService(stack, \"WebService\", {\n  cluster,\n  taskDefinition: taskDef,\n  capacityProviderStrategies: [\n    { capacityProvider: \"FARGATE\", weight: 1 },\n    { capacityProvider: \"FARGATE_SPOT\", weight: 2 },\n  ],\n});\n\nconst template = Template.fromStack(stack);\ntemplate.resourceCountIs(\"AWS::ECS::ClusterCapacityProviderAssociations\", 1);\ntemplate.hasResourceProperties(\"AWS::ECS::Service\", {\n  CapacityProviderStrategy: [\n    { CapacityProvider: \"FARGATE\", Weight: 1 },\n    { CapacityProvider: \"FARGATE_SPOT\", Weight: 2 },\n  ],\n});\nconsole.log(\"assertions passed\");",
          "output": "assertions passed",
          "explanation": "The cluster enables both providers, and the web service splits its tasks 1 : 2 between On-Demand and Spot. The test checks that the strategy reached the template. Combine this with the auto scaling from the first sub-topic: the scaled-out tasks follow the same 1 : 2 split."
        }
      ],
      "productionNote": "Use Spot to cut cost on extra web capacity, load generators and dev, never as the only capacity for the core API. Make sure every service handles SIGTERM gracefully, and request Spot vCPU quota separately.",
      "commonMistakes": [
        "Running the whole production API on Spot, so a capacity reclaim can remove many tasks at once.",
        "Forgetting enableFargateCapacityProviders on the cluster, so the strategy has no providers to use.",
        "Forgetting that the Spot vCPU quota is separate and defaults to 6.",
        "Ignoring SIGTERM, so interrupted tasks drop in-flight requests."
      ],
      "sources": [
        { "title": "Amazon ECS: Fargate capacity providers", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-capacity-providers.html" },
        { "title": "AWS CDK: ClusterProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.ClusterProps.html" },
        { "title": "AWS CDK: FargateServiceProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateServiceProps.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "One task can handle 4,000 requests per second and you want it at 75% of that. What do you put in requestsPerTarget for scaleOnRequestCount?",
      "options": ["12,000", "180,000", "4,000", "75"],
      "answerIndex": 1,
      "explanation": "4,000 x 0.75 = 3,000 requests per second, and the ALB metric counts requests per target per minute, so multiply by 60 to get 180,000. The per-second value 3,000 would cause massive over-scaling."
    },
    {
      "question": "Why run two Bun processes on a 2 vCPU task, and which Bun.serve option lets them share port 3000?",
      "options": [
        "One Bun process mostly uses one core, so two processes use both vCPUs; reusePort: true lets them share the port",
        "Bun refuses to start with more than one vCPU unless two processes run; the option is hostname",
        "Two processes double the memory limit; the option is idleTimeout",
        "Two processes make the load balancer faster; the option is development"
      ],
      "answerIndex": 0,
      "explanation": "A single Bun process runs JavaScript on about one core, leaving the other vCPU idle. `reusePort: true` sets SO_REUSEPORT so several processes can listen on the same port and the Linux kernel spreads connections between them."
    },
    {
      "question": "You plan 80 tasks of 4 vCPU each. How many Fargate On-Demand vCPUs does the steady state need in your quota (ignoring deploys)?",
      "options": ["80", "160", "320", "640"],
      "answerIndex": 2,
      "explanation": "80 tasks x 4 vCPU = 320 vCPU. During a rolling deploy old and new tasks overlap, so you would also plan for roughly double that."
    },
    {
      "question": "Why should you not run the whole production API on Fargate Spot?",
      "options": [
        "Spot tasks cannot connect to Aurora",
        "Spot tasks cannot use an ALB",
        "Spot tasks cannot run Bun",
        "AWS can reclaim Spot capacity and stop tasks, so many tasks could disappear at once"
      ],
      "answerIndex": 3,
      "explanation": "Spot is spare capacity that AWS can take back, sending SIGTERM to the tasks. That is fine for extra capacity, but the core API's minimum should stay on On-Demand."
    },
    {
      "question": "Your RDS Proxy has a read-only endpoint. Why must the Aurora reader auto scaling minimum stay at 1 or more?",
      "options": [
        "Because the writer cannot handle any queries once auto scaling is on",
        "Because the read-only endpoint needs at least one reader instance, otherwise requests to it fail",
        "Because a minimum of 0 makes Aurora delete the cluster",
        "Because auto scaling is billed per reader below the minimum"
      ],
      "answerIndex": 1,
      "explanation": "A read-only proxy endpoint routes to readers. With zero readers there is nothing to serve it, and requests to that endpoint error. Aurora auto scaling also requires at least one reader to exist."
    }
  ]
});
