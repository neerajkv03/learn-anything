# 07. AWS CDK Basics
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 03-aws-fundamentals, 04-aws-multi-account

CDK CLI runs on Node.js (aws-cdk-lib engines node >= 20; course uses Node 26.13.1 LTS). Install `npm install -g aws-cdk@2.1149.0`; project dep `aws-cdk-lib@2.278.0`, `constructs@^10`. CDK code = TypeScript in `infra/`. Gloss TypeScript class/`new` briefly (learner knows Bun app code but treat as zero knowledge).

## Learning goals
- Learner can explain infrastructure as code and CDK's relation to CloudFormation.
- Learner can structure an App with per-environment Stacks.
- Learner can bootstrap an account and run synth, diff and deploy.
- Learner can pass per-environment config via cdk.json context.
- Learner can unit-test a stack with aws-cdk-lib/assertions.

## Sub-topics
### Infrastructure as code
- Concept: describe servers/networks/databases in code files, reviewed in git, applied by a tool → repeatable, reviewable, identical dev/staging/prod. CloudFormation = AWS engine applying templates (JSON/YAML) as "stacks"; CDK = write TypeScript that generates those templates. Drift = manual console changes not in code.
- Analogy: architect's blueprints vs building by memory. Blueprints can be reviewed, copied for a second building, and compared to the real house to spot unapproved changes.
- Code example: tiny comparison: console clicks list (8 manual steps to create a bucket with versioning) vs `new s3.Bucket(this, "Assets", { versioned: true });` → one line produces `AWS::S3::Bucket` with `VersioningConfiguration: { Status: Enabled }` in the synthesized template.
- Production use: every resource in this course is CDK.
- Common mistakes: fixing prod in the console (drift); one giant stack for everything; no code review for infra changes.
- Sources: https://docs.aws.amazon.com/cdk/v2/guide/home.html ; https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html

### Apps, stacks and constructs
- Concept: App (root) → Stacks (one CloudFormation stack each, deploy unit, has `env {account, region}`) → Constructs (building blocks). Levels: L1 `Cfn*` = raw CloudFormation (e.g. CfnReplicationGroup), L2 = sensible defaults (s3.Bucket), L3 patterns = several resources (ecs_patterns.ApplicationLoadBalancedFargateService). Concrete env needed for lookups (Vpc.fromLookup, HostedZone.fromLookup).
- Analogy: LEGO: App = the whole display table, Stack = one model box you ship separately, constructs = bricks (L1 single bricks, L2 pre-built wall sections, L3 a complete house kit).
- Code example: `infra/bin/app.ts` — `import { App } from "aws-cdk-lib"; import { ShopStack } from "../lib/shop-stack"; import { envs } from "../lib/envs"; const app = new App(); new ShopStack(app, "ShopDev", { env: envs.dev }); new ShopStack(app, "ShopProd", { env: envs.prod, terminationProtection: true });` and `infra/lib/shop-stack.ts` — `export class ShopStack extends Stack { constructor(scope: Construct, id: string, props: StackProps) { super(scope, id, props); new s3.Bucket(this, "Assets", { versioned: true, blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL }); } }`. `cdk ls` → `ShopDev` and `ShopProd`.
- Production use: later topics add VPC, ECS, Aurora to ShopStack (or split Network/Data/App stacks).
- Common mistakes: env-agnostic stacks then calling fromLookup (error); renaming construct IDs (replaces resources!); putting stateful DB in the same stack you destroy often.
- Sources: https://docs.aws.amazon.com/cdk/v2/guide/constructs.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.StackProps.html ; https://docs.aws.amazon.com/cdk/v2/guide/stacks.html

