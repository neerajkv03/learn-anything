window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "12-packages-modules",
  "order": 12,
  "title": "Packages & Modules",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Learn how Go splits code into packages (folders of related code), how capitalization decides what other packages can use, and how a module (a versioned collection of packages described by go.mod) tracks outside dependencies. You will lay out a project with cmd/ and internal/, add libraries with go get, read major-version import paths like /v5, and keep go.mod clean with go mod tidy.",
  "prerequisites": [
    "11-error-handling"
  ],
  "subtopics": [
    {
      "id": "packages-and-exported-names",
      "title": "Packages and exported names",
      "explanation": "A package is a folder of .go files whose first line is the same `package` line, for example `package price`. All files in that folder belong to one package and can use each other's names freely. Code in one package uses code from another by importing it. The import path is the module path (the name you gave to `go mod init`) plus the folder path, such as `example.com/shop/price`.\n\nVisibility is decided by the first letter of a name. A name starting with a capital letter (like `Total`) is exported: other packages can use it as `price.Total`. A name starting with a lowercase letter (like `sum`) is private to its own package. There are no keywords such as `public` or `private`; capitalization is the whole rule.\n\nSetup, step by step. Open a terminal, create a folder and enter it with `mkdir shop` then `cd shop`. Run `go mod init example.com/shop` to create go.mod (the file that names your module). Create a sub-folder with `mkdir price`. Save the first file below as `price/price.go` and the second as `main.go` in the shop folder, then run `go run .`.\n\nIf main.go tried to call `price.sum`, the compiler (the tool that turns Go source into a program) would refuse to build: the name is not exported, so from outside it is as if it did not exist. By convention the package name equals its folder name, and callers write the package name before the dot, so `price.Total` reads well.",
      "analogy": "Think of a shop. The shop window and the counter (Capitalized names) are what customers can see and use. The back office with the stock sheets and the safe (lowercase names) is for staff only. Staff in the same shop, meaning files in the same package, walk freely between both areas, but a customer from another shop (another package) only ever deals with the counter.",
      "code": [
        {
          "language": "go",
          "filename": "price/price.go",
          "source": "package price\n\n// Total is exported (capital T), so other packages can call it.\n// The ...int parameter is variadic: it accepts any number of ints.\nfunc Total(cents ...int) int {\n\treturn sum(cents)\n}\n\n// sum is private (lowercase s): only package price can call it.\nfunc sum(values []int) int {\n\tt := 0\n\tfor _, v := range values {\n\t\tt += v\n\t}\n\treturn t\n}\n",
          "output": "",
          "explanation": "This file only declares functions, so running it prints nothing by itself. Total is visible to other packages; sum is a helper hidden inside package price."
        },
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\n\t\"example.com/shop/price\"\n)\n\nfunc main() {\n\tfmt.Println(price.Total(250, 199))\n\t// fmt.Println(price.sum([]int{1})) // would not compile: sum is not exported\n}\n",
          "output": "449",
          "explanation": "main imports the package by its full import path (module path example.com/shop plus folder price) and calls the exported Total. 250 + 199 is 449. The commented-out line shows what you cannot do: the compiler reports that sum is not exported (or is undefined) in package price."
        }
      ],
      "productionNote": "Give each package one clear responsibility, for example `store` for database access, `api` for HTTP handlers and `auth` for login logic. Keep the exported surface small: every capitalized name is a promise to other code that you must keep stable.",
      "commonMistakes": [
        "Expecting the package name to be independent of the folder. It can technically differ, but that confuses readers; keep the package name equal to the last folder name.",
        "Creating an import cycle: package a imports b while b imports a. The compiler stops with the error `import cycle not allowed`. Fix it by moving shared code into a third package that both can import.",
        "Stuttering names such as `price.PriceTotal`. The package name is already part of the call, so name it `price.Total`.",
        "Forgetting to capitalize a function and then wondering why other packages say it is undefined."
      ],
      "sources": [
        {
          "title": "How to write Go code",
          "url": "https://go.dev/doc/code"
        },
        {
          "title": "Go spec: Exported identifiers",
          "url": "https://go.dev/ref/spec#Exported_identifiers"
        }
      ]
    },
    {
      "id": "project-layout-and-internal",
      "title": "Project layout and internal/",
      "explanation": "A tiny program can keep main.go at the module root next to go.mod. As a project grows, the common layout is: `cmd/<app>/main.go` for each program (binary) you build, and your packages in folders beside it. You build or run one with its folder path, for example `go run ./cmd/shop`.\n\nA folder named `internal` has a special rule enforced by the Go tool: packages inside it can only be imported by code in the parent folder of `internal` and that parent's sub-folders. For the tree below, code anywhere in the shop module may import `example.com/shop/internal/price`, but a different module may not.\n\nThe tree for this example is: the `shop` folder holds go.mod, then `cmd/shop/main.go`, then `internal/price/price.go`. Create the folders with `mkdir -p cmd/shop internal/price` (works in Git Bash, macOS and Linux; in PowerShell `mkdir cmd/shop, internal/price` also works). Reuse the module from the previous sub-topic or run `go mod init example.com/shop` in a new empty folder.",
      "analogy": "A building with a staff-only door. Anyone who is inside this building, meaning any package in the same module tree, may walk through that door. People from outside the building, meaning other modules, are stopped at the door even if they know it exists.",
      "code": [
        {
          "language": "go",
          "filename": "internal/price/price.go",
          "source": "package price\n\n// Total adds up prices given in cents.\nfunc Total(cents ...int) int {\n\tt := 0\n\tfor _, c := range cents {\n\t\tt += c\n\t}\n\treturn t\n}\n",
          "output": "",
          "explanation": "Same idea as before, now placed under internal/ so only this module can import it."
        },
        {
          "language": "go",
          "filename": "cmd/shop/main.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\n\t\"example.com/shop/internal/price\"\n)\n\nfunc main() {\n\tfmt.Println(price.Total(250, 199))\n}\n",
          "output": "449",
          "explanation": "The import path now includes internal. This is allowed because cmd/shop is inside the same module tree. Run it from the module root with: go run ./cmd/shop"
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go run ./cmd/shop",
          "output": "449",
          "explanation": "./cmd/shop tells go run which package main to build. If another module imported example.com/shop/internal/price, the build would fail with an error saying the use of the internal package is not allowed."
        }
      ],
      "productionNote": "Services usually keep business logic in internal/ so that no other module can start depending on code you never meant to publish. That leaves you free to rename and restructure it later without breaking anyone.",
      "commonMistakes": [
        "Copying a huge \"standard layout\" with a dozen empty folders for a three-file program. Start flat and add folders only when you need them.",
        "Importing another module's internal package. The build fails with `use of internal package ... not allowed`. Use that module's public packages instead.",
        "Running `go run main.go` inside cmd/shop after the code imports local packages, or from the wrong folder. Run from the module root with `go run ./cmd/shop`."
      ],
      "sources": [
        {
          "title": "Organizing a Go module",
          "url": "https://go.dev/doc/modules/layout"
        },
        {
          "title": "cmd/go: Internal Directories",
          "url": "https://pkg.go.dev/cmd/go#hdr-Internal_Directories"
        }
      ]
    },
    {
      "id": "go-mod-go-sum-and-go-get",
      "title": "go.mod, go.sum and go get",
      "explanation": "A module is a collection of packages released together; go.mod is its description file. It holds the module path, a `go` line naming the Go version, and `require` lines. A `require` line names another module your code depends on (a dependency) and the exact version you use.\n\nTo add or update a dependency use `go get`. `go get golang.org/x/text@latest` fetches the newest release and records it in go.mod. `@v1.2.3` after the module path pins one exact version instead. Versions look like `v1.2.3`; the next sub-topic explains their meaning.\n\nGo also writes a second file, go.sum. It stores checksums (short fingerprints computed from file contents, also called hashes) of every module version you downloaded. On later downloads Go recomputes the fingerprint and refuses the module if it differs. For new modules Go also compares against a public checksum database, so a tampered copy is detected. Commit both go.mod and go.sum to version control.\n\nTo see which dependencies have newer versions, run `go list -m -u all`; it lists every module in the build and shows available updates in brackets.",
      "analogy": "go.mod is a shopping list with brands and versions: exactly what you need. go.sum is the pile of sealed receipts proving that each item you got is exactly the item that was originally sold, not a look-alike.",
      "code": [
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go get golang.org/x/text@latest\ncat go.mod\ncat go.sum",
          "output": "go: added golang.org/x/text vX.Y.Z\nmodule example.com/shop\n\ngo 1.27\n\nrequire golang.org/x/text vX.Y.Z\ngolang.org/x/text vX.Y.Z h1:<hash>\ngolang.org/x/text vX.Y.Z/go.mod h1:<hash>",
          "explanation": "Run this inside the module folder. vX.Y.Z stands for whatever the newest version is on the day you run it, and <hash> for a long generated checksum; both vary, so your exact text differs. The go line in your go.mod shows the Go version your module declares. go.sum gains a line for the module's files and one for its go.mod. Do not edit these files by hand."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go list -m -u all",
          "output": "example.com/shop\ngolang.org/x/text vX.Y.Z",
          "explanation": "Lists the main module and each dependency. When a newer release exists, it is shown in square brackets after the current version."
        }
      ],
      "productionNote": "Committing go.mod and go.sum gives reproducible builds: your laptop and the CI server (the automated machine that builds and tests each change) download the same verified versions. Check for upgrades regularly with `go list -m -u all`, and upgrade deliberately.",
      "commonMistakes": [
        "Editing go.sum by hand. It is generated; wrong lines make verification fail.",
        "Deleting go.sum to \"fix\" an error. This throws away the integrity record; investigate the error instead.",
        "Not committing go.sum, so every teammate and CI run has to re-trust whatever they download."
      ],
      "sources": [
        {
          "title": "Managing dependencies",
          "url": "https://go.dev/doc/modules/managing-dependencies"
        },
        {
          "title": "Go modules reference: go get",
          "url": "https://go.dev/ref/mod#go-get"
        },
        {
          "title": "Go modules reference: go.sum files",
          "url": "https://go.dev/ref/mod#go-sum-files"
        }
      ]
    },
    {
      "id": "semantic-import-versions",
      "title": "Semantic import versions",
      "explanation": "Go module versions follow semantic versioning (semver): MAJOR.MINOR.PATCH, written like `v5.11.0`. A patch bump fixes bugs, a minor bump adds features without breaking existing code, and a major bump is allowed to break the API (the set of names other code calls).\n\nGo adds one rule on top: for major version 2 and higher, the major number becomes part of the module path and therefore of every import path. The pgx database driver (the library that talks to PostgreSQL) is at major version 5, so its module path is `github.com/jackc/pgx/v5` and its packages are imported as, for example, `github.com/jackc/pgx/v5/stdlib`. Versions v0 and v1 have no suffix, so a library at version 1 is simply `github.com/example/lib`. We use pgx in the database topic later.\n\nBecause v5 and v6 have different import paths, one program can use both side by side while you migrate slowly.\n\nTry it. Run the go get command below in your module folder, then save imports.go and run `go run .`. The `_` before the import path is a blank import: it loads the package only for what it does when loaded (here it registers pgx as a database driver, the piece that talks to PostgreSQL) and gives you no name to call. Use a new empty folder with its own go mod init (for example go mod init example.com/pgxdemo), so it does not clash with an existing main.go.",
      "analogy": "Book editions. A second edition with rewritten chapters is shelved under its own title, so readers of the first edition are not surprised when the content changes. /v5 is the edition number printed on the cover: old and new editions can sit on the same shelf.",
      "code": [
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go get github.com/jackc/pgx/v5@v5.11.0\ngrep pgx go.mod",
          "output": "go: added github.com/jackc/pgx/v5 v5.11.0\n\trequire github.com/jackc/pgx/v5 v5.11.0",
          "explanation": "Pins exactly v5.11.0. On Windows PowerShell use Select-String pgx go.mod in place of grep pgx go.mod (Git Bash: grep pgx go.mod). Go may also add lines marked `// indirect` for modules that pgx itself needs, plus matching go.sum entries; the exact list can vary. Note the /v5 in the path."
        },
        {
          "language": "go",
          "filename": "imports.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\n\t_ \"github.com/jackc/pgx/v5/stdlib\" // v5 appears in the import path\n)\n\nfunc main() {\n\tfmt.Println(\"pgx v5 stdlib loaded\")\n}\n",
          "output": "pgx v5 stdlib loaded",
          "explanation": "The import path ends in /v5 before the package folder stdlib. A hypothetical version-1 library would be imported as github.com/example/lib with no suffix. Run this after the go get command above."
        }
      ],
      "productionNote": "Upgrade across major versions deliberately, as its own change, reading the library's migration notes. Because the paths differ, you can move one package at a time instead of all at once.",
      "commonMistakes": [
        "Running `go get github.com/jackc/pgx@v5.11.0` without /v5. It fails, because the module path of a v5 module must end in /v5, so Go rejects the version with the unsuffixed path.",
        "Assuming a minor or patch bump may break your code. By the semver promise only a major bump should; that is why `@latest` within the same major is usually safe.",
        "Mixing up the versions: importing `github.com/jackc/pgx/v5` in code but requiring a different major in go.mod."
      ],
      "sources": [
        {
          "title": "Go modules reference: Major version suffixes",
          "url": "https://go.dev/ref/mod#major-version-suffixes"
        },
        {
          "title": "Module version numbering",
          "url": "https://go.dev/doc/modules/version-numbers"
        }
      ]
    },
    {
      "id": "go-mod-tidy",
      "title": "go mod tidy",
      "explanation": "`go mod tidy` makes go.mod and go.sum match the code you actually have. It adds `require` lines for packages your code imports but go.mod lacks, removes requires nothing uses any more, and adds or removes the matching go.sum lines.\n\nSome require lines end with `// indirect`. That marks a dependency of a dependency: your own code does not import it, but a module you use does. Direct requires have no such comment.\n\nTry it. Use a fresh module (new empty folder, go mod init), because a pgx require left in go.mod would also pull in x/text as an indirect dependency and make the count below non-zero. Save main.go below in it after running `go get golang.org/x/text@latest`, and run `go run .`. Then replace the whole file with a program that does not import x/text (for example only `fmt.Println(\"hello\")`), and run `go mod tidy`. The x/text require line disappears from go.mod.",
      "analogy": "Tidying a pantry against the recipe list: buy what a recipe needs and the pantry lacks, and throw out the jars no recipe uses any more.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\n\t\"golang.org/x/text/cases\"\n\t\"golang.org/x/text/language\"\n)\n\nfunc main() {\n\tt := cases.Title(language.English)\n\tfmt.Println(t.String(\"hello world\"))\n}\n",
          "output": "Hello World",
          "explanation": "Uses the golang.org/x/text module to capitalize each word. While this import exists, go.mod must require golang.org/x/text."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "# after replacing main.go with a program that no longer imports x/text\ngo mod tidy\n(Select-String text go.mod).Count",
          "output": "0",
          "explanation": "go mod tidy removes the unused require line, so no line matches and the count prints 0 (in Git Bash use grep -c text go.mod). go.sum entries for it are removed too. If the module had been deleted from the code but not from go.mod, nothing else would have cleaned it up."
        }
      ],
      "productionNote": "Run `go mod tidy` before every commit that adds or removes imports. In CI, run it and then fail the build if `git diff --exit-code go.mod go.sum` shows any change, so nobody merges an untidy module.",
      "commonMistakes": [
        "Hand-editing require lines. Let go get and go mod tidy write them.",
        "Deleting code that used a library but forgetting to run tidy, leaving stale requires that slow builds and confuse readers.",
        "Removing a `// indirect` line by hand because it \"looks unused\". Tidy decides which ones are needed."
      ],
      "sources": [
        {
          "title": "Go modules reference: go mod tidy",
          "url": "https://go.dev/ref/mod#go-mod-tidy"
        },
        {
          "title": "Go 1.27 release notes",
          "url": "https://go.dev/doc/go1.27"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "How do you make a function in package price usable from other packages?",
      "options": [
        "Start its name with a capital letter, such as Total",
        "Write the keyword public before func",
        "Put it in a file named exported.go",
        "Start its name with an underscore"
      ],
      "answerIndex": 0,
      "explanation": "Go has no public or private keywords. A name that starts with a capital letter is exported; a lowercase name stays private to its package."
    },
    {
      "question": "Which code may import example.com/shop/internal/price?",
      "options": [
        "Any module on the internet that knows the path",
        "Only code inside the example.com/shop module tree",
        "Only the file price.go itself",
        "Only packages named main"
      ],
      "answerIndex": 1,
      "explanation": "The internal rule lets only code rooted at the parent of internal (here, the shop module) import it. Other modules get a build error."
    },
    {
      "question": "What is the purpose of go.sum?",
      "options": [
        "It lists the Go version your program needs",
        "It sums the prices in your shop program",
        "It stores checksums so downloaded dependencies can be verified",
        "It lists the packages in your own module"
      ],
      "answerIndex": 2,
      "explanation": "go.sum records checksums of module versions. Go compares downloads against them (and the public checksum database) to detect tampering or corruption."
    },
    {
      "question": "Why does pgx's import path end in /v5?",
      "options": [
        "Because the library has five packages",
        "Because it needs Go version 5",
        "Because the folder was numbered by the author for sorting",
        "Because module versions 2 and higher put the major version in the module path"
      ],
      "answerIndex": 3,
      "explanation": "Go's semantic import versioning puts /vN in the path for major version 2 and above, so different majors have different import paths and can coexist."
    },
    {
      "question": "What does go mod tidy remove?",
      "options": [
        "Your source files that are never run",
        "The go line from go.mod",
        "Every dependency marked // indirect",
        "require lines for modules your code no longer needs"
      ],
      "answerIndex": 3,
      "explanation": "Tidy adds missing requires and removes unused ones, updating go.sum to match. Indirect requirements that are still needed stay."
    }
  ]
});
