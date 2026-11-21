# 13. Database Migrations
Version: Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2
Prerequisites: 09-ecs-fargate, 11-aurora-postgresql, 12-rds-proxy

Tool: dbmate (plain SQL files) — learner installs it manually; Docker image `ghcr.io/amacneil/dbmate`. Migrations connect directly to the Aurora cluster (writer) endpoint as shop_admin, not through the proxy (long DDL, session state).

## Learning goals
- Learner can write dbmate migrations with up/down sections and apply them.
- Learner can change a schema with zero downtime using expand/contract.
- Learner can run migrations as a one-off ECS task and check its exit code.
- Learner can choose roll-forward vs rollback.
- Learner can seed dev data without touching prod.

## Sub-topics
### SQL migration files and a migration runner
- Concept: migration = versioned SQL file changing the schema; runner applies pending files in order and records versions in `schema_migrations` (one `version` column). dbmate: dir `./db/migrations`, files `[version]_[description].sql`, sections `-- migrate:up` / `-- migrate:down` (both required), connection from `DATABASE_URL` (format `postgres://user:pass@host:port/db?sslmode=require`; dbmate requires TLS by default for Postgres), commands new/up/migrate/rollback/status/wait; `--wait`, `--no-dump-schema`. Each migration in a transaction by default; `-- migrate:up transaction:false` for e.g. `CREATE INDEX CONCURRENTLY`.
- Analogy: a building's renovation logbook: each numbered page is one change; the foreman checks which pages are already ticked and only does the next ones.
- Code example: `db/migrations/20261122100000_create_orders.sql`: `-- migrate:up` / `CREATE TABLE orders (id uuid PRIMARY KEY, total_cents integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now());` / `-- migrate:down` / `DROP TABLE orders;`. Second: `20261122101000_orders_created_idx.sql`: `-- migrate:up transaction:false` / `CREATE INDEX CONCURRENTLY orders_created_at_idx ON orders (created_at);` / `-- migrate:down` / `DROP INDEX orders_created_at_idx;`. Locally (compose DB): `DATABASE_URL="postgres://shop:shop@localhost:5432/shop?sslmode=disable" dbmate --no-dump-schema up` → lines `Applying: 20261122100000_create_orders.sql` and `Applying: 20261122101000_orders_created_idx.sql` (wording may include timing). `dbmate status` → both marked applied (`[X]`).
- Production use: every schema change ships through the pipeline (topic 17), before the app deploy.
- Common mistakes: editing an already-applied file (only version is tracked — change ignored); CREATE INDEX CONCURRENTLY inside a transaction (fails); missing migrate:down directive.
- Sources: https://github.com/amacneil/dbmate ; https://www.postgresql.org/docs/17/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY

### Expand/contract for zero downtime
- Concept: during rolling deploys old and new app versions run together → schema must work with both. Expand: add (nullable column, new table, new index concurrently) → deploy app writing both → backfill in batches → deploy app reading new → contract: drop old in a later release. Never rename/drop in the same release that stops using it. Big table locks: `ALTER TABLE ... ADD COLUMN` nullable without default is fast; avoid long locks at 250K RPS.
- Analogy: replacing a bridge: build the new bridge next to the old one, send traffic over both, then close the old one once nobody uses it — never blow up the old bridge while cars are on it.
- Code example: rename `customer_email` → `email` in 3 releases: R1 migration `ALTER TABLE orders ADD COLUMN email text;` app writes both columns; backfill `UPDATE orders SET email = customer_email WHERE email IS NULL AND id IN (SELECT id FROM orders WHERE email IS NULL LIMIT 5000);` repeated until `UPDATE 0`; R2 app reads `email` only; R3 migration `ALTER TABLE orders DROP COLUMN customer_email;`. Show psql output `UPDATE 5000` … `UPDATE 0`.
- Production use: all prod schema changes.
- Common mistakes: `ALTER TABLE ... RENAME COLUMN` with old tasks still running (errors); `NOT NULL` + default backfill on huge table in one transaction; dropping before all tasks are on the new version.
- Sources: https://www.postgresql.org/docs/17/sql-altertable.html ; https://www.postgresql.org/docs/17/ddl-alter.html

