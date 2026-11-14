window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "01-getting-started",
  "order": 1,
  "title": "Getting Started",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7",
  "summary": "Install Go 1.27.4, check it from a terminal, and write your first program. You will run it, build it into a stand-alone executable file, group it into a module, and learn the two built-in tools that tidy and proofread your code.",
  "prerequisites": [],
  "subtopics": [
    {
      "id": "installing-go",
      "title": "Installing Go",
      "explanation": "Go is a programming language. To use it you need the Go toolchain: the set of programs that turn the text you write into something a computer can run. The most important part is the compiler, a translator that converts Go source code (the text you type) into machine instructions (the numbers a processor understands).\n\nDownload the installer for your system from https://go.dev/dl/. On Windows choose the .msi file, on macOS the .pkg file, and on Linux the .tar.gz archive (a single compressed file; the page https://go.dev/doc/install lists the exact extract steps). Run the installer and accept the defaults. This course uses Go 1.27.4.\n\nNext you need a terminal: a window where you type commands as text and press Enter to run them. On Windows, open PowerShell or Windows Terminal from the Start menu. On macOS, open the Terminal app. On Linux, open your distribution's terminal program. A command is a line of text that asks the computer to run a program, such as `go`.\n\nTo confirm that Go is installed, type `go version` and press Enter. The `go` command is the single entry point to the whole toolchain, and `version` is an argument (an extra word that tells the command what to do). It prints the installed version.\n\nThe last part of the output (for example `windows/amd64`) names your operating system and processor type, so it will differ from computer to computer. The part that matters is `go1.27.4`.",
      "analogy": "Think of a workshop toolbox. The `go` command is one box that holds every tool you need: a tool for building, one for running, one for testing, one for tidying. You do not buy a separate hammer, saw and ruler; you open the one box and pick the tool by name, such as `go version`.",
      "code": [
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go version",
          "output": "go version go1.27.4 windows/amd64",
          "explanation": "Prints the installed Go version. The `windows/amd64` ending is only an example; on a Mac with an Apple chip you would see `darwin/arm64`, and on most Linux PCs `linux/amd64`. If the line starts with `go version go1.27.4`, the installation worked."
        }
      ],
      "productionNote": "Teams make sure that everyone, including the CI server (the automated machine that builds and tests the code on every change), uses the same Go version. That way a program that builds on one computer builds the same way on all of them. Always install from go.dev/dl rather than relying on whatever version a system package manager offers.",
      "commonMistakes": [
        "Opening the terminal before installing, then seeing a message such as `go: command not found` (or `'go' is not recognized` on Windows). A terminal reads its settings when it opens, so close it and open a new one after the install.",
        "Installing an old Go from an operating-system package list instead of from go.dev/dl, and so getting an older version than this course uses. Check the number printed by `go version`."
      ],
      "sources": [
        { "title": "Download and install Go", "url": "https://go.dev/doc/install" },
        { "title": "Go downloads", "url": "https://go.dev/dl/" }
      ]
    },
    {
      "id": "first-program",
      "title": "Your first program (package main, func main, fmt.Println)",
      "explanation": "A Go program is written in a plain text file whose name ends in `.go`. Create a new folder anywhere you like (for example `hello` in your home folder), open it in a text editor such as VS Code, and create a file in it called `hello.go` with the code below.\n\nThe first line, `package main`, declares which package the file belongs to. A package is a labelled drawer of related code. The special name `main` tells Go that this file is a program you can run, not a drawer of tools meant for other programs to borrow.\n\nThe line `import \"fmt\"` brings in another package, `fmt` (short for format), which comes with Go and contains tools for printing text. Text written between double quotes, like `\"fmt\"`, is called a string.\n\nThe line `func main() {` defines a function: a named block of instructions. The function named `main` is special; it is the start point, and Go begins running your program there. Everything between the braces `{` and `}` belongs to the function.\n\nInside it, `fmt.Println(\"Hello, Go!\")` calls (runs) the `Println` function from the `fmt` package. The text in the parentheses is the argument, the value handed to the function. `Println` prints it followed by a new line.\n\nA comment is a note for human readers. Everything after `//` on a line is ignored by the compiler.\n\nGo is strict, and the compiler refuses to build code that has some kinds of mistakes. For example, importing a package that you never use is an error. When you import several packages you can group them in parentheses, one per line, as shown in the second example.",
      "analogy": "Picture a house with exactly one front door. `package main` is the sign saying \"people may enter this house\", and `func main` is the front door itself. Every visit, that is every run of the program, begins at that door and goes inside from there. Importing a package you never use is like holding a ticket for a show you never attend; the house will not let you carry it in.",
      "code": [
        {
          "language": "go",
          "filename": "hello.go",
          "source": "package main\n\nimport \"fmt\"\n\n// main is where the program starts.\nfunc main() {\n\tfmt.Println(\"Hello, Go!\")\n}\n",
          "output": "",
          "explanation": "This is the complete first program. It prints nothing by itself until you run it, which the next sub-topic shows. The indentation before `fmt.Println` is a single tab character, the standard Go style."
        },
        {
          "language": "go",
          "filename": "unused.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"os\"\n)\n\nfunc main() {\n\tfmt.Println(\"Hello, Go!\")\n}\n",
          "output": "# command-line-arguments\n./unused.go:5:2: \"os\" imported and not used",
          "explanation": "The package `os` is imported but never used, so the compiler stops with an error. The output shows the error you would see after running `go run unused.go` (explained next). The message gives the file, the line number (5) and the column (2), then the problem. Delete the `\"os\"` line to fix it."
        }
      ],
      "productionNote": "Every Go program, from a small command-line tool to a large web service, has exactly one `main` package containing exactly one `main` function. Real projects put the rest of their code into other packages and keep `main` short.",
      "commonMistakes": [
        "Leaving an import that is not used. Go reports a compile error (an error found while translating the code, before anything runs), with a message ending in `imported and not used`, for example `\"os\" imported and not used`.",
        "Putting the opening brace on its own line, as `func main()` followed by a new line and then `{`. Go does not accept that and fails to compile; the `{` must be on the same line as `func main()`.",
        "Writing `fmt.println` with a small p. In Go a name that starts with a capital letter is available to other packages, so the function is `Println` with a capital P."
      ],
      "sources": [
        { "title": "Tutorial: Get started with Go", "url": "https://go.dev/doc/tutorial/getting-started" },
        { "title": "Go specification: Program execution", "url": "https://go.dev/ref/spec#Program_execution" }
      ]
    },
    {
      "id": "go-run-and-go-build",
      "title": "go run and go build",
      "explanation": "Open a terminal in the folder that holds `hello.go`. On Windows you can open the folder in File Explorer, click the address bar, type `powershell` and press Enter. In VS Code you can use the menu Terminal, New Terminal, which opens in the project folder. Anywhere else, use the `cd` command (change directory) followed by the folder path.\n\nThe command `go run hello.go` compiles the program into a temporary file, runs it, and then throws the temporary file away. It is the quickest way to try your code while you are writing it.\n\nThe command `go build hello.go` compiles the program and keeps the result as a binary, also called an executable: a file your operating system can run directly. It is named `hello` on macOS and Linux and `hello.exe` on Windows, and it appears in the same folder.\n\nRun it by typing `./hello` on macOS and Linux, or `.\\hello.exe` on Windows PowerShell. The `./` or `.\\` means \"in this folder\". The binary contains everything it needs, so you can copy it to another computer of the same kind and run it there even though Go is not installed on that computer.",
      "analogy": "`go run` is cooking and eating at the stove: you get your meal right away, and nothing is left over. `go build` is cooking and packing a lunchbox: you get something you can carry anywhere and eat later, with no kitchen needed.",
      "code": [
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go run hello.go\ngo build hello.go\n./hello",
          "output": "Hello, Go!\nHello, Go!",
          "explanation": "The first command compiles and runs the program, printing the greeting once and leaving no file behind. The second command prints nothing but creates the `hello` binary. The third command runs that binary and prints the greeting again. On Windows PowerShell use `.\\hello.exe` for the last line."
        }
      ],
      "productionNote": "During development you use `go run` for quick checks. For anything you ship or deploy, you build a binary, because it is a single file that runs on a server with no Go installed. Later topics cover building for other systems and for deployment in more depth.",
      "commonMistakes": [
        "Expecting `go run` to leave a program file behind. It does not; use `go build` when you want the binary.",
        "Committing built binaries to version control (a system such as Git that records the history of your files). Binaries are large and can be rebuilt at any time from the source, so keep only the source code."
      ],
      "sources": [
        { "title": "go command: compile and run Go program", "url": "https://pkg.go.dev/cmd/go#hdr-Compile_and_run_Go_program" },
        { "title": "go command: compile packages and dependencies", "url": "https://pkg.go.dev/cmd/go#hdr-Compile_packages_and_dependencies" }
      ]
    },
    {
      "id": "modules-go-mod-init",
      "title": "Modules with go mod init",
      "explanation": "Real projects have many files, so Go groups them into a module: a project folder that Go tracks as one unit. A module is described by a file called `go.mod` at the top of the folder.\n\nCreate one with `go mod init` followed by the module path, which is the name of the module. The path is usually the web address of the repository (the online home of the code), such as `github.com/yourname/hello`. For practice, `example.com/hello` works fine. Use lowercase letters and no spaces.\n\nThe command creates `go.mod`. Its first line is `module example.com/hello`. A second line starting with `go` names the Go version the module expects. The number on that line depends on the Go toolchain you have installed, so do not worry if your number is not the same as someone else's.\n\nOnce a folder is a module, you can run the package in the current folder with `go run .`. The dot means \"the current folder\". This works without naming each file, which is handy once you have more than one. Topic 12 explains modules in more depth.\n\nIf you already made the hello folder in the first sub-topic, skip the mkdir line. Run only `cd hello` (from the folder that contains hello) and then `go mod init example.com/hello`.",
      "analogy": "`go.mod` is the project's ID card. It states the project's name (the module path) and which Go version it expects, so anyone who picks up the project knows what it is and how to work with it.",
      "code": [
        {
          "language": "bash",
          "filename": "terminal",
          "source": "mkdir hello\ncd hello\ngo mod init example.com/hello",
          "output": "go: creating new go.mod: module example.com/hello",
          "explanation": "`mkdir hello` makes a new folder, `cd hello` moves into it, and `go mod init example.com/hello` creates the `go.mod` file inside it."
        },
        {
          "language": "text",
          "filename": "go.mod",
          "source": "module example.com/hello\n\ngo 1.27.4\n",
          "output": "",
          "explanation": "The first line is always the module path you gave. The `go` line holds a version number chosen from your toolchain, so yours may show a slightly different number; do not copy it from here."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go run .",
          "output": "Hello, Go!",
          "explanation": "With `hello.go` saved inside this folder, `go run .` runs the package in the current folder. It finds the `main` function by itself."
        }
      ],
      "productionNote": "Every real Go project starts with a `go.mod` file. It is also where dependencies (other people's packages that your project uses) get recorded, which a later topic covers.",
      "commonMistakes": [
        "Running `go run .` in a folder that has no `go.mod`. Go reports an error that mentions `go.mod file not found`. Run `go mod init` first, or run `go run hello.go` with the file name.",
        "Choosing a module path with spaces or capital letters. Stick to lowercase letters, digits, dots, dashes and slashes."
      ],
      "sources": [
        { "title": "Go Modules Reference: go mod init", "url": "https://go.dev/ref/mod#go-mod-init" },
        { "title": "Tutorial: Create a Go module", "url": "https://go.dev/doc/tutorial/create-module" }
      ]
    },
    {
      "id": "gofmt-and-go-vet",
      "title": "gofmt and go vet",
      "explanation": "Go comes with two helpers that keep your code tidy and catch slips. The first is `gofmt`, a formatter: it rewrites your code into the single standard Go layout. It uses tabs for indentation, so Go code looks the same everywhere and nobody argues about style.\n\nThe command `gofmt -l hello.go` lists (the `-l` flag) the files whose layout would change, and prints nothing if a file is already tidy. The command `gofmt -w hello.go` rewrites the file in place (`-w` means write). `go fmt ./...` does the same for a whole project. The `./...` pattern means \"this folder and every folder below it\".\n\nThe second helper is `go vet`, which reports suspicious code that compiles successfully but is probably a mistake. A typical case is a wrong placeholder in `fmt.Printf`, a print function that fills in values at marked places such as `%d`, which stands for a whole number. Giving it text instead of a number is almost certainly a bug.\n\nThe vet example below prints a warning with the file name, line and column first. Those details vary with where you saved the file, so it is the message at the end that matters.",
      "analogy": "`gofmt` is a laundry machine that folds every shirt in exactly the same way, whoever wore it. `go vet` is a proofreader who reads a sentence that is spelled correctly and says, \"this is grammatical, but it probably is not what you meant\".",
      "code": [
        {
          "language": "go",
          "filename": "messy.go",
          "source": "package main\nimport \"fmt\"\nfunc main() {\nfmt.Println(\"hi\")\n}\n",
          "output": "",
          "explanation": "This program compiles and runs, but it is not indented. The `fmt.Println` line should start with a tab."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "gofmt -l messy.go\ngofmt -w messy.go\ngofmt -l messy.go",
          "output": "messy.go",
          "explanation": "The first command prints the name of the file because its layout would change. The second rewrites the file with correct indentation and prints nothing. The third prints nothing, because the file is now tidy."
        },
        {
          "language": "go",
          "filename": "vetme.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Printf(\"%d\\n\", \"hi\")\n}\n",
          "output": "",
          "explanation": "This compiles, but `%d` expects a whole number and the argument is the text \"hi\". The `\\n` at the end of the first string means a new line."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go vet vetme.go",
          "output": "# command-line-arguments\n./vetme.go:6:2: fmt.Printf format %d has arg \"hi\" of wrong type untyped string",
          "explanation": "Vet reports line 6, column 2 and says that the `%d` placeholder was given a value of the wrong type. The exact path prefix depends on how you run the command."
        }
      ],
      "productionNote": "Editors are normally set up to run gofmt each time you save. CI servers usually run `go vet ./...` on every change, and `go test` (covered later) runs a smaller set of vet checks automatically.",
      "commonMistakes": [
        "Aligning code by hand with spaces and then fighting the formatter. Let gofmt decide the layout and do not fight it.",
        "Ignoring `go vet` warnings because the program still runs. Each warning points at code that is very likely wrong."
      ],
      "sources": [
        { "title": "gofmt command", "url": "https://pkg.go.dev/cmd/gofmt" },
        { "title": "vet command", "url": "https://pkg.go.dev/cmd/vet" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Which line marks a Go file as a program that can be run directly?",
      "options": [
        "import \"fmt\"",
        "package main",
        "// main",
        "go run ."
      ],
      "answerIndex": 1,
      "explanation": "`package main` tells Go that the file is a runnable program. `import \"fmt\"` only brings in printing tools, `//` starts a comment that Go ignores, and `go run .` is a terminal command, not a line inside a file."
    },
    {
      "question": "What is the difference between `go run hello.go` and `go build hello.go`?",
      "options": [
        "`go run` leaves a binary file behind and `go build` does not",
        "`go build` only checks the spelling and never creates a file",
        "`go build` leaves a binary file you can run later, while `go run` compiles to a temporary file and removes it",
        "They are the same command with different names"
      ],
      "answerIndex": 2,
      "explanation": "`go run` compiles to a temporary file, runs it and discards it. `go build` keeps the executable (`hello` or `hello.exe`) so you can run or ship it later."
    },
    {
      "question": "What happens if you import a package, such as `\"os\"`, and never use it?",
      "options": [
        "The program compiles and runs, with a small speed cost",
        "The compiler reports an error ending in `imported and not used`",
        "Go removes the line for you when it runs",
        "Only `go vet` complains, and the program still builds"
      ],
      "answerIndex": 1,
      "explanation": "An unused import is a compile error in Go, so the program does not build until you remove the import or use the package."
    },
    {
      "question": "What does the `go.mod` file record?",
      "options": [
        "The output of the last run of the program",
        "The names of all the functions in the project",
        "The module path (the project's name) and the Go version it expects",
        "The folder where the Go compiler is installed"
      ],
      "answerIndex": 2,
      "explanation": "`go.mod` holds the module path on its `module` line and the Go version on its `go` line. It is the project's ID card."
    },
    {
      "question": "Which tool reports that `fmt.Printf(\"%d\\n\", \"hi\")` uses the wrong placeholder for the value?",
      "options": [
        "go vet",
        "gofmt",
        "go version",
        "go mod init"
      ],
      "answerIndex": 0,
      "explanation": "`go vet` finds code that compiles but is probably wrong, such as a `%d` placeholder given text. `gofmt` only changes layout, `go version` prints the version, and `go mod init` creates `go.mod`."
    }
  ]
});
