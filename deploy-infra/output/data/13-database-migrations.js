window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "13-database-migrations",
  "order": 13,
  "title": "Database Migrations",
  "version": "Bun 1.4.5 + Node.js 26.13.1 LTS + AWS CDK 2.278.0 (CLI 2.1149.0) + TanStack Start 1.169.7 + Aurora PostgreSQL 17.7 LTS + ElastiCache Valkey 9.1 + k6 2.4.0 + ADOT Collector 0.51.0 + @opentelemetry/sdk-node 0.301.2",
  "summary": "A database schema (the set of tables and columns your data lives in) changes over time, and every environment must change in the same, repeatable way. You will write versioned SQL migration files with dbmate, change a live schema without downtime using expand/contract (add the new thing first, remove the old thing in a later release), and run migrations as a one-off ECS task (a container run once to completion, with no service keeping it alive) whose exit code gates the pipeline. You will also decide between rolling back and rolling forward, and seed sample data in dev without ever touching prod.",
  "prerequisites": ["09-ecs-fargate", "11-aurora-postgresql", "12-rds-proxy"],
  "subtopics": [
    {
      "id": "sql-migration-files-and-runner",
      "title": "SQL migration files and a migration runner",
      "explanation": "A schema is the structure of your database: which tables exist, which columns each table has, and which indexes (lookup structures that make queries fast) exist. A migration is one versioned file of SQL that changes that structure, for example creating a table. A migration runner is a small program that looks at the migration files, works out which ones have not been applied to this database yet, and applies only those, in order.\n\nThe runner remembers what it has done in a table inside your database called `schema_migrations`. It has one column, `version`, and the runner adds one row per applied migration. Only the version is stored, not the file contents. This design means dev, staging and prod all end up with the same schema because they all run the same files in the same order.\n\nThis course uses dbmate, a runner where migrations are plain SQL files. On Windows, download the dbmate Windows program from the releases page of https://github.com/amacneil/dbmate, rename it to `dbmate.exe`, move it into a folder listed in your PATH, then check it with `dbmate --version` in PowerShell. dbmate looks for files in `./db/migrations`, relative to the folder you run it in. Each file is named `[version]_[description].sql`, for example `20261122100000_create_orders.sql`. The version is a timestamp (year, month, day, hour, minute, second), so files sort in creation order. `dbmate new create_orders` creates an empty file with the correct name and the two section markers.\n\nEvery file has two sections. Under the line `-- migrate:up` you write the change. Under `-- migrate:down` you write SQL that undoes it. Both markers are required; a file missing the `-- migrate:down` line is rejected.\n\ndbmate learns which database to use from the environment variable `DATABASE_URL` (an environment variable is a named value your shell passes to programs, taught earlier). The format is `postgres://user:password@host:port/database?sslmode=require`. The `sslmode` part controls TLS (encryption of the connection). dbmate requires TLS for PostgreSQL by default, so against a local throwaway database you must say `sslmode=disable`, and against Aurora you use `sslmode=require`.\n\nThe commands you need, one line each:\n`dbmate up`: applies all pending migrations and creates the database first if it does not exist.\n`dbmate migrate`: the same, but does not create the database.\n`dbmate status`: lists each migration as applied `[X]` or pending `[ ]`.\n`dbmate rollback`: undoes the latest applied migration.\n`dbmate wait` (or the `--wait` flag on other commands): waits until the database accepts connections.\n`--no-dump-schema`: by default dbmate writes a `db/schema.sql` dump after each change; this flag turns that off, which is what we do in this course.\n\nEach migration runs inside a transaction by default. A transaction is a group of SQL statements that either all succeed or all get undone, so a migration that fails halfway leaves no half-finished change behind. A few statements cannot run inside a transaction. The main one is `CREATE INDEX CONCURRENTLY`, which builds an index without blocking writes to the table (a normal `CREATE INDEX` blocks them while it builds). For these, write `-- migrate:up transaction:false`.",
      "analogy": "Think of a building's renovation logbook. Each numbered page describes one change (add a window, move a wall), and each page also says how to undo it. The foreman reads the log, sees which pages are already ticked off, and only carries out the pages that are not. Nobody can quietly rewrite page 3 after it is ticked, because the foreman only checks the tick, not what the page says. Pages that need a special approach (work done while tenants stay in the building) carry a note saying so, just like `transaction:false`.",
      "code": [
        {
          "language": "yaml",
          "filename": "compose.yaml",
          "source": "services:\n  db:\n    image: postgres:17\n    environment:\n      POSTGRES_USER: shop\n      POSTGRES_PASSWORD: shop\n      POSTGRES_DB: shop\n    ports:\n      - \"5432:5432\"\n",
          "output": "",
          "explanation": "A local PostgreSQL for practice (Docker Compose was taught in the Docker topic). In a new empty folder, save this as `compose.yaml`, open a terminal in that folder and run `docker compose up -d` to start it in the background. The user, password and database are all `shop`, and the database listens on your machine's port 5432."
        },
        {
          "language": "sql",
          "filename": "db/migrations/20261122100000_create_orders.sql",
          "source": "-- migrate:up\nCREATE TABLE orders (\n  id uuid PRIMARY KEY,\n  total_cents integer NOT NULL,\n  created_at timestamptz NOT NULL DEFAULT now()\n);\n\n-- migrate:down\nDROP TABLE orders;\n",
          "output": "",
          "explanation": "Create the folders `db/migrations` in the same folder as `compose.yaml` and save this file there. The up section creates a table `orders` with three columns (`uuid` is a unique-id type, `timestamptz` is a timestamp with time zone, `now()` fills in the current time). The down section removes the table again."
        },
        {
          "language": "sql",
          "filename": "db/migrations/20261122101000_orders_created_idx.sql",
          "source": "-- migrate:up transaction:false\nCREATE INDEX CONCURRENTLY orders_created_at_idx ON orders (created_at);\n\n-- migrate:down\nDROP INDEX orders_created_at_idx;\n",
          "output": "",
          "explanation": "A second file in the same folder. Its later version number makes it run after the first. `transaction:false` is required because `CREATE INDEX CONCURRENTLY` fails inside a transaction. The index speeds up queries that filter or sort by `created_at`."
        },
        {
          "language": "bash",
          "filename": "apply-migrations.sh",
          "source": "export DATABASE_URL=\"postgres://shop:shop@localhost:5432/shop?sslmode=disable\"\ndbmate --no-dump-schema up\ndbmate status",
          "output": "Applying: 20261122100000_create_orders.sql\nApplied: 20261122100000_create_orders.sql in 9ms\nApplying: 20261122101000_orders_created_idx.sql\nApplied: 20261122101000_orders_created_idx.sql in 7ms\n[X] 20261122100000_create_orders.sql\n[X] 20261122101000_orders_created_idx.sql\n\nApplied: 2\nPending: 0",
          "explanation": "Run these lines in the terminal, in the folder that contains `db/`. In PowerShell, set the variable with `$env:DATABASE_URL = \"postgres://shop:shop@localhost:5432/shop?sslmode=disable\"` instead of `export`. `up` prints an `Applying:` line and then an `Applied:` line with the time taken for each pending file (timings vary). `status` shows both files ticked `[X]`. Running `dbmate up` a second time applies nothing, because both versions are already in `schema_migrations`."
        }
      ],
      "productionNote": "In production, every schema change ships as a migration file through the deployment pipeline (built in the CI/CD topic), and it runs before the new app version is deployed, so the schema is ready when the new code starts. Nobody types SQL into a production database by hand, because a hand-typed change is not recorded and the next environment will not get it.",
      "commonMistakes": [
        "Editing a migration file after it has been applied. dbmate stores only the version in `schema_migrations`, so it sees the version as done and silently ignores your edit. Make a new migration instead.",
        "Putting `CREATE INDEX CONCURRENTLY` in a normal migration. Migrations run inside a transaction by default and PostgreSQL rejects this statement there with an error. Add `transaction:false` to the up marker.",
        "Leaving out the `-- migrate:down` marker. dbmate requires both sections, even if the down section only holds a comment or a simple undo.",
        "Forgetting `sslmode`. dbmate requires TLS by default, so a local database without TLS needs `?sslmode=disable`, while Aurora needs `?sslmode=require`."
      ],
      "sources": [
        { "title": "dbmate (README: commands, file format, options)", "url": "https://github.com/amacneil/dbmate" },
        { "title": "PostgreSQL 17: CREATE INDEX (building indexes concurrently)", "url": "https://www.postgresql.org/docs/17/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY" }
      ]
    },
    {
      "id": "expand-contract",
      "title": "Expand/contract for zero downtime",
      "explanation": "During a rolling deployment (taught in the CI/CD topic: new tasks start while old tasks are still running), two versions of your app talk to the same database at the same time. So the schema must work for both the old and the new code at every moment. A change such as renaming a column breaks the old code the instant it runs, because the old code still asks for the old name.\n\nThe fix is a pattern called expand/contract: you split one risky change into safe steps spread over several releases. Expand means you only add things: a new nullable column (a column allowed to be empty), a new table, or a new index built concurrently. Contract means you remove the old thing, but only in a later release, after no running code uses it.\n\nHere is a rename of `customer_email` to `email` on the `orders` table, assuming `customer_email` already exists. Release 1: a migration adds the new column `email`, and the app is changed to write to both columns. Then you backfill, which means copying the old data into the new column for rows written before the change. Release 2: the app reads only `email`. Release 3, later: a migration drops `customer_email`. Never rename or drop in the same release that stops using the old column.\n\nBackfill in small batches, not one giant statement. One huge `UPDATE` on millions of rows runs in a single transaction, holds locks (a lock is a hold that makes other statements wait for the same rows) for a long time, and can stall the live app. A batched `UPDATE` changes at most 5000 rows, and you repeat it until PostgreSQL reports `UPDATE 0`, meaning no rows were left. `psql` is PostgreSQL's command-line client; it prints the number of rows each statement changed.\n\nKnow which schema changes are cheap. `ALTER TABLE ... ADD COLUMN` with a nullable column and no default only changes the table's definition, so it is fast even on a large table. Be careful with changes that rewrite or scan the whole table, or that need a strong lock, because at a high request rate (this course targets 250K requests per second) even a few seconds of waiting queues up a huge number of requests.",
      "analogy": "Replacing a bridge. You build the new bridge next to the old one, then let cars use both. Once you have checked that nobody is still driving on the old one, you close it and tear it down. You never blow up the old bridge while cars are still on it. Adding the column is building the new bridge, the dual writes and backfill are moving traffic across, and dropping the old column is the demolition.",
      "code": [
        {
          "language": "sql",
          "filename": "db/migrations/20261201090000_add_orders_email.sql",
          "source": "-- migrate:up\nALTER TABLE orders ADD COLUMN email text;\n\n-- migrate:down\nALTER TABLE orders DROP COLUMN email;\n",
          "output": "",
          "explanation": "Release 1, expand step. The new column is nullable with no default, so this is a fast, metadata-only change that old app versions do not even notice. After this deploys, the app is changed to write to both `customer_email` and `email`."
        },
        {
          "language": "sql",
          "filename": "backfill.sql",
          "source": "UPDATE orders SET email = customer_email\nWHERE email IS NULL\n  AND id IN (SELECT id FROM orders WHERE email IS NULL LIMIT 5000);",
          "output": "UPDATE 5000\nUPDATE 5000\nUPDATE 2000\nUPDATE 0",
          "explanation": "Backfill, run through `psql` repeatedly (a script or a loop re-runs it). The subquery picks at most 5000 rows that still have no `email`, and the outer statement copies the old value into them. In this example 12,000 rows needed copying, so the counts shrink to 2000 and then `UPDATE 0`, which tells you the backfill is finished. Each run is its own short transaction, so the app is never blocked for long."
        },
        {
          "language": "sql",
          "filename": "db/migrations/20261215090000_drop_orders_customer_email.sql",
          "source": "-- migrate:up\nALTER TABLE orders DROP COLUMN customer_email;\n\n-- migrate:down\nALTER TABLE orders ADD COLUMN customer_email text;\n",
          "output": "",
          "explanation": "Release 3, contract step. It ships only after release 2 (app reads `email` only) is fully deployed and no old task is left running. The down section re-adds the column but cannot restore the dropped data, which is one reason rolling back schema changes is risky (see the rollback sub-topic)."
        }
      ],
      "productionNote": "Apply expand/contract to every production schema change, not just renames: change types, split tables, and add constraints in the same careful steps. Each step is its own release, so any single step can be rolled back by simply redeploying the previous app image. Keep a gap between expand and contract (days, not minutes) so you can still go back if the new code misbehaves.",
      "commonMistakes": [
        "Running `ALTER TABLE ... RENAME COLUMN` while old tasks are still running. The old code asks for the old column name and its queries fail with errors.",
        "Adding a `NOT NULL` column with a value backfilled for every row in one transaction on a huge table. It holds locks for a long time and can stall the whole app. Add it nullable, backfill in batches, then enforce the constraint later.",
        "Dropping the old column before every task is on the new version, including tasks still draining during the deployment.",
        "Treating the backfill as finished without checking for `UPDATE 0`. Rows written by old tasks after you started may still be missing the new value."
      ],
      "sources": [
        { "title": "PostgreSQL 17: ALTER TABLE", "url": "https://www.postgresql.org/docs/17/sql-altertable.html" },
        { "title": "PostgreSQL 17: Modifying tables", "url": "https://www.postgresql.org/docs/17/ddl-alter.html" }
      ]
    },
    {
      "id": "migrations-as-ecs-task",
      "title": "Running migrations as a one-off ECS task",
      "explanation": "On your laptop you ran `dbmate up` yourself. In production nobody should run it by hand, and the app tasks themselves should not run it either. If each app task ran migrations at startup, 120 tasks starting together would race to apply the same files. Instead, run migrations once, as a separate short-lived job, before the new app version is deployed.\n\nIn ECS (taught earlier) a one-off job is a task that is started on its own, runs to completion and stops, with no service keeping it alive. You define a separate task definition named `shop-migrate`. Its image is built from the dbmate image plus your migration files, using a small Dockerfile.\n\nThe task's container reads the database credentials from the cluster's generated secret in Secrets Manager (taught earlier), using `ecs.Secret.fromSecretsManager(secret, \"field\")`, which injects one JSON field of the secret as an environment variable. The command then assembles `DATABASE_URL` in a shell from those pieces. Note that a password placed inside a URL must be URL-encoded (special characters such as `@` and `/` replaced by %-codes so the URL is read correctly) if it contains such characters. CDK's generated passwords exclude characters that break URLs, so this works as written; if you ever set your own password, URL-encode it first.\n\nTwo connection rules matter. First, migrations connect directly to the Aurora cluster (writer) endpoint as `shop_admin`, not through RDS Proxy, because long DDL statements (DDL means statements that change structure, such as `CREATE` and `ALTER`) and session state do not suit a connection pool. Second, the task needs a security group (a virtual firewall, taught earlier) that is allowed to reach the database's security group on port 5432, and it runs in the private app subnets.\n\nAfter the task is started with `aws ecs run-task`, you wait until it stops, then read the exit code of its container. An exit code is the number a program returns when it ends: 0 means success and anything else means failure. The pipeline must stop when it is not 0, otherwise it would deploy new app code onto an unmigrated schema.\n\nThe command overrides the image's entry point with `/bin/sh -c`, which assumes the dbmate image contains a shell at `/bin/sh`. Check the image's Dockerfile in the dbmate repository before relying on it; if a future image has no shell, wrap the call in a small Bun script instead.",
      "analogy": "Calling in a specialist renovation crew for one job. They arrive with the logbook, carry out the pages that are not yet ticked, report whether it all went well, and leave. They do not become permanent staff, and you would never let 120 different tenants each start renovating the same wall at the same moment.",
      "code": [
        {
          "language": "docker",
          "filename": "Dockerfile.migrate",
          "source": "FROM ghcr.io/amacneil/dbmate\nCOPY db /db\n",
          "output": "",
          "explanation": "Builds on the official dbmate image and copies your local `db` folder (the migrations) into the image at `/db`. Because the migration files are baked into the image, the task always runs exactly the files that were in the commit being deployed."
        },
        {
          "language": "typescript",
          "filename": "lib/migrate-stack.ts",
          "source": "import * as cdk from \"aws-cdk-lib\";\nimport * as ec2 from \"aws-cdk-lib/aws-ec2\";\nimport * as ecs from \"aws-cdk-lib/aws-ecs\";\nimport * as rds from \"aws-cdk-lib/aws-rds\";\nimport { Construct } from \"constructs\";\n\ninterface MigrateStackProps extends cdk.StackProps {\n  vpc: ec2.IVpc;\n  db: rds.DatabaseCluster;\n}\n\nexport class MigrateStack extends cdk.Stack {\n  constructor(scope: Construct, id: string, props: MigrateStackProps) {\n    super(scope, id, props);\n\n    const migrateSg = new ec2.SecurityGroup(this, \"MigrateSg\", { vpc: props.vpc });\n    props.db.connections.allowDefaultPortFrom(migrateSg);\n\n    const taskDef = new ecs.FargateTaskDefinition(this, \"MigrateTask\", {\n      family: \"shop-migrate\",\n      cpu: 256,\n      memoryLimitMiB: 512,\n    });\n\n    const adminSecret = props.db.secret!;\n\n    taskDef.addContainer(\"migrate\", {\n      image: ecs.ContainerImage.fromAsset(\".\", { file: \"Dockerfile.migrate\" }),\n      entryPoint: [\"/bin/sh\", \"-c\"],\n      command: [\n        `DATABASE_URL=\"postgres://$DB_USER:$DB_PASSWORD@$DB_HOST:5432/shop?sslmode=require\" dbmate --migrations-dir /db/migrations --wait --no-dump-schema up`,\n      ],\n      secrets: {\n        DB_USER: ecs.Secret.fromSecretsManager(adminSecret, \"username\"),\n        DB_PASSWORD: ecs.Secret.fromSecretsManager(adminSecret, \"password\"),\n      },\n      environment: { DB_HOST: props.db.clusterEndpoint.hostname },\n      logging: ecs.LogDrivers.awsLogs({ streamPrefix: \"migrate\" }),\n    });\n  }\n}\n",
          "output": "",
          "explanation": "A stack that receives the VPC and the Aurora cluster from your other stacks. The security group `migrateSg` is allowed to reach the database on its default port (5432). The task definition has no service: it is only a recipe. The shell command builds `DATABASE_URL` from the injected `DB_USER`, `DB_PASSWORD` and `DB_HOST`, and `clusterEndpoint` is the writer endpoint, so the proxy is bypassed. `--wait` makes dbmate wait for the database to accept connections, and `--migrations-dir /db/migrations` points at the files copied in by the Dockerfile. This assumes the admin secret's user is `shop_admin`, as set up in the Aurora topic."
        },
        {
          "language": "bash",
          "filename": "run-migrate.sh",
          "source": "TASK=$(aws ecs run-task --cluster shop --task-definition shop-migrate --launch-type FARGATE \\\n  --network-configuration \"awsvpcConfiguration={subnets=[subnet-0aaa],securityGroups=[sg-0mig],assignPublicIp=DISABLED}\" \\\n  --query \"tasks[0].taskArn\" --output text)\n\naws ecs wait tasks-stopped --cluster shop --tasks \"$TASK\"\n\naws ecs describe-tasks --cluster shop --tasks \"$TASK\" \\\n  --query \"tasks[0].containers[0].exitCode\"",
          "output": "0",
          "explanation": "Run from a pipeline step or a terminal logged in to the right AWS account. `run-task` starts one task in the given private subnet and security group (replace the placeholder IDs with yours) and prints its ARN, which the `--query` and `--output text` options extract into `$TASK`. `wait tasks-stopped` blocks until the task has stopped. `describe-tasks` then prints the container's exit code; `0` means every migration was applied. In a real pipeline you compare that value with 0 and fail the step if it differs."
        }
      ],
      "productionNote": "This is a pipeline step that runs before the `cdk deploy` of the app stack (wired up in the CI/CD topic). The step must fail the whole pipeline when the exit code is not 0, so a broken migration stops the release before any new app task starts. Read the task's CloudWatch log stream (`migrate` prefix) to see which file failed.",
      "commonMistakes": [
        "Running migrations at app startup in every task. With 120 tasks starting at once they race on the same files, and a slow migration also delays health checks and the whole rollout.",
        "Pointing migrations at RDS Proxy. Long DDL and session state do not fit a connection pool; use the cluster writer endpoint.",
        "Not checking the exit code. `aws ecs run-task` succeeds as soon as the task is started, even if the migration later fails, so a pipeline that does not read the exit code goes on to deploy the app.",
        "Setting your own database password containing characters like `@` or `/` and not URL-encoding it. The URL is then parsed wrongly and the connection fails."
      ],
      "sources": [
        { "title": "AWS CLI: ecs run-task", "url": "https://docs.aws.amazon.com/cli/latest/reference/ecs/run-task.html" },
        { "title": "AWS CLI: ecs wait tasks-stopped", "url": "https://docs.aws.amazon.com/cli/latest/reference/ecs/wait/tasks-stopped.html" },
        { "title": "dbmate", "url": "https://github.com/amacneil/dbmate" }
      ]
    },
    {
      "id": "rollback-strategy",
      "title": "Rollback strategy",
      "explanation": "When a release goes wrong you have two ways out. A rollback goes back to the previous state. A roll-forward keeps moving ahead by shipping a new change that fixes the problem.\n\nFor the app, rollback is easy and safe: redeploy the previous image. For the schema it is risky. A down migration that drops a column or table destroys data that was written since, and that data cannot be brought back by running the up migration again. So the default rule in production is to roll forward: write a new migration (with a new, later version) that corrects the issue, and deploy it through the normal pipeline.\n\n`dbmate rollback` (also called `dbmate down`) undoes only the latest applied migration, one file per call. Use it in dev, where the data is disposable and you are still shaping a migration before anyone else has it.\n\nExpand-only migrations are what make app rollbacks safe. If a release only added a nullable column, the previous app image keeps working against the new schema, so you can redeploy it without touching the database. This is why expand/contract spreads risky removals over later releases.\n\nIf a migration has already damaged data and fixing forward is not possible, the last resort is a point-in-time restore (PITR) of the Aurora cluster to a moment before the change, taught in the Aurora topic. That creates a new cluster and loses everything written after that moment, so it belongs in the incident playbook, not in routine releases.",
      "analogy": "You painted a wall the wrong colour. Rolling forward is painting over it with the right colour. Rolling back is peeling the paint off, which can take the plaster with it, and plaster (your data) does not grow back. Peeling is acceptable only in a practice room where nothing matters.",
      "code": [
        {
          "language": "bash",
          "filename": "dev-rollback.sh",
          "source": "dbmate --no-dump-schema rollback\ndbmate status",
          "output": "Rolling back: 20261122101000_orders_created_idx.sql\nRolled back: 20261122101000_orders_created_idx.sql in 6ms\n[X] 20261122100000_create_orders.sql\n[ ] 20261122101000_orders_created_idx.sql\n\nApplied: 1\nPending: 1",
          "explanation": "Run against the local dev database from the first sub-topic (with `DATABASE_URL` still set). `rollback` prints `Rolling back:` and `Rolled back:` lines (timings vary) and ran the down section of the latest file only, dropping the index. `status` now shows that file as pending `[ ]`, so the next `dbmate up` would apply it again."
        },
        {
          "language": "sql",
          "filename": "db/migrations/20261123090000_fix_orders_default.sql",
          "source": "-- migrate:up\nALTER TABLE orders ALTER COLUMN total_cents SET DEFAULT 0;\n\n-- migrate:down\nALTER TABLE orders ALTER COLUMN total_cents DROP DEFAULT;\n",
          "output": "",
          "explanation": "A production-style fix-forward: instead of reverting an earlier migration, you add a new one with a later version that corrects the schema. The change is small, safe and goes through the same pipeline as any other. The down section only removes the default, so it loses no data."
        }
      ],
      "productionNote": "Write the roll-forward-first policy into the incident playbook (built in the cost and operations topic): redeploy the previous app image for app bugs, ship a fix-forward migration for schema bugs, and consider PITR only when data is damaged. Before any risky migration, confirm that a recent automated backup or snapshot exists.",
      "commonMistakes": [
        "Writing down migrations that drop columns or tables holding real data and then running them in prod. The data is gone for good.",
        "Rolling the app back to a version that cannot read the new schema, for example after a contract step already removed a column the old version needs.",
        "Running a risky migration without first checking that a recent backup or snapshot exists.",
        "Using `dbmate rollback` against production as routine practice. It reverts one file at a time and bypasses the review and pipeline that a fix-forward gets."
      ],
      "sources": [
        { "title": "dbmate", "url": "https://github.com/amacneil/dbmate" },
        { "title": "Aurora: restoring a cluster to a point in time", "url": "https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-pitr.html" }
      ]
    },
    {
      "id": "seed-data",
      "title": "Seed data per environment",
      "explanation": "Seed data means sample rows (test products, fake users, example orders) put into a database so developers and tests have something to work with. It belongs in dev and staging. It must never be inserted into production.\n\nThat is why seeds do not live in migrations. Migrations run in every environment, including prod, so a seed inside a migration would put fake rows into the real database. Keep seeds in their own files, such as `db/seeds/dev.sql`, and load them with a separate script that you run on purpose.\n\nTwo safety rules make a seed script trustworthy. First, guard it with an environment variable such as `APP_ENV` (the environment name taught in the first topic) and refuse to run when it says `prod`. Second, make it idempotent, meaning running it twice gives the same result as running it once. In PostgreSQL you do this with `INSERT ... ON CONFLICT (id) DO NOTHING`: if a row with that `id` already exists, the insert is skipped instead of failing or duplicating.\n\nThe script below uses Bun's built-in SQL client (taught in the Aurora topic). It reads the SQL file as text and runs it with `sql.unsafe(text)`. `unsafe` means the text is sent to the database as raw SQL without the safe parameter handling of the tagged-template form, so use it only for files you wrote and trust, never for text that comes from a user.\n\nNever copy real customer data into dev or staging to use as a seed. It leaks personal data into less protected environments. Write fake rows instead.",
      "analogy": "Stocking a model kitchen with plastic food for a photo shoot. It makes the set look real and lets everyone practice with it, but you would never ship the plastic food to the real restaurant. The guard in the script is the sign on the restaurant door that says plastic food is not allowed here.",
      "code": [
        {
          "language": "sql",
          "filename": "db/seeds/dev.sql",
          "source": "INSERT INTO orders (id, total_cents)\nVALUES ('00000000-0000-0000-0000-000000000001', 1999)\nON CONFLICT (id) DO NOTHING;\n",
          "output": "",
          "explanation": "Inserts one sample order with a fixed id. The fixed id is what lets `ON CONFLICT (id) DO NOTHING` recognise the row on a second run and skip it. This assumes the `orders` table from the first sub-topic already exists, so run `dbmate up` first."
        },
        {
          "language": "typescript",
          "filename": "seed.ts",
          "source": "import { SQL } from \"bun\";\n\nif (process.env.APP_ENV === \"prod\") {\n  throw new Error(\"refusing to seed prod\");\n}\n\nconst sql = new SQL(process.env.DATABASE_URL!);\n\nawait sql.unsafe(await Bun.file(\"db/seeds/dev.sql\").text());\n\nconst [{ count }] = await sql`SELECT count(*)::int AS count FROM orders`;\nconsole.log(\"orders:\", count);\n\nawait sql.close();\n",
          "output": "orders: 1",
          "explanation": "Save as `seed.ts` next to the `db` folder. The first lines refuse to run when `APP_ENV` is `prod`: Bun then prints `error: refusing to seed prod` followed by a stack trace and exits with a non-zero code, and nothing is inserted. Otherwise it connects with `DATABASE_URL`, reads the seed file with `Bun.file(...).text()`, and runs it. `count(*)::int` makes PostgreSQL return a plain number instead of a string. `sql.close()` ends the connection so the script can exit."
        },
        {
          "language": "bash",
          "filename": "run-seed.sh",
          "source": "export DATABASE_URL=\"postgres://shop:shop@localhost:5432/shop\"\nexport APP_ENV=dev\nbun seed.ts\nbun seed.ts",
          "output": "orders: 1\norders: 1",
          "explanation": "Run on an empty dev database after `dbmate up`. The URL has no `sslmode` because Bun's SQL client does not use TLS unless you ask for it, which suits the local database. The second run prints the same `orders: 1`, which proves the seed is idempotent. Setting `APP_ENV=prod` instead would stop the script at the guard."
        }
      ],
      "productionNote": "Seeding gives staging the same known rows every time, so load tests in the load-testing topic produce comparable results from run to run. Run the seed script only from a dev or staging pipeline job, and keep the `APP_ENV` guard even there, because a guard that depends on someone remembering is not a guard.",
      "commonMistakes": [
        "Putting seed inserts inside migrations. Migrations run in every environment, including prod, so fake rows end up in the real database.",
        "Writing seeds that are not idempotent. Without `ON CONFLICT DO NOTHING` (or similar), every run duplicates or errors on the same rows.",
        "Copying real customer data into dev or staging as seed data, which spreads personal data into less protected systems.",
        "Passing text that comes from users to `sql.unsafe`. It sends raw SQL, so only use it for trusted files that you control."
      ],
      "sources": [
        { "title": "Bun: SQL client", "url": "https://bun.com/docs/runtime/sql" },
        { "title": "PostgreSQL 17: INSERT (ON CONFLICT clause)", "url": "https://www.postgresql.org/docs/17/sql-insert.html#SQL-ON-CONFLICT" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "You edit a migration file that has already been applied to the database, then run `dbmate up`. What happens?",
      "options": [
        "dbmate re-applies the edited file and updates the schema",
        "dbmate ignores the edit, because only the file's version is recorded as applied",
        "dbmate compares file contents and stops with a checksum error",
        "dbmate deletes the database and recreates it from the files"
      ],
      "answerIndex": 1,
      "explanation": "dbmate records only the version in `schema_migrations`. An already-applied version is skipped, so the edit has no effect. To change the schema, add a new migration."
    },
    {
      "question": "To rename a column with zero downtime, why do you first add a new nullable column instead of just renaming the old one?",
      "options": [
        "Renaming is not valid SQL in PostgreSQL",
        "Nullable columns are faster to read than renamed ones",
        "Old and new app versions run together during a rolling deploy, and a rename would break the old version immediately",
        "dbmate cannot run a rename migration"
      ],
      "answerIndex": 2,
      "explanation": "During a rolling deployment both app versions use the same schema. Expand/contract keeps both working: add the new column, write both, backfill, switch reads, and drop the old column in a later release."
    },
    {
      "question": "Why should migrations not run at the startup of every app task?",
      "options": [
        "Many tasks starting at once race to apply the same migrations, and a slow migration delays health checks and the rollout",
        "Containers are not allowed to connect to a database",
        "dbmate only works when run from a laptop",
        "Migrations would run in the wrong order because task names are random"
      ],
      "answerIndex": 0,
      "explanation": "With 120 tasks starting together, they all try to migrate at once. Run migrations once, as a separate one-off ECS task, before the app deploy."
    },
    {
      "question": "The pipeline must stop if the migration task fails. Which value do you check after `aws ecs wait tasks-stopped`?",
      "options": [
        "The task ARN printed by `run-task`",
        "Whether `aws ecs run-task` itself returned without an error",
        "The number of subnets in the network configuration",
        "The container's exit code from `describe-tasks`, which must be 0"
      ],
      "answerIndex": 3,
      "explanation": "`run-task` succeeds as soon as the task starts, even if the migration fails later. Only the container's exit code (0 = success) tells you the result."
    },
    {
      "question": "Why does a `CREATE INDEX CONCURRENTLY` migration need `-- migrate:up transaction:false`?",
      "options": [
        "Because the statement cannot run inside a transaction, and dbmate wraps each migration in one by default",
        "Because indexes can only be created by the database administrator",
        "Because without it dbmate skips the down section",
        "Because transactions are slower than concurrent statements"
      ],
      "answerIndex": 0,
      "explanation": "PostgreSQL rejects `CREATE INDEX CONCURRENTLY` inside a transaction block. The `transaction:false` option makes dbmate run the file without wrapping it in one."
    }
  ]
});
