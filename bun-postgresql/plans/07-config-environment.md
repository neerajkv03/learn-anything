# 07. Configuration & Environment
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 06-modules-folder-structure

## Learning goals
- Learner can read environment variables with `Bun.env` / `process.env` and knows they are always strings or `undefined`.
- Learner can use `.env` files and knows Bun's automatic load order.
- Learner can write `src/config.ts` that validates env once at startup and exports a typed, frozen config.
- Learner can keep secrets out of git and separate dev, test and prod settings.

## Sub-topics
### Environment variables (Bun.env / process.env)
- Concept: environment variable = named text setting given to a program by its surroundings (terminal, server, CI), not written in code. `Bun.env`, `process.env`, `import.meta.env` are aliases of the same object (version notes). Values are `string | undefined` — numbers must be converted. Set inline: `PORT=4000 bun src/index.ts` (macOS/Linux shells; on Windows PowerShell `$env:PORT=4000; bun src/index.ts`).
- Analogy: thermostat settings in a rented flat — same heater (code) in every flat, each tenant (environment) sets their own temperature without rewiring the heater.
- Code example: `env-demo.ts` — `const port = Number(Bun.env.PORT ?? "3000"); console.log(typeof Bun.env.PORT, port);` run `PORT=4000 bun env-demo.ts` → `string 4000`; run `bun env-demo.ts` (PORT unset, no .env) → `undefined 3000`.
- Production use: DATABASE_URL, PORT, secrets differ per deployment.
- Common mistakes: treating `Bun.env.PORT` as a number; reading env all over the codebase instead of one config module.
- Sources: https://bun.com/docs/runtime/env ; https://nodejs.org/api/process.html#processenv

### .env files & Bun's automatic loading
- Concept: `.env` = text file `KEY=value` per line, auto-loaded by Bun (no library). Load order, rising precedence: `.env` → `.env.{development|production|test}` (by NODE_ENV) → `.env.local` (skipped when NODE_ENV=test) → `.env.{mode}.local`. State only this documented order (do not claim how shell-set vars interact). `--env-file=path` overrides which files load; `--no-env-file` / bunfig `env = false` disables (1.4). `bun test` auto-loads `.env.test`. Commit `.env.example` (keys, fake values); never commit `.env`/`.env.local` (add to `.gitignore`).
- Analogy: layered clothing — base layer `.env`, then a jacket for the weather (`.env.test`/`.env.production`), then your personal scarf (`.env.local`); the outer layer is what people see.
- Code example: `.env`: `PORT=3000` / `DATABASE_URL=postgres://app:app_password@localhost:5432/orders_dev` / `JWT_SECRET=dev-only-secret-change-me-0123456789abcdef`; `.env.test`: `NODE_ENV=test` / `DATABASE_URL=postgres://app:app_password@localhost:5432/orders_test`; `.gitignore` lines `.env`, `.env.local`, `.env.*.local`. `console.log(Bun.env.DATABASE_URL)` in a script run with `bun` → `postgres://app:app_password@localhost:5432/orders_dev`.
- Production use: local dev uses .env; production platforms inject real env vars.
- Common mistakes: committing `.env` with secrets; quoting/spacing errors (`PORT = 3000`); expecting `.env.local` in tests.
- Sources: https://bun.com/docs/runtime/env ; https://bun.com/docs/test/configuration

### A validated config module (src/config.ts)
- Concept: read env once, validate, convert types, export a typed frozen object; throw at startup with a clear message listing every problem (fail fast). Helpers `required(name)`, `int(name, default)`; NODE_ENV literal union `"development" | "test" | "production"`. `Object.freeze`. `loadConfig(env)` function takes env as argument (testable), plus exported `config = loadConfig(Bun.env)`.
- Analogy: pre-flight checklist — pilot checks fuel, flaps, radio before takeoff; any missing item = no takeoff, rather than discovering it mid-air.
- Code example: `src/config.ts` — `export type AppEnv = "development" | "test" | "production"; export type Config = { env: AppEnv; port: number; databaseUrl: string; jwtSecret: string; logLevel: "debug" | "info" | "warn" | "error" };` `export function loadConfig(env: Record<string, string | undefined>): Config { const problems: string[] = []; const nodeEnv = env.NODE_ENV ?? "development"; if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") problems.push("NODE_ENV must be development, test or production"); const port = Number(env.PORT ?? "3000"); if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push("PORT must be an integer 1-65535"); const databaseUrl = env.DATABASE_URL ?? ""; if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) problems.push("DATABASE_URL must be a postgres:// URL"); const jwtSecret = env.JWT_SECRET ?? ""; if (jwtSecret.length < 32) problems.push("JWT_SECRET must be at least 32 characters"); ...logLevel default "info"... if (problems.length > 0) throw new Error(\`Invalid config:\n- ${problems.join("\n- ")}\`); return Object.freeze({ ... }); } export const config = loadConfig(Bun.env);` Demo: `loadConfig({ PORT: "abc" })` → throws `Invalid config:` + lines `- PORT must be an integer 1-65535` / `- DATABASE_URL must be a postgres:// URL` / `- JWT_SECRET must be at least 32 characters`. Author must keep logLevel check consistent and the expected message order matching code order.
- Production use: imported by index.ts, db.ts, logger.ts; never read Bun.env elsewhere.
- Common mistakes: defaults for secrets (silent insecure prod); validating lazily mid-request; printing whole config (leaks secrets).
- Sources: https://bun.com/docs/runtime/env ; https://12factor.net/config ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze

### Secrets & per-environment settings (dev, test, prod)
- Concept: secret = value that grants access (DB password, JWT signing secret). Rules: never in code or git, never logged, different per environment, long and random (generate e.g. `crypto.getRandomValues` → hex; show one-liner `bun -e 'console.log(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex"))'` → 64 hex chars). Dev vs test vs prod: separate databases (`orders_dev`, `orders_test`), prod values injected by hosting platform. `development` mode of Bun.serve turns off with NODE_ENV=production (topic 08).
- Analogy: house keys — each tenant gets their own key, you don't tape a copy to the front door (git), and you don't read your key code aloud on the phone (logs).
- Code example: `scripts/gen-secret.ts` — `const bytes = crypto.getRandomValues(new Uint8Array(32)); console.log(Buffer.from(bytes).toString("hex").length);` → `64` (value itself random; only length is predictable).
- Production use: rotating secrets; tests never touch dev/prod DB.
- Common mistakes: same secret everywhere; running tests against the dev database (wipes data).
- Sources: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues ; https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html

## Quiz
1. What type is `Bun.env.PORT` and how to get a number? — tests env basics
2. Which file does `bun test` load automatically, and which is skipped? (`.env.test`; `.env.local`) — tests load order
3. Why throw at startup instead of defaulting JWT_SECRET? — tests fail-fast config
4. Which files go into git: `.env`, `.env.example`? — tests secrets hygiene
5. Why separate `orders_test` from `orders_dev`? — tests per-environment settings
