# 06. Modules & Production Folder Structure
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 05-errors-async

## Learning goals
- Learner can split code across files with named `import` / `export` and `import type`.
- Learner can read a `package.json` and run its scripts with `bun run`.
- Learner can explain the key `tsconfig.json` options Bun's `bun init` writes.
- Learner can lay out the course project `orders-api/` and say what belongs in each folder.
- Learner can write an entry point that bootstraps the app and knows `import.meta.main`.

## Course project layout (through-line; every later topic adds files here)
```
orders-api/
├── package.json  tsconfig.json  bunfig.toml
├── .env  .env.example  .env.test        (topic 07)
├── migrations/0001_create_users.sql ... (topic 14)
├── scripts/migrate.ts  scripts/seed.ts  (topic 14)
├── src/
│   ├── index.ts        entry point: load config, connect db, start server, handle shutdown
│   ├── server.ts       createServer(deps) → Bun.serve (topic 08)
│   ├── config.ts       validated env (topic 07)
│   ├── db.ts           Bun.sql client (topic 13)
│   ├── logger.ts       JSON logger (topic 21)
│   ├── errors.ts       AppError hierarchy (topic 19)
│   ├── http.ts         json()/error response helpers (topics 08, 19)
│   ├── types/          shared types: order.ts, user.ts
│   ├── routes/         HTTP layer: orders.routes.ts, users.routes.ts, auth.routes.ts, health.routes.ts
│   ├── services/       business rules: orders.service.ts, auth.service.ts
│   ├── repositories/   SQL only: orders.repo.ts, users.repo.ts, sessions.repo.ts
│   └── validation/     input validators: orders.validation.ts (topic 19)
└── tests/  unit/  integration/  helpers/  (topic 22)
```

## Sub-topics
### import / export (ES modules)
- Concept: module = one file with its own scope; `export` makes a name visible, `import { name } from "./file"` uses it. Named exports only (course convention; no default exports — easier refactors/search). Relative paths `./` `../`; Bun resolves `.ts` without extension. `import type { Order } from "./types/order"` for type-only imports — required because bun init sets `verbatimModuleSyntax: true` (type-only names imported normally → editor error). Built-in modules: `"bun"`, `"bun:test"`, `"node:crypto"`.
- Analogy: departments in a company building — each office (file) keeps its papers private; `export` = putting a document in the shared outbox, `import` = requesting it by name and office number (path). `import type` = asking only for the form template, not the filled paperwork.
- Code example: two files — `src/types/order.ts`: `export type OrderStatus = "pending" | "paid" | "shipped" | "cancelled"; export type Order = { id: string; status: OrderStatus; totalCents: number };` and `src/money.ts`: `export function formatCents(cents: number): string { return \`$${(cents / 100).toFixed(2)}\`; }`; `src/demo.ts`: `import type { Order } from "./types/order"; import { formatCents } from "./money"; const o: Order = { id: "101", status: "paid", totalCents: 4998 }; console.log(\`${o.id}: ${formatCents(o.totalCents)}\`);` → `101: $49.98`.
- Production use: every layer file exports functions/types used by the next layer.
- Common mistakes: circular imports between layers (repo importing service); importing a type without `import type`; wrong relative path depth.
- Sources: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules ; https://bun.com/docs/runtime/module-resolution ; https://www.typescriptlang.org/tsconfig/#verbatimModuleSyntax

### package.json & scripts
- Concept: `package.json` = project ID card: `name`, `"type": "module"`, `"private": true`, `scripts`, `devDependencies` (`@types/bun` from bun init: gives editor types for Bun APIs). Scripts are named shortcuts: `bun run dev`. No extra runtime dependencies in this course (Bun.serve, Bun.sql, Bun.password, bun:test are built in). No install steps covered.
- Analogy: TV remote presets — instead of typing a long channel number, press button "dev" or "test".
- Code example: `package.json` — `{ "name": "orders-api", "type": "module", "private": true, "scripts": { "dev": "bun --watch src/index.ts", "start": "bun src/index.ts", "migrate": "bun scripts/migrate.ts", "seed": "bun scripts/seed.ts", "test": "bun test" }, "devDependencies": { "@types/bun": "latest" } }`. Running `bun run start` = `bun src/index.ts`. Mention `bun run` with no args lists scripts. Note: `"latest"` as written by bun init; production teams pin exact versions.
- Production use: CI and teammates run the same commands.
- Common mistakes: script name typo (`bun run strat` → error script not found); hard-coding secrets in scripts.
- Sources: https://bun.com/docs/cli/run ; https://docs.npmjs.com/cli/v11/configuring-npm/package-json

