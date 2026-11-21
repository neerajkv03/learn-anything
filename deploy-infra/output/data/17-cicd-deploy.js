window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "17-cicd-deploy",
  "order": 17,
  "title": "CD to AWS",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Continuous delivery (CD) means every change that passes CI is shipped to your environments by a script, not by a person typing commands. You will let GitHub Actions prove its identity to AWS with short-lived tokens (no stored keys), push SHA-tagged images (each image named by its Git commit ID) to ECR, run migrations and `cdk deploy`, promote dev to staging to prod behind a manual approval, and make ECS roll back bad releases by itself. Blue/green deployments (two full copies, switching traffic between them) are covered at concept level.",
  "prerequisites": ["04-aws-multi-account", "09-ecs-fargate", "13-database-migrations", "16-github-actions-ci"],
  "subtopics": [
    {
      "id": "github-oidc-role",
      "title": "GitHub OIDC role in AWS",
      "explanation": "A pipeline that deploys to AWS needs AWS permissions. The old way was to create an IAM user, copy its access keys into a GitHub secret and hope nobody leaks them. Those keys never expire, so a leak is a permanent break-in. The modern way is OIDC (OpenID Connect): a standard in which one service (here GitHub) vouches for the identity of a caller by handing out a signed, short-lived token. A token is just a piece of signed text. AWS can check the signature, so no secret is ever stored in GitHub.\n\nThe flow has four steps. First, the job asks GitHub for a token. This only works if the workflow grants the permission `id-token: write` (it lets the job request an OIDC token and nothing else; it gives no write access to your repository). Second, the step `aws-actions/configure-aws-credentials@v6` sends that token to STS (the AWS Security Token Service, which hands out temporary credentials) and asks to assume a named role. Third, STS checks the token against the role's trust policy. The trust policy is the JSON document on an IAM role that says who may assume it. Fourth, STS returns temporary credentials, and the rest of the job runs as that role. The default session name the action uses is `GitHubActions`.\n\nThe token contains fields called claims. Two matter here. `aud` (audience) says who the token is meant for. For AWS it is `sts.amazonaws.com`. `sub` (subject) says which job is calling. When the job runs under a GitHub environment (a named deployment target such as `prod`, set up in a later sub-topic), the subject looks like `repo:acme/shop:environment:prod`. Without an environment you can instead match a branch, as in `repo:acme/shop:ref:refs/heads/main`. Your trust policy should check `aud` with `StringEquals` and `sub` with `StringLike` (which allows `*` wildcards, though you should avoid wildcards for prod).\n\nTwo setup details. AWS must first know GitHub as an identity provider: an external system whose tokens AWS agrees to verify. You register it once per account with URL `https://token.actions.githubusercontent.com` and client id (audience) `sts.amazonaws.com`. You do not need to supply a certificate thumbprint.\n\nNewer repositories may use a subject with numeric IDs (`repo:ORG@id/REPO@id:...`). Before you copy any subject, run a job that prints its `sub` claim and use the exact text it shows.\n\nThe example below is a CDK stack (a CDK stack is the unit you deploy, from topic 7). You deploy it once per environment account by hand with your own SSO login, because the pipeline cannot create its own access. The role may assume the CDK bootstrap roles (`cdk-hnb659fds-*`, created by `cdk bootstrap`), because `cdk deploy` works through them. It may push and pull images in the `shop-api` ECR repository and read image metadata with `ecr:DescribeImages`. It may also start and watch the migration task with ECS. If `run-task` is refused with an access error mentioning `iam:PassRole`, add that permission scoped to the task's two roles only.",
      "analogy": "A visitor badge printed fresh at reception on each visit, valid for one hour. Reception only prints it if the visitor's company letter (the OIDC token) says 'acme/shop, prod team'. The `aud` claim is the addressee on the letter (this building), and the `sub` claim is the department named in it. Nobody keeps a permanent key to the building.",
      "code": [
        {
          "language": "typescript",
          "filename": "deploy-access.ts",
          "source": "import { App, Duration, Stack, StackProps } from \"aws-cdk-lib\";\nimport * as ecr from \"aws-cdk-lib/aws-ecr\";\nimport * as iam from \"aws-cdk-lib/aws-iam\";\nimport { Construct } from \"constructs\";\n\nclass DeployAccessStack extends Stack {\n  constructor(scope: Construct, id: string, props: StackProps) {\n    super(scope, id, props);\n\n    // Tell this account to trust tokens issued by GitHub Actions.\n    const provider = new iam.OidcProviderNative(this, \"GitHub\", {\n      url: \"https://token.actions.githubusercontent.com\",\n      clientIds: [\"sts.amazonaws.com\"],\n    });\n\n    // The role the prod pipeline assumes. Only jobs of repo acme/shop that run\n    // under the GitHub environment \"prod\" can use it.\n    const role = new iam.Role(this, \"DeployRole\", {\n      roleName: \"shop-deploy\",\n      assumedBy: new iam.WebIdentityPrincipal(provider.oidcProviderArn, {\n        StringEquals: { \"token.actions.githubusercontent.com:aud\": \"sts.amazonaws.com\" },\n        StringLike: { \"token.actions.githubusercontent.com:sub\": \"repo:acme/shop:environment:prod\" },\n      }),\n      maxSessionDuration: Duration.hours(1),\n    });\n\n    // cdk deploy works through the CDK bootstrap roles.\n    role.addToPolicy(new iam.PolicyStatement({\n      actions: [\"sts:AssumeRole\"],\n      resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],\n    }));\n\n    // Push and pull images, and check whether a tag already exists.\n    const apiRepo = ecr.Repository.fromRepositoryName(this, \"ApiRepo\", \"shop-api\");\n    apiRepo.grantPullPush(role);\n    role.addToPolicy(new iam.PolicyStatement({\n      actions: [\"ecr:DescribeImages\"],\n      resources: [apiRepo.repositoryArn],\n    }));\n\n    // Run and watch the one-off migration task.\n    role.addToPolicy(new iam.PolicyStatement({\n      actions: [\"ecs:RunTask\", \"ecs:DescribeTasks\"],\n      resources: [\"*\"],\n    }));\n  }\n}\n\nconst app = new App();\nnew DeployAccessStack(app, \"ShopDeployAccess\", {\n  env: { account: \"333333333333\", region: \"us-east-1\" },\n});\n",
          "output": "",
          "explanation": "`OidcProviderNative` registers GitHub as an identity provider (a native CloudFormation resource, so it needs no thumbprint). `WebIdentityPrincipal` builds the trust policy: `aud` must equal `sts.amazonaws.com` and `sub` must match the single string `repo:acme/shop:environment:prod`, with no wildcard. `maxSessionDuration` caps the temporary credentials at one hour. The file prints nothing because it only defines the stack; you deploy it with your SSO profile for the prod account."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "aws sso login --profile shop-prod\nnpx aws-cdk@2.1149.0 deploy ShopDeployAccess --app \"bun run deploy-access.ts\" --profile shop-prod",
          "output": " ✅  ShopDeployAccess",
          "explanation": "Run this once per account, from the folder that contains `deploy-access.ts`. `--app` tells the CDK command line how to run your program. Use the SSO profile of the matching account from topic 4. The output shows the final success line; CDK prints more progress lines before it."
        },
        {
          "language": "yaml",
          "filename": ".github/workflows/whoami.yml",
          "source": "name: whoami\non: workflow_dispatch\npermissions:\n  id-token: write\n  contents: read\njobs:\n  whoami:\n    runs-on: ubuntu-latest\n    environment: prod\n    steps:\n      - uses: aws-actions/configure-aws-credentials@v6\n        with:\n          role-to-assume: arn:aws:iam::333333333333:role/shop-deploy\n          aws-region: us-east-1\n      - run: aws sts get-caller-identity --query Arn --output text\n",
          "output": "arn:aws:sts::333333333333:assumed-role/shop-deploy/GitHubActions",
          "explanation": "Save the file as `.github/workflows/whoami.yml`, push it, and start it from the Actions tab (`workflow_dispatch` adds a manual Run button). `permissions: id-token: write` lets the job request a token, and `contents: read` is kept because setting any permission turns the unlisted ones off. `environment: prod` is what makes the token's `sub` claim end in `environment:prod`. The last step proves the job now acts as `shop-deploy`: the ARN has `assumed-role` and the session name `GitHubActions`."
        }
      ],
      "productionNote": "Create one deploy role per environment account (dev, staging, prod), each with a `sub` pinned to its own GitHub environment. A job for dev then cannot touch prod even if someone edits the workflow. Keep the role's permissions to the list above instead of AdministratorAccess: the CDK bootstrap roles already do the heavy lifting in CloudFormation.",
      "commonMistakes": [
        "Using `sub` = `repo:acme/*`. Every repository in the organisation, including a forgotten test repo, can then deploy to prod. Pin the full repository and the environment.",
        "Forgetting `permissions: id-token: write`. The job cannot get a token, and the credentials step fails with an error about missing OIDC token access.",
        "Attaching AdministratorAccess (full access to everything in the account) to the deploy role. A stolen or misused pipeline then owns the account. Grant only what the pipeline uses.",
        "Copying a `sub` from an old tutorial without checking your token. Newer repositories may use numeric IDs in the sub claim (see the explanation above), and then your trust policy never matches."
      ],
      "sources": [
        { "title": "GitHub Docs: Configuring OpenID Connect in Amazon Web Services", "url": "https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services" },
        { "title": "aws-actions/configure-aws-credentials", "url": "https://github.com/aws-actions/configure-aws-credentials" },
        { "title": "AWS CDK API: OidcProviderNative", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam.OidcProviderNative.html" }
      ]
    },
    {
      "id": "push-images-to-ecr",
      "title": "Push images to ECR",
      "explanation": "After the pipeline has AWS credentials, it builds the Docker image and pushes it to ECR (Elastic Container Registry, the AWS image store from topic 9). Each image is tagged with the Git commit SHA, the unique identifier of the commit, available in the workflow as `github.sha`. A SHA tag never changes meaning, so you can always tell which code a running task uses. A tag like `latest` moves, and you lose that certainty.\n\nThe step `aws-actions/amazon-ecr-login@v2` logs Docker in to your account's registry. Give it an `id` (here `ecr`) and a later step can read its output `registry` as `${{ steps.ecr.outputs.registry }}`. The value looks like `333333333333.dkr.ecr.us-east-1.amazonaws.com`. A step output is a named value a step publishes for later steps. Then `docker/setup-buildx-action@v4` prepares Buildx (Docker's modern builder, from topic 5) and `docker/build-push-action@v7` builds and pushes. Its `push` input is `false` by default, so you must set `push: true`. Set `platforms: linux/arm64` because the Fargate tasks in this course run on ARM64. If your runner is an x86 machine, building ARM images needs emulation, so the workflow first runs `docker/setup-qemu-action` (QEMU lets an x86 machine run ARM programs).\n\nIf your ECR repository is immutable (tags cannot be overwritten), re-running a workflow for the same commit fails when it tries to push the same tag again. The fix is to ask ECR first. `aws ecr describe-images` for that tag succeeds if the image exists and fails if not. The workflow below writes `found=true` or `found=false` into the special file `$GITHUB_OUTPUT`, which is how a `run` step publishes an output, and the build steps use `if:` to run only when the image is missing.\n\nEach environment builds its own image from the same commit SHA and pushes it to the ECR repository in that environment's account. The frozen lockfile (`bun install --frozen-lockfile`) and a pinned base image tag keep the builds equivalent. The upgrade path, which this course only mentions, is a shared artifacts account: build once, then promote the exact image by its digest (the content hash of the image).",
      "analogy": "Shipping a sealed box to the warehouse with the box serial number (the commit ID) written on it. Nobody can swap the contents without changing the serial number, and the warehouse refuses a second box with a serial number it already holds.",
      "code": [
        {
          "language": "yaml",
          "filename": ".github/workflows/push-image.yml",
          "source": "name: push-image\non: workflow_dispatch\npermissions:\n  id-token: write\n  contents: read\njobs:\n  push:\n    runs-on: ubuntu-latest\n    environment: prod\n    steps:\n      - uses: actions/checkout@v7\n      - uses: aws-actions/configure-aws-credentials@v6\n        with:\n          role-to-assume: arn:aws:iam::333333333333:role/shop-deploy\n          aws-region: us-east-1\n      - id: ecr\n        uses: aws-actions/amazon-ecr-login@v2\n      - id: exists\n        run: |\n          if aws ecr describe-images --repository-name shop-api --image-ids imageTag=${{ github.sha }} > /dev/null 2>&1; then\n            echo 'found=true' >> \"$GITHUB_OUTPUT\"\n          else\n            echo 'found=false' >> \"$GITHUB_OUTPUT\"\n          fi\n      - if: steps.exists.outputs.found == 'false'\n        uses: docker/setup-qemu-action@v4\n      - if: steps.exists.outputs.found == 'false'\n        uses: docker/setup-buildx-action@v4\n      - id: build\n        if: steps.exists.outputs.found == 'false'\n        uses: docker/build-push-action@v7\n        with:\n          context: api\n          platforms: linux/arm64\n          push: true\n          tags: ${{ steps.ecr.outputs.registry }}/shop-api:${{ github.sha }}\n      - if: steps.exists.outputs.found == 'false'\n        run: echo \"pushed ${{ steps.build.outputs.digest }}\"\n",
          "output": "pushed sha256:4b0c7d1e9a52f3c8b6e0d4a17f9c2e58a3b1d6f04c7e9b2a5d8f1c3e6a90b7d2",
          "explanation": "`actions/checkout@v7` downloads the repository; `context: api` is the folder with the Dockerfile. The digest after `pushed` is the image's content hash and differs for every build; a re-run for a commit whose image already exists skips the build steps and prints nothing from the last step. The image name is `<registry>/shop-api:<commit SHA>`. Do the same for the `web` image with its own repository and context."
        }
      ],
      "productionNote": "Every deploy job builds and pushes both the api and the web image, tagged with the commit SHA, into the account it deploys to. Set the repositories to immutable tags in ECR so that nobody can overwrite a tag that production already uses.",
      "commonMistakes": [
        "Tagging images `latest`. You cannot tell which commit is running, and rolling back to 'the previous latest' is impossible.",
        "Building an amd64 image for ARM64 Fargate tasks. The task starts and immediately fails with an exec format error (the CPU cannot run the program in that image). Always set `platforms: linux/arm64`.",
        "Logging in to, and pushing to, the wrong account's registry. The registry in `steps.ecr.outputs.registry` belongs to the account of the role you assumed, so check the role ARN of each environment."
      ],
      "sources": [
        { "title": "aws-actions/amazon-ecr-login", "url": "https://github.com/aws-actions/amazon-ecr-login" },
        { "title": "docker/build-push-action", "url": "https://github.com/docker/build-push-action" }
      ]
    },
    {
      "id": "cdk-deploy-from-pipeline",
      "title": "cdk deploy from the pipeline",
      "explanation": "Now the pipeline changes real infrastructure. The order inside one environment matters: (1) build and push the images, (2) run the database migration, (3) run `cdk deploy`, (4) smoke test. A smoke test is a tiny check, right after a deploy, that proves the system is alive.\n\nMigrations come before the app deploy because the new app code may expect a new column. Run them as the one-off ECS task from topic 13, and keep them expand-only: they may add tables or columns but must not remove or rename anything that the old code (still running during the deploy) uses. The migration task must run an image that contains this commit's migration files. So keep the migration task definition in its own small CDK stack, here `ShopProdMigrate`, and deploy that stack first with the same `imageTag`. The workflow then starts the task with `aws ecs run-task`, waits until it stops and fails if its exit code is not 0.\n\nThe deploy itself is `npx aws-cdk@2.1149.0 deploy ShopProd -c env=prod -c imageTag=<SHA> --require-approval never`. `npx` runs a package from the npm registry, and pinning the version `2.1149.0` keeps every run identical. The CDK command line runs on the runner's Node.js, which GitHub's runners already have; add `actions/setup-node` only if you need a specific Node version (CDK needs a Node.js version supported by the current CDK, 20 or newer for the library). `-c` passes context values to your app (topic 7): here the environment name and the image tag. Normally `cdk deploy` stops and asks a human to confirm security-sensitive changes such as new IAM permissions. A pipeline has no human at that prompt, so `--require-approval never` switches the prompt off. This is safe only because a human approves earlier, through the GitHub environment's required reviewers (next sub-topic).\n\nThe smoke test is `curl -fsS https://www.example.com/api/healthz`. `-f` makes curl exit with an error on an HTTP error status (4xx and 5xx), so the job fails. `-sS` hides the progress bar but still prints errors. Because `cdk deploy` waits until ECS reports the service stable, the smoke test sees the new version.\n\nOptionally, run `cdk diff` (which shows what a deploy would change) on pull requests so reviewers see infrastructure changes before they merge. That needs a separate read-only role.",
      "analogy": "A theatre change-over: bring in the new props (images), adjust the stage (migrations), raise the curtain on the new scene (deploy), then do a quick sound check (smoke test). If the sound check fails, you know before the audience tells you.",
      "code": [
        {
          "language": "yaml",
          "filename": ".github/workflows/deploy-prod.yml",
          "source": "name: deploy-prod\non: workflow_dispatch\npermissions:\n  id-token: write\n  contents: read\njobs:\n  deploy-prod:\n    runs-on: ubuntu-latest\n    environment: prod\n    steps:\n      - uses: actions/checkout@v7\n      - uses: aws-actions/configure-aws-credentials@v6\n        with:\n          role-to-assume: arn:aws:iam::333333333333:role/shop-deploy\n          aws-region: us-east-1\n      - uses: oven-sh/setup-bun@v2\n      # The image for this commit must already be pushed (previous sub-topic).\n      - name: Install CDK app dependencies\n        working-directory: infra\n        run: bun install --frozen-lockfile\n      - name: Deploy the migration task definition\n        working-directory: infra\n        run: npx aws-cdk@2.1149.0 deploy ShopProdMigrate -c env=prod -c imageTag=${{ github.sha }} --require-approval never\n      - name: Run migrations\n        env:\n          CLUSTER: ${{ vars.CLUSTER_NAME }}\n          MIGRATE_TASK_DEF: ${{ vars.MIGRATE_TASK_DEF }}\n          SUBNETS: ${{ vars.PRIVATE_SUBNET_IDS }}\n          SECURITY_GROUP: ${{ vars.MIGRATE_SG_ID }}\n        run: |\n          TASK_ARN=$(aws ecs run-task --cluster \"$CLUSTER\" --task-definition \"$MIGRATE_TASK_DEF\" --launch-type FARGATE --network-configuration \"awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUP]}\" --query \"tasks[0].taskArn\" --output text)\n          test \"$TASK_ARN\" != \"None\"\n          aws ecs wait tasks-stopped --cluster \"$CLUSTER\" --tasks \"$TASK_ARN\"\n          EXIT_CODE=$(aws ecs describe-tasks --cluster \"$CLUSTER\" --tasks \"$TASK_ARN\" --query \"tasks[0].containers[0].exitCode\" --output text)\n          echo \"migration exit code: $EXIT_CODE\"\n          test \"$EXIT_CODE\" = \"0\"\n      - name: Deploy the app\n        working-directory: infra\n        run: npx aws-cdk@2.1149.0 deploy ShopProd -c env=prod -c imageTag=${{ github.sha }} --require-approval never\n      - name: Smoke test\n        run: curl -fsS https://www.example.com/api/healthz\n",
          "output": " ✅  ShopProdMigrate\nmigration exit code: 0\n ✅  ShopProd\nok",
          "explanation": "The output lists the lines that matter, in order; CDK prints more progress lines in between. The `vars.*` values are environment variables you define in the GitHub environment (created in the next sub-topic) and hold the cluster name, task definition, subnets and security group from topics 8, 9 and 13. `test` exits non-zero when the check is false, and a non-zero exit stops the job, so a failed migration means the app deploy never runs. The smoke test prints `ok`, the body your `/api/healthz` endpoint returns (topic 6). If it returned 500, curl would fail and the job would turn red."
        }
      ],
      "productionNote": "This pipeline is the only path that changes prod: nobody runs `cdk deploy` from a laptop. Because every change is a commit plus a reviewed pipeline run, you always know who deployed what and when.",
      "commonMistakes": [
        "Deploying the app before running migrations. New code that expects a column that does not exist yet errors on the first request.",
        "Using `--require-approval never` for prod without any human gate. Nothing reviews the change. Put required reviewers on the `prod` environment.",
        "Skipping the smoke test. The deploy can succeed while the site is broken, and you find out from customers.",
        "Writing contract migrations (dropping or renaming a column) in the same release as the code that stops using it. Old tasks still running during the deploy break. Expand first, contract in a later release."
      ],
      "sources": [
        { "title": "AWS CDK CLI reference: cdk deploy", "url": "https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-deploy.html" },
        { "title": "AWS CDK CLI reference: cdk bootstrap", "url": "https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-bootstrap.html" },
        { "title": "curl manual: -f, --fail", "url": "https://curl.se/docs/manpage.html#-f" }
      ]
    },
    {
      "id": "promotion-with-approvals",
      "title": "Promotion dev to staging to prod with approvals",
      "explanation": "Promotion means moving the same commit through your environments in order: dev first, then staging, then prod. Each environment proves the commit works before the next one gets it. GitHub Actions models this with environments (Settings, then Environments, then New environment). Create three: `dev`, `staging`, `prod`. For `prod`, tick Required reviewers and choose up to 6 people or teams. One approval is enough, and you can also tick Prevent self-review so the person who pushed cannot approve their own release. Environments on private repositories need a paid GitHub plan (Team for organisations, Pro for personal accounts); public repositories can use them on the free plan.\n\nEach environment also holds its own variables. Add `AWS_ROLE_ARN` (the deploy role of that environment's account) and the other `vars.*` used earlier to each environment, not to the whole repository. A job that declares `environment: prod` only sees prod's variables, and only after the protection rules pass. That also stops a dev job from reading prod values.\n\nTo avoid copying the deploy steps three times, write them once as a reusable workflow (a workflow that other workflows call, from topic 16). `deploy-env.yml` starts with `on: workflow_call` and takes an input `env`. The main workflow `deploy.yml` runs on every push to `main` and has three jobs. Each job uses `uses: ./.github/workflows/deploy-env.yml` with a different `env`. `needs:` makes a job wait for another to succeed. Because all three jobs run for the same push, they deploy the same commit SHA.\n\nThe `concurrency` setting names a group, and GitHub runs only one job of a group at a time. With `concurrency: deploy-${{ inputs.env }}` and no `cancel-in-progress`, two quick pushes to `main` queue instead of overlapping, and a running prod deploy is never cancelled halfway.\n\nThe reusable workflow can only receive the permissions that the caller grants, so `id-token: write` is set in `deploy.yml`. No secrets are needed anywhere, because OIDC replaced the AWS keys.",
      "analogy": "A relay race with a referee before the final leg. The baton (the same commit) passes from runner to runner. The last runner must wait at the line for the referee's whistle (the prod approval), and a good team lets the baton run a lap in staging first.",
      "code": [
        {
          "language": "yaml",
          "filename": ".github/workflows/deploy.yml",
          "source": "name: deploy\non:\n  push:\n    branches: [main]\npermissions:\n  id-token: write\n  contents: read\njobs:\n  dev:\n    uses: ./.github/workflows/deploy-env.yml\n    with:\n      env: dev\n  staging:\n    needs: dev\n    uses: ./.github/workflows/deploy-env.yml\n    with:\n      env: staging\n  prod:\n    needs: staging\n    uses: ./.github/workflows/deploy-env.yml\n    with:\n      env: prod\n",
          "output": "dev      success\nstaging  success\nprod     Waiting for review",
          "explanation": "The output is what the run page of the workflow shows after dev and staging have finished: prod sits at 'Waiting for review' until a reviewer approves it. All three jobs call the same file, so they cannot drift apart."
        },
        {
          "language": "yaml",
          "filename": ".github/workflows/deploy-env.yml",
          "source": "name: deploy-env\non:\n  workflow_call:\n    inputs:\n      env:\n        type: string\n        required: true\npermissions:\n  id-token: write\n  contents: read\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment: ${{ inputs.env }}\n    concurrency: deploy-${{ inputs.env }}\n    steps:\n      - uses: actions/checkout@v7\n      - uses: aws-actions/configure-aws-credentials@v6\n        with:\n          role-to-assume: ${{ vars.AWS_ROLE_ARN }}\n          aws-region: us-east-1\n      - id: ecr\n        uses: aws-actions/amazon-ecr-login@v2\n      - id: exists\n        run: |\n          if aws ecr describe-images --repository-name shop-api --image-ids imageTag=${{ github.sha }} > /dev/null 2>&1; then\n            echo 'found=true' >> \"$GITHUB_OUTPUT\"\n          else\n            echo 'found=false' >> \"$GITHUB_OUTPUT\"\n          fi\n      - if: steps.exists.outputs.found == 'false'\n        uses: docker/setup-qemu-action@v4\n      - if: steps.exists.outputs.found == 'false'\n        uses: docker/setup-buildx-action@v4\n      - if: steps.exists.outputs.found == 'false'\n        uses: docker/build-push-action@v7\n        with:\n          context: api\n          platforms: linux/arm64\n          push: true\n          tags: ${{ steps.ecr.outputs.registry }}/shop-api:${{ github.sha }}\n      - uses: oven-sh/setup-bun@v2\n      - name: Install CDK app dependencies\n        working-directory: infra\n        run: bun install --frozen-lockfile\n      - name: Deploy the migration task definition\n        working-directory: infra\n        run: npx aws-cdk@2.1149.0 deploy ${{ vars.MIGRATE_STACK_NAME }} -c env=${{ inputs.env }} -c imageTag=${{ github.sha }} --require-approval never\n      - name: Run migrations\n        env:\n          CLUSTER: ${{ vars.CLUSTER_NAME }}\n          MIGRATE_TASK_DEF: ${{ vars.MIGRATE_TASK_DEF }}\n          SUBNETS: ${{ vars.PRIVATE_SUBNET_IDS }}\n          SECURITY_GROUP: ${{ vars.MIGRATE_SG_ID }}\n        run: |\n          TASK_ARN=$(aws ecs run-task --cluster \"$CLUSTER\" --task-definition \"$MIGRATE_TASK_DEF\" --launch-type FARGATE --network-configuration \"awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUP]}\" --query \"tasks[0].taskArn\" --output text)\n          test \"$TASK_ARN\" != \"None\"\n          aws ecs wait tasks-stopped --cluster \"$CLUSTER\" --tasks \"$TASK_ARN\"\n          EXIT_CODE=$(aws ecs describe-tasks --cluster \"$CLUSTER\" --tasks \"$TASK_ARN\" --query \"tasks[0].containers[0].exitCode\" --output text)\n          test \"$EXIT_CODE\" = \"0\"\n      - name: Deploy the app\n        working-directory: infra\n        run: npx aws-cdk@2.1149.0 deploy ${{ vars.STACK_NAME }} -c env=${{ inputs.env }} -c imageTag=${{ github.sha }} --require-approval never\n      - name: Smoke test\n        run: curl -fsS ${{ vars.BASE_URL }}/api/healthz\n",
          "output": " ✅  ShopDev\nok",
          "explanation": "This is the whole pipeline from the earlier sub-topics, parameterised by `inputs.env`. The output shown is the end of a dev run (stack name `ShopDev`, taken from `vars.STACK_NAME`). The role, stack names and URL all come from the environment's own variables, so the same file works for all three environments. Every job in this file is already tied to its environment, so the OIDC `sub` claim ends in `environment:dev`, `environment:staging` or `environment:prod`, and each account's trust policy accepts only its own."
        }
      ],
      "productionNote": "Run this on every release. Let a commit soak in staging (real traffic-like tests, a few hours of metrics) before a reviewer approves prod. For larger organisations the upgrade path is to build once in a shared artifacts account and promote the same image by digest, so prod runs byte-for-byte what staging tested.",
      "commonMistakes": [
        "Deploying different commits to each environment, for example by triggering each environment separately. Then staging never tested what prod gets. Chain the jobs with `needs` in one run.",
        "Approving prod right after staging finished, with no soak time. Staging only protects you if you watch it for a while.",
        "Storing AWS role ARNs and other variables at repository level instead of environment level. Every job can then read prod values, and the environment protection does not gate them."
      ],
      "sources": [
        { "title": "GitHub Docs: Deployments and environments (required reviewers)", "url": "https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments#required-reviewers" },
        { "title": "GitHub Docs: Workflow syntax, jobs.<job_id>.environment", "url": "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idenvironment" },
        { "title": "GitHub Docs: Reuse workflows, passing inputs and secrets", "url": "https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows#passing-inputs-and-secrets-to-a-reusable-workflow" }
      ]
    },
    {
      "id": "rolling-deploys-circuit-breaker",
      "title": "Rolling deploys with circuit-breaker rollback",
      "explanation": "When you deploy a new task definition revision (a new version of the task's recipe, from topic 9), the ECS service has to swap old tasks for new ones. The default way is ROLLING: ECS starts new tasks, waits until the ALB health check passes, drains the old tasks (the target group's deregistration delay lets in-flight requests finish, and the app gets SIGTERM so it can shut down gracefully, topics 6 and 10) and stops them.\n\nTwo percentages control the swap. `maxHealthyPercent` is the upper limit on running tasks, as a percentage of `desiredCount` (the number of tasks you want). The default is 200, so ECS may run up to twice as many tasks while it swaps. `minHealthyPercent` is the lower limit on healthy tasks. The default is 50, which lets ECS stop half your tasks before new ones are ready. Set it to 100 for production so capacity never drops during a deploy. With `desiredCount: 6`, `minHealthyPercent: 100` and `maxHealthyPercent: 200`, ECS keeps at least 6 healthy tasks and runs at most 12 tasks in total.\n\nA circuit breaker is a safety switch that stops a failing process before it does more damage. In ECS, the deployment circuit breaker watches the new tasks. If they keep failing to start or to pass health checks, the deployment is marked failed. With `rollback: true` ECS then returns the service to the last revision that worked on its own. The default for `rollback` is `false`, so you must set it. Defining the `circuitBreaker` property turns the breaker on.\n\n`cdk deploy` waits for the service to become stable. When the breaker rolls the release back, the deploy command fails, and so does your pipeline. You can see the verdict with `aws ecs describe-services`: each deployment has a `rolloutState` of `IN_PROGRESS`, `COMPLETED` or `FAILED`; the failed deployment shows `FAILED`, and a second deployment for the previous revision brings the service back.\n\nOne caution: while swapping, ECS may run twice the tasks. If your account's Fargate limits are too low to start that many tasks, the deploy stalls. Topic 19 covers quotas.",
      "analogy": "Replacing the lightbulbs in a hall one row at a time while the lights stay on. If the new bulbs keep blowing, an electrician (the circuit breaker) automatically puts the old ones back.",
      "code": [
        {
          "language": "typescript",
          "filename": "api-service.ts",
          "source": "import { App, Stack, StackProps } from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport * as ecr from \"aws-cdk-lib/aws-ecr\";\nimport * as ecs from \"aws-cdk-lib/aws-ecs\";\nimport { Construct } from \"constructs\";\n\nclass ApiStack extends Stack {\n  constructor(scope: Construct, id: string, props: StackProps) {\n    super(scope, id, props);\n\n    // Passed by the pipeline as: -c imageTag=<commit SHA>\n    const imageTag = this.node.tryGetContext(\"imageTag\") ?? \"dev\";\n\n    const vpc = new ec2.Vpc(this, \"Vpc\", { maxAzs: 2 });\n    const cluster = new ecs.Cluster(this, \"Cluster\", { vpc });\n    const repo = ecr.Repository.fromRepositoryName(this, \"ApiRepo\", \"shop-api\");\n\n    const taskDefinition = new ecs.FargateTaskDefinition(this, \"ApiTask\", {\n      runtimePlatform: {\n        cpuArchitecture: ecs.CpuArchitecture.ARM64,\n        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,\n      },\n    });\n    taskDefinition.addContainer(\"api\", {\n      image: ecs.ContainerImage.fromEcrRepository(repo, imageTag),\n      portMappings: [{ containerPort: 3000 }],\n    });\n\n    new ecs.FargateService(this, \"ApiService\", {\n      cluster,\n      taskDefinition,\n      desiredCount: 6,\n      minHealthyPercent: 100,\n      maxHealthyPercent: 200,\n      circuitBreaker: { enable: true, rollback: true },\n    });\n    // Load balancer wiring (topic 10) is left out to keep this focused.\n  }\n}\n\nconst app = new App();\nnew ApiStack(app, \"ShopProd\", { env: { account: \"333333333333\", region: \"us-east-1\" } });\n",
          "output": "",
          "explanation": "The file only defines infrastructure, so running it prints nothing. `tryGetContext` reads the value that `-c imageTag=<SHA>` passed, so every deploy creates a new task definition revision that points at that commit's image. `minHealthyPercent: 100` plus `maxHealthyPercent: 200` means at least 6 healthy tasks and at most 12 total during a deploy. `rollback: true` turns on automatic return to the last good revision."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "aws ecs describe-services --cluster shop-prod --services api --query \"services[0].deployments[?rolloutState=='FAILED'].rolloutState\" --output text",
          "output": "FAILED",
          "explanation": "Run this after deploying an image that crashes at boot. The failed deployment shows `FAILED`, meaning the circuit breaker gave up on it; a second deployment for the previous revision brings the service back, so it keeps serving traffic. The `cdk deploy` run exits with an error, so the pipeline turns red."
        }
      ],
      "productionNote": "Rolling with the circuit breaker is the default deploy method for the api and web services. Combined with the smoke test and the manual approval, a bad image usually costs you a red pipeline run rather than an outage.",
      "commonMistakes": [
        "Leaving `minHealthyPercent` at 50 during peak hours. Half of your capacity disappears mid-deploy and the rest may be overloaded.",
        "Not setting `rollback: true`. The deployment is marked failed but ECS does not go back, and the service may keep retrying the broken revision.",
        "Having too low a Fargate quota to start the extra tasks. The deploy stalls with tasks that cannot be placed (see topic 19).",
        "Assuming the circuit breaker catches bugs that pass the health check. If `/healthz` returns 200 while real pages fail, the breaker sees a healthy deployment."
      ],
      "sources": [
        { "title": "AWS CDK API: FargateServiceProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateServiceProps.html" },
        { "title": "AWS CDK API: DeploymentCircuitBreaker", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.DeploymentCircuitBreaker.html" },
        { "title": "Amazon ECS: How the deployment circuit breaker detects failures", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html" }
      ]
    },
    {
      "id": "ecs-blue-green",
      "title": "ECS blue/green deployments",
      "explanation": "Rolling replaces tasks in place. Blue/green keeps two complete copies side by side. 'Blue' is the revision serving users now, and 'green' is the new revision. ECS starts a full green fleet next to blue, checks it, and then shifts the ALB's traffic from blue to green by pointing the listener at an alternate target group (a second target group that holds the green tasks). After the shift comes the bake time: a period in which both fleets keep running, so if the metrics turn bad you can switch back to blue in seconds. When the bake time ends, ECS stops blue.\n\nECS supports this natively. In CDK you set `deploymentStrategy: ecs.DeploymentStrategy.BLUE_GREEN` on the service. Two variations shift traffic gradually: `LINEAR` (equal steps) and `CANARY` (a small share first, then the rest). `bakeTime` sets the bake duration, and `lifecycleHooks` can run your own checks at stages of the deployment. The load balancer side is connected with `service.loadBalancerTarget({ alternateTarget: new ecs.AlternateTarget(...) })`. The complete wiring (the IAM role and the listener rule details) is long and version-sensitive, so use the CDK and ECS documents linked below for it. This course covers the concept and the property names only. An older mechanism with a separate AWS CodeDeploy controller (`CODE_DEPLOY`) still exists; you do not need it for new services.\n\nThe price is capacity: during the deploy and the bake time you run both fleets, which may double resource use. The program below does the arithmetic so you can compare it with your Fargate vCPU quota (the limit AWS puts on how many vCPUs you may run in a region; quotas are covered in topic 19). Run it with `bun run quota.ts`.\n\nA second trap: blue and green share one database. If green needs a schema change that blue cannot handle, you cannot switch back safely. The expand-only migration rule from the earlier sub-topics matters even more here.",
      "analogy": "Building a second stage next to the first, rehearsing the new show there, then swinging the audience's chairs around to face it. If the new show flops, you swing the chairs back during the bake time, because the old stage is still standing.",
      "code": [
        {
          "language": "typescript",
          "filename": "quota.ts",
          "source": "const tasks = 60;\nconst vcpuPerTask = 2;\n\nconst blue = tasks * vcpuPerTask;\nconst green = tasks * vcpuPerTask;\n\nconsole.log(`blue:  ${blue} vCPU`);\nconsole.log(`green: ${green} vCPU`);\nconsole.log(`peak during bake time: ${blue + green} vCPU`);\n",
          "output": "blue:  120 vCPU\ngreen: 120 vCPU\npeak during bake time: 240 vCPU",
          "explanation": "A service of 60 tasks with 2 vCPU each uses 120 vCPU in steady state. During blue/green both fleets run, so the peak is 240 vCPU. A rolling deploy with maxHealthyPercent 200 can also reach the 240 vCPU peak. With a 200 vCPU quota, lower maxHealthyPercent to 150 (about 90 tasks, 180 vCPU) or request a quota increase."
        },
        {
          "language": "typescript",
          "filename": "service-excerpt.ts",
          "source": "// Excerpt from a stack, not a complete file: it shows only the blue/green properties.\nnew ecs.FargateService(this, \"ApiService\", {\n  cluster,\n  taskDefinition,\n  desiredCount: 60,\n  deploymentStrategy: ecs.DeploymentStrategy.BLUE_GREEN,\n  bakeTime: Duration.minutes(10),\n  // plus alternateTarget wiring per the CDK docs\n});\n",
          "output": "",
          "explanation": "`deploymentStrategy` switches the service from the default ROLLING to BLUE_GREEN, and `bakeTime` keeps both fleets running for 10 minutes after traffic has moved. The comment marks the part you must add from the documentation: the alternate target group that holds the green tasks. Choose a bake time long enough for your error and latency graphs to show a problem."
        }
      ],
      "productionNote": "Reserve blue/green for high-risk releases that need an instant rollback, such as a change to checkout or authentication. For routine releases, rolling with the circuit breaker is cheaper and simpler.",
      "commonMistakes": [
        "Forgetting that capacity doubles. The green fleet cannot start when your Fargate vCPU quota is lower than blue plus green.",
        "Shipping a schema change that green needs and blue cannot handle. Rollback is then no longer safe because both share the database.",
        "Setting a bake time so short that slow problems (memory leaks, a failing nightly job) appear only after blue is already gone."
      ],
      "sources": [
        { "title": "AWS CDK API: DeploymentStrategy", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.DeploymentStrategy.html" },
        { "title": "Amazon ECS: Blue/green deployments", "url": "https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-blue-green.html" },
        { "title": "AWS CDK API: FargateServiceProps", "url": "https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateServiceProps.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why does the deploy role's trust policy pin `sub` to `repo:acme/shop:environment:prod` instead of `repo:acme/*`?",
      "options": [
        "So that only jobs of that one repository running under the prod environment (and its approval rules) can assume the prod role",
        "So that the OIDC token stays valid for longer than one hour",
        "So that the workflow no longer needs `permissions: id-token: write`",
        "So that the role can be used to push images but not to run `cdk deploy`"
      ],
      "answerIndex": 0,
      "explanation": "The `sub` claim names the repository and environment of the calling job. A wildcard would let any repository of the organisation, or any job without the prod approval, assume the prod role. The token lifetime, the `id-token: write` permission and the role's permissions are all separate settings."
    },
    {
      "question": "In one environment's pipeline, which runs first, the migration or the app deploy, and what must the migration avoid?",
      "options": [
        "The app deploy first, then a migration that may drop old columns",
        "The migration first, and it must be expand-only (add things, never remove or rename what the still-running old code uses)",
        "They run at the same time, so no ordering rule is needed",
        "The migration first, and it must drop unused columns so the schema stays clean"
      ],
      "answerIndex": 1,
      "explanation": "New code may need new columns, so the migration runs first. During the deploy old tasks are still running against the same database, so the migration must not remove anything they use. Contract steps (drops and renames) come in a later release."
    },
    {
      "question": "A service has `desiredCount: 60`, `minHealthyPercent: 100` and `maxHealthyPercent: 200`. What is the largest number of tasks that can run during a rolling deploy?",
      "options": [
        "60",
        "90",
        "120",
        "180"
      ],
      "answerIndex": 2,
      "explanation": "`maxHealthyPercent: 200` allows up to 200 percent of 60 tasks, which is 120. `minHealthyPercent: 100` means at least 60 healthy tasks must remain, so ECS adds new tasks before it stops old ones."
    },
    {
      "question": "New tasks keep crashing at startup after a deploy and the service has the circuit breaker with `rollback: true`. What happens?",
      "options": [
        "ECS keeps retrying the new revision forever and the old tasks stay stopped",
        "ECS deletes the service and the pipeline must create it again",
        "The database is restored to the state before the migration",
        "ECS marks the deployment FAILED and returns the service to the last good task definition revision, and the cdk deploy run fails"
      ],
      "answerIndex": 3,
      "explanation": "The circuit breaker detects repeated task failures, fails the deployment and, with rollback enabled, goes back to the last revision that worked. The CDK deploy waits for stability and therefore reports an error. Nothing happens to the service's existence or to the database."
    },
    {
      "question": "What is the main extra cost of ECS blue/green compared with a rolling deployment?",
      "options": [
        "It cannot use an Application Load Balancer",
        "Both fleets run at the same time during the deploy and bake time, so resource use and quota needs may double",
        "It requires a long-lived access key stored in GitHub",
        "It cannot be rolled back once traffic has shifted"
      ],
      "answerIndex": 1,
      "explanation": "Blue/green starts a full green fleet beside blue and keeps both during the bake time, which may double resource use and needs quota for both. It does use a load balancer and is designed for fast rollback during the bake time. It has nothing to do with access keys."
    }
  ]
});
