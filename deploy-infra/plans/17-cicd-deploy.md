# 17. CD to AWS
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 04-aws-multi-account, 09-ecs-fargate, 13-database-migrations, 16-github-actions-ci

Pipeline design (state trade-off): each environment builds its image from the same commit SHA into its own account's ECR (frozen lockfile + pinned base image keep builds reproducible). Upgrade path: shared artifacts account + promote by digest — mention only. Actions: aws-actions/configure-aws-credentials@v6, aws-actions/amazon-ecr-login@v2. GitHub environments `dev`, `staging`, `prod` (required reviewers on prod; private repos need GitHub Team/Pro). CDK app takes `-c env=<name> -c imageTag=<sha>`.

## Learning goals
- Learner can create a GitHub OIDC provider and a deploy role scoped to one repo/environment.
- Learner can push SHA-tagged images to ECR from Actions.
- Learner can run migrations then `cdk deploy` from the pipeline.
- Learner can promote dev → staging → prod with a manual approval.
- Learner can configure rolling deploys with circuit-breaker rollback and explain ECS blue/green.

## Sub-topics
### GitHub OIDC role in AWS
- Concept: no long-lived AWS keys in GitHub. GitHub issues a short-lived OIDC token per job (`permissions: id-token: write`); AWS IAM trusts provider `https://token.actions.githubusercontent.com` (audience `sts.amazonaws.com`); role trust conditions: `aud` StringEquals, `sub` StringLike `repo:acme/shop:environment:prod` (or `ref:refs/heads/main`). Thumbprint not needed (ignored). Repos created after 2026-07-15 may use immutable-ID sub format `repo:ORG@id/REPO@id:...` — check your token's sub. Role permissions: assume the CDK bootstrap roles (`cdk-hnb659fds-*`) + ECR push + ECS run-task/describe for migrations.
- Analogy: a visitor badge printed fresh at reception each visit, valid one hour, and only if the visitor's company letter (token) says "acme/shop, prod team".
- Code example: CDK (deployed once per account by hand): `const provider = new iam.OidcProviderNative(this, "GitHub", { url: "https://token.actions.githubusercontent.com", clientIds: ["sts.amazonaws.com"] }); const role = new iam.Role(this, "DeployRole", { roleName: "shop-deploy", assumedBy: new iam.WebIdentityPrincipal(provider.oidcProviderArn, { StringEquals: { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" }, StringLike: { "token.actions.githubusercontent.com:sub": "repo:acme/shop:environment:prod" } }), maxSessionDuration: Duration.hours(1) }); role.addToPolicy(new iam.PolicyStatement({ actions: ["sts:AssumeRole"], resources: [\`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*\`] }));` + `apiRepo.grantPullPush(role)`. Workflow step: `- uses: aws-actions/configure-aws-credentials@v6` with `role-to-assume: arn:aws:iam::333333333333:role/shop-deploy`, `aws-region: us-east-1`; next `run: aws sts get-caller-identity --query Arn --output text` → `arn:aws:sts::333333333333:assumed-role/shop-deploy/GitHubActions`.
- Production use: one deploy role per env account, sub pinned to that GitHub environment.
- Common mistakes: `sub` = `repo:acme/*` (any repo of org can deploy prod); forgetting `id-token: write`; giving the role AdministratorAccess directly.
- Sources: https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services ; https://github.com/aws-actions/configure-aws-credentials ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam.OidcProviderNative.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam.WebIdentityPrincipal.html ; https://docs.github.com/en/actions/reference/security/oidc#immutable-subject-claims

### Push images to ECR
- Concept: `aws-actions/amazon-ecr-login@v2` (id `ecr`) → output `registry` (e.g. `333333333333.dkr.ecr.us-east-1.amazonaws.com`); build-push-action `push: true`, `tags: ${{ steps.ecr.outputs.registry }}/shop-api:${{ github.sha }}`, platforms linux/arm64. Immutable repo → re-run with same SHA fails push → skip if tag exists (`aws ecr describe-images --repository-name shop-api --image-ids imageTag=$SHA` succeeds).
- Analogy: shipping the sealed box to the warehouse with the box serial number = the commit ID.
- Code example: steps: `- id: ecr` `uses: aws-actions/amazon-ecr-login@v2`; `- uses: docker/setup-buildx-action@v4`; `- uses: docker/build-push-action@v7` with `context: api`, `platforms: linux/arm64`, `push: true`, `tags: ${{ steps.ecr.outputs.registry }}/shop-api:${{ github.sha }}`. Log ends with pushed digest line (`sha256:...`).
- Production use: every deploy job for api and web.
- Common mistakes: tagging `latest`; building amd64; pushing to wrong account's registry.
- Sources: https://github.com/aws-actions/amazon-ecr-login ; https://github.com/docker/build-push-action

