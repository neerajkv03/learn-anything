# 04. Multi-Account Setup
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 03-aws-fundamentals

Fixed example IDs for the whole course: management 999999999999, shop-dev 111111111111, shop-staging 222222222222, shop-prod 333333333333. Region us-east-1.

## Learning goals
- Learner can sketch an Organization with OUs and dev/staging/prod accounts.
- Learner can sign in to an account via IAM Identity Center from the CLI.
- Learner can explain why workloads stay out of the management account.
- Learner can read an SCP and predict what it blocks.
- Learner can assume a cross-account role.

## Sub-topics
### AWS Organizations and OUs
- Concept: Organization = group of accounts under one management account (pays the bill). Root → OUs (folders, nest up to five levels) → member accounts. Management account: only org tasks, no workloads; SCPs don't restrict it. Layout: Root → `Security` OU (log/audit later), `Workloads` OU → `NonProd` OU (shop-dev, shop-staging) and `Prod` OU (shop-prod).
- Analogy: a holding company. Head office (management account) does payroll and rules only; each shop branch (member account) has its own till and staff, so a fire in the dev branch can't burn the prod branch's cash.
- Code example: `org-layout.txt` tree:
  ```
  Root
  ├── Security
  └── Workloads
      ├── NonProd: shop-dev (111111111111), shop-staging (222222222222)
      └── Prod:    shop-prod (333333333333)
  ```
  plus `aws organizations list-accounts --query "Accounts[].[Name,Id]" --output text` (run from management) → lines `shop-dev  111111111111` etc.
- Production use: blast radius limits — a dev mistake can't delete prod; per-account budgets and quotas.
- Common mistakes: running apps in management account; one account for all envs; no OU structure, so policies can't be applied per env.
- Sources: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_getting-started_concepts.html ; https://docs.aws.amazon.com/organizations/latest/userguide/orgs_best-practices_mgmt-acct.html

### IAM Identity Center sign-in
- Concept: Identity Center = one login for people across all accounts; permission sets (e.g. AdministratorAccess in dev, ReadOnly in prod) map users/groups to accounts. CLI: `aws configure sso` writes profile + sso-session to ~/.aws/config; `aws sso login --profile X` opens browser, caches token in ~/.aws/sso/cache. No access keys.
- Analogy: a company badge system: one badge, the gate checks which floors your badge works on today; badge expires each evening (short sessions).
- Code example: resulting `~/.aws/config`:
  ```
  [profile shop-dev]
  sso_session = shop
  sso_account_id = 111111111111
  sso_role_name = AdministratorAccess
  region = us-east-1
  [sso-session shop]
  sso_start_url = https://example.awsapps.com/start
  sso_region = us-east-1
  sso_registration_scopes = sso:account:access
  ```
  `aws sso login --profile shop-dev` then `aws sts get-caller-identity --profile shop-dev --query Account --output text` → `111111111111`.
- Production use: humans use SSO profiles shop-dev/shop-staging/shop-prod; pipelines use OIDC roles (topic 17).
- Common mistakes: giving everyone Admin in prod; sharing IAM users; forgetting sessions expire (re-login).
- Sources: https://docs.aws.amazon.com/cli/latest/userguide/sso-configure-profile-token.html#cli-configure-sso-configure ; https://docs.aws.amazon.com/cli/latest/userguide/sso-configure-profile-token.html#cli-configure-sso-login ; https://docs.aws.amazon.com/singlesignon/latest/userguide/permissionsetsconcept.html

### dev/staging/prod accounts
- Concept: one account per environment = hard isolation of IAM, quotas, costs, data. Same CDK code deploys each with different config (topic 07). Each account bootstrapped for CDK separately.
- Analogy: three identical kitchens in separate buildings; recipe book shared, ingredients and keys never shared.
- Code example: `envs.ts` — `export const envs = { dev: { account: "111111111111", region: "us-east-1" }, staging: { account: "222222222222", region: "us-east-1" }, prod: { account: "333333333333", region: "us-east-1" } } as const; console.log(Object.keys(envs).join(","));` → `dev,staging,prod`. Used later by CDK.
- Production use: CDK stacks target these envs; GitHub environments map 1:1 (topic 17).
- Common mistakes: prod data copied into dev; staging in same account as prod; inconsistent account config drift.
- Sources: https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/benefits-of-using-multiple-aws-accounts.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.StackProps.html

### Service control policies
- Concept: SCP = guardrail on max permissions in member accounts. Need Allow at every level root → account; any Deny wins; FullAWSAccess attached by default; SCPs never grant permissions; management account unaffected. Recommended root SCP denies `organizations:LeaveOrganization` and `account:CloseAccount`.
- Analogy: building rules posted by the landlord: whatever your own keycard says, the roof door is welded shut for everyone.
- Code example: `deny-leave-close.json` — `{"Version":"2012-10-17","Statement":[{"Sid":"DenyLeaveAndClose","Effect":"Deny","Action":["organizations:LeaveOrganization","account:CloseAccount"],"Resource":"*"}]}`; attached to Root. Outcome: an Administrator in shop-prod running `aws account close-account`… → AccessDenied; same admin can still create ECS services (FullAWSAccess still allows).
- Production use: protect prod from accidental account closure; later add region restrictions (link aws-samples only, no snippet).
- Common mistakes: thinking SCP grants access; detaching FullAWSAccess → everything denied; testing SCPs on prod first.
- Sources: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_evaluation.html ; https://docs.aws.amazon.com/organizations/latest/userguide/orgs_best-practices_mgmt-acct.html#bp_mgmt-acct_default-controls

### Cross-account roles
- Concept: role in account B trusts account A; caller uses `sts:AssumeRole` → temporary creds. OrganizationAccountAccessRole auto-created in accounts created by Organizations (not invited ones) = break-glass admin from management. CLI profile with `role_arn` + `source_profile` does assume automatically.
- Analogy: a visitor pass: your home office calls ahead, the other building hands you a timed pass for listed rooms.
- Code example: config profile:
  ```
  [profile prod-breakglass]
  role_arn = arn:aws:iam::333333333333:role/OrganizationAccountAccessRole
  source_profile = mgmt
  ```
  `aws sts get-caller-identity --profile prod-breakglass --query Arn --output text` → `arn:aws:sts::333333333333:assumed-role/OrganizationAccountAccessRole/<session-name>`.
- Production use: emergency access; CDK bootstrap `--trust` and pipeline roles use the same mechanism (topics 07, 17).
- Common mistakes: trust policy too broad (whole other account with no conditions); using break-glass daily; not logging assumes.
- Sources: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_accounts_access.html ; https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-role.html

## Quiz
1. Why does the shop not run in the management account? — tests mgmt guidance.
2. An SCP denies `ec2:*` on the Prod OU; an IAM policy in prod allows `ec2:RunInstances`. Result? — tests Deny wins.
3. What command refreshes an expired SSO session? — tests sso login.
4. Which accounts lack OrganizationAccountAccessRole? — tests invited accounts.
5. Name two benefits of one account per environment. — tests isolation.
