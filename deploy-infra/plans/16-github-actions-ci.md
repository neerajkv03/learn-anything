# 16. CI with GitHub Actions
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 05-docker-containers, 07-aws-cdk-basics

Action majors (from READMEs, Nov 2026): actions/checkout@v7, actions/cache@v6, oven-sh/setup-bun@v2, docker/setup-buildx-action@v4, docker/build-push-action@v7. Repo `acme/shop` (example). Gloss git commit/branch/pull request briefly. Docker layer cache backends (type=gha) not covered — teach Dockerfile layer ordering + bun install cache instead.

## Learning goals
- Learner can write a workflow with events, jobs, steps and minimal permissions.
- Learner can run tests and type checks with Bun in CI.
- Learner can build the API/web/infra in CI and cache dependencies.
- Learner can make checks required before merging.
- Learner can extract a reusable workflow.

## Sub-topics
### Workflows, jobs and steps
- Concept: CI = run checks automatically on every change. Workflow = YAML in `.github/workflows/`, triggered by events (`push`, `pull_request` with branch/path filters, `workflow_dispatch`). Jobs run on fresh runners (ubuntu-latest), in parallel unless `needs`. Steps = `uses` (an action) or `run` (shell; each run is a new shell). `permissions`: once any is set, others become none → `contents: read`. `concurrency` cancels outdated runs.
- Analogy: a factory checklist that starts whenever a new part arrives: several stations (jobs) work side by side, each station follows numbered steps; a station waiting for another uses `needs`.
- Code example: `.github/workflows/ci.yml` skeleton: `name: ci` / `on: { pull_request: { branches: [main] }, push: { branches: [main] } }` / `permissions: { contents: read }` / `concurrency: { group: "ci-${{ github.ref }}", cancel-in-progress: true }` / `jobs: { api: { runs-on: ubuntu-latest, steps: [ { uses: actions/checkout@v7 }, { run: "echo hello from $GITHUB_REF_NAME" } ] } }` (write in block YAML in content). Log shows `hello from main` on push to main.
- Production use: every PR in the shop repo.
- Common mistakes: default broad token permissions; jobs depending on files from another job without artifacts; YAML indentation errors.
- Sources: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#on ; https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions ; https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency

### Tests and type checks with Bun
- Concept: `oven-sh/setup-bun@v2` with `bun-version: 1.4.5` (pin = same as Dockerfile); `bun install --frozen-lockfile` fails on lockfile drift; `bun test`; `bun check` = Bun's type checker (added 1.4.3). Use `working-directory: api`. Optional service container for Postgres integration tests (mention).
- Analogy: same calibrated tools at every station — the inspector uses the exact gauge version the workshop uses.
- Code example: api job steps: `- uses: actions/checkout@v7` / `- uses: oven-sh/setup-bun@v2` with `bun-version: 1.4.5` / `- run: bun install --frozen-lockfile` / `- run: bun check` / `- run: bun test` (defaults.run.working-directory: api). Log end of test step: `N pass`, `0 fail`; job ✓.
- Production use: blocks merging broken code.
- Common mistakes: `bun install` without frozen lockfile (silent drift); Bun version differs from Dockerfile; tests needing real AWS.
- Sources: https://github.com/oven-sh/setup-bun ; https://bun.com/docs/cli/test ; https://bun.com/blog/bun-v1.4 ; https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsrun

### Building and caching Docker images
- Concept: build image in CI to prove the Dockerfile works (push=false on PRs; pushing is topic 17). `docker/setup-buildx-action@v4` then `docker/build-push-action@v7` with `context`, `platforms: linux/arm64`, `push: false`, `tags`. Cache Bun downloads with `actions/cache@v6` (path `~/.bun/install/cache`, key from hash of bun.lock; 10 GB per repo, LRU). Docker layer reuse comes from Dockerfile ordering (topic 05). Infra job: `bun install` in infra + `bun test` (assertions) + `npx aws-cdk@2.1149.0 synth -q` (no AWS creds needed if stacks don't use lookups; with fromLookup commit cdk.context.json).
- Analogy: keeping a pantry of pre-measured ingredients (cache) so each test bake starts faster.
- Code example: cache step: `- uses: actions/cache@v6` with `path: ~/.bun/install/cache`, `key: bun-${{ runner.os }}-${{ hashFiles('api/bun.lock') }}`, `restore-keys: bun-${{ runner.os }}-`. Build step: `- uses: docker/setup-buildx-action@v4` / `- uses: docker/build-push-action@v7` with `context: api`, `platforms: linux/arm64`, `push: false`, `tags: shop-api:ci`. Second run: cache step logs "Cache restored" (wording approx).
- Production use: fast PR feedback (< 5 min target).
- Common mistakes: cache key without lockfile hash (stale deps); building amd64 while prod is arm64; synth needing credentials because of uncommitted lookups.
- Sources: https://github.com/actions/cache ; https://github.com/docker/setup-buildx-action ; https://github.com/docker/build-push-action ; https://docs.aws.amazon.com/cdk/v2/guide/context.html

### Pull request checks and branch protection
- Concept: branch protection on `main`: require PR, require status checks (job names, must be unique across workflows; passing/skipped/neutral count as OK), "strict" = branch up to date. Optional required reviewers. Path filters can skip jobs → skipped counts as passing.
- Analogy: a museum door that opens only after all guards at the checkpoints have signed off.
- Code example: settings steps (UI): Settings → Branches → rule for `main` → require status checks `api`, `web`, `infra`. Expected: PR with failing `bun test` shows "Merging is blocked" and the failed check.
- Production use: nothing reaches deploy without passing checks.
- Common mistakes: two workflows both with job named `test` (ambiguous check); allowing admins to bypass; forgetting infra tests.
- Sources: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging

### Reusable workflows
- Concept: workflow with `on: workflow_call` + typed `inputs` (string/number/boolean) and `secrets`; called at job level `uses: ./.github/workflows/bun-service.yml` with `with:`; files must sit directly in .github/workflows; max 10 nesting levels; secrets not auto-forwarded (`secrets: inherit` within org).
- Analogy: a standard operating procedure card reused by every station, with blanks filled in ("service name: api").
- Code example: `.github/workflows/bun-service.yml`: `on: { workflow_call: { inputs: { service: { type: string, required: true } } } }` / `permissions: { contents: read }` / `jobs: { check: { runs-on: ubuntu-latest, defaults: { run: { working-directory: "${{ inputs.service }}" } }, steps: [checkout@v7, setup-bun@v2 (1.4.5), "bun install --frozen-lockfile", "bun check", "bun test"] } }`. Caller ci.yml: `jobs: { api: { uses: ./.github/workflows/bun-service.yml, with: { service: api } }, web: { uses: ./.github/workflows/bun-service.yml, with: { service: web } } }`. Checks appear as `api / check` and `web / check`.
- Production use: identical checks for api, web, infra; reused by deploy workflow (topic 17).
- Common mistakes: putting reusable files in subfolders; calling with `uses` inside steps (must be job level); undeclared input (error).
- Sources: https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows#calling-a-reusable-workflow ; https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onworkflow_call

## Quiz
1. Why set `permissions: contents: read` explicitly? — tests token scope.
2. What does `--frozen-lockfile` protect against in CI? — tests lockfile.
3. Two workflows each have job `test`; what breaks? — tests unique check names.
4. Where must a reusable workflow file live and how is it called? — tests workflow_call.
5. Why build `linux/arm64` in CI? — tests platform match.
