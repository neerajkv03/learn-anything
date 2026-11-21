# 05. Docker Containers
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 02-linux-networking-basics

Repo layout assumed (state once): `api/` (Bun.serve, entry `api/index.ts`, `package.json`, `bun.lock`), `web/` (TanStack Start), `infra/` (CDK, later). Pin base image `oven/bun:1.4.5` (Docker guide uses `oven/bun:1`, which tracks 1.x — explain pinning for reproducibility).

## Learning goals
- Learner can explain image vs container.
- Learner can write a multi-stage Dockerfile for the Bun API that runs as non-root.
- Learner can containerise the TanStack Start SSR app on Bun.
- Learner can run Postgres + Valkey locally with Docker Compose.
- Learner can tag images by version/git SHA and keep build context small.

## Sub-topics
### Images vs containers
- Concept: image = read-only package (OS files + runtime + app + start command), built in layers. Container = running instance of an image, isolated process with own filesystem/network. Same image runs the same on laptop and Fargate. Registry = image storage (Docker Hub, ECR topic 09).
- Analogy: image = frozen ready meal (sealed, identical every time); container = that meal heated and on a plate. You can heat many from the same recipe batch; eating one doesn't change the others.
- Code example: `docker run --rm oven/bun:1.4.5 bun --version` → `1.4.5`. Then `docker images oven/bun` lists the image (size varies).
- Production use: ECS runs containers from images in ECR.
- Common mistakes: editing files inside a running container and expecting them to persist; `latest` tag in prod (unknown version).
- Sources: https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/ ; https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/

