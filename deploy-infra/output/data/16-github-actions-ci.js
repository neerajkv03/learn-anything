window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "16-github-actions-ci",
  "order": 16,
  "title": "CI with GitHub Actions",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Continuous integration (CI) means a machine runs your checks automatically on every change, so broken code is caught before it is merged. You will write GitHub Actions workflows that run Bun tests and type checks, build the Docker image and the CDK infrastructure code, cache dependencies, and block merging until the checks pass. Finally you will extract the repeated steps into a reusable workflow.",
  "prerequisites": ["05-docker-containers", "07-aws-cdk-basics"],
  "subtopics": [
    {
      "id": "workflows-jobs-steps",
      "title": "Workflows, jobs and steps",
      "explanation": "Continuous integration (CI) means that every time someone changes the code, a machine automatically runs your checks (tests, type checks, builds) and reports pass or fail. The goal is to find problems minutes after they are written, not days later in production.\n\nA few Git words first. A commit is a saved snapshot of your code. A branch is a named line of commits; `main` is the branch that holds the code you ship. A push uploads your commits to GitHub. A pull request (PR) is a request to merge one branch into another, where teammates and automatic checks can review the change first. The examples use a made-up repository called `acme/shop`.\n\nGitHub Actions is GitHub's built-in CI system. You describe what to run in a workflow: a YAML file stored in the folder `.github/workflows/` of your repository. YAML is a text format that uses indentation (spaces, never tabs) to show structure, so a wrong indent changes the meaning or breaks the file.\n\nA workflow starts when an event happens. Events are listed under the key `on`. The common ones are `push` (commits arrive on a branch), `pull_request` (a PR is opened or updated) and `workflow_dispatch` (a person clicks a Run button in the GitHub UI). `push` and `pull_request` accept filters such as `branches: [main]` or `paths: [\"api/**\"]`, so the workflow only starts when matching branches or files change.\n\nA workflow contains jobs. Each job runs on its own fresh virtual machine called a runner, chosen with `runs-on` (we use `ubuntu-latest`, a GitHub-hosted Linux machine). Because every runner starts empty, a job cannot see files created by another job. Jobs run in parallel by default; add `needs: other-job` to make one wait for another.\n\nA job contains numbered steps that run in order. A step is either `uses` (run a ready-made action, a reusable building block published as `owner/repo@version`, such as `actions/checkout@v7`, which downloads your repository onto the runner) or `run` (execute shell commands, i.e. text commands in a terminal). Every `run` step starts its own new shell, so a variable you `export` in one step is gone in the next.\n\nTwo safety settings belong at the top of nearly every workflow. `permissions` limits what the automatic access token (the temporary credential GitHub gives each run) may do. Once you set any permission, every permission you did not list becomes `none`, so `contents: read` means: read the repository and nothing else. `concurrency` with a `group` name and `cancel-in-progress: true` cancels an older run of the same group when a newer one starts, for example when you push twice to the same PR quickly. In the group name, `${{ github.ref }}` is an expression: GitHub replaces it with the branch or PR reference of the run.",
      "analogy": "Think of a factory checklist that starts automatically whenever a new part arrives (the event). Several stations (jobs) work side by side, each in its own clean room (runner), and each station follows its own numbered steps. If the painting station must wait for the welding station, you write `needs: welding`. A sign on the door (`permissions`) says which tools each station may touch, and a rule (`concurrency`) says that if a newer part arrives, the inspection of the old one is dropped.",
      "code": [
        {
          "language": "yaml",
          "filename": ".github/workflows/ci.yml",
          "source": "name: ci\n\non:\n  pull_request:\n    branches: [main]\n  push:\n    branches: [main]\n\npermissions:\n  contents: read\n\nconcurrency:\n  group: \"ci-${{ github.ref }}\"\n  cancel-in-progress: true\n\njobs:\n  api:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n      - run: echo \"hello from $GITHUB_REF_NAME\"\n",
          "output": "Run echo \"hello from $GITHUB_REF_NAME\"\nhello from main",
          "explanation": "Save this as `.github/workflows/ci.yml` in the repository root (create the folders if they do not exist), commit it and push it to `main`. The repository is the project folder that Git tracks. Open a terminal inside that folder and run: `git add .github/workflows/ci.yml`, then `git commit -m \"add CI workflow\"`, then `git push origin main`. The workflow runs on pushes to `main` and on pull requests that target `main`. The job `api` checks out the code and prints a line. `GITHUB_REF_NAME` is a variable GitHub sets to the short branch name, so a push to `main` prints `hello from main`. Open the repository's Actions tab to see the log."
        }
      ],
      "productionNote": "In the shop repository this workflow runs on every pull request and every push to `main`. Always declare `permissions: contents: read` at the top, and widen it per job only when a job really needs more. Use `concurrency` so outdated runs do not waste runner minutes.",
      "commonMistakes": [
        "Leaving token permissions at their broad default, so a compromised step could change the repository. Set `permissions: contents: read` explicitly.",
        "Assuming a second job can see files made by the first. Each job has a fresh runner; share files with artifacts (files uploaded and downloaded between jobs) or redo the work in the second job.",
        "YAML indentation errors, for example using a tab or misaligning `steps` under the job. The workflow then fails to load or does something different from what you intended.",
        "Expecting `export NAME=value` in one `run` step to be visible in the next step. Each `run` starts a new shell."
      ],
      "sources": [
        { "title": "Workflow syntax: on", "url": "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#on" },
        { "title": "Workflow syntax: permissions", "url": "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions" },
        { "title": "Workflow syntax: concurrency", "url": "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency" }
      ]
    },
    {
      "id": "bun-tests-type-checks",
      "title": "Tests and type checks with Bun",
      "explanation": "A useful CI job does four things in order: get the code, install the same Bun version you use everywhere else, install dependencies exactly as recorded, then run the checks.\n\n`oven-sh/setup-bun@v2` is an action that installs Bun on the runner. Its input `bun-version: 1.4.5` pins the version. Use the same version as your Dockerfile, so tests run on the same tool that builds production.\n\n`bun install --frozen-lockfile` installs the dependencies listed in the lockfile `bun.lock` (the file that records the exact version of every package) and fails if `package.json` and the lockfile disagree. Without `--frozen-lockfile`, a plain `bun install` may quietly update the lockfile on the runner, and CI would test different dependencies from the ones you committed.\n\n`bun check` is Bun's type checker (added in Bun 1.4.3). It reads your TypeScript and reports type errors, such as passing a string where a number is expected, without running the program. `bun test` runs your test files and prints how many tests passed and failed. If a command exits with an error, the step fails, the job fails, and the PR shows a red cross.\n\nThe key `defaults.run.working-directory: api` makes every `run` step execute inside the `api` folder, where its `package.json` and `bun.lock` live. It only affects `run` steps; `uses` steps such as checkout still work on the whole repository.\n\nIf your tests need a real database, GitHub can start a Postgres container next to the job. That is a service container (a database container GitHub starts next to your job). Keep it for integration tests (tests that use a real database or service). Unit tests should not need real AWS: CI has no AWS credentials, so tests must not call AWS.",
      "analogy": "Every station in the workshop uses the same calibrated gauge. The inspector in CI must use the exact gauge version (Bun 1.4.5) that the workshop (your Dockerfile and laptops) uses, and an exact parts list (the lockfile). If the parts list and the box of parts do not match, the inspector stops the line instead of improvising.",
      "code": [
        {
          "language": "yaml",
          "filename": ".github/workflows/ci.yml",
          "source": "name: ci\n\non:\n  pull_request:\n    branches: [main]\n  push:\n    branches: [main]\n\npermissions:\n  contents: read\n\nconcurrency:\n  group: \"ci-${{ github.ref }}\"\n  cancel-in-progress: true\n\njobs:\n  api:\n    runs-on: ubuntu-latest\n    defaults:\n      run:\n        working-directory: api\n    steps:\n      - uses: actions/checkout@v7\n      - uses: oven-sh/setup-bun@v2\n        with:\n          bun-version: 1.4.5\n      - run: bun install --frozen-lockfile\n      - run: bun check\n      - run: bun test\n",
          "output": "Run bun test\n 1 pass\n 0 fail",
          "explanation": "The `api` job now installs Bun 1.4.5, installs locked dependencies, type-checks, then tests, all inside the `api` folder. The output shows only the last lines of the `bun test` step, where Bun prints the pass and fail counts (the number of passing tests depends on your project, and Bun prints more lines around these). `0 fail` means the step succeeds and the job gets a green check."
        }
      ],
      "productionNote": "This check blocks merging broken or mistyped code once you make it required (next sub-topics). Keep the Bun version in the workflow identical to the one in the Dockerfile and update both in the same PR. Keep tests free of real AWS calls; use fakes or local containers.",
      "commonMistakes": [
        "Running `bun install` without `--frozen-lockfile` in CI. Dependency drift (CI testing different versions from your commit) then goes unnoticed.",
        "Using a different Bun version in CI than in the Dockerfile, so tests pass on one version and production runs another.",
        "Writing tests that need real AWS resources. CI has no AWS credentials at this stage, so those tests fail."
      ],
      "sources": [
        { "title": "oven-sh/setup-bun", "url": "https://github.com/oven-sh/setup-bun" },
        { "title": "Bun docs: bun test", "url": "https://bun.com/docs/cli/test" },
        { "title": "Bun 1.4 release blog", "url": "https://bun.com/blog/bun-v1.4" },
        { "title": "Workflow syntax: steps run", "url": "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsrun" }
      ]
    },
    {
      "id": "docker-build-and-cache",
      "title": "Building and caching Docker images",
      "explanation": "Passing tests does not prove the Dockerfile works. So CI also builds the image. On pull requests we only build and discard it (`push: false`); pushing images to a registry is the job of the deploy workflow in the next topic.\n\nThree Docker actions do the work. `docker/setup-qemu-action@v4` installs QEMU (software that lets the x86 runner run ARM64 steps); setup-qemu-action adds the ARM emulation, and it must come before buildx. `docker/setup-buildx-action@v4` sets up buildx, Docker's modern build tool from the Docker topic. `docker/build-push-action@v7` then runs the build with inputs: `context` (the folder sent to the build, here `api`), `platforms` (the CPU type to build for), `push` and `tags` (the image name). Production on Fargate runs ARM64, so CI builds `linux/arm64`. Otherwise you could ship an image that was never built for the CPU it runs on.\n\nNote that `working-directory` does not affect `uses` steps, so `context: api` is relative to the repository root.\n\nSpeed matters: aim for PR feedback in under about 5 minutes. Two things help. First, `actions/cache@v6` saves a folder at the end of a successful job and restores it in the next run. Here it caches Bun's download folder `~/.bun/install/cache`. The `key` is the cache's name; it includes `hashFiles('api/bun.lock')`, a hash (short fingerprint) of the lockfile, so the cache is replaced whenever dependencies change. `restore-keys` is a fallback prefix: if no exact key exists, the newest cache starting with that prefix is used. A repository may store 10 GB of caches; GitHub evicts the least recently used first.\n\nSecond, Docker reuses unchanged layers (a layer is one step of the Dockerfile, as you saw in the Docker topic). Put rarely changing steps first: copy `package.json` and `bun.lock`, run `bun install --frozen-lockfile`, and only then copy the rest of the source code. Then editing a source file does not re-run the install. This course does not use Docker's remote layer cache backends; the Dockerfile ordering is enough.\n\nThe infrastructure code (the CDK project from the CDK topic) needs its own job. It installs dependencies, runs the assertion tests with `bun test`, then runs `npx aws-cdk@2.1149.0 synth -q`. `npx` downloads and runs an npm package command, and here it pins the CDK CLI version. `cdk synth` turns your CDK code into a CloudFormation template without touching AWS, and `-q` (quiet) hides the template text. This works without AWS credentials as long as the stacks do not use context lookups (asking AWS about existing resources, such as `fromLookup`). If they do, commit the `cdk.context.json` file that stores the lookup answers, so synth does not need to ask AWS.",
      "analogy": "A pantry of pre-measured ingredients. The first test bake measures flour and sugar from scratch (downloading packages); you store the portions in labelled jars (the cache, labelled with the recipe's fingerprint). The next bake starts from the jars and is much faster, and when the recipe changes, the label no longer matches and you restock. The pre-assembled trays are stacked in the order you build them (Dockerfile layers), the mould is set to the kitchen's oven type (linux/arm64), and a second cook checks the trays with the same recipe card (the infra job).",
      "code": [
        {
          "language": "yaml",
          "filename": ".github/workflows/ci.yml",
          "source": "name: ci\n\non:\n  pull_request:\n    branches: [main]\n  push:\n    branches: [main]\n\npermissions:\n  contents: read\n\nconcurrency:\n  group: \"ci-${{ github.ref }}\"\n  cancel-in-progress: true\n\njobs:\n  api:\n    runs-on: ubuntu-latest\n    defaults:\n      run:\n        working-directory: api\n    steps:\n      - uses: actions/checkout@v7\n      - uses: oven-sh/setup-bun@v2\n        with:\n          bun-version: 1.4.5\n      - uses: actions/cache@v6\n        with:\n          path: ~/.bun/install/cache\n          key: bun-${{ runner.os }}-${{ hashFiles('api/bun.lock') }}\n          restore-keys: bun-${{ runner.os }}-\n      - run: bun install --frozen-lockfile\n      - run: bun check\n      - run: bun test\n      - uses: docker/setup-qemu-action@v4\n      - uses: docker/setup-buildx-action@v4\n      - uses: docker/build-push-action@v7\n        with:\n          context: api\n          platforms: linux/arm64\n          push: false\n          tags: shop-api:ci\n",
          "output": "Run actions/cache@v6\nCache restored from key: bun-Linux-<hash of api/bun.lock>",
          "explanation": "The cache step comes before `bun install`, so the install can reuse downloaded packages. The output is what the cache step logs on a second run when the lockfile has not changed; the exact wording and the hash differ in your log. On the very first run the log says no cache was found, and the cache is saved when the job ends successfully. The last two steps build the `api` image for ARM64 and do not push it."
        },
        {
          "language": "docker",
          "filename": "Dockerfile",
          "source": "FROM oven/bun:1.4.5\nWORKDIR /usr/src/app\n\n# 1. Dependency files change rarely: this layer is reused from cache.\nCOPY package.json bun.lock ./\nRUN bun install --frozen-lockfile\n\n# 2. Source code changes often: only layers from here on rebuild.\nCOPY . .\nCMD [\"bun\", \"run\", \"index.ts\"]\n",
          "output": "",
          "explanation": "Layer order is what makes Docker builds fast. Because the dependency files are copied and installed before the source code, changing a source file leaves the install layer untouched. This is a shortened Dockerfile; your real one from the Docker topic is multi-stage."
        },
        {
          "language": "yaml",
          "filename": ".github/workflows/ci.yml (infra job, added under jobs:)",
          "source": "  infra:\n    runs-on: ubuntu-latest\n    defaults:\n      run:\n        working-directory: infra\n    steps:\n      - uses: actions/checkout@v7\n      - uses: oven-sh/setup-bun@v2\n        with:\n          bun-version: 1.4.5\n      - run: bun install --frozen-lockfile\n      - run: bun test\n      - run: npx aws-cdk@2.1149.0 synth -q\n",
          "output": "",
          "explanation": "Indent this block by two spaces under the existing `jobs:` key. It runs the CDK assertion tests, then synthesizes. With `-q` the synth step prints nothing on success. If the stacks needed AWS credentials, the step would fail here, which is the signal to commit `cdk.context.json`."
        }
      ],
      "productionNote": "Target under about 5 minutes for PR feedback. Build for `linux/arm64` because production tasks run ARM64. Building a CPU architecture different from the runner's uses emulation (a software imitation of the other CPU), which is slower and needs an extra setup step: the `docker/setup-qemu-action` step, placed before `docker/setup-buildx-action`. Check the action READMEs (the Sources links) for the current action versions.",
      "commonMistakes": [
        "A cache key without the lockfile hash. The cache is never refreshed and stale dependencies are reused.",
        "Building `linux/amd64` (x86) in CI while production runs ARM64. A broken ARM64 build is then only discovered at deploy time.",
        "Putting `COPY . .` before the dependency install in the Dockerfile. Every source edit then re-installs all dependencies.",
        "`cdk synth` failing in CI because the stacks use lookups and `cdk.context.json` was not committed."
      ],
      "sources": [
        { "title": "actions/cache", "url": "https://github.com/actions/cache" },
        { "title": "docker/setup-buildx-action", "url": "https://github.com/docker/setup-buildx-action" },
        { "title": "docker/build-push-action", "url": "https://github.com/docker/build-push-action" },
        { "title": "AWS CDK: context values and lookups", "url": "https://docs.aws.amazon.com/cdk/v2/guide/context.html" }
      ]
    },
    {
      "id": "pr-checks-branch-protection",
      "title": "Pull request checks and branch protection",
      "explanation": "A workflow that only reports problems can still be ignored. Branch protection turns checks into rules. You configure it in the repository settings for the branch `main`, and GitHub then refuses merges that break the rules.\n\nThe main rules are: require a pull request before merging (nobody pushes directly to `main`), and require status checks to pass. A status check is the result (pass or fail) that a job reports to the PR. You choose required checks by their job names, such as `api`, `web` and `infra`. A required check counts as OK when it is successful, skipped or neutral. So if a job is skipped by its own `if:` condition, it is reported as skipped and does not block the merge. A whole workflow skipped by a path or branch filter never reports, so its required checks stay Pending and block the PR.\n\nJob names must be unique across all workflows in the repository. If two workflows each have a job called `test`, GitHub cannot tell which one the rule means.\n\nThe option \"Require branches to be up to date before merging\" (called strict) forces the PR branch to include the latest `main` before merging, so checks ran against what `main` really contains. You can also require approving reviews from teammates. Finally, do not allow administrators to bypass the rules, or the rules protect nobody who matters.\n\nA caveat for the next sub-topic: when you later turn the jobs into reusable-workflow calls, their check names change to the form `api / check`. Then update the required checks to the new names.",
      "analogy": "A museum door that only opens when every guard at every checkpoint has signed the sheet. If a guard did not need to inspect (a skipped job), the sheet counts as signed; if any guard writes 'failed', the door stays shut, and even the museum director (an admin) cannot walk around it when bypass is turned off.",
      "code": [
        {
          "language": "markdown",
          "filename": "branch-protection-steps.md",
          "source": "1. Open the repository on GitHub, then Settings -> Branches.\n2. Add a branch protection rule for the branch name pattern: main\n3. Tick \"Require a pull request before merging\".\n4. Tick \"Require status checks to pass before merging\".\n5. Tick \"Require branches to be up to date before merging\".\n6. In the status check search box, add: api, web, infra\n7. Do not allow bypassing the rules; save the rule.",
          "output": "On a pull request where `bun test` fails:\n\n  api    Failing\n  web    Successful\n  infra  Successful\n\nMerging is blocked\nRequired statuses must pass before merging.",
          "explanation": "These are UI clicks, not code, and the menu wording can shift slightly between GitHub releases. A check name only appears in the search box after it has run at least once, so push the workflow first. The output sketches what the PR page shows when one required check fails."
        }
      ],
      "productionNote": "Nothing should reach the deploy step without passing checks, so protect `main` early and include every job, including `infra`. Do not put `paths:` filters on a workflow that has required checks; use a job-level `if` or a path-filter step instead.",
      "commonMistakes": [
        "Two workflows that both contain a job named `test`, which makes the required check ambiguous. Give every job a unique name.",
        "Allowing administrators to bypass branch protection, so the rules are skipped exactly when people are in a hurry.",
        "Forgetting to require the `infra` check, so broken infrastructure code can be merged."
      ],
      "sources": [
        { "title": "About protected branches: require status checks before merging", "url": "https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging" }
      ]
    },
    {
      "id": "reusable-workflows",
      "title": "Reusable workflows",
      "explanation": "The `api`, `web` and `infra` jobs repeat nearly the same steps. A reusable workflow lets you write those steps once and call them with different values, like a function in code.\n\nA reusable workflow is a normal workflow file whose trigger is `on: workflow_call`. Under it you declare `inputs`, the blanks the caller fills in. Each input needs a `type` (`string`, `number` or `boolean`) and may be `required: true`. If the workflow needs sensitive values it can also declare `secrets`, but secrets are not passed automatically: the caller must pass them in `secrets:`, or write `secrets: inherit` to forward all of them (only within the same organization). Inside the file you read an input with `${{ inputs.service }}`.\n\nThe file must sit directly in `.github/workflows/`, not in a subfolder. The caller uses it at job level: a job with `uses: ./.github/workflows/bun-service.yml` (the path for a file in the same repository) and `with:` to supply the inputs. You cannot put such a `uses` inside a step list, because steps call actions, while jobs call workflows. Workflows may call other workflows up to 10 levels deep.\n\nPassing an input the reusable workflow did not declare is an error. In the caller's check list, each called job appears as `<caller job> / <called job>`, such as `api / check`.",
      "analogy": "A standard operating procedure card kept in the workshop. Every station takes the same card and fills in the blanks (\"service name: api\"), so the procedure is identical everywhere, and if the procedure improves you change one card, not three.",
      "code": [
        {
          "language": "yaml",
          "filename": ".github/workflows/bun-service.yml",
          "source": "name: bun-service\n\non:\n  workflow_call:\n    inputs:\n      service:\n        type: string\n        required: true\n\npermissions:\n  contents: read\n\njobs:\n  check:\n    runs-on: ubuntu-latest\n    defaults:\n      run:\n        working-directory: ${{ inputs.service }}\n    steps:\n      - uses: actions/checkout@v7\n      - uses: oven-sh/setup-bun@v2\n        with:\n          bun-version: 1.4.5\n      - run: bun install --frozen-lockfile\n      - run: bun check\n      - run: bun test\n",
          "output": "",
          "explanation": "This file does nothing by itself; it only runs when another workflow calls it. The input `service` decides which folder the steps work in. Writing the expression `${{ inputs.service }}` as a plain YAML value is fine here."
        },
        {
          "language": "yaml",
          "filename": ".github/workflows/ci.yml",
          "source": "name: ci\n\non:\n  pull_request:\n    branches: [main]\n  push:\n    branches: [main]\n\npermissions:\n  contents: read\n\nconcurrency:\n  group: \"ci-${{ github.ref }}\"\n  cancel-in-progress: true\n\njobs:\n  api:\n    uses: ./.github/workflows/bun-service.yml\n    with:\n      service: api\n  web:\n    uses: ./.github/workflows/bun-service.yml\n    with:\n      service: web\n",
          "output": "Checks on the pull request:\n  ci / api / check\n  ci / web / check",
          "explanation": "The caller defines two jobs, `api` and `web`, that each call the reusable workflow with a different `service`. The jobs have no `runs-on` or `steps` because the called workflow supplies them. On the PR, GitHub lists the checks with the workflow name first; the part to use in branch protection is the job path `api / check` and `web / check`, so update your required checks to those names. Keep the infra job as its own job in ci.yml (its steps from the previous sub-topic). The required checks become api / check, web / check and infra."
        }
      ],
      "productionNote": "All services get identical checks from one file, and the deploy workflow in the next topic can reuse the same file before it deploys. Change the Bun version in one place only.",
      "commonMistakes": [
        "Putting the reusable workflow in a subfolder of `.github/workflows/`. GitHub only finds files directly in that folder.",
        "Writing `uses: ./.github/workflows/...` inside a step list. Calling a workflow must be done at job level.",
        "Passing a `with:` value for an input the reusable workflow did not declare. That is an error.",
        "Expecting secrets to flow into the called workflow automatically. Pass them with `secrets:` or `secrets: inherit`."
      ],
      "sources": [
        { "title": "Reuse workflows: calling a reusable workflow", "url": "https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows#calling-a-reusable-workflow" },
        { "title": "Workflow syntax: on.workflow_call", "url": "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onworkflow_call" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why set `permissions: contents: read` explicitly at the top of a workflow?",
      "options": [
        "It makes the jobs run faster on the runner.",
        "It is required, or GitHub refuses to start the workflow.",
        "It limits the automatic token to reading the repository, so a compromised step cannot do more.",
        "It lets the workflow deploy to AWS without credentials."
      ],
      "answerIndex": 2,
      "explanation": "Once any permission is set, all unlisted permissions become none, so the token can only read the repository. It has no effect on speed, is not mandatory, and gives no AWS access."
    },
    {
      "question": "What does `bun install --frozen-lockfile` protect against in CI?",
      "options": [
        "Installing dependencies that do not match the committed lockfile, which would silently change what is tested.",
        "Downloading packages over a slow network.",
        "Running tests twice in the same job.",
        "Installing Bun itself with the wrong version."
      ],
      "answerIndex": 0,
      "explanation": "With `--frozen-lockfile` the install fails if `package.json` and `bun.lock` disagree, so CI tests exactly the committed dependency versions. Bun's own version is controlled by `bun-version` in setup-bun."
    },
    {
      "question": "Two different workflows each contain a job named `test`, and you mark `test` as a required check. What goes wrong?",
      "options": [
        "GitHub merges the two jobs into one automatically.",
        "Both jobs run on the same runner and overwrite each other's files.",
        "The workflows fail to load with a YAML error.",
        "The check name is ambiguous, because job names must be unique across all workflows."
      ],
      "answerIndex": 3,
      "explanation": "Required checks are chosen by name, so identical names in different workflows cannot be told apart. Each job gets its own runner and the files load fine."
    },
    {
      "question": "Where must a reusable workflow file live, and how is it called?",
      "options": [
        "In any folder of the repository, called from a step with `run`.",
        "Directly in `.github/workflows/` with `on: workflow_call`, called by a job-level `uses:` with `with:` for inputs.",
        "In a subfolder such as `.github/workflows/shared/`, called from a step with `uses:`.",
        "In the repository root, called by `needs:`."
      ],
      "answerIndex": 1,
      "explanation": "The file must sit directly in `.github/workflows/`, declare `on: workflow_call`, and be called at job level with `uses`, passing inputs through `with`. Subfolders are not found and `uses` inside steps calls actions, not workflows."
    },
    {
      "question": "Why does CI build the Docker image for `linux/arm64`?",
      "options": [
        "ARM64 images build faster than x86 images on any runner.",
        "GitHub only accepts ARM64 images.",
        "Production on Fargate runs ARM64, so CI should prove the image builds for the CPU it will run on.",
        "Bun cannot run on x86 processors."
      ],
      "answerIndex": 2,
      "explanation": "The Fargate tasks in this course use ARM64, so building the same platform in CI catches problems before deploy. The other options are false: build speed does not favour ARM64 on every runner, GitHub accepts both, and Bun runs on x86."
    }
  ]
});
