window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "09-ecs-fargate",
  "order": 9,
  "title": "ECS on Fargate",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "ECS (Elastic Container Service) is the AWS service that runs your Docker containers, and Fargate means AWS manages the servers underneath. You will learn the vocabulary (cluster, task definition, task, service), push an image to ECR (AWS's private image registry), give the app and the platform the right IAM roles, inject secrets, ship logs to CloudWatch (AWS's log and metric service) and define a complete Fargate service in CDK. Every task in this course runs on ARM64 processors (Graviton, AWS's own ARM64 processors), and services run without a load balancer (a service that spreads web requests across copies of your app) for now (that comes in topic 10).",
  "prerequisites": ["05-docker-containers", "06-app-production-readiness", "08-vpc-networking"],
  "subtopics": [
    {
      "id": "clusters-task-definitions-services",
      "title": "Clusters, task definitions and services",
      "explanation": "ECS (Elastic Container Service) is AWS's container orchestrator. An orchestrator is a program that decides where containers run, starts them, and replaces them when they fail. You give ECS a Docker image (topic 05) and it keeps copies of it running.\n\nFargate is the \"serverless\" way to run ECS: AWS owns and patches the underlying servers, and you only say how much CPU and memory each copy of your container needs. The alternative (ECS on EC2 virtual machines you manage yourself) is not used in this course.\n\nECS has four vocabulary words you must keep apart. A cluster is a logical group that your services and tasks live in; it is mostly a name and a boundary, not a server. A task definition is the recipe: which image to run, how much CPU and memory, which ports, which environment variables, which IAM roles and where logs go. Every change to a task definition creates a new numbered version called a revision (shop-api:1, shop-api:2, ...). Revisions are immutable, so you never edit one; you register a new one.\n\nA task is one running copy created from a task definition revision (one or more containers started together). A service is the long-running manager of tasks: you tell it a desiredCount (the number of tasks you want) and it starts that many, replaces any that crash or fail health checks, rolls out new revisions during a deployment, and later registers tasks with a load balancer.\n\nOn Fargate you must choose CPU and memory from allowed pairs. CPU is measured in units where 1024 units = 1 vCPU (a virtual CPU). For example, 2048 units (2 vCPU) allows memory from 4096 to 16384 MiB (mebibytes, roughly megabytes) in 1024 MiB steps. A pair outside the table is rejected when you deploy.\n\nEach Fargate task also gets its own network interface in your VPC (an ENI, an elastic network interface, which is a virtual network card). ECS calls this mode awsvpc, and it is why a task has its own private IP address and its own security group (topic 08).",
      "analogy": "Think of a franchise company. The task definition is the franchise manual (what the shop sells, how big it is, what equipment it has). A task is one open shop built from that manual. The service is the regional manager who is told \"always keep 20 shops open\": when one closes unexpectedly the manager opens a replacement, and when headquarters issues a new manual revision the manager gradually reopens shops with the new manual. The cluster is the region the manager works in. Fargate is the landlord who provides the building and utilities so you never fix a roof.",
      "code": [
        {
          "language": "bash",
          "filename": "check-service.sh",
          "source": "aws ecs describe-services \\\n  --cluster shop \\\n  --services shop-api \\\n  --query \"services[0].[desiredCount,runningCount]\" \\\n  --output text \\\n  --profile shop-dev",
          "output": "2\t2",
          "explanation": "describe-services asks ECS about the service shop-api in the cluster shop. The --query option (a JMESPath filter, a small language for picking fields out of JSON) selects desiredCount and runningCount, and --output text prints them separated by a tab. Once the service is stable the two numbers match: 2 wanted, 2 running. If runningCount stays lower than desiredCount, tasks are failing to start or are being killed. --profile shop-dev selects the AWS CLI profile from topic 03/04."
        }
      ],
      "productionNote": "The shop runs two services in one cluster: shop-api (the Bun API) and shop-web (the TanStack Start frontend server). Database migrations (topic 13) run as one-off tasks from the same task definition family rather than as services. In production never run a single task: with desiredCount 1, one crash or one deployment means downtime. Use at least 2 tasks spread over 2 availability zones.",
      "commonMistakes": [
        "Choosing a CPU/memory pair that Fargate does not offer (for example 2048 CPU with 2048 MiB). The deployment fails with a validation error; check the allowed pairs first.",
        "Running a single task in production, so any crash or deployment causes an outage.",
        "Confusing the task definition revision (shop-api:7, a version of the recipe) with the image tag (3f2a1c9, a version of your code). Several revisions can point at the same image, and one revision always points at one specific image tag."
      ],
      "sources": [
        { "title": "Amazon ECS Developer Guide: What is Amazon ECS", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html" },
        { "title": "AWS CDK API: FargateTaskDefinition", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateTaskDefinition.html" }
      ]
    },
    {
      "id": "ecr-repositories-image-push",
      "title": "ECR repositories and image push",
      "explanation": "ECR (Elastic Container Registry) is AWS's private registry. A registry is a server that stores Docker images so other machines can download (pull) them. Each AWS account and region has its own private ECR, and you create one repository per application, for example shop-api.\n\nYou create the repository with CDK (topic 07). Four properties matter. imageScanOnPush: true scans every pushed image for known vulnerabilities (the default is false, so set it). imageTagMutability: IMMUTABLE means a tag can never be overwritten once pushed, so shop-api:3f2a1c9 always means exactly the same image. lifecycleRules delete old images automatically; each rule uses exactly one of maxImageCount (keep the newest N) or maxImageAge. removalPolicy defaults to Retain, meaning the repository (and its images) survives if you delete the stack.\n\nPushing is three steps. First authenticate Docker to the registry: aws ecr get-login-password prints a temporary password, and docker login reads it from standard input. Second, tag the local image with the full repository address (account ID, region and repository name). Third, docker push uploads it. We tag images with the short git commit hash (a SHA such as 3f2a1c9) so every image can be traced back to its code.\n\nBecause our tasks run on ARM64 (Graviton) processors, the image must be built for ARM64 with docker buildx build --platform linux/arm64 (topic 05). An x86 image would fail to start on an ARM64 task.",
      "analogy": "ECR is a locked warehouse with numbered shelves. IMMUTABLE tags mean that once shelf \"3f2a1c9\" is filled it is sealed: nobody can swap its contents, so you always know what is on it. The lifecycle rule is a cleaner who throws away every box except the newest 50 so the warehouse bill does not keep growing.",
      "code": [
        {
          "language": "typescript",
          "filename": "ecr-stack.ts",
          "source": "import { App, Stack } from \"aws-cdk-lib\";\nimport * as ecr from \"aws-cdk-lib/aws-ecr\";\n\nconst app = new App();\nconst stack = new Stack(app, \"ShopRegistry\");\n\nnew ecr.Repository(stack, \"ApiRepo\", {\n  repositoryName: \"shop-api\",\n  imageScanOnPush: true,\n  imageTagMutability: ecr.TagMutability.IMMUTABLE,\n  lifecycleRules: [{ maxImageCount: 50 }],\n});\n\napp.synth();",
          "output": "",
          "explanation": "This defines the repository shop-api. Scanning is on, tags cannot be overwritten, and only the newest 50 images are kept. The program prints nothing: it only builds the CloudFormation template. Save it as lib/registry-stack.ts, wrapped in a Stack class as in topic 07, add that stack to bin/app.ts, then run cdk deploy ShopRegistry. A standalone script like this is not deployed by cdk deploy."
        },
        {
          "language": "bash",
          "filename": "push-image.sh",
          "source": "REGISTRY=111111111111.dkr.ecr.us-east-1.amazonaws.com\n\naws ecr get-login-password --region us-east-1 --profile shop-dev \\\n  | docker login --username AWS --password-stdin $REGISTRY\n\ndocker tag shop-api:3f2a1c9 $REGISTRY/shop-api:3f2a1c9\ndocker push $REGISTRY/shop-api:3f2a1c9",
          "output": "Login Succeeded\nThe push refers to repository [111111111111.dkr.ecr.us-east-1.amazonaws.com/shop-api]\n...\n3f2a1c9: digest: sha256:... size: ...",
          "explanation": "REGISTRY holds the registry address: your account ID (111111111111, the example account from topic 04), the region and the ECR domain. The first command prints a temporary password that docker login reads from standard input with --password-stdin; the user name is always AWS. docker tag gives the local image shop-api:3f2a1c9 a second name containing the registry address, and docker push uploads it. The middle lines are one progress line per layer, and the last line shows the tag, the image digest (its content hash) and size. The digest and size values differ for every image."
        }
      ],
      "productionNote": "In production a pipeline, not a person, pushes one image per commit tagged with the git SHA (topic 17). Never deploy the tag latest: with IMMUTABLE tags it could not be reused anyway, and a mutable latest makes it impossible to know what is running. Keep the lifecycle rule so storage cost does not grow forever.",
      "commonMistakes": [
        "Leaving tags MUTABLE and deploying latest: you can no longer tell which code is running, and a rollback cannot restore the previous image.",
        "Having no lifecycle rule, so every pushed image is kept and storage cost grows with each commit.",
        "Pushing an x86 image for ARM64 tasks. The task starts and immediately stops with an exec format error. Build with --platform linux/arm64."
      ],
      "sources": [
        { "title": "AWS CDK API: ecr RepositoryProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecr.RepositoryProps.html" },
        { "title": "AWS CDK API: ecr LifecycleRule", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecr.LifecycleRule.html" },
        { "title": "Amazon ECR User Guide: Pushing a Docker image", "url": "https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-push-ecr-image.html" }
      ]
    },
    {
      "id": "task-role-vs-execution-role",
      "title": "Task role vs execution role",
      "explanation": "A task definition has two different IAM roles (an IAM role is a set of permissions that a service or program can assume, topic 03). Mixing them up is one of the most common ECS problems.\n\nThe execution role is used by the ECS agent (the AWS-run helper that starts your task), not by your code. It works before and around your app: it pulls the image from ECR, writes container logs to CloudWatch and fetches secrets so ECS can inject them as environment variables.\n\nThe task role is used by your application code at runtime. Whenever your program calls an AWS API (reading an S3 bucket, connecting to RDS Proxy with IAM authentication, sending traces to X-Ray, AWS's tracing service), the AWS SDK (the library your code uses to call AWS services) uses the task role's credentials.\n\nCDK creates both roles for you. When you use a grant method such as bucket.grantRead(taskDef.taskRole), CDK adds the matching policy to the role you pass. The permissions the platform needs (pull the image, write logs) are added to the execution role automatically when you use ecs.ContainerImage.fromEcrRepository and a log driver, so you rarely write those by hand.\n\nYou can check what CDK generated without deploying. The example below builds a stack in memory, converts it to a CloudFormation template with Template.fromStack (topic 07) and prints the S3 actions found in the IAM policies. The generated policy lists s3:GetObject* among its actions.",
      "analogy": "Picture a delivery company and a shop clerk. The execution role is the delivery driver who brings stock and paperwork to the shop before it opens (pulls the image, delivers secrets, drops off log paper). The task role is the clerk's keycard, used all day while the shop is running. If the clerk needs the stockroom, you give the keycard access; giving the driver a stockroom key does not help the clerk.",
      "code": [
        {
          "language": "typescript",
          "filename": "roles-check.ts",
          "source": "import { App, Stack } from \"aws-cdk-lib\";\nimport { Template } from \"aws-cdk-lib/assertions\";\nimport * as ecs from \"aws-cdk-lib/aws-ecs\";\nimport * as s3 from \"aws-cdk-lib/aws-s3\";\n\nconst stack = new Stack(new App(), \"RolesDemo\");\nconst assetsBucket = new s3.Bucket(stack, \"Assets\");\n\nconst taskDef = new ecs.FargateTaskDefinition(stack, \"ApiTask\", {\n  cpu: 2048,\n  memoryLimitMiB: 4096,\n  runtimePlatform: {\n    cpuArchitecture: ecs.CpuArchitecture.ARM64,\n    operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,\n  },\n});\ntaskDef.addContainer(\"api\", {\n  image: ecs.ContainerImage.fromRegistry(\"public.ecr.aws/docker/library/busybox:latest\"),\n});\n\n// The app (task role) may read the bucket.\nassetsBucket.grantRead(taskDef.taskRole);\n\nconst template = Template.fromStack(stack);\nconst policies = template.findResources(\"AWS::IAM::Policy\");\nconst actions = Object.values(policies)\n  .flatMap((p: any) => p.Properties.PolicyDocument.Statement)\n  .flatMap((s: any) => s.Action)\n  .filter((a: string) => a.startsWith(\"s3:\"));\nconsole.log(actions.join(\",\"));",
          "output": "s3:GetObject*,s3:GetBucket*,s3:List*",
          "explanation": "The task definition uses 2048 CPU units (2 vCPU) and 4096 MiB, a valid Fargate pair, on ARM64 Linux. A task definition needs at least one container, so a small public image is added. assetsBucket.grantRead(taskDef.taskRole) attaches an S3 read policy to the task role, the role your app code uses. The script then reads the generated CloudFormation, collects every IAM policy action that starts with s3: and prints them. The policy lists s3:GetObject* among its actions, proving the permission landed on a role. Run it with bun run roles-check.ts; no AWS account is needed because nothing is deployed."
        }
      ],
      "productionNote": "Give every service its own task role with only the permissions it needs (least privilege, covered in depth in topic 21). Do not share one role between shop-api and shop-web: if one is compromised the attacker gets the other's permissions as well.",
      "commonMistakes": [
        "Granting app permissions (S3, database) to the execution role. The app's AWS SDK uses the task role, so the call returns AccessDenied.",
        "Secret injection failing at task start because the execution role cannot read the secret, or cannot decrypt it when the secret uses a customer-managed KMS key (KMS is the AWS key service that encrypts data). The task never starts.",
        "Using one shared role for all services, which gives each service far more access than it needs."
      ],
      "sources": [
        { "title": "Amazon ECS Developer Guide: Task IAM role", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html" },
        { "title": "Amazon ECS Developer Guide: Task execution IAM role", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html" },
        { "title": "AWS CDK API: FargateTaskDefinition", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateTaskDefinition.html" }
      ]
    },
    {
      "id": "secrets-secrets-manager-ssm",
      "title": "Secrets from Secrets Manager and SSM",
      "explanation": "A secret is a value that must stay private, such as a database password or a cache auth token. Never bake secrets into the Docker image (anyone who can pull the image can read them) and never put them in the plain environment setting of a container (they show in clear text in the ECS console and in the task definition).\n\nInstead ECS can inject secrets for you. AWS Secrets Manager is a service that stores secrets, can generate them and can rotate (change) them. SSM Parameter Store is a simpler store for configuration values and secrets. In the container definition you use the secrets map: each key is the environment variable name the app will see, and each value says where to fetch it.\n\nTwo helpers build those values. ecs.Secret.fromSecretsManager(secret, \"password\") fetches one field of a secret that stores a JSON object (here the field password). Without the second argument the whole secret string is used. ecs.Secret.fromSsmParameter(param) fetches an SSM parameter.\n\nECS fetches the values using the execution role when the task starts and passes them to your container as normal environment variables. Because this happens only at start, a rotated secret is not seen by tasks that are already running: they keep the old value until replaced by new tasks (for example by forcing a new deployment).\n\nKeep non-secret settings such as NODE_ENV and the database host in environment. The app reads all of them with process.env and builds the connection URL from the parts (topic 11).",
      "analogy": "A sealed envelope handed to each employee at the door every morning, instead of writing the safe's code on the shop wall. The envelope is prepared fresh when the shift starts, so an employee already inside keeps yesterday's envelope until they clock in again.",
      "code": [
        {
          "language": "typescript",
          "filename": "secrets-stack.ts",
          "source": "import { App, Stack } from \"aws-cdk-lib\";\nimport * as ecr from \"aws-cdk-lib/aws-ecr\";\nimport * as ecs from \"aws-cdk-lib/aws-ecs\";\nimport * as secretsmanager from \"aws-cdk-lib/aws-secretsmanager\";\n\nconst app = new App();\nconst stack = new Stack(app, \"ShopSecrets\");\n\nconst repo = new ecr.Repository(stack, \"ApiRepo\", { repositoryName: \"shop-api\" });\n\n// A secret holding a JSON object with two fields, username and password.\nconst dbSecret = new secretsmanager.Secret(stack, \"DbSecret\", {\n  generateSecretString: {\n    secretStringTemplate: JSON.stringify({ username: \"shop\" }),\n    generateStringKey: \"password\",\n  },\n});\n// A secret holding one plain string.\nconst cacheSecret = new secretsmanager.Secret(stack, \"CacheSecret\");\n\nconst taskDef = new ecs.FargateTaskDefinition(stack, \"ApiTask\", {\n  family: \"shop-api\",\n  cpu: 2048,\n  memoryLimitMiB: 4096,\n  runtimePlatform: {\n    cpuArchitecture: ecs.CpuArchitecture.ARM64,\n    operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,\n  },\n});\n\ntaskDef.addContainer(\"api\", {\n  image: ecs.ContainerImage.fromEcrRepository(repo, \"3f2a1c9\"),\n  portMappings: [{ containerPort: 3000 }],\n  environment: {\n    NODE_ENV: \"production\",\n    APP_ENV: \"dev\",\n    DB_HOST: \"shop-proxy.example.internal\",\n    DB_NAME: \"shop\",\n  },\n  secrets: {\n    DB_USER: ecs.Secret.fromSecretsManager(dbSecret, \"username\"),\n    DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, \"password\"),\n    REDIS_AUTH: ecs.Secret.fromSecretsManager(cacheSecret),\n  },\n});\n\napp.synth();",
          "output": "",
          "explanation": "dbSecret stores a JSON object whose password field is generated by Secrets Manager; cacheSecret is a single generated string. In environment we put non-secret values (the DB_HOST here is a placeholder; topic 12 provides the real RDS Proxy address). In secrets, DB_USER and DB_PASSWORD each pull one field of dbSecret, and REDIS_AUTH pulls the whole cacheSecret. CDK also lets the execution role read these secrets and pull the image from the repo automatically. Nothing is printed, because the script only builds the template."
        },
        {
          "language": "bash",
          "filename": "list-secret-names.sh",
          "source": "aws ecs describe-task-definition \\\n  --task-definition shop-api \\\n  --query \"taskDefinition.containerDefinitions[0].secrets[].name\" \\\n  --output text \\\n  --profile shop-dev",
          "output": "DB_USER\tDB_PASSWORD\tREDIS_AUTH",
          "explanation": "After deploying, this reads the latest revision of the shop-api task definition and prints only the names of the injected variables, tab separated, in the order they were defined. The values themselves never appear: the task definition stores only a pointer (the secret's ARN) for each one."
        }
      ],
      "productionNote": "The database credentials (topic 11) and the Valkey auth token (topic 14) are delivered this way. If a secret is encrypted with a customer-managed KMS key, the execution role also needs permission to decrypt with that key. To use a rotated value, start new tasks (a new deployment); running tasks never refresh their environment.",
      "commonMistakes": [
        "Putting a password in environment: it is visible in plain text in the console and in the task definition JSON.",
        "Expecting running tasks to see a rotated secret. Environment variables are set once at task start.",
        "Forgetting that a customer-managed KMS key needs a decrypt permission for the execution role, which makes the task fail to start."
      ],
      "sources": [
        { "title": "AWS CDK API: ecs Secret", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.Secret.html" },
        { "title": "Amazon ECS Developer Guide: Pass sensitive data to a container", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data-secrets.html" }
      ]
    },
    {
      "id": "container-logs-cloudwatch",
      "title": "Container logs to CloudWatch",
      "explanation": "A container has no files you can easily read after it is replaced, so ECS ships its output to CloudWatch Logs, the AWS service that stores and searches logs. Anything your app writes to stdout or stderr (the normal output and error streams, for example from console.log) is captured. In topic 06 the app already writes one JSON object per line, which works well here.\n\nThe awsLogs driver does the shipping. A log group is the CloudWatch container for related logs; inside it, each task writes to its own log stream. The required streamPrefix option becomes the start of the stream name (prefix/container-name/task-id).\n\nSet retention (how long logs are kept) explicitly. CDK's LogGroup defaults to two years, and a group the driver creates for you (or created by hand) never expires. Set retention explicitly (ONE_MONTH is a reasonable start) so you control the cost. Also give the log group an explicit name, here shop-api, so commands that read it are predictable.\n\nThe driver mode controls what happens when logs are produced faster than they can be sent. BLOCKING mode makes the app wait for the log call, which can slow requests when logging backs up. NON_BLOCKING keeps the logs in an in-memory buffer; once the buffer (max-buffer-size) is full, new log lines that cannot be stored are lost: you may lose some log lines, but the app stays fast. When you do not set mode, ECS now uses non-blocking by default (since June 25, 2025); blocking is used only if you set it or change the defaultLogDriverMode account setting. The CDK API page still labels BLOCKING as its default, which is stale. Setting mode explicitly in CDK, as the example does, removes the ambiguity. At high request rates choose NON_BLOCKING and also log less (for example never one line per request at 250K requests per second).\n\nYou can follow logs from the terminal with aws logs tail. Add --follow to keep streaming new lines.",
      "analogy": "A pneumatic tube sends every till receipt to head office. In blocking mode the cashier waits whenever the tube is jammed, so customers queue. In non-blocking mode the cashier drops receipts into a tray and carries on serving, and if the tray overflows further receipts are lost.",
      "code": [
        {
          "language": "typescript",
          "filename": "logging-stack.ts",
          "source": "import { App, Stack } from \"aws-cdk-lib\";\nimport * as ecs from \"aws-cdk-lib/aws-ecs\";\nimport * as logs from \"aws-cdk-lib/aws-logs\";\n\nconst app = new App();\nconst stack = new Stack(app, \"ShopLogging\");\n\nconst taskDef = new ecs.FargateTaskDefinition(stack, \"ApiTask\", {\n  cpu: 2048,\n  memoryLimitMiB: 4096,\n  runtimePlatform: {\n    cpuArchitecture: ecs.CpuArchitecture.ARM64,\n    operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,\n  },\n});\n\ntaskDef.addContainer(\"api\", {\n  image: ecs.ContainerImage.fromRegistry(\"public.ecr.aws/docker/library/busybox:latest\"),\n  logging: ecs.LogDrivers.awsLogs({\n    streamPrefix: \"api\",\n    logGroup: new logs.LogGroup(stack, \"ApiLogs\", {\n      logGroupName: \"shop-api\",\n      retention: logs.RetentionDays.ONE_MONTH,\n    }),\n    mode: ecs.AwsLogDriverMode.NON_BLOCKING,\n  }),\n});\n\napp.synth();",
          "output": "",
          "explanation": "The container logs to a log group named shop-api that keeps entries for one month. Each task's stream starts with api. NON_BLOCKING trades possible loss of log lines for never stalling the app. CDK also gives the execution role permission to write to this log group. The script prints nothing."
        },
        {
          "language": "bash",
          "filename": "tail-logs.sh",
          "source": "aws logs tail shop-api --since 5m --profile shop-dev",
          "output": "2026-11-22T10:00:01.123000+00:00 api/api/0a1b2c3d4e5f {\"level\":\"info\",\"msg\":\"listening\",\"port\":3000}",
          "explanation": "tail prints log events from the group shop-api for the last five minutes; add --follow to keep streaming. Each line starts with a timestamp and the stream name (prefix api, container api, then the task ID), followed by the JSON line the app wrote. The timestamp and task ID will differ on your account, and extra fields from the topic 06 logger may follow."
        }
      ],
      "productionNote": "These logs feed CloudWatch Logs Insights queries and alarms in topic 18. Because the app logs JSON, fields such as level can be filtered directly. Always set retention, and keep per-request logging off or sampled on hot paths.",
      "commonMistakes": [
        "Not setting retention, so logs are kept far longer than needed (never expire if the driver or console creates the group, two years with CDK's LogGroup default).",
        "Using BLOCKING mode with very high log volume: when the log pipeline backs up, request latency rises.",
        "Logging one line per request at very high traffic (such as 250K requests per second); the cost and buffer pressure become the bottleneck."
      ],
      "sources": [
        { "title": "AWS CDK API: AwsLogDriverProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.AwsLogDriverProps.html" },
        { "title": "Amazon ECS Developer Guide: Send Amazon ECS logs to CloudWatch", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_awslogs.html" },
        { "title": "AWS CLI reference: logs tail", "url": "https://docs.aws.amazon.com/cli/latest/reference/logs/tail.html" }
      ]
    },
    {
      "id": "fargate-services-cdk",
      "title": "Fargate services in CDK",
      "explanation": "Now we assemble everything into a running service. First create the cluster: new ecs.Cluster with your VPC, the name shop, and containerInsightsV2 set to ecs.ContainerInsights.ENHANCED (this turns on detailed CloudWatch metrics for the cluster, used in topic 18).\n\nThen create ecs.FargateService with the cluster, the task definition and a desiredCount. Put tasks in private subnets with egress (vpcSubnets of type PRIVATE_WITH_EGRESS, topic 08) and attach the security group for the API. assignPublicIp is false by default, which is what you want in private subnets. circuitBreaker with rollback: true makes ECS stop a deployment whose new tasks keep failing and return to the last working revision. enableExecuteCommand: true lets you open a shell in a running task for debugging (ECS Exec).\n\nThe container health check is a command ECS runs inside the container; if it keeps failing, ECS kills and replaces the task. Do not assume curl exists: the oven/bun image has no curl, so use bun itself. The command below calls the /healthz endpoint from topic 06 and exits 0 for success or 1 for failure. The interval defaults to 30 seconds, and startPeriod gives the app 10 seconds to start before failures count.\n\nBecause we have no load balancer yet (topic 10), the service just runs tasks. Deploy with cdk deploy and pass the image tag as context: -c env=dev -c imageTag=3f2a1c9. First wrap this code in a Stack class in lib/service-stack.ts and list that stack in bin/app.ts, as in topic 07; cdk deploy only deploys stacks listed there. The image with that tag must already exist in ECR (previous sub-topic).\n\nECS Exec needs the Session Manager plugin, a small helper program: install it from AWS's Session Manager plugin documentation (download the Windows installer, run it, then open a new terminal). With it you can run a command inside the container, such as bun --version.",
      "analogy": "You are telling the regional manager (the service): keep 2 shops open in these neighbourhoods, check each shop's lights every 30 seconds, and if a new manual causes shops to fail, go back to the old one. ECS Exec is the manager phoning a shop and asking someone to read out a number from inside.",
      "code": [
        {
          "language": "typescript",
          "filename": "service-stack.ts",
          "source": "import { App, Duration, Stack } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport * as ecr from \"aws-cdk-lib/aws-ecr\";\nimport * as ecs from \"aws-cdk-lib/aws-ecs\";\n\nconst app = new App();\nconst stack = new Stack(app, \"ShopApiService\");\nconst imageTag = app.node.tryGetContext(\"imageTag\") ?? \"3f2a1c9\";\n\nconst vpc = new ec2.Vpc(stack, \"Vpc\", { maxAzs: 2 });\nconst apiSg = new ec2.SecurityGroup(stack, \"ApiSg\", { vpc });\nconst repo = new ecr.Repository(stack, \"ApiRepo\", { repositoryName: \"shop-api\" });\n\nconst cluster = new ecs.Cluster(stack, \"Cluster\", {\n  vpc,\n  clusterName: \"shop\",\n  containerInsightsV2: ecs.ContainerInsights.ENHANCED,\n});\n\nconst taskDef = new ecs.FargateTaskDefinition(stack, \"ApiTask\", {\n  family: \"shop-api\",\n  cpu: 2048,\n  memoryLimitMiB: 4096,\n  runtimePlatform: {\n    cpuArchitecture: ecs.CpuArchitecture.ARM64,\n    operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,\n  },\n});\n\ntaskDef.addContainer(\"api\", {\n  image: ecs.ContainerImage.fromEcrRepository(repo, imageTag),\n  portMappings: [{ containerPort: 3000 }],\n  healthCheck: {\n    command: [\n      \"CMD\",\n      \"bun\",\n      \"-e\",\n      \"fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\",\n    ],\n    interval: Duration.seconds(30),\n    startPeriod: Duration.seconds(10),\n  },\n});\n\nnew ecs.FargateService(stack, \"ApiService\", {\n  cluster,\n  serviceName: \"shop-api\",\n  taskDefinition: taskDef,\n  desiredCount: 2,\n  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },\n  securityGroups: [apiSg],\n  circuitBreaker: { rollback: true },\n  enableExecuteCommand: true,\n});\n\napp.synth();",
          "output": "",
          "explanation": "This is a complete stack. The VPC has two availability zones, the cluster is named shop, and the task definition has one container with a Bun-based health check. tryGetContext reads the imageTag passed with -c on the command line (topic 07), and falls back to 3f2a1c9. The service runs 2 tasks in private subnets, does not get public IPs, rolls back a failing deployment and allows ECS Exec. Printing nothing is correct: the script only synthesizes the template. In a real project the VPC and repository come from earlier stacks."
        },
        {
          "language": "bash",
          "filename": "deploy-and-verify.sh",
          "source": "cdk deploy -c env=dev -c imageTag=3f2a1c9 --profile shop-dev\n\naws ecs describe-services --cluster shop --services shop-api \\\n  --query \"services[0].runningCount\" --output text --profile shop-dev\n\naws ecs execute-command --cluster shop --task <task-id> --container api \\\n  --interactive --command \"bun --version\" --profile shop-dev",
          "output": "2\n1.4.5",
          "explanation": "After the deploy finishes, runningCount is 2 once both tasks pass their health checks. The third command opens a session to one task, replacing <task-id> with an ID from aws ecs list-tasks, and runs bun --version, which prints 1.4.5 for this course's image. The session tool prints a few extra lines of its own, such as the session ID, which are left out here."
        }
      ],
      "productionNote": "This service is the base for the load balancer in topic 10, auto scaling in topic 19 and the deployment pipeline in topic 17. In production keep desiredCount at 2 or more, spread across availability zones, and keep ECS Exec restricted by IAM because it gives shell access to running containers.",
      "commonMistakes": [
        "Using curl in the health check on an image that does not contain it. The check always fails and ECS kills and restarts the tasks in a loop.",
        "Forgetting circuitBreaker with rollback: a bad release is retried forever instead of being rolled back.",
        "Setting assignPublicIp to true for tasks in private subnets; it is not needed there and is the wrong network design."
      ],
      "sources": [
        { "title": "AWS CDK API: FargateServiceProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateServiceProps.html" },
        { "title": "AWS CDK API: ecs HealthCheck", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.HealthCheck.html" },
        { "title": "AWS CDK API: ecs ClusterProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.ClusterProps.html" },
        { "title": "Amazon ECS Developer Guide: Monitor containers with ECS Exec", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Your app code calls S3 and gets AccessDenied, even though the task's execution role has S3 access. What is the most likely reason?",
      "options": [
        "The execution role is only used by ECS to pull images, write logs and fetch secrets; the app's AWS calls use the task role, which lacks S3 permission",
        "S3 can only be reached from public subnets",
        "The Docker image was built for the wrong CPU architecture",
        "Fargate tasks are never allowed to call AWS APIs"
      ],
      "answerIndex": 0,
      "explanation": "Application code uses the task role. Grant S3 access with something like bucket.grantRead(taskDef.taskRole). Permissions on the execution role do not apply to the code running in the container."
    },
    {
      "question": "Why set imageTagMutability to IMMUTABLE on an ECR repository?",
      "options": [
        "It makes image pulls faster",
        "A tag such as 3f2a1c9 can never be overwritten, so it always refers to exactly the same image and rollbacks are reliable",
        "It automatically deletes old images",
        "It lets ARM64 and x86 images share one tag"
      ],
      "answerIndex": 1,
      "explanation": "Immutable tags guarantee that a tag always points to the same image content. Deleting old images is the job of lifecycleRules, not tag mutability."
    },
    {
      "question": "You rotated the database password in Secrets Manager, but the running tasks still use the old one. Why, and what is the fix?",
      "options": [
        "The password field was written to the Docker image, so you must rebuild the Dockerfile",
        "Secrets Manager never changes values",
        "ECS injects secrets as environment variables only when a task starts, so start new tasks (for example by forcing a new deployment) to pick up the new value",
        "The task role must be deleted and recreated"
      ],
      "answerIndex": 2,
      "explanation": "Environment variables are fixed when the container starts. Running tasks do not refresh them, so replacing the tasks (a new deployment) is the fix."
    },
    {
      "question": "A container health check that runs curl fails forever on the oven/bun image, and ECS keeps replacing the task. What is the right fix?",
      "options": [
        "Increase the desiredCount of the service",
        "Disable the circuit breaker",
        "Give the task a public IP address",
        "Use a command that exists in the image, for example bun -e with a fetch call to /healthz that exits 0 on success and 1 on failure"
      ],
      "answerIndex": 3,
      "explanation": "The image does not contain curl, so the check can never succeed. Run the check with bun, which is in the image."
    },
    {
      "question": "Is a Fargate task with cpu 2048 (2 vCPU) and memory 2048 MiB a valid combination?",
      "options": [
        "Yes, any memory value is allowed with any CPU value",
        "No, 2 vCPU requires between 4096 and 16384 MiB of memory, so 2048 is rejected at deploy time",
        "Yes, but only on ARM64",
        "No, Fargate only supports 1 vCPU tasks"
      ],
      "answerIndex": 1,
      "explanation": "Fargate allows only specific pairs. With 2048 CPU units the memory must be at least 4096 MiB (up to 16384 MiB in 1024 MiB steps)."
    }
  ]
});
