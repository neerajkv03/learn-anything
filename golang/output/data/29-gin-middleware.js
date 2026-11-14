window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "29-gin-middleware",
  "order": 29,
  "title": "Gin Middleware",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Middleware is code that runs before and after your handlers on every request, so cross-cutting work (logging, request IDs, panic protection, CORS) lives in one place instead of being copied into every handler. You will learn how Gin runs a chain of handlers with c.Next and c.Abort, what the built-in Logger and Recovery do, how to write your own middleware, how to attach it globally, to a group or to a single route, how to pass values between middleware and handlers, and how to configure CORS (the browser rule about cross-site calls) safely.",
  "prerequisites": ["28-gin-binding", "21-http-server", "23-logging-config"],
  "subtopics": [
    {
      "id": "how-middleware-runs",
      "title": "How middleware runs (c.Next, c.Abort)",
      "explanation": "Middleware is a function that runs around your real handler. In Gin every route owns a chain (an ordered list) of handler functions, for example [mw1, mw2, handler]. Each item has the type gin.HandlerFunc, which is simply func(c *gin.Context). The last item is your handler; everything before it is middleware.\n\nGin calls the chain from the first item to the last. Code you write before c.Next() runs on the way in. Calling c.Next() runs everything later in the chain (the rest of the middleware and finally the handler). Code you write after c.Next() runs on the way out, after the later items have finished. Because the way out visits the middleware in reverse order, this is often called the onion model: each layer wraps the next one.\n\nYou do not have to call c.Next(). If a middleware returns without calling it, Gin still continues to the next item afterwards. The difference is timing: with c.Next() your 'after' code runs after the handler; without it, your code finishes first and the handler runs later.\n\nTo stop the chain you call c.Abort(). It tells Gin not to run any later items. It does NOT end the function you are currently in: the lines after c.Abort() still execute. So put a return right after it. c.AbortWithStatus(403) is a shortcut that sets the HTTP status code (403 means Forbidden) and aborts in one call. c.IsAborted() reports whether the chain was aborted.\n\nSetup for this and the following examples (do this once). Open a terminal, create a new empty folder and go into it: mkdir mw-demo then cd mw-demo. Run go mod init example.com/mwdemo to create the module (go.mod file, see topic 12), then go get github.com/gin-gonic/gin@v1.12.0 to add Gin. Save the example as a .go file in that folder and start it with go run . (the dot means 'the package in this folder'). Stop it with Ctrl+C. Each example is a complete program with its own func main, so use a fresh folder for each one, or replace the file when you move to the next. The examples call gin.SetMode(gin.ReleaseMode) (topic 26) so that Gin's own [GIN-debug] startup lines do not mix with what the program prints.\n\nWhile the server runs, open a second terminal and use curl (topic 21) to send requests. On Windows PowerShell, type curl.exe instead of curl, because plain curl is an alias for a different command there.",
      "analogy": "Think of airport security lanes. At each checkpoint an officer either waves you through to the next one (c.Next) or stops you on the spot (c.Abort). After you have been through the last gate and finished your business, you walk back out past the same checkpoints in reverse order. If you are stopped at checkpoint B, you never reach the gate (the handler), but you still walk back out past checkpoint A.",
      "code": [
        {
          "language": "go",
          "filename": "order.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc mwA(c *gin.Context) {\n\tfmt.Println(\"A before\")\n\tc.Next()\n\tfmt.Println(\"A after\")\n}\n\nfunc mwB(c *gin.Context) {\n\tfmt.Println(\"B before\")\n\tif c.Query(\"deny\") == \"yes\" {\n\t\tc.AbortWithStatus(http.StatusForbidden)\n\t\treturn\n\t}\n\tc.Next()\n\tfmt.Println(\"B after\")\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\tr.Use(mwA, mwB)\n\tr.GET(\"/x\", func(c *gin.Context) {\n\t\tfmt.Println(\"handler\")\n\t\tc.String(http.StatusOK, \"ok\")\n\t})\n\tr.Run(\":8080\")\n}\n",
          "output": "A before\nB before\nhandler\nB after\nA after\nA before\nB before\nA after",
          "explanation": "r.Use(mwA, mwB) puts both middleware in front of every route registered after it (more on Use in a later sub-topic). The output shown is what the server terminal prints after two requests: GET /x, then GET /x?deny=yes. For the first request all five lines appear in onion order: A before, B before, handler, B after, A after. For the second request mwB calls c.AbortWithStatus(403) and returns, so the handler never runs and 'B after' is skipped, but mwA continues after its c.Next() and prints 'A after'. The client of the second request gets status 403."
        },
        {
          "language": "bash",
          "filename": "try-order.sh",
          "source": "curl -s -o /dev/null -w \"%{http_code}\\n\" \"localhost:8080/x\"\ncurl -s -o /dev/null -w \"%{http_code}\\n\" \"localhost:8080/x?deny=yes\"",
          "output": "200\n403",
          "explanation": "-s hides curl's progress meter, -o /dev/null throws the body away, and -w \"%{http_code}\\n\" prints only the status code. The quotes around the second URL stop some shells from treating the ? as a wildcard."
        }
      ],
      "productionNote": "Almost all cross-cutting work in a real API is middleware: authentication, request logging, metrics, panic recovery, CORS headers and rate limiting. Keep each middleware small and single-purpose, and always return right after an abort so that the rest of your function does not run with a half-finished response.",
      "commonMistakes": [
        "Forgetting return after c.Abort() or c.AbortWithStatus(...). The chain stops, but your own function keeps running and may write a second response or do work that should have been skipped.",
        "Calling c.Next() twice in one middleware. The chain is already finished after the first call, so the second call does nothing useful and only confuses readers.",
        "Expecting c.Abort() to stop the handlers that already ran. It only prevents later ones, and code after c.Next() in earlier middleware still runs."
      ],
      "sources": [
        { "title": "Gin docs: custom middleware", "url": "https://gin-gonic.com/en/docs/middleware/custom-middleware/" },
        { "title": "pkg.go.dev: gin Context.Next", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.Next" },
        { "title": "pkg.go.dev: gin Context.Abort", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.Abort" }
      ]
    },
    {
      "id": "logger-and-recovery",
      "title": "Built-in Logger and Recovery",
      "explanation": "Gin ships two middleware that almost every server uses. gin.Logger() writes one line for every request to standard output (stdout, the normal text output of a program). The line contains the time, the status code, the latency (how long the request took), the client IP address, the HTTP method and the path. gin.Recovery() catches a panic (a runtime crash such as the one from panic(...) in topic 11) raised inside a later handler. It writes the panic message and a stack trace (the list of function calls that led to the panic) to standard error, and answers the client with status 500 (Internal Server Error). The server keeps running.\n\ngin.Default() from topic 26 is just gin.New() plus these two. Writing r := gin.New() and then r.Use(gin.Logger(), gin.Recovery()) is the same thing, but spelled out so you can replace either part later.\n\nRecovery matters because a panic in a handler would otherwise reach the net/http server. net/http protects the whole program by recovering the panic itself, logging it and closing that one connection. The client then sees a dropped connection instead of a clean 500 response (curl typically reports an empty reply from the server; the exact text varies by version, so do not rely on it). With Recovery the client gets a proper 500 and your own middleware earlier in the chain still gets to finish.\n\nThe Logger is plain text. In topic 34 you will replace it with a structured slog (topic 23) middleware that emits JSON. Until then, if some paths are noisy, for example a health-check endpoint polled every few seconds, you can skip them with gin.LoggerWithConfig(gin.LoggerConfig{SkipPaths: []string{\"/healthz\"}}) instead of gin.Logger().",
      "analogy": "The Logger is the visitor sign-in book at a front desk: every request is written down with time and outcome. Recovery is the safety net under a trapeze act: when a performer (a handler) falls, the net catches them, the show goes on, and the audience gets a polite announcement (500) instead of the tent collapsing.",
      "code": [
        {
          "language": "go",
          "filename": "recover.go",
          "source": "package main\n\nimport (\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\tr.Use(gin.Logger(), gin.Recovery())\n\n\tr.GET(\"/ping\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"message\": \"pong\"})\n\t})\n\tr.GET(\"/boom\", func(c *gin.Context) {\n\t\tpanic(\"oops\")\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "[Recovery] 2026/11/15 - 10:21:30 panic recovered:\noops\n... stack trace lines (written to standard error) ...\n[GIN] 2026/11/15 - 10:21:30 | 500 |     212.4µs |       127.0.0.1 | GET      \"/boom\"\n[GIN] 2026/11/15 - 10:21:33 | 200 |      38.5µs |       127.0.0.1 | GET      \"/ping\"",
          "explanation": "This is what the server terminal shows after GET /boom and then GET /ping. Times, latencies and the stack trace differ on every run. The [Recovery] block is written to standard error, the [GIN] lines to standard output; in a terminal both appear. Logger comes first in r.Use, so it wraps Recovery: its line is printed after Recovery has already turned the panic into a 500."
        },
        {
          "language": "bash",
          "filename": "try-recover.sh",
          "source": "curl -s -o /dev/null -w \"%{http_code}\\n\" localhost:8080/boom\ncurl -s localhost:8080/ping",
          "output": "500\n{\"message\":\"pong\"}",
          "explanation": "The panicking route answers 500, and the very next request to /ping still works, which proves the server survived."
        }
      ],
      "productionNote": "Keep Recovery on in every environment: one nil-pointer bug (topic 9) should cost you one 500, not an outage. Treat Logger as a starter: production servers usually replace it with a structured logger so that log tools can search by field (topic 34). Never log request bodies by default, because they can contain passwords and tokens.",
      "commonMistakes": [
        "Using gin.New() and forgetting to add gin.Recovery(). A panic in any handler then drops the client's connection instead of returning a clean 500.",
        "Logging full request bodies or Authorization headers in a custom logging middleware. Logs are widely readable, and secrets in them are a leak."
      ],
      "sources": [
        { "title": "pkg.go.dev: gin Logger", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Logger" },
        { "title": "pkg.go.dev: gin Recovery", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Recovery" },
        { "title": "Gin docs: using middleware", "url": "https://gin-gonic.com/en/docs/middleware/using-middleware/" }
      ]
    },
    {
      "id": "custom-middleware",
      "title": "Writing custom middleware (request ID, timing)",
      "explanation": "Most real middleware is written as a factory function: a normal function that returns a gin.HandlerFunc. The returned inner function is a closure (topic 4), so it can remember the arguments you gave the factory. That is how you pass configuration, for example RequireRole(\"admin\"). Even when there is no configuration, the factory style RequestID() keeps usage uniform: r.Use(RequestID()).\n\nA request ID is a unique label for one request. If the client sends an X-Request-ID header (a header is a name/value line sent with the request, topic 21) we reuse it; otherwise we create one with rand.Text() from the crypto/rand package, which returns a random 26-character string built from letters and digits (added in Go 1.24; crypto/rand is the standard library's cryptographically secure random generator). We then put the ID on the response with c.Header(\"X-Request-ID\", id). Set response headers before the handler writes the body, which is why this happens before c.Next(). Because the ID comes from the client, the example ignores values longer than 64 characters; never trust or store unbounded client input.\n\nA timing middleware records time.Now() before c.Next() and calls time.Since(start) afterwards (topic 13). The status code is only known after the handler ran, so read it with c.Writer.Status() after c.Next(); before that it is always the default 200.\n\nGin reuses gin.Context objects between requests to save memory. If you start a goroutine (topic 15) from a handler or middleware and it uses c after the handler returns, c may already belong to another request. Give the goroutine a snapshot made with c.Copy() instead.",
      "analogy": "The request ID is a tracking-number sticker the depot puts on each parcel at the entrance, so every later stage can refer to the same parcel. The timing middleware is a stopwatch started at the entrance and read at the exit, with the result written next to the parcel's final status.",
      "code": [
        {
          "language": "go",
          "filename": "reqid.go",
          "source": "package main\n\nimport (\n\t\"crypto/rand\"\n\t\"fmt\"\n\t\"net/http\"\n\t\"time\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc RequestID() gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tid := c.GetHeader(\"X-Request-ID\")\n\t\tif id == \"\" || len(id) > 64 {\n\t\t\tid = rand.Text()\n\t\t}\n\t\tc.Header(\"X-Request-ID\", id)\n\t\tc.Next()\n\t}\n}\n\nfunc Timing() gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tstart := time.Now()\n\t\tc.Next()\n\t\tfmt.Println(c.Request.Method, c.Request.URL.Path, c.Writer.Status(), time.Since(start))\n\t}\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\tr.Use(gin.Recovery(), RequestID(), Timing())\n\tr.GET(\"/ping\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"message\": \"pong\"})\n\t})\n\tr.Run(\":8080\")\n}\n",
          "output": "GET /ping 200 41.2µs",
          "explanation": "The output is the server's line for one request to /ping; the duration differs on every run. c.GetHeader reads a request header (empty string if absent). c.Header sets a response header. The Timing line prints the method, the path, the status read after c.Next() and the elapsed time."
        },
        {
          "language": "bash",
          "filename": "try-reqid.sh",
          "source": "curl -si -H \"X-Request-ID: abc123\" localhost:8080/ping | grep -i x-request-id\ncurl -si localhost:8080/ping | grep -i x-request-id",
          "output": "X-Request-Id: abc123\nX-Request-Id: K3JQ5XWZ2M7ABD4HTRN6PLCEVY",
          "explanation": "-i would print response headers; -s hides the progress meter; grep -i keeps only the matching header line, ignoring case. Go normalises header names, so it is written X-Request-Id on the wire; HTTP header names are case-insensitive anyway. The second value is random: you get a different 26-character string each time."
        }
      ],
      "productionNote": "Request IDs let you follow one request across several services and log lines; topic 34 will attach the ID to every slog record. Validate or replace incoming IDs as the example does, and keep each middleware doing one job so you can reorder or remove it easily.",
      "commonMistakes": [
        "Reading c.Writer.Status() before c.Next(). The handler has not run yet, so you always see the default 200.",
        "Using c inside a goroutine after the handler has returned. Gin recycles the context; pass c.Copy() to the goroutine instead.",
        "Trusting a client-supplied request ID blindly (any length, any characters) and writing it into logs."
      ],
      "sources": [
        { "title": "Gin docs: custom middleware", "url": "https://gin-gonic.com/en/docs/middleware/custom-middleware/" },
        { "title": "pkg.go.dev: crypto/rand Text", "url": "https://pkg.go.dev/crypto/rand#Text" },
        { "title": "Gin docs: goroutines inside a middleware", "url": "https://gin-gonic.com/en/docs/middleware/goroutines-inside-a-middleware/" }
      ]
    },
    {
      "id": "middleware-scope",
      "title": "Global vs group vs route middleware",
      "explanation": "You choose where a middleware applies by choosing where you attach it. There are three levels.\n\nGlobal: r.Use(mw) applies to every route registered after that call (and to the NoRoute handler from topic 27). Group: r.Group(\"/admin\", mw) creates a route group (topic 27) whose routes all run mw; you can also call g.Use(mw) on an existing group. Single route: r.GET(\"/x\", mw, handler) lists the middleware before the final handler, and only that route is affected.\n\nWhen a request arrives the chain runs in this order: global middleware, then group middleware, then route middleware, then the handler, each in the order it was registered.\n\nOrder of registration matters. Gin builds each route's chain at the moment you register the route, so r.Use must come before the routes it should cover. A r.Use placed after r.GET(\"/ping\", ...) does not affect /ping.\n\nIn the example below, a global RequestID covers everything, the /admin group adds adminOnly (which answers 403 unless the request has the header X-Admin: yes), and only /slow gets Timing. adminOnly writes the error with c.JSON and then calls c.Abort() followed by return, as explained in the first sub-topic. The RequestID and Timing functions are the same as in the previous sub-topic.",
      "analogy": "A building has a guard at the main entrance (global: everyone passes them), a key-card reader on one floor (group: only people going to that floor), and a lock on a single office door (route: only that room). The more specific the checkpoint, the fewer people it touches, and you meet them in order from the street inward.",
      "code": [
        {
          "language": "go",
          "filename": "scope.go",
          "source": "package main\n\nimport (\n\t\"crypto/rand\"\n\t\"fmt\"\n\t\"net/http\"\n\t\"time\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc RequestID() gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tid := c.GetHeader(\"X-Request-ID\")\n\t\tif id == \"\" || len(id) > 64 {\n\t\t\tid = rand.Text()\n\t\t}\n\t\tc.Header(\"X-Request-ID\", id)\n\t\tc.Next()\n\t}\n}\n\nfunc Timing() gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tstart := time.Now()\n\t\tc.Next()\n\t\tfmt.Println(c.Request.Method, c.Request.URL.Path, c.Writer.Status(), time.Since(start))\n\t}\n}\n\nfunc adminOnly(c *gin.Context) {\n\tif c.GetHeader(\"X-Admin\") != \"yes\" {\n\t\tc.JSON(http.StatusForbidden, gin.H{\"error\": \"admins only\"})\n\t\tc.Abort()\n\t\treturn\n\t}\n\tc.Next()\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\tr.Use(gin.Recovery(), RequestID())\n\n\tr.GET(\"/ping\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"message\": \"pong\"})\n\t})\n\n\tadmin := r.Group(\"/admin\", adminOnly)\n\tadmin.GET(\"/stats\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"users\": 1})\n\t})\n\n\tr.GET(\"/slow\", Timing(), func(c *gin.Context) {\n\t\ttime.Sleep(20 * time.Millisecond)\n\t\tc.String(http.StatusOK, \"done\")\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "GET /slow 200 20.4ms",
          "explanation": "The program prints nothing until /slow is requested, and then only that one line (the duration varies), because Timing is attached to that route alone. /ping and /admin/stats print nothing from the server. RequestID runs for all three routes; adminOnly runs only for routes under /admin."
        },
        {
          "language": "bash",
          "filename": "try-scope.sh",
          "source": "curl -s -w \"\\n%{http_code}\\n\" localhost:8080/admin/stats\ncurl -s -w \"\\n%{http_code}\\n\" -H \"X-Admin: yes\" localhost:8080/admin/stats\ncurl -s -w \"\\n%{http_code}\\n\" localhost:8080/ping",
          "output": "{\"error\":\"admins only\"}\n403\n{\"users\":1}\n200\n{\"message\":\"pong\"}\n200",
          "explanation": "-w \"\\n%{http_code}\\n\" prints a newline and the status code after the body. Without the header the group middleware blocks the request; with it the handler runs; /ping is outside the group and needs no header."
        }
      ],
      "productionNote": "Put authentication only on the groups that need it, and keep public endpoints such as health checks (/healthz, topic 34) outside those groups. Global middleware should be things every request needs: recovery, request ID, logging.",
      "commonMistakes": [
        "Calling r.Use after some routes are registered. Those earlier routes silently miss the middleware.",
        "Making authentication global and then locking out public endpoints such as /healthz, so your load balancer or orchestrator thinks the server is down."
      ],
      "sources": [
        { "title": "Gin docs: using middleware", "url": "https://gin-gonic.com/en/docs/middleware/using-middleware/" },
        { "title": "pkg.go.dev: gin RouterGroup.Use", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#RouterGroup.Use" }
      ]
    },
    {
      "id": "sharing-values",
      "title": "Sharing values with c.Set / c.Get",
      "explanation": "Middleware often learns something that the handler needs, such as the request ID or, later, the logged-in user. Gin lets you attach values to the context of the current request. c.Set(key, value) stores a value; the key and the value can be any type (any, topic 10). c.Get(key) returns the value as an any plus a bool in the comma-ok style (topic 7): ok is false if nothing was stored. Because you get an any back, you convert it to the real type with a type assertion (topic 10), for example id, _ := v.(string).\n\nFor the common types there are shortcuts: c.GetString(key) returns the string, or \"\" if the key is missing or not a string. c.MustGet(key) returns the value or panics (so Recovery turns it into a 500) when the key is missing; use it only when a middleware that always runs earlier guarantees the value.\n\nKeys are plain strings, so a typo like \"requestId\" versus \"requestID\" compiles fine and fails silently at run time. Declare the key once as a constant, const requestIDKey = \"requestID\", and use the constant everywhere.\n\nThese values live only as long as the request. They are not shared between requests and disappear afterwards. This is similar to context.WithValue from topic 17, but built into Gin's own context and simpler to use inside Gin handlers.",
      "analogy": "Each request travels through the office in a folder. Every desk (middleware) can stick a note on the folder, such as 'request number abc123', and the next desks and finally the clerk who handles the case (the handler) can read the notes. When the case is closed, the folder and its notes are shredded; the next request gets a fresh folder.",
      "code": [
        {
          "language": "go",
          "filename": "share.go",
          "source": "package main\n\nimport (\n\t\"crypto/rand\"\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nconst requestIDKey = \"requestID\"\n\nfunc RequestID() gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tid := c.GetHeader(\"X-Request-ID\")\n\t\tif id == \"\" || len(id) > 64 {\n\t\t\tid = rand.Text()\n\t\t}\n\t\tc.Set(requestIDKey, id)\n\t\tc.Header(\"X-Request-ID\", id)\n\t\tc.Next()\n\t}\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\tr.Use(gin.Recovery(), RequestID())\n\n\tr.GET(\"/whoami\", func(c *gin.Context) {\n\t\tid := c.GetString(requestIDKey)\n\t\tc.JSON(http.StatusOK, gin.H{\"request_id\": id})\n\t})\n\n\tr.GET(\"/raw\", func(c *gin.Context) {\n\t\tv, ok := c.Get(requestIDKey)\n\t\tif !ok {\n\t\t\tc.JSON(http.StatusInternalServerError, gin.H{\"error\": \"no request id\"})\n\t\t\treturn\n\t\t}\n\t\tid, _ := v.(string)\n\t\tc.JSON(http.StatusOK, gin.H{\"request_id\": id})\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "The server prints nothing itself (no Logger is installed). Both handlers read what the RequestID middleware stored: /whoami with the GetString shortcut, /raw with Get plus a comma-ok check and a type assertion. The responses are shown in the next block."
        },
        {
          "language": "bash",
          "filename": "try-share.sh",
          "source": "curl -s -w \"\\n\" -H \"X-Request-ID: abc123\" localhost:8080/whoami\ncurl -s -w \"\\n\" -H \"X-Request-ID: abc123\" localhost:8080/raw",
          "output": "{\"request_id\":\"abc123\"}\n{\"request_id\":\"abc123\"}",
          "explanation": "Without the header, the middleware would generate a random ID and both routes would return that random value instead."
        }
      ],
      "productionNote": "Typical values passed this way are the request ID, the authenticated user (topic 31) and a tenant (customer) ID. Wrap reads in a small typed helper function if many handlers need the same value, so the string key and the type assertion live in one place.",
      "commonMistakes": [
        "Misspelling a string key in one place. Use a shared constant so the compiler catches typos.",
        "Using c.MustGet for a value that a middleware may not have set, for example on a route registered outside the group that has the middleware. It panics and the client gets a 500.",
        "Expecting values stored with c.Set to be visible in other requests. They exist only for the current request."
      ],
      "sources": [
        { "title": "pkg.go.dev: gin Context.Set", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.Set" },
        { "title": "pkg.go.dev: gin Context.Get", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.Get" }
      ]
    },
    {
      "id": "cors",
      "title": "CORS with gin-contrib/cors",
      "explanation": "An origin is the combination of scheme, host and port, such as https://app.example.com. Browsers enforce a rule called CORS (Cross-Origin Resource Sharing): JavaScript on a page from origin A may read a response from an API on origin B only if B's response says that A is allowed, using headers such as Access-Control-Allow-Origin. For calls that are not 'simple' (for example JSON POSTs with an Authorization header) the browser first sends a preflight: an automatic OPTIONS request (an HTTP method that asks 'what am I allowed to do here?' instead of fetching data) that asks the API 'would you accept this call from this origin?'. If the answer is no, the browser blocks the real call.\n\nYou rarely hand-write this. Install the official Gin middleware with go get github.com/gin-contrib/cors@v1.7.11. This version requires a recent Go toolchain (1.26.10 or newer), which Go 1.27.4 satisfies; go get may raise the go line in your go.mod, which is normal.\n\nThen add it with r.Use(cors.New(cors.Config{...})). The config lists AllowOrigins (the exact origins permitted), AllowMethods (HTTP methods), AllowHeaders (request headers the page may send) and MaxAge (how long the browser may cache the preflight answer, so it does not ask before every call). Register it before your routes so that it also answers preflight requests.\n\nThe example below allows only https://app.example.com. A request that carries a different Origin header is rejected by the middleware with status 403. A request with no Origin header at all (a plain curl, a mobile app, another server) is not affected by CORS and passes straight through.\n\nImportant: CORS is enforced by browsers, not by your server. It protects users' browsers from other sites reading your API with their cookies. It is not an access-control wall: any non-browser client can call your API and can even send a fake Origin header. Real protection comes from authentication (topic 31).",
      "analogy": "CORS is the guest list at a club door. Your API names the origins that are allowed in. A preflight is phoning ahead to ask 'am I on the list for this kind of visit?' before turning up. But the list only binds well-behaved guests (browsers): someone who walks in a side door (curl, a script) never consults the list at all.",
      "code": [
        {
          "language": "go",
          "filename": "cors.go",
          "source": "package main\n\nimport (\n\t\"net/http\"\n\t\"time\"\n\n\t\"github.com/gin-contrib/cors\"\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\tr.Use(gin.Recovery())\n\tr.Use(cors.New(cors.Config{\n\t\tAllowOrigins: []string{\"https://app.example.com\"},\n\t\tAllowMethods: []string{\"GET\", \"POST\"},\n\t\tAllowHeaders: []string{\"Content-Type\", \"Authorization\"},\n\t\tMaxAge:       12 * time.Hour,\n\t}))\n\n\tr.GET(\"/ping\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"message\": \"pong\"})\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "The server prints nothing. Origins are matched exactly, including scheme and port. The block below shows how different callers are treated."
        },
        {
          "language": "bash",
          "filename": "try-cors.sh",
          "source": "curl -si -H \"Origin: https://app.example.com\" localhost:8080/ping | grep -i allow-origin\ncurl -s -o /dev/null -w \"%{http_code}\\n\" -H \"Origin: https://evil.example\" localhost:8080/ping\ncurl -s -w \"\\n%{http_code}\\n\" localhost:8080/ping",
          "output": "Access-Control-Allow-Origin: https://app.example.com\n403\n{\"message\":\"pong\"}\n200",
          "explanation": "The listed origin gets the Access-Control-Allow-Origin header back. The unlisted origin is rejected with 403 and receives no allow header. The third request, with no Origin at all, is simply served: CORS did nothing to stop curl."
        }
      ],
      "productionNote": "Use CORS when a single-page app (a JavaScript front end) served from one domain calls your API on another. List exact origins from configuration (topic 23), not a wildcard. Remember it is a browser convenience rule; keep authentication on the API itself.",
      "commonMistakes": [
        "Combining a wildcard origin (\"*\", which means any website) with AllowCredentials: true (credentials means cookies or Authorization headers). Browsers reject that combination, and wanting it usually means you are opening your API to every site.",
        "Believing CORS protects the API from non-browser clients. curl, scripts and other servers ignore it completely.",
        "Registering cors.New after the routes, so that routes registered earlier do not get the CORS headers."
      ],
      "sources": [
        { "title": "pkg.go.dev: gin-contrib/cors", "url": "https://pkg.go.dev/github.com/gin-contrib/cors" },
        { "title": "GitHub: gin-contrib/cors", "url": "https://github.com/gin-contrib/cors" },
        { "title": "MDN: Cross-Origin Resource Sharing (CORS)", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Middleware X is registered first, then middleware Y, then the handler H. Each middleware prints its name plus 'in' before calling c.Next() and its name plus 'out' after it; H prints 'H'. In what order is the text printed?",
      "options": [
        "X in, X out, Y in, Y out, H",
        "H, Y in, X in, X out, Y out",
        "X in, Y in, H, Y out, X out",
        "X in, Y in, Y out, X out, H"
      ],
      "answerIndex": 2,
      "explanation": "Each c.Next() runs the rest of the chain before returning, so the layers nest like an onion: X in, Y in, the handler, then back out in reverse order, Y out, X out."
    },
    {
      "question": "A middleware calls c.AbortWithStatus(403) and has no return statement after it. What happens to the lines of that middleware after the call?",
      "options": [
        "They are skipped, because Abort ends the current function immediately",
        "They still run, because Abort only stops the later handlers, not the function that called it",
        "They run twice, once now and once after the handler",
        "Go reports a compile error for unreachable code"
      ],
      "answerIndex": 1,
      "explanation": "c.Abort marks the chain as stopped so later items are not called, but it is an ordinary method call and the current function continues. That is why you add return right after it."
    },
    {
      "question": "You want an auth check on every /admin route but not on /ping or /healthz. What is the cleanest way?",
      "options": [
        "Create a group with r.Group(\"/admin\", authMiddleware) and register the admin routes on it",
        "Call r.Use(authMiddleware) first; Gin only applies it to /admin automatically",
        "Call c.Abort() inside main before starting the server",
        "Put the auth check inside gin.Recovery()"
      ],
      "answerIndex": 0,
      "explanation": "Group middleware applies only to the routes of that group. r.Use is global for everything registered after it, main is not part of any request, and Recovery exists to catch panics, not to authenticate."
    },
    {
      "question": "A middleware stored the request ID with c.Set(requestIDKey, id). How does a handler read it as a string?",
      "options": [
        "By parsing it from the URL query string",
        "By reading a package-level global variable that every request shares",
        "A handler cannot see values set by middleware",
        "With c.GetString(requestIDKey), or c.Get(requestIDKey) followed by a type assertion"
      ],
      "answerIndex": 3,
      "explanation": "c.Set stores a per-request value on the same context that the handler receives. c.GetString returns it as a string (empty if missing); c.Get returns an any plus an ok flag that you then assert to string."
    },
    {
      "question": "Your API allows only the origin https://app.example.com through the gin-contrib/cors middleware. Does this stop someone from calling the API with curl and no Origin header?",
      "options": [
        "Yes, the middleware rejects every client that is not on the list",
        "No, CORS is enforced by browsers only; curl is served normally, so you still need authentication",
        "Yes, but only for POST requests",
        "No, because curl always sends the allowed origin automatically"
      ],
      "answerIndex": 1,
      "explanation": "CORS is a browser rule. A request with no Origin header is not subject to it and is served, and any client can fake an Origin header anyway. Use authentication to control who may call the API."
    }
  ]
});
