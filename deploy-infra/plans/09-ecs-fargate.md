# 09. ECS on Fargate
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 05-docker-containers, 06-app-production-readiness, 08-vpc-networking

ARM64 (Graviton) tasks throughout; images built `--platform linux/arm64`. ALB wiring is topic 10 — here services run without LB first.

## Learning goals
- Learner can explain cluster, task definition, task and service.
- Learner can create an ECR repo and push a SHA-tagged image.
- Learner can tell task role from execution role and grant each correctly.
- Learner can inject secrets from Secrets Manager/SSM as env vars.
- Learner can ship container logs to CloudWatch and define a Fargate service in CDK.

## Sub-topics
### Clusters, task definitions and services
- Concept: ECS = AWS's container orchestrator. Cluster = logical group. Task definition = recipe (image, CPU/memory, ports, env, roles, logging); versions = revisions. Task = running copy. Service = keeps N tasks running, replaces failures, rolls deployments, registers with LB. Fargate = AWS runs the servers; you pick valid CPU/memory pairs (e.g. 2048 CPU units = 2 vCPU with 4096–16384 MiB).
- Analogy: franchise HQ: task definition = the franchise manual, task = one open shop, service = the regional manager who ensures 20 shops are always open and replaces any that close.
- Code example: `aws ecs describe-services --cluster shop --services shop-api --query "services[0].[desiredCount,runningCount]" --output text --profile shop-dev` → `2	2` once stable.
- Production use: two services: shop-api, shop-web; one-off migration tasks (topic 13).
- Common mistakes: invalid CPU/memory combo (deploy error); running single task in prod; confusing task definition revision with image tag.
- Sources: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateTaskDefinition.html

