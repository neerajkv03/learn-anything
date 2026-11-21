window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "05-docker-containers",
  "order": 5,
  "title": "Docker Containers",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "Docker packs your app, its runtime and its start command into an image that runs the same way on your laptop and on AWS. You will write Dockerfiles for the Bun API and the TanStack Start web app, run Postgres and Valkey locally with Docker Compose, and tag images so every deployment is traceable.",
  "prerequisites": ["02-linux-networking-basics"],
  "subtopics": [
    {
      "id": "images-vs-containers",
      "title": "Images vs containers",
      "explanation": "Docker is a tool that packages a program together with everything it needs to run, then runs it in isolation. Two words matter most. An image is a read-only package: operating-system files, a runtime (here Bun, the JavaScript runtime this course uses), your application code and the command that starts it. A container is a running instance of an image: an isolated process with its own filesystem and its own network.\n\nAn image is built in layers. A layer is one saved step of the build, stacked on the previous one. Layers can be reused between builds and between images, which is what makes builds fast. You will see this in the next sub-topic.\n\nBecause the image contains everything, the same image behaves the same on your laptop, in a CI job and on AWS Fargate (the AWS service that runs containers for you, covered in topic 09). One image can start many containers at once. A registry is a server that stores images so other machines can download (pull) them. Docker Hub is the public registry; ECR (AWS's registry) comes in topic 09.\n\nThis topic assumes Docker is installed (Docker Desktop on Windows or macOS, Docker Engine on Linux) and that you have a terminal open (topic 02). Install Docker Desktop from docs.docker.com, start it, then run `docker --version` in a terminal; it should print a version number. It also assumes this repo layout: `api/` (the Bun API, entry file `api/index.ts`, plus `package.json` and `bun.lock`), `web/` (the TanStack Start web app) and `infra/` (infrastructure code, added later).\n\nWe pin (lock to one exact version of) the base image (the starting image your own image is built on) to `oven/bun:1.4.5` instead of `oven/bun:1`. The short tag `1` follows the newest 1.x release, so a build next month could silently use a different Bun. An exact tag makes builds reproducible.\n\nContainers are disposable. Anything written inside a running container disappears when that container is removed. The image itself never changes when you run it.",
      "analogy": "An image is a frozen ready meal: sealed, identical every time, and it never changes while it sits in the freezer. A container is that meal heated and served on a plate. You can heat many meals from the same batch at once, and eating (or spilling) one does not change the others or the freezer stock. A registry is the warehouse that ships the same batch to every restaurant.",
      "code": [
        {
          "language": "bash",
          "filename": "terminal",
          "source": "docker run --rm oven/bun:1.4.5 bun --version",
          "output": "1.4.5",
          "explanation": "`docker run` creates a container from the image `oven/bun:1.4.5` (downloading it first if it is not on your machine) and runs the command `bun --version` inside it. `--rm` tells Docker to delete the container as soon as it exits, so it does not pile up. The output proves the container has its own Bun, whatever is installed on your computer."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "docker images oven/bun --format \"{{.Repository}}:{{.Tag}}\"",
          "output": "oven/bun:1.4.5",
          "explanation": "`docker images` lists the images stored on your machine. The `--format` option prints only the name and tag instead of the full table (the table also has an image ID, age and size, which differ on every machine). The image stays after the container is gone: image and container are separate things."
        }
      ],
      "productionNote": "In production, AWS ECS (Elastic Container Service) starts containers from images stored in ECR. The image you tested locally is the exact artifact that runs in production, so \"it worked on my machine\" becomes \"it works in this image\".",
      "commonMistakes": [
        "Editing files inside a running container and expecting the change to last. The change lives only in that one container and is lost when it is removed. Change the source, rebuild the image and start a new container.",
        "Deploying with the `latest` tag (or a loose tag like `1`) in production. You cannot tell which version is running and a rebuild can pull different code. Use exact version tags.",
        "Mixing up the two words: an image is the package, a container is a running copy of it. Deleting a container does not delete the image."
      ],
      "sources": [
        { "title": "Docker docs: What is a container?", "url": "https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/" },
        { "title": "Docker docs: What is an image?", "url": "https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/" }
      ]
    },
    {
      "id": "dockerfile-bun-api",
      "title": "Dockerfile for the Bun API",
      "explanation": "A Dockerfile is a plain text file of instructions that tells Docker how to build an image. Create a file named exactly `Dockerfile` (capital D, no extension) inside the `api/` folder. Docker reads it from top to bottom and turns each instruction into a layer.\n\nThe instructions you need first. `FROM` chooses the starting image. `WORKDIR` sets the folder inside the image where later commands run (it is created if missing). `COPY` copies files from your project into the image. `RUN` runs a command while the image is being built. `ENV` sets an environment variable (topic 02) that the running container sees.\n\nThe last ones. `USER` chooses which user the container process runs as. `EXPOSE` documents which port the app listens on; it does not open the port by itself. `CMD` is the command that starts when a container starts.\n\nLayer cache: Docker reuses a layer from the previous build if its instruction and everything above it are unchanged. So copy only `package.json` (the file listing your dependencies, the packages your code uses) and `bun.lock` (the lockfile, which records the exact version of every package) first, then install. Your source code changes often, the dependencies rarely, so most builds skip the slow install. The installed packages go into a folder called `node_modules`.\n\n`bun install --frozen-lockfile` installs exactly what `bun.lock` says and fails if `package.json` and the lockfile disagree, so a build can never quietly use different versions. `--production` skips devDependencies (packages only needed while developing, such as test tools). If your `api/` has no `bun.lock` yet, run `bun install` inside `api/` once to create it.\n\n`USER bun` runs the app as the unprivileged user `bun` that the official Bun image provides, instead of root (the all-powerful administrator user). If the app is ever compromised, the attacker gets fewer rights.\n\nThe example app below is deliberately tiny. It has a health route (a URL that answers `ok` when the app is alive; topic 06 builds it out properly). `Bun.serve` listens on port 3000 and, by default, on `0.0.0.0` (all network interfaces), which is required inside a container (topic 02: `127.0.0.1` would be unreachable from outside).\n\nThe `-p 3000:3000` flag in `docker run` maps a port: `host_port:container_port`. Traffic to port 3000 on your machine is forwarded to port 3000 inside the container. Without it, your machine cannot reach the app.",
      "analogy": "A Dockerfile is a recipe card read top to bottom. Each line produces a sealed, labelled tray (a layer). When you cook again, the kitchen checks each line in order: if this line and everything above it are unchanged, it reuses yesterday's tray instead of cooking it again. Once one line changes, every line below it must be cooked fresh, so put the slow, rarely changing steps (shopping for ingredients, i.e. installing dependencies) at the top and the fast, often changing step (plating, i.e. copying your code) at the bottom.",
      "code": [
        {
          "language": "typescript",
          "filename": "api/index.ts",
          "source": "import { health } from \"./src/health\";\n\nconst server = Bun.serve({\n  port: Number(process.env.PORT ?? 3000),\n  fetch(req) {\n    const url = new URL(req.url);\n    if (url.pathname === \"/healthz\") {\n      return new Response(health());\n    }\n    return new Response(\"not found\", { status: 404 });\n  },\n});\n\nconsole.log(`listening on ${server.port}`);\n",
          "output": "listening on 3000",
          "explanation": "A minimal Bun.serve app. It reads the port from the `PORT` environment variable and falls back to 3000. Requests to `/healthz` get the text from `health()`; everything else gets a 404 status code (\"not found\"). When started with no `PORT` set, it prints the line shown."
        },
        {
          "language": "typescript",
          "filename": "api/src/health.ts",
          "source": "export function health(): string {\n  return \"ok\";\n}\n",
          "output": "",
          "explanation": "A tiny helper in its own file. `export` makes the function importable from other files. It exists so the next sub-topic has something to test and a `src` folder to copy."
        },
        {
          "language": "docker",
          "filename": "Dockerfile",
          "source": "FROM oven/bun:1.4.5\nWORKDIR /usr/src/app\n\n# Dependency files first: this layer is reused until they change\nCOPY package.json bun.lock ./\nRUN bun install --frozen-lockfile --production\n\n# Source code last: edits only rebuild from here down\nCOPY . .\n\nENV NODE_ENV=production\nUSER bun\nEXPOSE 3000\nCMD [\"bun\", \"run\", \"index.ts\"]\n",
          "output": "",
          "explanation": "Save as `api/Dockerfile`. Step by step: start from the pinned Bun image; work in `/usr/src/app`; copy the two dependency files; install production dependencies exactly as locked; copy the rest of the code; mark the environment as production; drop to the non-root `bun` user; document port 3000; start the app with `bun run index.ts`. The `CMD` uses the list form (JSON array) so Bun is started directly as the container's main process."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "docker build -t shop-api:dev api/\ndocker run --rm -p 3000:3000 shop-api:dev",
          "output": "listening on 3000",
          "explanation": "Run both from the repo root. `docker build -t shop-api:dev api/` builds an image from the Dockerfile in `api/` and names it (`-t`, tag) `shop-api` with the label `dev`. The final argument `api/` is the build context, the folder Docker may copy files from. `docker run` then starts a container and keeps running in the foreground, printing the app's log line. Press Ctrl+C to stop it."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "curl -s localhost:3000/healthz",
          "output": "ok",
          "explanation": "Open a second terminal while the container is running. `curl` (a command-line HTTP client) asks the health route for its answer; `-s` hides the progress meter. Getting `ok` proves the build, the port mapping and the app all work."
        }
      ],
      "productionNote": "The same Dockerfile is built by the CI pipeline in topic 16 and the resulting image is what ECS runs, so a Dockerfile problem is found on every push and not on deploy day.",
      "commonMistakes": [
        "Putting `COPY . .` before the install step. Every code edit then changes that layer and forces a full reinstall of dependencies on every build.",
        "Running as root because `USER` was left out. Always switch to the `bun` user in the final image.",
        "Forgetting the port mapping. `EXPOSE` only documents the port; you still need `-p host:container` on `docker run`, and the app must listen on `0.0.0.0` (the default for Bun.serve).",
        "Ignoring a failing `--frozen-lockfile` install. It means `package.json` and `bun.lock` disagree. Run `bun install` locally, commit the updated `bun.lock`, and build again."
      ],
      "sources": [
        { "title": "Bun docs: Containerize a Bun application with Docker", "url": "https://bun.com/docs/guides/ecosystem/docker" },
        { "title": "Docker docs: Dockerfile reference", "url": "https://docs.docker.com/reference/dockerfile/" },
        { "title": "Docker docs: Build cache", "url": "https://docs.docker.com/build/cache/" }
      ]
    },
    {
      "id": "multi-stage-builds",
      "title": "Multi-stage builds and small images",
      "explanation": "A multi-stage build uses several `FROM` lines in one Dockerfile. Each `FROM` starts a new stage, a separate temporary image. Only the last stage becomes the image you ship. Earlier stages can hold build tools, test tools and development dependencies, and you copy only what you need into the final stage with `COPY --from=<stage name>`. You name a stage with `AS`, for example `FROM oven/bun:1.4.5 AS base`.\n\nThe Bun guide uses four stages. `base` sets the starting image and the work folder. `install` installs dependencies twice into separate folders: all packages (including devDependencies) in `/temp/dev`, and production-only packages in `/temp/prod`. `prerelease` copies the full dependencies and the source and runs `bun test` (Bun's built-in test runner, which finds and runs files ending in `.test.ts`). `release` is the final image: production packages plus only the application files, running as the `bun` user.\n\nIf `bun test` fails, the `RUN` instruction fails and the whole build stops, so a broken version never becomes an image. For this to pass, the project needs at least one test. The test file below checks the `health()` function from the previous sub-topic.\n\nWhy small images matter: when your service scales out on Fargate, every new machine must download the image first. A smaller image starts faster. It also contains fewer packages, so fewer CVEs (publicly listed security flaws in software) can apply to it.\n\n`--pull` in `docker build` makes Docker check for a newer copy of the base image before building. Without it, Docker may keep using an old local copy of `oven/bun:1.4.5` that lacks recent security patches (topic 21 returns to this).\n\nThe release stage copies `index.ts`, the `src` folder and `package.json` by name. If you add another top-level source file or folder later, add a matching `COPY` line, or the container will crash at start-up with a missing-file error.",
      "analogy": "Building flat-pack furniture happens in a workshop full of saws, drills and wood offcuts. You deliver only the finished furniture to the customer, not the saw. The workshop stages (install, prerelease) hold all the tools; the release stage is the delivery van with just the product. The test stage is the quality inspector who can refuse to let the product leave.",
      "code": [
        {
          "language": "typescript",
          "filename": "api/src/health.test.ts",
          "source": "import { expect, test } from \"bun:test\";\nimport { health } from \"./health\";\n\ntest(\"health returns ok\", () => {\n  expect(health()).toBe(\"ok\");\n});\n",
          "output": "",
          "explanation": "A test file for `bun test`. `test(name, function)` registers one check and `expect(value).toBe(expected)` fails the test if the two differ. Nothing is printed until the test runner runs it, which happens inside the Docker build."
        },
        {
          "language": "docker",
          "filename": "Dockerfile",
          "source": "FROM oven/bun:1.4.5 AS base\nWORKDIR /usr/src/app\n\n# Stage 1: install dependencies twice, into separate folders\nFROM base AS install\nRUN mkdir -p /temp/dev /temp/prod\nCOPY package.json bun.lock /temp/dev/\nRUN cd /temp/dev && bun install --frozen-lockfile\nCOPY package.json bun.lock /temp/prod/\nRUN cd /temp/prod && bun install --frozen-lockfile --production\n\n# Stage 2: full dependencies + source, run the tests\nFROM base AS prerelease\nCOPY --from=install /temp/dev/node_modules node_modules\nCOPY . .\nENV NODE_ENV=production\nRUN bun test\n\n# Stage 3: the image we ship\nFROM base AS release\nCOPY --from=install /temp/prod/node_modules node_modules\nCOPY --from=prerelease /usr/src/app/index.ts .\nCOPY --from=prerelease /usr/src/app/src ./src\nCOPY --from=prerelease /usr/src/app/package.json .\nENV NODE_ENV=production\nUSER bun\nEXPOSE 3000\nENTRYPOINT [\"bun\", \"run\", \"index.ts\"]\n",
          "output": "",
          "explanation": "Replace `api/Dockerfile` with this. Only the `release` stage is in the final image, and it receives the production `node_modules` from `install` plus three named items from `prerelease`. `ENTRYPOINT` is like `CMD` but marks the command as the fixed program of the container. The development packages never reach the shipped image (the small test file inside `src` does, which is harmless)."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "docker build --pull -t shop-api:1.0.0 api/",
          "output": "",
          "explanation": "Builds the final stage and names it `shop-api:1.0.0`. Docker prints build progress while it works, and the build finishes without an error when the tests pass. If `bun test` fails, the build stops at that step with a non-zero exit and no image is produced."
        }
      ],
      "productionNote": "CI builds the release stage on every push, with `--pull` so base-image security patches are picked up. Smaller images also speed up scale-out on Fargate because new tasks download less. Image scanning for CVEs is covered in topic 21.",
      "commonMistakes": [
        "Copying the dev `node_modules` into the release stage. It makes the image bigger and ships test tools to production. Copy from `/temp/prod`.",
        "Adding a new source folder but forgetting to add it to the release `COPY` lines. The app works in tests but crashes in the container.",
        "Skipping `--pull`, so an old cached base image (and its unpatched flaws) stays in your builds forever.",
        "Having no test file. `bun test` then finds nothing to run and the build step fails; add at least one test or remove the step."
      ],
      "sources": [
        { "title": "Bun docs: Containerize a Bun application with Docker", "url": "https://bun.com/docs/guides/ecosystem/docker" },
        { "title": "Docker docs: Multi-stage builds", "url": "https://docs.docker.com/build/building/multi-stage/" }
      ]
    },
    {
      "id": "dockerfile-tanstack-start",
      "title": "Dockerfile for TanStack Start SSR",
      "explanation": "TanStack Start is the full-stack React framework used for the `web/` app. SSR (server-side rendering) means the server builds the HTML of each page before sending it, so the web app is a long-running server, just like the API, and fits in a container the same way.\n\nTo run it on Bun the app needs React 19 (a JavaScript library for building page screens) or newer. You first build it with `bun run build` (the script in `package.json` that compiles the app). Then you start it in one of two ways from the TanStack hosting guide: use the Nitro `bun` preset (Nitro is a server toolkit that can package the output for Bun), or use the reference `server.ts` file from the guide and start it with `bun run server.ts`. This sub-topic uses the second way. Copy the `server.ts` from the hosting guide into `web/`. It listens on the `PORT` environment variable (default 3000) and has settings such as `ASSET_PRELOAD_MAX_SIZE` for how it caches static files in memory.\n\nEnvironment variables come in two kinds. Server variables are read at run time from `process.env` inside your server code, so the same image can run in dev, staging and prod with different values. Client variables, those starting with `VITE_` (Vite is the build tool TanStack Start uses), are copied into the JavaScript sent to browsers at build time. Changing them means rebuilding the image. Therefore never put a secret in a `VITE_` variable: anyone can read it in the browser.\n\nRead `process.env` inside a function that runs per request, not at the top of a file. The top of a file runs once at start-up (or even at build time) and may see the wrong value.\n\nThe Dockerfile below is the simple version: it copies the whole `/app` folder, including development dependencies, into the final image. Once you know your build output folder (it depends on the Vite and Nitro setup), trim the final stage to just the build output, `server.ts` and production dependencies, as in the multi-stage pattern from the previous sub-topic.",
      "analogy": "Printing a magazine. Anything printed on the pages (client variables) is fixed the moment the magazine goes to press; you cannot change a printed price without reprinting every copy. Things the shopkeeper says at the till (server variables) can change every day without reprinting. A secret printed on a page is visible to every reader.",
      "code": [
        {
          "language": "docker",
          "filename": "Dockerfile",
          "source": "FROM oven/bun:1.4.5 AS build\nWORKDIR /app\nCOPY package.json bun.lock ./\nRUN bun install --frozen-lockfile\nCOPY . .\nRUN bun run build\n\nFROM oven/bun:1.4.5\nWORKDIR /app\nCOPY --from=build /app .\nENV NODE_ENV=production PORT=3000\nUSER bun\nEXPOSE 3000\nCMD [\"bun\", \"run\", \"server.ts\"]\n",
          "output": "",
          "explanation": "Save as `web/Dockerfile`. The `build` stage installs all dependencies and compiles the app. The final stage copies the result, sets `NODE_ENV=production` and `PORT=3000`, switches to the `bun` user and starts the reference server. Build and run it like the API: `docker build -t shop-web:dev web/` then `docker run --rm -p 3000:3000 shop-web:dev` (stop the API container first, or map a different host port such as `-p 3001:3000`)."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "curl -s -o /dev/null -w \"%{http_code}\\n\" localhost:3000/",
          "output": "200",
          "explanation": "`-o /dev/null` throws away the page body and `-w \"%{http_code}\\n\"` prints just the HTTP status code (topic 01). `200` means the server rendered the home page successfully. Use the host port you chose in `docker run`."
        },
        {
          "language": "typescript",
          "filename": "api-url.ts",
          "source": "export function apiUrl(): string {\n  // Read at call time, so each environment can set its own value\n  return process.env.API_URL ?? \"http://localhost:3000\";\n}\n\nconsole.log(apiUrl());\n",
          "output": "http://api:3000",
          "explanation": "A server-side setting read inside a function. Run it with `API_URL=http://api:3000 bun run api-url.ts`: the shell sets the variable for that one command (topic 02) and the file prints it. With no `API_URL` it would print `http://localhost:3000`. Because the value is read at run time, the same image works everywhere. A `VITE_` value, in contrast, would be frozen into the build."
        }
      ],
      "productionNote": "In production the web service runs on Fargate behind an Application Load Balancer, and its static assets are also pushed to S3 and served by CloudFront (topic 15). Build one image per environment if you use `VITE_` variables, or avoid client variables and fetch settings from the server.",
      "commonMistakes": [
        "Putting a secret (API key, password) in a `VITE_` variable. It is copied into the browser bundle and visible to everyone.",
        "Reading `process.env` at the top level of a module instead of inside a handler or function. The value may be read at the wrong time.",
        "Using React 18 with the Bun target. The Bun hosting guide requires React 19 or newer.",
        "Expecting a changed `VITE_` value to take effect by only restarting the container. It was baked in at build time; rebuild the image."
      ],
      "sources": [
        { "title": "TanStack Start: Hosting", "url": "https://tanstack.com/start/latest/docs/framework/react/guide/hosting" },
        { "title": "TanStack Start: Environment variables", "url": "https://tanstack.com/start/latest/docs/framework/react/guide/environment-variables" }
      ]
    },
    {
      "id": "docker-compose-local",
      "title": "Docker Compose for local Postgres and Valkey",
      "explanation": "Real apps need other servers: a database and a cache. Docker Compose lets you describe several containers in one file and start them together. The file is called `compose.yaml`, written in YAML (a text format that uses indentation to show nesting). Create it in the repo root, next to the `api/` folder.\n\nThe file has a `services:` section where each entry is one container: a name, the image (or a folder to build), environment variables, and port mappings. Compose also creates a private network and gives every service a hostname equal to its service name. So the API reaches the database at `postgres:5432` and the cache at `valkey:6379`. Inside a container, `localhost` means that container itself, not your machine and not the other containers.\n\nA volume is storage managed by Docker that lives outside any one container. The `pgdata` volume holds the database files, so data survives when you stop and recreate the Postgres container. Without a volume the data goes away with the container.\n\nPostgres is the relational database (Aurora PostgreSQL in production, topic 11). Valkey is an open-source in-memory key-value store used as a cache (ElastiCache for Valkey, AWS's managed Valkey service, in production, topic 14). Locally we use `postgres:17.7` and `valkey/valkey:9.1` to match the same engine versions as production.\n\n`depends_on` makes Compose start `postgres` and `valkey` before `api`. It only waits for the containers to start, not for the database to be ready to accept connections, so a real app must retry its first connection (a later topic).\n\nThe passwords here are for local practice only. Never put production passwords in a file that is committed to git (a version-control tool that stores snapshots of your code).\n\nStart everything with `docker compose up -d` (`-d` runs it in the background). `docker compose down` stops and removes the containers but keeps the volume; adding `-v` also deletes the volume and therefore the data. If another program on your machine already uses port 5432 or 6379, stop it or change the left-hand number in `ports`.",
      "analogy": "A practice stage set: a street of cardboard copies of the real shops (database, cache, API) built close enough to the real ones to rehearse in. The actors (your code) say the same lines on the practice street and on the real one. Nothing you break on the set affects the real street, and you can rebuild the set in a minute.",
      "code": [
        {
          "language": "yaml",
          "filename": "compose.yaml",
          "source": "services:\n  postgres:\n    image: postgres:17.7\n    environment:\n      POSTGRES_USER: shop\n      POSTGRES_PASSWORD: shop\n      POSTGRES_DB: shop\n    ports:\n      - \"5432:5432\"\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n\n  valkey:\n    image: valkey/valkey:9.1\n    ports:\n      - \"6379:6379\"\n\n  api:\n    build: ./api\n    environment:\n      DATABASE_URL: postgres://shop:shop@postgres:5432/shop\n      REDIS_URL: redis://valkey:6379\n    ports:\n      - \"3000:3000\"\n    depends_on:\n      - postgres\n      - valkey\n\nvolumes:\n  pgdata:\n",
          "output": "",
          "explanation": "Three services. `postgres` creates a user, password and database all named `shop`, and stores its files in the `pgdata` volume. `valkey` needs no settings. `api` is built from the `./api` folder and receives the two connection URLs (`DATABASE_URL` and `REDIS_URL`, which use the service names as hostnames). The `ports` lines use the same `host:container` form as `docker run -p`. The last block declares the named volume."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "docker compose up -d\ndocker compose ps --format \"{{.Service}} {{.State}}\"",
          "output": "api running\npostgres running\nvalkey running",
          "explanation": "`up -d` builds the API image if needed, then starts all three containers in the background. `ps` lists them; the `--format` option prints just each service name and its state. The order of the lines can differ on your machine."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "docker compose exec valkey valkey-cli ping",
          "output": "PONG",
          "explanation": "`exec` runs a command inside a running service container. `valkey-cli` is Valkey's command-line client, and `ping` asks the server if it is alive; `PONG` is the reply. Run `docker compose down` when you are done."
        }
      ],
      "productionNote": "Compose is for local development and for CI integration tests that need a real database. In production the same engines run as managed AWS services (Aurora and ElastiCache), and the connection URLs come from configuration instead of the compose file.",
      "commonMistakes": [
        "Using `localhost` inside a container to reach another service. It points back at the same container. Use the service name, such as `postgres` or `valkey`.",
        "Leaving out the volume for Postgres, then losing all data when the container is removed.",
        "Putting production passwords in `compose.yaml` or committing any real secret to git. The `shop` password is for local use only.",
        "Assuming `depends_on` means the database is ready. It only orders the start; the app must retry its connection."
      ],
      "sources": [
        { "title": "Docker docs: Compose application model", "url": "https://docs.docker.com/compose/intro/compose-application-model/" },
        { "title": "Docker Hub: postgres image", "url": "https://hub.docker.com/_/postgres" },
        { "title": "Docker Hub: valkey/valkey image", "url": "https://hub.docker.com/r/valkey/valkey" }
      ]
    },
    {
      "id": "tags-and-dockerignore",
      "title": "Image tags and .dockerignore",
      "explanation": "A tag is a human-readable label attached to an image, written after a colon: `shop-api:1.0.0`. One image can have several tags, and a tag can later be moved to point at a different image. A common production tag is the git SHA, the short fingerprint (for example `3f2a1c9`) of the exact commit, a saved snapshot of your code in git, that the image was built from. It tells you precisely which code is running.\n\nA digest is the image's content ID, a long value that starts with `sha256:`. It is calculated from the image's content, so it can never point at anything else. Deploying by tag is convenient; deploying by digest is exact. In topic 09 you will make the ECR registry immutable so that a tag, once pushed, cannot be moved.\n\nThe build context is the folder whose files Docker may send to the builder (the `api/` in `docker build ... api/`). A `.dockerignore` file in that folder lists files and folders to leave out. Excluding `node_modules`, `.git` and `coverage` (test reports) makes the upload smaller and builds faster. Excluding `.env` (a file of local settings and secrets) keeps secrets out of the image, because `COPY . .` would otherwise include it. Create it as `api/.dockerignore`.\n\nArchitecture: AWS Fargate can run on ARM64 (the Graviton chips, usually cheaper) or on x86_64 (the Intel/AMD kind). An image is built for one architecture. An x86 image started on ARM64 fails with an `exec format error` (the machine cannot run the program's format). `docker buildx build --platform linux/arm64` builds for ARM64 even on an x86 machine, using emulation (the build runs the other chip's instructions in software).`buildx` is Docker's extended build command; `--load` copies the result into your local image list. Emulated builds are slower than native ones.",
      "analogy": "A tag is a sticky label on a moving box: handy, but you can peel it off and stick it on another box. The digest is the serial number stamped into the metal of that box; it cannot be changed and always identifies exactly one box. `.dockerignore` is the \"do not pack\" list you give the movers, so the diary and the old junk never end up in the truck.",
      "code": [
        {
          "language": "text",
          "filename": "api/.dockerignore",
          "source": "node_modules\n.git\n.env\nDockerfile*\n.dockerignore\ncoverage\n",
          "output": "",
          "explanation": "One pattern per line. Docker leaves these out of the build context, so `COPY . .` cannot copy them. `node_modules` is excluded because the Dockerfile installs its own. `Dockerfile*` and `.dockerignore` are build instructions, not part of the app. Docker still reads the Dockerfile itself for the build."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "docker tag shop-api:1.0.0 shop-api:$(git rev-parse --short HEAD)\ndocker images shop-api --format \"{{.Tag}}\"",
          "output": "1.0.0\n3f2a1c9\ndev",
          "explanation": "`git rev-parse --short HEAD` prints the 7-character SHA of the current commit, and `$(...)` pastes that output into the command. `docker tag` adds a second label to the same image; it does not copy it. The listing shows both tags of this image plus `dev`, the image from the earlier build (your SHA will differ, and the lines may appear in a different order). Run this in a folder that is a git repository."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "docker buildx build --platform linux/arm64 --load -t shop-api:arm64 api/",
          "output": "",
          "explanation": "Builds the API image for ARM64 and stores it locally as `shop-api:arm64`. Build progress is printed while it runs. Use this when your ECS tasks run on ARM64, which topic 09 sets up."
        }
      ],
      "productionNote": "The deployment pipeline tags each image with the commit SHA (`${{ github.sha }}` in GitHub Actions, topic 17) and deploys that exact tag, so you can always trace a running container back to its code and roll back to an older SHA. Never deploy `latest`.",
      "commonMistakes": [
        "Letting `.env` be copied into the image. Anyone who can pull the image can read the secrets in it. Always list `.env` in `.dockerignore`.",
        "Deploying `latest` or a moving tag. You cannot tell what is running. Use the git SHA or a version number.",
        "Building an x86_64 image for an ARM64 task (or the reverse). The task fails to start with `exec format error`. Match `--platform` to the task's CPU architecture.",
        "Treating a tag as permanent. A tag can be moved to another image; only the digest is guaranteed to identify the same content."
      ],
      "sources": [
        { "title": "Docker docs: Build context and .dockerignore", "url": "https://docs.docker.com/build/concepts/context/#dockerignore-files" },
        { "title": "Docker docs: docker image tag", "url": "https://docs.docker.com/reference/cli/docker/image/tag/" },
        { "title": "Docker docs: Multi-platform builds", "url": "https://docs.docker.com/build/building/multi-platform/" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "In the API Dockerfile, why do we COPY package.json and bun.lock and run the install before copying the rest of the source?",
      "options": [
        "Docker refuses to copy source code before dependencies exist",
        "The layers up to the install are reused from the cache when only source code changed, so the slow install is skipped",
        "It makes the final image run as the non-root user",
        "It makes the container listen on a different port"
      ],
      "answerIndex": 1,
      "explanation": "Docker reuses a layer when its instruction and everything above it are unchanged. Dependencies change rarely and source changes often, so putting the install first lets most builds skip it. Docker has no such ordering rule, and neither the user nor the port depends on copy order."
    },
    {
      "question": "What does the release stage of the multi-stage Dockerfile leave out, and why does that help when the service scales out?",
      "options": [
        "It leaves out the application code, so containers start before the code downloads",
        "It leaves out the base Bun image, so nothing has to be downloaded",
        "It leaves out the production node_modules, so the image runs without dependencies",
        "It leaves out dev dependencies and test tooling, so the image is smaller and each new task downloads it faster"
      ],
      "answerIndex": 3,
      "explanation": "The release stage copies only production packages and the app files. A smaller image downloads faster when new Fargate tasks start and has fewer packages that can carry known security flaws. The app code and production dependencies are still included."
    },
    {
      "question": "Inside Docker Compose, the api service connects to the database at localhost:5432 and fails. What is the fix?",
      "options": [
        "Connect to postgres:5432, using the service name as the hostname",
        "Change the host port mapping from 5432:5432 to 5433:5432",
        "Add a volume to the api service",
        "Run the api container as root"
      ],
      "answerIndex": 0,
      "explanation": "Inside a container, localhost means that container itself, and the database runs in a different container. Compose makes each service reachable by its service name, so the URL should use postgres. Ports on the host, volumes and the user do not change what localhost means."
    },
    {
      "question": "Why is it dangerous to store a secret API key in a VITE_ environment variable in the web app?",
      "options": [
        "Vite deletes the variable when the server restarts",
        "VITE_ variables can only be read by the database",
        "It is copied into the JavaScript sent to browsers at build time, so anyone can read it",
        "It makes the Docker build run twice"
      ],
      "answerIndex": 2,
      "explanation": "Client variables prefixed with VITE_ are baked into the browser bundle during the build. Anyone who opens the site can read them. Secrets belong in server-side variables read from process.env at run time."
    },
    {
      "question": "A tag and a digest both identify an image. Which one can never change to point at different content?",
      "options": [
        "The tag, because it contains the version number",
        "Both are always permanent",
        "The tag, because Docker stores it inside the image's content",
        "The digest, because it is computed from the image's content"
      ],
      "answerIndex": 3,
      "explanation": "A tag is just a label that can be moved to another image. A digest (sha256:...) is calculated from the content, so it always means exactly one image. That is why immutable tags or digests are used for production deploys."
    }
  ]
});