### Running migrations as a one-off ECS task
- Concept: separate task definition `shop-migrate` (image `ghcr.io/amacneil/dbmate` + migration files baked in via small Dockerfile `FROM ghcr.io/amacneil/dbmate` / `COPY db /db`), run with `aws ecs run-task` in app subnets with an SG allowed to dbSg:5432; DATABASE_URL built in a shell from injected secret fields (secret JSON has username/password/host). CDK generated passwords exclude URL-breaking characters by default, but say "if you set your own password, URL-encode it". Wait for stop, read exit code: 0 = success, else fail pipeline. Assumes the dbmate image has `/bin/sh` (check its Dockerfile); otherwise wrap with a Bun script.
- Analogy: calling in a specialist renovation crew for one job; they arrive, do the logbook pages, and leave — they don't stay as staff.
- Code example: CDK container: `entryPoint: ["/bin/sh", "-c"], command: ["DATABASE_URL=\"postgres://$DB_USER:$DB_PASSWORD@$DB_HOST:5432/shop?sslmode=require\" dbmate --migrations-dir /db/migrations --wait --no-dump-schema up"], secrets: { DB_USER: ecs.Secret.fromSecretsManager(adminSecret, "username"), DB_PASSWORD: ecs.Secret.fromSecretsManager(adminSecret, "password") }, environment: { DB_HOST: cluster.clusterEndpoint.hostname }`. Run: `TASK=$(aws ecs run-task --cluster shop --task-definition shop-migrate --launch-type FARGATE --network-configuration "awsvpcConfiguration={subnets=[subnet-0aaa],securityGroups=[sg-0mig],assignPublicIp=DISABLED}" --query "tasks[0].taskArn" --output text)`; `aws ecs wait tasks-stopped --cluster shop --tasks $TASK`; `aws ecs describe-tasks --cluster shop --tasks $TASK --query "tasks[0].containers[0].exitCode"` → `0`.
- Production use: pipeline step before `cdk deploy` of app (topic 17).
- Common mistakes: running migrations at app startup in every task (120 tasks racing); going through RDS Proxy with long DDL; not checking exit code (pipeline continues after failure).
- Sources: https://docs.aws.amazon.com/cli/latest/reference/ecs/run-task.html ; https://docs.aws.amazon.com/cli/latest/reference/ecs/wait/tasks-stopped.html ; https://github.com/amacneil/dbmate ; https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.ContainerDefinitionOptions.html

### Rollback strategy
- Concept: app rollback is easy (previous image); schema rollback is risky (data loss). Prefer roll-forward: write a new migration fixing the issue. `dbmate rollback` (alias down) reverts the latest one only, use mainly in dev. Expand-only migrations make app rollbacks safe. Last resort: PITR (topic 11).
- Analogy: if you painted a wall the wrong colour, paint over it (roll forward) rather than trying to peel paint off (rollback) — peeling can take the plaster with it.
- Code example: dev: `dbmate rollback` → `Rolling back: 20261122101000_orders_created_idx.sql`; `dbmate status` → that file unchecked `[ ]`. Prod fix-forward file `20261123090000_fix_orders_default.sql` with `ALTER TABLE orders ALTER COLUMN total_cents SET DEFAULT 0;`.
- Production use: incident playbook (topic 23).
- Common mistakes: down migrations that drop data in prod; rolling back app to a version that can't read the new schema; no backup check before risky migration.
- Sources: https://github.com/amacneil/dbmate ; https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-pitr.html

### Seed data per environment
- Concept: seed = sample rows for dev/staging (test products, users). Never in prod migrations. Separate script guarded by APP_ENV; idempotent (`ON CONFLICT DO NOTHING`). Bun: read SQL file and run with `sql.unsafe(text)` (raw SQL, only for trusted files).
- Analogy: stocking a model kitchen with plastic food for a photo shoot — never shipped to the real restaurant.
- Code example: `db/seeds/dev.sql`: `INSERT INTO orders (id, total_cents) VALUES ('00000000-0000-0000-0000-000000000001', 1999) ON CONFLICT (id) DO NOTHING;` `seed.ts`: `import { SQL } from "bun"; if (process.env.APP_ENV === "prod") throw new Error("refusing to seed prod"); const sql = new SQL(process.env.DATABASE_URL!); await sql.unsafe(await Bun.file("db/seeds/dev.sql").text()); const [{ count }] = await sql\`SELECT count(*)::int AS count FROM orders\`; console.log("orders:", count); await sql.close();` On empty dev DB → `orders: 1`; run again → `orders: 1` (idempotent). With APP_ENV=prod → `error: refusing to seed prod`.
- Production use: consistent staging data for k6 tests (topic 20).
- Common mistakes: seeding inside migrations; non-idempotent seeds duplicating rows; real customer data copied to dev.
- Sources: https://bun.com/docs/runtime/sql ; https://www.postgresql.org/docs/17/sql-insert.html#SQL-ON-CONFLICT

## Quiz
1. You edit an already-applied migration file. What does dbmate do on next `up`? — tests version tracking.
2. Why add a nullable column first instead of renaming? — tests expand/contract.
3. Why not run migrations on each app task's startup? — tests one-off task.
4. Pipeline must stop when a migration fails — which value do you check? — tests exit code.
5. Why do `CREATE INDEX CONCURRENTLY` migrations need `transaction:false`? — tests transaction option.
