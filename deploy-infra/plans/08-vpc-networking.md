# 08. VPC Networking
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 02-linux-networking-basics, 07-aws-cdk-basics

## Learning goals
- Learner can design a 3-AZ VPC with public, app and data subnets sized for 100+ tasks.
- Learner can explain internet vs NAT gateways and their cost trade-off.
- Learner can chain security groups ALB → API → DB/cache.
- Learner can add VPC endpoints to cut NAT traffic.
- Learner can test the VPC layout with assertions.

## Sub-topics
### VPC and public/private/isolated subnets
- Concept: VPC = your private network in a region (10.0.0.0/16). Subnet = slice in one AZ. SubnetType PUBLIC (route to internet gateway; ALB, NAT), PRIVATE_WITH_EGRESS (outbound via NAT, no inbound; Fargate tasks), PRIVATE_ISOLATED (no internet; Aurora, Valkey). PRIVATE_WITH_NAT deprecated. cidrMask 16–28; AWS reserves 5 IPs/subnet. Each Fargate task (awsvpc, gloss) uses one IP; deploy at maxHealthyPercent 200 doubles tasks briefly.
- Analogy: a gated campus: public lobby facing the street (public), office floors that can phone out but take no walk-ins (private with egress), and a vault with no windows or phone line (isolated).
- Code example: `network-stack.ts` — `const vpc = new ec2.Vpc(this, "Vpc", { ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"), maxAzs: 3, natGateways: cfg.natGateways, subnetConfiguration: [ { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 }, { name: "app", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 20 }, { name: "data", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 } ] });` Result: 9 subnets (3 types × 3 AZs); app subnets 4,091 usable IPs each → 12,273 across 3 AZs, enough for 120 tasks × 2 during deploys (240 IPs) many times over.
- Production use: ALB in public, ECS in app, Aurora/Valkey/RDS Proxy in data.
- Common mistakes: tasks in public subnets with public IPs; /24 app subnets too small at scale; only 2 AZs for prod.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.VpcProps.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.SubnetType.html ; https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html

### Internet and NAT gateways
- Concept: internet gateway = two-way door for public subnets. NAT gateway = lets private subnets call out (ECR pulls, AWS APIs, third-party APIs) without inbound. Default one per AZ (HA); fewer saves cost but adds cross-AZ data charges and a single point of failure. NAT also charges per GB processed (gloss; no prices) → endpoints help. Prod natGateways 3, dev 1.
- Analogy: a mail room: outgoing letters from the offices go through it and replies come back, but strangers can't walk in through it. One mail room per building wing so a closed wing doesn't stop the others.
- Code example: assertion `Template.fromStack(prodNet).resourceCountIs("AWS::EC2::NatGateway", 3);` and for dev `resourceCountIs("AWS::EC2::NatGateway", 1)` → both pass with config from topic 07.
- Production use: Fargate in PRIVATE_WITH_EGRESS needs NAT or endpoints to pull images.
- Common mistakes: 1 NAT in prod (AZ outage breaks egress for all); huge NAT bills from image pulls and logs; isolated subnet for tasks that need outbound.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.VpcProps.html ; https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html