### ECR repositories and image push
- Concept: ECR = private registry per account. Repo props: imageScanOnPush (default false → set true), imageTagMutability IMMUTABLE (same tag can't be overwritten), lifecycleRules (keep last N; exactly one of maxImageCount/maxImageAge), removalPolicy default Retain. Push: authenticate docker, tag with full repo URI, push.
- Analogy: a locked warehouse with numbered shelves; IMMUTABLE = once shelf "3f2a1c9" is filled it's sealed; lifecycle = a cleaner discarding all but the newest 50 boxes.
- Code example: CDK `const repo = new ecr.Repository(this, "ApiRepo", { repositoryName: "shop-api", imageScanOnPush: true, imageTagMutability: ecr.TagMutability.IMMUTABLE, lifecycleRules: [{ maxImageCount: 50 }] });` Push: `aws ecr get-login-password --region us-east-1 --profile shop-dev | docker login --username AWS --password-stdin 111111111111.dkr.ecr.us-east-1.amazonaws.com` → `Login Succeeded`; `docker tag shop-api:3f2a1c9 111111111111.dkr.ecr.us-east-1.amazonaws.com/shop-api:3f2a1c9`; `docker push 111111111111.dkr.ecr.us-east-1.amazonaws.com/shop-api:3f2a1c9` → ends `3f2a1c9: digest: sha256:... size: ...`.
- Production use: pipeline pushes per commit (topic 17).
- Common mistakes: MUTABLE + `latest`; no lifecycle (storage cost grows); pushing x86 image for ARM64 tasks.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecr.RepositoryProps.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecr.LifecycleRule.html ; https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-push-ecr-image.html

### Task role vs execution role
- Concept: execution role = used by ECS agent before/around your app: pull image from ECR, write logs, fetch secrets for injection. Task role = used by your app code at runtime for AWS API calls (S3, RDS Proxy IAM auth, X-Ray). CDK auto-creates both; grant methods attach the right one (`repo.grantPull(executionRole)` implicit; `bucket.grantRead(taskDef.taskRole)`).
- Analogy: delivery company vs shop clerk. Execution role = the delivery driver who brings stock and paperwork to the shop before opening; task role = the clerk's keycard used during the day.
- Code example: `const taskDef = new ecs.FargateTaskDefinition(this, "ApiTask", { cpu: 2048, memoryLimitMiB: 4096, runtimePlatform: { cpuArchitecture: ecs.CpuArchitecture.ARM64, operatingSystemFamily: ecs.OperatingSystemFamily.LINUX } }); assetsBucket.grantRead(taskDef.taskRole);` Assertion: IAM policy attached to task role contains `s3:GetObject*` (use `Match.arrayWith`) — state "the generated policy lists s3:GetObject* among actions".
- Production use: least privilege per service (topic 21).
- Common mistakes: granting app permissions to execution role (app can't use them); secrets fetch failing because execution role lacks access to the secret/KMS key; one shared role for all services.
- Sources: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateTaskDefinition.html

### Secrets from Secrets Manager and SSM
- Concept: never bake secrets into images or plain `environment`. Container `secrets` map: `ecs.Secret.fromSecretsManager(secret, "password")` (one JSON field) or `ecs.Secret.fromSsmParameter(param)`; values injected as env vars at task start (rotation needs new tasks to pick up). Non-secret config in `environment`.
- Analogy: a sealed envelope handed to the employee at the door each morning, instead of writing the safe code on the wall.
- Code example: `taskDef.addContainer("api", { image: ecs.ContainerImage.fromEcrRepository(repo, props.imageTag), portMappings: [{ containerPort: 3000 }], environment: { NODE_ENV: "production", APP_ENV: props.envName, DB_HOST: proxy.endpoint, DB_NAME: "shop" }, secrets: { DB_USER: ecs.Secret.fromSecretsManager(dbSecret, "username"), DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, "password"), REDIS_AUTH: ecs.Secret.fromSecretsManager(cacheSecret) } });` App builds URL from parts (topic 11). `aws ecs describe-task-definition --task-definition shop-api --query "taskDefinition.containerDefinitions[0].secrets[].name"` → `["DB_USER","DB_PASSWORD","REDIS_AUTH"]` (order as defined).
- Production use: DB creds (topic 11), Valkey auth token (topic 14).
- Common mistakes: secrets in `environment` (visible in console); expecting running tasks to see a rotated value; missing KMS decrypt for customer-managed keys.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.Secret.html ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data-secrets.html

### Container logs to CloudWatch
- Concept: awslogs driver sends stdout/stderr to a CloudWatch log group; `streamPrefix` required; set retention (default never expires → cost). mode default BLOCKING (app blocks if logs back up); NON_BLOCKING with buffer trades possible log loss for availability at high RPS.
- Analogy: a pneumatic tube sending every receipt from the till to head office; blocking = the till waits if the tube jams.
- Code example: `logging: ecs.LogDrivers.awsLogs({ streamPrefix: "api", logGroup: new logs.LogGroup(this, "ApiLogs", { retention: logs.RetentionDays.ONE_MONTH }), mode: ecs.AwsLogDriverMode.NON_BLOCKING })`; `aws logs tail /aws/ecs/... --follow` shows JSON lines from topic 06 (e.g. `{"level":"info","msg":"listening","port":3000,...}`). Use explicit log group name `shop-api` to make the tail command exact: `aws logs tail shop-api --since 5m`.
- Production use: Logs Insights queries and alarms (topic 18).
- Common mistakes: infinite retention; BLOCKING at high log volume causing latency; logging per request at 250K RPS.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.AwsLogDriverProps.html ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_awslogs.html ; https://docs.aws.amazon.com/cli/latest/reference/logs/tail.html

### Fargate services in CDK
- Concept: `new ecs.Cluster(this, "Cluster", { vpc, clusterName: "shop", containerInsightsV2: ecs.ContainerInsights.ENHANCED })`; `new ecs.FargateService(...)` with desiredCount, vpcSubnets PRIVATE_WITH_EGRESS, securityGroups [apiSg], assignPublicIp false (default), circuitBreaker { rollback: true }, enableExecuteCommand for debugging. Container healthCheck: oven/bun image has no curl → use bun: `["CMD", "bun", "-e", "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]`, interval 30s default, startPeriod 10s.
- Analogy: telling the regional manager (service) "keep 2 shops open in these neighbourhoods, check each shop's lights every 30 seconds, and if a new manual makes shops fail, go back to the old one".
- Code example: `const svc = new ecs.FargateService(this, "ApiService", { cluster, taskDefinition: taskDef, desiredCount: cfg.minTasks, vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }, securityGroups: [apiSg], circuitBreaker: { rollback: true }, enableExecuteCommand: true });` After `cdk deploy -c env=dev -c imageTag=3f2a1c9`: describe-services runningCount → `2`. ECS Exec: `aws ecs execute-command --cluster shop --task <id> --container api --interactive --command "bun --version"` → `1.4.5` (needs Session Manager plugin installed locally).
- Production use: base for ALB attach (topic 10), auto scaling (topic 19), deploys (topic 17).
- Common mistakes: health check using curl that isn't in the image (tasks killed in loop); forgetting circuit breaker rollback (bad deploy loops forever); assignPublicIp true in private subnets.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateServiceProps.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.HealthCheck.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.ClusterProps.html ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html

## Quiz
1. App code calls S3 and gets AccessDenied though execution role has S3 access. Why? — tests roles.
2. Why IMMUTABLE tags in ECR? — tests tag mutability.
3. Rotated DB password; running tasks still use the old one. Why, and fix? — tests secret injection timing.
4. Container health check `curl` fails forever on oven/bun image. Fix? — tests healthCheck.
5. Is cpu 2048 / memory 2048 valid on Fargate? — tests CPU/memory pairs (no; min 4096).
