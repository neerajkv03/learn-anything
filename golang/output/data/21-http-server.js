window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "21-http-server",
  "order": 21,
  "title": "HTTP Servers",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Build web servers with Go's standard net/http package: write handlers, route by method and path with ServeMux, read and write JSON safely, wrap handlers with middleware, and shut down gracefully. Everything here uses only the standard library, which is how most production Go services are built.",
  "prerequisites": [
    "20-testing"
  ],
  "subtopics": [
    {
      "id": "net-http-handlers",
      "title": "net/http handlers",
      "explanation": "HTTP (HyperText Transfer Protocol) is the request/response language of the web. A client (a browser, the curl tool, another program) sends a request made of a method (what it wants to do, such as GET to read or POST to create), a path (which thing, such as /hello), headers (extra key/value details) and sometimes a body (data, such as JSON). The server replies with a status code (a number such as 200 for OK or 404 for not found), headers and a body.\n\nGo's standard library package net/http implements both sides of HTTP. In Go, the server side is built around one interface (a set of method signatures, from topic 10): http.Handler, which has a single method, ServeHTTP(w http.ResponseWriter, r *http.Request). The *http.Request (a pointer, from topic 9) holds everything the client sent: r.Method, r.URL.Path, r.Header and r.Body. The http.ResponseWriter is what you write the reply to; it also satisfies io.Writer (topic 10), so fmt.Fprintln(w, ...) works.\n\nWriting a whole type just to answer a request is heavy, so net/http gives you http.HandlerFunc. It is a function type that has a ServeHTTP method which simply calls the function. Any function with the signature func(w http.ResponseWriter, r *http.Request) can be converted to a Handler. mux.HandleFunc(pattern, f) does that conversion for you.\n\nA ServeMux (a request multiplexer, or router) is a Handler that looks at each request and forwards it to the handler registered for the matching pattern. Create one with http.NewServeMux(). Then http.ListenAndServe(\":8080\", mux) opens port 8080 (a TCP network connection point, the standard kind of connection) on your machine (the \":8080\" means all network addresses, port 8080) and serves requests forever. It only returns if something goes wrong, so it is wrapped in log.Fatal, which prints the error and ends the program with a failure exit code.\n\nThe server runs every incoming request in its own goroutine (topic 15). This is why it handles many clients at once, and also why any data shared between handlers needs a lock (topic 16).\n\nTo try it: make a new empty folder, open a terminal in it, run go mod init example.com/hello (topic 1), save the code below as main.go, and run go run . The program prints nothing and keeps running; leave it running. Open a second terminal and run the curl command. curl is a command-line tool that sends HTTP requests and prints the response; you can also open http://localhost:8080/hello in a browser. In Windows PowerShell, curl is an alias for a different command, so type curl.exe instead. Stop the server with Ctrl+C.",
      "analogy": "A restaurant kitchen. The request is the order ticket that arrives with everything the customer asked for. The handler is the cook who reads the ticket, and the ResponseWriter is the plate: whatever you put on it is what gets served back. The ServeMux is the expediter who looks at each ticket and passes it to the right cook, and each ticket gets its own cook (goroutine) so one slow dish does not block the others.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"log\"\n\t\"net/http\"\n)\n\nfunc main() {\n\tmux := http.NewServeMux()\n\n\tmux.HandleFunc(\"GET /hello\", func(w http.ResponseWriter, r *http.Request) {\n\t\tfmt.Fprintln(w, \"hello\")\n\t})\n\n\tlog.Fatal(http.ListenAndServe(\":8080\", mux))\n}\n",
          "output": "",
          "explanation": "The server prints nothing itself. mux.HandleFunc registers a function for requests whose method is GET and whose path is /hello. fmt.Fprintln(w, \"hello\") writes the line to the response body. The status code defaults to 200 OK when you write a body without choosing one. ListenAndServe blocks forever, so the program keeps running until you press Ctrl+C."
        },
        {
          "language": "bash",
          "filename": "terminal-2.sh",
          "source": "curl localhost:8080/hello",
          "output": "hello",
          "explanation": "Run this in a second terminal while the server is running. On Windows PowerShell use curl.exe localhost:8080/hello."
        },
        {
          "language": "go",
          "filename": "greeter.go",
          "source": "// Replace main.go with this code (or use a new folder); a folder can hold only one main().\npackage main\n\nimport (\n\t\"fmt\"\n\t\"log\"\n\t\"net/http\"\n)\n\n// greeter is a Handler: it has a ServeHTTP method with the right signature.\ntype greeter struct {\n\tgreeting string\n}\n\nfunc (g greeter) ServeHTTP(w http.ResponseWriter, r *http.Request) {\n\tfmt.Fprintln(w, g.greeting)\n}\n\nfunc main() {\n\tmux := http.NewServeMux()\n\n\t// Handle takes a Handler value; HandleFunc takes a plain function.\n\tmux.Handle(\"GET /hi\", greeter{greeting: \"hi there\"})\n\tmux.Handle(\"GET /bye\", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {\n\t\tfmt.Fprintln(w, \"goodbye\")\n\t}))\n\n\tlog.Fatal(http.ListenAndServe(\":8080\", mux))\n}\n",
          "output": "",
          "explanation": "greeter satisfies http.Handler implicitly (topic 10), so mux.Handle accepts it, and it can carry its own data (the greeting field). The second route shows what HandleFunc does for you: it converts the function with http.HandlerFunc and then calls Handle. After starting it, curl localhost:8080/hi prints hi there and curl localhost:8080/bye prints goodbye."
        }
      ],
      "productionNote": "Every Go web service and API starts from an http.Handler, so this pattern is everywhere. Build your own ServeMux with http.NewServeMux() and pass it explicitly, rather than relying on the package-level http.DefaultServeMux (the global mux that http.HandleFunc registers on). Any imported package could add routes to that global mux without you noticing, which is a security and testing hazard.",
      "commonMistakes": [
        "Registering routes on the global http.DefaultServeMux (calling http.HandleFunc directly) in a library or a larger program. Create your own mux with http.NewServeMux() so you control exactly which routes exist.",
        "Sharing a variable (a counter, a map) between handlers without a sync.Mutex. Each request runs in its own goroutine, so this is a data race (topic 16).",
        "Forgetting that ListenAndServe never returns on success. Code placed after it in main will not run until the server stops.",
        "In PowerShell, typing curl and getting unexpected output: curl is an alias for Invoke-WebRequest there. Use curl.exe."
      ],
      "sources": [
        {
          "title": "net/http: type Handler",
          "url": "https://pkg.go.dev/net/http#Handler"
        },
        {
          "title": "net/http: type ServeMux",
          "url": "https://pkg.go.dev/net/http#ServeMux"
        },
        {
          "title": "Writing Web Applications (Go tutorial)",
          "url": "https://go.dev/doc/articles/wiki/"
        }
      ]
    },
    {
      "id": "servemux-routing",
      "title": "ServeMux routing with methods and path values",
      "explanation": "Since Go 1.22, a ServeMux pattern can begin with an HTTP method. \"GET /users/{id}\" matches only GET requests whose path has the form /users/something. A GET pattern also matches HEAD requests (HEAD is GET without the response body). If the path matches a pattern but the method does not, the mux automatically replies 405 Method Not Allowed (the status code meaning the path exists but not for this method) and sets an Allow header listing the allowed methods. A path that matches nothing gets 404 Not Found.\n\nA part of a pattern in curly braces is a wildcard that matches one path segment (the text between two slashes). Inside the handler, r.PathValue(\"id\") returns the text that matched. The value is always a string, even if it looks like a number, and it comes from the client, so validate it. For numbers, convert with strconv.Atoi (topic 5) and answer 400 Bad Request when it fails.\n\nA wildcard ending in three dots, such as {path...}, matches the whole rest of the path, including slashes. The pattern \"GET /files/{path...}\" matches /files/docs/a.txt and gives PathValue(\"path\") the value docs/a.txt.\n\nA pattern that is just \"/\" matches every path that no other pattern matches, which is rarely what you want. To match only the exact root path, use \"/{$}\"; the {$} means end of path. When several patterns match, the most specific one wins, regardless of the order you registered them.\n\nIn the example, http.Error(w, message, code) is used to send a plain-text error with a status code; the next sub-topic explains it fully. Use curl's -w option to print the status code after the body, and -X POST to choose a method. Use curl.exe in PowerShell.",
      "analogy": "A mailroom in an office building. Each envelope is sorted by floor and room number (the path and its {id} wildcard). Each door also only accepts the right kind of mail: the accounting room takes invoices but sends a polite 'wrong kind of mail' note for parcels (405). A letter addressed to a room that does not exist comes back as 'no such address' (404). The most specific address always wins over a general 'deliver to reception' rule.",
      "code": [
        {
          "language": "go",
          "filename": "routes.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"log\"\n\t\"net/http\"\n\t\"strconv\"\n)\n\nfunc main() {\n\tmux := http.NewServeMux()\n\n\t// Only the exact path \"/\", not every unmatched path.\n\tmux.HandleFunc(\"GET /{$}\", func(w http.ResponseWriter, r *http.Request) {\n\t\tfmt.Fprintln(w, \"home\")\n\t})\n\n\tmux.HandleFunc(\"GET /users/{id}\", func(w http.ResponseWriter, r *http.Request) {\n\t\tid, err := strconv.Atoi(r.PathValue(\"id\"))\n\t\tif err != nil {\n\t\t\thttp.Error(w, \"id must be a number\", http.StatusBadRequest)\n\t\t\treturn\n\t\t}\n\t\tfmt.Fprintf(w, \"user %d\\n\", id)\n\t})\n\n\t// {path...} matches the rest of the path, slashes included.\n\tmux.HandleFunc(\"GET /files/{path...}\", func(w http.ResponseWriter, r *http.Request) {\n\t\tfmt.Fprintf(w, \"file path: %s\\n\", r.PathValue(\"path\"))\n\t})\n\n\tlog.Fatal(http.ListenAndServe(\":8080\", mux))\n}\n",
          "output": "",
          "explanation": "Run it with go run . and leave it running. Each handler reads its wildcard with r.PathValue. The /users handler validates the id with strconv.Atoi and stops with return after sending the 400 error; forgetting that return would make the code continue and write a second response."
        },
        {
          "language": "bash",
          "filename": "terminal-2.sh",
          "source": "curl localhost:8080/\ncurl localhost:8080/users/42\ncurl localhost:8080/files/docs/a.txt\ncurl -w \"status: %{http_code}\\n\" localhost:8080/users/abc\ncurl -w \"status: %{http_code}\\n\" -X POST localhost:8080/users/42\ncurl -w \"status: %{http_code}\\n\" localhost:8080/nothing",
          "output": "home\nuser 42\nfile path: docs/a.txt\nid must be a number\nstatus: 400\nMethod Not Allowed\nstatus: 405\n404 page not found\nstatus: 404",
          "explanation": "The POST to /users/42 matches the path of the GET pattern but not its method, so the mux answers 405 by itself without calling your handler. /nothing matches no pattern, so it is 404. Because we used /{$} instead of /, an unknown path is not swallowed by the home handler."
        }
      ],
      "productionNote": "Go 1.22+ patterns cover most REST-style routing (methods, path parameters, wildcards), so many services need no third-party router. Always validate path values: they are untrusted input from the client, and a failed conversion should produce a 400, not a crash or a 500.",
      "commonMistakes": [
        "Registering \"GET /\" and expecting it to match only the home page. It matches every path no other pattern claims. Use \"GET /{$}\" for the exact root.",
        "Trusting r.PathValue(\"id\") as if it were a valid number or an id that exists. It is an arbitrary string from the client: convert with strconv.Atoi and reply 400 on error.",
        "Forgetting return after http.Error, so the handler keeps running and writes more output.",
        "Registering two patterns that conflict (both match some requests and neither is more specific). The mux panics at registration time, which shows up as soon as the program starts."
      ],
      "sources": [
        {
          "title": "Routing Enhancements for Go 1.22",
          "url": "https://go.dev/blog/routing-enhancements"
        },
        {
          "title": "net/http: Patterns (ServeMux)",
          "url": "https://pkg.go.dev/net/http#hdr-Patterns-ServeMux"
        },
        {
          "title": "net/http: Request.PathValue",
          "url": "https://pkg.go.dev/net/http#Request.PathValue"
        }
      ]
    },
    {
      "id": "json-request-response",
      "title": "JSON request and response",
      "explanation": "Most APIs exchange JSON (topic 19). The handler's job has three steps: read and validate the request body, do the work, then write a response with the right status code. The order of writing the response matters, because HTTP sends the status line and headers first and the body after.\n\nFirst, limit the body. A client could send gigabytes. r.Body = http.MaxBytesReader(w, r.Body, 1<<20) wraps the body so that reading more than 1<<20 bytes (1 MiB; 1<<20 means 1 shifted left 20 bits, which is 1,048,576) fails with an error.\n\nThen decode with json.NewDecoder(r.Body).Decode(&req) as in topic 19. Calling DisallowUnknownFields on the decoder rejects JSON with fields your struct does not have. Any decode error means the client sent something wrong, so reply 400 Bad Request (the client made a mistake). A body over the limit also fails the decode; production code can detect it with errors.As (topic 11) against *http.MaxBytesError and reply 413 instead.\n\nSecond, validate the data. An empty name is syntactically valid JSON but not acceptable, so reply 400 with a message. http.Error(w, msg, code) sets the status code, sets the Content-Type (a header that tells the other side what kind of data the body holds) to plain text, and writes msg followed by a newline. Always return right after it.\n\nThird, write the response in this order: set headers with w.Header().Set(\"Content-Type\", \"application/json\"), then call w.WriteHeader(http.StatusCreated) to send the status 201 (Created), then write the body with json.NewEncoder(w).Encode(value). Headers set after WriteHeader, or after the first Write, are silently ignored because they were already sent. If you never call WriteHeader, the first Write sends 200 OK automatically.\n\nThe example assigns each new user an id from a counter. Since requests run concurrently, the counter is protected with a sync.Mutex (topic 16). curl's -d option sends its text as the request body and makes the method POST. The bash commands below use single quotes; in PowerShell quoting is different, so create body.json in the folder where you run the server, containing {\"name\":\"Ada\"}, and run curl.exe -d \"@body.json\" localhost:8080/users instead.",
      "analogy": "An order form coming in and an itemized receipt going out. The front desk first checks the form is not absurdly long (MaxBytesReader), is readable (decode), and is filled in (validation); a bad form is handed back with a note saying what is wrong (400). For a good one, the clerk first writes the receipt's header (content type and status) and only then lists the items (body). Once the header has been handed over, it cannot be rewritten.",
      "code": [
        {
          "language": "go",
          "filename": "create.go",
          "source": "// Replace main.go with this code (or use a new folder); a folder can hold only one main().\npackage main\n\nimport (\n\t\"encoding/json\"\n\t\"log\"\n\t\"net/http\"\n\t\"sync\"\n)\n\ntype createUserRequest struct {\n\tName string `json:\"name\"`\n}\n\ntype user struct {\n\tID   int    `json:\"id\"`\n\tName string `json:\"name\"`\n}\n\nfunc main() {\n\tvar mu sync.Mutex\n\tnextID := 1\n\n\tmux := http.NewServeMux()\n\tmux.HandleFunc(\"POST /users\", func(w http.ResponseWriter, r *http.Request) {\n\t\t// 1. Limit the body to 1 MiB.\n\t\tr.Body = http.MaxBytesReader(w, r.Body, 1<<20)\n\n\t\t// 2. Decode and validate.\n\t\tvar req createUserRequest\n\t\tdec := json.NewDecoder(r.Body)\n\t\tdec.DisallowUnknownFields()\n\t\tif err := dec.Decode(&req); err != nil {\n\t\t\thttp.Error(w, \"invalid JSON body\", http.StatusBadRequest)\n\t\t\treturn\n\t\t}\n\t\tif req.Name == \"\" {\n\t\t\thttp.Error(w, \"name is required\", http.StatusBadRequest)\n\t\t\treturn\n\t\t}\n\n\t\t// 3. Do the work (the counter is shared between requests).\n\t\tmu.Lock()\n\t\tid := nextID\n\t\tnextID++\n\t\tmu.Unlock()\n\n\t\t// 4. Headers first, then status, then body.\n\t\tw.Header().Set(\"Content-Type\", \"application/json\")\n\t\tw.WriteHeader(http.StatusCreated)\n\t\tif err := json.NewEncoder(w).Encode(user{ID: id, Name: req.Name}); err != nil {\n\t\t\tlog.Printf(\"write response: %v\", err)\n\t\t}\n\t})\n\n\tlog.Fatal(http.ListenAndServe(\":8080\", mux))\n}\n",
          "output": "",
          "explanation": "The struct tags (topic 19) control the JSON field names. Every error path calls http.Error and returns. On success the order is Header().Set, WriteHeader, Encode. After WriteHeader the status is already sent, so an encoding error can only be logged, not turned into a different status."
        },
        {
          "language": "bash",
          "filename": "terminal-2.sh",
          "source": "curl -w \"status: %{http_code}\\n\" -d '{\"name\":\"Ada\"}' localhost:8080/users\ncurl -w \"status: %{http_code}\\n\" -d '{\"name\":\"\"}' localhost:8080/users\ncurl -w \"status: %{http_code}\\n\" -d 'oops' localhost:8080/users",
          "output": "{\"id\":1,\"name\":\"Ada\"}\nstatus: 201\nname is required\nstatus: 400\ninvalid JSON body\nstatus: 400",
          "explanation": "The first request succeeds with 201 and the new user as JSON. The second is valid JSON with an empty name, rejected by our validation. The third is not JSON at all, so Decode fails. The id counter only advances for the successful request."
        }
      ],
      "productionNote": "Every JSON API follows this shape: cap the body, decode strictly, validate, then respond with the correct status code and Content-Type. Real services usually put the response-writing part in a small helper function (for example writeJSON(w, status, value)) so the header, status and encode order is written correctly once and reused.",
      "commonMistakes": [
        "Setting a header after w.WriteHeader or after the first write to w. It is ignored because the headers were already sent.",
        "Reading r.Body with no size limit, letting one client exhaust memory. Wrap it with http.MaxBytesReader.",
        "Returning 200 for failures, or writing an error and forgetting return so a second response is appended. Use http.Error with the right 4xx code and return.",
        "Skipping validation because the JSON decoded without error. Decoding only checks the syntax and types, not whether the values make sense."
      ],
      "sources": [
        {
          "title": "net/http: MaxBytesReader",
          "url": "https://pkg.go.dev/net/http#MaxBytesReader"
        },
        {
          "title": "net/http: type ResponseWriter",
          "url": "https://pkg.go.dev/net/http#ResponseWriter"
        },
        {
          "title": "net/http: func Error",
          "url": "https://pkg.go.dev/net/http#Error"
        }
      ]
    },
    {
      "id": "middleware",
      "title": "Middleware",
      "explanation": "Middleware is a function that takes an http.Handler and returns a new http.Handler that wraps it. The wrapper can run code before the inner handler, call it, and run code after. Because it takes and returns the same type, middleware can be stacked like layers.\n\nThe standard shape is: func logging(next http.Handler) http.Handler. Inside, return http.HandlerFunc(func(w, r) { ... }) (the conversion from the first sub-topic). The key line is next.ServeHTTP(w, r), which hands the request to the wrapped handler. If you do not call it, the inner handler never runs, which is exactly what an authentication check does when it rejects a request.\n\nUse it by wrapping the mux: http.ListenAndServe(\":8080\", logging(mux)). Now every request to every route passes through logging first. Common middleware does logging (method, path, duration, status), panic recovery (catching a crash in one handler so the whole server does not die), authentication (checking a token), and request ids. To pass a value such as a request id to handlers, store it in the request's context (topic 17) with context.WithValue and r.WithContext(ctx), and read it back via r.Context().\n\nWhen you stack layers, the outermost wrapper runs first on the way in and last on the way out. In label(\"A\")(label(\"B\")(mux)), the order is: A before, B before, handler, B after, A after. The second example below makes this visible; it calls log.SetFlags(0) so log lines have no timestamp and the output is predictable.",
      "analogy": "Airport security layers. Every passenger passes through the same checkpoints (ID check, then baggage scan) before reaching the gate, and nobody writes those checks into each gate's own procedure. A checkpoint can also turn a passenger away so they never reach the gate (not calling next). On the way out of the airport the passenger passes the layers in reverse order.",
      "code": [
        {
          "language": "go",
          "filename": "mw.go",
          "source": "// Replace main.go with this code (or use a new folder); a folder can hold only one main().\npackage main\n\nimport (\n\t\"fmt\"\n\t\"log\"\n\t\"net/http\"\n\t\"time\"\n)\n\n// logging wraps next and logs the method, path and duration of each request.\nfunc logging(next http.Handler) http.Handler {\n\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {\n\t\tstart := time.Now()\n\t\tnext.ServeHTTP(w, r)\n\t\tlog.Printf(\"%s %s %v\", r.Method, r.URL.Path, time.Since(start))\n\t})\n}\n\nfunc main() {\n\tmux := http.NewServeMux()\n\tmux.HandleFunc(\"GET /hello\", func(w http.ResponseWriter, r *http.Request) {\n\t\tfmt.Fprintln(w, \"hello\")\n\t})\n\n\tlog.Fatal(http.ListenAndServe(\":8080\", logging(mux)))\n}\n",
          "output": "",
          "explanation": "The program prints nothing at startup. After curl localhost:8080/hello, the client sees hello and the server terminal shows one log line like: 2026/11/15 10:30:00 GET /hello 52.3µs. The timestamp and duration differ on every run. The log line is written after next.ServeHTTP returns, which is how the duration is measured."
        },
        {
          "language": "go",
          "filename": "order.go",
          "source": "// Replace main.go with this code (or use a new folder); a folder can hold only one main().\npackage main\n\nimport (\n\t\"fmt\"\n\t\"log\"\n\t\"net/http\"\n)\n\n// label returns a middleware that logs before and after the inner handler.\nfunc label(name string) func(http.Handler) http.Handler {\n\treturn func(next http.Handler) http.Handler {\n\t\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {\n\t\t\tlog.Println(name, \"before\")\n\t\t\tnext.ServeHTTP(w, r)\n\t\t\tlog.Println(name, \"after\")\n\t\t})\n\t}\n}\n\nfunc main() {\n\tlog.SetFlags(0) // no timestamp, so the lines are predictable\n\n\tmux := http.NewServeMux()\n\tmux.HandleFunc(\"GET /hello\", func(w http.ResponseWriter, r *http.Request) {\n\t\tlog.Println(\"handler\")\n\t\tfmt.Fprintln(w, \"hello\")\n\t})\n\n\t// A is the outermost layer, B is inside it.\n\thandler := label(\"A\")(label(\"B\")(mux))\n\tlog.Fatal(http.ListenAndServe(\":8080\", handler))\n}\n",
          "output": "A before\nB before\nhandler\nB after\nA after",
          "explanation": "This is what the server terminal shows after one request made with curl localhost:8080/hello (the client itself sees hello). The outermost middleware runs first going in and last coming out. label returns a function so you can configure each layer with a name; this closure-returning style (topic 4) is common for middleware that needs settings."
        }
      ],
      "productionNote": "Middleware keeps cross-cutting concerns (logging, panic recovery, authentication, request ids, metrics) in one place instead of repeated in every handler. Order matters: put recovery on the outside so it catches panics from every other layer, and put authentication before the handlers it protects.",
      "commonMistakes": [
        "Forgetting to call next.ServeHTTP(w, r), so every request silently stops at the middleware and gets an empty 200 response.",
        "Confusing the order. The first wrapper in the chain is the outermost, so it runs first before the handler and last after it.",
        "Writing the response body in middleware before calling next, which sends the headers early and stops later layers from changing them.",
        "Storing request-specific data in a global variable instead of the request context. Requests run concurrently, so globals get mixed up between requests."
      ],
      "sources": [
        {
          "title": "net/http: type HandlerFunc",
          "url": "https://pkg.go.dev/net/http#HandlerFunc"
        },
        {
          "title": "net/http: type Handler",
          "url": "https://pkg.go.dev/net/http#Handler"
        }
      ]
    },
    {
      "id": "timeouts-graceful-shutdown",
      "title": "Server timeouts and graceful shutdown",
      "explanation": "http.ListenAndServe is fine for learning but has no timeouts. A slow or malicious client can open a connection and send its request one byte at a time (a slowloris attack), tying up your server's resources forever. In production, create an http.Server value and set its timeouts: ReadHeaderTimeout (how long to wait for the request headers), ReadTimeout (for the whole request including the body), WriteTimeout (for writing the response) and IdleTimeout (how long to keep an idle connection open for reuse). Then call srv.ListenAndServe().\n\nWhen you deploy a new version, the platform (a container runtime such as Docker or Kubernetes) stops the old process by sending it a signal (a message from the operating system): SIGTERM asks the program to stop, and Ctrl+C in a terminal sends os.Interrupt. If the program just dies, requests in progress are cut off. A graceful shutdown stops accepting new requests but lets the current ones finish.\n\nsignal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM) returns a context (topic 17) that is cancelled when one of those signals arrives, plus a stop function that you should defer.\n\nThe pattern: start srv.ListenAndServe() in a goroutine, wait with <-ctx.Done(), then call srv.Shutdown(shutdownCtx). Shutdown closes the listeners (the open points the server accepts connections on) so no new connections come in, then waits for in-flight requests (requests already being handled) to finish. The shutdownCtx made with context.WithTimeout(..., 10*time.Second) puts a limit on that wait; if it expires, Shutdown returns the context's error.\n\nOnce Shutdown has been called, ListenAndServe returns the error http.ErrServerClosed immediately. That is the normal outcome, not a failure, so compare with errors.Is and ignore it; only other errors (such as the port already being in use) should end the program. The example has a /slow route that takes 3 seconds so you can watch a request finish during shutdown. log.SetFlags(0) again removes timestamps.\n\nTo try it: run go run ., then in a second terminal run curl localhost:8080/slow, and within 3 seconds press Ctrl+C in the server terminal. The server logs that it is shutting down, the curl command still receives done, and then the server logs that it stopped.",
      "analogy": "Closing a shop for the evening. You lock the front door so no new customers come in (stop accepting connections), let the customers already inside finish their purchases (in-flight requests), and only then turn off the lights and leave (exit). The closing deadline is Shutdown's timeout: if someone is still dawdling after ten minutes, you switch the lights off anyway. Timeouts are the shop rule that a customer who stands at the counter doing nothing is politely asked to move along.",
      "code": [
        {
          "language": "go",
          "filename": "graceful.go",
          "source": "// Replace main.go with this code (or use a new folder); a folder can hold only one main().\npackage main\n\nimport (\n\t\"context\"\n\t\"errors\"\n\t\"fmt\"\n\t\"log\"\n\t\"net/http\"\n\t\"os\"\n\t\"os/signal\"\n\t\"syscall\"\n\t\"time\"\n)\n\nfunc main() {\n\tlog.SetFlags(0) // no timestamp, so the lines are predictable\n\n\tmux := http.NewServeMux()\n\tmux.HandleFunc(\"GET /slow\", func(w http.ResponseWriter, r *http.Request) {\n\t\ttime.Sleep(3 * time.Second)\n\t\tfmt.Fprintln(w, \"done\")\n\t})\n\n\tsrv := &http.Server{\n\t\tAddr:              \":8080\",\n\t\tHandler:           mux,\n\t\tReadHeaderTimeout: 5 * time.Second,\n\t\tReadTimeout:       10 * time.Second,\n\t\tWriteTimeout:      10 * time.Second,\n\t\tIdleTimeout:       60 * time.Second,\n\t}\n\n\t// ctx is cancelled when Ctrl+C or SIGTERM arrives.\n\tctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)\n\tdefer stop()\n\n\tgo func() {\n\t\terr := srv.ListenAndServe()\n\t\tif err != nil && !errors.Is(err, http.ErrServerClosed) {\n\t\t\tlog.Fatal(err)\n\t\t}\n\t}()\n\n\t<-ctx.Done() // block until a signal arrives\n\tlog.Println(\"shutting down\")\n\n\tshutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)\n\tdefer cancel()\n\tif err := srv.Shutdown(shutdownCtx); err != nil {\n\t\tlog.Printf(\"shutdown error: %v\", err)\n\t}\n\tlog.Println(\"server stopped\")\n}\n",
          "output": "shutting down\nserver stopped",
          "explanation": "Nothing is printed until you press Ctrl+C; then the two lines appear. The WriteTimeout of 10 seconds is longer than the 3-second /slow handler, so that request is allowed to finish. A fresh context.Background() is used for shutdownCtx because ctx is already cancelled by the signal; using it would make Shutdown give up immediately. If the goroutine hits a real error such as the port being busy, log.Fatal ends the program with the error."
        },
        {
          "language": "bash",
          "filename": "terminal-2.sh",
          "source": "curl localhost:8080/slow",
          "output": "done",
          "explanation": "Run this while the server is up and press Ctrl+C in the server terminal before 3 seconds pass. The request is not dropped: Shutdown waits for it, so curl still prints done."
        }
      ],
      "productionNote": "Containers and Kubernetes send SIGTERM on every deploy or scale-down and kill the process after a grace period (30 seconds by default in Kubernetes). A graceful shutdown with a timeout shorter than that period means no dropped requests during a rollout. Always set at least ReadHeaderTimeout, and pick the others to match your slowest legitimate request.",
      "commonMistakes": [
        "Using plain http.ListenAndServe in production. It has no timeouts, so slow clients can hold connections open indefinitely.",
        "Treating http.ErrServerClosed as a crash. It is the expected return value after Shutdown; ignore it.",
        "Passing the already-cancelled signal context to Shutdown, so it returns instantly without waiting. Create a new context with context.WithTimeout from context.Background().",
        "Setting WriteTimeout shorter than your slowest handler, which cuts off the response mid-flight.",
        "Returning from main right after calling Shutdown without letting it finish, or never waiting for ctx.Done(), so the process exits before in-flight requests complete."
      ],
      "sources": [
        {
          "title": "net/http: type Server",
          "url": "https://pkg.go.dev/net/http#Server"
        },
        {
          "title": "net/http: Server.Shutdown",
          "url": "https://pkg.go.dev/net/http#Server.Shutdown"
        },
        {
          "title": "os/signal: NotifyContext",
          "url": "https://pkg.go.dev/os/signal#NotifyContext"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "A server has the route \"GET /users/{id}\". What does r.PathValue(\"id\") return for a request to /users/42?",
      "options": [
        "The string \"42\"",
        "The integer 42",
        "The whole path \"/users/42\"",
        "An error because id is not declared"
      ],
      "answerIndex": 0,
      "explanation": "PathValue always returns the matched text as a string. To use it as a number you must convert it yourself with strconv.Atoi and handle the error (reply 400 if it fails)."
    },
    {
      "question": "A route is registered as \"GET /x\". What does the mux reply to a POST request for /x?",
      "options": [
        "200 OK with an empty body",
        "405 Method Not Allowed, without calling your handler",
        "404 Not Found",
        "The handler runs normally because the path matches"
      ],
      "answerIndex": 1,
      "explanation": "The path matches but the method does not, so ServeMux automatically answers 405 Method Not Allowed (with an Allow header) and your handler is never called. 404 is for paths that match no pattern."
    },
    {
      "question": "Why must you call w.Header().Set(\"Content-Type\", \"application/json\") before w.WriteHeader(http.StatusCreated)?",
      "options": [
        "Go refuses to compile if the order is reversed",
        "WriteHeader deletes any headers that were set earlier",
        "Content-Type is only allowed on 2xx responses",
        "WriteHeader sends the status and headers immediately, so headers set afterwards are ignored"
      ],
      "answerIndex": 3,
      "explanation": "HTTP sends the status line and headers before the body. Once WriteHeader (or the first Write) happens, the headers have gone out, and later changes to w.Header() have no effect. The compiler cannot detect the mistake."
    },
    {
      "question": "In func logging(next http.Handler) http.Handler, what does the middleware wrap and what happens if it never calls next.ServeHTTP?",
      "options": [
        "It wraps another handler; if next is never called, that inner handler never runs",
        "It wraps the TCP connection; the request is simply retried",
        "It wraps the response body; the client receives the body twice",
        "It wraps the ServeMux; the server fails to start"
      ],
      "answerIndex": 0,
      "explanation": "Middleware takes a handler and returns a new handler around it. Calling next.ServeHTTP passes the request inward. Skipping the call stops the request at that layer, which is how authentication middleware rejects requests."
    },
    {
      "question": "What does srv.Shutdown(ctx) do with requests that are already being handled?",
      "options": [
        "It cancels them immediately and sends 500 errors",
        "It ignores them and closes all connections at once",
        "It stops accepting new connections and waits for in-flight requests to finish, until ctx expires",
        "It restarts them on a new goroutine after the server stops"
      ],
      "answerIndex": 2,
      "explanation": "Shutdown closes the listeners and then waits for active requests to complete. The context you pass sets the maximum time to wait; if it expires first, Shutdown returns the context's error."
    }
  ]
});
