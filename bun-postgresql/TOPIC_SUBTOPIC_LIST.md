# Bun + PostgreSQL Learning Path (vBun 1.4.5 + PostgreSQL 19.0)

Version checked: Bun 1.4.5 + PostgreSQL 19.0 on 2026-11-22 via https://github.com/oven-sh/bun/releases + https://www.postgresql.org/support/versioning/
Approved: list ✓ | plans ✓
App: done | App verified: done

| # | Topic | Slug | Sub-topics | Plan | Content | Verified |
|---|-------|------|------------|------|---------|----------|
| 01 | How Backends Work | 01-how-backends-work | What a program is; Bun as a JavaScript/TypeScript runtime; Clients, servers & HTTP requests/responses; JSON as the data format; Running a file with bun run | done | done | done |
| 02 | TypeScript Values & Variables | 02-values-variables | const vs let; Strings, numbers & booleans; Type annotations & inference; Template literals; null & undefined; Printing with console.log | done | done | done |
| 03 | Control Flow & Functions | 03-control-flow-functions | Comparisons & logical operators; if / else & switch; Loops (for, for...of, while); Functions, parameters & return types; Arrow functions | done | done | done |
| 04 | Arrays, Objects & Types | 04-arrays-objects-types | Arrays & array methods (map, filter, find); Objects & property access; Type aliases & interfaces; Optional properties & union types; Destructuring & spread | done | done | done |
| 05 | Errors & Async Code | 05-errors-async | throw, try / catch / finally; Error classes & custom errors; Promises; async / await; Running work in parallel with Promise.all | done | done | done |
| 06 | Modules & Production Folder Structure | 06-modules-folder-structure | import / export (ES modules); package.json & scripts; tsconfig.json essentials; Production folder layout (src/, routes, services, repositories, db, migrations, tests); Entry point & bootstrapping | done | done | done |
| 07 | Configuration & Environment | 07-config-environment | Environment variables (Bun.env / process.env); .env files & Bun's automatic loading; A validated config module (src/config.ts); Secrets & per-environment settings (dev, test, prod) | done | done | done |
| 08 | HTTP Servers with Bun.serve | 08-http-bun-serve | Bun.serve & the fetch handler; Request & Response objects; The routes object & per-method handlers; Path params (req.params) & query strings; JSON bodies, status codes & headers; 404 & fallback handling | done | done | done |
| 09 | Relational Databases & PostgreSQL | 09-relational-postgresql | What a relational database is; Tables, rows & columns; PostgreSQL data types (text, integer, bigint, numeric, boolean, timestamptz, uuid); Primary keys & identity columns; CREATE TABLE, INSERT & SELECT; What NULL means | done | done | done |
| 10 | SQL CRUD Queries | 10-sql-crud | Filtering with WHERE; Sorting & limiting (ORDER BY, LIMIT, OFFSET); UPDATE & DELETE; RETURNING; Pattern matching & date filters | done | done | done |
| 11 | Schema Design & Constraints | 11-schema-constraints | NOT NULL, DEFAULT, UNIQUE & CHECK; Foreign keys & ON DELETE behaviour; One-to-many relationships; Many-to-many with junction tables; Normalization basics | done | done | done |
| 12 | Joins & Aggregation | 12-joins-aggregation | INNER JOIN; LEFT JOIN; Joining several tables & aliases; COUNT, SUM, AVG; GROUP BY & HAVING | done | done | done |
| 13 | Talking to PostgreSQL with Bun.sql | 13-bun-sql | Connecting via DATABASE_URL & the connection pool; Tagged-template queries; Parameters & preventing SQL injection; Typing query results; Helpers: sql(object) inserts & sql([...]) for IN lists; The src/db module & closing connections | done | done | done |
| 14 | Migrations with SQL Files | 14-migrations | Why migrations exist; Numbered .sql migration files; A schema_migrations tracking table; Writing the migration runner in Bun; Seed data | done | done | done |
| 15 | Transactions & Concurrency | 15-transactions-concurrency | ACID & why transactions matter; BEGIN / COMMIT / ROLLBACK; Transactions in Bun.sql (sql.begin) & savepoints; Race conditions & row locks (SELECT ... FOR UPDATE); Isolation levels in practice | done | done | done |
| 16 | Upserts, JSONB & Shaping JSON in SQL | 16-upserts-jsonb | Upserts with INSERT ... ON CONFLICT; JSONB columns & operators; Building API-shaped JSON in SQL (json_build_object, json_agg); Common table expressions (WITH) | done | done | done |
| 17 | Indexes & Query Performance | 17-indexes-performance | How a B-tree index works; Single, composite & unique indexes; Reading EXPLAIN & EXPLAIN ANALYZE; The N+1 query problem; Keyset (cursor) pagination | done | done | done |
| 18 | Layered Architecture | 18-layered-architecture | Routes, services & repositories; Data transfer types (input vs stored vs output); Passing dependencies (db, config) into layers; Building the orders feature end to end | done | done | done |
| 19 | Input Validation & Error Handling | 19-validation-errors | Treating request input as unknown; Hand-written validators & type guards; An application error hierarchy; Mapping errors to HTTP status & one JSON error shape; Translating PostgreSQL errors (e.g. unique violation 23505 → 409) | done | done | done |
| 20 | Authentication & Authorization | 20-auth | Password hashing with Bun.password; Signup & login flows; Session tokens in a sessions table & cookies; JWTs: signing & verifying with HMAC, sessions vs JWT trade-offs; Protecting routes & checking ownership | done | done | done |
| 21 | Logging, Health Checks & Graceful Shutdown | 21-logging-shutdown | Structured JSON logging; Request IDs & request timing; Health & readiness endpoints with a DB check; Handling SIGTERM/SIGINT: server.stop() & closing the pool | done | done | done |
| 22 | Testing with bun:test | 22-testing | test, describe & expect; Unit-testing services with mocks; A separate test database; Integration tests against PostgreSQL (setup & cleanup); Testing HTTP endpoints end to end | done | done | done |
