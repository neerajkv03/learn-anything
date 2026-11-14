window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "30-gin-errors",
  "order": 30,
  "title": "Errors & Responses",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Build an API whose failures all look the same: one JSON error shape, requests stopped cleanly with AbortWithStatusJSON, errors collected by handlers and turned into responses in one middleware, domain errors mapped to HTTP status codes, and panics (crashes caused by bugs) caught without leaking details to clients.",
  "prerequisites": ["29-gin-middleware", "11-error-handling"],
  "subtopics": [
    {
      "id": "consistent-json-error-shape",
      "title": "Consistent JSON error shape",
      "explanation": "When something goes wrong, the program that called your API (a web page, a phone app, another service; we call it the client) has to understand the failure. If one handler answers {\"error\":\"not found\"}, another answers {\"message\":\"bad id\"} and a third answers plain text, every client needs special code for each. The fix is to pick one shape and use it for every error. In this course the shape is:\n\n{\"error\":{\"code\":\"not_found\",\"message\":\"user 99 not found\"}}\n\nThe two fields have different jobs. code is a short, stable, machine-readable name written in snake_case (lowercase words joined by underscores, like not_found). Client code switches on it, so you must never rename it casually. message is a sentence for humans; it may be reworded at any time and clients must not depend on it.\n\nIn Go this is a small struct (a type with named fields, topic 8) with struct tags (topic 19) that set the JSON names. The Details field is optional: it holds extra per-field information, such as validation problems from topic 28, and omitempty (topic 19) drops it from the JSON when the map is empty or nil. Then one helper function, fail, writes the shape so no handler builds error JSON by hand.\n\nThe same helper serves the 404 for unknown routes. In topic 27 you learned that NoRoute registers a handler for URLs that match nothing; if it uses fail too, even a mistyped URL gets the standard shape instead of Gin's plain text 404 page not found. The same idea applies to NoMethod (405 responses) and to validation failures.\n\nSave the program below as shape.go in an empty folder, open a terminal in that folder, then run go mod init example.com/shape, go get github.com/gin-gonic/gin@v1.12.0, and finally go run . to start the server.",
      "analogy": "Every complaint form in a company uses the same template: a short reference code in one box and a free-text description in another. The complaints desk can then sort and route any form without reading it closely, just as a client can handle any error from your API by looking at code.",
      "code": [
        {
          "language": "go",
          "filename": "shape.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"net/http\"\n\t\"strconv\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\n// APIError is the one error shape used by every response.\ntype APIError struct {\n\tCode    string            `json:\"code\"`\n\tMessage string            `json:\"message\"`\n\tDetails map[string]string `json:\"details,omitempty\"`\n}\n\n// fail writes {\"error\":{\"code\":...,\"message\":...}} with the given status.\nfunc fail(c *gin.Context, status int, code, msg string) {\n\tc.JSON(status, gin.H{\"error\": APIError{Code: code, Message: msg}})\n}\n\nvar users = map[int]string{1: \"Asha\", 2: \"Ravi\"}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\n\tr.NoRoute(func(c *gin.Context) {\n\t\tfail(c, http.StatusNotFound, \"route_not_found\", \"no such route\")\n\t})\n\n\tr.GET(\"/users/:id\", func(c *gin.Context) {\n\t\tid, err := strconv.Atoi(c.Param(\"id\"))\n\t\tif err != nil {\n\t\t\tfail(c, http.StatusBadRequest, \"invalid_id\", \"id must be a number\")\n\t\t\treturn\n\t\t}\n\t\tname, ok := users[id]\n\t\tif !ok {\n\t\t\tfail(c, http.StatusNotFound, \"not_found\", fmt.Sprintf(\"user %d not found\", id))\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusOK, gin.H{\"user\": gin.H{\"id\": id, \"name\": name}})\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "The server prints nothing: release mode (topic 26) silences Gin's startup lines. Every failure goes through fail, so the JSON shape cannot drift between handlers. The Details field is nil in all these responses, so omitempty leaves it out. Note the return after each fail call; fail only writes a response, it does not stop the function."
        },
        {
          "language": "bash",
          "filename": "try-shape.sh",
          "source": "curl -s localhost:8080/users/1\ncurl -s localhost:8080/users/99\ncurl -s localhost:8080/users/abc\ncurl -s localhost:8080/nope",
          "output": "{\"user\":{\"id\":1,\"name\":\"Asha\"}}\n{\"error\":{\"code\":\"not_found\",\"message\":\"user 99 not found\"}}\n{\"error\":{\"code\":\"invalid_id\",\"message\":\"id must be a number\"}}\n{\"error\":{\"code\":\"route_not_found\",\"message\":\"no such route\"}}",
          "explanation": "Run these in a second terminal while the server runs. Gin does not add a trailing newline to JSON bodies, so in a real terminal the outputs may run together on one line; they are shown on separate lines here for readability. On Windows PowerShell, type curl.exe instead of curl."
        }
      ],
      "productionNote": "Frontends and client libraries (SDKs, packages that wrap your API for other programmers) switch on the stable code field to decide what to show or retry. Document your list of codes like part of the API. RFC 9457 (Problem Details for HTTP APIs) is a published standard shape for the same idea; this course uses a simpler hand-made shape, but the principle, one shape everywhere, is identical.",
      "commonMistakes": [
        "Mixing {\"error\":\"...\"} in one handler and {\"message\":\"...\"} in another. Clients then need a special case per endpoint. Send every error through one helper.",
        "Putting internal error text (a database error, a file path, a server name) in message. Clients, and attackers, can read it. Use a short human sentence you wrote yourself.",
        "Renaming a code value because the wording changed. Change message freely; keep code stable."
      ],
      "sources": [
        { "title": "gin: Context.JSON", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.JSON" },
        { "title": "RFC 9457: Problem Details for HTTP APIs", "url": "https://www.rfc-editor.org/rfc/rfc9457" }
      ]
    },
    {
      "id": "abort-with-status-json",
      "title": "AbortWithStatusJSON",
      "explanation": "In topic 29 you learned that a request passes through a chain of middleware and then the handler, and that c.Abort() stops the rest of the chain from running. A middleware that rejects a request usually needs to do two things: stop the chain and tell the client why.\n\nc.AbortWithStatusJSON(status, body) does both in one call. It is the same as calling c.Abort() followed by c.JSON(status, body). In a middleware, that means later middleware and the handler never run. In a handler it behaves like c.JSON plus Abort, which is harmless; you should still write return after it, because Abort does not stop your own function. Code after the call keeps executing.\n\nThe program below has a middleware factory (a function that returns a middleware, topic 29) that requires a header named X-Tenant, which identifies which customer a request is for. If the header is missing, the middleware rejects the request with the standard error shape and the handler is never reached. The handler prints handler ran to the server's terminal so you can see whether it was reached.",
      "analogy": "A bouncer at a club door who both blocks you from going in and hands you a note saying exactly why (\"no ticket\"). Blocking alone leaves you confused at the door, and a note alone (without blocking) lets you walk in anyway. AbortWithStatusJSON is the block and the note in one move.",
      "code": [
        {
          "language": "go",
          "filename": "abort.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\n// requireTenant rejects requests that lack an X-Tenant header.\nfunc requireTenant() gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tif c.Request.Header.Get(\"X-Tenant\") == \"\" {\n\t\t\tc.AbortWithStatusJSON(http.StatusBadRequest, gin.H{\n\t\t\t\t\"error\": gin.H{\"code\": \"missing_tenant\", \"message\": \"X-Tenant header required\"},\n\t\t\t})\n\t\t\treturn\n\t\t}\n\t\tc.Next()\n\t}\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\tr.Use(requireTenant())\n\n\tr.GET(\"/ping\", func(c *gin.Context) {\n\t\tfmt.Println(\"handler ran\")\n\t\tc.JSON(http.StatusOK, gin.H{\"tenant\": c.Request.Header.Get(\"X-Tenant\")})\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "handler ran",
          "explanation": "The output is what the server's terminal shows after both requests below were sent. handler ran appears exactly once: the request without the header was stopped in the middleware, so the handler's Println never executed for it. The request with the header passed through c.Next() into the handler."
        },
        {
          "language": "bash",
          "filename": "try-abort.sh",
          "source": "curl -s localhost:8080/ping\ncurl -s -H \"X-Tenant: acme\" localhost:8080/ping",
          "output": "{\"error\":{\"code\":\"missing_tenant\",\"message\":\"X-Tenant header required\"}}\n{\"tenant\":\"acme\"}",
          "explanation": "The first request has no header and receives status 400 with the standard error shape. The second sends -H \"X-Tenant: acme\" (curl's flag for adding a header) and reaches the handler."
        }
      ],
      "productionNote": "Authentication, tenant selection, rate limiting (rejecting clients that send too many requests) and request-size checks are all middleware that reject with AbortWithStatusJSON. Reuse one function that builds the standard error body so these rejections match the errors your handlers produce.",
      "commonMistakes": [
        "Calling c.JSON in a middleware to reject a request but forgetting Abort. The chain continues, the handler runs, and it writes a second body after the first, so the client gets garbled output and Gin logs a warning about headers already written.",
        "Using AbortWithStatusJSON but not writing return after it. The rest of your function still runs, so code that follows may do work you meant to skip."
      ],
      "sources": [
        { "title": "gin: Context.AbortWithStatusJSON", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.AbortWithStatusJSON" }
      ]
    },
    {
      "id": "c-error-and-error-middleware",
      "title": "c.Error and an error-handling middleware",
      "explanation": "Writing the full error response in every handler repeats code and invites inconsistency. Gin offers a different pattern: a handler records the error and returns, and one middleware turns recorded errors into responses.\n\nc.Error(err) appends err to c.Errors, a list kept on the request's context. It returns a value you can ignore, which is why code writes _ = c.Error(err) (the blank identifier, topic 4, says the result is deliberately dropped). The handler writes nothing and simply returns.\n\nThe error-handling middleware calls c.Next() first, which runs the handler and everything after it. When c.Next() comes back, the middleware looks at c.Errors. If the list is empty, the handler succeeded and the middleware does nothing. If it has entries, c.Errors.Last().Err is the most recent error, and the middleware writes one JSON response for it.\n\nBefore writing, the middleware checks c.Writer.Written(), which reports whether a response was already started. If a handler both wrote a response and called c.Error, writing again would produce a second body, so the check skips that case.\n\nRegister the middleware with r.Use before the routes, so it wraps them. If you forget, c.Errors is filled but nobody reads it and the client receives an empty 200 response.",
      "analogy": "Workers on a production line drop faulty items into a bin and keep working. One supervisor at the end of the line looks in the bin and decides how each faulty item is reported. The workers (handlers) stay simple; the reporting rules live in one place (the middleware).",
      "code": [
        {
          "language": "go",
          "filename": "errmw.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nvar ErrNotFound = errors.New(\"not found\")\n\n// ErrorHandler turns the last error recorded with c.Error into one JSON response.\nfunc ErrorHandler() gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tc.Next()\n\n\t\tif len(c.Errors) == 0 || c.Writer.Written() {\n\t\t\treturn // nothing recorded, or a response was already sent\n\t\t}\n\t\terr := c.Errors.Last().Err\n\n\t\tif errors.Is(err, ErrNotFound) {\n\t\t\tc.JSON(http.StatusNotFound, gin.H{\"error\": gin.H{\"code\": \"not_found\", \"message\": \"resource not found\"}})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusInternalServerError, gin.H{\"error\": gin.H{\"code\": \"internal\", \"message\": \"internal server error\"}})\n\t}\n}\n\nfunc getUser(c *gin.Context) {\n\tif c.Param(\"id\") != \"1\" {\n\t\t_ = c.Error(ErrNotFound) // record it and return; no response written here\n\t\treturn\n\t}\n\tc.JSON(http.StatusOK, gin.H{\"user\": gin.H{\"id\": 1, \"name\": \"Asha\"}})\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\tr.Use(ErrorHandler())\n\tr.GET(\"/users/:id\", getUser)\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "The server prints nothing. getUser either writes its own 200 response or records ErrNotFound and returns. The middleware only acts in the second case. errors.Is (topic 11) is used so wrapped errors also match; the next sub-topic builds a fuller mapping on this."
        },
        {
          "language": "bash",
          "filename": "try-errmw.sh",
          "source": "curl -s localhost:8080/users/1\ncurl -s localhost:8080/users/99",
          "output": "{\"user\":{\"id\":1,\"name\":\"Asha\"}}\n{\"error\":{\"code\":\"not_found\",\"message\":\"resource not found\"}}",
          "explanation": "User 1 succeeds and the middleware leaves the handler's response untouched. User 99 returns status 404 with the standard error shape, written by the middleware and not by getUser."
        }
      ],
      "productionNote": "This is the place to put central concerns: the mapping from errors to statuses, logging of unexpected errors, and counting failures for monitoring. Handlers stay short because they only return early after c.Error.",
      "commonMistakes": [
        "Writing a response in the handler and also calling c.Error. Without the c.Writer.Written() check the middleware writes a second body. Always check Written().",
        "Forgetting r.Use(ErrorHandler()), or registering it after the routes. Errors are recorded but never turned into responses, so clients see an empty 200.",
        "Calling c.Error(err) but not returning from the handler, so the handler goes on and writes a success response as well."
      ],
      "sources": [
        { "title": "gin: Context.Error", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.Error" },
        { "title": "gin: Context (Errors field)", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context" }
      ]
    },
    {
      "id": "mapping-domain-errors",
      "title": "Mapping domain errors to status codes (errors.Is/As)",
      "explanation": "Domain code is the part of your program that does the real work (look up a user, create an account), usually in separate packages from your handlers. It should not know about HTTP. So instead of returning \"404\", it returns ordinary Go errors from topic 11: sentinel errors such as ErrNotFound and ErrEmailTaken, or a custom type such as *ValidationError that carries a Field name.\n\nOne function in the HTTP layer translates those errors into a status code, a stable code and a message. Use errors.Is(err, ErrNotFound) to match a sentinel and errors.As(err, &ve) to match a custom type. Both look through errors wrapped with %w, so fmt.Errorf(\"get user 99: %w\", ErrNotFound) still matches. Comparing with err == ErrNotFound would fail on a wrapped error.\n\nThe mapping used here: not found is 404, email already taken is 409 (Conflict: the request clashes with existing data), a validation problem is 422 (Unprocessable Content: the request was well-formed but its values are unacceptable), and anything unrecognised is 500 with the generic body {\"code\":\"internal\",\"message\":\"internal server error\"}.\n\nThe real error of a 500 is never sent to the client. It may contain SQL text or host names. Instead the middleware logs it with log/slog (topic 23) so you can read it, while the client sees only the generic message. The program below builds a logger that prints to standard output without the time attribute; ReplaceAttr is a HandlerOptions callback that is called for each attribute and may change or drop it, and returning an empty slog.Attr drops it. This only keeps the demo output predictable; in production you would keep the time.",
      "analogy": "Hospital triage. The nurse (the mapping function) looks at the diagnosis (a domain error) and sends the patient to the right ward (a status code). A patient nobody recognises goes to the general ward, and the doctor's detailed notes stay in the hospital's own records (the log), not in the hands of visitors.",
      "code": [
        {
          "language": "go",
          "filename": "mapping.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n\t\"log/slog\"\n\t\"net/http\"\n\t\"os\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nvar (\n\tErrNotFound   = errors.New(\"not found\")\n\tErrEmailTaken = errors.New(\"email taken\")\n)\n\n// ValidationError reports which field had an unacceptable value.\ntype ValidationError struct{ Field string }\n\nfunc (e *ValidationError) Error() string { return \"invalid \" + e.Field }\n\n// toAPI maps a domain error to (status, code, message).\nfunc toAPI(err error) (int, string, string) {\n\tvar ve *ValidationError\n\tswitch {\n\tcase errors.Is(err, ErrNotFound):\n\t\treturn http.StatusNotFound, \"not_found\", \"resource not found\"\n\tcase errors.Is(err, ErrEmailTaken):\n\t\treturn http.StatusConflict, \"email_taken\", \"email already registered\"\n\tcase errors.As(err, &ve):\n\t\treturn http.StatusUnprocessableEntity, \"validation_failed\", ve.Field + \" is invalid\"\n\tdefault:\n\t\treturn http.StatusInternalServerError, \"internal\", \"internal server error\"\n\t}\n}\n\nfunc ErrorHandler(logger *slog.Logger) gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tc.Next()\n\t\tif len(c.Errors) == 0 || c.Writer.Written() {\n\t\t\treturn\n\t\t}\n\t\terr := c.Errors.Last().Err\n\t\tstatus, code, msg := toAPI(err)\n\t\tif status == http.StatusInternalServerError {\n\t\t\t// the real error goes to the log, never to the client\n\t\t\tlogger.Error(\"request failed\", \"path\", c.Request.URL.Path, \"err\", err)\n\t\t}\n\t\tc.JSON(status, gin.H{\"error\": gin.H{\"code\": code, \"message\": msg}})\n\t}\n}\n\nfunc main() {\n\topts := &slog.HandlerOptions{ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {\n\t\tif a.Key == slog.TimeKey && len(groups) == 0 {\n\t\t\treturn slog.Attr{} // drop the time so the demo output is stable\n\t\t}\n\t\treturn a\n\t}}\n\tlogger := slog.New(slog.NewTextHandler(os.Stdout, opts))\n\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\tr.Use(ErrorHandler(logger))\n\n\tr.GET(\"/fail/:kind\", func(c *gin.Context) {\n\t\tvar err error\n\t\tswitch c.Param(\"kind\") {\n\t\tcase \"missing\":\n\t\t\terr = fmt.Errorf(\"get user 99: %w\", ErrNotFound)\n\t\tcase \"taken\":\n\t\t\terr = ErrEmailTaken\n\t\tcase \"invalid\":\n\t\t\terr = &ValidationError{Field: \"email\"}\n\t\tdefault:\n\t\t\terr = errors.New(\"db down\")\n\t\t}\n\t\t_ = c.Error(err)\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "level=ERROR msg=\"request failed\" path=/fail/db err=\"db down\"",
          "explanation": "The output is the server's terminal after the four requests below. Only the last one is an unrecognised error, so only it is logged; the real text db down appears in the log and nowhere in the client's response. The first request returns a wrapped ErrNotFound, and errors.Is still matches it, giving 404."
        },
        {
          "language": "bash",
          "filename": "try-mapping.sh",
          "source": "curl -s localhost:8080/fail/missing\ncurl -s localhost:8080/fail/taken\ncurl -s localhost:8080/fail/invalid\ncurl -s localhost:8080/fail/db",
          "output": "{\"error\":{\"code\":\"not_found\",\"message\":\"resource not found\"}}\n{\"error\":{\"code\":\"email_taken\",\"message\":\"email already registered\"}}\n{\"error\":{\"code\":\"validation_failed\",\"message\":\"email is invalid\"}}\n{\"error\":{\"code\":\"internal\",\"message\":\"internal server error\"}}",
          "explanation": "The four responses have statuses 404, 409, 422 and 500 respectively (add -i to curl to see the status line). All four share the same JSON shape, and the 500 body reveals nothing about the cause."
        }
      ],
      "productionNote": "This keeps HTTP out of your business logic: the service layer can be reused by a command-line tool or a test without any status codes in it. Keeping the mapping in one table-like function means a new domain error needs one new case, and reviewers can see every status your API can return in one place.",
      "commonMistakes": [
        "Writing err == ErrNotFound. It fails as soon as someone wraps the error with fmt.Errorf and %w. Use errors.Is.",
        "Sending err.Error() in the body of a 500. It can leak SQL statements, table names or host names. Log it; send a fixed generic message.",
        "Having the domain layer return HTTP status numbers. Then it cannot be reused outside a web server. Return Go errors and map them at the edge."
      ],
      "sources": [
        { "title": "errors.Is", "url": "https://pkg.go.dev/errors#Is" },
        { "title": "errors.As", "url": "https://pkg.go.dev/errors#As" },
        { "title": "Working with Errors in Go 1.13", "url": "https://go.dev/blog/go1.13-errors" }
      ]
    },
    {
      "id": "panics-and-recovery",
      "title": "Panics and Recovery",
      "explanation": "A panic (topic 11) is a crash caused by a bug, such as reading a slice at an index that does not exist (topic 6). Panics are not a way to report expected problems like a missing user; use returned errors for those. But bugs happen, and one buggy request must not take the whole server down.\n\nGin's recovery middleware catches a panic in a handler (it uses recover from topic 11), so the server keeps running. gin.Recovery() writes a bare 500 response and prints the panic with a stack trace (the list of function calls that led to the crash) to standard error. For control over the response, use gin.CustomRecovery(func(c *gin.Context, recovered any) { ... }). Your function receives the value that was passed to panic as recovered, and it must write the response itself. Use AbortWithStatusJSON so the client gets the standard 500 shape.\n\nTwo rules keep this safe. First, log recovered yourself but never send it to the client; a panic message can contain internal details. Second, recovery only protects the goroutine (topic 15) that handles the request. If a handler starts its own goroutine with go func() { ... }() and that panics, Gin cannot catch it and the whole program exits. Any goroutine you start needs its own defer with recover() (topic 11) at the top.\n\nIn the program below, /boom reads items[idx] on an empty slice with idx set to 1, which panics with index out of range. Besides our slog line, Gin's own recovery code also prints a stack trace to standard error; that part is not shown in the output because it contains machine-specific file paths.",
      "analogy": "A smoke alarm that also phones the fire brigade with a standard report. The alarm (recovery) notices the fire (the panic) and prevents the whole building (the server) from burning down, residents (clients) get a calm standard notice, and the detailed report (the log) goes only to the fire brigade (you).",
      "code": [
        {
          "language": "go",
          "filename": "panic.go",
          "source": "package main\n\nimport (\n\t\"log/slog\"\n\t\"net/http\"\n\t\"os\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc main() {\n\topts := &slog.HandlerOptions{ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {\n\t\tif a.Key == slog.TimeKey && len(groups) == 0 {\n\t\t\treturn slog.Attr{} // drop the time so the demo output is stable\n\t\t}\n\t\treturn a\n\t}}\n\tlogger := slog.New(slog.NewTextHandler(os.Stdout, opts))\n\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\tr.Use(gin.CustomRecovery(func(c *gin.Context, recovered any) {\n\t\tlogger.Error(\"panic recovered\", \"path\", c.Request.URL.Path, \"panic\", recovered)\n\t\tc.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{\n\t\t\t\"error\": gin.H{\"code\": \"internal\", \"message\": \"internal server error\"},\n\t\t})\n\t}))\n\n\tr.GET(\"/boom\", func(c *gin.Context) {\n\t\titems := []int{}\n\t\tidx := 1\n\t\tc.JSON(http.StatusOK, gin.H{\"value\": items[idx]}) // panics: index out of range\n\t})\n\tr.GET(\"/ok\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"status\": \"ok\"})\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "level=ERROR msg=\"panic recovered\" path=/boom panic=\"runtime error: index out of range [1] with length 0\"",
          "explanation": "The output is the line our recovery function logs to standard output after GET /boom is requested. The client never sees the panic text, only the generic body. The server survives: the next request, /ok, is answered normally."
        },
        {
          "language": "bash",
          "filename": "try-panic.sh",
          "source": "curl -s localhost:8080/boom\ncurl -s localhost:8080/ok",
          "output": "{\"error\":{\"code\":\"internal\",\"message\":\"internal server error\"}}\n{\"status\":\"ok\"}",
          "explanation": "The first request panics inside the handler and receives status 500 with the standard error shape. The second proves the server is still running."
        }
      ],
      "productionNote": "Treat recovery as a last-resort safety net: every recovered panic is a bug to fix, so log it with enough context (path, request ID from topic 29) and connect the log to alerting so someone is told. Never use panic for normal failures such as not found; use returned errors and c.Error.",
      "commonMistakes": [
        "Sending the recovered value to the client, for example gin.H{\"error\": recovered}. It can expose internal paths and data. Log it, and send the generic 500 body.",
        "Panicking for expected situations like a missing record. Panics are for bugs; return an error and let the error middleware map it.",
        "Assuming recovery protects goroutines you start yourself. It does not; a panic in your own goroutine without its own recover() ends the whole program."
      ],
      "sources": [
        { "title": "gin: CustomRecovery", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#CustomRecovery" },
        { "title": "Defer, Panic, and Recover", "url": "https://go.dev/blog/defer-panic-and-recover" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why should every error response carry a stable machine-readable code field in addition to the human message?",
      "options": [
        "Because JSON requires at least two fields in every object",
        "Because client code can switch on the code reliably, while the message wording may change at any time",
        "Because Gin refuses to send an error response without a code",
        "Because the code makes the HTTP status number unnecessary"
      ],
      "answerIndex": 1,
      "explanation": "Clients branch on code (for example to show a login screen on unauthorized), so it must stay stable. The message is for humans and can be reworded. JSON has no two-field rule, Gin does not require a code, and the HTTP status is still sent."
    },
    {
      "question": "A middleware rejects a request with c.AbortWithStatusJSON(400, body). What does this do that a plain c.JSON(400, body) does not?",
      "options": [
        "It also stops the remaining middleware and the handler from running for this request",
        "It makes the response body smaller",
        "It converts the body to XML",
        "It retries the request automatically"
      ],
      "answerIndex": 0,
      "explanation": "AbortWithStatusJSON is Abort plus JSON. With only c.JSON the chain keeps going, the handler runs and may write a second body."
    },
    {
      "question": "Why does the error-handling middleware check c.Writer.Written() before writing its JSON?",
      "options": [
        "To make sure the server is running in release mode",
        "To measure how long the handler took",
        "To avoid writing a second response body when the handler has already sent one",
        "To check that the client is still connected"
      ],
      "answerIndex": 2,
      "explanation": "If a handler already wrote a response and also recorded an error, writing again would produce a garbled double response. Written() tells the middleware a response has already been started."
    },
    {
      "question": "A service returns fmt.Errorf(\"get user 99: %w\", ErrNotFound). The middleware uses errors.Is(err, ErrNotFound) to choose the status. What status does the client get, and why?",
      "options": [
        "500, because the error text is not exactly \"not found\"",
        "200, because wrapped errors are ignored",
        "409, because wrapped errors count as conflicts",
        "404, because errors.Is looks through %w wrapping and finds ErrNotFound"
      ],
      "answerIndex": 3,
      "explanation": "errors.Is follows the chain of wrapped errors, so the wrapped ErrNotFound still matches and maps to 404. A plain err == ErrNotFound comparison would fail here."
    },
    {
      "question": "What should the body of a 500 response contain?",
      "options": [
        "The full error text, so the client can report it to you",
        "A generic message such as internal server error with a stable code; the real error goes to your log",
        "The stack trace of the panic or error",
        "Nothing at all; a 500 must never have a body"
      ],
      "answerIndex": 1,
      "explanation": "Internal errors can contain SQL, file paths or host names, which help attackers. Send a fixed generic body in the standard shape and keep the details in your logs."
    }
  ]
});
