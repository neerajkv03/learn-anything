window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "25-build-deploy",
  "order": 25,
  "title": "Building & Shipping",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Learn how to turn your Go program into a release-ready file: build it with a version number stamped in, compile it for other operating systems and CPUs, and install or pin command-line tools. Then measure a running service with pprof (Go's built-in profiler) and package it into a small, safe Docker container image (Docker is a tool that packs a program into a standard box called an image; the last sub-topic explains it).",
  "prerequisites": [
    "24-database-sql"
  ],
  "subtopics": [
    {
      "id": "build-flags-ldflags",
      "title": "go build flags and -ldflags version stamping",
      "explanation": "You already know that `go build` turns your code into a single executable file (a binary). For a release you usually want three extra things: a predictable output location, no traces of your personal computer's folder names inside the file, and a version number so you can tell which build is running.\n\nUse `-o` to choose the output path: `go build -o bin/app .` writes the binary to `bin/app` (the `.` means the package in the current folder; if your program lives in `cmd/app`, as taught in the packages topic, write `./cmd/app` instead). On Windows the file gets an `.exe` ending, for example `bin/app.exe`.\n\nThe flag `-trimpath` removes your local folder paths (such as `C:\\Users\\me\\code\\shop`) from the binary. Without it, those paths end up in error stack traces (the list of function calls printed when a program crashes) and in the file itself. With it, builds made on different machines look the same, and you do not leak details about your computer.\n\nThe flag `-ldflags` passes options to the linker. The linker is the last step of building: it joins all compiled pieces into one executable. Two options are common. `-s -w` removes the symbol table (the list of function and variable names) and the debugging information (data that debuggers use), which makes the file noticeably smaller. `-X main.version=1.2.0` sets a string variable inside your program at link time: `main` is the package name, `version` is the variable name, and `1.2.0` is the value.\n\nFor `-X` to work, your code needs a package-level variable of type string, such as `var version = \"dev\"`. The value `\"dev\"` is the default you get when you build without `-X`, for example during `go run`. The example below reads it through a command-line flag (taught in the logging and config topic).\n\nTo inspect a finished binary, run `go version -m bin/app`. It prints the Go version that built it, the module path, and the build settings used (including `-trimpath` and `-ldflags`, and version-control information when the project is in a git repository; git is a tool that saves the history of your code changes). Inside your own program you can read the same data with `debug.ReadBuildInfo()` from the standard `runtime/debug` package. It returns a description of the build (and a bool that says whether it is available), which is handy for a `/version` endpoint (a web address on your server that returns the version).",
      "analogy": "A factory stamps a batch number on every product as it leaves the line. The code is the same product each time, but the stamp (`-X main.version=1.2.0`) tells support exactly which batch a customer has. `-trimpath` is like removing the factory-floor scribbles from the packaging, and `-s -w` is like leaving the assembly notes behind so the box is lighter.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"flag\"\n\t\"fmt\"\n)\n\n// version is replaced at build time with -ldflags \"-X main.version=...\".\nvar version = \"dev\"\n\nfunc main() {\n\tshowVersion := flag.Bool(\"version\", false, \"print the version and exit\")\n\tflag.Parse()\n\n\tif *showVersion {\n\t\tfmt.Println(version)\n\t\treturn\n\t}\n\tfmt.Println(\"shop service starting\")\n}\n",
          "output": "",
          "explanation": "Save this as main.go in a folder that already has a go.mod (create one with `go mod init example.com/shop` if needed). Run without -version, it prints `shop service starting` and exits; with -version it prints only the version. The next two terminal examples show the -version runs."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go run . -version\ngo build -trimpath -ldflags=\"-s -w -X main.version=1.2.0\" -o bin/app .\n./bin/app -version",
          "output": "dev\n1.2.0",
          "explanation": "go run uses the default \"dev\". The build command prints nothing on success. The built binary prints 1.2.0 because -X replaced the variable. On Windows PowerShell, wrap the whole flag in single quotes: '-ldflags=-s -w -X main.version=1.2.0', and run .\\bin\\app.exe -version."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go version -m bin/app",
          "output": "bin/app: go1.27.4\n\tpath\texample.com/shop\n\tmod\texample.com/shop\t(devel)\n\tbuild\t-buildmode=exe\n\tbuild\t-compiler=gc\n\tbuild\t-trimpath=true\n\tbuild\t-ldflags=\"-s -w -X main.version=1.2.0\"",
          "explanation": "Representative output: more build lines (such as CGO_ENABLED, GOARCH, GOOS) follow, and they depend on your machine. The build info survives -s -w, so you can always see how a binary was built."
        }
      ],
      "productionNote": "Stamp every release build with a version (many teams use the git tag) and expose it: print it with a -version flag, return it from a `/version` endpoint, and add it to every log line at startup, so that during an incident you know exactly which build is running. Always build releases with -trimpath so that they are reproducible (the same input gives the same file) on any machine.",
      "commonMistakes": [
        "Using -X on a constant (`const version = ...`) or on a variable that is not a string. The linker silently ignores it and you ship \"dev\" without any error. Use `var version = \"dev\"`.",
        "Using the wrong package path. For a variable in package main, `main.version` is correct. For a variable in another package, you must use that package's full import path, for example `-X example.com/shop/internal/build.Version=1.2.0`.",
        "Forgetting quotes around the -ldflags value, so the shell splits `-s -w -X main.version=1.2.0` into separate arguments and the build fails or misbehaves."
      ],
      "sources": [
        {
          "title": "go command: Compile packages and dependencies",
          "url": "https://pkg.go.dev/cmd/go#hdr-Compile_packages_and_dependencies"
        },
        {
          "title": "cmd/link (the linker)",
          "url": "https://pkg.go.dev/cmd/link"
        },
        {
          "title": "runtime/debug.ReadBuildInfo",
          "url": "https://pkg.go.dev/runtime/debug#ReadBuildInfo"
        }
      ]
    },
    {
      "id": "cross-compiling",
      "title": "Cross-compiling with GOOS/GOARCH",
      "explanation": "Cross-compiling means building a binary on one computer for a different operating system or CPU. Go makes this easy because the compiler already knows how to produce code for many targets.\n\nTwo environment variables (named settings that programs can read, taught in the logging and config topic) choose the target. `GOOS` is the operating system, for example `linux`, `windows` or `darwin` (macOS). `GOARCH` is the CPU architecture, for example `amd64` (common 64-bit Intel/AMD) or `arm64` (common in Apple laptops, Raspberry Pi and ARM cloud servers).\n\nIn bash, set them just for one command by putting them in front: `GOOS=linux GOARCH=arm64 go build -o app-linux-arm64 .`. In PowerShell, set them on separate lines first (`$env:GOOS = \"linux\"` and `$env:GOARCH = \"arm64\"`), then run `go build -o app-linux-arm64 .`. PowerShell keeps these values for the whole terminal session, so afterwards remove them with `Remove-Item Env:GOOS` and `Remove-Item Env:GOARCH`, or every later build will also target Linux.\n\nTo see all valid targets, run `go tool dist list`. Each line is `os/arch`, such as `linux/arm64`.\n\nA third variable, `CGO_ENABLED=0`, turns off cgo. cgo is the feature that lets Go call C code; it needs a C compiler for the target platform, which makes cross builds hard. With `CGO_ENABLED=0` you get a fully static binary (it needs no other files or libraries from the operating system) and cross-compiling just works. Pure-Go libraries, including the pgx database driver from the previous topic, work fine this way.\n\nYou cannot run a binary built for another target on your own machine. A `linux/arm64` file will not start on Windows; copy it to the target machine instead. You can still inspect it with `go version -m`.",
      "analogy": "Printing the same instruction manual in another language for a different country. The content (your program) is identical; only the language (OS) and the reader's habits (CPU) change. You can print the French manual in your own office, but you cannot read it aloud as a French speaker would; it has to be shipped to France to be used.",
      "code": [
        {
          "language": "bash",
          "filename": "terminal",
          "source": "GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -o app-linux-arm64 .\ngo version -m app-linux-arm64 | grep -E \"GOOS|GOARCH\"\ngo tool dist list | grep linux/arm64",
          "output": "\tbuild\tGOARCH=arm64\n\tbuild\tGOOS=linux\nlinux/arm64",
          "explanation": "The first command builds a Linux ARM64 binary and prints nothing. The second filters the build info to show the target that was recorded. The third confirms linux/arm64 is a supported target. (grep is available in bash on Linux, macOS and Git Bash on Windows.)"
        },
        {
          "language": "powershell",
          "filename": "terminal",
          "source": "$env:GOOS = \"linux\"\n$env:GOARCH = \"arm64\"\n$env:CGO_ENABLED = \"0\"\ngo build -trimpath -o app-linux-arm64 .\nRemove-Item Env:GOOS\nRemove-Item Env:GOARCH\nRemove-Item Env:CGO_ENABLED\ngo version -m app-linux-arm64 | Select-String \"GOOS|GOARCH\"",
          "output": "\tbuild\tGOARCH=arm64\n\tbuild\tGOOS=linux",
          "explanation": "The same build in PowerShell. The Remove-Item lines clean up so later builds target your own machine again. Select-String is PowerShell's grep."
        }
      ],
      "productionNote": "Most teams build Linux binaries on Windows or Mac laptops and in CI (continuous integration: an automatic server that builds and tests every change) for servers and ARM cloud machines. Setting CGO_ENABLED=0 explicitly in release builds makes the result static and portable, and avoids surprises when the build machine happens to have a C compiler.",
      "commonMistakes": [
        "Forgetting that `$env:GOOS` in PowerShell stays set for the whole session, so later `go build` or `go run` commands keep targeting Linux. Remove the variables when done.",
        "Using a package that needs cgo (it contains C code) and getting build errors when cross-compiling. Either choose a pure-Go alternative or build on the target platform.",
        "Trying to run a cross-compiled binary on the build machine and getting a \"not a valid executable\" style error."
      ],
      "sources": [
        {
          "title": "Installing Go from source: environment variables",
          "url": "https://go.dev/doc/install/source#environment"
        },
        {
          "title": "go command: Environment variables",
          "url": "https://pkg.go.dev/cmd/go#hdr-Environment_variables"
        }
      ]
    },
    {
      "id": "go-install-and-tools",
      "title": "go install and tools",
      "explanation": "Many Go projects rely on command-line tools: code generators (programs that write Go code for you), linters (programs that check code for problems) and so on. Go can download, build and install these tools straight from their source code.\n\n`go install` builds a program and puts the binary in a folder. For example, `go install golang.org/x/tools/cmd/stringer@latest` installs `stringer`, a tool that generates `String()` methods for your enum-like types (types with a fixed set of named values, like Weekday in topic 02). The `@latest` suffix means the newest release; you can write a specific version such as `@v0.30.0` instead. The binary goes to the folder printed by `go env GOPATH` (GOPATH is the Go workspace folder on your computer) plus `/bin` (or the folder in the `GOBIN` variable if you set it).\n\nAdd that folder to your PATH (the list of folders your terminal searches for commands). On Windows: run `go env GOPATH` in PowerShell, then open Start, search for 'Edit the environment variables for your account', select Path, click Edit, click New, paste the folder printed by GOPATH with `\\bin` added, click OK, and open a new PowerShell window. Otherwise typing `stringer` says command not found.\n\nThis installs the tool globally on your machine, and different projects may then need different versions. Since Go 1.24 there is a better way for project tools: the `tool` directive in `go.mod`. A directive is a line in `go.mod` with a special meaning, like the `require` lines you saw before.\n\nRun `go get -tool golang.org/x/tools/cmd/stringer` inside your module. It adds the line `tool golang.org/x/tools/cmd/stringer` to `go.mod` and records the exact version in the usual dependency lines and in `go.sum`. Then run the tool with `go tool stringer`, which builds it if needed using the pinned version. Everyone who clones (downloads a copy of) the project, and your CI, gets the same version automatically.\n\nNote that plain `go get` no longer installs binaries; it only changes the dependencies in `go.mod`.",
      "analogy": "Installing an app on your phone is `go install`: one copy for you, whatever version was latest. Keeping a specific tool in the project's own toolbox is `go get -tool`: the toolbox is checked into the project, so every teammate (and the build server) opens it and finds exactly the same version of the tool.",
      "code": [
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go install golang.org/x/tools/cmd/stringer@latest\ngo env GOPATH\ngo get -tool golang.org/x/tools/cmd/stringer\ngrep \"^tool\" go.mod\ngo tool stringer -help",
          "output": "/home/me/go\ngo: added golang.org/x/tools v0.x.y\ntool golang.org/x/tools/cmd/stringer\nUsage of stringer: (usage text omitted)",
          "explanation": "Representative output. The install prints nothing on success and the binary lands in /home/me/go/bin (your path will differ). go get -tool lists the modules it added (versions vary), and go.mod now contains the tool line. The last command prints the tool's usage text, which we do not quote here. On PowerShell, use Select-String \"^tool\" go.mod instead of grep."
        }
      ],
      "productionNote": "Pin code generators and linters with `tool` directives so that local runs and CI use identical versions, and call them with `go tool <name>` (for example in a build script). Keep `go install ...@version` for personal utilities you want on your PATH.",
      "commonMistakes": [
        "Running `go get some/tool` and expecting a runnable binary. Use `go install` for a global binary or `go get -tool` for a project tool.",
        "Installing a tool but not having the GOPATH `bin` folder on PATH, so the shell cannot find it.",
        "Using `@latest` in team scripts, which makes builds change when a new release appears. Prefer the `tool` directive or an explicit version."
      ],
      "sources": [
        {
          "title": "go command: Compile and install packages and dependencies",
          "url": "https://pkg.go.dev/cmd/go#hdr-Compile_and_install_packages_and_dependencies"
        },
        {
          "title": "Managing dependencies: tools",
          "url": "https://go.dev/doc/modules/managing-dependencies#tools"
        }
      ]
    },
    {
      "id": "profiling-pprof",
      "title": "Profiling with pprof",
      "explanation": "A profile is a measurement of where a running program spends its resources: which functions use the most CPU time, which allocate the most memory, and so on. Without a profile, performance tuning is guessing. pprof is Go's standard tool for collecting and reading profiles.\n\nThe easiest way to profile a service is the `net/http/pprof` package. Importing it with a blank import (`import _ \"net/http/pprof\"`, which runs the package's setup code without using its names) registers pages under `/debug/pprof/` on `http.DefaultServeMux`. That is the shared default router of the `net/http` package, used whenever you pass `nil` as the handler to `http.ListenAndServe`.\n\nThese pages expose internals of your program, so do not put them on your public port. Instead, start a second server in its own goroutine that listens only on `localhost` (the loopback address, reachable only from the same machine), for example on port 6060 (a port is a number that picks one network service on a machine). Serve your real API from a separate `ServeMux` that you create yourself, so the pprof routes are not on it. The example below does exactly that.\n\nTo collect a 30-second CPU profile while the service is busy, run `go tool pprof \"http://localhost:6060/debug/pprof/profile?seconds=30\"`. Keep the quotes, because `?` has a special meaning in some shells (the programs that read the commands you type). When the prompt `(pprof)` appears, type `top`. It lists functions sorted by cost. The numbers differ on every run.\n\nThe table has five columns: `flat` (time spent in the function itself), `flat%` (that time as a percent), `sum%` (running total of the percentages), `cum` (time in the function plus everything it calls) and `cum%` (that as a percent).\n\nOther useful profiles live at other URLs. `/debug/pprof/heap` shows what memory is currently in use, and works the same way: `go tool pprof http://localhost:6060/debug/pprof/heap`. In Go 1.27 the `goroutineleak` profile is generally available at `/debug/pprof/goroutineleak`; it reports goroutines that are stuck forever, for example waiting on a channel that nothing can ever send to. These leaks slowly eat memory.\n\nFor code under test, `go test -cpuprofile cpu.out` writes a CPU profile to a file, and `go tool pprof cpu.out` opens it.",
      "analogy": "A health check-up scan. The heat map shows which organs (functions) work hardest, so the doctor treats the real problem rather than guessing. Like a scan machine, pprof sits in a separate room (a localhost-only port): patients' records should not be visible in the public waiting area.",
      "code": [
        {
          "language": "go",
          "filename": "pprof.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"log\"\n\t\"net/http\"\n\t_ \"net/http/pprof\" // registers /debug/pprof/ on http.DefaultServeMux\n)\n\n// busy burns CPU so the profile has something to show.\nfunc busy(n int) int {\n\ttotal := 0\n\tfor i := 0; i < n; i++ {\n\t\ttotal += i % 7\n\t}\n\treturn total\n}\n\nfunc main() {\n\t// Debug server: localhost only, uses the default mux where pprof registered itself.\n\tgo func() {\n\t\tlog.Println(http.ListenAndServe(\"localhost:6060\", nil))\n\t}()\n\n\t// Public server: its own mux, so pprof routes are NOT reachable here.\n\tmux := http.NewServeMux()\n\tmux.HandleFunc(\"GET /work\", func(w http.ResponseWriter, r *http.Request) {\n\t\tbusy(200000000)\n\t\tfmt.Fprintln(w, \"done\")\n\t})\n\tlog.Fatal(http.ListenAndServe(\":8080\", mux))\n}\n",
          "output": "",
          "explanation": "Save as pprof.go in a folder that has a go.mod, and start it with `go run .`. It prints nothing and keeps running until you stop it with Ctrl+C. Each request to /work burns CPU for a moment. The pprof pages exist only on localhost:6060."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "# terminal 1: go run .\n# terminal 2: generate load (bash)\nfor i in $(seq 1 60); do curl -s http://localhost:8080/work > /dev/null; done &\n# terminal 3: collect a 30 second CPU profile, then type top\ngo tool pprof \"http://localhost:6060/debug/pprof/profile?seconds=30\"",
          "output": "(pprof) top\n      flat  flat%   sum%        cum   cum%\n(values vary: main.busy should appear near the top)",
          "explanation": "The numbers differ on every run, so only the column layout is shown. If the profile is working, main.busy sits at or near the top. In PowerShell, generate the load with: 1..60 | ForEach-Object { curl.exe -s http://localhost:8080/work | Out-Null }"
        }
      ],
      "productionNote": "Use pprof to diagnose CPU spikes, memory growth and goroutine leaks on a real service. Keep the debug port bound to localhost (or behind your internal network and authentication) and reach it from your own machine through a secure tunnel (an encrypted connection to the server, for example over SSH) or by running the command on the server. Always take a profile before optimizing, so you fix the function that is actually slow.",
      "commonMistakes": [
        "Serving /debug/pprof on the public port. It leaks internals of your program and lets anyone trigger expensive profiling. Use a separate localhost-only listener.",
        "Passing nil as the handler of your main public server after importing net/http/pprof, which silently exposes the pprof routes there. Build your own ServeMux for public traffic.",
        "Optimizing code by intuition without a profile, then finding the real bottleneck is somewhere else."
      ],
      "sources": [
        {
          "title": "net/http/pprof",
          "url": "https://pkg.go.dev/net/http/pprof"
        },
        {
          "title": "Profiling Go Programs (Go blog)",
          "url": "https://go.dev/blog/pprof"
        },
        {
          "title": "Diagnostics",
          "url": "https://go.dev/doc/diagnostics"
        }
      ]
    },
    {
      "id": "minimal-docker-image",
      "title": "Minimal Docker image",
      "explanation": "A container image is a package that holds your app plus the minimal operating-system files it needs, so it runs the same way on your laptop, in CI and on a cloud server. Docker is the most common tool for building and running images. A file named `Dockerfile` lists the build steps.\n\nInstall Docker Desktop for Windows from docker.com, run the installer, start Docker Desktop and wait until it says it is running, then check it works by typing `docker --version` in PowerShell; it prints a version number.\n\nThe golang image contains the whole Go toolchain and is hundreds of megabytes. You do not need a compiler to run a finished binary, so a multi-stage build uses two stages: the first stage builds the program, the second stage starts from a tiny base and copies in only the binary. A stage starts with a `FROM` line.\n\nIn the build stage, `FROM golang:1.27 AS build` names the stage `build`. `WORKDIR /src` sets the working folder inside the image.\n\n`COPY go.mod go.sum ./` followed by `RUN go mod download` fetches dependencies first. Docker caches each step as a layer and reuses it if its inputs did not change, so dependencies are only downloaded again when go.mod or go.sum change.\n\nOnly then `COPY . .` copies your source code, and `RUN CGO_ENABLED=0 go build ...` builds a static binary, using flags from the earlier sub-topics.\n\nThe runtime stage starts with `FROM gcr.io/distroless/static-debian12:nonroot`. Distroless images contain almost nothing: no shell and no package manager, only the basics a static program needs (such as root certificates (files that let the program trust encrypted HTTPS web connections) and time zone data). The `nonroot` tag means the image has an unprivileged user, so a hacked program cannot act as an administrator inside the container.\n\n`COPY --from=build /app /app` takes the binary from the first stage, `USER nonroot:nonroot` makes the program run as that user, and `ENTRYPOINT [\"/app\"]` is the command that starts when the container runs.\n\nThe square-bracket form runs your program directly, so it receives the stop signal (SIGTERM) from Docker and your graceful shutdown code from the HTTP server topic works.\n\nBuild and run with `docker build -t shop:1.2.0 .` (`-t` gives the image a name and tag, and the final `.` is the folder with the Dockerfile) and `docker run -p 8080:8080 -e DATABASE_URL=... shop:1.2.0`. `-p 8080:8080` connects port 8080 on your machine to port 8080 in the container, and `-e` sets an environment variable inside it, which is how the configuration approach from the logging and config topic reaches your service. Replace `...` with your real connection string. The final image is much smaller than the build image.",
      "analogy": "A shipping container that holds only the finished product, not the factory machines that made it. The first stage is the factory, full of tools, where the product is made. Only the finished product is moved into the clean, light container that is shipped to customers.",
      "code": [
        {
          "language": "docker",
          "filename": "Dockerfile",
          "source": "# ---- build stage: has the Go toolchain ----\nFROM golang:1.27 AS build\nWORKDIR /src\n\n# Copy dependency files first so this layer is cached until they change.\nCOPY go.mod go.sum ./\nRUN go mod download\n\nCOPY . .\nARG VERSION=dev\nRUN CGO_ENABLED=0 go build -trimpath -ldflags=\"-s -w -X main.version=${VERSION}\" -o /app ./cmd/app\n\n# ---- runtime stage: tiny base, no shell, no compiler ----\nFROM gcr.io/distroless/static-debian12:nonroot\nCOPY --from=build /app /app\nUSER nonroot:nonroot\nENTRYPOINT [\"/app\"]\n",
          "output": "",
          "explanation": "Save as Dockerfile (no extension) in the module root, next to go.mod. It assumes the program is in cmd/app and has a `var version` in package main. ARG VERSION lets you pass the version at build time. Only the last stage ends up in the final image."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "docker build --build-arg VERSION=1.2.0 -t shop:1.2.0 .\ndocker run -p 8080:8080 -e DATABASE_URL=\"postgres://user:pass@host.docker.internal:5432/shop\" shop:1.2.0",
          "output": "",
          "explanation": "The build prints many progress lines (not shown). The run command starts your service and keeps running until you press Ctrl+C. The DATABASE_URL value here is only an example; use your own database address."
        }
      ],
      "productionNote": "This is the shape of most Go deployments to Kubernetes (a system that runs containers across many machines), Cloud Run or ECS (cloud services that run containers for you): build the image in CI, tag it with the version, push it to a registry (a server that stores images) and let the platform run it. Add a `.dockerignore` file listing things like `.git` and local `bin/` folders so they are not sent to Docker when building.",
      "commonMistakes": [
        "Shipping the full golang image as the runtime image. It is huge and contains tools an attacker could use. Use a multi-stage build.",
        "Building with cgo enabled and running on a static base image. The binary needs C libraries that are not there, so the container fails to start. Set CGO_ENABLED=0.",
        "Copying all the source before go.mod and go.sum, so every code change invalidates the cached dependency download and the build becomes slow."
      ],
      "sources": [
        {
          "title": "Docker docs: Multi-stage builds",
          "url": "https://docs.docker.com/build/building/multi-stage/"
        },
        {
          "title": "Distroless images",
          "url": "https://github.com/GoogleContainerTools/distroless"
        },
        {
          "title": "Docker Hub: golang official image",
          "url": "https://hub.docker.com/_/golang"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "You build with `go build -ldflags=\"-X main.version=1.2.0\" -o bin/app .` and the code has `var version = \"dev\"` in package main. What does the flag change?",
      "options": [
        "It sets the version variable to \"1.2.0\" inside the binary at link time",
        "It edits the source file so it says 1.2.0",
        "It renames the output file to version 1.2.0",
        "It only sets the version shown by go version -m and does not affect the program"
      ],
      "answerIndex": 0,
      "explanation": "-X tells the linker to replace the initial value of a string variable (for example main.version) in the finished binary. Your source file is untouched, and the program itself sees the new value."
    },
    {
      "question": "You are on Windows and need a binary for a Linux server with an ARM64 CPU. What do you do?",
      "options": [
        "Build on Windows as normal and rename the file to end in .linux",
        "Set GOOS=linux and GOARCH=arm64 (for example CGO_ENABLED=0 as well) and run go build",
        "Run go install with @arm64 after the package name",
        "Install a Linux virtual machine; Go cannot build for other systems"
      ],
      "answerIndex": 1,
      "explanation": "Go compiles for another target when you set GOOS (operating system) and GOARCH (CPU) before go build. Renaming a file does not change its contents, and no virtual machine is needed."
    },
    {
      "question": "What is the difference between `go install tool@latest` and `go get -tool`?",
      "options": [
        "They are two names for the same command",
        "go get -tool installs the tool for all users of the computer; go install only for you",
        "go install puts a binary in your GOPATH/bin folder; go get -tool records the tool in go.mod so the project pins its version and runs it with go tool",
        "go install is for libraries and go get -tool is for web servers"
      ],
      "answerIndex": 2,
      "explanation": "go install makes a global binary on your machine. go get -tool adds a tool directive to go.mod so the whole team and CI use the same pinned version through go tool."
    },
    {
      "question": "Why should the pprof pages (URL paths the server answers, called endpoints) be served on a localhost-only port instead of the public API port?",
      "options": [
        "Because pprof only works on port 6060",
        "Because localhost ports make the profile more accurate",
        "Because the public port cannot serve more than one handler",
        "Because the pages reveal internals of the program and let anyone trigger expensive profiling, so only people on the machine should reach them"
      ],
      "answerIndex": 3,
      "explanation": "The /debug/pprof pages expose details about your program and can use a lot of CPU when asked for a profile. Binding them to localhost keeps outsiders away. The port number itself is arbitrary."
    },
    {
      "question": "Why is a multi-stage Dockerfile used for a Go service?",
      "options": [
        "Go programs cannot run in a container otherwise",
        "The first stage builds the binary with the Go toolchain and the last stage copies only the binary into a tiny base, giving a much smaller and safer image",
        "It makes the Go compiler produce faster code",
        "It lets the container run as the root administrator user"
      ],
      "answerIndex": 1,
      "explanation": "Compilers and source code are needed only to build. Copying just the finished binary into a minimal runtime image leaves out the toolchain, which makes the image much smaller and reduces what an attacker could use."
    }
  ]
});
