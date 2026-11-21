window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "23-cost-operations",
  "order": 23,
  "title": "Cost & Operations",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Launching the system is only the start: someone must watch the bill, answer alarms at 3am, handle outages calmly, and keep everything patched. This topic covers tagging and Cost Explorer, Savings Plans and right-sizing, runbooks, incident response with blameless postmortems, and a day-2 maintenance calendar. All prices in it are made-up example numbers, so check the AWS pricing page for real ones.",
  "prerequisites": ["03-aws-fundamentals", "18-observability", "19-autoscaling-performance", "22-reliability-dr"],
  "subtopics": [
    {
      "id": "cost-explorer-budgets-tagging",
      "title": "Cost Explorer, budgets and tagging",
      "explanation": "A **tag** is a small label made of a key and a value, for example key `env` and value `prod`. You attach tags to AWS resources (a bucket, a database, a load balancer). By itself a tag changes nothing about how the resource works. Its purpose is to let you group things later, and the AWS bill is the most useful thing to group.\n\n**Cost Explorer** is the screen in the AWS console (also reachable from the CLI) that charts your spend over time. You can group the chart by service (Fargate, Aurora, CloudFront...), by account, or by a tag. Grouping by the tag `env` answers the question \"how much does dev cost compared with prod?\". Topic 03 introduced **AWS Budgets**, which alert you when spend crosses an amount you set. Budgets tell you that something is wrong, and Cost Explorer with tags tells you where.\n\nIn CDK (the Cloud Development Kit from topic 07), `Tags.of(scope).add(key, value)` attaches a tag to every resource inside that scope that supports tags. `Tags.of(app)` covers the whole app, and `Tags.of(someStack)` covers one stack. The tag is added when CDK builds the CloudFormation template, so it does not matter whether you call it before or after you create the resources.\n\nOne extra step is easy to miss. Applying a tag is not enough for billing. In the Billing console you must **activate** the tag as a **cost allocation tag**. Only then does the tag show up in Cost Explorer, and by default only for usage after activation (a management-account user can request a backfill of up to 12 months, but only for months when the resource already carried the tag). A newly activated tag can take up to about a day to appear, so activate your keys (`project`, `env`) early, before you need them.\n\nIn Cost Explorer, the biggest lines for a system like this course's usually are: Fargate (compute), Aurora (database), data transfer and CloudFront, NAT gateway processing (a NAT gateway charges per gigabyte that passes through it, on top of its hourly fee), the load balancer (ALB), and CloudWatch logs. Some costs, such as data transfer, cannot be tagged. Group those by service instead of by tag.\n\nAWS also offers **cost anomaly detection**, which learns your normal spending pattern and emails you when a service suddenly deviates. It is worth switching on once your baseline is stable, but this topic does not set it up in detail.",
      "analogy": "Think of colour-coded receipts per department in a company. If every receipt carries a colour (blue for marketing, green for engineering), the accountant can add up who spent what in minutes. Without colours, the accountant has one big pile of paper. Activating the tag in Billing is like telling the accountant to start reading the colours, and the receipts from before that day stay uncoloured unless you request a backfill.",
      "code": [
        {
          "language": "typescript",
          "filename": "infra/tags-check.ts",
          "source": "import { App, Stack, Tags } from \"aws-cdk-lib\";\nimport { Bucket } from \"aws-cdk-lib/aws-s3\";\nimport { Match, Template } from \"aws-cdk-lib/assertions\";\n\nconst app = new App();\nconst devStack = new Stack(app, \"ShopDev\");\nconst prodStack = new Stack(app, \"ShopProd\");\nnew Bucket(devStack, \"Assets\");\nnew Bucket(prodStack, \"Assets\");\n\n// \"project\" goes on everything in the app; \"env\" goes per stack.\nTags.of(app).add(\"project\", \"shop\");\nTags.of(devStack).add(\"env\", \"dev\");\nTags.of(prodStack).add(\"env\", \"prod\");\n\nconst dev = Template.fromStack(devStack);\ndev.hasResourceProperties(\"AWS::S3::Bucket\", {\n  Tags: Match.arrayWith([{ Key: \"project\", Value: \"shop\" }]),\n});\ndev.hasResourceProperties(\"AWS::S3::Bucket\", {\n  Tags: Match.arrayWith([{ Key: \"env\", Value: \"dev\" }]),\n});\nconsole.log(\"dev bucket tags ok\");\n\nconst prod = Template.fromStack(prodStack);\nprod.hasResourceProperties(\"AWS::S3::Bucket\", {\n  Tags: Match.arrayWith([{ Key: \"env\", Value: \"prod\" }]),\n});\nconsole.log(\"prod bucket tags ok\");\n",
          "output": "dev bucket tags ok\nprod bucket tags ok",
          "explanation": "Save this as `infra/tags-check.ts` and run it with `bun run infra/tags-check.ts` from the project folder. It builds two stacks (dev and prod) with one S3 bucket each. `Tags.of(app).add(\"project\", \"shop\")` tags every taggable resource in both stacks, and the two per-stack calls add the `env` tag. `Template.fromStack` turns a stack into its CloudFormation template (topic 07), and `hasResourceProperties` throws an error if the bucket does not carry the expected tag, so reaching the `console.log` lines proves the tags are in the template. `Match.arrayWith` means the `Tags` list must contain that entry, and other entries are allowed."
        },
        {
          "language": "bash",
          "filename": "cost-by-env.sh",
          "source": "aws ce get-cost-and-usage \\\n  --time-period Start=2026-11-01,End=2026-11-22 \\\n  --granularity MONTHLY \\\n  --metrics UnblendedCost \\\n  --group-by Type=TAG,Key=env \\\n  --query \"ResultsByTime[0].Groups[].[Keys[0],Metrics.UnblendedCost.Amount]\" \\\n  --output text",
          "output": "env$dev\t41.2873\nenv$prod\t318.9051\nenv$\t12.0440",
          "explanation": "`aws ce` is the Cost Explorer part of the AWS CLI. `End` is exclusive, so this covers 1 to 21 November. `UnblendedCost` is the plain cost of the usage. `--group-by Type=TAG,Key=env` splits the total by the value of the `env` tag, and the `--query` option trims the JSON to key and amount pairs. Keys look like `env$dev` (tag key, a dollar sign, tag value). The line `env$` is spend with no `env` tag at all, which is exactly the untagged spend you want to shrink. The amounts shown are example values and will differ in your account."
        }
      ],
      "productionNote": "Hold a monthly cost review: open Cost Explorer grouped by service, then by `env`, compare with last month, and investigate anything that grew without a reason. Keep the tag keys in one place in code (a lower-case list such as `project`, `env`) and activate them as cost allocation tags in the management (payer) account if you use AWS Organizations (topic 04). Keep an AWS Budget per account with alerts at a percentage of the monthly limit, as set up in topic 03.",
      "commonMistakes": [
        "Applying tags in CDK but never activating them as cost allocation tags in Billing, so Cost Explorer shows no tag data.",
        "Inconsistent keys such as `Env` in one stack and `env` in another. Tag keys are case-sensitive, so these become two separate groups.",
        "Ignoring costs that cannot be tagged (data transfer, some shared services) instead of grouping them by service and reviewing them anyway.",
        "Expecting activated tags to fill in past months automatically. By default they apply only to usage after activation; request a backfill (up to 12 months) if you need history."
      ],
      "sources": [
        { "title": "AWS Billing: Using cost allocation tags", "url": "https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html" },
        { "title": "AWS CDK v2 guide: Tagging", "url": "https://docs.aws.amazon.com/cdk/v2/guide/tagging.html" },
        { "title": "AWS CLI reference: ce get-cost-and-usage", "url": "https://docs.aws.amazon.com/cli/latest/reference/ce/get-cost-and-usage.html" }
      ]
    },
    {
      "id": "savings-plans-right-sizing",
      "title": "Savings Plans and right-sizing",
      "explanation": "There are two main ways to lower a cloud bill that is already running: pay less per unit of compute, and use fewer units.\n\nA **Compute Savings Plan** is an agreement with AWS: you promise to spend a fixed amount of money per hour on compute (for example $1.20 per hour) for 1 or 3 years, and in return the hourly rate is discounted. It applies automatically to Fargate, and also to EC2 and Lambda. You pay the committed amount every hour whether you use it or not, so the plan only saves money if your real usage stays above the commitment.\n\nThat is why you commit only to the **steady baseline**, the compute you use even at the quietest time, which for this course's service is the minimum task count. Do not commit to the peak. Suppose the service runs at least 20 tasks and sometimes 120. Cover the 20. The extra 100 tasks are bought at the normal on-demand price (on-demand means pay per use with no commitment) only while they exist. For Aurora, the equivalent is a **reserved instance**: a 1 or 3 year commitment for a specific database instance class, suited to the always-on writer and readers.\n\n**Right-sizing** means choosing the smallest task or instance size that still handles the load with headroom (spare capacity). Topic 18 enabled Container Insights, which reports CPU and memory use per task. A practical rule from this course: if a task's memory use stays under about 40% of what you reserved, try the next smaller size. Judge by a representative period, such as two weeks including a busy day, never from one quiet day. ARM64 (cheaper per unit of work on Fargate) was already chosen in topic 09, and Fargate Spot for the extra web tasks came from topic 19.\n\nThe cheapest resource is one that no longer exists. Regularly delete idle things: old images in ECR (use a lifecycle rule that expires them), CloudWatch log groups with no retention limit, VPC endpoints in dev that nobody uses, and leftovers from load tests (topic 20).",
      "analogy": "A Savings Plan is a monthly train pass for your daily commute: you pay a fixed amount for the trips you make every single day (the baseline) and get a lower price per trip. On the odd day when you take extra trips, you pay per ride (on-demand). Buying a pass for ten trips a day because of one busy week would waste money. Right-sizing is choosing whether you need a first-class ticket at all when a standard seat is mostly empty.",
      "code": [
        {
          "language": "typescript",
          "filename": "commit.ts",
          "source": "// Example price — check the AWS pricing page for the real one.\n// (Memory is billed separately on Fargate; this only models vCPU.)\nconst minTasks = 20;\nconst peakTasks = 120;\nconst vcpu = 2;\nconst hours = 730; // hours in an average month\nconst examplePricePerVcpuHour = 0.03;\n\nconsole.log(\"baseline vCPU-hours/month:\", minTasks * vcpu * hours);\nconsole.log(\"example on-demand $:\", (minTasks * vcpu * hours * examplePricePerVcpuHour).toFixed(2));\nconsole.log(\"example baseline $/hour:\", (minTasks * vcpu * examplePricePerVcpuHour).toFixed(2));\n\n// What a plan sized at the peak would force you to pay for, all month.\nconsole.log(\"if committed at peak vCPU-hours/month:\", peakTasks * vcpu * hours);\nconsole.log(\"example $ at peak:\", (peakTasks * vcpu * hours * examplePricePerVcpuHour).toFixed(2));\n",
          "output": "baseline vCPU-hours/month: 29200\nexample on-demand $: 876.00\nexample baseline $/hour: 1.20\nif committed at peak vCPU-hours/month: 175200\nexample $ at peak: 5256.00",
          "explanation": "Run it with `bun run commit.ts`. The baseline is 20 tasks times 2 vCPU times 730 hours, which is 29,200 vCPU-hours a month. At the example price of $0.03 per vCPU-hour (not a real AWS price) that is $876.00 on-demand, which means a commitment of about $1.20 per hour. Committing at the peak of 120 tasks would mean paying for 175,200 vCPU-hours every month, though the extra 100 tasks only run during spikes. The point is the shape of the maths, not the dollar figures."
        }
      ],
      "productionNote": "Review commitments and sizes quarterly. Before buying a Savings Plan, look at at least a few weeks of usage and take the lowest steady level, then commit to somewhat less than it so a future right-sizing does not leave you over-committed. Record the Container Insights numbers you used when you shrink a task, so the decision can be checked later.",
      "commonMistakes": [
        "Committing to the peak instead of the baseline, so you pay for capacity that sits unused most of the time.",
        "Right-sizing from a single quiet day or a single busy day instead of a representative period.",
        "Focusing only on compute and ignoring NAT gateway processing and data transfer, which can be a large share of the bill.",
        "Forgetting that memory is billed too: the vCPU-only maths above is a simplification."
      ],
      "sources": [
        { "title": "What is Savings Plans? (User Guide)", "url": "https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html" },
        { "title": "Amazon ECS: CloudWatch Container Insights", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cloudwatch-container-insights.html" },
        { "title": "AWS Fargate pricing", "url": "https://aws.amazon.com/fargate/pricing/" }
      ]
    },
    {
      "id": "runbooks",
      "title": "Runbooks",
      "explanation": "A **runbook** is a written, step-by-step guide for one known problem, usually one alarm. It lists the symptoms, which dashboards and queries to open, what to check in order, how to fix each likely cause, and when to escalate (hand the problem to someone more senior or more specialised). The person following it is **on-call**, meaning they are the one designated to respond when an alarm pages them, often at night and half asleep. A runbook is written calmly in advance so that they do not have to think from scratch under stress.\n\nA good runbook starts with the safest possible step: `aws sts get-caller-identity` (from topic 03) to confirm which AWS account and role your terminal is using. Running a command against dev when you believe you are in prod, or the other way round, is a classic mistake that costs minutes during an incident.\n\nKeep runbooks in the same Git repository as the code, for example `docs/runbooks/api-5xx.md`, and review changes to them like code in pull requests (proposed changes that a teammate reviews before they are merged). Then they change together with the system they describe.\n\nLink each runbook from the alarm itself. A CloudWatch alarm has an `alarmDescription` field, and the text shows up in the alert notification. Putting the runbook URL there means the person who gets paged is one click from the steps. The example below shows both parts: the alarm in CDK that pages when the load balancer sees at least 50 server errors (HTTP 5XX, from topic 01) per minute for 3 minutes in a row, and the runbook it points to.",
      "analogy": "A runbook is the laminated emergency card in the pocket of an aeroplane seat. It was written calmly, by people who thought about it in advance, and it is used by someone under stress who should not have to invent a procedure. It also has to be kept current: a card that describes an old model of plane is worse than none.",
      "code": [
        {
          "language": "typescript",
          "filename": "infra/alarm-runbook.ts",
          "source": "import { App, Duration, Stack } from \"aws-cdk-lib\";\nimport * as cloudwatch from \"aws-cdk-lib/aws-cloudwatch\";\nimport { Template } from \"aws-cdk-lib/assertions\";\n\nconst app = new App();\nconst stack = new Stack(app, \"ShopProdAlarms\");\n\nconst errors = new cloudwatch.Metric({\n  namespace: \"AWS/ApplicationELB\",\n  metricName: \"HTTPCode_Target_5XX_Count\",\n  dimensionsMap: { LoadBalancer: \"app/shop-prod/0123456789abcdef\" }, // placeholder ALB id\n  statistic: \"Sum\",\n  period: Duration.minutes(1),\n});\n\nerrors.createAlarm(stack, \"Api5xx\", {\n  alarmName: \"Api5xx\",\n  alarmDescription: \"Runbook: https://github.com/acme/shop/blob/main/docs/runbooks/api-5xx.md\",\n  threshold: 50,\n  evaluationPeriods: 3,\n  datapointsToAlarm: 3,\n  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,\n  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,\n});\n\nconst alarms = Template.fromStack(stack).findResources(\"AWS::CloudWatch::Alarm\");\nconsole.log(Object.values(alarms)[0].Properties.AlarmDescription);\n",
          "output": "Runbook: https://github.com/acme/shop/blob/main/docs/runbooks/api-5xx.md",
          "explanation": "Run it with `bun run infra/alarm-runbook.ts`. The alarm fires when the one-minute sum of 5XX responses is at least 50 for 3 consecutive minutes (`evaluationPeriods` and `datapointsToAlarm` from topic 18). `treatMissingData: NOT_BREACHING` means \"no data\" counts as healthy. The script builds the CloudFormation template and prints the `AlarmDescription` stored on the alarm, which is the exact text your on-call engineer will see. The load balancer id and the GitHub address are placeholders."
        },
        {
          "language": "markdown",
          "filename": "docs/runbooks/api-5xx.md",
          "source": "# Runbook: Api5xx\n\n**Trigger:** alarm `Api5xx` (at least 50 5XX responses per minute for 3 minutes).\n**Impact:** users see errors from the shop API.\n**Escalate:** if not mitigated after 15 minutes, page the secondary on-call.\n\n## Steps\n\n1. Confirm where you are. Run `aws sts get-caller-identity` and check\n   the account is the prod account. Open the dashboard `shop-prod`.\n2. Find the top errors. In CloudWatch Logs Insights (topic 18), on the\n   API log group, run:\n   `filter level = \"error\" | stats count(*) as n by msg | sort n desc | limit 10`\n   (field names depend on your log format).\n3. Was there a recent deploy? Run\n   `aws ecs describe-services --cluster shop-prod --services api --query \"services[0].deployments\"`.\n   If a new revision is failing and the circuit breaker did not roll it\n   back, redeploy the previous image tag through the pipeline.\n4. Is it the database? Check whether RDS Proxy connections are pinned\n   and look at Aurora CPU.\n5. Is it the cache? Check Valkey CPU and evictions.\n6. Still failing at 15 minutes: escalate.\n\n## After\n\nWrite down what fixed it, and update this runbook if a step was wrong.\n",
          "output": "",
          "explanation": "This file is documentation, so it prints nothing. Every step names one concrete place to look or command to run and refers to things built in earlier topics: the dashboard and Logs Insights (18), the deployment circuit breaker (17), RDS Proxy pinning (12) and Valkey metrics (14). The names `shop-prod` and `api` are this course's example names. Replace them with yours."
        }
      ],
      "productionNote": "Every alarm that can wake someone up must have a runbook link in its description. After each real incident, fix any runbook step that was wrong, and run through important runbooks during game days (topic 22) so stale commands are found when nothing is on fire.",
      "commonMistakes": [
        "Paging alarms with no runbook, so each responder improvises.",
        "Stale commands: a renamed cluster or service makes the copy-pasted command fail in the middle of an incident.",
        "Steps that depend on tribal knowledge (\"ask Sam which dashboard\"). A new teammate at 3am must be able to follow the page alone.",
        "Keeping runbooks in a wiki that no one reviews, instead of next to the code."
      ],
      "sources": [
        { "title": "Well-Architected Operational Excellence: Use runbooks to perform procedures", "url": "https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_ready_to_support_use_runbooks.html" },
        { "title": "AWS CDK API: aws_cloudwatch.Alarm", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudwatch.Alarm.html" }
      ]
    },
    {
      "id": "incident-response-postmortems",
      "title": "Incident response and postmortems",
      "explanation": "An **incident** is an unplanned event that harms or threatens the service for users, for example a burst of errors or a full outage. Teams label each incident with a **severity** (SEV) so everyone knows how urgent it is. A common scale is: SEV1 means a full outage or data loss, SEV2 means a major degradation (many users affected or a key feature broken), and SEV3 means a minor problem that can wait for working hours.\n\nWhen the incident is serious, people take roles so that nobody does everything and nobody does the same thing twice. The **incident commander** coordinates: they decide, assign tasks, and do not dig into logs themselves. The **ops lead** is the hands-on person who runs commands and changes the system. The **comms** person sends status updates to stakeholders and customers, so that the engineers are not interrupted by questions.\n\nThe first goal is to **mitigate**: reduce the harm to users as fast as possible, even before you know why it broke. Typical mitigations are rolling back the last deploy (topic 17), adding capacity (topic 19), or blocking bad traffic (topic 21). Diagnosing the real cause comes after users are safe, using the logs and traces you kept.\n\nWithin a few days of a SEV1 or SEV2, hold a **postmortem**: a written review of what happened. It is **blameless**, meaning it asks \"what in our system and process allowed this?\" and not \"who made the mistake?\". People who fear blame hide mistakes, and hidden mistakes happen again. A postmortem contains: a timeline, the impact (how many requests failed and how much error budget was used, from topic 18), the root causes, what went well, and **action items**, which are concrete follow-up tasks, each with an owner and a due date.\n\nThe example below fills in a postmortem for an incident where a database migration (topic 13) added a `NOT NULL` column (a column that must always hold a value) without a default value (the fallback used when no value is given). Old tasks, which did not know about the new column, started failing on inserts during the rolling deploy. Rolling back the image would not help, because the old code is what fails, so the fix is a fix-forward migration that sets a default on the column. The script calculates how much error budget it used. A 99.9% monthly target allows 0.1% of 30 days, which is 43.2 minutes of full downtime. A 17-minute incident where about 12% of requests failed counts as 17 times 0.12 minutes of lost availability.",
      "analogy": "An emergency room. Patients are triaged by severity, one doctor is in charge of the room, and nurses have clear tasks. Nobody stops to find out how the patient got hurt before the bleeding is stopped. Afterwards the hospital holds a case review that improves its procedures. That review is not a disciplinary hearing.",
      "code": [
        {
          "language": "typescript",
          "filename": "error-budget.ts",
          "source": "const incidentMinutes = 17;   // 14:02 to 14:19 UTC\nconst failedShare = 0.12;     // about 12% of requests returned 5XX\nconst monthlyBudgetMinutes = 43.2; // 99.9% target over 30 days\n\nconst used = (incidentMinutes * failedShare / monthlyBudgetMinutes) * 100;\nconsole.log(used.toFixed(1) + \"% of monthly budget\");\n",
          "output": "4.7% of monthly budget",
          "explanation": "Run it with `bun run error-budget.ts`. 17 minutes times 0.12 is 2.04 minutes of lost availability. Divided by the 43.2-minute monthly budget this is about 0.0472, and times 100 it is 4.7%. `toFixed(1)` rounds the number to one decimal place and returns text, so the `\"%\"` text can be appended."
        },
        {
          "language": "markdown",
          "filename": "docs/postmortems/2026-11-20-signup-5xx.md",
          "source": "# Postmortem: signup 5XX after migration (2026-11-20)\n\n**Severity:** SEV2\n**Impact:** 2026-11-20 14:02-14:19 UTC (17 min). About 12% of requests\nreturned 5XX. Error budget used: 4.7% of the monthly budget.\n\n## Timeline (UTC)\n- 14:00 Deploy started: migration ran, new tasks rolling out.\n- 14:02 Errors begin.\n- 14:05 Alarm Api5xx fired. On-call acknowledged.\n- 14:06 Incident commander assigned. Recent deploy suspected.\n- 14:07 Logs show inserts failing on a NOT NULL column.\n- 14:08 Decision: mitigate first, run a fix-forward migration that sets a default on the column (or drops NOT NULL), so old tasks can insert again.\n- 14:19 Errors back to normal.\n\n## Root cause\nThe migration added a NOT NULL column without a default. Old tasks,\nstill running during the rolling deploy, did not send the column, so\ntheir inserts failed.\n\n## What went well\n- The alarm fired within 3 minutes of the first errors and the runbook was followed.\n- Mitigation took 11 minutes.\n\n## What went badly\n- Nothing in review warned about the unsafe migration.\n\n## Action items\n| Action | Owner | Due |\n|---|---|---|\n| Add a lint check that rejects NOT NULL without default | Priya (backend) | 2026-11-27 |\n| Add expand/contract rule to the migration checklist | Marco (platform) | 2026-11-30 |\n",
          "output": "",
          "explanation": "A postmortem is a document, so it prints nothing. Note that it names roles and system causes and gives each action item an owner and a date, so it can be tracked. The names are examples. The expand/contract rule is the safe migration pattern from topic 13."
        }
      ],
      "productionNote": "Run a postmortem for every SEV1 and SEV2, publish it where the whole team can read it, and track its action items in the same task tracker as normal work. Review open action items at the start of each month. A postmortem whose actions are never done will only repeat the incident.",
      "commonMistakes": [
        "Debugging before mitigating: spending 30 minutes finding the cause while users keep seeing errors, when a rollback would have fixed it in 5.",
        "A blame culture: naming and shaming the person who ran the command, so people hide mistakes and near misses.",
        "Action items with no owner or due date, which are never done.",
        "Everyone investigating at once with no incident commander, so work is duplicated and nobody updates stakeholders."
      ],
      "sources": [
        { "title": "Well-Architected Operational Excellence: Event, incident and problem management", "url": "https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_event_response_event_incident_problem_process.html" },
        { "title": "Well-Architected Operational Excellence: Perform a root cause analysis", "url": "https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_evolve_ops_perform_rca_process.html" }
      ]
    },
    {
      "id": "day-2-maintenance",
      "title": "Day-2 maintenance and upgrades",
      "explanation": "**Day-2 operations** means all the work after the first launch (\"day 1\"): keeping the system patched, supported, affordable and recoverable. Software and cloud services keep changing, so a system that is never touched slowly becomes insecure and then unsupported.\n\nThe habit that works is a written maintenance calendar with a cadence (how often) for each task. For this course's stack the tasks are:\n\n- **Images:** rebuild container images weekly with a scheduled GitHub Actions workflow (`on: schedule`, topic 16), so base-image security patches (topic 21) reach production even when the code has not changed.\n- **Dependencies:** each month run `bun update` for libraries, check the newest CDK library with `npm view aws-cdk-lib version`, and bump the CDK library and CLI together. Always read `cdk diff` (topic 07) before deploying, and review GitHub Action major-version bumps, plus versions of k6, the ADOT collector and OpenTelemetry. Pin Bun to a fixed patch version in your Dockerfile and rebuild when you upgrade.\n- **Database patches:** Aurora PostgreSQL LTS (long-term support) minor versions get bug and security fixes only, and an LTS cluster is patched to the latest patch release about once a year, sooner for critical fixes. To stay on the LTS minor version you turn `autoMinorVersionUpgrade` off (topic 11), which means AWS will not upgrade it for you. So you must schedule the patch window yourself.\n- **Database major upgrade:** plan it ahead. PostgreSQL 17 reaches community end of life (the community stops releasing fixes) in November 2029, and Aurora standard support for the 17.7 LTS line ends on 2030-02-28, where end of support means AWS stops providing fixes for that version. AWS itself recommends the latest release over LTS for most clusters, and LTS suits workloads that cannot tolerate frequent change.\n- **Housekeeping:** ECR lifecycle rules and log retention, and checking service quotas (topic 19) before expected traffic peaks.\n- **Resilience and cost:** restore drills and chaos game days (topic 22), and the Savings Plan and cost review from this topic.\n\nUpgrade in small, frequent steps and always in the order dev, then staging, then prod. A month of changes is easy to review and easy to roll back. Three years of changes is a risky project.",
      "analogy": "Car servicing: oil change every 10,000 km, tyres each season, the legal inspection (MOT) every year. Skip the routine work and the car does not stop working at once, but later it breaks down at the worst moment and the repair is far bigger. Calendar entries are the service booklet for your infrastructure.",
      "code": [
        {
          "language": "markdown",
          "filename": "docs/maintenance.md",
          "source": "# Maintenance calendar\n\n| Cadence   | Task                          | Command or link                              |\n|-----------|-------------------------------|----------------------------------------------|\n| Weekly    | Rebuild and redeploy images   | scheduled workflow (`on: schedule`)          |\n| Monthly   | Update dependencies           | `bun update`                                 |\n| Monthly   | Check newest CDK library      | `npm view aws-cdk-lib version`               |\n| Monthly   | Review infra changes          | `cdk diff` (dev first, then prod)            |\n| Monthly   | Cost review                   | Cost Explorer by service and by `env`        |\n| Monthly   | Restore drill                 | docs/runbooks/restore-drill.md               |\n| Quarterly | FIS game day                  | topic 22 experiments                         |\n| Quarterly | Savings Plan and size review  | Container Insights, Savings Plans console    |\n| Yearly    | Aurora LTS patch window       | Aurora release notes, patch dev then prod    |\n| Yearly    | Major-version upgrade plan    | Aurora release calendar (PG17 end dates)     |\n",
          "output": "",
          "explanation": "This is a document, so it prints nothing. Put it in the repository, and create recurring calendar events or tickets from it so the tasks are owned by a named person each time. Names such as `restore-drill.md` are examples."
        },
        {
          "language": "bash",
          "filename": "check-cdk-version.sh",
          "source": "npm view aws-cdk-lib version",
          "output": "2.278.0",
          "explanation": "`npm view` asks the npm package registry for information about a package, and `version` prints the latest published version. Node.js (which the CDK CLI runs on, topic 07) comes with `npm`. The output shown is the latest version at the time this course was written, so you will probably see a newer number. Compare it with the version in your `package.json`, then update the library and the CLI together and read `cdk diff`."
        }
      ],
      "productionNote": "Treat maintenance as scheduled work with owners, not as something to do when there is time. Always rehearse an upgrade in dev (and staging if you have it) before prod, take or verify a snapshot before a database upgrade, and announce maintenance windows so that the team knows when a brief interruption is expected.",
      "commonMistakes": [
        "Set and forget: never touching the infrastructure until a security notice or an end-of-support date forces a rushed change.",
        "Big-bang upgrades after years of skipping, where many changes land at once and failures are hard to trace.",
        "Upgrading prod first, or upgrading without reading `cdk diff`.",
        "Turning `autoMinorVersionUpgrade` off to stay on an LTS minor version and then never scheduling the patch window yourself."
      ],
      "sources": [
        { "title": "Aurora PostgreSQL long-term support (LTS) releases", "url": "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Updates.LTS.html" },
        { "title": "Aurora PostgreSQL release calendar", "url": "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraPostgreSQLReleaseNotes/aurorapostgresql-release-calendar.html" },
        { "title": "AWS CDK CLI reference: cdk diff", "url": "https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-diff.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "You added `Tags.of(app).add(\"env\", \"prod\")` in CDK and deployed, but Cost Explorer cannot group by `env`. What is the most likely missing step?",
      "options": [
        "The tag must be activated as a cost allocation tag in the Billing console",
        "The tag must be applied to the IAM user who views Cost Explorer",
        "The AWS region must be changed to us-west-2",
        "The tag value must be written in upper case"
      ],
      "answerIndex": 0,
      "explanation": "A tag on a resource is not automatically used for billing. It must be activated as a cost allocation tag in Billing, and then it appears for usage after activation by default (a backfill of up to 12 months can be requested, and it can take about a day to appear). The region and the letter case of the value do not control whether grouping is available."
    },
    {
      "question": "A service runs a minimum of 20 tasks and reaches 120 tasks at peak. What should a Compute Savings Plan commitment cover?",
      "options": [
        "All 120 tasks, so every task gets the discount",
        "Roughly the steady baseline of 20 tasks, and the extra tasks stay on-demand",
        "Nothing, because Savings Plans do not apply to Fargate",
        "The average of 20 and 120 tasks rounded up"
      ],
      "answerIndex": 1,
      "explanation": "You pay the commitment every hour whether you use it or not, so commit to the always-on baseline (the minimum of 20 tasks). Peak capacity is better bought on-demand (or as Spot) only while it runs. Compute Savings Plans do apply to Fargate."
    },
    {
      "question": "Which first step belongs at the top of almost every runbook?",
      "options": [
        "Confirm the AWS account and role with `aws sts get-caller-identity`",
        "Delete the failing service and recreate it",
        "Disable the alarm so the pages stop",
        "Ask the person who wrote the code to join a call before touching anything"
      ],
      "answerIndex": 0,
      "explanation": "Confirming that you are in the right account (and which role you hold) prevents running commands against the wrong environment. The other options either destroy evidence, hide the problem, or depend on a specific person being available, which a runbook is meant to avoid."
    },
    {
      "question": "During a SEV1, users are failing and the last deploy is the likely cause. What should the team do first?",
      "options": [
        "Write the postmortem so details are fresh",
        "Roll back to stop the harm, then diagnose the root cause afterwards",
        "Find the root cause in the code before changing anything",
        "Wait to see whether the errors stop on their own"
      ],
      "answerIndex": 1,
      "explanation": "Mitigate first: a rollback is quick and reduces user harm, and the root cause can be investigated once the service is stable. Diagnosing first prolongs the outage, waiting is a gamble, and the postmortem comes after the incident, within days."
    },
    {
      "question": "Which pair of tasks has a yearly cadence in this topic's maintenance calendar?",
      "options": [
        "Rebuild container images and update `bun` dependencies",
        "Aurora LTS patch window and the major-version upgrade plan",
        "Check the newest CDK version and read `cdk diff`",
        "Cost review in Cost Explorer and a game day"
      ],
      "answerIndex": 1,
      "explanation": "In the calendar, the Aurora LTS patch window and the major-version plan are yearly. Image rebuilds are weekly, dependency and CDK checks and the cost review and the restore drill are monthly, and the FIS game day is quarterly."
    }
  ]
});
