# 21. Security Hardening
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 03-aws-fundamentals, 09-ecs-fargate, 11-aurora-postgresql, 14-elasticache-valkey, 15-cloudfront-frontend

## Learning goals
- Learner can attach a WAF web ACL with managed rules and a rate-based rule to CloudFront.
- Learner can tighten IAM with CDK grant methods and spot over-broad policies.
- Learner can verify encryption in transit and at rest across all layers.
- Learner can scan and patch container images.
- Learner can enable GuardDuty/Security Hub and explain Shield's DDoS protection.

## Sub-topics
### AWS WAF and rate-based rules
- Concept: WAF = firewall for HTTP: rules inspect requests, Allow/Block/Count. Web ACL scope CLOUDFRONT (must be created in us-east-1) vs REGIONAL (ALB). Attach to CloudFront via distribution `webAclId` (WAFv2 ARN), NOT CfnWebACLAssociation (that's for ALB etc.). Managed group AWSManagedRulesCommonRuleSet (700 WCU of 1,500 limit). Rate-based rule: limit per evaluation window (60/120/300/600 s, default 300; min limit 10), aggregate by IP (or FORWARDED_IP/custom keys); WAF re-checks about every 10 s. Start new rules in Count mode, watch, then Block.
- Analogy: a bouncer with a list of known troublemaker tricks (managed rules) and a clicker: anyone entering more than N times in 5 minutes waits outside.
- Code example: `const webAcl = new wafv2.CfnWebACL(this, "CdnAcl", { scope: "CLOUDFRONT", defaultAction: { allow: {} }, visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: "shop-cdn", sampledRequestsEnabled: true }, rules: [ { name: "Common", priority: 0, overrideAction: { none: {} }, statement: { managedRuleGroupStatement: { vendorName: "AWS", name: "AWSManagedRulesCommonRuleSet" } }, visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: "common", sampledRequestsEnabled: true } }, { name: "RatePerIp", priority: 1, action: { block: {} }, statement: { rateBasedStatement: { limit: 2000, evaluationWindowSec: 300, aggregateKeyType: "IP" } }, visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: "rate", sampledRequestsEnabled: true } } ] });` then `webAclId: webAcl.attrArn` on Distribution (topic 15). Behaviour: one IP sending 2,500 requests in 5 minutes → blocked (403) for subsequent requests until rate drops.
- Production use: edge protection before traffic hits ALB.
- Common mistakes: rate limit too low for users behind shared NAT/offices; WAF ACL in wrong region; going straight to Block on managed rules (false positives on uploads).
- Sources: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-wafv2-webacl.html#cfn-wafv2-webacl-scope ; https://docs.aws.amazon.com/waf/latest/APIReference/API_RateBasedStatement.html ; https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-baseline.html#aws-managed-rule-groups-baseline-crs ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront.DistributionProps.html

### Least-privilege IAM
- Concept: grant exactly needed actions on exact resources. CDK grant methods generate scoped policies: `bucket.grantRead(role)`, `secret.grantRead(role)`, `proxy.grantConnect(role, "shop_app")`, `repo.grantPullPush(role)`. Separate roles per service; deploy role assumes only CDK roles; review with IAM Access Analyzer (mention). No `*:*`.
- Analogy: giving the cleaner keys to the corridors, not the safe.
- Code example: bad `taskRole.addToPolicy(new iam.PolicyStatement({ actions: ["s3:*"], resources: ["*"] }))` vs good `assetsBucket.grantRead(taskRole)`. Assertion on good: `hasResourceProperties("AWS::IAM::Policy", { PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Effect: "Allow", Action: Match.arrayWith(["s3:GetObject*"]) })]) } })` passes; and a test that no statement has `Action: "*"` (use Template.findResources + loop).
- Production use: every role in the stack; CI test guards regressions.
- Common mistakes: wildcard resources "just for now"; shared role between api and migrations; admin deploy role.
- Sources: https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege ; https://docs.aws.amazon.com/cdk/v2/guide/permissions.html ; https://docs.aws.amazon.com/IAM/latest/UserGuide/what-is-access-analyzer.html

### Encryption in transit and at rest
- Concept: in transit: viewer HTTPS (CloudFront redirect/HTTPS only; min TLS 1.2), CloudFront → ALB HTTPS_ONLY, app → RDS Proxy requireTLS, Bun.sql tls, Valkey transitEncryptionEnabled + rediss://, S3 enforceSSL. At rest: Aurora storageEncrypted true (must set at creation), Valkey atRestEncryptionEnabled, S3 default encryption, Secrets Manager (KMS), log groups optional KMS. KMS (gloss: AWS key service).
- Analogy: armoured trucks between buildings (transit) and locked safes inside each building (at rest).
- Code example: checklist table with layer → setting → how to verify. Verify Aurora: `aws rds describe-db-clusters --db-cluster-identifier shop-prod --query "DBClusters[0].StorageEncrypted"` → `true`; Valkey: `aws elasticache describe-replication-groups --replication-group-id <id> --query "ReplicationGroups[0].[TransitEncryptionEnabled,AtRestEncryptionEnabled]"` → `[true, true]`.
- Production use: compliance baseline; audits.
- Common mistakes: TLS at edge only; Aurora created unencrypted (needs snapshot-restore to fix); Bun.sql default tls false.
- Sources: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Overview.Encryption.html ; https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/in-transit-encryption.html ; https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront.DistributionProps.html

### Image scanning and patching
- Concept: CVE (gloss: publicly known vulnerability). ECR scan on push (imageScanOnPush) reports findings by severity; rebuild regularly with `docker build --pull` and pinned-but-updated base (`oven/bun:1.4.5` → next patch, e.g. Bun 1.4.5 was itself a security release); `bun update` for deps; weekly scheduled CI rebuild (`on: schedule`). Fail pipeline on CRITICAL findings.
- Analogy: regular health check-ups and vaccine boosters for your containers.
- Code example: `aws ecr describe-image-scan-findings --repository-name shop-api --image-id imageTag=3f2a1c9 --query "imageScanFindings.findingSeverityCounts"` → JSON like `{"HIGH": 1, "MEDIUM": 4}` (values vary). Workflow trigger: `on: { schedule: [ { cron: "0 6 * * 1" } ] }` → Mondays 06:00 UTC rebuild.
- Production use: patch cadence (topic 23).
- Common mistakes: scanning but never acting; image never rebuilt so base OS patches never land; base tag pinned forever.
- Sources: https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecr.RepositoryProps.html ; https://bun.com/blog/bun-v1.4.5 ; https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

### GuardDuty and Security Hub
- Concept: GuardDuty = threat detection from AWS logs (unusual API calls, crypto mining, malicious IPs) + Runtime Monitoring for ECS Fargate. Security Hub = central findings + best-practice checks (e.g. "S3 bucket public"). Enable in every account (ideally org-wide via delegated admin in a security account). Route HIGH findings to SNS/on-call.
- Analogy: a burglar alarm company watching cameras across all your branches, plus an inspector with a safety checklist.
- Code example: CDK L1: `new guardduty.CfnDetector(this, "GuardDuty", { enable: true });` and `new securityhub.CfnHub(this, "SecurityHub", {});` → after deploy `aws guardduty list-detectors --query "DetectorIds"` → one id.
- Production use: detective controls (topic 23 incident response).
- Common mistakes: enabled only in prod; findings unread; ignoring runtime monitoring for containers.
- Sources: https://docs.aws.amazon.com/guardduty/latest/ug/what-is-guardduty.html ; https://docs.aws.amazon.com/guardduty/latest/ug/runtime-monitoring.html ; https://docs.aws.amazon.com/securityhub/latest/userguide/what-is-securityhub.html

### DDoS protection with Shield
- Concept: DDoS (gloss: flood of traffic from many machines to knock a site over). Shield Standard: automatic, free, on CloudFront/Route 53 (network/transport-layer attacks). App-layer floods handled by WAF rate rules + CloudFront caching + autoscaling. Shield Advanced: paid, response team, cost protection — consider for high-value targets.
- Analogy: city flood barriers (Shield Standard) for everyone, plus sandbags you place yourself (WAF rules), and an emergency service you can subscribe to (Advanced).
- Code example: none beyond architecture: diagram `user → CloudFront (Shield Std + WAF) → ALB (origin header lock) → ECS`. Checklist: CloudFront in front ✓, WAF rate rule ✓, ALB not directly reachable ✓, autoscaling max sane ✓ (cost cap).
- Production use: launch readiness review.
- Common mistakes: exposing ALB directly (bypasses edge protection); autoscaling without max → attack becomes a bill; no runbook for attacks.
- Sources: https://docs.aws.amazon.com/waf/latest/developerguide/shield-chapter.html ; https://docs.aws.amazon.com/waf/latest/developerguide/ddos-standard-summary.html ; https://docs.aws.amazon.com/whitepapers/latest/aws-best-practices-ddos-resiliency/welcome.html

## Quiz
1. How is a WAF web ACL attached to CloudFront vs an ALB? — tests webAclId vs association.
2. Rate rule limit 2,000 per 300 s; an office of 500 users behind one IP — risk? — tests aggregation key.
3. Aurora was created unencrypted; can you flip the setting? — tests at-rest at creation.
4. Scan shows a CRITICAL in the base image; steps to fix? — tests rebuild with --pull.
5. Why is an unlimited maxCapacity a security risk? — tests DDoS cost.