### bootstrap, synth, diff and deploy
- Concept: `cdk bootstrap aws://111111111111/us-east-1` once per account+region (CDKToolkit stack: S3 bucket + ECR repo for assets; default qualifier hnb659fds; execution policy AdministratorAccess unless `--cloudformation-execution-policies`). `cdk synth` → cdk.out templates. `cdk diff` → what will change (`--fail` exits 1 on differences). `cdk deploy` (`--require-approval` any-change | broadening default | never). `--hotswap` = dev only (causes drift).
- Analogy: synth = printing the blueprint; diff = overlaying it on the current building with a red pen; deploy = sending the builders; bootstrap = first setting up the site office and storage shed.
- Code example: shell session: `cdk bootstrap aws://111111111111/us-east-1 --profile shop-dev` → ends with `Environment aws://111111111111/us-east-1 bootstrapped.`; `cdk synth ShopDev --profile shop-dev -q` → no output, `ls cdk.out` shows `ShopDev.template.json`; `cdk diff ShopDev` → `[+] AWS::S3::Bucket Assets ...`; `cdk deploy ShopDev` → ends with `✅  ShopDev`. Mark message text as approximate except the resource type lines.
- Production use: pipeline runs `cdk diff` on PRs, `cdk deploy --require-approval never` after human approval in GitHub environments (topic 17).
- Common mistakes: deploying without diff; forgetting to bootstrap a new account/region; using `--hotswap` in prod.
- Sources: https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-bootstrap.html ; https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-synth.html ; https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-diff.html ; https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-deploy.html

### Per-environment config
- Concept: one code path, config per env: typed object in code (preferred, lazy, type-checked) selected by `-c env=dev`; `node.tryGetContext(key)` reads context (cdk.json `context`, `--context`, cdk.context.json = cached lookups, commit it, don't hand-edit). `-c` values are always strings.
- Analogy: same recipe, different serving sizes written on a card per restaurant.
- Code example: `infra/lib/config.ts` — `export const config = { dev: { minTasks: 2, maxTasks: 6, natGateways: 1 }, prod: { minTasks: 20, maxTasks: 120, natGateways: 3 } } as const;` in app.ts: `const envName = (app.node.tryGetContext("env") ?? "dev") as "dev" | "prod"; console.log(envName, config[envName].maxTasks);` `cdk synth -c env=prod -q` prints `prod 120`.
- Production use: prod 3 NAT gateways, dev 1 (topic 08); task counts (topic 19).
- Common mistakes: comparing `-c minTasks=2` as a number (it's a string); scattering `if (env === "prod")` everywhere; not committing cdk.context.json (lookups change).
- Sources: https://docs.aws.amazon.com/cdk/v2/guide/context.html ; https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-deploy.html

### Testing stacks with assertions
- Concept: `Template.fromStack(stack)` then `hasResourceProperties(type, props)` (partial match via Match.objectLike), `resourceCountIs(type, n)`, `Match.absent()/anyValue()/arrayWith()`. Catches dangerous changes (e.g. bucket became public, deletion protection off) before deploy. Run with `bun test` (Bun's built-in test runner; jest-style `test`/`expect`).
- Analogy: a building inspector's checklist run on the blueprint before construction.
- Code example: `infra/test/shop-stack.test.ts` — `import { test } from "bun:test"; import { App } from "aws-cdk-lib"; import { Template } from "aws-cdk-lib/assertions"; test("assets bucket is versioned", () => { const app = new App(); const stack = new ShopStack(app, "Test", { env: { account: "111111111111", region: "us-east-1" } }); const t = Template.fromStack(stack); t.resourceCountIs("AWS::S3::Bucket", 1); t.hasResourceProperties("AWS::S3::Bucket", { VersioningConfiguration: { Status: "Enabled" } }); });` `bun test` → `1 pass`, `0 fail` (summary lines).
- Production use: CI runs infra tests on every PR (topic 16).
- Common mistakes: snapshot-testing whole templates (noisy); asserting CDK internals instead of security-relevant props; not testing prod config.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.assertions.Template.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.assertions.Match.html ; https://bun.com/docs/cli/test

## Quiz
1. What does `cdk synth` produce and where? — tests synth.
2. Why must ShopProd have a concrete env to use HostedZone.fromLookup? — tests env-agnostic.
3. You rename a construct ID from "Db" to "Database". Risk? — tests logical IDs/replacement.
4. `-c maxTasks=10` then `maxTasks > 9` — what type problem? — tests context strings.
5. Write an assertion that exactly 3 NAT gateways exist. — tests resourceCountIs.
