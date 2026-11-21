window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "03-aws-fundamentals",
  "order": 3,
  "title": "AWS Fundamentals",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Before building anything on AWS (Amazon Web Services, Amazon's cloud platform) you need its basic vocabulary. This topic covers accounts, regions and availability zones, how IAM (the permissions system) decides who can do what, how to log in from the terminal with the AWS CLI, which security jobs are yours, and how to set a spending alert so a mistake does not become a surprise bill.",
  "prerequisites": ["01-deployment-foundations", "02-linux-networking-basics"],
  "subtopics": [
    {
      "id": "accounts-regions-azs",
      "title": "Accounts, regions and availability zones",
      "explanation": "An AWS account is the container for everything you create on AWS. It is both a billing boundary (one bill per account) and a security boundary (resources in one account are separate from resources in another unless you explicitly allow access). Every account has a 12-digit ID such as 111111111111. You will use this ID often, for example when checking that you are working in the right account.\n\nA region is a geographic area where AWS runs data centers, for example us-east-1 (northern Virginia, USA). Most AWS services are regional: a server you create in us-east-1 is not visible when you look at eu-west-1. This course uses us-east-1 everywhere. One region keeps the examples simple, and certificates used by CloudFront (AWS's content delivery network, covered later) must live in us-east-1 anyway.\n\nAn availability zone (AZ) is one or more separate data centers inside a region, each with its own power, cooling and network. AZ names are the region name plus a letter: us-east-1a, us-east-1b, and so on. AZs in a region are connected by fast private links, so spreading your servers across them is cheap to do.\n\nThe shop in this course runs across 3 AZs. If one AZ loses power or network, the other two keep serving customers. With everything in a single AZ, that one failure takes the whole shop down. Later topics apply this: the network (VPC, topic 08) spans 3 AZs, and the database (Aurora, topic 11) keeps readers (read-only copies of the database, covered in topic 11) in different AZs.",
      "analogy": "Think of a retail chain. The account is one company's books: who owns the shops and who gets the bill. A region is a city. The availability zones are separate branches across town, each on a different power grid. If one branch floods, the others keep selling. A company that put its whole stock in one branch would be closed until the water was pumped out.",
      "code": [
        {
          "language": "bash",
          "filename": "list-azs.sh",
          "source": "aws ec2 describe-availability-zones --region us-east-1 --query \"AvailabilityZones[].ZoneName\" --output text",
          "output": "us-east-1a\tus-east-1b\tus-east-1c\tus-east-1d\tus-east-1e\tus-east-1f",
          "explanation": "This command runs in a terminal after the AWS CLI is configured (next sub-topics). `aws` is the AWS command line tool, `ec2` is the service (virtual servers) and `describe-availability-zones` asks which AZs exist. `--region us-east-1` picks the region. `--query` is a filter applied to the JSON answer: `AvailabilityZones[].ZoneName` means 'from the list called AvailabilityZones, take the ZoneName of every item'. `--output text` prints plain values separated by tabs instead of JSON. The exact count and order of zones can differ per account, so your output may list a different set."
        }
      ],
      "productionNote": "Production designs always say how many AZs they use and why. In this course the VPC uses maxAzs 3 and the Aurora cluster puts readers in different AZs, so losing one AZ costs capacity but not availability. Keep every resource of one environment in the same region so they can reach each other.",
      "commonMistakes": [
        "Putting everything in one AZ, so a single AZ failure is a full outage.",
        "Mixing regions by accident (for example creating a database in one region and a server in another), so the resources cannot see each other. Check the region before every create command.",
        "Using the root user of the account (the original sign-in with the account's email address, which has unlimited power) for daily work. Create restricted identities instead, as the next sub-topic shows."
      ],
      "sources": [
        { "title": "Regions and Availability Zones (Amazon EC2 User Guide)", "url": "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html" },
        { "title": "describe-availability-zones (AWS CLI reference)", "url": "https://docs.aws.amazon.com/cli/latest/reference/ec2/describe-availability-zones.html" }
      ]
    },
    {
      "id": "iam-users-roles-policies",
      "title": "IAM users, roles and policies",
      "explanation": "IAM (Identity and Access Management) is the AWS service that decides who can do what. Every request to AWS comes from an identity, and IAM checks whether a policy lets that identity perform that action on that resource.\n\nA policy is a JSON document (JSON is a text format of keys and values in braces and brackets). It has a Version (always \"2012-10-17\") and a Statement list. Each statement has an Effect (Allow or Deny), an Action (an operation such as s3:GetObject, meaning 'read an object from S3', AWS's file storage), and a Resource.\n\nThe Resource is an ARN (Amazon Resource Name), the unique address of one AWS thing, for example arn:aws:s3:::shop-assets-dev/* for every object in the bucket shop-assets-dev. An S3 bucket is a named container for files, and each file inside it is an object.\n\nThe evaluation rules are short. By default everything is denied. An Allow opens one action on one resource. An explicit Deny always wins over any Allow. Least privilege means giving an identity only the actions and resources it needs, and nothing more.\n\nThere are two kinds of identity. An IAM user is a long-term identity, typically one person, with a permanent password or access keys (an ID plus a secret that act like a username and password for programs). A role is an identity that anyone you trust can temporarily assume (wear). It gives short-lived credentials that expire on their own. Servers, such as an ECS task (a running container on AWS), and pipelines (automatic build-and-deploy runs) such as GitHub Actions use roles, and people can use roles through single sign-on (one login that opens several AWS accounts, covered in topic 04).\n\nPrefer roles for anything automated. Access keys for an app are long-lived secrets that can leak into code, logs or chat. A role's credentials expire in hours, so a leak has a short life.",
      "analogy": "Picture a hotel. A user is a guest with a permanent name badge. A role is a uniform, such as 'housekeeping', that any authorised person can put on for one shift and take off afterwards. A policy is the list on the uniform of which doors its keycard opens. A Deny is a door marked 'never', and no uniform opens it, whatever else the keycard allows.",
      "code": [
        {
          "language": "json",
          "filename": "read-assets-policy.json",
          "source": "{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [\n    {\n      \"Effect\": \"Allow\",\n      \"Action\": \"s3:GetObject\",\n      \"Resource\": \"arn:aws:s3:::shop-assets-dev/*\"\n    }\n  ]\n}",
          "output": "",
          "explanation": "Line by line: `Version` is the policy language version and is always \"2012-10-17\". `Statement` is the list of rules, here one. `Effect: Allow` opens something. `Action: s3:GetObject` is the single operation allowed, reading an object. `Resource` limits it to objects inside the bucket shop-assets-dev; the `/*` means 'every object in it'. Anything not listed is denied by default, so `s3:PutObject` (uploading) fails for an identity with only this policy. The file prints nothing because it is data, not a program."
        },
        {
          "language": "json",
          "filename": "allow-all-s3-but-delete.json",
          "source": "{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [\n    {\n      \"Effect\": \"Allow\",\n      \"Action\": \"s3:*\",\n      \"Resource\": \"*\"\n    },\n    {\n      \"Effect\": \"Deny\",\n      \"Action\": \"s3:DeleteObject\",\n      \"Resource\": \"*\"\n    }\n  ]\n}",
          "output": "",
          "explanation": "The first statement allows every S3 action (`s3:*`, where `*` is a wildcard meaning 'anything') on every resource. The second statement denies deleting objects. When both match a delete request, the explicit Deny wins, so deletes fail while all other S3 actions work. Wide wildcards like these are shown only to demonstrate Deny; real policies should be much narrower."
        }
      ],
      "productionNote": "The shop's ECS tasks will use a task role (topic 09), and the GitHub pipeline will assume a role through OIDC, a way to trust GitHub without stored keys (topic 17). Topic 21 reviews every policy for least privilege. Write policies with specific actions and ARNs from the start.",
      "commonMistakes": [
        "Writing \"Action\": \"*\" with \"Resource\": \"*\", which grants everything to everything and defeats least privilege.",
        "Creating access keys for applications instead of giving them a role.",
        "Using the bucket ARN (arn:aws:s3:::shop-assets-dev) when the action works on objects. Object actions such as s3:GetObject need the object ARN ending in /*; bucket-level actions use the bucket ARN."
      ],
      "sources": [
        { "title": "IAM JSON policy elements reference", "url": "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements.html" },
        { "title": "IAM roles", "url": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html" },
        { "title": "Policy evaluation logic", "url": "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html" }
      ]
    },
    {
      "id": "aws-cli-credentials",
      "title": "AWS CLI and credentials",
      "explanation": "The AWS CLI (command line interface) version 2 is a terminal program, named `aws`, that calls AWS's APIs (the web interfaces AWS offers to programs) for you. You install it by hand from the official page linked in the sources. Afterwards, open a terminal and run `aws --version` to confirm it is installed.\n\nA profile is a named set of settings, such as region and how to obtain credentials. Profiles live in the file `~/.aws/config` (`~` means your home folder, and the file is created for you by AWS CLI setup commands or by you in a text editor). You choose a profile with `--profile name` on a command, or with the environment variable AWS_PROFILE (an environment variable is a named value set in your shell, taught in topic 02).\n\nThe CLI looks for credentials in a fixed order and uses the first it finds. In simplified form: first command-line options, then environment variables (such as AWS_ACCESS_KEY_ID), then the profile files (`~/.aws/config` and `~/.aws/credentials`). Other sources exist; you can ignore them for now. The consequence is that access keys left in your environment can override the profile you thought you were using.\n\nPrefer single sign-on, set up in topic 04, over long-lived access keys. Single sign-on gives you short-lived credentials after you log in.\n\nBefore any change, run `aws sts get-caller-identity`. STS is the Security Token Service, and this command simply answers 'who am I right now?' without changing anything.",
      "analogy": "A TV remote with several saved viewer profiles. Each profile has its own account and payment method. `aws sts get-caller-identity` is the screen that shows whose profile is active, which you look at before buying a movie so the bill goes to the right person. A spare remote tucked under the sofa (an environment key) overrides the one you picked, whatever channel you chose.",
      "code": [
        {
          "language": "ini",
          "filename": "config",
          "source": "[profile shop-dev]\nregion = us-east-1\noutput = json",
          "output": "",
          "explanation": "This is the content of `~/.aws/config` (a file named `config` in a folder named `.aws` in your home folder; create the folder and file if they do not exist). `[profile shop-dev]` starts a profile named shop-dev. `region` is the default region for commands, and `output` is the default output format. This profile has no credentials yet; topic 04 adds single sign-on settings to it."
        },
        {
          "language": "bash",
          "filename": "whoami.sh",
          "source": "aws sts get-caller-identity --profile shop-dev",
          "output": "{\n    \"UserId\": \"AROAEXAMPLEID:alice\",\n    \"Account\": \"111111111111\",\n    \"Arn\": \"arn:aws:sts::111111111111:assumed-role/AWSReservedSSO_AdministratorAccess_abc123/alice\"\n}",
          "explanation": "This output assumes the profile was set up with single sign-on, and the IDs are illustrative. `UserId` is the unique ID of the identity (AROA... marks a role, followed by the session name alice). `Account` is the 12-digit account the commands will act on, which is the field to check. `Arn` is the full address of the identity: here, a session named alice using an assumed role named AWSReservedSSO_AdministratorAccess_abc123 (the role IAM Identity Center creates for the AdministratorAccess permission set)."
        }
      ],
      "productionNote": "Make `aws sts get-caller-identity` the first command in every runbook (topic 23) so nobody changes the wrong account. The CI pipeline (topic 17) runs it too, to verify the role it assumed. Never commit `~/.aws/credentials` or any file with keys to Git.",
      "commonMistakes": [
        "Leaving AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in the environment. They rank above the profile files in the lookup order, so commands silently use those keys.",
        "Committing `~/.aws/credentials` or a `.env` file with keys to a repository.",
        "Running production commands with a dev profile (or the reverse) because the identity was never checked."
      ],
      "sources": [
        { "title": "Configuration and credential precedence (AWS CLI User Guide)", "url": "https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html#configure-precedence" },
        { "title": "get-caller-identity (AWS CLI reference)", "url": "https://docs.aws.amazon.com/cli/latest/reference/sts/get-caller-identity.html" },
        { "title": "Installing the AWS CLI", "url": "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html" }
      ]
    },
    {
      "id": "shared-responsibility-model",
      "title": "Shared responsibility model",
      "explanation": "The shared responsibility model says who secures what. AWS is responsible for security 'of' the cloud: buildings, hardware, the hypervisor (the software that splits one physical machine into many virtual ones) and the internals of managed services. You are responsible for security 'in' the cloud: IAM permissions, your data, network rules, your application code, the packages inside your container images, and encryption settings.\n\nManaged services move the line but never remove it. With Fargate (AWS runs the servers for your containers, covered in topic 09) and Aurora (a managed database, topic 11), AWS patches the host operating system and the database engine. You still decide who can connect, what is public, and what is encrypted.\n\nExamples used in this course:\n\nFargate host operating system: AWS.\nPackages inside your container image: you.\nAurora engine patching: AWS applies the patches, but you choose the minor version and the timing.\nSecurity group rules (firewall rules for a resource): you.\nWhether an S3 bucket is publicly readable: you.",
      "analogy": "Renting a flat in a managed building. The landlord looks after the lock on the main entrance, the roof and the wiring. You lock your own door, decide who gets a key, and choose what you leave on the table by the window. A great lock on the front door does not help if you leave your own door open.",
      "code": [
        {
          "language": "markdown",
          "filename": "responsibility-table.md",
          "source": "| Item                                   | Who is responsible                          |\n|----------------------------------------|---------------------------------------------|\n| Fargate host operating system          | AWS                                         |\n| Packages inside your container image   | You                                         |\n| Aurora engine patching                 | AWS applies; you choose version and timing  |\n| Security group rules                   | You                                         |\n| S3 bucket public access                | You                                         |",
          "output": "",
          "explanation": "This is a reference table, not a program, so it prints nothing. Read each row as 'if this goes wrong, whose job was it?'. Note that the Aurora row is shared: AWS does the patching work, but you decide which version you run and when."
        }
      ],
      "productionNote": "Turn this model into a checklist in topic 21: who owns each risk, and what you do about the ones that are yours. Rebuild and redeploy images regularly, because AWS will never patch the packages inside them.",
      "commonMistakes": [
        "Assuming a managed service is secure by default. AWS secures the service, but your configuration is yours.",
        "Leaving an S3 bucket public by accident.",
        "Never rebuilding container images, so known bugs in old packages stay in production."
      ],
      "sources": [
        { "title": "AWS Shared Responsibility Model", "url": "https://aws.amazon.com/compliance/shared-responsibility-model/" },
        { "title": "Security in Amazon ECS", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security.html" }
      ]
    },
    {
      "id": "billing-budgets",
      "title": "Billing alarms and budgets",
      "explanation": "AWS charges for what you use. That makes mistakes expensive quickly: a NAT gateway (a paid service that lets private servers reach the internet, covered in topic 08) moving a lot of traffic, a load test you forgot to stop, or 100 containers left running over a weekend.\n\nAWS Budgets lets you set a monthly cost limit and get an email when actual spend, or forecasted spend, crosses a percentage of it. You can create a budget in the web console or from the CLI. The CLI takes JSON files describing the budget and the notifications. Save the first block as `budget.json` and the second as `notifications.json` in one new folder, then open a terminal in that folder.\n\nThe budget file names the budget, its limit (an amount and a currency unit), its time unit (MONTHLY) and its type (COST). The notifications file lists alert rules. Each rule has a type (ACTUAL for money already spent, FORECASTED for predicted spend), a comparison (GREATER_THAN), a threshold, and subscribers who get the email.\n\nWith a limit of 300 USD and a threshold of 80 percent, the alert fires when actual spend goes above 240 USD. Use a monitored address for the subscriber, not a mailbox nobody reads.",
      "analogy": "A prepaid phone plan that texts you 'you have used 80% of your data'. You still have data left, so you can change your behaviour before the plan runs out or you start paying extra.",
      "code": [
        {
          "language": "json",
          "filename": "budget.json",
          "source": "{\n  \"BudgetName\": \"shop-dev-monthly\",\n  \"BudgetLimit\": { \"Amount\": \"300\", \"Unit\": \"USD\" },\n  \"TimeUnit\": \"MONTHLY\",\n  \"BudgetType\": \"COST\"\n}",
          "output": "",
          "explanation": "The budget is named shop-dev-monthly, limited to 300 USD per month, and tracks cost (as opposed to usage). Amount is written as a string, as the AWS API expects."
        },
        {
          "language": "json",
          "filename": "notifications.json",
          "source": "[\n  {\n    \"Notification\": {\n      \"NotificationType\": \"ACTUAL\",\n      \"ComparisonOperator\": \"GREATER_THAN\",\n      \"Threshold\": 80,\n      \"ThresholdType\": \"PERCENTAGE\"\n    },\n    \"Subscribers\": [\n      { \"SubscriptionType\": \"EMAIL\", \"Address\": \"ops@example.com\" }\n    ]\n  }\n]",
          "output": "",
          "explanation": "One alert rule: when ACTUAL spend is GREATER_THAN 80 PERCENTAGE of the budget, send an email to ops@example.com. The outer square brackets make it a list because a budget can have several alert rules (for example one for forecasted spend as well)."
        },
        {
          "language": "bash",
          "filename": "create-budget.sh",
          "source": "aws budgets create-budget --account-id 111111111111 --budget file://budget.json --notifications-with-subscribers file://notifications.json",
          "output": "",
          "explanation": "`file://` tells the CLI to read the value from a file in the current folder. Use your own 12-digit account ID. On success the command prints nothing and exits with code 0. Run it in the folder that contains both JSON files."
        }
      ],
      "productionNote": "Create one budget per account (dev, staging, prod), each emailing a monitored team address. Topic 23 adds cost allocation tags so you can see which part of the system causes the spend.",
      "commonMistakes": [
        "Having no budget in the dev account, because 'it is only dev'.",
        "Sending alerts to an inbox nobody reads.",
        "Forgetting resources created for a load test, which keep billing after the test ends."
      ],
      "sources": [
        { "title": "Managing your costs with AWS Budgets", "url": "https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html" },
        { "title": "create-budget (AWS CLI reference)", "url": "https://docs.aws.amazon.com/cli/latest/reference/budgets/create-budget.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why does the shop run across three availability zones instead of one?",
      "options": [
        "Each AZ is a separate region, so three AZs give three times the legal coverage",
        "If one AZ loses power or network, the other two keep serving customers",
        "AWS charges nothing for a service that runs in three AZs",
        "A single AZ cannot run more than one server"
      ],
      "answerIndex": 1,
      "explanation": "AZs are separate data centers with their own power and network inside one region. Spreading across them means one failure does not take the shop down. AZs are not regions, cost is not removed, and one AZ can run many servers."
    },
    {
      "question": "A policy has Allow for s3:* and Deny for s3:DeleteObject, and both match a delete request. What happens?",
      "options": [
        "The delete succeeds, because Allow is listed first",
        "The delete succeeds, because s3:* is more specific",
        "The delete is refused, because an explicit Deny beats any Allow",
        "AWS asks the user to confirm the delete"
      ],
      "answerIndex": 2,
      "explanation": "An explicit Deny always wins over Allow, regardless of order or wildcards. Everything not explicitly allowed is also denied by default."
    },
    {
      "question": "An ECS task needs to read from S3. Should it use an IAM user with access keys or an IAM role, and why?",
      "options": [
        "A user, because users have no expiry date so the app never loses access",
        "A user, because roles cannot be given to running containers",
        "Either one, since both hand out identical permanent credentials",
        "A role, because it gives short-lived credentials that expire on their own and need no stored secret"
      ],
      "answerIndex": 3,
      "explanation": "Roles can be attached to ECS tasks and give temporary credentials. Access keys are long-lived secrets that can leak into code or logs and must be rotated by hand."
    },
    {
      "question": "`aws sts get-caller-identity` shows account 111111111111, but you meant to work in the prod account. What should you check first?",
      "options": [
        "Which profile you selected (--profile or AWS_PROFILE) and whether AWS_ACCESS_KEY_ID is set in your environment and overriding it",
        "Whether the region has three availability zones",
        "Whether the monthly budget has been exceeded",
        "Whether the container image has been rebuilt recently"
      ],
      "answerIndex": 0,
      "explanation": "The identity comes from the profile or from environment keys, which rank above the profile files in the lookup order. Regions, budgets and images do not change which account your commands use."
    },
    {
      "question": "Who is responsible for patching the packages installed inside your container image running on Fargate?",
      "options": [
        "AWS, because Fargate is a managed service",
        "You, because the image contents are part of security 'in' the cloud",
        "The Docker project, automatically at each deploy",
        "Nobody, because containers cannot contain vulnerable packages"
      ],
      "answerIndex": 1,
      "explanation": "AWS patches the Fargate host, but the image contents are yours. You must rebuild and redeploy images to pick up patches."
    }
  ]
});