### tsconfig.json essentials
- Concept: tells editor/TypeScript how to check code (Bun itself only strips types). bun init defaults (per version notes): `strict: true` (null-safety etc.), `module: "Preserve"`, `moduleResolution: "bundler"`, `noEmit: true` (no JS output; Bun runs .ts), `allowImportingTsExtensions: true`, `verbatimModuleSyntax: true`, `target`/`lib`: `ESNext`. Add `noUncheckedIndexedAccess: true` (makes `rows[0]` typed `T | undefined` — catches "no row found" bugs). bun init 1.4 writes TS7-compatible config.
- Analogy: house rules posted for the building inspector — the inspector (TypeScript) checks against them; the movers (Bun) don't read them.
- Code example: `tsconfig.json` — `{ "compilerOptions": { "lib": ["ESNext"], "target": "ESNext", "module": "Preserve", "moduleResolution": "bundler", "allowImportingTsExtensions": true, "verbatimModuleSyntax": true, "noEmit": true, "strict": true, "skipLibCheck": true, "noUncheckedIndexedAccess": true, "noFallthroughCasesInSwitch": true } }`; demo: with `noUncheckedIndexedAccess`, `const rows: Order[] = []; const first = rows[0]; first.id` → editor error `'first' is possibly 'undefined'.`
- Production use: strict settings catch null bugs before deploy.
- Common mistakes: turning off `strict` to silence errors; expecting tsconfig to change how Bun runs code.
- Sources: https://bun.com/docs/runtime/typescript ; https://www.typescriptlang.org/tsconfig/#strict ; https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess

### Production folder layout (src/, routes, services, repositories, db, migrations, tests)
- Concept: walk the layout tree above. Rule: dependencies point one way — routes → services → repositories → db. routes = HTTP in/out only; services = business rules, no SQL, no Request objects; repositories = SQL only; db.ts = one shared client; migrations = schema history as .sql; scripts = one-off commands; tests mirror src. Filename convention `<feature>.<layer>.ts`. Grows topic by topic (show which topic adds which file).
- Analogy: restaurant — waiters (routes) take orders and serve plates, chefs (services) decide how dishes are made, pantry staff (repositories) fetch ingredients from the storeroom (database); a waiter never walks into the storeroom.
- Code example: tree above + import-direction snippet: `src/routes/orders.routes.ts` has `import { listOrders } from "../services/orders.service";`; `src/services/orders.service.ts` has `import { findOrders } from "../repositories/orders.repo";`; only `src/server.ts` imports routes. No output (structure only); state "nothing runs yet".
- Production use: teams find code fast; layers testable in isolation (topic 22).
- Common mistakes: SQL inside route handlers; service reading `Request`; one giant `index.ts`.
- Sources: https://bun.com/docs/runtime/module-resolution ; https://bun.com/docs/cli/init

### Entry point & bootstrapping
- Concept: entry point `src/index.ts` = only file that has side effects at startup: read config → create db client → create server → register shutdown. Other modules only export. `import.meta.main` true when the file is run directly (lets a file be both script and importable). Top-level `await` allowed. Fail fast: if startup throws, print and exit with `process.exit(1)` (gloss exit code: 0 ok, non-zero failure). Forward pointers to 07/13/21.
- Analogy: opening shift at a shop — manager unlocks door, checks the till (config), turns on fridges (db), opens shutters (server), in a fixed order; if the till is missing, shop stays closed.
- Code example: `src/index.ts` (early version) — `import { formatCents } from "./money"; async function main(): Promise<void> { console.log("starting orders-api"); console.log("sample price", formatCents(2499)); } if (import.meta.main) { main().catch((err) => { console.error("startup failed", err); process.exit(1); }); }` run `bun run start` → `starting orders-api` / `sample price $24.99`.
- Production use: same shape grows into real bootstrap (topic 21 final version).
- Common mistakes: side effects (connecting DB) at import time in library modules; swallowing startup errors and running half-configured.
- Sources: https://bun.com/docs/runtime/module-resolution ; https://nodejs.org/api/process.html#processexitcode

## Quiz
1. Why must `Order` be imported with `import type`? — tests verbatimModuleSyntax
2. What does `bun run test` execute in the given package.json? — tests scripts
3. With `noUncheckedIndexedAccess`, what type does `rows[0]` have? — tests tsconfig
4. A route handler contains a SQL query — which layer should own it? — tests layering
5. What does `import.meta.main` tell you? — tests entry point
