# 03. AWS Fundamentals
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 01-deployment-foundations, 02-linux-networking-basics

Course region: us-east-1 everywhere (CloudFront certificates must be in us-east-1; one region keeps examples simple). Learner installs AWS CLI v2 manually.

## Learning goals
- Learner can explain account, region and availability zone and why the shop uses 3 AZs.
- Learner can read an IAM policy (Effect/Action/Resource) and tell a user from a role.
- Learner can configure the AWS CLI and confirm identity with `aws sts get-caller-identity`.
- Learner can say what AWS secures vs what they secure.
- Learner can set a monthly budget with an email alert.

## Sub-topics
### Accounts, regions and availability zones
- Concept: AWS account = billing + security boundary (12-digit ID). Region = geographic area (us-east-1). AZ = one or more separate data centers inside a region with own power/network; spreading across 3 AZs survives one failing. Most services are regional.
- Analogy: a retail chain. Account = one company's books; region = a city; AZs = separate branches across town on different power grids — if one branch floods, the others keep selling.
- Code example: `aws ec2 describe-availability-zones --region us-east-1 --query "AvailabilityZones[].ZoneName" --output text` → tab-separated names like `us-east-1a  us-east-1b  us-east-1c ...` (count and order may vary per account). Explain `--query` picks fields.
- Production use: VPC maxAzs 3 (topic 08), Aurora readers in different AZs (topic 11).
- Common mistakes: everything in one AZ; mixing regions so resources can't see each other; using root account for daily work.
- Sources: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html ; https://docs.aws.amazon.com/cli/latest/reference/ec2/describe-availability-zones.html

### IAM users, roles and policies
- Concept: IAM = who can do what. Policy JSON: Version "2012-10-17", Statement[] with Effect Allow/Deny, Action (e.g. `s3:GetObject`), Resource (ARN, gloss Amazon Resource Name). User = long-term identity (person); role = identity anyone trusted can temporarily wear (ECS task, GitHub pipeline, person via SSO) → short-lived credentials. Explicit Deny beats Allow; default = deny. Least privilege (gloss).
- Analogy: hotel. User = a guest with a permanent name badge; role = a uniform ("housekeeping") that anyone authorised can put on for a shift; policy = list on the uniform of which doors its keycard opens. Deny = a door marked "never", whatever the uniform says.
- Code example: `read-assets-policy.json` — `{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:GetObject","Resource":"arn:aws:s3:::shop-assets-dev/*"}]}`; explain line by line: this allows reading objects in bucket shop-assets-dev only; `s3:PutObject` would be denied (default deny).
- Production use: ECS task role (topic 09), GitHub OIDC role (topic 17), least-privilege review (topic 21).
- Common mistakes: `"Action":"*","Resource":"*"`; creating access keys for apps instead of roles; forgetting `/*` for objects vs bucket ARN.
- Sources: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements.html ; https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html ; https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html

### AWS CLI and credentials
- Concept: AWS CLI v2 = terminal tool calling AWS APIs. Profiles in `~/.aws/config`. Credential precedence (CLI v2): command-line options, env vars, assume role, web identity, IAM Identity Center, credentials file, ... container creds, instance profile. Prefer SSO (topic 04) over long-lived access keys. `aws sts get-caller-identity` = "who am I".
- Analogy: TV remote with several saved profiles; get-caller-identity = the screen showing whose profile is active before you buy a movie.
- Code example: `aws sts get-caller-identity --profile shop-dev` → JSON `{"UserId": "AROA...:alice", "Account": "111111111111", "Arn": "arn:aws:sts::111111111111:assumed-role/AWSReservedSSO_AdministratorAccess_abc123/alice"}` (IDs illustrative). Explain each field.
- Production use: first command in every runbook (topic 23) to avoid acting in the wrong account; CI verifies role (topic 17).
- Common mistakes: AWS_ACCESS_KEY_ID left in env overriding the profile (precedence); committing ~/.aws/credentials; running prod commands with dev profile.
- Sources: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html#configure-precedence ; https://docs.aws.amazon.com/cli/latest/reference/sts/get-caller-identity.html ; https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

### Shared responsibility model
- Concept: AWS secures "of the cloud" (buildings, hardware, hypervisor, managed service internals); customer secures "in the cloud" (IAM, data, network rules, app code, container image patches, encryption settings). Fargate/Aurora shift more to AWS (no OS patching) but config stays yours.
- Analogy: renting a flat in a managed building. Landlord: locks on the main entrance, roof, wiring. You: locking your own door, who you give keys to, what you leave on the table.
- Code example: none (table). Table rows: Fargate host OS → AWS; container image packages → you; Aurora engine patching → AWS applies, you choose timing/LTS; security group rules → you; S3 bucket public access → you.
- Production use: security hardening checklist (topic 21).
- Common mistakes: assuming "managed" = secure by default; leaving S3 public; never rebuilding images.
- Sources: https://aws.amazon.com/compliance/shared-responsibility-model/ ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security.html

### Billing alarms and budgets
- Concept: AWS bills per use; mistakes (NAT traffic, forgotten load tests, 100 tasks left running) get expensive fast. AWS Budgets: monthly cost limit with email alerts at % of actual or forecasted spend.
- Analogy: prepaid phone plan alert: "you've used 80% of your data".
- Code example: `budget.json` `{"BudgetName":"shop-dev-monthly","BudgetLimit":{"Amount":"300","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}` and `notifications.json` `[{"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":80,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"ops@example.com"}]}]`; `aws budgets create-budget --account-id 111111111111 --budget file://budget.json --notifications-with-subscribers file://notifications.json` → no output on success (exit 0). Alert fires when actual > 240 USD.
- Production use: one budget per account (dev/staging/prod), plus cost tags (topic 23).
- Common mistakes: no budget in dev; alerting to an unread inbox; forgetting load-test resources.
- Sources: https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html ; https://docs.aws.amazon.com/cli/latest/reference/budgets/create-budget.html

## Quiz
1. Why run the shop in three AZs instead of one? — tests AZ.
2. In a policy, Allow s3:* and Deny s3:DeleteObject both match; what happens on delete? — tests Deny wins.
3. Role vs user: which should an ECS task use and why? — tests roles.
4. `aws sts get-caller-identity` shows account 111111111111 but you meant prod; what do you check? — tests profiles/precedence.
5. Who patches packages inside your container image? — tests shared responsibility.
