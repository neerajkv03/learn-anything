# 10. Load Balancing & DNS
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 02-linux-networking-basics, 06-app-production-readiness, 09-ecs-fargate

Domain plan for course: hosted zone `example.com` in each env account (dev uses `dev.example.com` subzone — just mention). ALB name `origin.example.com` (CloudFront in front, topic 15). API routes are under `/api/*`; if the learner's API isn't, use a host rule `api.example.com` instead (mention). Build ALB by hand (not ecs_patterns) because two services share one ALB; mention ApplicationLoadBalancedFargateService as the one-service shortcut.

## Learning goals
- Learner can create an ALB with HTTPS listener and target groups for api and web.
- Learner can tune health checks and deregistration delay for fast, safe deploys.
- Learner can issue a DNS-validated ACM certificate.
- Learner can route /api/* to the API and everything else to SSR web.
- Learner can point a Route 53 alias at the ALB.

## Sub-topics
### ALB listeners and target groups
- Concept: ALB = managed layer-7 load balancer across AZs, spreads HTTP requests over healthy targets. Listener = port+protocol (443 HTTPS, 80 HTTP). Target group = set of task IPs (targetType ip for Fargate) + health check. `service.attachToApplicationTargetGroup(tg)` or `listener.addTargets`. ALB idleTimeout default 60 s, http2 enabled default. internetFacing default false → set true (CloudFront needs public origin).
- Analogy: a hotel concierge desk at the entrance (listener) that sends guests to the right department (target group), only to staff currently at their desks (healthy targets).
- Code example: `const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", { vpc, internetFacing: true, securityGroup: albSg, vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC } }); const https = alb.addListener("Https", { port: 443, certificates: [cert], open: false, defaultAction: elbv2.ListenerAction.forward([webTg]) }); const apiTg = new elbv2.ApplicationTargetGroup(this, "ApiTg", { vpc, port: 3000, protocol: elbv2.ApplicationProtocol.HTTP, targetType: elbv2.TargetType.IP, targets: [apiService], deregistrationDelay: Duration.seconds(30), healthCheck: { path: "/healthz", interval: Duration.seconds(10), healthyThresholdCount: 2, unhealthyThresholdCount: 2, timeout: Duration.seconds(5) } });` (webTg same shape). `open: false` because albSg rules are controlled manually (topic 08/15).
- Production use: single ALB fronts both services; scaled automatically by AWS.
- Common mistakes: targetType instance for Fargate; `open: true` re-opening 0.0.0.0/0 after you locked it; ALB in private subnets when internet-facing.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.ApplicationLoadBalancerProps.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.ApplicationListener.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.ApplicationTargetGroupProps.html

### Health checks and deregistration delay
- Concept: defaults: path `/`, interval 30 s, timeout 6 s, healthy 5, unhealthy 2, codes 200 → slow: new task needs 5×30 = 150 s to receive traffic. Tuned: /healthz, 10 s, healthy 2 → 20 s. Deregistration delay default 300 s = ALB keeps a removed task for in-flight requests before cutting; app requests finish in ms → 30 s (must be < ECS stopTimeout 30s + drain window; keep app graceful shutdown from topic 06). ECS healthCheckGracePeriod default 60 s with LB.
- Analogy: a new waiter must serve 2 tables well (healthy threshold) before getting a full section; a waiter going off shift stops getting new tables but finishes current ones (deregistration).
- Code example: math in `health-timing.ts` — `const d=(interval:number,count:number)=>interval*count; console.log("default:", d(30,5), "s"); console.log("tuned:", d(10,2), "s");` → `default: 150 s`, `tuned: 20 s`.
- Production use: faster scale-out at traffic spikes, faster deploys.
- Common mistakes: health check path that needs auth (always 401 → unhealthy); dereg delay 300 s making every deploy 5+ minutes; unhealthy threshold 1 (flapping).
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.HealthCheck.html ; https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html ; https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-target-group-attributes.html#deregistration-delay

### HTTPS with ACM certificates
- Concept: ACM issues free public TLS certs, auto-renews. DNS validation (CNAME in Route 53, automatic in CDK) vs email (default — avoid). Cert must be in the ALB's region; CloudFront certs in us-east-1 (topic 15; our region is us-east-1 anyway). HTTPS listener requires exactly one default certificate. HTTP :80 listener redirects to 443.
- Analogy: a notarised ID card for your website, renewed automatically before it expires; DNS validation = proving you own the house by putting a sign in its front window.
- Code example: `const zone = route53.HostedZone.fromLookup(this, "Zone", { domainName: "example.com" }); const cert = new acm.Certificate(this, "OriginCert", { domainName: "origin.example.com", validation: acm.CertificateValidation.fromDnsMultiZone({ "origin.example.com": zone }) }); alb.addRedirect({ sourcePort: 80, targetPort: 443 });` Expected: `curl -sI http://origin.example.com/api/healthz | head -n 1` → `HTTP/1.1 301 Moved Permanently`.
- Production use: TLS everywhere at the edge and origin.
- Common mistakes: email validation stuck pending; cert in wrong region; forgetting SAN for extra names.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager.Certificate.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53.HostedZone.html ; https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html

### Path and host routing for API and web
- Concept: listener rules: conditions (pathPatterns, hostHeaders, httpHeader, sourceIps) + priority (lower = first) + action; one default action without conditions. `/api/*` → apiTg priority 10; default → webTg (SSR). Host rule alternative `api.example.com`.
- Analogy: post office sorting: letters with "API" on the envelope go to bin 10 first; everything else lands in the general bin.
- Code example: `https.addAction("Api", { priority: 10, conditions: [elbv2.ListenerCondition.pathPatterns(["/api/*"])], action: elbv2.ListenerAction.forward([apiTg]) });` Expected: `curl -s https://origin.example.com/api/healthz` → `ok` (from api); `curl -s -o /dev/null -w "%{http_code}\n" https://origin.example.com/` → `200` (from web SSR).
- Production use: one ALB, two services; CloudFront behaviours mirror these paths (topic 15).
- Common mistakes: duplicate priorities (deploy error); `/api` pattern missing trailing `/*`; API routes not actually prefixed with /api.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.ListenerCondition.html ; https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-update-rules.html

### Route 53 records
- Concept: hosted zone = DNS records for a domain. Alias A record → AWS resource (ALB, CloudFront), free, works at zone apex, follows IP changes; CDK renders ALB alias with `dualstack.` prefix. `evaluateTargetHealth`. fromLookup needs concrete stack env.
- Analogy: a contacts entry that auto-updates when your friend changes numbers (alias) vs a hand-typed number (A record with fixed IP).
- Code example: `new route53.ARecord(this, "OriginRecord", { zone, recordName: "origin", target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(alb)) });` `dig +short origin.example.com` → several IPs (vary; ALB scales its nodes).
- Production use: origin.example.com for CloudFront; www.example.com → CloudFront (topic 15).
- Common mistakes: CNAME at apex; hardcoding ALB IPs (they change); creating records in the wrong account's zone.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53_targets-readme.html ; https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html

## Quiz
1. With interval 15 s and healthy threshold 3, how long until a new task gets traffic? — tests health math (45 s).
2. Why lower deregistration delay from 300 s for this API? — tests draining.
3. Rule priority 10 `/api/*` and default web. Where does `/api` (no slash) go? — tests path patterns.
4. Why use an alias record instead of CNAME at example.com? — tests alias.
5. Why DNS validation over email for ACM? — tests ACM.
