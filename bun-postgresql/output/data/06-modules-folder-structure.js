window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "06-modules-folder-structure",
  "order": 6,
  "title": "Modules & Production Folder Structure",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "A real backend is never one big file. You will learn to split code into modules (separate files, each with its own private names, shared only through import and export) using import and export, read package.json and tsconfig.json (the two settings files every Bun project has), and lay out the orders-api project that the rest of the course builds. You finish with a small entry point, the one file that starts the program.",
  "prerequisites": ["05-errors-async"],
  "subtopics": [
    {
      "id": "import-export",
      "title": "import and export (ES modules)",
      "explanation": "So far every program you wrote lived in one file. Real projects have dozens of files, so JavaScript has a way to split code up. A module is simply one file that has its own private scope: a name you create inside it (a const, a function, a type) cannot be seen from other files unless you share it on purpose.\n\nYou share a name with the keyword `export` placed in front of its declaration. Another file then asks for it with `import { name } from \"./file\"`. The braces list the exact names you want. This is called a named export, and it is the only style this course uses. We skip the other style, the default export, because named exports keep the same name in every file, which makes searching and renaming safer.\n\nThe text after `from` is the path. `./` means \"the same folder as this file\" and `../` means \"one folder up\". You can leave off the `.ts` ending because Bun finds the file for you. A path that starts with no dot, such as `\"bun\"`, `\"bun:test\"` or `\"node:crypto\"`, names a built-in module that ships with Bun instead of one of your files.\n\nTypes get one extra rule. A type (like `Order` below) exists only for the editor and TypeScript's checker, and it disappears before the program runs. The project's `tsconfig.json` (explained in a later sub-topic) turns on a setting called `verbatimModuleSyntax`. With it on, an import that is only a type must be written `import type { Order } from \"./types/order\"`. If you write a plain `import` for a name that is only a type, your editor shows an error. Writing `import type` tells everybody, and the tooling, that this line will vanish at run time.\n\nSetup for the example: open a terminal in a new folder called `orders-api`, then create a folder `src` and a folder `src/types` inside it. Create the three files shown below, then run `bun run src/demo.ts` from the `orders-api` folder.",
      "analogy": "Think of a company building with many offices. Each office (a file) keeps its papers private. `export` is putting a document in the shared outbox, and `import` is requesting that document by name and by office number (the path). `import type` is asking only for the blank form template, not for any filled-in paperwork: it helps you fill your own forms correctly, but nothing is carried over.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/types/order.ts",
          "source": "export type OrderStatus = \"pending\" | \"paid\" | \"shipped\" | \"cancelled\";\n\nexport type Order = {\n  id: string;\n  status: OrderStatus;\n  totalCents: number;\n};\n",
          "output": "",
          "explanation": "This file only exports two types, so it prints nothing and has no run-time content. Each `export type` makes one name available to other files."
        },
        {
          "language": "typescript",
          "filename": "src/money.ts",
          "source": "export function formatCents(cents: number): string {\n  return `$${(cents / 100).toFixed(2)}`;\n}\n",
          "output": "",
          "explanation": "`formatCents` turns integer cents into a price string. The template `$${...}` is a literal dollar sign followed by an interpolation. `.toFixed(2)` keeps exactly two decimals. Nothing is printed because the file only defines and exports the function."
        },
        {
          "language": "typescript",
          "filename": "src/demo.ts",
          "source": "import type { Order } from \"./types/order\";\nimport { formatCents } from \"./money\";\n\nconst o: Order = { id: \"101\", status: \"paid\", totalCents: 4998 };\nconsole.log(`${o.id}: ${formatCents(o.totalCents)}`);\n",
          "output": "101: $49.98",
          "explanation": "`Order` is only a type, so it is imported with `import type`. `formatCents` is a real function, so it uses a plain `import`. Both paths start with `./` because the files are inside `src/`, and `.ts` is left off. 4998 cents divided by 100 is 49.98."
        }
      ],
      "productionNote": "In a production project every layer file exports the functions and types the next layer needs, and nothing else. Import lines at the top of a file act as a map of what that file depends on, which makes code review and refactoring (restructuring code without changing what it does) easier.",
      "commonMistakes": [
        "Circular imports: file A imports file B and B imports A, for example a repository file importing a service file that already imports the repository. Keep imports flowing in one direction (see the folder layout sub-topic).",
        "Importing something that is only a type with a plain `import`. With `verbatimModuleSyntax` on, your editor reports an error. Use `import type`.",
        "Getting the relative path depth wrong, such as writing `./types/order` from a file that is already inside `src/types/`. Count the folders: `./` is the current folder, `../` is the parent."
      ],
      "sources": [
        { "title": "MDN: JavaScript modules", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules" },
        { "title": "Bun docs: Module resolution", "url": "https://bun.com/docs/runtime/module-resolution" },
        { "title": "TypeScript: verbatimModuleSyntax", "url": "https://www.typescriptlang.org/tsconfig/#verbatimModuleSyntax" }
      ]
    },
    {
      "id": "package-json-scripts",
      "title": "package.json and scripts",
      "explanation": "`package.json` is the ID card of a JavaScript project. It is a plain text file written in JSON (the text format you met in topic 1: keys and values in braces) that sits in the project's root folder, the top folder of the project. `bun init` creates one for you.\n\nThe keys you need to know: `name` is the project's name. `\"type\": \"module\"` says the project's files are ES modules (the import/export style from the previous sub-topic). `\"private\": true` says this project is never published to a public package registry (an online store for shared code), which also stops you from publishing it by accident.\n\n`scripts` is an object of named shortcuts. Each key is a name you choose and each value is the command to run. You run one with `bun run <name>`, so `bun run dev` runs whatever is stored under `dev`. Typing `bun run` with no name lists the scripts the project has.\n\n`devDependencies` lists packages (code written by other people) that you need while developing but not when the program runs in production. The one here, `@types/bun`, gives your editor the type information for Bun's built-in features, such as `Bun.serve`, so it can autocomplete them and catch mistakes. The value `\"latest\"` means \"whatever is newest\". Production teams usually replace that with an exact version number so every machine installs the same thing.\n\nThis course uses no other packages: the web server (`Bun.serve`), the database client (`Bun.sql`), password hashing (`Bun.password`) and the test runner (`bun:test`) are all built into Bun. Installing packages is not covered here.\n\nNote that JSON allows no comments and no trailing commas, so the file below is exactly what you would save as `orders-api/package.json`. The `dev` script uses `--watch`, which you met in topic 1: it restarts the program when a file changes. The scripts point at files such as `src/index.ts` that you will create in this topic and later ones.",
      "analogy": "A package.json script is like a preset button on a TV remote. Instead of typing a long channel number every time, you press the button labelled \"dev\" or \"test\" and the remote sends the long number for you. Everyone with the same remote presses the same buttons and gets the same result.",
      "code": [
        {
          "language": "json",
          "filename": "package.json",
          "source": "{\n  \"name\": \"orders-api\",\n  \"type\": \"module\",\n  \"private\": true,\n  \"scripts\": {\n    \"dev\": \"bun --watch src/index.ts\",\n    \"start\": \"bun src/index.ts\",\n    \"migrate\": \"bun scripts/migrate.ts\",\n    \"seed\": \"bun scripts/seed.ts\",\n    \"test\": \"bun test\"\n  },\n  \"devDependencies\": {\n    \"@types/bun\": \"latest\"\n  }\n}\n",
          "output": "",
          "explanation": "This is a data file, so it prints nothing by itself. `bun run start` runs the command stored under `start`, which is `bun src/index.ts`. `bun run test` runs `bun test`, Bun's test runner (covered in topic 22). `migrate` and `seed` point at files you create in topic 14."
        }
      ],
      "productionNote": "Scripts mean your teammates and the CI system (continuous integration: a server that automatically runs your checks on every change) all run exactly the same commands, such as `bun run test`, instead of each person remembering their own variation.",
      "commonMistakes": [
        "Mistyping a script name, for example `bun run strat`. Bun reports that the script was not found. Run `bun run` with no name to list the real ones.",
        "Putting secrets such as passwords or API keys inside a script command. `package.json` is committed to version control (a shared history of your project's files, such as Git) and read by everyone. Secrets belong in environment configuration (topic 7).",
        "Forgetting that JSON allows no comments or trailing commas, which makes the file invalid."
      ],
      "sources": [
        { "title": "Bun docs: bun run", "url": "https://bun.com/docs/cli/run" },
        { "title": "npm docs: package.json", "url": "https://docs.npmjs.com/cli/v11/configuring-npm/package-json" }
      ]
    },
    {
      "id": "tsconfig-essentials",
      "title": "tsconfig.json essentials",
      "explanation": "`tsconfig.json` holds the settings for TypeScript's checker. The most important thing to understand: Bun does not type-check your code using these settings: it strips the type annotations and runs the JavaScript that remains. (Bun does read a few tsconfig options that change emitted code, such as `paths` and `jsx`, but none of the checks below.) The settings control what your editor (and the `tsc` type checker, if you run it) reports as an error.\n\n`bun init` writes sensible defaults (the file below is a trimmed version of them), and in Bun 1.4 they are compatible with TypeScript 7. The ones to know:\n\n`strict: true` switches on the strictest family of checks, including null-safety: TypeScript warns you when a value might be `null` or `undefined` and you use it anyway.\n\n`module: \"Preserve\"` and `moduleResolution: \"bundler\"` tell TypeScript to leave import/export as written and to find files the way Bun does, for example without requiring file endings. `allowImportingTsExtensions: true` allows writing `.ts` in an import path. `verbatimModuleSyntax: true` is the rule from the first sub-topic.\n\n`noEmit: true` means TypeScript produces no output files, because Bun runs `.ts` directly. `target` and `lib` set to `ESNext` mean \"use the newest JavaScript features\".\n\nThe course adds two options that `bun init` does not write: `noUncheckedIndexedAccess: true` and `noFallthroughCasesInSwitch: true`. Normally TypeScript types `rows[0]` (reading an array element by its position, called indexing) as the element type, even though an empty array has no element 0. With this option, `rows[0]` is typed `Order | undefined`, so you must handle \"nothing there\" before using it. That is exactly the \"query returned no row\" bug you will meet with databases.\n\nWith that option on, if you wrote `first.id` directly on such a value, your editor would report `'first' is possibly 'undefined'.` The second code example shows the safe way. Run it with `bun run src/first.ts`. (If you ran the unsafe version anyway, Bun would not stop you; it would crash with a `TypeError`, the error JavaScript throws when you use a value in a way its type does not allow, here reading a property of `undefined`.)",
      "analogy": "The tsconfig is a set of house rules posted for the building inspector. The inspector (TypeScript, in your editor) checks the building against the rules and flags problems. The movers (Bun) who actually carry the furniture in never read the rules, so a rule change mostly does not alter how the movers work.",
      "code": [
        {
          "language": "json",
          "filename": "tsconfig.json",
          "source": "{\n  \"compilerOptions\": {\n    \"lib\": [\"ESNext\"],\n    \"target\": \"ESNext\",\n    \"module\": \"Preserve\",\n    \"moduleResolution\": \"bundler\",\n    \"allowImportingTsExtensions\": true,\n    \"verbatimModuleSyntax\": true,\n    \"noEmit\": true,\n    \"strict\": true,\n    \"skipLibCheck\": true,\n    \"noUncheckedIndexedAccess\": true,\n    \"noFallthroughCasesInSwitch\": true\n  }\n}\n",
          "output": "",
          "explanation": "The first block is a trimmed version of the bun init defaults plus the course additions `noUncheckedIndexedAccess` and `noFallthroughCasesInSwitch`. `skipLibCheck` skips checking other packages' type files, and `noFallthroughCasesInSwitch` reports a `switch` case that forgets its `break`. This file prints nothing."
        },
        {
          "language": "typescript",
          "filename": "src/first.ts",
          "source": "import type { Order } from \"./types/order\";\n\nconst rows: Order[] = [];\nconst first = rows[0]; // typed Order | undefined\n\nif (first === undefined) {\n  console.log(\"no order found\");\n} else {\n  console.log(first.id);\n}\n",
          "output": "no order found",
          "explanation": "`rows` is empty, so `rows[0]` is `undefined`. Because the type is `Order | undefined`, the `if` check narrows it: inside the `else` branch TypeScript knows `first` is an `Order`, so `first.id` is allowed. This reuses `src/types/order.ts` from the first sub-topic."
        }
      ],
      "productionNote": "Strict settings catch whole classes of null and undefined bugs in the editor, before the code is ever deployed. Teams usually also run the type checker as part of CI so a type error blocks a change from being merged.",
      "commonMistakes": [
        "Turning `strict` off to make the red underlines go away. The errors point at real possible bugs. Fix the code instead.",
        "Expecting `tsconfig.json` to change how Bun runs your code. It mostly affects checking. A type error does not stop `bun run`."
      ],
      "sources": [
        { "title": "Bun docs: TypeScript", "url": "https://bun.com/docs/runtime/typescript" },
        { "title": "TypeScript: strict", "url": "https://www.typescriptlang.org/tsconfig/#strict" },
        { "title": "TypeScript: noUncheckedIndexedAccess", "url": "https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess" }
      ]
    },
    {
      "id": "production-folder-layout",
      "title": "Production folder layout",
      "explanation": "This is the project you will grow for the rest of the course. Each folder has one job, and each later topic adds files to it. Nothing here runs yet; this sub-topic is about structure.\n\nA layer is a group of files with one responsibility. There are three main ones. Routes are the HTTP layer: they read the incoming request and build the response, and nothing else. Services hold the business rules, such as \"an order can only be cancelled if it has not shipped\". They contain no SQL (the language for asking a database questions) and never touch a `Request` object (the object that holds an incoming HTTP request, taught in topic 08). Repositories contain only SQL: they talk to the database and return plain data.\n\nThe rule that keeps this tidy is that dependencies point one way: routes call services, services call repositories, and repositories use the shared database client in `db.ts`. A lower layer never imports a higher one. Only `server.ts` imports the route files, to wire them together.\n\nThe other folders: `migrations/` holds the history of database changes as numbered `.sql` files. `scripts/` holds one-off commands such as running migrations. `validation/` checks incoming data. `types/` holds shared types. `tests/` mirrors `src/`. File names follow `<feature>.<layer>.ts`, such as `orders.service.ts`, so you can see the feature and the layer at a glance.\n\nThe layout is shown first, with a note on the topic that creates each part. Then three tiny files show the import direction.",
      "analogy": "Picture a restaurant. Waiters (routes) take orders from customers and serve the plates. Chefs (services) decide how each dish is made. Pantry staff (repositories) fetch ingredients from the storeroom (the database). A waiter never walks into the storeroom, and the storeroom never talks to customers. Because each role is separate, you can replace a waiter or retrain a chef without rebuilding the kitchen.",
      "code": [
        {
          "language": "text",
          "filename": "orders-api-layout.txt",
          "source": "orders-api/\n├── package.json  tsconfig.json  bunfig.toml\n├── .env  .env.example  .env.test        (topic 07)\n├── migrations/0001_create_users.sql ... (topic 14)\n├── scripts/migrate.ts  scripts/seed.ts  (topic 14)\n├── src/\n│   ├── index.ts        entry point: load config, connect db, start server, handle shutdown\n│   ├── server.ts       createServer(deps) -> Bun.serve (topic 08)\n│   ├── config.ts       validated env (topic 07)\n│   ├── db.ts           Bun.sql client (topic 13)\n│   ├── logger.ts       JSON logger (topic 21)\n│   ├── errors.ts       AppError hierarchy (topic 19)\n│   ├── http.ts         json()/error response helpers (topics 08, 19)\n│   ├── types/          shared types: order.ts, user.ts\n│   ├── routes/         HTTP layer: orders.routes.ts, users.routes.ts, auth.routes.ts, health.routes.ts\n│   ├── services/       business rules: orders.service.ts, auth.service.ts\n│   ├── repositories/   SQL only: orders.repo.ts, users.repo.ts, sessions.repo.ts\n│   └── validation/     input validators: orders.validation.ts (topic 19)\n└── tests/  unit/  integration/  helpers/  (topic 22)\n",
          "output": "",
          "explanation": "This is the target layout, not a program, so nothing runs. Files marked with a topic number are created in that topic. `bunfig.toml` is Bun's own optional settings file; you will first use it in topic 22."
        },
        {
          "language": "typescript",
          "filename": "src/routes/orders.routes.ts",
          "source": "import { listOrders } from \"../services/orders.service\";\n// ...the route handler would call listOrders() and build the HTTP response\n",
          "output": "",
          "explanation": "A route file imports from the service layer, one folder up and then into `services/`. It never imports from `repositories/`. Nothing runs yet because the files are only shown to illustrate the direction."
        },
        {
          "language": "typescript",
          "filename": "src/services/orders.service.ts",
          "source": "import { findOrders } from \"../repositories/orders.repo\";\n// ...the service would apply business rules to what findOrders() returns\n",
          "output": "",
          "explanation": "A service file imports from the repository layer. It does not import anything from `routes/`, so the arrow points only downwards."
        }
      ],
      "productionNote": "A clear layout means teammates find code fast: a bug in how orders are stored is in `orders.repo.ts`, a rule bug is in `orders.service.ts`. Because layers are separate, each can be tested alone (topic 22), for example testing a service with a fake repository.",
      "commonMistakes": [
        "Writing SQL directly inside a route handler. That mixes the HTTP layer with the database layer. Move the SQL to a repository.",
        "Passing the `Request` object into a service. Services should receive plain values (an id, a validated input), so they can be reused and tested without an HTTP server.",
        "Putting the whole program in one giant `index.ts`. It becomes impossible to test or navigate."
      ],
      "sources": [
        { "title": "Bun docs: Module resolution", "url": "https://bun.com/docs/runtime/module-resolution" },
        { "title": "Bun docs: bun init", "url": "https://bun.com/docs/cli/init" }
      ]
    },
    {
      "id": "entry-point-bootstrapping",
      "title": "Entry point and bootstrapping",
      "explanation": "The entry point is the file you hand to Bun to start the whole program. In this project it is `src/index.ts`, which the `start` script runs. To bootstrap means to start up the program in the right order. Our final order will be: read the configuration, create the database client, create the server, register the shutdown handlers. Those steps are added in topics 7, 13, 8 and 21, so this sub-topic builds only a small first version.\n\nA side effect is anything a piece of code does besides returning a value, such as printing, opening a connection or starting a server. The rule is that only the entry point has side effects at startup. Every other module only exports things. If a library file connected to the database the moment it was imported, then merely importing it in a test would open a connection.\n\n`import.meta.main` is a value that is `true` when this file was the one started directly (for example by `bun run start`) and `false` when another file merely imports it. Wrapping the start-up call in `if (import.meta.main)` lets a file work as both a runnable script and an importable module. You met top-level `await` in topic 5; it is also allowed in the entry point, but a `main` function keeps the example easy to read.\n\nFail fast: if start-up goes wrong, report it and stop. The way to stop is `process.exit(1)`, which ends the program with an exit code. An exit code is a number every program returns to the system: `0` means success and any other number means failure. Tools such as CI and process managers read it. In the code below, `main()` returns a Promise. `.catch(...)` is like `.then(...)` from topic 5, but its callback runs only if the Promise is rejected (failed).\n\nSetup: this file uses `src/money.ts` from the first sub-topic, so create it as shown there. Save the code as `src/index.ts` and run `bun run start` from the `orders-api` folder.",
      "analogy": "Think of the opening shift at a shop. The manager unlocks the door, checks that the till (configuration) has money in it, switches on the fridges (database), and only then opens the shutters (server), always in the same order. If the till is missing, the shop stays closed instead of opening half-ready.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/index.ts",
          "source": "import { formatCents } from \"./money\";\n\nasync function main(): Promise<void> {\n  console.log(\"starting orders-api\");\n  console.log(\"sample price\", formatCents(2499));\n}\n\nif (import.meta.main) {\n  main().catch((err) => {\n    console.error(\"startup failed\", err);\n    process.exit(1);\n  });\n}\n",
          "output": "starting orders-api\nsample price $24.99",
          "explanation": "Run directly, `import.meta.main` is true, so `main()` runs and prints two lines. `console.log` with two arguments prints them separated by a space, and 2499 cents formats as `$24.99`. If `main()` threw, the `.catch` callback would print the error to stderr and exit with code 1. If another file imported `index.ts`, nothing would run."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "bun run start",
          "output": "starting orders-api\nsample price $24.99",
          "explanation": "`bun run start` looks up `start` in `package.json` (set up in the second sub-topic) and runs `bun src/index.ts`."
        }
      ],
      "productionNote": "This shape grows into the real bootstrap in topic 21, with config, database, server and graceful shutdown added in a fixed order. Keeping all start-up work in one place means the order of events is easy to read and a failure stops the process with a non-zero exit code that deployment tools can detect.",
      "commonMistakes": [
        "Doing side effects at import time in library modules, such as connecting to the database at the top of `db.ts` code that runs on import. Importing the file in a test then triggers real work.",
        "Swallowing a start-up error (catching it and carrying on). The app then runs half-configured. Print the error and exit with a non-zero code instead."
      ],
      "sources": [
        { "title": "Bun docs: Module resolution (import.meta)", "url": "https://bun.com/docs/runtime/module-resolution" },
        { "title": "Node.js docs: process.exitCode", "url": "https://nodejs.org/api/process.html#processexitcode" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "In this project, `Order` is only a TypeScript type. Why must it be imported with `import type { Order } from \"./types/order\"`?",
      "options": [
        "Because plain `import` cannot load files from another folder",
        "Because `verbatimModuleSyntax` is on, so an import that is only a type must say so, and the line is removed at run time",
        "Because types are loaded from the network and need a special keyword",
        "Because `import type` makes the code run faster than any plain import"
      ],
      "answerIndex": 1,
      "explanation": "With `verbatimModuleSyntax: true` the compiler keeps normal imports exactly as written, so a type-only name must be marked with `import type` so it can be erased. Plain `import` works across folders, types are never loaded from the network, and speed is not the reason."
    },
    {
      "question": "Given the `package.json` in this topic, what does `bun run test` execute?",
      "options": [
        "`bun test`, because that is the value stored under the `test` script",
        "`bun src/index.ts`",
        "Nothing, because `test` is not a script name",
        "`bun --watch src/index.ts`"
      ],
      "answerIndex": 0,
      "explanation": "`bun run <name>` looks up that name in `scripts` and runs the stored command. The `test` key holds `bun test`. `bun src/index.ts` belongs to `start`, and the `--watch` command belongs to `dev`."
    },
    {
      "question": "With `noUncheckedIndexedAccess` turned on and `const rows: Order[] = []`, what type does `rows[0]` have?",
      "options": [
        "`Order`",
        "`number`",
        "`Order | undefined`",
        "`never`"
      ],
      "answerIndex": 2,
      "explanation": "The option makes reading by index include `undefined`, because the position may be empty. That forces you to check before using the value. It is never plain `Order`, and the index itself being a number does not change the element type."
    },
    {
      "question": "A route handler contains a SQL query. Which layer should own that SQL instead?",
      "options": [
        "The routes layer, since it already receives the request",
        "The services layer, as long as it also builds the HTTP response",
        "The validation layer",
        "The repositories layer, which contains only SQL"
      ],
      "answerIndex": 3,
      "explanation": "Repositories are the layer that talks to the database. Routes handle HTTP only, and services hold business rules without SQL. Validation checks incoming data and does not run queries."
    },
    {
      "question": "What does `import.meta.main` tell you?",
      "options": [
        "Whether the program has any exported functions",
        "Whether this file was started directly, rather than only imported by another file",
        "Whether the code runs inside a function named `main`",
        "Whether the program is running in production"
      ],
      "answerIndex": 1,
      "explanation": "It is `true` only in the file Bun was told to run, such as `src/index.ts` via `bun run start`, and `false` when another file imports it. It says nothing about exports, a function called `main`, or the environment."
    }
  ]
});
