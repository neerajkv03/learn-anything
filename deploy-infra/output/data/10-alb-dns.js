window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "10-alb-dns",
  "order": 10,
  "title": "Load Balancing & DNS",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Put one Application Load Balancer (ALB, a managed AWS service that spreads web requests over your running tasks) in front of the API and web services. You will tune its health checks, give it a free HTTPS certificate from AWS Certificate Manager (ACM), route /api/* to the API and everything else to the web app, and point a Route 53 (AWS's DNS service) name at it.",
  "prerequisites": ["02-linux-networking-basics", "06-app-production-readiness", "09-ecs-fargate"],
  "subtopics": [
    {
      "id": "alb-listeners-target-groups",
      "title": "ALB listeners and target groups",
      "explanation": "A load balancer is a server that sits in front of several copies of your app and shares the incoming requests between them. An Application Load Balancer (ALB) is AWS's managed version. It works at layer 7, meaning it understands HTTP (URLs, headers, methods) and not just raw network traffic. AWS runs it across several availability zones (AZs, separate data centres in one region), so you do not patch or scale it yourself.\n\nAn ALB has two main building blocks. A listener is a port plus a protocol that the ALB waits on, for example 443 for HTTPS or 80 for plain HTTP. A target group is the list of places the ALB can send requests to (called targets), together with a health check that decides which targets are fit to receive traffic.\n\nFor Fargate, every task has its own private IP address (topic 09), so the target group uses `targetType: IP`. The other type, `instance`, registers whole virtual machines and does not work with Fargate tasks. Passing `targets: [webService]` registers the ECS service, and ECS keeps the target group in sync as tasks start and stop.\n\nTwo ALB defaults matter here. `internetFacing` defaults to false, which creates an internal ALB that the public internet cannot reach. We set it to true, and place the ALB in public subnets, because CloudFront (AWS's global content delivery network, covered in topic 15) will call it over the internet. `idleTimeout` defaults to 60 seconds: the ALB closes a connection that carries no data for that long. HTTP/2 is on by default.\n\nSecurity groups (topic 08) decide who may talk to the ALB. A listener's `open` option defaults to true, which adds a rule allowing 0.0.0.0/0 (the whole internet) to the listener port. We set `open: false` and write the security group rules ourselves, so nothing silently re-opens access. For now we allow port 80 from anywhere. Later topics tighten this.\n\nThe example below builds the ALB with a plain HTTP listener on port 80 and one target group for the web service. Sub-topic 3 replaces the HTTP listener with HTTPS. The API target group is added in sub-topic 4, because it needs a routing rule. To run it you would save it as `lib/alb-stack.ts` in your CDK project. In the code, `interface` declares which inputs the stack needs, and `ec2.IVpc` after a name is a TypeScript type annotation (it states what kind of value the name holds).\n\nIf your app has only one service, the pattern `ecs_patterns.ApplicationLoadBalancedFargateService` creates the ALB, listener, target group and service in one construct. We build by hand because two services share one ALB.",
      "analogy": "Think of a hotel concierge desk at the entrance. The desk (the listener) is where every guest arrives, and it sends each guest to the right department (a target group). It only sends guests to staff who are currently at their desks (healthy targets), and it keeps working even when individual staff come and go.",
      "code": [
        {
          "language": "typescript",
          "filename": "lib/alb-stack.ts",
          "source": "import * as cdk from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport * as ecs from \"aws-cdk-lib/aws-ecs\";\nimport * as elbv2 from \"aws-cdk-lib/aws-elasticloadbalancingv2\";\nimport { Construct } from \"constructs\";\n\ninterface AlbStackProps extends cdk.StackProps {\n  vpc: ec2.IVpc;\n  webService: ecs.FargateService;\n}\n\nexport class AlbStack extends cdk.Stack {\n  constructor(scope: Construct, id: string, props: AlbStackProps) {\n    super(scope, id, props);\n    const { vpc, webService } = props;\n\n    const albSg = new ec2.SecurityGroup(this, \"AlbSg\", { vpc, allowAllOutbound: true });\n    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), \"HTTP from the internet (temporary)\");\n\n    const alb = new elbv2.ApplicationLoadBalancer(this, \"Alb\", {\n      vpc,\n      internetFacing: true,\n      securityGroup: albSg,\n      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },\n    });\n\n    const webTg = new elbv2.ApplicationTargetGroup(this, \"WebTg\", {\n      vpc,\n      port: 3000,\n      protocol: elbv2.ApplicationProtocol.HTTP,\n      targetType: elbv2.TargetType.IP,\n      targets: [webService],\n    });\n\n    alb.addListener(\"Http\", {\n      port: 80,\n      open: false,\n      defaultAction: elbv2.ListenerAction.forward([webTg]),\n    });\n  }\n}\n",
          "output": "",
          "explanation": "The file prints nothing; running `bun run cdk synth` (topic 07) turns it into a CloudFormation template. `vpcSubnets` puts the ALB in the public subnets. The target group sends traffic to port 3000 over HTTP, which is where the web container listens. The listener on port 80 forwards every request to `webTg` by default, and `open: false` stops CDK from adding its own 0.0.0.0/0 rule."
        }
      ],
      "productionNote": "One ALB can front several services, and AWS scales the ALB for you, so you do not size it. Keep one ALB per environment rather than one per service, because each ALB has a fixed hourly cost.",
      "commonMistakes": [
        "Using `targetType: INSTANCE` for Fargate. Fargate tasks have their own IP addresses and no instance to register, so use `IP`.",
        "Leaving `open` at its default of true after you carefully restricted the ALB security group. CDK adds a 0.0.0.0/0 rule for you.",
        "Putting an internet-facing ALB in private subnets, or forgetting `internetFacing: true`. The ALB is then not reachable from the internet, and CloudFront cannot use it as an origin.",
        "Forgetting that the task security group must allow traffic from the ALB security group on the container port. Without that, health checks time out and tasks never become healthy."
      ],
      "sources": [
        { "title": "ApplicationLoadBalancerProps (CDK API)", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.ApplicationLoadBalancerProps.html" },
        { "title": "ApplicationListener (CDK API)", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.ApplicationListener.html" },
        { "title": "ApplicationTargetGroupProps (CDK API)", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.ApplicationTargetGroupProps.html" }
      ]
    },
    {
      "id": "health-checks-deregistration",
      "title": "Health checks and deregistration delay",
      "explanation": "A health check is a small request the ALB sends to each target on a schedule (here, a GET to a path such as `/healthz` from topic 06). If the target answers with an expected status code, it counts as a pass. The `interval` is the time between checks, and `timeout` is how long the ALB waits for an answer.\n\nA target does not flip state on one result. The healthy threshold is how many passes in a row make a new target healthy, and the unhealthy threshold is how many failures in a row make it unhealthy. The CDK defaults are: path `/`, interval 30 s, timeout 6 s, healthy threshold 5, unhealthy threshold 2, success code 200.\n\nWith those defaults a new task needs about 5 checks x 30 s = 150 s before it receives any traffic. That makes deploys and scale-out slow. With path `/healthz`, interval 10 s and healthy threshold 2 it needs about 2 x 10 = 20 s. The program below does that arithmetic. It is an estimate: the real time also includes the time until the first check runs.\n\nDeregistration delay is what happens in the other direction. When a task is being removed, the ALB stops sending it new requests but waits this long so in-flight requests (requests already being handled) can finish before the connection is cut. This is also called connection draining. The default is 300 s, which suits long downloads, but our API answers in milliseconds, so 30 s is plenty. Keep the graceful shutdown from topic 06 (stop on SIGTERM, finish pending requests) so the app itself also drains cleanly.\n\nThe second example shows these settings on a target group. ECS also has `healthCheckGracePeriod`, which defaults to 60 s when a load balancer is used. During that period ECS ignores failing load balancer health checks for a new task, so a slow-starting app is not killed early.",
      "analogy": "A new waiter must serve 2 tables well (the healthy threshold) before being given a full section. A waiter going off shift stops receiving new tables but is allowed to finish the tables they already have (deregistration delay).",
      "code": [
        {
          "language": "typescript",
          "filename": "health-timing.ts",
          "source": "const d = (interval: number, count: number) => interval * count;\n\nconsole.log(\"default:\", d(30, 5), \"s\");\nconsole.log(\"tuned:\", d(10, 2), \"s\");\n",
          "output": "default: 150 s\ntuned: 20 s",
          "explanation": "Run it with `bun run health-timing.ts`. The function multiplies the check interval by the healthy threshold, which approximates how long a new task waits before it gets traffic."
        },
        {
          "language": "typescript",
          "filename": "lib/tuned-target-group.ts",
          "source": "import { Duration } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport * as ecs from \"aws-cdk-lib/aws-ecs\";\nimport * as elbv2 from \"aws-cdk-lib/aws-elasticloadbalancingv2\";\nimport { Construct } from \"constructs\";\n\nexport function tunedTargetGroup(\n  scope: Construct,\n  id: string,\n  vpc: ec2.IVpc,\n  service: ecs.FargateService,\n): elbv2.ApplicationTargetGroup {\n  return new elbv2.ApplicationTargetGroup(scope, id, {\n    vpc,\n    port: 3000,\n    protocol: elbv2.ApplicationProtocol.HTTP,\n    targetType: elbv2.TargetType.IP,\n    targets: [service],\n    deregistrationDelay: Duration.seconds(30),\n    healthCheck: {\n      path: \"/healthz\",\n      interval: Duration.seconds(10),\n      timeout: Duration.seconds(5),\n      healthyThresholdCount: 2,\n      unhealthyThresholdCount: 2,\n    },\n  });\n}\n",
          "output": "",
          "explanation": "`Duration.seconds(30)` is CDK's way to write a length of time. The helper function replaces the plain target group from sub-topic 1, and you can call it for both the web and API services. The interval (10 s) must be larger than the timeout (5 s). The unhealthy threshold stays at 2 so a single slow response does not remove a good task."
        }
      ],
      "productionNote": "Fast health checks shorten deploys and let new tasks take load quickly during traffic spikes. Point the check at a cheap liveness endpoint like `/healthz` that needs no login and does not call the database, so a database hiccup does not mark every task unhealthy at once.",
      "commonMistakes": [
        "Pointing the health check at a path that needs authentication. It always answers 401 (unauthorised), which is not an expected code, so every target stays unhealthy.",
        "Leaving deregistration delay at 300 s for a fast API. Every deploy then waits five or more minutes for old tasks to drain.",
        "Setting the unhealthy threshold to 1. One slow response removes a task, and tasks flap in and out of service."
      ],
      "sources": [
        { "title": "HealthCheck (CDK API)", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.HealthCheck.html" },
        { "title": "Health checks for ALB target groups", "url": "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html" },
        { "title": "Target group attributes: deregistration delay", "url": "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-target-group-attributes.html#deregistration-delay" }
      ]
    },
    {
      "id": "https-acm-certificates",
      "title": "HTTPS with ACM certificates",
      "explanation": "HTTPS needs a TLS certificate (topic 02): a file that proves the server really owns its domain name. AWS Certificate Manager (ACM) issues public certificates for free and renews them automatically, as long as the validation record stays in place.\n\nBefore issuing, ACM wants proof that you control the domain. With DNS validation, ACM gives you a CNAME record (topic 02) to publish in the domain's DNS zone, and when it sees the record it issues the certificate. CDK can create that record for you in Route 53. The other method, email validation, is the CDK default: it sends a message to addresses at the domain and waits for a person to click a link. That is manual and easy to leave pending forever, so always choose DNS validation.\n\nA Route 53 hosted zone is the container for all DNS records of one domain. `HostedZone.fromLookup` finds an existing zone by domain name. It asks AWS while you run `cdk synth`, so the stack must have a concrete `env` (account and region), as in the second example. CDK saves the answer in `cdk.context.json`, and you should commit that file.\n\nThe certificate must be in the same region as the ALB. (CloudFront certificates must be in us-east-1, which topic 15 covers. Our region is us-east-1 anyway.) An HTTPS listener needs exactly one default certificate, passed in `certificates`. If you later want the same certificate to cover more names, list them in `subjectAlternativeNames`, the extra domain names the certificate is valid for.\n\nFinally, `alb.addRedirect` creates a listener on port 80 that answers every request with a 301 (permanent redirect) to port 443, so plain HTTP visitors are moved to HTTPS. Its `open: false` keeps our rule that we write security group rules ourselves. The example below replaces the HTTP listener from sub-topic 1 and opens port 443 and 80 on the ALB security group.",
      "analogy": "A certificate is a notarised ID card for your website, and ACM renews it automatically before it expires. DNS validation is like proving you own a house by putting a sign in its front window: only the owner can change what is in the window.",
      "code": [
        {
          "language": "typescript",
          "filename": "lib/alb-stack.ts",
          "source": "import * as cdk from \"aws-cdk-lib\";\nimport * as acm from \"aws-cdk-lib/aws-certificatemanager\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport * as ecs from \"aws-cdk-lib/aws-ecs\";\nimport * as elbv2 from \"aws-cdk-lib/aws-elasticloadbalancingv2\";\nimport * as route53 from \"aws-cdk-lib/aws-route53\";\nimport { Construct } from \"constructs\";\n\ninterface AlbStackProps extends cdk.StackProps {\n  vpc: ec2.IVpc;\n  webService: ecs.FargateService;\n}\n\nexport class AlbStack extends cdk.Stack {\n  constructor(scope: Construct, id: string, props: AlbStackProps) {\n    super(scope, id, props);\n    const { vpc, webService } = props;\n\n    const zone = route53.HostedZone.fromLookup(this, \"Zone\", { domainName: \"example.com\" });\n    const cert = new acm.Certificate(this, \"OriginCert\", {\n      domainName: \"origin.example.com\",\n      validation: acm.CertificateValidation.fromDnsMultiZone({ \"origin.example.com\": zone }),\n    });\n\n    const albSg = new ec2.SecurityGroup(this, \"AlbSg\", { vpc, allowAllOutbound: true });\n    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), \"HTTPS from the internet (temporary)\");\n    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), \"HTTP, only to redirect (temporary)\");\n\n    const alb = new elbv2.ApplicationLoadBalancer(this, \"Alb\", {\n      vpc,\n      internetFacing: true,\n      securityGroup: albSg,\n      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },\n    });\n\n    const webTg = new elbv2.ApplicationTargetGroup(this, \"WebTg\", {\n      vpc,\n      port: 3000,\n      protocol: elbv2.ApplicationProtocol.HTTP,\n      targetType: elbv2.TargetType.IP,\n      targets: [webService],\n    });\n\n    alb.addListener(\"Https\", {\n      port: 443,\n      certificates: [cert],\n      open: false,\n      defaultAction: elbv2.ListenerAction.forward([webTg]),\n    });\n\n    alb.addRedirect({ sourcePort: 80, targetPort: 443, open: false });\n  }\n}\n",
          "output": "",
          "explanation": "The certificate is created with DNS validation, so CDK adds the validation CNAME record to the `example.com` zone for you. The HTTPS listener on 443 takes the certificate and forwards to the web target group. The redirect listener sends port 80 traffic to 443."
        },
        {
          "language": "typescript",
          "filename": "bin/app.ts",
          "source": "import * as cdk from \"aws-cdk-lib\";\nimport { AlbStack } from \"../lib/alb-stack\";\n// NetworkStack and ServicesStack are the stacks you wrote in topics 08 and 09.\nimport { NetworkStack } from \"../lib/network-stack\";\nimport { ServicesStack } from \"../lib/services-stack\";\n\nconst app = new cdk.App();\nconst env = { account: \"111111111111\", region: \"us-east-1\" };\n\nconst network = new NetworkStack(app, \"Network\", { env, natGateways: 1 });\nconst services = new ServicesStack(app, \"Services\", { env, vpc: network.vpc });\nnew AlbStack(app, \"Alb\", { env, vpc: network.vpc, webService: services.webService });\n",
          "output": "",
          "explanation": "`HostedZone.fromLookup` only works because the stack is given a concrete `env`. Use the real account ID of the environment you deploy to (111111111111 is a placeholder from topic 04). After deploying, check the redirect from a terminal with `curl -sI http://origin.example.com/ | head -n 1`, which prints `HTTP/1.1 301 Moved Permanently`. Two things the file needs. `ServicesStack` must take a `vpc` input and expose `webService` (the shop-web service). Topic 09 built only the API service, so add a web service the same way and expose it as `webService`. Later, in bin/app.ts pass `apiService: services.apiService` to `AlbStack`."
        }
      ],
      "productionNote": "Use TLS at the edge and at the origin. The browser talks HTTPS to CloudFront, and CloudFront talks HTTPS to this ALB, using the certificate you just issued. ACM renews it automatically, so no one has to remember an expiry date.",
      "commonMistakes": [
        "Leaving the default email validation. The certificate stays in the pending state until someone clicks a link, and a CloudFormation deploy waits on it.",
        "Creating the certificate in a different region from the ALB. The listener cannot use it.",
        "Forgetting subject alternative names. A certificate for `origin.example.com` is not valid for `api.example.com`, so browsers and clients reject the connection."
      ],
      "sources": [
        { "title": "Certificate (CDK API)", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager.Certificate.html" },
        { "title": "HostedZone (CDK API)", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53.HostedZone.html" },
        { "title": "ACM DNS validation", "url": "https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html" }
      ]
    },
    {
      "id": "path-host-routing",
      "title": "Path and host routing for API and web",
      "explanation": "One ALB can send different requests to different target groups. You do this with listener rules. A rule has conditions (what the request must look like), a priority (a number; the ALB checks rules from the lowest number to the highest and stops at the first match) and an action (what to do, usually forward to a target group).\n\nCommon conditions are `pathPatterns` (match the URL path, where `*` is a wildcard), `hostHeaders` (match the `Host` header, meaning the domain name the client asked for), `httpHeader` and `sourceIps`. Every listener also has one default action with no conditions. It handles any request that no rule matched, and CDK requires that one exists.\n\nOur plan: the API routes live under `/api/*`, so a rule with priority 10 and the path pattern `/api/*` forwards to the API target group. Everything else falls to the default action, the web (server-side rendered, SSR) target group. Each priority number can be used only once per listener, and CDK fails the deployment on duplicates.\n\nIf your API is not under `/api`, use a host rule instead: `ListenerCondition.hostHeaders([\"api.example.com\"])`. That needs a certificate and a DNS record for that name as well.\n\nThe code below builds the API target group with the same helper as sub-topic 2, then adds the rule to the HTTPS listener. Keep the listener in a variable, as `https`, when you create it: change `alb.addListener(\"Https\", ...)` from sub-topic 3 to `const https = alb.addListener(\"Https\", ...)`. Note that the pattern `/api/*` does not match the bare path `/api`, because the pattern requires the slash. That request goes to the web app.",
      "analogy": "A post office sorting room. Letters with API on the envelope go into bin 10 first. Everything else lands in the general bin. Bins are checked in number order, so the most specific rule gets the lowest number.",
      "code": [
        {
          "language": "typescript",
          "filename": "lib/alb-stack-routing.ts",
          "source": "// Add inside the AlbStack constructor from sub-topic 3, after the Https listener.\n// `https` is the value returned by alb.addListener(\"Https\", ...).\n// `tunedTargetGroup` is the helper from sub-topic 2; `apiService` is a new prop of type ecs.FargateService.\nconst apiTg = tunedTargetGroup(this, \"ApiTg\", vpc, apiService);\n\nhttps.addAction(\"Api\", {\n  priority: 10,\n  conditions: [elbv2.ListenerCondition.pathPatterns([\"/api/*\"])],\n  action: elbv2.ListenerAction.forward([apiTg]),\n});\n",
          "output": "",
          "explanation": "This is a fragment, not a standalone file. `addAction` creates a listener rule. Requests whose path starts with `/api/` go to `apiTg`. All other requests still hit the default action, which forwards to `webTg`. At the top of lib/alb-stack.ts add `import { tunedTargetGroup } from \"./tuned-target-group\";`. After deploying, any request to a path under `/api/` is answered by the API (the app serves `/healthz`, not `/api/healthz`, so use one of your real API routes), and `curl -s -o /dev/null -w \"%{http_code}\\n\" https://origin.example.com/` prints `200` (answered by the web app)."
        }
      ],
      "productionNote": "One ALB serves both services. In topic 15, CloudFront behaviours (its own path-based rules) mirror these paths, so `/api/*` reaches the API through CloudFront too.",
      "commonMistakes": [
        "Reusing a priority number on the same listener. The deployment fails with a duplicate priority error.",
        "Writing the pattern as `/api` instead of `/api/*`. Requests below `/api/` do not match and go to the web app.",
        "Routing `/api/*` to the API when the app's routes are not actually prefixed with `/api`. The API then answers 404 (not found) for every request."
      ],
      "sources": [
        { "title": "ListenerCondition (CDK API)", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticloadbalancingv2.ListenerCondition.html" },
        { "title": "ALB listener rules", "url": "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-update-rules.html" }
      ]
    },
    {
      "id": "route53-records",
      "title": "Route 53 records",
      "explanation": "The ALB gets an AWS-generated name that is long and not memorable. To use `origin.example.com`, you add a DNS record in the hosted zone (the container of records for `example.com`, from sub-topic 3) that points your name at the ALB.\n\nThe right record type is an alias A record. An alias is a Route 53 feature that points a name at an AWS resource such as an ALB or a CloudFront distribution. It costs nothing, Route 53 keeps it up to date when AWS changes the ALB's IP addresses, and it works at the zone apex (`example.com` itself). A plain CNAME cannot be placed at the apex, and a plain A record with a fixed IP would break when the ALB's addresses change.\n\nIn CDK, `RecordTarget.fromAlias(new targets.LoadBalancerTarget(alb))` builds the alias target. CDK writes the ALB's DNS name with a `dualstack.` prefix, so the name answers over both IPv4 and IPv6. `LoadBalancerTarget` also accepts `evaluateTargetHealth`, which tells Route 53 whether to consider the ALB's health when answering.\n\nBecause an ALB runs on several nodes that AWS adds and removes as load changes, `dig +short origin.example.com` (a command that asks DNS for a name's addresses) prints several IP addresses, and they vary over time. Never copy those IPs anywhere.\n\nIn our course, dev uses a `dev.example.com` sub-zone (a separate hosted zone for a part of the domain), and each environment account has its own hosted zone. Create records in the zone that belongs to the account you are deploying to. Later, `www.example.com` will point to CloudFront (topic 15).",
      "analogy": "An alias is a contacts entry that updates itself when your friend changes phone numbers. A plain A record with a fixed IP is a number you typed in by hand: it works until your friend moves.",
      "code": [
        {
          "language": "typescript",
          "filename": "lib/alb-stack-dns.ts",
          "source": "// Add to the imports of lib/alb-stack.ts:\nimport * as targets from \"aws-cdk-lib/aws-route53-targets\";\n\n// Add at the end of the AlbStack constructor. `zone` and `alb` already exist from sub-topics 1 and 3.\nnew route53.ARecord(this, \"OriginRecord\", {\n  zone,\n  recordName: \"origin\",\n  target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(alb)),\n});\n",
          "output": "",
          "explanation": "`recordName: \"origin\"` inside the `example.com` zone becomes `origin.example.com`. The record is an alias to the ALB, so no IP address appears in your code."
        },
        {
          "language": "bash",
          "filename": "check-dns.sh",
          "source": "dig +short origin.example.com",
          "output": "",
          "explanation": "After deploying, this prints several IPv4 addresses of the ALB nodes. The exact addresses differ between runs and over time, which is why the output is not shown here."
        }
      ],
      "productionNote": "`origin.example.com` is the stable name CloudFront uses to reach the ALB. Use alias records for anything that points at an AWS resource, and keep the record in the same stack as the ALB so they are created and removed together.",
      "commonMistakes": [
        "Creating a CNAME at the zone apex. DNS does not allow it; use an alias A record.",
        "Hardcoding the ALB's IP addresses. They change as the ALB scales, and the site breaks.",
        "Creating records in the wrong account's hosted zone. Check which account and zone the stack's `env` points to before deploying."
      ],
      "sources": [
        { "title": "aws-route53-targets (CDK API)", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53_targets-readme.html" },
        { "title": "Choosing between alias and non-alias records", "url": "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "A target group has a health check interval of 15 s and a healthy threshold of 3. Roughly how long until a new task starts receiving traffic?",
      "options": ["15 s", "45 s", "150 s", "300 s"],
      "answerIndex": 1,
      "explanation": "A new target needs 3 passing checks in a row, 15 s apart, so about 3 x 15 = 45 s. 150 s comes from the defaults (30 s x 5), and 300 s is the default deregistration delay, which is unrelated."
    },
    {
      "question": "Why lower the deregistration delay from 300 s to 30 s for this API?",
      "options": [
        "Requests finish in milliseconds, so waiting 300 s for draining only makes every deploy slower",
        "A longer delay makes the ALB send more traffic to removed tasks",
        "The ALB refuses to start with a delay above 60 s",
        "A short delay lets the ALB skip health checks"
      ],
      "answerIndex": 0,
      "explanation": "Deregistration delay is only the time in-flight requests get to finish after a task is removed. Our requests take milliseconds, so 30 s is ample, and 300 s would stretch each deploy."
    },
    {
      "question": "A listener has a rule at priority 10 for `/api/*` and a default action to the web target group. Where does a request to `/api` (no trailing slash) go?",
      "options": [
        "To the API target group, because the path starts with api",
        "It is rejected with a 502 error",
        "To the web target group, because `/api/*` needs the slash and the default action catches it",
        "To both target groups at once"
      ],
      "answerIndex": 2,
      "explanation": "The pattern `/api/*` requires the slash after `api`, so `/api` does not match the rule. Unmatched requests go to the default action, the web target group."
    },
    {
      "question": "Why use an alias record instead of a CNAME for `example.com` itself (the zone apex)?",
      "options": [
        "Aliases are faster than every other record type for all clients",
        "CNAMEs only work for IPv6 addresses",
        "Aliases require you to type the ALB's IP address",
        "DNS does not allow a CNAME at the apex, while a Route 53 alias does, and it follows the ALB's changing IPs for free"
      ],
      "answerIndex": 3,
      "explanation": "A CNAME cannot sit at the zone apex. A Route 53 alias can, costs nothing for AWS targets, and keeps tracking the ALB when its addresses change."
    },
    {
      "question": "Why choose DNS validation over email validation for an ACM certificate in CDK?",
      "options": [
        "Email validation makes the certificate paid",
        "CDK creates the validation record automatically, so issuance needs no human, while email validation waits for someone to click a link",
        "DNS validation lets the certificate be used in any region",
        "Email validation can only issue certificates for subdomains"
      ],
      "answerIndex": 1,
      "explanation": "With DNS validation, CDK publishes the CNAME in Route 53 and ACM issues the certificate by itself. Email validation stays pending until a person responds. Certificates stay region-bound either way, and both methods are free."
    }
  ]
});
