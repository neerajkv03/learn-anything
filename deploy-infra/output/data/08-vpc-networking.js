window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "08-vpc-networking",
  "order": 8,
  "title": "VPC Networking",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Before you run servers on AWS you need a private network for them to live in. This topic builds a VPC (Virtual Private Cloud, your own isolated network inside AWS) with public, private and isolated subnets across three availability zones, explains internet gateways and NAT gateways (an exit that lets private machines start connections to the internet), chains security groups (per-resource firewalls) so only the right layer can reach the next, adds VPC endpoints (private doors from your VPC to AWS services) to keep AWS traffic off the NAT, and tests the whole layout with CDK assertions (automatic checks of the generated template).",
  "prerequisites": ["02-linux-networking-basics", "07-aws-cdk-basics"],
  "subtopics": [
    {
      "id": "vpc-and-subnets",
      "title": "VPC and public/private/isolated subnets",
      "explanation": "A VPC (Virtual Private Cloud) is your own private network inside one AWS region. You choose its range of IP addresses as a CIDR block (the notation from the Linux networking topic), for example `10.0.0.0/16`, which gives about 65,000 private addresses. Nothing outside can reach into it unless you deliberately open a path.\n\nA subnet is a slice of the VPC's address range that lives in exactly one availability zone (AZ, a separate data centre inside the region). For a three-AZ layout you create each kind of subnet three times, once per AZ. Each subnet's size is set by its `cidrMask`: the number after the slash. A smaller number means a bigger subnet, and CDK accepts masks from 16 to 28. AWS keeps 5 addresses in every subnet for itself, so a subnet holds 2^(32 - cidrMask) minus 5 usable addresses. A `/24` gives 251 and a `/20` gives 4,091.\n\nCDK has three subnet types that differ in how traffic is routed. A route table is the list of rules that says where a subnet sends traffic. `SubnetType.PUBLIC` has a route to an internet gateway (a two-way door to the internet), so it is where the load balancer lives. An ALB (Application Load Balancer) is a service that receives web requests and spreads them over your servers; you build one in topic 10. `SubnetType.PRIVATE_WITH_EGRESS` can start connections out to the internet through a NAT gateway but accepts no connections coming in. `SubnetType.PRIVATE_ISOLATED` has no route to the internet at all. An older name, `PRIVATE_WITH_NAT`, is deprecated, so use `PRIVATE_WITH_EGRESS`.\n\nThe code below creates all three types in 3 AZs. It uses a concrete `env` (a fixed account and region) because a stack without one only gets 2 AZs. Save it as `network-stack.ts` in the CDK project from topic 07 and run it with `bun run network-stack.ts`. Prerequisites: `aws-cdk-lib` and `constructs` are already installed there.\n\nSize the app subnets for growth. A Fargate task (one running copy of your container, built in topic 09) in `awsvpc` networking mode gets its own virtual network card, an ENI (elastic network interface), and each ENI uses one IP address from the subnet. During a rolling deploy with `maxHealthyPercent` 200 (topic 17) the service can briefly run double the tasks, so 120 tasks can need 240 addresses. Three `/20` app subnets hold 12,273 usable addresses, which is far more than enough. Three `/24` app subnets would hold only 753.",
      "analogy": "A gated campus. The public lobby faces the street and anyone can walk in (public subnet). The office floors can phone out but take no walk-in visitors (private with egress). The vault has no windows and no phone line (isolated). Three identical campuses in three towns are your three AZs.",
      "code": [
        {
          "language": "typescript",
          "filename": "network-stack.ts",
          "source": "import { App, Stack, StackProps } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport { Template } from \"aws-cdk-lib/assertions\";\nimport { Construct } from \"constructs\";\n\ninterface NetworkProps extends StackProps {\n  natGateways: number; // 3 in prod, 1 in dev\n}\n\nexport class NetworkStack extends Stack {\n  readonly vpc: ec2.Vpc;\n\n  constructor(scope: Construct, id: string, props: NetworkProps) {\n    super(scope, id, props);\n    this.vpc = new ec2.Vpc(this, \"Vpc\", {\n      ipAddresses: ec2.IpAddresses.cidr(\"10.0.0.0/16\"),\n      maxAzs: 3,\n      natGateways: props.natGateways,\n      subnetConfiguration: [\n        { name: \"public\", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },\n        { name: \"app\", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 20 },\n        { name: \"data\", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },\n      ],\n    });\n  }\n}\n\nconst app = new App();\nconst stack = new NetworkStack(app, \"Net\", {\n  env: { account: \"111111111111\", region: \"us-east-1\" },\n  natGateways: 3,\n});\nconst template = Template.fromStack(stack);\nconst subnets = Object.keys(template.findResources(\"AWS::EC2::Subnet\")).length;\nconst usable = 2 ** (32 - 20) - 5;\n\nconsole.log(\"AZs:\", stack.vpc.availabilityZones.length);\nconsole.log(\"Subnets:\", subnets);\nconsole.log(\"Usable IPs per app subnet:\", usable);\nconsole.log(\"Usable IPs across 3 app subnets:\", usable * 3);\n",
          "output": "AZs: 3\nSubnets: 9\nUsable IPs per app subnet: 4091\nUsable IPs across 3 app subnets: 12273",
          "explanation": "`NetworkStack` creates the VPC with three subnet groups. Each group is created once per AZ, so 3 types times 3 AZs gives 9 subnets. `Template.fromStack` turns the stack into its CloudFormation template (topic 07), and `findResources` returns the template entries of one type, so counting its keys counts the subnets. The last lines show the sizing arithmetic: a /20 has 2^12 = 4,096 addresses, minus the 5 AWS reserves, gives 4,091. Some terms in the code: `interface NetworkProps` declares the named settings the stack accepts, `readonly` means the field is set once in the constructor, `**` means power so `2 ** 12` is 4096, and a rolling deploy replaces old tasks with new ones a few at a time."
        }
      ],
      "productionNote": "Put the ALB in the public subnets, ECS tasks in the private-with-egress subnets, and Aurora, Valkey and RDS Proxy (database, cache and connection-pooling services covered in topics 11, 12 and 14) in the isolated data subnets. Use three AZs in production. Size app subnets generously, because you cannot resize a subnet later without replacing it.",
      "commonMistakes": [
        "Running tasks in public subnets with public IP addresses. This exposes them to the internet for no benefit; use private-with-egress subnets behind the load balancer.",
        "Making the app subnets /24. At 251 usable addresses each, a large service doing rolling deploys can run out of IPs and fail to start tasks.",
        "Using only 2 AZs in production, or forgetting that a stack without a concrete `env` is limited to 2 AZs.",
        "Placing databases in subnets with an internet route. Isolated subnets make it impossible for them to be reached or to call out."
      ],
      "sources": [
        { "title": "AWS CDK: VpcProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.VpcProps.html" },
        { "title": "AWS CDK: SubnetType", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.SubnetType.html" },
        { "title": "Amazon VPC: Subnet sizing", "url": "https://docs.aws.amazon.com/vpc/latest/userguide/subnet-sizing.html" }
      ]
    },
    {
      "id": "internet-and-nat-gateways",
      "title": "Internet and NAT gateways",
      "explanation": "An internet gateway is the two-way door between the VPC and the internet. Only public subnets route to it. CDK creates exactly one for the VPC when you have public subnets.\n\nA NAT gateway (Network Address Translation gateway) lets machines in private subnets start connections to the internet, such as pulling container images, calling AWS APIs or calling a third-party API. Replies come back, but nobody outside can start a connection in. The NAT gateway itself sits in a public subnet.\n\nBy default CDK creates one NAT gateway per AZ, so one AZ failing does not cut outbound traffic for the others.\n\nSetting `natGateways` lower saves the hourly cost of each gateway, but it adds cross-AZ data charges and leaves one single point of failure. NAT also charges per gigabyte processed. A common setup is `natGateways: 3` in prod and `natGateways: 1` in dev.\n\nThe example builds a bare VPC twice and counts the NAT gateways in each synthesised template.",
      "analogy": "A mail room. Outgoing letters from the offices go through it and replies come back, but strangers cannot walk in through it. Each building wing has its own mail room, so if one wing closes the others can still send mail.",
      "code": [
        {
          "language": "typescript",
          "filename": "nat-count.ts",
          "source": "import { App, Stack } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport { Template } from \"aws-cdk-lib/assertions\";\n\nfunction synth(natGateways: number): Template {\n  const app = new App();\n  const stack = new Stack(app, \"Net\", {\n    env: { account: \"111111111111\", region: \"us-east-1\" },\n  });\n  new ec2.Vpc(stack, \"Vpc\", { maxAzs: 3, natGateways });\n  return Template.fromStack(stack);\n}\n\nconst prod = synth(3);\nconst dev = synth(1);\n\n// resourceCountIs throws an error if the count is different\nprod.resourceCountIs(\"AWS::EC2::NatGateway\", 3);\ndev.resourceCountIs(\"AWS::EC2::NatGateway\", 1);\nprod.resourceCountIs(\"AWS::EC2::InternetGateway\", 1);\n\nconsole.log(\"prod: 3 NAT gateways\");\nconsole.log(\"dev: 1 NAT gateway\");\nconsole.log(\"both: 1 internet gateway\");\n",
          "output": "prod: 3 NAT gateways\ndev: 1 NAT gateway\nboth: 1 internet gateway",
          "explanation": "`resourceCountIs` (topic 07) throws if the count differs, so reaching the `console.log` lines means all three assertions held. With no `subnetConfiguration`, CDK uses its default layout of one public and one private-with-egress subnet per AZ, which is enough to show the gateway counts."
        }
      ],
      "productionNote": "Fargate tasks in private-with-egress subnets need either a NAT gateway or VPC endpoints (next sub-topic) to pull images and call AWS services. Use one NAT per AZ in prod so an AZ outage does not break outbound traffic for the other AZs.",
      "commonMistakes": [
        "Running one NAT gateway in prod. An outage of that AZ cuts outbound access for tasks in every AZ.",
        "Ignoring NAT data-processing charges. Image pulls and log shipping can generate a large bill; endpoints move that traffic off NAT.",
        "Placing tasks that need outbound access in isolated subnets. They have no route out, so image pulls and API calls time out."
      ],
      "sources": [
        { "title": "AWS CDK: VpcProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.VpcProps.html" },
        { "title": "Amazon VPC: NAT gateways", "url": "https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html" },
        { "title": "Amazon ECS: Fargate tasks and services", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html" }
      ]
    },
    {
      "id": "security-groups",
      "title": "Security groups",
      "explanation": "A security group is a virtual firewall attached to a resource's network card (ENI). It is stateful: when a request is allowed in, the reply is automatically allowed out, so you never add rules for return traffic. An inbound rule is called ingress and an outbound rule is called egress.\n\nThe key technique is to write ingress rules that name another security group instead of an IP range. The rule \"only the load balancer's group may reach the API on port 3000\" stays correct even when tasks and load balancer nodes come and go and their IPs change.\n\nIn CDK, `new ec2.SecurityGroup(this, id, { vpc })` creates a group. By default `allowAllOutbound` is true, meaning all outgoing traffic is allowed. Set it to `false` for groups like the cache where you want to control egress. The recommended way to open a path is `target.connections.allowFrom(source, ec2.Port.tcp(3000))`. A `Port.tcp(3000)` value means TCP port 3000. `allowFrom` adds the ingress rule on the target and, where the source restricts outbound traffic, the matching egress rule on the source too.\n\nThe plan for this course is a chain: the internet reaches the load balancer group on 443; the load balancer group reaches the API and web groups on 3000; the API and web groups reach the RDS Proxy group on 5432 (the PostgreSQL port); the API reaches the cache group on 6379 (the Valkey port); and the proxy group reaches the Aurora database group on 5432. Each layer only accepts traffic from the layer before it.",
      "analogy": "Badge readers on doors. The vault door accepts only badges from the accounting group, no matter where in the building you are standing. A group of badges stays valid even when people join or leave, just as a security-group rule stays valid when task IPs change.",
      "code": [
        {
          "language": "typescript",
          "filename": "sgs.ts",
          "source": "import { App, Stack } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport { Template } from \"aws-cdk-lib/assertions\";\n\nconst app = new App();\nconst stack = new Stack(app, \"Net\", {\n  env: { account: \"111111111111\", region: \"us-east-1\" },\n});\nconst vpc = new ec2.Vpc(stack, \"Vpc\", { maxAzs: 3 });\n\nconst albSg = new ec2.SecurityGroup(stack, \"AlbSg\", { vpc });\nalbSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), \"HTTPS from internet\");\n\nconst apiSg = new ec2.SecurityGroup(stack, \"ApiSg\", { vpc });\napiSg.connections.allowFrom(albSg, ec2.Port.tcp(3000), \"ALB to API\");\n\nconst cacheSg = new ec2.SecurityGroup(stack, \"CacheSg\", { vpc, allowAllOutbound: false });\ncacheSg.connections.allowFrom(apiSg, ec2.Port.tcp(6379), \"API to Valkey\");\n\nconst template = Template.fromStack(stack);\n\n// Each call throws if no matching rule exists\ntemplate.hasResourceProperties(\"AWS::EC2::SecurityGroupIngress\", {\n  FromPort: 6379,\n  ToPort: 6379,\n  IpProtocol: \"tcp\",\n});\ntemplate.hasResourceProperties(\"AWS::EC2::SecurityGroupIngress\", {\n  FromPort: 3000,\n  ToPort: 3000,\n  IpProtocol: \"tcp\",\n});\n\nconsole.log(\"cache accepts 6379 from the API group\");\nconsole.log(\"API accepts 3000 from the ALB group\");\n",
          "output": "cache accepts 6379 from the API group\nAPI accepts 3000 from the ALB group",
          "explanation": "`Peer.anyIpv4()` means any IPv4 address (0.0.0.0/0), which is correct only for the public HTTPS door. The API rule and the cache rule both use a security group as the source, not an IP range. `hasResourceProperties` checks that a rule with those ports and protocol exists in the template. The cache group also sets `allowAllOutbound: false`, since it has no reason to start outbound connections."
        }
      ],
      "productionNote": "Give each tier its own security group and allow only the previous tier. This gives a least-privilege network (topic 21 builds on it). Topic 15 later restricts the load balancer further so only the CDN can reach it.",
      "commonMistakes": [
        "Opening a database or cache port to 0.0.0.0/0. Always use the security group of the tier that needs access.",
        "Using one shared security group for everything. Any compromised service can then reach every other service.",
        "Adding outbound rules for replies. Security groups are stateful, so return traffic is already allowed."
      ],
      "sources": [
        { "title": "AWS CDK: SecurityGroup", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.SecurityGroup.html" },
        { "title": "AWS CDK: Connections", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.Connections.html" },
        { "title": "Amazon VPC: Security groups", "url": "https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html" }
      ]
    },
    {
      "id": "vpc-endpoints",
      "title": "VPC endpoints",
      "explanation": "A VPC endpoint is a private path from your VPC to an AWS service, so the traffic never goes through the NAT gateway or the internet. There are two kinds.\n\nA gateway endpoint works through a route-table entry and supports S3 and DynamoDB. It is free. An interface endpoint uses PrivateLink (AWS's technology for private connections to services): AWS places an ENI in each of your AZs and the service gets a private address in your subnets. Interface endpoints cost an hourly fee per AZ plus a per-gigabyte charge.\n\nFor Fargate in private subnets the typical set is: ECR API (`ECR`, which handles image metadata) and ECR Docker registry (`ECR_DOCKER`, which serves the image), plus `CLOUDWATCH_LOGS` for logs and `SECRETS_MANAGER` for secrets. Image layers are stored in S3, so an S3 gateway endpoint is needed too. Without it, image pulls still go through NAT or fail.\n\nEndpoints are a trade-off. Each interface endpoint costs per AZ-hour even when idle, so they pay off when a lot of traffic would otherwise go through NAT, for example scaling out 100 tasks that each pull an image. In a small dev environment, one NAT gateway is usually cheaper.",
      "analogy": "A private tunnel from your office straight to the bank vault, instead of driving through the city (the NAT gateway and internet). The tunnel costs money to keep open, so it is worth it only if you make many trips.",
      "code": [
        {
          "language": "typescript",
          "filename": "endpoints.ts",
          "source": "import { App, Stack } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport { Template } from \"aws-cdk-lib/assertions\";\n\nconst app = new App();\nconst stack = new Stack(app, \"Net\", {\n  env: { account: \"111111111111\", region: \"us-east-1\" },\n});\nconst vpc = new ec2.Vpc(stack, \"Vpc\", { maxAzs: 3 });\n\n// Free gateway endpoint: ECR image layers are stored in S3\nvpc.addGatewayEndpoint(\"S3\", { service: ec2.GatewayVpcEndpointAwsService.S3 });\n\n// Interface endpoints (hourly + per-GB cost)\nconst services = [\n  { id: \"Ecr\", service: ec2.InterfaceVpcEndpointAwsService.ECR },\n  { id: \"EcrDocker\", service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER },\n  { id: \"Logs\", service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS },\n  { id: \"Secrets\", service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER },\n];\nfor (const s of services) {\n  vpc.addInterfaceEndpoint(s.id, { service: s.service });\n}\n\nconst template = Template.fromStack(stack);\ntemplate.resourceCountIs(\"AWS::EC2::VPCEndpoint\", 5);\nconsole.log(\"VPC endpoints: 5 (1 gateway + 4 interface)\");\n",
          "output": "VPC endpoints: 5 (1 gateway + 4 interface)",
          "explanation": "`addGatewayEndpoint` adds the S3 route-table endpoint. The `for...of` loop (it repeats the body once per item in the list) calls `addInterfaceEndpoint` for each service. CloudFormation counts both kinds as `AWS::EC2::VPCEndpoint`, so the assertion expects 5."
        }
      ],
      "productionNote": "Add these endpoints in production so image pulls during a scale-out of 100 tasks stay off the NAT gateway. If you give an interface endpoint your own security group, it must allow port 443 from the tasks' security group, or the tasks cannot reach it.",
      "commonMistakes": [
        "Creating the ECR endpoints but not the S3 gateway endpoint. Image layers come from S3, so pulls still use NAT or fail.",
        "Giving the endpoints a security group that blocks port 443 from the tasks.",
        "Adding many interface endpoints in a small dev environment where one NAT gateway is cheaper."
      ],
      "sources": [
        { "title": "AWS CDK: GatewayVpcEndpointAwsService", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.GatewayVpcEndpointAwsService.html" },
        { "title": "AWS CDK: InterfaceVpcEndpointAwsService", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.InterfaceVpcEndpointAwsService.html" },
        { "title": "Amazon ECR: VPC endpoints", "url": "https://docs.aws.amazon.com/AmazonECR/latest/userguide/vpc-endpoints.html" }
      ]
    },
    {
      "id": "multi-az-layout",
      "title": "Multi-AZ layout",
      "explanation": "Multi-AZ means spreading every layer of the system across several AZs, so that losing one AZ does not take the service down. In the full design: the load balancer has nodes in all three AZs, ECS spreads tasks across AZs, the Aurora database has its writer in one AZ and readers in the others, the Valkey cache has a primary node and replicas in different AZs, and there is one NAT gateway per AZ.\n\nLosing one AZ out of three removes roughly one third of your capacity. Plan headroom (spare capacity, from topic 01) so the remaining two AZs can carry the full load. Traffic between AZs also has a per-gigabyte data charge, so keep chatty traffic inside one AZ where you can.\n\nThe diagram shows the target layout. The code checks the AZ count in CDK. A stack with a fixed account and region gets 3 AZs. A stack without `env` (environment-agnostic) can only be given 2 AZs, because CDK cannot look up which AZs exist until deploy time.",
      "analogy": "Three bakeries across town, each with its own oven and delivery van. A power cut shuts one bakery, not breakfast for the whole city. You just need each bakery to be able to bake a bit extra on the day.",
      "code": [
        {
          "language": "text",
          "filename": "layout.txt",
          "source": "             AZ a              AZ b              AZ c\npublic    | ALB node, NAT   | ALB node, NAT   | ALB node, NAT   |\napp       | api + web tasks | api + web tasks | api + web tasks |\ndata      | Aurora writer   | Aurora reader   | Aurora reader   |\n          | Valkey primary  | Valkey replica  | Valkey replica  |\n",
          "output": "",
          "explanation": "Each column is an AZ and each row is a subnet tier. Every tier has a member in every AZ. The database writer and cache primary sit in AZ a, and their replicas sit in b and c, so a failure of any single AZ leaves a copy elsewhere."
        },
        {
          "language": "typescript",
          "filename": "az-count.ts",
          "source": "import { App, Stack } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\n\nconst app = new App();\n\nconst fixed = new Stack(app, \"Fixed\", {\n  env: { account: \"111111111111\", region: \"us-east-1\" },\n});\nconst fixedVpc = new ec2.Vpc(fixed, \"Vpc\", { maxAzs: 3 });\n\nconst agnostic = new Stack(app, \"Agnostic\"); // no env\nconst agnosticVpc = new ec2.Vpc(agnostic, \"Vpc\", { maxAzs: 3 });\n\nconsole.log(\"concrete env:\", fixedVpc.availabilityZones.length);\nconsole.log(\"env-agnostic:\", agnosticVpc.availabilityZones.length);\n",
          "output": "concrete env: 3\nenv-agnostic: 2",
          "explanation": "Both VPCs ask for `maxAzs: 3`. Only the stack with a concrete account and region can get three. The environment-agnostic stack is limited to two, so always pass `env` for production stacks."
        }
      ],
      "productionNote": "Reliability design in topic 22 builds on this layout. Make sure the number of tasks and the database and cache sizes still handle your peak load with one AZ gone.",
      "commonMistakes": [
        "Deploying a stack without a concrete `env` and getting only 2 AZs.",
        "Placing all Aurora readers in the same AZ as the writer. An AZ failure then removes every copy.",
        "Running a single NAT gateway, which ties outbound traffic for all AZs to one AZ."
      ],
      "sources": [
        { "title": "AWS CDK: VpcProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.VpcProps.html" },
        { "title": "AWS whitepaper: High availability and scalability on AWS", "url": "https://docs.aws.amazon.com/whitepapers/latest/real-time-communication-on-aws/high-availability-and-scalability-on-aws.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Which subnet type should hold the Aurora database, and why?",
      "options": [
        "PUBLIC, so the database can answer requests from the internet",
        "PRIVATE_ISOLATED, because it has no route to or from the internet and only your own tiers need to reach it",
        "PRIVATE_WITH_EGRESS, because databases must download updates through NAT every minute",
        "Any subnet, since subnet types only change the name"
      ],
      "answerIndex": 1,
      "explanation": "A database is reached only by your app tier, so it belongs in an isolated subnet with no internet route. Subnet types do change routing, and a public subnet would expose it unnecessarily."
    },
    {
      "question": "Why do security group rules reference other security groups instead of IP ranges?",
      "options": [
        "Because security groups cannot contain IP ranges at all",
        "Because IP-based rules are slower to evaluate than group-based rules",
        "Because the rule stays correct when tasks start and stop and their IPs change, and it states exactly which tier may connect",
        "Because it makes traffic encrypted"
      ],
      "answerIndex": 2,
      "explanation": "Task IPs change constantly, but membership of a group follows the resources. Security groups can contain IP ranges (the public HTTPS rule does), and referencing a group has nothing to do with encryption."
    },
    {
      "question": "ECR interface endpoints exist, but image pulls from private subnets still go through the NAT gateway. What is most likely missing?",
      "options": [
        "A second internet gateway",
        "An S3 gateway endpoint, because image layers are stored in S3",
        "A larger cidrMask on the app subnets",
        "A security group rule allowing port 22"
      ],
      "answerIndex": 1,
      "explanation": "ECR serves the image metadata through the ECR endpoints but the layers come from S3. Without a (free) S3 gateway endpoint, that part of the pull uses NAT."
    },
    {
      "question": "How many usable IP addresses does one /20 app subnet hold in AWS?",
      "options": [
        "4,096",
        "4,094",
        "4,091",
        "251"
      ],
      "answerIndex": 2,
      "explanation": "A /20 has 2^(32-20) = 4,096 addresses and AWS reserves 5 in every subnet, leaving 4,091. 251 is the figure for a /24."
    },
    {
      "question": "What is the main trade-off of setting natGateways to 1 in production?",
      "options": [
        "It saves the cost of extra gateways, but one AZ failure cuts outbound access for tasks in all AZs and adds cross-AZ data charges",
        "It makes inbound traffic from the internet stop working",
        "It forces all tasks into a single AZ",
        "It has no downside because NAT gateways are always free"
      ],
      "answerIndex": 0,
      "explanation": "One NAT saves hourly cost but is a single point of failure and makes other AZs send traffic across AZs to reach it. It affects outbound traffic only, not where tasks run, and NAT gateways are charged."
    }
  ]
});
