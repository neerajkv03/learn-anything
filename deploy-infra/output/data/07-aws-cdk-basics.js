window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "07-aws-cdk-basics",
  "order": 7,
  "title": "AWS CDK Basics",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Infrastructure as code means describing your servers, networks and databases in files that are reviewed and applied by a tool, instead of clicking in the AWS console. This topic teaches the AWS Cloud Development Kit (CDK), which turns TypeScript code into CloudFormation templates. You will structure an app with one stack (one CloudFormation deployment unit) per environment, bootstrap (one-time setup of an account for CDK) an account, run synth (turn code into templates) and diff (compare templates with what is deployed) and deploy, pass per-environment settings, and unit-test a stack before it ever reaches AWS.",
  "prerequisites": ["03-aws-fundamentals", "04-aws-multi-account"],
  "subtopics": [
    {
      "id": "infrastructure-as-code",
      "title": "Infrastructure as code",
      "explanation": "Infrastructure means the cloud resources your application runs on: servers, networks, databases, storage buckets. A resource is one such item, for example one S3 bucket (S3 is AWS's file storage service, and a bucket is a named container for files).\n\nThe slow way to create resources is the AWS console, the AWS website, where you click through forms. It works once, but nobody can review what you clicked, you cannot repeat it exactly in a second account, and you will forget a step. Infrastructure as code (IaC) means you write the resources down in text files instead. The files live in git (the version-control tool that records every change to your files), teammates review changes like any other code, and a tool applies the files to AWS.\n\nAWS CloudFormation is the engine inside AWS that does the applying. You give it a template, a JSON or YAML file that lists resources and their settings. CloudFormation creates, updates or deletes the real resources so they match the template. One template deployed as a unit is called a stack.\n\nThe AWS Cloud Development Kit (CDK) sits on top. You write TypeScript, which is JavaScript with type annotations added, and CDK generates the CloudFormation template for you. This step of turning your code into a template is called synthesizing, or synth. CDK does not replace CloudFormation. It is a friendlier way to write the templates, and CloudFormation still does the deploying.\n\nThe main payoff is that dev, staging and prod can be built from the same code and so are identical. It also gives you protection against drift. Drift is when someone changes a real resource by hand in the console so that it no longer matches the code. Drifted environments behave differently and are hard to debug.\n\nEvery AWS resource in this course is created with CDK.",
      "analogy": "Think of an architect's blueprints versus building a house from memory. Blueprints can be reviewed by others before anything is built, copied to build a second identical house, and laid over the finished house to spot walls someone moved without approval. That last check is drift detection. CloudFormation is the building crew, CDK is the drawing tool that produces the blueprints.",
      "code": [
        {
          "language": "typescript",
          "filename": "demo-app.ts",
          "source": "import { App, Stack } from \"aws-cdk-lib\";\nimport * as s3 from \"aws-cdk-lib/aws-s3\";\n\nconst app = new App();\nconst stack = new Stack(app, \"Demo\");\n\n// One line replaces roughly eight console steps:\n// open S3, click Create bucket, type a name, pick a region,\n// scroll to Bucket Versioning, choose Enable, review, click Create.\nnew s3.Bucket(stack, \"Assets\", { versioned: true });",
          "output": "",
          "explanation": "This is a complete CDK program. `import` loads code from a package. `new App()` creates the root of a CDK program and `new Stack(app, \"Demo\")` creates one stack inside it (both are explained properly in the next sub-topic). `new s3.Bucket(...)` declares an S3 bucket with versioning switched on, which keeps old copies of a file when it is overwritten. The program prints nothing when run by the CDK tool, it writes a template instead."
        },
        {
          "language": "json",
          "filename": "Demo.template.json",
          "source": "{\n  \"Resources\": {\n    \"AssetsXXXXXXXX\": {\n      \"Type\": \"AWS::S3::Bucket\",\n      \"Properties\": {\n        \"VersioningConfiguration\": {\n          \"Status\": \"Enabled\"\n        }\n      }\n    }\n  }\n}",
          "output": "",
          "explanation": "An abbreviated excerpt of the CloudFormation template CDK generates from the code above. The real file has extra lines, and the resource name `AssetsXXXXXXXX` carries a generated suffix that differs per stack. The parts to notice are the resource `Type` (`AWS::S3::Bucket`) and `VersioningConfiguration` with `Status` set to `Enabled`."
        }
      ],
      "productionNote": "In production every change goes through a pull request (a proposal to merge changes into the main branch, which teammates review) so infrastructure gets the same review as application code. Nobody edits production in the console. If an emergency console fix is unavoidable, copy it back into the code straight afterwards.",
      "commonMistakes": [
        "Fixing production in the console. The real resource now differs from the code (drift), and the next deploy may silently undo your fix or fail.",
        "Putting everything into one giant stack. A failure or a slow update then affects every resource, and you cannot deploy or delete parts independently.",
        "Skipping code review for infrastructure changes because they are not application code. A one-line mistake can make a database public or delete it."
      ],
      "sources": [
        { "title": "AWS CDK v2 Developer Guide", "url": "https://docs.aws.amazon.com/cdk/v2/guide/home.html" },
        { "title": "AWS CloudFormation User Guide", "url": "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html" }
      ]
    },
    {
      "id": "apps-stacks-constructs",
      "title": "Apps, stacks and constructs",
      "explanation": "A CDK program is a tree with three kinds of parts. The App is the root and holds everything. A Stack is one CloudFormation stack: the unit that you deploy, update or delete together. Constructs are the building blocks inside a stack, and each construct represents one or more AWS resources. Even App and Stack are constructs, which is why every construct takes a parent as its first argument.\n\nConstructs come in three levels. L1 constructs have names starting with `Cfn` (for example `CfnReplicationGroup`) and map one-to-one onto a raw CloudFormation resource with no defaults. L2 constructs, such as `s3.Bucket`, wrap one resource with sensible defaults and helper methods. L3 constructs, also called patterns, create several resources at once, for example `ecs_patterns.ApplicationLoadBalancedFargateService` builds a load balancer, a container service and the wiring between them. Prefer L2, drop to L1 only when no L2 exists for a setting.\n\nEach stack can have an `env`, an object with the AWS `account` ID and `region` it deploys to. A stack with a concrete env knows where it lives. A stack without one is environment-agnostic, and CDK cannot look up existing resources for it. Lookups such as `Vpc.fromLookup` (find an existing network) and `HostedZone.fromLookup` (find an existing DNS zone) ask AWS questions during synth, so they need a concrete account and region.\n\nSetup first. Install Node.js 26.13.1 LTS from nodejs.org (run the Windows installer with its default options), then open a new terminal. You need Node.js to run the CDK command line tool (CLI). Open a terminal and run the commands in the first block below: they check Node, install the CLI globally with npm (Node's package manager, `-g` meaning for the whole machine), then create an `infra` folder and generate a TypeScript project in it with `cdk init`. This makes `bin/`, `lib/` and `test/` folders, a `cdk.json` file and installs the `aws-cdk-lib` and `constructs` packages. `aws-cdk-lib` is the library of all constructs, and `constructs` provides the base `Construct` type.\n\nThe file `cdk.json` tells the CLI how to run your program in its `app` entry. The generated one runs the code with another tool, so change that line to use Bun, as the second block shows. Keep the other lines that `cdk init` wrote. Open infra/cdk.json in any text editor (Notepad works), change only the app line, and save the file.\n\n`cdk init` also writes `bin/infra.ts` and `lib/infra-stack.ts`. Delete those two files and create the files shown below.\n\nNow the code. In TypeScript a class is a blueprint for objects, and `new ShopStack(...)` makes one from it. `class ShopStack extends Stack` means ShopStack is a Stack with extra behaviour. The constructor is the function that runs on `new`. It receives `scope` (the parent), `id` (a name unique among its siblings) and `props` (settings), and `super(scope, id, props)` hands those to the parent Stack class. We keep the account IDs in a small `envs.ts` file, and the stack in `shop-stack.ts`. In the example these account IDs are the course's example IDs: dev is 111111111111 and prod is 333333333333.\n\nThe stack ID such as `ShopDev` becomes the CloudFormation stack name, and you pass it to CLI commands. Finally `bin/app.ts` creates the App and one stack per environment. Prod gets `terminationProtection: true`, a CloudFormation setting that refuses to delete the stack until someone switches it off.",
      "analogy": "Picture a LEGO display table. The App is the whole table. Each Stack is one model box that you ship on its own, and you can send, replace or return one box without touching the others. Constructs are the bricks. L1 are single raw bricks, L2 are pre-built wall sections with doors already fitted, and L3 is a complete house kit that contains many wall sections.",
      "code": [
        {
          "language": "bash",
          "filename": "setup.sh",
          "source": "node --version\nnpm install -g aws-cdk@2.1149.0\ncdk --version\nmkdir infra\ncd infra\ncdk init app --language typescript",
          "output": "v26.13.1\n2.1149.0 (build ...)",
          "explanation": "Needs Node.js 26.13.1 LTS installed first. The first output line is the Node version. The `cdk --version` line shows the CLI version followed by a build hash, shown here as `...`. `cdk init` prints a longer progress report that is left out. `aws-cdk-lib` itself needs Node 20 or newer, so Node 26 is fine."
        },
        {
          "language": "json",
          "filename": "infra/cdk.json",
          "source": "{\n  \"app\": \"bun run bin/app.ts\",\n  \"context\": {}\n}",
          "output": "",
          "explanation": "Only the `app` line matters for now: it is the command the CLI runs to execute your program. The `context` section is explained in the per-environment sub-topic. Your generated file has more lines inside `context`. Keep them and change only `app`."
        },
        {
          "language": "typescript",
          "filename": "infra/lib/envs.ts",
          "source": "export const envs = {\n  dev: { account: \"111111111111\", region: \"us-east-1\" },\n  prod: { account: \"333333333333\", region: \"us-east-1\" },\n};",
          "output": "",
          "explanation": "`export` makes the value importable from other files. Each environment is an account ID plus a region, which is exactly the shape of a stack's `env`."
        },
        {
          "language": "typescript",
          "filename": "infra/lib/shop-stack.ts",
          "source": "import { Stack, StackProps } from \"aws-cdk-lib\";\nimport { Construct } from \"constructs\";\nimport * as s3 from \"aws-cdk-lib/aws-s3\";\n\nexport class ShopStack extends Stack {\n  constructor(scope: Construct, id: string, props: StackProps) {\n    super(scope, id, props);\n\n    new s3.Bucket(this, \"Assets\", {\n      versioned: true,\n      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,\n    });\n  }\n}",
          "output": "",
          "explanation": "`this` is the stack being built, so it is the parent of the bucket. `\"Assets\"` is the construct ID. `BLOCK_ALL` turns on all four S3 settings that prevent a bucket from ever being public."
        },
        {
          "language": "typescript",
          "filename": "infra/bin/app.ts",
          "source": "import { App } from \"aws-cdk-lib\";\nimport { ShopStack } from \"../lib/shop-stack\";\nimport { envs } from \"../lib/envs\";\n\nconst app = new App();\nnew ShopStack(app, \"ShopDev\", { env: envs.dev });\nnew ShopStack(app, \"ShopProd\", { env: envs.prod, terminationProtection: true });",
          "output": "",
          "explanation": "The same stack class is used twice with different env values, so dev and prod are built from one code path. Nothing is created in AWS yet. This file only describes the stacks."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "cdk ls",
          "output": "ShopDev\nShopProd",
          "explanation": "Run it inside the `infra` folder. `cdk ls` lists the stack IDs in the app."
        }
      ],
      "productionNote": "Later topics add the network, container service and database to ShopStack, or split them into separate Network, Data and App stacks. Splitting is worth it when parts change at very different speeds, for example a database that should rarely change and an app that deploys many times a day.",
      "commonMistakes": [
        "Leaving a stack without `env` and then calling `fromLookup`. Synth fails with an error saying the lookup needs a concrete account and region.",
        "Renaming a construct ID. CDK builds each resource's CloudFormation logical ID (its name inside the template) from the construct path, so a rename looks like delete the old resource and create a new one. For a database or bucket that can mean data loss.",
        "Putting a stateful resource such as a database in a stack that you delete and recreate often. Keep data in its own, rarely changed stack."
      ],
      "sources": [
        { "title": "AWS CDK v2 Guide: Constructs", "url": "https://docs.aws.amazon.com/cdk/v2/guide/constructs.html" },
        { "title": "AWS CDK v2 API: StackProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.StackProps.html" },
        { "title": "AWS CDK v2 Guide: Stacks", "url": "https://docs.aws.amazon.com/cdk/v2/guide/stacks.html" }
      ]
    },
    {
      "id": "bootstrap-synth-diff-deploy",
      "title": "bootstrap, synth, diff and deploy",
      "explanation": "Four CLI commands cover the daily workflow. Run them inside the `infra` folder, and add `--profile <name>` to choose which AWS account's credentials to use (the SSO profiles from the multi-account topic).\n\n`cdk bootstrap` prepares an account and region once. It creates a CloudFormation stack named CDKToolkit holding an S3 bucket and an ECR repository (an image store for Docker images). CDK uses them to upload assets, meaning files and container images your stacks need during deployment. Bootstrap also creates IAM roles for deployments. It uses a qualifier, a short ID in resource names, which defaults to `hnb659fds`. The role used to create your resources has the AdministratorAccess policy (full permissions) unless you pass `--cloudformation-execution-policies` with narrower policies. You need to bootstrap every new account and region pair before the first deploy.\n\n`cdk synth` runs your program and writes the CloudFormation templates into the `cdk.out` folder. `-q` (quiet) stops the template from also being printed to the terminal.\n\n`cdk diff` compares the synthesized template with what is deployed and lists additions (`[+]`), removals (`[-]`) and changes (`[~]`). Add `--fail` and the command exits with code 1 when there are differences, which is useful in automation.\n\n`cdk deploy` sends the template to CloudFormation. `--require-approval` controls when it stops to ask you: `any-change` asks for every change, `broadening` (the default) asks only when security permissions or network access would get wider, and `never` never asks. `--hotswap` skips CloudFormation and updates some resource types directly for speed. It makes the real resource differ from the template (drift), so use it only on a throwaway dev stack.",
      "analogy": "Bootstrap is setting up the site office and storage shed before building anything. Synth is printing the blueprint. Diff is laying the new blueprint over the existing building and marking changes with a red pen. Deploy is sending in the builders. You would never send the builders without checking the red-pen version first.",
      "code": [
        {
          "language": "bash",
          "filename": "terminal",
          "source": "cdk bootstrap aws://111111111111/us-east-1 --profile shop-dev\ncdk synth ShopDev --profile shop-dev -q\nls cdk.out\ncdk diff ShopDev --profile shop-dev\ncdk deploy ShopDev --profile shop-dev",
          "output": " ...  Environment aws://111111111111/us-east-1 bootstrapped.\nShopDev.template.json\n...\nResources\n[+] AWS::S3::Bucket Assets AssetsXXXXXXXX\n...\n ✅  ShopDev",
          "explanation": "Output is approximate and trimmed: progress lines and the exact message wording differ between CLI versions, and `ls cdk.out` also lists other support files that are omitted here. The reliable lines are the bootstrapped confirmation, `ShopDev.template.json`, the `[+] AWS::S3::Bucket` line in the diff, and the final line naming the stack. `AssetsXXXXXXXX` stands for the generated name suffix. Before the deploy starts, the CLI may ask for confirmation if it sees permission changes."
        }
      ],
      "productionNote": "A pipeline runs `cdk diff` on every pull request so reviewers see the real effect, and runs `cdk deploy --require-approval never` only after a human approves the release in a GitHub environment (a later topic). `never` is safe there because a person already approved it.",
      "commonMistakes": [
        "Deploying without running `cdk diff` first, then being surprised when a resource is replaced or deleted.",
        "Forgetting to bootstrap a new account or region. Deploy fails because the CDKToolkit stack is missing.",
        "Using `--hotswap` against production. It bypasses CloudFormation and leaves drift."
      ],
      "sources": [
        { "title": "cdk bootstrap", "url": "https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-bootstrap.html" },
        { "title": "cdk synth", "url": "https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-synth.html" },
        { "title": "cdk diff", "url": "https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-diff.html" }
      ]
    },
    {
      "id": "per-environment-config",
      "title": "Per-environment config",
      "explanation": "Dev and prod should run the same code with different numbers: prod has more tasks (running copies of your container) and more NAT gateways (the network exits that private servers use to reach the internet). Instead of copy-pasting code, keep one code path and a table of settings per environment.\n\nThe preferred table is a typed object in a TypeScript file, here `config.ts`. TypeScript checks the keys and value types, so a typo is caught before deploy. `as const` tells TypeScript to treat the values as fixed literals.\n\nThe environment is chosen from the command line with `-c env=prod`. `-c` (short for `--context`) sets a context value. Context is a set of key/value settings that your CDK code can read with `node.tryGetContext(\"key\")`. It returns `undefined` when the key is missing, and the `??` operator then substitutes a default (`\"dev\"`). Context can come from three places: the `context` section of `cdk.json`, `-c` flags, and the `cdk.context.json` file.\n\n`cdk.context.json` is different. CDK writes it itself to cache the answers of lookups such as `Vpc.fromLookup`. Commit it to git so everyone gets the same answers, and do not hand-edit it. Without it, a lookup could return a different result on a different day.\n\nValues given with `-c` are always strings. `-c maxTasks=10` gives the text `\"10\"`, not the number 10, so convert with `Number(...)` before doing arithmetic or comparing.\n\nThe example checks that the requested name exists in the table and throws a clear error if not, instead of failing later with a confusing message.",
      "analogy": "It is the same recipe with a different serving size written on a card for each restaurant. The cooking method never changes, only the numbers on the card, and the card is picked when the order comes in.",
      "code": [
        {
          "language": "typescript",
          "filename": "infra/lib/config.ts",
          "source": "export const config = {\n  dev: { minTasks: 2, maxTasks: 6, natGateways: 1, terminationProtection: false },\n  prod: { minTasks: 20, maxTasks: 120, natGateways: 3, terminationProtection: true },\n} as const;",
          "output": "",
          "explanation": "Two environments, same keys. Later topics read `natGateways` for the network and the task counts for scaling."
        },
        {
          "language": "json",
          "filename": "infra/cdk.json",
          "source": "{\n  \"app\": \"bun run bin/app.ts\",\n  \"context\": {\n    \"env\": \"dev\"\n  }\n}",
          "output": "",
          "explanation": "A default environment stored in `cdk.json` context. In your real file this `env` entry sits alongside the lines `cdk init` generated. A `-c env=prod` flag on the command line overrides it."
        },
        {
          "language": "typescript",
          "filename": "infra/bin/app.ts",
          "source": "import { App } from \"aws-cdk-lib\";\nimport { ShopStack } from \"../lib/shop-stack\";\nimport { envs } from \"../lib/envs\";\nimport { config } from \"../lib/config\";\n\nconst app = new App();\n\nconst requested = app.node.tryGetContext(\"env\") ?? \"dev\";\nif (!(requested in config)) {\n  throw new Error(`Unknown env \"${requested}\", use dev or prod`);\n}\nconst envName = requested as keyof typeof config;\nconsole.log(envName, config[envName].maxTasks);\n\nconst stackIds = { dev: \"ShopDev\", prod: \"ShopProd\" };\nnew ShopStack(app, stackIds[envName], {\n  env: envs[envName],\n  terminationProtection: config[envName].terminationProtection,\n});",
          "output": "",
          "explanation": "This replaces the earlier app.ts: it now creates only the stack for the chosen environment. The `console.log` runs during synth, shown in the next block. `in` tests whether a key exists in an object, and `keyof typeof config` is TypeScript's way of saying the value is one of the table's keys (`\"dev\"` or `\"prod\"`)."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "cdk synth -c env=prod -q",
          "output": "prod 120",
          "explanation": "The line comes from the program's own `console.log`. The `-q` flag keeps the template itself out of the terminal."
        }
      ],
      "productionNote": "In this course prod gets 3 NAT gateways and dev gets 1 (the network topic), and task counts per environment drive scaling (the autoscaling topic). A reviewer can read one file and see exactly how prod differs from dev.",
      "commonMistakes": [
        "Treating a `-c` value as a number. `-c minTasks=2` arrives as the string `\"2\"`, so `=== 2` is false and `+ 1` gives `\"21\"`.",
        "Scattering `if (env === \"prod\")` checks through the code. Put every difference in the config table so they are visible in one place.",
        "Not committing `cdk.context.json`. Lookup results then change between machines and over time, and a deploy can behave differently from the one you reviewed."
      ],
      "sources": [
        { "title": "AWS CDK v2 Guide: Context values", "url": "https://docs.aws.amazon.com/cdk/v2/guide/context.html" },
        { "title": "cdk deploy", "url": "https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-deploy.html" }
      ]
    },
    {
      "id": "testing-stacks-assertions",
      "title": "Testing stacks with assertions",
      "explanation": "You can test infrastructure code before anything reaches AWS. A test builds the stack in memory, turns it into a template, and checks the template. This catches dangerous mistakes, such as a bucket that became public or deletion protection that was switched off, while the change is still a pull request.\n\n`Template.fromStack(stack)` from `aws-cdk-lib/assertions` synthesizes a stack and gives you a `Template` to inspect. Its main methods are `resourceCountIs(type, n)`, which checks that exactly n resources of a type exist, and `hasResourceProperties(type, props)`, which checks that at least one resource of that type has the given properties. The match is partial, so you only list the properties you care about, and any other properties are ignored.\n\n`Match` adds finer rules inside the props. `Match.absent()` means the property must not be there. `Match.anyValue()` means it must exist with any value. `Match.arrayWith([...])` means the list must contain those items among others.\n\nThe tests run with `bun test`, Bun's built-in test runner. `bun test` finds files ending in `.test.ts`. `test(\"name\", () => { ... })` defines one test, imported from `bun:test`. A test passes if it finishes without throwing, and the assertions throw when a check fails.\n\nPrefer targeted assertions on settings that matter for security and safety. Avoid snapshot tests (comparing the whole generated template against a saved copy) of the whole template: any harmless change makes them fail, and people learn to approve them without reading.",
      "analogy": "A building inspector's checklist run on the blueprint before construction starts. Is the fire exit there? Is the door unlocked from inside? Failing the checklist costs a few minutes, failing it after the building is built costs a demolition.",
      "code": [
        {
          "language": "typescript",
          "filename": "infra/test/shop-stack.test.ts",
          "source": "import { test } from \"bun:test\";\nimport { App } from \"aws-cdk-lib\";\nimport { Match, Template } from \"aws-cdk-lib/assertions\";\nimport { ShopStack } from \"../lib/shop-stack\";\n\nfunction buildTemplate(): Template {\n  const app = new App();\n  const stack = new ShopStack(app, \"Test\", {\n    env: { account: \"111111111111\", region: \"us-east-1\" },\n  });\n  return Template.fromStack(stack);\n}\n\ntest(\"assets bucket is versioned\", () => {\n  const t = buildTemplate();\n  t.resourceCountIs(\"AWS::S3::Bucket\", 1);\n  t.hasResourceProperties(\"AWS::S3::Bucket\", {\n    VersioningConfiguration: { Status: \"Enabled\" },\n  });\n});\n\ntest(\"assets bucket blocks public access\", () => {\n  buildTemplate().hasResourceProperties(\"AWS::S3::Bucket\", {\n    PublicAccessBlockConfiguration: {\n      BlockPublicAcls: true,\n      BlockPublicPolicy: true,\n      IgnorePublicAcls: true,\n      RestrictPublicBuckets: true,\n    },\n  });\n});\n\ntest(\"assets bucket is not a website\", () => {\n  buildTemplate().hasResourceProperties(\"AWS::S3::Bucket\", {\n    WebsiteConfiguration: Match.absent(),\n  });\n});",
          "output": " 3 pass\n 0 fail",
          "explanation": "Run it with `bun test` from the `infra` folder. Only the summary lines are shown: Bun also prints its version, a line per test with timings, and a final `Ran 3 tests` line. The helper `buildTemplate` avoids repeating setup. The third test uses `Match.absent()` to prove no website hosting is configured. If someone later removes `versioned: true`, the first test fails and the pull request is blocked."
        }
      ],
      "productionNote": "CI (continuous integration, a server that runs your checks on every pull request) runs the infra tests on every PR, which the GitHub Actions topic sets up. Also test the settings your prod environment uses, not just dev, because a bug in the prod branch of your config is the one that hurts.",
      "commonMistakes": [
        "Snapshot-testing whole templates. They are noisy, change for harmless reasons and train people to accept diffs blindly.",
        "Asserting CDK internals such as generated names instead of security-relevant properties like encryption, public access and deletion protection.",
        "Only testing the dev configuration, so a mistake in the prod settings is never caught."
      ],
      "sources": [
        { "title": "AWS CDK v2 API: assertions.Template", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.assertions.Template.html" },
        { "title": "AWS CDK v2 API: assertions.Match", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.assertions.Match.html" },
        { "title": "Bun docs: bun test", "url": "https://bun.com/docs/cli/test" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "What does `cdk synth` produce, and where does it put it?",
      "options": [
        "A running copy of your resources in AWS, visible in the console",
        "CloudFormation templates, written into the `cdk.out` folder",
        "A Docker image of your application, pushed to ECR",
        "A list of IAM users in the account, saved to `cdk.json`"
      ],
      "answerIndex": 1,
      "explanation": "Synth runs your program and turns the stacks into CloudFormation templates in `cdk.out`. It creates nothing in AWS. That is the job of `cdk deploy`."
    },
    {
      "question": "Why must ShopProd have a concrete env (account and region) before it can use `HostedZone.fromLookup`?",
      "options": [
        "Because the lookup asks AWS a question at synth time, and CDK must know which account and region to ask",
        "Because the lookup deploys a new hosted zone into the account",
        "Because an env is required for every construct, even `s3.Bucket`",
        "Because the lookup only works in the us-east-1 region"
      ],
      "answerIndex": 0,
      "explanation": "Lookups query AWS while the template is being generated. An environment-agnostic stack does not say which account and region to query, so synth fails."
    },
    {
      "question": "You rename a construct ID from \"Db\" to \"Database\" in a stack that is already deployed. What is the risk?",
      "options": [
        "None, the ID is only a label used in the editor",
        "CDK refuses to synth until you run `cdk bootstrap` again",
        "The logical ID changes, so CloudFormation may create a new resource and delete the old one, which can lose data",
        "All other stacks in the app are deleted too"
      ],
      "answerIndex": 2,
      "explanation": "The CloudFormation logical ID is derived from the construct path. A new ID looks like a different resource, so the old one is replaced. For a database that can mean losing its data."
    },
    {
      "question": "You run `cdk synth -c maxTasks=10` and your code does `tryGetContext(\"maxTasks\")`. What is the type problem and the fix?",
      "options": [
        "It arrives as a boolean, so wrap it in `if`",
        "It is a string such as \"10\", so convert it with `Number(...)` before arithmetic or comparisons",
        "It arrives as a number, so there is no problem",
        "It arrives as an array, so read the first element"
      ],
      "answerIndex": 1,
      "explanation": "Values passed with `-c` are always strings. Without conversion, `=== 10` is false and `+ 1` produces the text \"101\" instead of 11."
    },
    {
      "question": "Which assertion checks that the stack contains exactly 3 NAT gateways?",
      "options": [
        "`template.hasResourceProperties(\"AWS::EC2::NatGateway\", 3)`",
        "`template.resourceCountIs(\"AWS::S3::Bucket\", 3)`",
        "`Template.fromStack(stack, 3)`",
        "`template.resourceCountIs(\"AWS::EC2::NatGateway\", 3)`"
      ],
      "answerIndex": 3,
      "explanation": "`resourceCountIs(type, n)` checks the exact number of resources of one CloudFormation type, here `AWS::EC2::NatGateway`. `hasResourceProperties` takes an object of properties, not a count, and the S3 option counts the wrong resource type."
    }
  ]
});
