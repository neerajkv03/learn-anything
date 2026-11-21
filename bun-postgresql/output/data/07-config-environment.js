window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "07-config-environment",
  "order": 7,
  "title": "Configuration & Environment",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Learn how a program receives settings such as the port number and the database address from outside the code, using environment variables and .env files. You will build one validated, frozen config module that stops the app at startup when a setting is wrong, and you will learn how to keep secrets out of git and separate dev, test and production.",
  "prerequisites": ["06-modules-folder-structure"],
  "subtopics": [
    {
      "id": "environment-variables",
      "title": "Environment variables (Bun.env / process.env)",
      "explanation": "Some values must not be written inside your code, because they change from one computer to the next: the port number the server listens on, the address of the database, a password. A program receives such values from its surroundings, and these named text settings are called environment variables. The surroundings can be your terminal, a hosting server, or a CI system (CI = continuous integration, an automated machine that builds and tests your code on every change).\n\nIn Bun you read them from an object (a bundle of named values) called `Bun.env`. `process.env` and `import.meta.env` are two other names for the very same object (aliases), so use whichever you like. In this course we read `Bun.env`, and later only inside one config module.\n\nEvery value in `Bun.env` is either a string or `undefined` (meaning: the variable is not set). Even if you set `PORT=4000`, you get the text `\"4000\"`, not the number 4000. So the type of `Bun.env.PORT` is `string | undefined`, and you must convert it yourself with `Number(...)`. The `??` operator supplies a default when the left side is `undefined`.\n\nTo set a variable for one run, put it in front of the command in the shell (the program that reads the commands you type in the terminal). On macOS and Linux write `PORT=4000 bun env-demo.ts`. In Windows PowerShell write `$env:PORT=\"4000\"; bun env-demo.ts`; that variable stays set in that PowerShell window until you remove it with `Remove-Item Env:PORT`.\n\nTo try it, create a file called `env-demo.ts` in your project folder (the folder that contains `package.json`) and open a terminal in that same folder.",
      "analogy": "Think of thermostat settings in rented flats. The heater (your code) is identical in every flat, but each tenant (each environment: your laptop, the test machine, the production server) sets their own temperature without rewiring the heater. If the tenant sets nothing, the heater uses its factory default, like the `?? \"3000\"` fallback.",
      "code": [
        {
          "language": "typescript",
          "filename": "env-demo.ts",
          "source": "const port = Number(Bun.env.PORT ?? \"3000\");\nconsole.log(typeof Bun.env.PORT, port);",
          "output": "undefined 3000",
          "explanation": "This is the output when PORT is not set anywhere (and no .env file exists yet): `typeof` reports `\"undefined\"`, and the default \"3000\" is converted to the number 3000."
        },
        {
          "language": "bash",
          "filename": "terminal (macOS / Linux)",
          "source": "PORT=4000 bun env-demo.ts",
          "output": "string 4000",
          "explanation": "The variable is set for this one command only. `typeof` shows `string`, because environment values are always text, and `Number(...)` turned it into the number 4000."
        },
        {
          "language": "powershell",
          "filename": "terminal (Windows PowerShell)",
          "source": "$env:PORT=\"4000\"; bun env-demo.ts",
          "output": "string 4000",
          "explanation": "The same run on Windows. Remember to clear the variable afterwards with `Remove-Item Env:PORT`, otherwise it stays set in this window."
        }
      ],
      "productionNote": "In production, values such as DATABASE_URL, PORT and secrets are different on every deployment (laptop, test server, production server). The code stays identical and only the environment changes. This is the idea of the Twelve-Factor App method: keep config in the environment, not in the code.",
      "commonMistakes": [
        "Treating `Bun.env.PORT` as a number. It is a string or `undefined`, so `Bun.env.PORT + 1` gives `\"40001\"` (text joined together), not 4001. Convert with `Number(...)` first.",
        "Reading `Bun.env` all over the codebase. Then nobody knows which settings the app needs, and a typo like `Bun.env.DATABSE_URL` silently gives `undefined`. Read the environment in one config module (you build it in sub-topic 3).",
        "Forgetting that the PowerShell `$env:PORT=\"4000\"` setting persists in that window and then wondering why a later run still uses port 4000."
      ],
      "sources": [
        { "title": "Bun docs: Environment variables", "url": "https://bun.com/docs/runtime/env" },
        { "title": "Node.js docs: process.env", "url": "https://nodejs.org/api/process.html#processenv" }
      ]
    },
    {
      "id": "env-files",
      "title": ".env files & Bun's automatic loading",
      "explanation": "Typing `PORT=4000 DATABASE_URL=... JWT_SECRET=... bun ...` before every run would be miserable. A `.env` file solves this: it is a plain text file with one `KEY=value` pair per line. Bun reads it automatically when you run a file with `bun`, so no library is needed. The file lives in the project root, the folder where you run your commands.\n\nWrite each line as `KEY=value` with no spaces around the `=`. `PORT = 3000` is a classic mistake. Quotes around the value are not needed for simple values.\n\nBun can load several files. It chooses them by the value of `NODE_ENV` (a variable by which programs name their mode: `development`, `production` or `test`). Files are loaded in this order, and a later file wins over an earlier one for the same key: first `.env`, then `.env.development`, `.env.production` or `.env.test` (matching NODE_ENV), then `.env.local`, then `.env.development.local` / `.env.production.local` / `.env.test.local`. One special rule: `.env.local` is skipped when NODE_ENV is `test`, so every test run behaves the same on every machine.\n\n`bun test` (the command that runs your automated tests, covered in a later topic) automatically loads `.env.test`. You can also choose files yourself with `--env-file=path`, which replaces the automatic choice. Since Bun 1.4 you can switch automatic loading off completely with `--no-env-file` or by writing `env = false` in `bunfig.toml` (Bun's own settings file). An explicit `--env-file` still works in that case.\n\nSecrets and git: git is the tool that records the history of your project files, and `.gitignore` is a file listing what git must never record. Real `.env` files hold passwords, so they must be listed in `.gitignore`. Instead you commit a file named `.env.example` that lists the keys with fake values, so a new teammate knows what to create.",
      "analogy": "Layered clothing. The base layer is `.env`. On top you add a jacket that suits the weather (`.env.test` or `.env.production`). Finally comes your personal scarf (`.env.local`). When two layers cover the same spot, the outer layer is what people see, so a value in `.env.local` beats the same key in `.env`. In test weather the scarf stays at home.",
      "code": [
        {
          "language": "bash",
          "filename": ".env",
          "source": "PORT=3000\nDATABASE_URL=postgres://app:app_password@localhost:5432/orders_dev\nJWT_SECRET=dev-only-secret-change-me-0123456789abcdef",
          "output": "",
          "explanation": "The development settings, one KEY=value per line, with no spaces around `=`. The database name `orders_dev` marks this as the development database. The secret is clearly fake and only for local use."
        },
        {
          "language": "bash",
          "filename": ".env.test",
          "source": "NODE_ENV=test\nDATABASE_URL=postgres://app:app_password@localhost:5432/orders_test",
          "output": "",
          "explanation": "Loaded on top of `.env` when NODE_ENV is `test`. It overrides DATABASE_URL so tests use `orders_test`; PORT and JWT_SECRET still come from `.env`."
        },
        {
          "language": "bash",
          "filename": ".gitignore",
          "source": ".env\n.env.local\n.env.*.local",
          "output": "",
          "explanation": "Tells git to skip the real secret files. The `*` in `.env.*.local` matches any word, so it covers `.env.production.local` and `.env.test.local`. `.env.example` is not listed, so it can be committed."
        },
        {
          "language": "bash",
          "filename": ".env.example",
          "source": "PORT=3000\nDATABASE_URL=postgres://app:app_password@localhost:5432/orders_dev\nJWT_SECRET=replace-with-a-long-random-string-of-32-or-more-characters",
          "output": "",
          "explanation": "The committed template: the same keys as `.env` but only placeholder values. A new teammate copies it to `.env` and fills in real values."
        },
        {
          "language": "typescript",
          "filename": "show-env.ts",
          "source": "console.log(Bun.env.DATABASE_URL);",
          "output": "postgres://app:app_password@localhost:5432/orders_dev",
          "explanation": "Run `bun show-env.ts` from the project root. Nothing in the script loads the file; Bun read `.env` before the script started. NODE_ENV is not set, so `.env.test` is not used."
        }
      ],
      "productionNote": "Local development uses `.env` files. Real production platforms (the hosting services that run your app) inject the real values as environment variables, so you normally do not put a `.env` file on a production server at all. When you run Bun in Node-compatibility mode (`bun --bun`, `bunx --bun`, or a `node` command that points at Bun), Bun does not load `.env` on its own; pass `--env-file` there.",
      "commonMistakes": [
        "Committing `.env` with real secrets. Once a secret is in git history it is leaked, even if you delete the file later; you must replace the secret.",
        "Spacing and quoting errors such as `PORT = 3000`. Write `PORT=3000`.",
        "Expecting `.env.local` to apply in tests. It is skipped when NODE_ENV is `test`, on purpose; put test settings in `.env.test`.",
        "Editing `.env.example` to hold real values. It is committed, so it must only ever hold fake ones."
      ],
      "sources": [
        { "title": "Bun docs: Environment variables", "url": "https://bun.com/docs/runtime/env" },
        { "title": "Bun docs: Test configuration", "url": "https://bun.com/docs/test/configuration" }
      ]
    },
    {
      "id": "validated-config-module",
      "title": "A validated config module (src/config.ts)",
      "explanation": "Instead of reading `Bun.env` everywhere, the whole app reads settings from one file, `src/config.ts`. That module reads the environment once at startup, checks every value, converts the types, and exports a typed object. If anything is wrong, it throws an error immediately and the app does not start. This is called failing fast: a clear error at startup is much better than a mysterious crash hours later.\n\nThe module has these parts. First, types: `AppEnv` and `LogLevel` are literal unions (types that allow only a few exact strings), and `Config` describes the final object with real types such as `port: number`.\n\nSecond, a function `loadConfig(env)` that takes the environment as a parameter. The type `Record<string, string | undefined>` means an object whose keys are strings and whose values are strings or `undefined`; `Bun.env` fits it. Because the environment is passed in, you can test the function with any made-up object.\n\nThird, a list `problems`. Each failed check pushes a message (`push` adds an item to the end of an array). After all checks, if the list is not empty, one `Error` is thrown listing every problem, so the developer fixes everything in one go. The message is built with `problems.join(\"\\n- \")`, which glues the array items into one string with that separator between them.\n\nFourth, `Object.freeze(...)` makes the returned object read-only at runtime: assigning to one of its properties is ignored (or throws an error in strict mode), so no code can change the config by accident.\n\nFinally `export const config = loadConfig(Bun.env)` runs the check once, when the module is first imported. `startsWith(text)` is a string method that is true when the string begins with that text. `x as AppEnv` tells TypeScript to treat a value as that type; it is safe here because we have already thrown if the value was invalid.\n\nNote that there is deliberately no default for DATABASE_URL and JWT_SECRET. An empty value fails the check. A secret with a built-in default would silently run in production with a publicly known password.",
      "analogy": "A pre-flight checklist. Before takeoff the pilot checks fuel, flaps and radio. If any item is missing, the plane does not take off, instead of the problem being discovered mid-air. `loadConfig` is the checklist, and it reads out every missing item, not just the first.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/config.ts",
          "source": "export type AppEnv = \"development\" | \"test\" | \"production\";\nexport type LogLevel = \"debug\" | \"info\" | \"warn\" | \"error\";\n\nexport type Config = {\n  env: AppEnv;\n  port: number;\n  databaseUrl: string;\n  jwtSecret: string;\n  logLevel: LogLevel;\n};\n\nconst appEnvs: string[] = [\"development\", \"test\", \"production\"];\nconst logLevels: string[] = [\"debug\", \"info\", \"warn\", \"error\"];\n\nexport function loadConfig(env: Record<string, string | undefined>): Config {\n  const problems: string[] = [];\n\n  const nodeEnv = env.NODE_ENV ?? \"development\";\n  if (!appEnvs.includes(nodeEnv)) {\n    problems.push(\"NODE_ENV must be development, test or production\");\n  }\n\n  const port = Number(env.PORT ?? \"3000\");\n  if (!Number.isInteger(port) || port < 1 || port > 65535) {\n    problems.push(\"PORT must be an integer 1-65535\");\n  }\n\n  const databaseUrl = env.DATABASE_URL ?? \"\";\n  if (!databaseUrl.startsWith(\"postgres://\") && !databaseUrl.startsWith(\"postgresql://\")) {\n    problems.push(\"DATABASE_URL must be a postgres:// URL\");\n  }\n\n  const jwtSecret = env.JWT_SECRET ?? \"\";\n  if (jwtSecret.length < 32) {\n    problems.push(\"JWT_SECRET must be at least 32 characters\");\n  }\n\n  const logLevel = env.LOG_LEVEL ?? \"info\";\n  if (!logLevels.includes(logLevel)) {\n    problems.push(\"LOG_LEVEL must be debug, info, warn or error\");\n  }\n\n  if (problems.length > 0) {\n    throw new Error(`Invalid config:\\n- ${problems.join(\"\\n- \")}`);\n  }\n\n  return Object.freeze({\n    env: nodeEnv as AppEnv,\n    port,\n    databaseUrl,\n    jwtSecret,\n    logLevel: logLevel as LogLevel,\n  });\n}\n\nexport const config = loadConfig(Bun.env);",
          "output": "",
          "explanation": "Importing this file runs `loadConfig(Bun.env)` once. With the `.env` from the previous sub-topic present, it passes silently, so the file itself prints nothing. Checks run in the order NODE_ENV, PORT, DATABASE_URL, JWT_SECRET, LOG_LEVEL, which is the order problems are reported in."
        },
        {
          "language": "typescript",
          "filename": "scripts/config-demo.ts",
          "source": "import { loadConfig } from \"../src/config.ts\";\n\ntry {\n  loadConfig({ PORT: \"abc\" });\n} catch (err) {\n  if (err instanceof Error) console.log(err.message);\n}\n\nconst ok = loadConfig({\n  NODE_ENV: \"test\",\n  PORT: \"4000\",\n  DATABASE_URL: \"postgres://app:app_password@localhost:5432/orders_test\",\n  JWT_SECRET: \"test-only-secret-0123456789abcdef\",\n});\nconsole.log(ok.port, ok.logLevel, Object.isFrozen(ok));",
          "output": "Invalid config:\n- PORT must be an integer 1-65535\n- DATABASE_URL must be a postgres:// URL\n- JWT_SECRET must be at least 32 characters\n4000 info true",
          "explanation": "Run it from the project root with `bun scripts/config-demo.ts`, so Bun finds your `.env` (importing config.ts loads the real environment too, and it must be valid). The first call passes `{ PORT: \"abc\" }`: `Number(\"abc\")` is NaN, which is not an integer, and the other two values are missing, so three problems are reported together. The second call passes a complete object; LOG_LEVEL is absent so it defaults to `info`, and `Object.isFrozen` confirms the object is read-only."
        }
      ],
      "productionNote": "Other modules (`index.ts`, `db.ts`, `logger.ts`) import `config` from this file and never read `Bun.env` themselves. Because `loadConfig` takes the environment as an argument, tests can check each failure case with a plain object. Never print the whole config object to a log: it contains the database password and the JWT secret.",
      "commonMistakes": [
        "Giving secrets a default, for example `env.JWT_SECRET ?? \"secret\"`. A forgotten variable in production then silently runs with an insecure, publicly guessable value. Fail instead.",
        "Validating lazily, in the middle of a request. The first user then sees a 500 error. Validate once, at startup.",
        "Printing the whole config with `console.log(config)`, which writes secrets into log files.",
        "Reporting only the first problem. The developer fixes one, restarts, hits the next, and so on. Collect all problems, then throw once."
      ],
      "sources": [
        { "title": "Bun docs: Environment variables", "url": "https://bun.com/docs/runtime/env" },
        { "title": "The Twelve-Factor App: Config", "url": "https://12factor.net/config" },
        { "title": "MDN: Object.freeze()", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze" }
      ]
    },
    {
      "id": "secrets-and-environments",
      "title": "Secrets & per-environment settings (dev, test, prod)",
      "explanation": "A secret is a value that grants access to something: a database password, or the key used to sign login tokens (JWT_SECRET). Four rules cover most of secret handling. Never put a secret in code or in git. Never write it to logs. Use a different secret in every environment, so a leak from your laptop cannot open production. And make it long and random, not a word someone can guess.\n\nTo make a random secret you can use `crypto.getRandomValues`, a built-in function that fills an array with cryptographically secure random bytes (numbers 0 to 255). `new Uint8Array(32)` creates an array of 32 such byte slots. `Buffer.from(bytes).toString(\"hex\")` turns those bytes into text, two hexadecimal characters (0-9, a-f) per byte, so 32 bytes become 64 characters. A `Buffer` is Bun's container for raw bytes.\n\nThe same idea applies to environments. Keep three separate sets of settings. Development (`orders_dev` database) is where you experiment. Test (`orders_test`) is a separate database that automated tests are free to wipe and refill. Production is the real one, and its values are injected by the hosting platform, never stored in the repository (the project's folder tracked by git).\n\nSeparating the databases matters most. A test run often deletes all rows to start clean; if it pointed at your dev database you would lose your data, and if it pointed at production the damage would be real.",
      "analogy": "House keys. Each tenant gets their own key (a different secret per environment). You never tape a spare key to the front door (committing it to git), and you never read your key code aloud on the phone (printing it in logs). If a key is lost you change that one lock, which is called rotating the secret.",
      "code": [
        {
          "language": "typescript",
          "filename": "scripts/gen-secret.ts",
          "source": "const bytes = crypto.getRandomValues(new Uint8Array(32));\nconst secret = Buffer.from(bytes).toString(\"hex\");\nconsole.log(secret.length);",
          "output": "64",
          "explanation": "The secret itself is different on every run, so the script prints only its length, which is always 64. To actually generate a secret, temporarily change the last line to `console.log(secret)`, run `bun scripts/gen-secret.ts`, and paste the result into your `.env.local` or into your hosting platform's settings."
        }
      ],
      "productionNote": "Production secrets live in the hosting platform's secret settings, are rotated (replaced) on a schedule or after any suspected leak, and are different from every other environment. Tests must only ever connect to the test database; the testing topic adds a safety check for this.",
      "commonMistakes": [
        "Using the same secret in dev, test and production. One leak then compromises everything.",
        "Running tests against the dev database. Tests that clear tables will wipe the data you were working with. Give tests their own `orders_test` database via `.env.test`.",
        "Using a short or guessable secret such as `secret123` instead of 32 random bytes.",
        "Pasting a real secret into a chat, an issue or a log line \"just to debug\"."
      ],
      "sources": [
        { "title": "MDN: Crypto.getRandomValues()", "url": "https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues" },
        { "title": "OWASP: Secrets Management Cheat Sheet", "url": "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "You start the app with `PORT=4000`. What is the type of `Bun.env.PORT`, and how do you get a number?",
      "options": [
        "It is a number already; use it directly.",
        "It is a string (or `undefined` if unset); convert it with `Number(Bun.env.PORT)`.",
        "It is a boolean; compare it with `===`.",
        "It is always `undefined` unless you import a library first."
      ],
      "answerIndex": 1,
      "explanation": "Every environment variable is text or `undefined`. You must convert it yourself, which is best done once in the config module."
    },
    {
      "question": "When NODE_ENV is `test`, which file does Bun load automatically in addition to `.env`, and which one is skipped?",
      "options": [
        "`.env.local` is loaded and `.env.test` is skipped.",
        "Both `.env.test` and `.env.local` are loaded.",
        "`.env.test` is loaded and `.env.local` is skipped.",
        "Neither is loaded; tests ignore all .env files."
      ],
      "answerIndex": 2,
      "explanation": "`.env.test` is loaded, and `.env.local` is deliberately skipped in test mode so tests behave the same on every machine."
    },
    {
      "question": "Why does `loadConfig` throw at startup instead of giving JWT_SECRET a default value?",
      "options": [
        "A missing secret should stop the app immediately; a default would silently run production with an insecure, publicly known secret.",
        "Because TypeScript does not allow default values for strings.",
        "Because throwing makes the server start faster.",
        "Because defaults are only allowed for numbers such as PORT."
      ],
      "answerIndex": 0,
      "explanation": "Failing fast gives a clear error when the app starts. A built-in secret default would let a misconfigured production server run unnoticed with a guessable key."
    },
    {
      "question": "Which of these files should be committed to git?",
      "options": [
        "`.env`, because the team needs the real values.",
        "`.env.local`, because it overrides `.env`.",
        "Both `.env` and `.env.example`.",
        "`.env.example` with fake placeholder values, while `.env` stays out of git."
      ],
      "answerIndex": 3,
      "explanation": "`.env.example` documents the needed keys with fake values and is safe to commit. Real `.env` files hold secrets and belong in `.gitignore`."
    },
    {
      "question": "Why do tests use a separate `orders_test` database instead of `orders_dev`?",
      "options": [
        "Because PostgreSQL allows only one database per computer.",
        "Because tests often delete and recreate data, which would wipe the data you use during development.",
        "Because `orders_test` is faster to type.",
        "Because Bun refuses to connect to a database whose name ends in `_dev`."
      ],
      "answerIndex": 1,
      "explanation": "Tests need a database they are free to clear and refill. Keeping it separate protects development (and production) data."
    }
  ]
});