### Dockerfile for the Bun API
- Concept: instructions FROM, WORKDIR, COPY, RUN, ENV, USER, EXPOSE, CMD. Layer cache: copy `package.json` + `bun.lock` first, install, then copy source → code edits don't reinstall deps. Run as user `bun` (non-root). `bun install --frozen-lockfile` fails if lockfile drifts.
- Analogy: a recipe card read top to bottom; each line makes a sealed layer; if a line and everything above didn't change, the kitchen reuses yesterday's prepared layer.
- Code example: `api/Dockerfile` (single stage first): `FROM oven/bun:1.4.5`, `WORKDIR /usr/src/app`, `COPY package.json bun.lock ./`, `RUN bun install --frozen-lockfile --production`, `COPY . .`, `ENV NODE_ENV=production`, `USER bun`, `EXPOSE 3000`, `CMD ["bun","run","index.ts"]`. `docker build -t shop-api:dev api/` then `docker run --rm -p 3000:3000 shop-api:dev` and `curl -s localhost:3000/healthz` → `ok` (assumes /healthz from topic 06; for now say app's health route).
- Production use: same Dockerfile built in CI (topic 16).
- Common mistakes: `COPY . .` before install (cache busts every build); running as root; forgetting EXPOSE/port mapping `-p host:container`.
- Sources: https://bun.com/docs/guides/ecosystem/docker ; https://docs.docker.com/reference/dockerfile/ ; https://docs.docker.com/build/cache/

### Multi-stage builds and small images
- Concept: several FROM stages; build/test stage has dev deps; final stage copies only prod node_modules + source. Bun guide pattern: install stage (dev deps in /temp/dev, prod deps `--production` in /temp/prod), prerelease (copy dev deps + source, optional `bun test`), release (copy prod node_modules + app files, USER bun). Smaller image = faster Fargate pulls during scale-out and fewer CVEs.
- Analogy: building flat-pack furniture in the workshop with all tools, then delivering only the finished furniture — not the saw.
- Code example: `api/Dockerfile` multi-stage: `FROM oven/bun:1.4.5 AS base` / `WORKDIR /usr/src/app`; `FROM base AS install` / `RUN mkdir -p /temp/dev /temp/prod` / `COPY package.json bun.lock /temp/dev/` / `RUN cd /temp/dev && bun install --frozen-lockfile` / `COPY package.json bun.lock /temp/prod/` / `RUN cd /temp/prod && bun install --frozen-lockfile --production`; `FROM base AS prerelease` / `COPY --from=install /temp/dev/node_modules node_modules` / `COPY . .` / `ENV NODE_ENV=production` / `RUN bun test`; `FROM base AS release` / `COPY --from=install /temp/prod/node_modules node_modules` / `COPY --from=prerelease /usr/src/app/index.ts .` / `COPY --from=prerelease /usr/src/app/src ./src` / `COPY --from=prerelease /usr/src/app/package.json .` / `ENV NODE_ENV=production` / `USER bun` / `EXPOSE 3000` / `ENTRYPOINT ["bun","run","index.ts"]`. Expected: `docker build --pull -t shop-api:1.0.0 api/` succeeds; failing test stops the build.
- Production use: CI builds release stage; `--pull` refreshes base image patches (topic 21).
- Common mistakes: copying dev node_modules into release; forgetting a source folder in release COPY; skipping `--pull` so old base image stays.
- Sources: https://bun.com/docs/guides/ecosystem/docker ; https://docs.docker.com/build/building/multi-stage/

### Dockerfile for TanStack Start SSR
- Concept: TanStack Start on Bun needs React 19+; after `bun run build` either Nitro `bun` preset or the Bun reference `server.ts` (`bun run server.ts`), PORT default 3000; reference server env ASSET_PRELOAD_* options. Server env vars read at runtime via process.env inside handlers; client vars (`VITE_` prefix) baked at build time → build per environment or avoid client env. NODE_ENV=production at runtime.
- Analogy: printing a magazine: anything printed on the pages (client env) is fixed when it goes to press; things the shopkeeper says at the till (server env) can change daily.
- Code example: `web/Dockerfile`: `FROM oven/bun:1.4.5 AS build` / `WORKDIR /app` / `COPY package.json bun.lock ./` / `RUN bun install --frozen-lockfile` / `COPY . .` / `RUN bun run build`; `FROM oven/bun:1.4.5` / `WORKDIR /app` / `COPY --from=build /app .` / `ENV NODE_ENV=production PORT=3000` / `USER bun` / `EXPOSE 3000` / `CMD ["bun","run","server.ts"]`. Note: copying whole /app is the lazy version; trim to build output + server.ts + prod deps once the output folder is known (depends on Vite/Nitro setup). Expected: `curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/` → `200`.
- Production use: web service on Fargate behind ALB, static assets also pushed to S3 (topic 15).
- Common mistakes: secrets in `VITE_` vars (shipped to browsers); reading process.env at module top-level; React 18 with Bun target.
- Sources: https://tanstack.com/start/latest/docs/framework/react/guide/hosting ; https://tanstack.com/start/latest/docs/framework/react/guide/environment-variables

### Docker Compose for local Postgres and Valkey
- Concept: `compose.yaml` declares several containers + network + volumes; `docker compose up -d`. Service names become hostnames (api reaches `postgres:5432`). Volume keeps DB data between restarts. Local mirrors prod engines: postgres:17 and valkey 9.1.
- Analogy: a practice stage set: cardboard copies of the real shops on one street, close enough to rehearse.
- Code example: `compose.yaml`: services `postgres` (image `postgres:17.7`, env POSTGRES_USER=shop, POSTGRES_PASSWORD=shop, POSTGRES_DB=shop, ports "5432:5432", volume pgdata:/var/lib/postgresql/data), `valkey` (image `valkey/valkey:9.1`, ports "6379:6379"), `api` (build ./api, env DATABASE_URL=postgres://shop:shop@postgres:5432/shop, REDIS_URL=redis://valkey:6379, ports "3000:3000", depends_on postgres, valkey); volumes pgdata. `docker compose up -d` then `docker compose ps --format "{{.Service}} {{.State}}"` → `api running`, `postgres running`, `valkey running` (order may vary).
- Production use: local dev + CI integration tests; prod uses Aurora/ElastiCache instead.
- Common mistakes: using `localhost` inside a container to reach another service (use service name); no volume → data lost; prod passwords in compose file.
- Sources: https://docs.docker.com/compose/intro/compose-application-model/ ; https://hub.docker.com/_/postgres ; https://hub.docker.com/r/valkey/valkey ; https://bun.com/docs/runtime/redis

### Image tags and .dockerignore
- Concept: tag = label (`shop-api:1.0.0`, `shop-api:3f2a1c9` git SHA). Digest (sha256:...) = immutable content ID. Prod deploys use SHA tags + ECR immutable tags (topic 09). Build context = folder sent to builder; `.dockerignore` excludes node_modules, .git, .env, Dockerfile*, coverage → faster builds, no secrets in image. Fargate ARM64 (Graviton) → `docker buildx build --platform linux/arm64`.
- Analogy: tag = sticky label on a box (can be moved); digest = the box's serial number stamped in the metal. .dockerignore = "don't pack these" list when moving house.
- Code example: `api/.dockerignore` lines: `node_modules`, `.git`, `.env`, `Dockerfile*`, `.dockerignore`, `coverage`. `docker tag shop-api:1.0.0 shop-api:$(git rev-parse --short HEAD)` then `docker images shop-api --format "{{.Tag}}"` → `1.0.0` and the 7-char SHA (e.g. `3f2a1c9`). `docker buildx build --platform linux/arm64 -t shop-api:arm64 api/`.
- Production use: pipeline tags images with `${{ github.sha }}` (topic 17).
- Common mistakes: `.env` copied into image; deploying `latest`; building x86 image for ARM64 task (exec format error).
- Sources: https://docs.docker.com/build/concepts/context/#dockerignore-files ; https://docs.docker.com/reference/cli/docker/image/tag/ ; https://docs.docker.com/build/building/multi-platform/

## Quiz
1. Why copy package.json + bun.lock before the source? — tests layer cache.
2. What does the release stage leave out, and why does that matter for scaling? — tests multi-stage.
3. Inside compose, the api uses `localhost:5432` and fails. Fix? — tests service names.
4. Why is a `VITE_` secret dangerous? — tests build-time env.
5. Tag vs digest: which never changes? — tests tags.