### Security groups
- Concept: stateful virtual firewall per resource (ENI). Inbound rules reference other security groups, not IPs → "only the ALB may reach API port 3000". allowAllOutbound default true. Prefer `.connections.allowFrom(other, port)` (adds both sides). Chain: internet 443 → albSg; albSg → apiSg:3000 and webSg:3000; apiSg/webSg → proxySg:5432; apiSg → cacheSg:6379; proxySg → dbSg:5432.
- Analogy: building badge readers: the vault door accepts only badges from the "accounting" group, regardless of where in the building you stand.
- Code example: `sgs.ts` — `const albSg = new ec2.SecurityGroup(this, "AlbSg", { vpc }); albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS from internet"); const apiSg = new ec2.SecurityGroup(this, "ApiSg", { vpc }); apiSg.connections.allowFrom(albSg, ec2.Port.tcp(3000), "ALB to API"); const cacheSg = new ec2.SecurityGroup(this, "CacheSg", { vpc, allowAllOutbound: false }); cacheSg.connections.allowFrom(apiSg, ec2.Port.tcp(6379), "API to Valkey");` Assertion: `hasResourceProperties("AWS::EC2::SecurityGroupIngress", { FromPort: 6379, ToPort: 6379, IpProtocol: "tcp" })` passes.
- Production use: least-privilege network (topic 21); later ALB restricted further with CloudFront header (topic 15).
- Common mistakes: 0.0.0.0/0 on DB ports; one shared SG for everything; forgetting stateful = return traffic auto-allowed (adding pointless outbound rules).
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.SecurityGroup.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.Connections.html ; https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html

### VPC endpoints
- Concept: private path to AWS services without NAT. Gateway endpoint (S3, DynamoDB; free, route table). Interface endpoint (PrivateLink, gloss; ENI per AZ; hourly + per GB cost) for ECR (`ECR` api, `ECR_DOCKER` registry), CLOUDWATCH_LOGS, SECRETS_MANAGER. ECR image layers live in S3 → S3 gateway endpoint needed alongside ECR endpoints. Trade-off: endpoints cost per AZ-hour; worth it at high traffic.
- Analogy: a private tunnel from your office straight to the bank vault instead of driving through the city (NAT).
- Code example: `vpc.addGatewayEndpoint("S3", { service: ec2.GatewayVpcEndpointAwsService.S3 }); for (const [id, svc] of [["Ecr", ec2.InterfaceVpcEndpointAwsService.ECR], ["EcrDocker", ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER], ["Logs", ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS], ["Secrets", ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER]] as const) vpc.addInterfaceEndpoint(id, { service: svc });` Assertion `resourceCountIs("AWS::EC2::VPCEndpoint", 5)` passes.
- Production use: image pulls during scale-out of 100 tasks stay off NAT.
- Common mistakes: ECR endpoints without S3 gateway (pulls still go via NAT or fail); endpoint SG blocking 443 from tasks; adding endpoints in dev where NAT is cheaper.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.GatewayVpcEndpointAwsService.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.InterfaceVpcEndpointAwsService.html ; https://docs.aws.amazon.com/AmazonECR/latest/userguide/vpc-endpoints.html

### Multi-AZ layout
- Concept: every tier spread over 3 AZs: ALB nodes, ECS tasks (ECS spreads by AZ), Aurora writer + readers in different AZs, Valkey primary + replicas multi-AZ, one NAT per AZ. Losing one AZ = lose ~1/3 capacity → headroom (topic 01). Cross-AZ traffic has a data charge (no price).
- Analogy: three bakeries across town, each with its own oven and delivery van: one power cut shuts one bakery, not breakfast for the city.
- Code example: diagram text (ASCII) of AZ a/b/c columns: public (ALB, NAT) / app (api, web tasks) / data (Aurora writer in a, readers in b,c; Valkey primary a, replicas b,c). Plus `vpc.availabilityZones.length` printed in synth → `3` (needs concrete env).
- Production use: reliability design (topic 22).
- Common mistakes: env-agnostic stack only gets 2 AZs; all readers in the writer's AZ; one NAT.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.VpcProps.html ; https://docs.aws.amazon.com/whitepapers/latest/real-time-communication-on-aws/high-availability-and-scalability-on-aws.html

## Quiz
1. Which subnet type for Aurora and why? — tests isolated.
2. Why reference security groups instead of IP ranges in rules? — tests SG chaining.
3. ECR interface endpoints exist but image pulls still use NAT. What's missing? — tests S3 gateway.
4. How many usable IPs in one /20 app subnet? — tests sizing (4,091).
5. Trade-off of natGateways: 1 in prod? — tests NAT HA.