### cdk deploy from the pipeline
- Concept: order per environment: build+push images → run migrations task (expand-only, topic 13) → `npx aws-cdk@2.1149.0 deploy ShopProd -c env=prod -c imageTag=$GITHUB_SHA --require-approval never` (approval happens via GitHub environment instead) → smoke test `curl -fsS https://www.example.com/api/healthz`. CDK CLI runs on the runner's Node (preinstalled; pin Node via actions/setup-node if needed). `cdk diff` on PRs for review (optional, needs read role).
- Analogy: in a theatre change-over: bring the new props (images), adjust the stage (migrations), then raise the curtain on the new scene (deploy), then a quick sound check (smoke test).
- Code example: job `deploy-prod` `run` block: `cd infra && bun install --frozen-lockfile && npx aws-cdk@2.1149.0 deploy ShopProd -c env=prod -c imageTag=${{ github.sha }} --require-approval never` → ends `✅  ShopProd`; then `curl -fsS https://www.example.com/api/healthz` → `ok` (`-f` makes curl exit non-zero on HTTP errors → job fails).
- Production use: only path to change prod.
- Common mistakes: deploying app before migrations; `--require-approval never` without any human gate for prod; no smoke test.
- Sources: https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-deploy.html ; https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-bootstrap.html ; https://curl.se/docs/manpage.html#-f

### Promotion dev → staging → prod with approvals
- Concept: `deploy.yml` on push to main: jobs `dev` → `staging` (`needs: dev`) → `prod` (`needs: staging`), each `environment: <name>`; prod environment has required reviewers (up to 6, one approval suffices, optional prevent self-review); environment secrets/vars (`vars.AWS_ROLE_ARN`) only available after rules pass. Reusable workflow `deploy-env.yml` (workflow_call inputs env, role) keeps the three jobs identical. `concurrency: deploy-prod` (no `cancel-in-progress`) so two prod deploys never overlap.
- Analogy: a relay race with a referee before the final leg: the baton (same commit) passes from runner to runner; the last runner waits for the referee's whistle (approval).
- Code example: `deploy.yml`: `on: { push: { branches: [main] } }` / `permissions: { id-token: write, contents: read }` / `jobs: { dev: { uses: ./.github/workflows/deploy-env.yml, with: { env: dev }, secrets: inherit }, staging: { needs: dev, uses: ./.github/workflows/deploy-env.yml, with: { env: staging }, secrets: inherit }, prod: { needs: staging, uses: ./.github/workflows/deploy-env.yml, with: { env: prod }, secrets: inherit } }`; inside deploy-env.yml job `environment: ${{ inputs.env }}`, role from `vars.AWS_ROLE_ARN`. Expected: run page shows prod "Waiting for review" until approved.
- Production use: every release.
- Common mistakes: deploying different commits to each env; prod approval without staging soak; environment vars at repo level instead of env level.
- Sources: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments#required-reviewers ; https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idenvironment ; https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows#passing-inputs-and-secrets-to-a-reusable-workflow

### Rolling deploys with circuit-breaker rollback
- Concept: ECS default ROLLING: new task definition revision → starts new tasks (up to maxHealthyPercent 200) while keeping ≥ minHealthyPercent (default 50; set 100 for prod so capacity never drops) → waits for ALB health → drains old (deregistration 30 s, SIGTERM graceful). Circuit breaker `{ rollback: true }` (rollback default false) → if new tasks keep failing, ECS returns to last good revision automatically. CDK deploy waits for service stability.
- Analogy: replacing the lightbulbs in a hall one row at a time while the lights stay on; if the new bulbs keep blowing, an electrician puts the old ones back.
- Code example: `new ecs.FargateService(this, "ApiService", { ..., minHealthyPercent: 100, maxHealthyPercent: 200, circuitBreaker: { enable: true, rollback: true } });` Expected on bad image (crashes at boot): `aws ecs describe-services ... --query "services[0].deployments[0].rolloutState"` → `FAILED`, service back on previous task definition; CDK deploy fails → pipeline red.
- Production use: default deploy method for api/web.
- Common mistakes: minHealthyPercent 50 at peak (half capacity mid-deploy); no rollback flag; quota too low to start 2× tasks (topic 19).
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateServiceProps.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.DeploymentCircuitBreaker.html ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html

### ECS blue/green deployments
- Concept: native ECS strategy `deploymentStrategy: ecs.DeploymentStrategy.BLUE_GREEN` (also LINEAR, CANARY): full green fleet starts beside blue, traffic shifts via an alternate target group, `bakeTime` keeps both running for quick rollback, then blue stops; may double resource use. CDK wiring: `service.loadBalancerTarget({ alternateTarget: new ecs.AlternateTarget(...) })`; lifecycleHooks for checks. Keep it conceptual + prop names; link docs for full wiring (IAM/listener rule details). Legacy CODE_DEPLOY controller still exists — mention only.
- Analogy: building a second stage next to the first, rehearsing the new show there, then swinging the audience's chairs around; if the new show flops, swing them back during the bake time.
- Code example: snippet `deploymentStrategy: ecs.DeploymentStrategy.BLUE_GREEN, bakeTime: Duration.minutes(10)` with comment "plus alternateTarget wiring per CDK docs". Math: 60 tasks × 2 vCPU blue + 60 green = 240 vCPU during bake → check quota.
- Production use: high-risk releases needing instant rollback.
- Common mistakes: forgetting doubled capacity/quota; schema changes that green needs but blue can't handle; bake time too short to notice errors.
- Sources: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.DeploymentStrategy.html ; https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-blue-green.html ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateServiceProps.html

## Quiz
1. Why does the trust policy pin `sub` to `environment:prod`? — tests OIDC scoping.
2. Migrations and app deploy: which first, and what must the migration avoid? — tests ordering + expand.
3. minHealthyPercent 100, maxHealthyPercent 200 with 60 tasks: max tasks during deploy? — tests rolling (120).
4. What does circuit breaker rollback do when new tasks crash-loop? — tests rollback.
5. Blue/green's main cost vs rolling? — tests doubled capacity.
