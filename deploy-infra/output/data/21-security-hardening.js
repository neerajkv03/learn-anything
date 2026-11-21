window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "21-security-hardening",
  "order": 21,
  "title": "Security Hardening",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Your app now runs, scales and is observable. This topic makes it hard to attack and easy to audit. You will put a firewall (AWS WAF) in front of CloudFront, shrink IAM permissions to the minimum, check that data is encrypted on the wire and on disk, scan and patch container images, switch on threat detection (GuardDuty and Security Hub), and learn how Shield and a capped autoscaler defend against floods of traffic.",
  "prerequisites": ["03-aws-fundamentals", "09-ecs-fargate", "11-aurora-postgresql", "14-elasticache-valkey", "15-cloudfront-frontend"],
  "subtopics": [
    {
      "id": "waf-rate-rules",
      "title": "AWS WAF and rate-based rules",
      "explanation": "AWS WAF (Web Application Firewall) is a firewall for HTTP. It looks at each request (its IP address, headers, URL, body) and applies rules. Each rule can Allow the request, Block it (the client receives a 403 status code), or Count it (let it through but record that it matched). The list of rules plus a default action is called a web ACL (access control list). A request that matches no rule gets the web ACL's default action; in this topic that is Allow.\n\nA web ACL has a scope. Scope CLOUDFRONT protects a CloudFront distribution, and the web ACL must be created in the us-east-1 region. Scope REGIONAL protects regional resources such as an Application Load Balancer (ALB). The two attach differently. A REGIONAL ACL is linked with a separate association resource (CfnWebACLAssociation). A CloudFront distribution does not use that resource. Instead you pass the web ACL's ARN (the unique AWS identifier you met in topic 3) to the distribution's `webAclId` property.\n\nYou rarely write detection rules yourself. AWS publishes managed rule groups, bundles of rules it maintains. AWSManagedRulesCommonRuleSet is the usual baseline: it covers common web attacks and costs 700 WCU. A WCU (web ACL capacity unit) is the unit WAF uses to measure how expensive a rule is to evaluate, and a web ACL's base price covers up to 1,500 WCU in total; you can use up to 5,000 WCU, but above 1,500 costs extra.\n\nA rate-based rule counts requests per aggregation key and fires when the count passes a limit within an evaluation window. The window can be 60, 120, 300 or 600 seconds (the default is 300), and the smallest allowed limit is 10. The aggregation key is normally IP, so the limit applies per client IP address. FORWARDED_IP (the IP from a header such as X-Forwarded-For) and CUSTOM_KEYS (for example a header or cookie value) are also available. WAF re-checks rates about every 10 seconds, so a client can go slightly over the limit before it is blocked, and it stays blocked until its rate falls back under the limit.\n\nIn the example, the limit is 2,000 requests per 300 seconds per IP, roughly 6.7 requests per second. One IP that sends 2,500 requests in five minutes gets 403 responses until its rate drops. The synthesized check also shows the safe rollout habit. A new managed rule group starts in Count mode (for a managed group you express that with `overrideAction: { count: {} }`, while `{ none: {} }` means use the rules' own Block actions). Watch the sampled requests (a stored sample of recent requests that WAF matched, which you can inspect) and the per-rule CloudWatch metrics for false positives (legitimate traffic wrongly blocked), then switch to `{ none: {} }`.\n\nTo run the example, save it as `edge-acl-check.ts` inside the CDK project you created with `cdk init` in topic 7 (the folder that already has `aws-cdk-lib` installed), open a terminal in that folder, and run `bun run edge-acl-check.ts`. It builds the stack in memory and prints what it would deploy. It does not touch AWS.",
      "analogy": "A nightclub bouncer. One list names known troublemaker tricks (the managed rule group) and the bouncer turns those people away. The other tool is a clicker (the rate-based rule): anyone who walks in more than N times in five minutes has to wait outside. A Count-mode rule is the bouncer writing a name in a notebook without yet refusing entry, so you can check the list before enforcing it. The scope is which building the bouncer stands at: the global CDN front door (CLOUDFRONT) or one regional entrance (REGIONAL).",
      "code": [
        {
          "language": "typescript",
          "filename": "edge-acl-check.ts",
          "source": "import { App, Stack } from 'aws-cdk-lib';\nimport { Template } from 'aws-cdk-lib/assertions';\nimport * as cloudfront from 'aws-cdk-lib/aws-cloudfront';\nimport * as origins from 'aws-cdk-lib/aws-cloudfront-origins';\nimport * as wafv2 from 'aws-cdk-lib/aws-wafv2';\n\nconst app = new App();\n// A CLOUDFRONT-scope web ACL must be created in us-east-1.\nconst stack = new Stack(app, 'EdgeStack', {\n  env: { account: '111111111111', region: 'us-east-1' },\n});\n\nconst webAcl = new wafv2.CfnWebACL(stack, 'CdnAcl', {\n  scope: 'CLOUDFRONT',\n  defaultAction: { allow: {} },\n  visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'shop-cdn', sampledRequestsEnabled: true },\n  rules: [\n    {\n      name: 'Common',\n      priority: 0,\n      // Count first; change to { none: {} } once sampled requests look clean.\n      overrideAction: { count: {} },\n      statement: { managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesCommonRuleSet' } },\n      visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'common', sampledRequestsEnabled: true },\n    },\n    {\n      name: 'RatePerIp',\n      priority: 1,\n      action: { block: {} },\n      statement: { rateBasedStatement: { limit: 2000, evaluationWindowSec: 300, aggregateKeyType: 'IP' } },\n      visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'rate', sampledRequestsEnabled: true },\n    },\n  ],\n});\n\n// CloudFront takes the ACL ARN directly; no CfnWebACLAssociation.\nnew cloudfront.Distribution(stack, 'Cdn', {\n  defaultBehavior: { origin: new origins.HttpOrigin('origin.example.com') },\n  webAclId: webAcl.attrArn,\n});\n\nconst template = Template.fromStack(stack);\nconst acl: any = Object.values(template.findResources('AWS::WAFv2::WebACL'))[0];\nconsole.log('scope:', acl.Properties.Scope);\nfor (const rule of acl.Properties.Rules) {\n  const mode = Object.keys(rule.Action ?? rule.OverrideAction)[0].toLowerCase();\n  console.log(`${rule.Name} priority ${rule.Priority} -> ${mode}`);\n}\nconst dist: any = Object.values(template.findResources('AWS::CloudFront::Distribution'))[0];\nconsole.log('distribution has WebACLId:', 'WebACLId' in dist.Properties.DistributionConfig);\n",
          "output": "scope: CLOUDFRONT\nCommon priority 0 -> count\nRatePerIp priority 1 -> block\ndistribution has WebACLId: true",
          "explanation": "The first block creates the web ACL (`CfnWebACL` is the L1 construct, a direct mirror of the CloudFormation resource). `defaultAction: { allow: {} }` lets everything through that no rule blocks. Rule `Common` wraps the managed group and runs in Count mode. Rule `RatePerIp` blocks any IP that exceeds 2,000 requests in 300 seconds. Priority decides evaluation order, lowest number first. The Distribution receives `webAclId: webAcl.attrArn`, the ARN of the ACL. The last lines use the `Template` helper from topic 7: `findResources` returns every synthesized resource of one CloudFormation type, and the script prints the scope, each rule's mode, and whether the distribution carries a `WebACLId`."
        }
      ],
      "productionNote": "Put WAF at the edge so abusive traffic is refused before it reaches your ALB, tasks or database. Roll out in stages: deploy new rules in Count mode, watch the sampled requests and the per-rule CloudWatch metrics for a few days, then switch to Block. Keep the web ACL in the same stack file as the distribution so one `cdk deploy` keeps them in step, and create that stack in us-east-1.",
      "commonMistakes": [
        "Setting the rate limit too low. Many users in an office or school share one public IP through NAT (network address translation, which hides many machines behind one address), so one busy office can look like a single attacker and the whole site gets blocked for them. Start generous, watch the Count metrics, then tighten.",
        "Creating a CLOUDFRONT-scope web ACL outside us-east-1. The deploy fails because CloudFront is a global service whose WAF resources live only in us-east-1.",
        "Switching a managed rule group straight to Block. Rules such as size limits can flag legitimate file uploads (false positives), which breaks real users. Count first, then Block.",
        "Using CfnWebACLAssociation for CloudFront. That resource is for ALB, API Gateway and similar regional resources. For CloudFront, set `webAclId` on the distribution."
      ],
      "sources": [
        { "title": "AWS::WAFv2::WebACL (CloudFormation reference, Scope)", "url": "https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-wafv2-webacl.html#cfn-wafv2-webacl-scope" },
        { "title": "AWS WAF API: RateBasedStatement", "url": "https://docs.aws.amazon.com/waf/latest/APIReference/API_RateBasedStatement.html" },
        { "title": "AWS WAF: Baseline rule groups (Core rule set)", "url": "https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-baseline.html#aws-managed-rule-groups-baseline-crs" }
      ]
    },
    {
      "id": "least-privilege-iam",
      "title": "Least-privilege IAM",
      "explanation": "Least privilege (introduced in topic 3) means every role gets exactly the actions it needs on exactly the resources it needs, and nothing more. If an attacker steals the credentials of a role, the damage is limited to what that role could do. A role with `Action: \"s3:*\"` on `Resource: \"*\"` can read and delete every bucket in the account. A role that can only read one bucket cannot.\n\nWriting the JSON by hand makes it easy to over-grant, so CDK constructs offer grant methods that generate scoped policies for you. `assetsBucket.grantRead(taskRole)` adds only read actions on that one bucket and its objects. Other examples are `secret.grantRead(role)` (read one Secrets Manager secret), `proxy.grantConnect(role, 'shop_app')` (let the role connect to the RDS Proxy as one database user, from topic 12) and `repo.grantPullPush(role)` (pull and push images in one ECR repository).\n\nThe habits around the methods matter too. Give each service its own role (the API and the migration task should not share one), because a leak in one then does not open the other. The role your CI system uses to deploy should only be able to assume the CDK bootstrap roles, not carry administrator rights. Some wildcards are fine: `s3:GetObject*` means GetObject and its close variants, which is still a narrow, read-only family. The ones to hunt are a bare `*` action, an `service:*` action, and a `*` resource.\n\nYou can make this a test so it cannot silently regress. The example builds the stack twice, once with a broad `addToPolicy` statement and once with `grantRead`, then loops over every policy statement and reports wildcards. The script prints the result, so you can drop the same logic into a `bun test` file in CI.\n\nOutside the code, AWS provides IAM Access Analyzer, a service that analyses your policies and reports access that is wider than intended (for example a bucket shared publicly), and can show which permissions a role has not used. Use it to review roles that already exist.\n\nSave the example as `iam-check.ts` in your CDK project and run `bun run iam-check.ts`.",
      "analogy": "Giving the cleaner keys to the corridors, not the safe. The cleaner needs to get into rooms to do the job (the narrow grant), and a master key that also opens the safe (`*:*`) turns one lost key into a disaster. Separate roles are separate key rings: the cleaner and the night guard each carry only their own.",
      "code": [
        {
          "language": "typescript",
          "filename": "iam-check.ts",
          "source": "import { App, Stack } from 'aws-cdk-lib';\nimport { Template } from 'aws-cdk-lib/assertions';\nimport * as iam from 'aws-cdk-lib/aws-iam';\nimport * as s3 from 'aws-cdk-lib/aws-s3';\n\nfunction build(bad: boolean): Template {\n  const stack = new Stack(new App(), 'ApiStack');\n  const assets = new s3.Bucket(stack, 'Assets');\n  const taskRole = new iam.Role(stack, 'TaskRole', {\n    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),\n  });\n  if (bad) {\n    // Over-broad: every S3 action on every bucket.\n    taskRole.addToPolicy(new iam.PolicyStatement({ actions: ['s3:*'], resources: ['*'] }));\n  } else {\n    // Scoped: read-only on this one bucket.\n    assets.grantRead(taskRole);\n  }\n  return Template.fromStack(stack);\n}\n\nfunction problems(template: Template): string[] {\n  const found: string[] = [];\n  const policies = Object.values(template.findResources('AWS::IAM::Policy')) as any[];\n  for (const policy of policies) {\n    for (const statement of policy.Properties.PolicyDocument.Statement) {\n      for (const action of ([] as any[]).concat(statement.Action)) {\n        if (action === '*' || action.endsWith(':*')) found.push(`action ${action}`);\n      }\n      for (const resource of ([] as any[]).concat(statement.Resource)) {\n        if (resource === '*') found.push('resource *');\n      }\n    }\n  }\n  return found;\n}\n\nfor (const [name, bad] of [['good', false], ['bad', true]] as const) {\n  const list = problems(build(bad));\n  console.log(`${name}: ${list.length} problems`);\n  for (const p of list) console.log(`  ${p}`);\n}\n",
          "output": "good: 0 problems\nbad: 2 problems\n  action s3:*\n  resource *",
          "explanation": "`build(false)` uses `assets.grantRead(taskRole)`, which CDK turns into a policy that lists specific read actions and the bucket's ARNs, so no statement contains a bare wildcard. `build(true)` adds the broad statement by hand. `problems()` takes the synthesized template, fetches every `AWS::IAM::Policy` with `findResources`, and flags an action that is `*` or ends in `:*` and a resource that is exactly `*`. `Action` and `Resource` can be a single string or a list in the JSON, so `concat` normalises both to a list. Wildcards such as `s3:GetObject*` are allowed on purpose because they are narrow."
        }
      ],
      "productionNote": "Run this kind of check in CI on every pull request so a broad policy fails the build before it is deployed. Review roles regularly with IAM Access Analyzer. Keep one task role per service, and give the migration task its own role with only the database access it needs.",
      "commonMistakes": [
        "Adding `resources: ['*']` or `actions: ['service:*']` \"just for now\" to get past a permission error. Temporary wildcards become permanent. Read the error, find the one missing action, and grant exactly that.",
        "Sharing one role between the API and the migration task. The API then gets migration-level database power, or the migration gets the API's secrets.",
        "Giving the deploy role administrator access. A stolen CI credential then owns the account. Let it assume only the CDK bootstrap roles."
      ],
      "sources": [
        { "title": "IAM best practices: grant least privilege", "url": "https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege" },
        { "title": "AWS CDK: Permissions and grants", "url": "https://docs.aws.amazon.com/cdk/v2/guide/permissions.html" },
        { "title": "What is IAM Access Analyzer", "url": "https://docs.aws.amazon.com/IAM/latest/UserGuide/what-is-access-analyzer.html" }
      ]
    },
    {
      "id": "encryption-transit-rest",
      "title": "Encryption in transit and at rest",
      "explanation": "Encryption in transit protects data while it moves between two machines, so someone watching the network sees only scrambled bytes. It uses TLS (from topic 2), the same technology as HTTPS. Encryption at rest protects data stored on disk, so a stolen disk or snapshot is unreadable without the key. Many AWS services use KMS (Key Management Service, the AWS service that creates and guards encryption keys) to hold those keys.\n\nA real system has many hops, and each must be covered:\n\n- Viewer to CloudFront: use the HTTPS-only or redirect viewer protocol policy (topic 15) and, if you use your own certificate, a minimum protocol version such as `cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021` so old TLS versions are refused.\n- CloudFront to ALB: the origin protocol policy HTTPS_ONLY (the default for `LoadBalancerV2Origin`).\n- App to RDS Proxy: the proxy option `requireTLS`, which defaults to true.\n- App to Aurora or the proxy from Bun: Bun's `SQL` client defaults to `tls: false`, so set `tls: true` in its options.\n- App to Valkey: turn on `transitEncryptionEnabled` and connect with a `rediss://` URL.\n- S3: `enforceSSL: true` adds a bucket policy that denies requests not sent over HTTPS.\n\nAt rest: Aurora needs `storageEncrypted: true`. CDK's default is false unless you supply a KMS key. This setting can only be chosen when the cluster is created. Valkey needs `atRestEncryptionEnabled: true`. S3 encrypts new objects by default, and you can choose the key type. Secrets Manager always encrypts secrets with KMS. Log groups can optionally use a KMS key.\n\nThe example synthesizes a bucket, an Aurora cluster and a Valkey replication group with those settings and prints the values CloudFormation will receive. Save it as `encryption-check.ts` in your CDK project and run `bun run encryption-check.ts`.\n\nAfter deploying, verify against the real resources with the AWS CLI instead of trusting the code. The second example does this for Aurora and Valkey. Treat these checks like an audit checklist: layer, setting, how to verify.\n\n| Layer | Setting | How to verify |\n| --- | --- | --- |\n| Viewer to CloudFront | HTTPS only or redirect, TLS 1.2 minimum | Distribution config in the console or `aws cloudfront get-distribution-config` |\n| CloudFront to ALB | Origin protocol HTTPS_ONLY | Same distribution config |\n| App to RDS Proxy | `requireTLS` true, and Bun `tls: true` | Proxy config; try a connection with TLS turned off (for example sslmode=disable) and expect it to be refused |\n| App to Valkey | `transitEncryptionEnabled` and `rediss://` | `describe-replication-groups` |\n| S3 | `enforceSSL`, default encryption | Bucket policy and encryption settings |\n| Aurora at rest | `storageEncrypted` | `describe-db-clusters` |\n| Valkey at rest | `atRestEncryptionEnabled` | `describe-replication-groups` |",
      "analogy": "Armoured trucks between buildings (in transit) and locked safes inside each building (at rest). A bank with armoured trucks but unlocked vaults is exposed when someone breaks in, and a bank with strong vaults but open vans is exposed on the road. You need both, on every route.",
      "code": [
        {
          "language": "typescript",
          "filename": "encryption-check.ts",
          "source": "import { App, Stack } from 'aws-cdk-lib';\nimport { Template } from 'aws-cdk-lib/assertions';\nimport * as ec2 from 'aws-cdk-lib/aws-ec2';\nimport * as elasticache from 'aws-cdk-lib/aws-elasticache';\nimport * as rds from 'aws-cdk-lib/aws-rds';\nimport * as s3 from 'aws-cdk-lib/aws-s3';\n\nconst stack = new Stack(new App(), 'DataStack');\nconst vpc = new ec2.Vpc(stack, 'Vpc', { maxAzs: 2 });\n\nnew s3.Bucket(stack, 'Assets', {\n  enforceSSL: true,\n  encryption: s3.BucketEncryption.S3_MANAGED,\n});\n\nnew rds.DatabaseCluster(stack, 'Db', {\n  engine: rds.DatabaseClusterEngine.auroraPostgres({\n    version: rds.AuroraPostgresEngineVersion.of('17.7', '17'),\n  }),\n  writer: rds.ClusterInstance.provisioned('Writer', {\n    instanceType: ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.LARGE),\n  }),\n  vpc,\n  storageEncrypted: true, // can only be chosen when the cluster is created\n});\n\nnew elasticache.CfnReplicationGroup(stack, 'Cache', {\n  replicationGroupDescription: 'shop cache',\n  engine: 'valkey',\n  cacheNodeType: 'cache.t4g.small',\n  numCacheClusters: 2,\n  cacheSubnetGroupName: 'shop-cache-subnets',\n  transitEncryptionEnabled: true,\n  atRestEncryptionEnabled: true,\n});\n\nconst t = Template.fromStack(stack);\nconst db: any = Object.values(t.findResources('AWS::RDS::DBCluster'))[0];\nconst cache: any = Object.values(t.findResources('AWS::ElastiCache::ReplicationGroup'))[0];\nconst bucketPolicy = JSON.stringify(t.findResources('AWS::S3::BucketPolicy'));\nconsole.log('Aurora StorageEncrypted:', db.Properties.StorageEncrypted);\nconsole.log('Valkey in transit / at rest:', cache.Properties.TransitEncryptionEnabled, cache.Properties.AtRestEncryptionEnabled);\nconsole.log('S3 denies plain HTTP:', bucketPolicy.includes('aws:SecureTransport'));\n",
          "output": "Aurora StorageEncrypted: true\nValkey in transit / at rest: true true\nS3 denies plain HTTP: true",
          "explanation": "`enforceSSL: true` makes CDK add a bucket policy statement that denies any request whose `aws:SecureTransport` condition is false (not HTTPS); the script looks for that name in the policy. `storageEncrypted: true` on the Aurora cluster becomes `StorageEncrypted: true` in the template. The Valkey replication group (the L1 construct from topic 14) sets both encryption flags, and `cacheSubnetGroupName` names the subnet group that holds its nodes, which every replication group in a VPC needs, with or without TLS. The Aurora engine version helper `AuroraPostgresEngineVersion.of('17.7', '17')` gives full version 17.7 of major version 17."
        },
        {
          "language": "bash",
          "filename": "verify-encryption.sh",
          "source": "aws rds describe-db-clusters --db-cluster-identifier shop-prod --query 'DBClusters[0].StorageEncrypted'\naws elasticache describe-replication-groups --replication-group-id shop-cache --query 'ReplicationGroups[0].[TransitEncryptionEnabled,AtRestEncryptionEnabled]'",
          "output": "true\n[\n    true,\n    true\n]",
          "explanation": "These read the live resources, not your code. The first prints one boolean for the Aurora cluster. The second prints a two-item list: transit encryption first, then at-rest encryption. `shop-prod` and `shop-cache` are the example identifiers used throughout the course; substitute your own. Any `false` means the resource is not protected, whatever the CDK code says."
        }
      ],
      "productionNote": "Encryption on every layer is the baseline that audits and compliance reviews ask for. Run the verification commands as part of a release checklist, and use the same test technique as the IAM example to assert encryption flags in CI so nobody removes them by accident.",
      "commonMistakes": [
        "Encrypting only at the edge. HTTPS from the viewer to CloudFront does nothing for the hops behind it, so use HTTPS to the ALB, TLS to the database and `rediss://` to Valkey.",
        "Creating Aurora without `storageEncrypted: true`. You cannot switch encryption on for an existing cluster. The fix is to take a snapshot, copy it with encryption enabled, restore a new cluster from the copy, and move the app over, which is work and downtime you avoid by setting it at creation.",
        "Assuming Bun connects to the database over TLS. Bun's SQL client has `tls` set to false by default, so set `tls: true` (or a stricter mode such as verify-full) for real environments. Also remember that Valkey's `transitEncryptionEnabled` only helps if the client URL uses `rediss://`."
      ],
      "sources": [
        { "title": "Encrypting Amazon Aurora resources", "url": "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Overview.Encryption.html" },
        { "title": "ElastiCache in-transit encryption", "url": "https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/in-transit-encryption.html" },
        { "title": "Protecting data with encryption (Amazon S3)", "url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html" }
      ]
    },
    {
      "id": "image-scanning-patching",
      "title": "Image scanning and patching",
      "explanation": "A CVE (Common Vulnerabilities and Exposures entry) is a publicly known security flaw with an ID such as CVE-2026-12345. Your container image contains an operating system, the Bun runtime and your dependencies, and any of them can have CVEs. New ones are published every week, so an image that was clean when you built it can be vulnerable a month later.\n\nECR can scan images for you. Setting `imageScanOnPush: true` on the repository (its default is false) makes ECR scan every image as it is pushed and list findings grouped by severity (CRITICAL, HIGH, MEDIUM and so on). The first example synthesizes a repository with that flag. Save it as `repo-check.ts` in your CDK project and run `bun run repo-check.ts`.\n\nScanning only reports problems. To remove them you rebuild. Use `docker build --pull` so Docker fetches the newest copy of the base image tag instead of reusing an old local one. Pin the base image to a specific version, for example `oven/bun:1.4.5`, so builds are repeatable, and move the pin forward on purpose. Bun 1.4.5 is itself a security release: it updated components that affect TLS, DNS and HTTP handling. Update your own dependencies with `bun update`, which since Bun 1.4.0 also updates dependencies of dependencies.\n\nPatches only arrive if you rebuild, so schedule it. A GitHub Actions workflow (topic 16) can start on a timer with `on: schedule`, written as a cron expression, five fields for minute, hour, day of month, month and day of week, evaluated in UTC. `0 6 * * 1` means every Monday at 06:00 UTC. Scheduled workflows run from the default branch.\n\nFinally make the pipeline enforce the result. After the push, wait for the scan, read the CRITICAL count, and stop the pipeline if it is not zero, so a vulnerable image is never deployed. The bash example does this using the findings command.",
      "analogy": "Regular health check-ups and vaccine boosters for your containers. The scan is the check-up that finds problems. The rebuild is the booster that actually protects you, and it has to be repeated on a schedule because new threats keep appearing.",
      "code": [
        {
          "language": "typescript",
          "filename": "repo-check.ts",
          "source": "import { App, Stack } from 'aws-cdk-lib';\nimport { Template } from 'aws-cdk-lib/assertions';\nimport * as ecr from 'aws-cdk-lib/aws-ecr';\n\nconst stack = new Stack(new App(), 'RegistryStack');\nnew ecr.Repository(stack, 'Api', {\n  repositoryName: 'shop-api',\n  imageScanOnPush: true,\n});\n\nconst repo: any = Object.values(Template.fromStack(stack).findResources('AWS::ECR::Repository'))[0];\nconsole.log(JSON.stringify(repo.Properties.ImageScanningConfiguration));\n",
          "output": "{\"ScanOnPush\":true}",
          "explanation": "The repository construct from topic 9 gets one extra property. The synthesized template shows `ScanOnPush: true`, which tells ECR to scan every pushed image."
        },
        {
          "language": "bash",
          "filename": "scan-gate.sh",
          "source": "aws ecr wait image-scan-complete --repository-name shop-api --image-id imageTag=3f2a1c9\n\naws ecr describe-image-scan-findings --repository-name shop-api --image-id imageTag=3f2a1c9 --query 'imageScanFindings.findingSeverityCounts'\n\ncrit=$(aws ecr describe-image-scan-findings --repository-name shop-api --image-id imageTag=3f2a1c9 --query 'imageScanFindings.findingSeverityCounts.CRITICAL' --output text)\nif [ \"$crit\" != \"None\" ]; then\n  echo \"CRITICAL findings: $crit\"\n  exit 1\nfi",
          "output": "{\n    \"HIGH\": 1,\n    \"MEDIUM\": 4\n}",
          "explanation": "`aws ecr wait image-scan-complete` pauses until the scan has finished. The image is identified by its tag, the git SHA from topic 17 (`3f2a1c9` here). The second command prints counts per severity; the numbers vary per image and the sample shows one HIGH and four MEDIUM. The last part reads only the CRITICAL count as plain text. If there are none, the key is missing and the CLI prints `None`, so the script passes. In the sample run above no CRITICAL exists, so nothing more is printed and the script exits normally. If the image had two CRITICAL findings, it would print `CRITICAL findings: 2` and exit with code 1, which fails a CI job."
        },
        {
          "language": "yaml",
          "filename": ".github/workflows/weekly-rebuild.yml",
          "source": "name: weekly-rebuild\non:\n  schedule:\n    - cron: '0 6 * * 1'   # Mondays 06:00 UTC\n  workflow_dispatch:       # also allow a manual run\njobs:\n  rebuild:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Rebuild with fresh base image\n        run: docker build --pull -t shop-api:weekly .\n",
          "output": "",
          "explanation": "The `schedule` trigger starts the job every Monday at 06:00 UTC, and `workflow_dispatch` adds a button to run it by hand. The build step uses `--pull` so the base image is re-downloaded. In a real pipeline you would continue with the push and deploy steps from topic 17, so the freshly patched image replaces the running one."
        }
      ],
      "productionNote": "Make patching a routine, not a reaction. Scan on every push, rebuild weekly, fail the pipeline on CRITICAL findings, and review HIGH findings on a schedule. The patch cadence and upgrade routine are covered again in the operations topic.",
      "commonMistakes": [
        "Scanning but never acting. A findings list nobody reads protects nothing; assign an owner and a response time per severity.",
        "Never rebuilding the image. The code may change rarely, but the operating system packages in the base image are patched all the time, and those patches only arrive when you rebuild with `--pull`.",
        "Pinning the base tag forever, or the opposite, using a floating tag (a name such as `1` that quietly moves to newer images) so builds are not repeatable. Pin a version and update the pin deliberately."
      ],
      "sources": [
        { "title": "Scan images for software vulnerabilities in Amazon ECR", "url": "https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning.html" },
        { "title": "aws-cdk-lib.aws_ecr.RepositoryProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecr.RepositoryProps.html" },
        { "title": "Bun v1.4.5 release notes", "url": "https://bun.com/blog/bun-v1.4.5" }
      ]
    },
    {
      "id": "guardduty-security-hub",
      "title": "GuardDuty and Security Hub",
      "explanation": "Everything so far prevents attacks. You also need to notice the ones that get through. That is called detection.\n\nAmazon GuardDuty is a threat detection service. It reads AWS's own records, such as CloudTrail (the log of every API call in your account), VPC flow logs and DNS queries, and looks for suspicious behaviour: API calls from an unusual place, an instance that looks like it is mining cryptocurrency, traffic to known malicious IPs. Each result is called a finding and has a severity number. GuardDuty also offers Runtime Monitoring for ECS Fargate, which uses an agent inside your tasks to watch what the container itself does, such as unexpected processes or file access.\n\nAWS Security Hub CSPM (cloud security posture management) is the central place for findings. It collects them from GuardDuty and other services, and also runs best-practice checks against your configuration, for example flagging an S3 bucket that is public. Most of its checks need AWS Config recording enabled, because they read the configuration records Config keeps. It shows one dashboard across accounts and regions.\n\nEnable both in every account, not only production, because attackers will happily start in the weaker development account. In a multi-account setup (topic 4) the usual approach is to enable them organisation-wide and pick a delegated administrator, a member account (typically a dedicated security account) that is allowed to see and manage findings for all the others.\n\nA finding that nobody sees is wasted. Amazon EventBridge is the AWS service that routes events (including every GuardDuty finding) to targets using pattern rules. The example creates a rule that matches GuardDuty findings with severity 7 or higher, the high range, and sends them to an SNS topic (from topic 18) that can notify the on-call person.\n\nThe example uses L1 constructs for the detector and the hub. Save it as `detection-check.ts` in your CDK project and run `bun run detection-check.ts`. After deploying for real, `aws guardduty list-detectors` shows the detector ID.",
      "analogy": "A burglar alarm company watching the cameras across all your branches (GuardDuty), plus an inspector with a safety checklist who also collects every alarm report into one binder (Security Hub CSPM). The EventBridge rule is the phone call to the guard on duty when the alarm is serious.",
      "code": [
        {
          "language": "typescript",
          "filename": "detection-check.ts",
          "source": "import { App, Stack } from 'aws-cdk-lib';\nimport { Template } from 'aws-cdk-lib/assertions';\nimport * as events from 'aws-cdk-lib/aws-events';\nimport * as targets from 'aws-cdk-lib/aws-events-targets';\nimport * as guardduty from 'aws-cdk-lib/aws-guardduty';\nimport * as securityhub from 'aws-cdk-lib/aws-securityhub';\nimport * as sns from 'aws-cdk-lib/aws-sns';\n\nconst stack = new Stack(new App(), 'SecurityStack');\n\nnew guardduty.CfnDetector(stack, 'GuardDuty', { enable: true });\nnew securityhub.CfnHub(stack, 'SecurityHub', {});\n\nconst alerts = new sns.Topic(stack, 'SecurityAlerts');\nnew events.Rule(stack, 'HighFindings', {\n  eventPattern: {\n    source: ['aws.guardduty'],\n    detailType: ['GuardDuty Finding'],\n    detail: { severity: [{ numeric: ['>=', 7] }] },\n  },\n  targets: [new targets.SnsTopic(alerts)],\n});\n\nconst t = Template.fromStack(stack);\nconst rule: any = Object.values(t.findResources('AWS::Events::Rule'))[0];\nconsole.log('detectors:', Object.keys(t.findResources('AWS::GuardDuty::Detector')).length);\nconsole.log('hubs:', Object.keys(t.findResources('AWS::SecurityHub::Hub')).length);\nconsole.log('alert severity filter:', JSON.stringify(rule.Properties.EventPattern.detail.severity));\n",
          "output": "detectors: 1\nhubs: 1\nalert severity filter: [{\"numeric\":[\">=\",7]}]",
          "explanation": "`CfnDetector` with `enable: true` turns GuardDuty on in the account and region. `CfnHub` enables Security Hub CSPM. The EventBridge rule matches events whose source is `aws.guardduty` and whose `severity` is numerically at least 7, and its target publishes them to the SNS topic. Subscribe the on-call email or chat integration to that topic, as you did for alarms in topic 18. The script counts the synthesized detectors and hubs and prints the severity filter."
        },
        {
          "language": "bash",
          "filename": "check-guardduty.sh",
          "source": "aws guardduty list-detectors --query 'DetectorIds'",
          "output": "[\n    \"12abc34d567e8fa901bc2d34example\"\n]",
          "explanation": "After deploying, this lists the detector IDs in the current region. One ID means GuardDuty is on there; the ID shown is only an example. Run it per region you use."
        }
      ],
      "productionNote": "Treat these as detective controls: they tell you something is wrong after the fact, so they must reach a human. Route HIGH findings to the on-call channel, review the rest on a schedule, and connect them to the incident process in the operations topic. Turn on Runtime Monitoring for the Fargate tasks as well, because the account-level data sources cannot see inside a container.",
      "commonMistakes": [
        "Enabling GuardDuty and Security Hub only in the production account. Attackers often start in weaker accounts and move sideways.",
        "Enabling them but never reading the findings, or having no alert route. Detection with no response is just a log.",
        "Ignoring Runtime Monitoring for containers. Without it, GuardDuty cannot see what happens inside your Fargate tasks.",
        "Enabling them in one region only. Findings are per region, so enable every region you use."
      ],
      "sources": [
        { "title": "What is Amazon GuardDuty", "url": "https://docs.aws.amazon.com/guardduty/latest/ug/what-is-guardduty.html" },
        { "title": "GuardDuty Runtime Monitoring", "url": "https://docs.aws.amazon.com/guardduty/latest/ug/runtime-monitoring.html" },
        { "title": "What is AWS Security Hub CSPM", "url": "https://docs.aws.amazon.com/securityhub/latest/userguide/what-is-securityhub.html" }
      ]
    },
    {
      "id": "ddos-shield",
      "title": "DDoS protection with Shield",
      "explanation": "A DoS (denial of service) attack tries to make your site unusable by overwhelming it. A DDoS (distributed denial of service) attack does it from many machines at once, so you cannot just block one address. There are two broad kinds. Network and transport-layer attacks (layers 3 and 4, the raw network and TCP/UDP level) flood your connection with junk packets. Application-layer attacks (layer 7, HTTP) send many requests that look real, such as thousands of searches per second.\n\nAWS Shield is the DDoS protection service. Shield Standard is automatic and free for all AWS customers, and it protects against the common network and transport-layer attacks on CloudFront and Route 53. You do not configure it. Shield Advanced is a paid subscription for high-value targets. It adds protections for more resource types, access to the AWS response team during an attack, and cost protection (credits for scaling charges caused by an attack).\n\nShield Standard does not stop application-layer floods that look like normal visitors. You handle those with the layers you have already built. WAF rate-based rules refuse clients that send too much. CloudFront caching answers repeat requests at the edge, so they never reach your servers. Autoscaling (topic 19) adds capacity to absorb load, but only within the `maxCapacity` you set, which also caps the bill.\n\nThe design principle is to make the edge the only way in. Traffic should go user, CloudFront (Shield Standard plus WAF), ALB, ECS. The ALB should only accept requests that carry the secret origin header CloudFront adds (X-Origin-Verify, from topic 15), so an attacker who finds the ALB's DNS name cannot bypass the edge protections. The diagram and checklist below are the review you run before launch.",
      "analogy": "City flood barriers. Shield Standard is the barrier the city builds for everybody at no charge. WAF rules and caching are sandbags you place yourself where your street is weak. Shield Advanced is a subscription to an emergency crew that arrives when the flood is big, and also pays for pumping costs. A capped autoscaler is the limit on how many sandbags you are willing to buy.",
      "code": [
        {
          "language": "text",
          "filename": "launch-readiness.txt",
          "source": "user -> CloudFront (Shield Standard + WAF) -> ALB (origin header lock) -> ECS tasks\n\n[x] CloudFront in front of the app\n[x] WAF rate-based rule attached to the distribution\n[x] ALB not directly reachable (rejects requests without the origin header)\n[x] Autoscaling maxCapacity set to a sane number (cost cap)\n[ ] Attack runbook written (who is paged, what to turn on, who to call at AWS)",
          "output": "",
          "explanation": "This is a checklist, not a program, so it prints nothing. Every unchecked item is a launch blocker or a risk you accept knowingly. The last item is deliberately left open: most teams forget to write down in advance who does what during an attack."
        }
      ],
      "productionNote": "Run this checklist in the launch readiness review and again after major architecture changes. Decide ahead of time whether the site is valuable enough to justify Shield Advanced, and agree who can approve emergency WAF changes during an incident.",
      "commonMistakes": [
        "Leaving the ALB reachable from the internet without the origin header check. Attackers who find its DNS name skip CloudFront, WAF and Shield's edge protection.",
        "Autoscaling with no sensible maximum. During a flood the service scales up without limit, and the attack becomes a very large bill and may exhaust account quotas.",
        "Having no runbook. Working out who does what while the site is down wastes the most important minutes."
      ],
      "sources": [
        { "title": "AWS Shield and AWS WAF developer guide: Shield", "url": "https://docs.aws.amazon.com/waf/latest/developerguide/shield-chapter.html" },
        { "title": "AWS Shield Standard summary", "url": "https://docs.aws.amazon.com/waf/latest/developerguide/ddos-standard-summary.html" },
        { "title": "AWS Best Practices for DDoS Resiliency", "url": "https://docs.aws.amazon.com/whitepapers/latest/aws-best-practices-ddos-resiliency/welcome.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "How do you attach a WAF web ACL to a CloudFront distribution, compared with an Application Load Balancer?",
      "options": [
        "Both use the same CfnWebACLAssociation resource.",
        "CloudFront uses a security group rule; the ALB uses webAclId.",
        "CloudFront takes the web ACL ARN in the distribution's webAclId property; an ALB is linked with a CfnWebACLAssociation.",
        "Both require editing the origin's DNS record."
      ],
      "answerIndex": 2,
      "explanation": "CloudFront stores the WAFv2 ACL ARN directly on the distribution (webAclId), and the ACL must be a CLOUDFRONT-scope ACL created in us-east-1. Regional resources such as an ALB use a separate association resource."
    },
    {
      "question": "A rate-based rule blocks any IP above 2,000 requests per 300 seconds. An office with 500 employees shares one public IP. What is the risk?",
      "options": [
        "The whole office can be blocked together, because all their requests count against one IP.",
        "The rule will never apply to them, because offices are exempt.",
        "Each employee gets their own 2,000-request allowance automatically.",
        "The web ACL will stop working for every other visitor as well."
      ],
      "answerIndex": 0,
      "explanation": "Aggregation by IP counts all traffic from the shared address together, so heavy normal use by many people can pass the limit. Use a higher limit, watch in Count mode first, or choose a different aggregation key such as a custom key."
    },
    {
      "question": "Your Aurora cluster was created with storage encryption off. What can you do?",
      "options": [
        "Set storageEncrypted to true in CDK and redeploy to encrypt it in place.",
        "Turn it on in the console during the next maintenance window.",
        "Enable TLS on the connection, which also encrypts the stored data.",
        "Take a snapshot, copy it with encryption enabled, and restore a new cluster from the encrypted copy."
      ],
      "answerIndex": 3,
      "explanation": "At-rest encryption can only be chosen when the cluster is created. For an existing unencrypted cluster you migrate through an encrypted snapshot copy. TLS protects data in transit and does nothing for stored data."
    },
    {
      "question": "An ECR scan reports a CRITICAL vulnerability in the base image of your running service. What is the right fix?",
      "options": [
        "Delete the finding from the ECR console so the pipeline passes.",
        "Update the base image version if needed, rebuild with docker build --pull, push, scan again and redeploy.",
        "Restart the running tasks without changing the image.",
        "Add a WAF rule, because WAF patches operating system packages."
      ],
      "answerIndex": 1,
      "explanation": "The vulnerable package lives in the image, so only a new image fixes it. Rebuilding with --pull fetches the patched base, and the new image must be scanned and deployed. Restarting reuses the same image, and WAF filters web requests, it does not patch packages."
    },
    {
      "question": "Why is an autoscaling maxCapacity that is unlimited a security risk?",
      "options": [
        "Tasks above the limit lose their IAM roles.",
        "Autoscaling only works when a limit is set.",
        "An attack flood can make the service scale without bound, producing a huge bill and possibly exhausting quotas.",
        "More tasks make the ALB stop supporting HTTPS."
      ],
      "answerIndex": 2,
      "explanation": "Attack traffic that reaches the app triggers scale-out just like real traffic. A sensible maximum caps the cost and the blast radius while WAF and caching absorb the rest."
    }
  ]
});
