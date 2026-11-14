window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "26-gin-basics",
  "order": 26,
  "title": "Gin Basics",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Gin is a third-party web framework (a ready-made skeleton for web servers, written outside the Go team) built on top of net/http. You will install it at a pinned version (an exact, fixed version number), create an engine, register routes for every HTTP method, send JSON and text responses through gin.Context, and switch between debug and release mode. From here to topic 34 we grow a small \"users\" API.",
  "prerequisites": [
    "21-http-server",
    "19-json",
    "12-packages-modules"
  ],
  "subtopics": [
    {
      "id": "why-a-framework",
      "title": "Why a framework over net/http",
      "explanation": "In topic 21 you built servers with the standard library package net/http. It already routes requests (matches a method and path to a function) and serves them. So why add anything? A framework is a ready-made skeleton that you fill in with your own code. Gin is a third-party framework, meaning it was written outside the Go team and you download it as a dependency (an outside package your project needs).\n\nGin adds several conveniences that you would otherwise write by hand. It has route parameters such as `/users/:id` and route groups (topic 27). It can bind (copy) JSON, query strings and forms into structs and validate them (topic 28). It has a middleware chain (middleware = code that runs around your handlers, topic 29). It gives every request one `*gin.Context` value with helpers such as `c.JSON`. And it ships a request Logger and a Recovery that turns a panic (a crash inside one request) into an error response.\n\nThe trade-offs are real. You take on an extra dependency, and your handlers must use Gin's signature `func(c *gin.Context)` instead of `func(w http.ResponseWriter, r *http.Request)`. For a tiny service with two or three endpoints, plain net/http is fine. For JSON APIs with many routes, validation and shared behaviour, Gin saves a lot of repeated code and is very popular.\n\nGin does not replace net/http. It is built on it: a Gin engine (Gin's main object, which holds your routes and settings) implements `http.Handler`, the interface from topic 21 with the `ServeHTTP` method. That means you can hand a Gin engine to `http.ListenAndServe` or to any tool that expects an `http.Handler`.\n\nCourse setup, used for every Gin topic (26 to 34). Open a terminal, create a new empty folder and move into it, then create the module and download Gin at a pinned version (the next sub-topic explains these commands):\n\n`mkdir userapi`\n`cd userapi`\n`go mod init example.com/userapi`\n`go get github.com/gin-gonic/gin@v1.12.0`\n\nGin v1.12.0 needs Go 1.25 or newer. This course uses Go 1.27.4, so you are fine. Save each example as `main.go` in this folder, replacing its contents; the filename on each code block is only the example's name. Run it with `go run .`. Programs that start a server keep running until you press Ctrl+C. Test them from a second terminal with curl, as in topic 21.",
      "analogy": "Cooking from raw ingredients is net/http: you buy, measure and chop everything yourself. A meal kit is Gin: same kitchen and same stove, but the parts are pre-measured and you follow the kit's recipe-card format. You save time, and in return you accept the kit's way of doing things.",
      "code": [
        {
          "language": "go",
          "filename": "compare.go",
          "source": "package main\n\nimport (\n\t\"encoding/json\"\n\t\"log\"\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc main() {\n\t// Version 1: plain net/http, served on port 8080.\n\tmux := http.NewServeMux()\n\tmux.HandleFunc(\"GET /ping\", func(w http.ResponseWriter, r *http.Request) {\n\t\tw.Header().Set(\"Content-Type\", \"application/json\")\n\t\tjson.NewEncoder(w).Encode(map[string]string{\"message\": \"pong\"})\n\t})\n\n\t// Version 2: Gin, served on port 8081.\n\t// gin.Default() creates a Gin engine (explained in a later sub-topic).\n\tr := gin.Default()\n\tr.GET(\"/ping\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"message\": \"pong\"})\n\t})\n\n\t// The Gin engine is an http.Handler, so net/http can serve it.\n\tgo func() {\n\t\tlog.Fatal(http.ListenAndServe(\":8081\", r))\n\t}()\n\n\tlog.Fatal(http.ListenAndServe(\":8080\", mux))\n}\n",
          "output": "",
          "explanation": "Both servers answer GET /ping with the same JSON. The first uses only the standard library: you set the Content-Type header yourself and encode a map. The second uses one Gin call, `c.JSON`, which sets the header and encodes for you. The Gin engine `r` is passed straight to `http.ListenAndServe`, which proves it is an `http.Handler`. The program itself prints nothing on success except Gin's own startup lines (called [GIN-debug] lines, explained in the debug and release mode sub-topic); it then waits for requests until you press Ctrl+C."
        },
        {
          "language": "bash",
          "filename": "terminal.sh",
          "source": "curl -s localhost:8080/ping\ncurl -s localhost:8081/ping; echo",
          "output": "{\"message\":\"pong\"}\n{\"message\":\"pong\"}",
          "explanation": "Run these in a second terminal while compare.go is running. Both servers return the same body. The `; echo` on the second command only adds a final newline, because Gin does not append one while json.Encoder.Encode does."
        }
      ],
      "productionNote": "Because a Gin engine is an http.Handler, it plugs into a configured http.Server with timeouts and graceful shutdown (topic 34) and into httptest, the standard library's testing helpers for HTTP handlers (topic 33). You keep all the net/http knowledge you already have.",
      "commonMistakes": [
        "Thinking Gin replaces net/http. It is built on top of it, and the engine still goes through net/http's server underneath.",
        "Mixing the two handler signatures. A function written as func(w http.ResponseWriter, r *http.Request) cannot be passed to r.GET directly, and a func(c *gin.Context) cannot be passed to mux.HandleFunc. Pick one style per router.",
        "Adding Gin to a project that only needs two plain endpoints. An extra dependency has a cost in updates and review."
      ],
      "sources": [
        {
          "title": "Gin: Introduction",
          "url": "https://gin-gonic.com/en/docs/introduction/"
        },
        {
          "title": "Gin package documentation",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin"
        }
      ]
    },
    {
      "id": "installing-gin",
      "title": "Installing Gin with go get",
      "explanation": "Go downloads third-party packages with `go get` (topic 12). It only works inside a module, which is a folder that has a go.mod file, so you start with `go mod init example.com/userapi`. The name `example.com/userapi` is the module path; it is just a unique label for your project.\n\nThen `go get github.com/gin-gonic/gin@v1.12.0` downloads Gin. The part after `@` pins an exact version, so everyone who builds your project gets the same Gin. Without `@v1.12.0` Go would pick the newest version, which can change under you.\n\nGo records the choice in two files. go.mod gets a `require` line (a line that names a needed module and its version). go.sum stores checksums, fingerprints of each downloaded module, so a tampered or changed download is detected. Gin itself needs other packages, such as the validator library; these are listed in go.mod too, marked `// indirect` (needed by a dependency, not imported by your own code).\n\nIn your code, import with the full path `\"github.com/gin-gonic/gin\"`. The last part of the path is the package name, so you write `gin.Default()`, `gin.H` and so on. After you edit your imports, run `go mod tidy`, which adds missing requirements and removes unused ones.",
      "analogy": "Ordering a specific edition of a book by its ISBN (the unique number printed on every edition) instead of asking for whatever is newest. You always get the exact same book, and go.sum is the stamp that proves the copy is genuine.",
      "code": [
        {
          "language": "bash",
          "filename": "terminal.sh",
          "source": "mkdir userapi\ncd userapi\ngo mod init example.com/userapi\ngo get github.com/gin-gonic/gin@v1.12.0\n# ... create main.go that imports \"github.com/gin-gonic/gin\" ...\ngo mod tidy\ngrep \"gin-gonic/gin\" go.mod",
          "output": "go: creating new go.mod: module example.com/userapi\ngo: added github.com/gin-gonic/gin v1.12.0\n\tgithub.com/gin-gonic/gin v1.12.0",
          "explanation": "go mod init creates go.mod. go get downloads Gin and prints one `go: added` line for each module it adds (the other lines, for Gin's own dependencies, are left out here). After main.go imports Gin, go mod tidy prints nothing and keeps the Gin line in the require block of go.mod. The grep command (bash; on PowerShell use Select-String) shows that line, indented with a tab."
        }
      ],
      "productionNote": "Pinned versions plus go.sum give reproducible builds: the same commit builds the same dependencies on your laptop and in CI (the automated build system). Commit both go.mod and go.sum to version control, and upgrade deliberately with another go get.",
      "commonMistakes": [
        "Running go get outside a module. Without a go.mod file Go reports that it cannot find one; run go mod init first.",
        "Importing \"gin-gonic/gin\" without the github.com/ prefix. The import path is the full address: github.com/gin-gonic/gin.",
        "Forgetting go mod tidy after changing imports, which leaves go.mod out of date."
      ],
      "sources": [
        {
          "title": "Gin: Quickstart",
          "url": "https://gin-gonic.com/en/docs/quickstart/"
        },
        {
          "title": "Go Modules Reference: go get",
          "url": "https://go.dev/ref/mod#go-get"
        }
      ]
    },
    {
      "id": "default-vs-new",
      "title": "gin.Default vs gin.New",
      "explanation": "Every Gin program starts by creating an engine. There are two constructors (functions that build a value). `gin.New()` returns a bare engine with no middleware at all. `gin.Default()` returns the same engine with two middleware already attached.\n\nMiddleware means code that runs around every handler; topic 29 covers it properly. The two that Default adds are named Logger and Recovery. Logger prints one log line per request, such as one that contains `200` and the path `\"/ping\"`. Recovery catches a panic inside a handler and answers with HTTP status 500 instead of letting the request kill the server.\n\n`r.Run(\":8080\")` starts the server on port 8080. It blocks (does not return) while the server runs, and it returns an error if it fails, for example when the port is already in use. That is why we wrap it in `log.Fatal`, which prints the error and exits. `Run` is fine for learning. Topic 34 replaces it with an `http.Server` so you can set timeouts.\n\nThe example below also has a `/boom` route that panics on purpose, to show Recovery working.",
      "analogy": "A car with seatbelts and a dashcam already fitted is gin.Default(). A bare chassis where you choose and fit your own safety gear is gin.New(). Both drive; one is safer out of the box.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"log\"\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc main() {\n\tr := gin.Default()\n\n\tr.GET(\"/ping\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"message\": \"pong\"})\n\t})\n\n\tr.GET(\"/boom\", func(c *gin.Context) {\n\t\tpanic(\"something broke\")\n\t})\n\n\tlog.Fatal(r.Run(\":8080\"))\n}\n",
          "output": "",
          "explanation": "The program starts a server on port 8080 and prints Gin startup lines, then one [GIN] log line per request, each containing the status (such as 200) and the path (such as \"/ping\"); the time it took varies, so the full line is not shown. After GET /boom panics, Recovery logs the problem and sends status 500, and the server keeps running."
        },
        {
          "language": "bash",
          "filename": "terminal.sh",
          "source": "curl -s localhost:8080/ping; echo\ncurl -s -w \"%{http_code}\\n\" localhost:8080/boom\ncurl -s localhost:8080/ping; echo",
          "output": "{\"message\":\"pong\"}\n500\n{\"message\":\"pong\"}",
          "explanation": "The /boom request returns an empty body with status 500 (curl's -w option prints the status code). The third request proves the server survived the panic."
        }
      ],
      "productionNote": "Many production services use gin.New() and attach chosen middleware, such as a structured slog request logger (topic 34), so log format and fields are under their control. gin.Default() is fine for a quick start.",
      "commonMistakes": [
        "Calling gin.Default() and then adding Logger again. The result is two log lines per request. Default already includes it.",
        "Ignoring the error returned by r.Run. If the port is taken, the program would silently exit; wrap it in log.Fatal.",
        "Using gin.New() and forgetting Recovery, so one panic in a handler can take the whole process down."
      ],
      "sources": [
        {
          "title": "gin.Default",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Default"
        },
        {
          "title": "gin.New",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#New"
        },
        {
          "title": "Engine.Run",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Engine.Run"
        }
      ]
    },
    {
      "id": "routes-and-methods",
      "title": "Routes and HTTP methods",
      "explanation": "A route ties an HTTP method and a path to a handler. A handler is the function Gin calls when a matching request arrives. Its type is `gin.HandlerFunc`, which is simply `func(*gin.Context)`.\n\nThe engine has one registration method per HTTP method: `r.GET`, `r.POST`, `r.PUT`, `r.PATCH` and `r.DELETE`. Each takes the path and the handler. Recap of what the methods mean: GET reads data, POST creates something, PUT replaces something completely, PATCH changes part of something, DELETE removes something.\n\nYou can pass an anonymous function (a function with no name written inline), but a named function such as `listUsers` is easier to read once you have more than two or three routes. Pass it without parentheses, because you hand Gin the function, you do not call it.\n\nIn the example, `users` is a plain map (topic 7) kept in memory. This map is not safe for several goroutines (topic 16) at the same time. That is acceptable for a demo, but a real service uses a database or a mutex. Paths here are static; path parameters such as `/users/1` arrive in topic 27.\n\n`c.Status(http.StatusNoContent)` sends status 204 with no body, which is the usual answer to a successful delete.",
      "analogy": "A reception desk with labelled windows. The building is the path (/users). Each window is a method: one for looking things up, one for filing new items, one for replacing, one for amending, one for removing. Same address, different window for different kinds of request.",
      "code": [
        {
          "language": "go",
          "filename": "routes.go",
          "source": "package main\n\nimport (\n\t\"log\"\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\n// In-memory data for the demo. Not safe for concurrent use.\nvar users = map[string]string{\"1\": \"Ada\"}\n\nfunc listUsers(c *gin.Context) {\n\tc.JSON(http.StatusOK, gin.H{\"users\": users})\n}\n\nfunc createUser(c *gin.Context) {\n\tusers[\"2\"] = \"Grace\"\n\tc.JSON(http.StatusCreated, gin.H{\"status\": \"created\"})\n}\n\nfunc replaceUsers(c *gin.Context) {\n\tc.JSON(http.StatusOK, gin.H{\"status\": \"replaced\"})\n}\n\nfunc updateUsers(c *gin.Context) {\n\tc.JSON(http.StatusOK, gin.H{\"status\": \"updated\"})\n}\n\nfunc deleteUser(c *gin.Context) {\n\tdelete(users, \"2\")\n\tc.Status(http.StatusNoContent)\n}\n\nfunc main() {\n\tr := gin.Default()\n\n\tr.GET(\"/users\", listUsers)\n\tr.POST(\"/users\", createUser)\n\tr.PUT(\"/users\", replaceUsers)\n\tr.PATCH(\"/users\", updateUsers)\n\tr.DELETE(\"/users\", deleteUser)\n\n\tlog.Fatal(r.Run(\":8080\"))\n}\n",
          "output": "",
          "explanation": "Five routes share the path /users but differ in method. Each handler is a named function passed by name. createUser adds a fixed entry so you can see state change; reading a request body comes in topic 28. The program prints only Gin's startup and per-request log lines."
        },
        {
          "language": "bash",
          "filename": "terminal.sh",
          "source": "curl -s -w \" %{http_code}\\n\" localhost:8080/users\ncurl -s -w \" %{http_code}\\n\" -X POST localhost:8080/users\ncurl -s -w \" %{http_code}\\n\" localhost:8080/users\ncurl -s -w \" %{http_code}\\n\" -X PUT localhost:8080/users\ncurl -s -w \" %{http_code}\\n\" -X PATCH localhost:8080/users\ncurl -s -w \" %{http_code}\\n\" -X DELETE localhost:8080/users\ncurl -s -w \" %{http_code}\\n\" localhost:8080/users",
          "output": "{\"users\":{\"1\":\"Ada\"}} 200\n{\"status\":\"created\"} 201\n{\"users\":{\"1\":\"Ada\",\"2\":\"Grace\"}} 200\n{\"status\":\"replaced\"} 200\n{\"status\":\"updated\"} 200\n 204\n{\"users\":{\"1\":\"Ada\"}} 200",
          "explanation": "curl's -X option chooses the method and -w appends the status code after the body. The DELETE answer has no body, so only the status 204 appears. The final GET shows that the delete worked."
        }
      ],
      "productionNote": "REST-style resource routes (one noun path such as /users, with methods meaning the action) are the common convention for JSON APIs. Keep each handler small and move data access out of it (topic 32).",
      "commonMistakes": [
        "Registering the same method and path twice. Gin panics at startup, which is good: you find out immediately.",
        "Using GET for actions that change data. GET should be safe to repeat; browsers, caches and crawlers may call it freely.",
        "Writing r.GET(\"/users\", listUsers()) with parentheses. That calls the function instead of passing it, and does not compile."
      ],
      "sources": [
        {
          "title": "Gin: HTTP method examples",
          "url": "https://gin-gonic.com/en/docs/routing/http-method/"
        },
        {
          "title": "RouterGroup.GET",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#RouterGroup.GET"
        }
      ]
    },
    {
      "id": "context-and-responses",
      "title": "gin.Context and responses (c.JSON, c.String, gin.H)",
      "explanation": "Every handler receives one `*gin.Context` (a pointer, topic 9). It holds everything about that single request and is also how you send the response. `c.Request` is the familiar `*http.Request` from topic 21, and `c.Writer` is the response writer. Most of the time you use the helper methods instead.\n\n`c.JSON(code, obj)` sets the Content-Type header to `application/json; charset=utf-8`, converts `obj` to JSON (the same rules as topic 19, so struct tags work) and writes it with the status `code`.\n\n`gin.H` is a shorthand for `map[string]any`, handy for quick one-off responses such as `gin.H{\"ok\": true}`. For a public API shape, prefer a struct with json tags, because the fields and types are then fixed and checked by the compiler.\n\n`c.String(code, format, args...)` sends plain text (`text/plain; charset=utf-8`), formatting like `fmt.Sprintf`. `c.Status(code)` sends only a status with no body. `c.IndentedJSON` pretty-prints JSON but costs extra CPU, so it is for debugging only.\n\nWrite a response once per request. After you send an error response, `return` from the handler so the rest of the code does not also try to write.",
      "analogy": "A waiter's order pad for one table. It holds what the table asked for (the request) and it is also how the dish goes back to the table (the response). One pad per table, and each dish is sent out once.",
      "code": [
        {
          "language": "go",
          "filename": "respond.go",
          "source": "package main\n\nimport (\n\t\"log\"\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\ntype User struct {\n\tID   int    `json:\"id\"`\n\tName string `json:\"name\"`\n}\n\nfunc main() {\n\tr := gin.Default()\n\n\tr.GET(\"/user\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, User{ID: 1, Name: \"Ada\"})\n\t})\n\n\tr.GET(\"/hello\", func(c *gin.Context) {\n\t\tc.String(http.StatusOK, \"hello %s\", \"Ada\")\n\t})\n\n\tr.GET(\"/whoami\", func(c *gin.Context) {\n\t\tc.String(http.StatusOK, \"method=%s path=%s\", c.Request.Method, c.Request.URL.Path)\n\t})\n\n\tlog.Fatal(r.Run(\":8080\"))\n}\n",
          "output": "",
          "explanation": "/user sends a struct, so the json tags decide the key names. /hello sends formatted plain text. /whoami reads the method and path from c.Request, showing that the Context wraps the normal *http.Request. The program prints only Gin's own log lines."
        },
        {
          "language": "bash",
          "filename": "terminal.sh",
          "source": "curl -s -w \"\\n%{content_type}\\n\" localhost:8080/user\ncurl -s -w \"\\n%{content_type}\\n\" localhost:8080/hello\ncurl -s localhost:8080/whoami; echo",
          "output": "{\"id\":1,\"name\":\"Ada\"}\napplication/json; charset=utf-8\nhello Ada\ntext/plain; charset=utf-8\nmethod=GET path=/whoami",
          "explanation": "curl's -w option here prints a newline and then the response Content-Type, showing which helper set which header."
        }
      ],
      "productionNote": "Return typed structs for public API responses so the shape is documented in code and cannot drift by accident; keep gin.H for small internal or throwaway responses.",
      "commonMistakes": [
        "Calling c.JSON twice in one handler. The second body is appended to the first, producing broken output, and Gin logs a warning about the status already being written.",
        "Forgetting `return` after writing an error response, so the handler carries on and writes a second response.",
        "Expecting c.String to add a newline. It sends exactly the text you give it."
      ],
      "sources": [
        {
          "title": "Context.JSON",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.JSON"
        },
        {
          "title": "gin.H",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#H"
        },
        {
          "title": "Gin: Rendering examples",
          "url": "https://gin-gonic.com/en/docs/rendering/rendering/"
        }
      ]
    },
    {
      "id": "debug-vs-release-mode",
      "title": "Debug vs release mode",
      "explanation": "Gin has three modes. Debug is the default. In debug mode Gin prints `[GIN-debug]` lines at startup: one for every route you register (a line like `[GIN-debug] GET /ping --> main.main.func1 (3 handlers)`; spacing and names vary), plus warnings. Those lines help while you develop.\n\nRelease mode silences them, which is what you want in production, where noisy output wastes log storage. Test mode (`gin.TestMode`) is for automated tests (topic 33).\n\nYou choose the mode in one of two ways. Set the environment variable `GIN_MODE=release` before starting the program, or call `gin.SetMode(gin.ReleaseMode)` in code. Call it before you create the engine and register routes, because the debug lines are printed at the moment each route is added. `gin.Mode()` returns the current mode as a string.\n\nEnvironment variable syntax (topic 23): in bash use `GIN_MODE=release go run .`; in PowerShell run `$env:GIN_MODE = \"release\"` first and then `go run .`.\n\nRelease mode only hides the debug lines. The per-request [GIN] log line from the Logger middleware still appears.",
      "analogy": "A workshop with the lights on and labels showing on every shelf (debug) while you build, versus the showroom (release) where the customer sees only the finished product and no labels.",
      "code": [
        {
          "language": "go",
          "filename": "mode.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"log\"\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tfmt.Println(gin.Mode())\n\n\tr := gin.Default()\n\tr.GET(\"/ping\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"message\": \"pong\"})\n\t})\n\n\tlog.Fatal(r.Run(\":8080\"))\n}\n",
          "output": "release",
          "explanation": "SetMode runs first, so no [GIN-debug] lines appear for the route or for the server start. Only `release` is printed by our own Println. If you delete the SetMode line, gin.Mode() prints `debug` and Gin prints [GIN-debug] lines for GET /ping and the listening address."
        },
        {
          "language": "bash",
          "filename": "terminal.sh",
          "source": "GIN_MODE=release go run .",
          "output": "release",
          "explanation": "The same effect without changing the code: the environment variable selects release mode (note that a SetMode call in code would override it). This is the form used in deployments, for example in a Dockerfile (topic 34)."
        }
      ],
      "productionNote": "Set GIN_MODE=release in the deployment environment, such as in the Dockerfile or the orchestrator's settings (topic 34), so production never runs with debug output.",
      "commonMistakes": [
        "Shipping debug mode to production, which fills logs with startup noise and warnings.",
        "Calling gin.SetMode after the routes are registered and expecting the earlier [GIN-debug] lines to disappear. They were already printed.",
        "Hard-coding SetMode in the program so that the environment variable can no longer change the mode."
      ],
      "sources": [
        {
          "title": "gin.SetMode",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#SetMode"
        },
        {
          "title": "Gin: Deployment",
          "url": "https://gin-gonic.com/en/docs/deployment/"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "What does gin.Default() add compared with gin.New()?",
      "options": [
        "A database connection and a JSON validator",
        "The Logger middleware (one log line per request) and the Recovery middleware (a panic becomes a 500 response)",
        "Automatic HTTPS certificates",
        "Support for the PATCH and DELETE methods"
      ],
      "answerIndex": 1,
      "explanation": "gin.New() is a bare engine. gin.Default() is gin.New() plus Logger and Recovery. All five HTTP methods work on both, and neither sets up a database or HTTPS."
    },
    {
      "question": "What is gin.H?",
      "options": [
        "A shorthand for map[string]any, used for quick JSON objects",
        "The HTTP header type",
        "A function that starts the server",
        "A struct holding the request body"
      ],
      "answerIndex": 0,
      "explanation": "gin.H is just a named shorthand for map[string]any, so gin.H{\"ok\": true} becomes the JSON {\"ok\":true}."
    },
    {
      "question": "Which signature does a Gin handler have?",
      "options": [
        "func(w http.ResponseWriter, r *http.Request)",
        "func(c gin.Context) error",
        "func() string",
        "func(c *gin.Context)"
      ],
      "answerIndex": 3,
      "explanation": "A Gin handler is a gin.HandlerFunc, which is func(*gin.Context). The first option is the plain net/http signature, which Gin routes do not accept directly."
    },
    {
      "question": "How do you switch Gin to release mode?",
      "options": [
        "Rename the file to release.go",
        "Pass -release to go run",
        "Set the environment variable GIN_MODE=release, or call gin.SetMode(gin.ReleaseMode) before creating the engine and routes",
        "Call r.Run(\":release\")"
      ],
      "answerIndex": 2,
      "explanation": "Mode is chosen by the GIN_MODE environment variable or by gin.SetMode, called before the routes are registered. The other options do nothing."
    },
    {
      "question": "Can a Gin engine be used with net/http tools such as http.ListenAndServe?",
      "options": [
        "No, Gin has its own server and cannot be combined with net/http",
        "Only if you convert it to JSON first",
        "Yes, but only in test mode",
        "Yes, because the engine implements http.Handler"
      ],
      "answerIndex": 3,
      "explanation": "The engine has a ServeHTTP method, so it satisfies http.Handler and works with http.ListenAndServe, http.Server and httptest. Gin is built on top of net/http."
    }
  ]
});
