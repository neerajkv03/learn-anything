window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "04-aws-multi-account",
  "order": 4,
  "title": "Multi-Account Setup",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Real companies do not run everything in one AWS account. You will learn how AWS Organizations groups several accounts (one each for dev, staging and prod) under one management account, how people sign in to them with IAM Identity Center instead of access keys, how a service control policy (SCP) sets guardrails, and how one account can safely borrow a role in another.",
  "prerequisites": ["03-aws-fundamentals"],
  "subtopics": [
    {
      "id": "organizations-and-ous",
      "title": "AWS Organizations and OUs",
      "explanation": "In the previous topic you worked with a single AWS account. An AWS Organization is a group of AWS accounts managed together. One account in the group is the management account: it creates the other accounts, receives the single combined bill, and is where you set organization-wide rules. The other accounts are called member accounts.\n\nThe top of an Organization is called the Root. Under the Root you create OUs. OU stands for organizational unit, which is a folder that holds member accounts and other OUs. OUs can be nested up to five levels deep. Rules you attach to an OU apply to everything inside it, so folders are how you apply different rules to different kinds of accounts.\n\nThis course uses one fixed layout with Region us-east-1. Under the Root there is a Security OU (later used for audit and log accounts) and a Workloads OU. Inside Workloads there is a NonProd OU holding shop-dev (111111111111) and shop-staging (222222222222), and a Prod OU holding shop-prod (333333333333). The management account is 999999999999.\n\nThe management account is special. It should do organization tasks only (create accounts, billing, policies) and never run your application. Reason: the guardrail policies you will meet in the SCP sub-topic do not restrict the management account, so anything running there has fewer safety rails, and a compromise of it would endanger every other account.\n\nTo see all accounts, sign in to the management account and run the CLI command shown below. The `--query` option filters the JSON result with a JMESPath expression (a small query language), and `--output text` prints plain tab-separated lines.",
      "analogy": "Think of a holding company. Head office (the management account) does payroll and sets company rules, but sells nothing. Each shop branch (a member account) has its own till and its own staff, so a fire in the dev branch cannot burn the cash in the prod branch. The OUs are the regional divisions (non-production shops, production shops) that head office can give different rules to.",
      "code": [
        {
          "language": "text",
          "filename": "org-layout.txt",
          "source": "Root\n├── Security\n└── Workloads\n    ├── NonProd: shop-dev (111111111111), shop-staging (222222222222)\n    └── Prod:    shop-prod (333333333333)",
          "output": "",
          "explanation": "The Organization layout used for the whole course. The management account (999999999999) sits at the Root and is not placed in any OU. This file is a plain-text diagram, so it prints nothing."
        },
        {
          "language": "bash",
          "filename": "list-accounts.sh",
          "source": "aws organizations list-accounts --query \"Accounts[].[Name,Id]\" --output text",
          "output": "management\t999999999999\nshop-dev\t111111111111\nshop-staging\t222222222222\nshop-prod\t333333333333",
          "explanation": "Run this from the management account. Each output line is an account name, a tab, and its 12-digit account ID. The order of lines can differ in your Organization."
        }
      ],
      "productionNote": "The main benefit is a limited blast radius, meaning the amount of damage one mistake or one compromise can do. A bad script in dev cannot delete prod resources because they live in a different account. Each account also gets its own budgets and service quotas (the AWS-imposed limits on how many resources you may create), so a runaway dev experiment cannot eat prod capacity.",
      "commonMistakes": [
        "Running application workloads in the management account. Guardrail policies do not apply there and the account holds the keys to the whole Organization.",
        "Keeping every environment in one account, so one mistake or leaked credential reaches prod.",
        "Putting all accounts directly under the Root with no OUs. You then cannot apply different policies to non-production and production accounts."
      ],
      "sources": [
        { "title": "AWS Organizations terminology and concepts", "url": "https://docs.aws.amazon.com/organizations/latest/userguide/orgs_getting-started_concepts.html" },
        { "title": "Best practices for the management account", "url": "https://docs.aws.amazon.com/organizations/latest/userguide/orgs_best-practices_mgmt-acct.html" }
      ]
    },
    {
      "id": "identity-center-sign-in",
      "title": "IAM Identity Center sign-in",
      "explanation": "With many accounts you do not want an IAM user (a permanent login you create inside one account) in each one. IAM Identity Center is the AWS service that gives each person one login that works across all accounts in the Organization. You create people (or groups of people) once, then decide which accounts they can enter and with what power.\n\nThat decision is a permission set: a named bundle of permissions, such as AdministratorAccess or ReadOnlyAccess. You assign a user or group plus a permission set to an account. A sensible example: the developers group gets AdministratorAccess in shop-dev and ReadOnlyAccess in shop-prod. When someone signs in, Identity Center creates a temporary IAM role in that account for them.\n\nThere are no access keys. Run `aws configure sso` once per setup. The command asks for your Identity Center start URL (the web address of your sign-in page) and its Region, opens a browser to approve, lets you pick an account and permission set, and then writes a profile into the file `~/.aws/config`. The `~` means your home folder, and a profile is a named set of CLI settings you met in the previous topic.\n\nThe resulting file has two kinds of section. A `[sso-session shop]` section holds the shared sign-in details. A `[profile shop-dev]` section points at the session and names the account ID and permission set (called `sso_role_name`) to use.\n\nTo start working, run `aws sso login --profile shop-dev`. This opens your browser, you approve, and the CLI caches a temporary token in `~/.aws/sso/cache`. The token expires after a limited time, so you must log in again later. `aws sts get-caller-identity` (from the previous topic) then proves which account you are in. The `--query Account --output text` options print just the account number.",
      "analogy": "A company badge system. You carry one badge, and the gate at each floor checks which floors your badge opens today. Your badge works on the dev floor with full access but only lets you look around the prod floor. The badge also expires each evening, so you tap in again the next morning (that is aws sso login).",
      "code": [
        {
          "language": "bash",
          "filename": "configure-sso.sh",
          "source": "aws configure sso",
          "output": "SSO session name (Recommended): shop\nSSO start URL [None]: https://example.awsapps.com/start\nSSO region [None]: us-east-1\nSSO registration scopes [sso:account:access]:\n...\nCLI profile name [AdministratorAccess-111111111111]: shop-dev",
          "explanation": "An interactive wizard. It asks for a session name, the start URL and Region, then opens your browser. After you approve and pick the account and permission set, it asks for a profile name and writes the config file shown next. The ... stands for the browser step and a few more prompts. The exact prompt text may differ slightly between CLI versions."
        },
        {
          "language": "ini",
          "filename": "config",
          "source": "[profile shop-dev]\nsso_session = shop\nsso_account_id = 111111111111\nsso_role_name = AdministratorAccess\nregion = us-east-1\n\n[sso-session shop]\nsso_start_url = https://example.awsapps.com/start\nsso_region = us-east-1\nsso_registration_scopes = sso:account:access",
          "output": "",
          "explanation": "This is the `~/.aws/config` file the wizard writes (the example start URL is a placeholder, yours will differ). Several profiles such as shop-staging and shop-prod can share the single `shop` session, so you sign in once. The file only stores settings, so it prints nothing."
        },
        {
          "language": "bash",
          "filename": "login-and-check.sh",
          "source": "aws sso login --profile shop-dev\naws sts get-caller-identity --profile shop-dev --query Account --output text",
          "output": "111111111111",
          "explanation": "The first command opens the browser for approval and prints some progress text. The second prints only the account number, proving you are working in shop-dev. When the session expires, run the first command again."
        }
      ],
      "productionNote": "Humans use SSO profiles named shop-dev, shop-staging and shop-prod. Give the least power that gets the job done: for example, read-only in prod, with admin only where needed. Automated pipelines never use a human's login; they use a different mechanism covered in the CI/CD topic.",
      "commonMistakes": [
        "Giving everyone AdministratorAccess in prod. Use ReadOnly or narrow permission sets there.",
        "Sharing one IAM user or its access keys between people. You lose track of who did what.",
        "Forgetting that SSO sessions expire. When a command fails with an expired or missing token message, run aws sso login --profile <name> again."
      ],
      "sources": [
        { "title": "Configure the AWS CLI to use IAM Identity Center", "url": "https://docs.aws.amazon.com/cli/latest/userguide/sso-configure-profile-token.html#cli-configure-sso-configure" },
        { "title": "Sign in with the AWS CLI (sso login)", "url": "https://docs.aws.amazon.com/cli/latest/userguide/sso-configure-profile-token.html#cli-configure-sso-login" },
        { "title": "Permission sets", "url": "https://docs.aws.amazon.com/singlesignon/latest/userguide/permissionsetsconcept.html" }
      ]
    },
    {
      "id": "dev-staging-prod-accounts",
      "title": "dev/staging/prod accounts",
      "explanation": "An environment is a separate copy of the whole system for one purpose: dev is where developers experiment, staging is a near-copy of production used for final checks, and prod serves real users. This course gives each environment its own AWS account: shop-dev, shop-staging and shop-prod.\n\nA separate account is the strongest wall AWS offers. Each account has its own IAM users and roles, its own service quotas, its own cost line on the bill, and its own data. Nothing crosses the wall unless you deliberately build a bridge (the cross-account role sub-topic).\n\nYou do not write the infrastructure three times. Later you will use the AWS CDK (Cloud Development Kit), a tool that describes AWS resources in code. The same code is deployed to each account with different settings, such as how big a database is. Each account needs a one-time setup step for the CDK called bootstrapping, done separately per account and Region.\n\nTo keep the three targets in one place, the course uses a small TypeScript file. TypeScript is JavaScript with type annotations. Create a file named `envs.ts` in an empty folder and run it with `bun run envs.ts` (Bun is the JavaScript runtime used in this course). `Object.keys(envs)` returns the names of the object's entries as a list, and `join(\",\")` glues them into one string. The `as const` ending tells TypeScript the values never change.",
      "analogy": "Three identical kitchens in three separate buildings. They all cook from the same recipe book (your code), but each has its own ingredients, its own cash register and its own keys. A spill in the test kitchen cannot contaminate the restaurant kitchen.",
      "code": [
        {
          "language": "typescript",
          "filename": "envs.ts",
          "source": "export const envs = {\n  dev: { account: \"111111111111\", region: \"us-east-1\" },\n  staging: { account: \"222222222222\", region: \"us-east-1\" },\n  prod: { account: \"333333333333\", region: \"us-east-1\" },\n} as const;\n\nconsole.log(Object.keys(envs).join(\",\"));",
          "output": "dev,staging,prod",
          "explanation": "One object maps each environment name to its account ID and Region. Later topics import `envs` so every deployment picks the right account without anyone typing an ID by hand."
        }
      ],
      "productionNote": "CDK stacks (a stack is one deployable group of resources) will target these three environments, and GitHub environments will map to them one to one in the CI/CD topic. Keeping the IDs in one file means a change is made once, and the three environments cannot drift apart through hand-typed differences.",
      "commonMistakes": [
        "Copying prod data into dev for convenience. That puts real customer data in a less protected account.",
        "Putting staging in the same account as prod. A staging mistake can then hit prod resources, and quotas are shared.",
        "Configuring each account by hand, so settings drift apart over time. Describe all of them in code instead."
      ],
      "sources": [
        { "title": "Benefits of using multiple AWS accounts", "url": "https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/benefits-of-using-multiple-aws-accounts.html" },
        { "title": "AWS CDK StackProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.StackProps.html" }
      ]
    },
    {
      "id": "service-control-policies",
      "title": "Service control policies",
      "explanation": "A service control policy (SCP) is a guardrail that sets the maximum permissions available in member accounts. It is written in the same policy JSON you saw in the IAM topic (Effect, Action, Resource). You attach an SCP to the Root, to an OU, or to a single account, and it applies to everything beneath that point.\n\nAn SCP never grants anything. It only limits what IAM policies in the account can grant. For an action to work, two things must both be true: some IAM policy in the account allows it, and the SCPs allow it at every level from Root down to the account. If any SCP has an explicit Deny for the action, the request is refused, because Deny always wins.\n\nAWS attaches a default SCP called FullAWSAccess, which allows everything, to the Root, every OU and every account. With it in place, nothing is blocked until you add a Deny SCP. If you detach FullAWSAccess without replacing it, nothing is allowed anywhere below, so everything gets denied. The management account is not affected by SCPs at all.\n\nA recommended first SCP denies two dangerous actions: `organizations:LeaveOrganization` (an account removing itself from the Organization, and therefore from your guardrails) and `account:CloseAccount` (permanently closing an account). The policy below does this. Attached to the Root, it applies to all member accounts.\n\nWhat happens next: an administrator in shop-prod who tries to close the account gets an AccessDenied error (the AWS reply meaning the request was refused), even though that administrator has full IAM permissions. The same administrator can still create an ECS service (the container service you will use later), because FullAWSAccess still allows it and the SCP does not mention it.",
      "analogy": "Building rules posted by the landlord. Whatever your own keycard says, the roof door is welded shut for every tenant. The landlord's rules never give you a new room (an SCP never grants), they only remove doors, and no tenant keycard can reopen them (Deny wins).",
      "code": [
        {
          "language": "json",
          "filename": "deny-leave-close.json",
          "source": "{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [\n    {\n      \"Sid\": \"DenyLeaveAndClose\",\n      \"Effect\": \"Deny\",\n      \"Action\": [\n        \"organizations:LeaveOrganization\",\n        \"account:CloseAccount\"\n      ],\n      \"Resource\": \"*\"\n    }\n  ]\n}",
          "output": "",
          "explanation": "Attach this to the Root. `Sid` is just a label for the statement. The Deny covers the two actions on every resource in every member account. It does not touch any other action, so day-to-day work is unchanged. The file is data and prints nothing."
        }
      ],
      "productionNote": "This policy protects prod against accidental or malicious account closure and against an account leaving the Organization. Later you can add Region restrictions with an SCP. Always try a new SCP on an OU that holds only dev accounts first, because a wrong SCP can block your own deployments.",
      "commonMistakes": [
        "Believing an SCP grants access. It only limits. Without an IAM policy that allows the action, it still fails.",
        "Detaching FullAWSAccess without replacing it with another allow. Every action is then denied.",
        "Testing a new SCP on the Prod OU first. Test on a NonProd OU, then roll out to prod."
      ],
      "sources": [
        { "title": "SCP evaluation", "url": "https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_evaluation.html" },
        { "title": "Management account best practices: default controls", "url": "https://docs.aws.amazon.com/organizations/latest/userguide/orgs_best-practices_mgmt-acct.html#bp_mgmt-acct_default-controls" }
      ]
    },
    {
      "id": "cross-account-roles",
      "title": "Cross-account roles",
      "explanation": "Sometimes someone in one account must act inside another. You do this with an IAM role (from the previous topic) that lives in the target account and trusts the calling account. The trust policy is the part of a role that states who may take it on. The caller calls `sts:AssumeRole` (STS is the AWS Security Token Service) and receives temporary credentials, which are short-lived keys that expire on their own. While using them, you act as the role, with only the role's permissions.\n\nWhen Organizations itself creates a member account, it automatically adds a role named OrganizationAccountAccessRole. It trusts the management account and has administrator permissions, so it is a break-glass route: an emergency way in when normal sign-in is not working. Accounts that were invited into the Organization (an existing account joining later) do not get this role automatically. It also does not exist in the management account.\n\nYou do not have to call assume-role by hand. In `~/.aws/config`, a profile with `role_arn` (the role to assume) and `source_profile` (the profile whose identity makes the call) makes the CLI assume the role for you. Below, a `mgmt` profile (an SSO profile for the management account, set up like shop-dev) is the source for a `prod-breakglass` profile.\n\nThe final ARN in the output has `assumed-role` and ends with a session name. The CLI invents that name, so yours will differ. The account number 333333333333 shows you now act inside shop-prod.",
      "analogy": "A visitor pass. Your home office phones ahead, and the other building hands you a timed pass that opens only the listed rooms. The pass expires on its own, and the building keeps a record of who entered.",
      "code": [
        {
          "language": "ini",
          "filename": "config",
          "source": "[profile mgmt]\nsso_session = shop\nsso_account_id = 999999999999\nsso_role_name = AdministratorAccess\nregion = us-east-1\n\n[profile prod-breakglass]\nrole_arn = arn:aws:iam::333333333333:role/OrganizationAccountAccessRole\nsource_profile = mgmt\nregion = us-east-1",
          "output": "",
          "explanation": "Add these profiles to the same `~/.aws/config` file (the `shop` sso-session section stays as in the earlier example). `mgmt` signs you in to the management account. `prod-breakglass` tells the CLI to assume the OrganizationAccountAccessRole in shop-prod using `mgmt` as the starting identity."
        },
        {
          "language": "bash",
          "filename": "assume-check.sh",
          "source": "aws sso login --profile mgmt\naws sts get-caller-identity --profile prod-breakglass --query Arn --output text",
          "output": "arn:aws:sts::333333333333:assumed-role/OrganizationAccountAccessRole/botocore-session-1767225600",
          "explanation": "Log in to the source profile first. The second command then makes the CLI call sts:AssumeRole behind the scenes and prints who you are now: the role in account 333333333333. The number at the end is a made-up session name, so it differs each time."
        }
      ],
      "productionNote": "Use this for emergencies, not daily work. The same assume-role mechanism is what CDK bootstrapping trust and deployment pipelines rely on, which later topics cover. Every assume is recorded in the account's audit logs, which is why you must make sure those logs are being kept.",
      "commonMistakes": [
        "Writing a trust policy that trusts a whole other account with no conditions. Anyone with matching permissions there can use the role.",
        "Using the break-glass role for daily work instead of a proper SSO permission set. Reserve it for emergencies.",
        "Not logging who assumes roles, so after an incident nobody can tell who did what."
      ],
      "sources": [
        { "title": "Accessing member accounts (OrganizationAccountAccessRole)", "url": "https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_accounts_access.html" },
        { "title": "Use an IAM role in the AWS CLI", "url": "https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-role.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why should the shop application not run in the management account?",
      "options": [
        "The management account cannot use ECS or any compute service at all",
        "SCP guardrails do not apply to it and it controls the whole Organization, so a mistake or compromise there reaches everything",
        "AWS charges double for workloads in the management account",
        "It can only be used in one Region"
      ],
      "answerIndex": 1,
      "explanation": "The management account is exempt from SCPs and holds control over every member account, so it is kept for organization tasks only. It can technically run services, and there is no extra charge or Region limit."
    },
    {
      "question": "An SCP denies ec2:* on the Prod OU, while an IAM policy inside shop-prod allows ec2:RunInstances. What happens when someone in shop-prod tries to launch an instance?",
      "options": [
        "It is allowed, because the IAM policy is more specific",
        "It is allowed only if the user is an administrator",
        "It is allowed once, then blocked on later attempts",
        "It is denied, because an explicit Deny in an SCP always wins"
      ],
      "answerIndex": 3,
      "explanation": "SCPs set the maximum permissions. An explicit Deny at any level overrides any Allow in IAM, and even administrators in the account are bound by it."
    },
    {
      "question": "Which command refreshes an expired IAM Identity Center session for the shop-dev profile?",
      "options": [
        "aws s3 ls --profile shop-dev",
        "aws sts assume-role --profile shop-dev",
        "aws sso login --profile shop-dev",
        "aws iam create-access-key --profile shop-dev"
      ],
      "answerIndex": 2,
      "explanation": "aws sso login opens the browser and caches a fresh token. aws configure sso is only for the first setup, and creating access keys is exactly what SSO lets you avoid."
    },
    {
      "question": "Which member accounts do NOT get the OrganizationAccountAccessRole automatically?",
      "options": [
        "Accounts created from inside Organizations",
        "Accounts that were invited into the Organization after already existing",
        "Accounts placed in the Prod OU",
        "Accounts that use IAM Identity Center"
      ],
      "answerIndex": 1,
      "explanation": "Only accounts created through Organizations receive the role. Invited accounts must have it created by hand. The OU an account sits in and its use of Identity Center make no difference."
    },
    {
      "question": "Which two benefits do you get from giving each environment (dev, staging, prod) its own account?",
      "options": [
        "Isolated IAM permissions and separate costs, quotas and data",
        "Faster network speed and free data transfer",
        "No need for IAM policies and no need for backups",
        "Automatic identical settings in all accounts without any code"
      ],
      "answerIndex": 0,
      "explanation": "Separate accounts isolate IAM, quotas, billing and data, so a problem in one environment cannot spill into another. They do not speed up the network, remove the need for policies, or keep settings identical without you defining them in code."
    }
  ]
});
