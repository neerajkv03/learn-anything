window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "27-gin-routing",
  "order": 27,
  "title": "Routing in Gin",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Routing means deciding which handler function answers which URL. You will read values out of the URL path (/users/42) and the query string (?page=2), group routes under a shared prefix such as /api/v1, and replace Gin's plain-text 404 and 405 replies with JSON that API clients can read.",
  "prerequisites": [
    "26-gin-basics"
  ],
  "subtopics": [
    {
      "id": "path-parameters",
      "title": "Path parameters (:id and *wildcard)",
      "explanation": "A route is a pair: an HTTP method plus a URL path pattern, tied to a handler function. So far your paths were fixed, like /ping. Real APIs need paths where one part changes, such as /users/42 and /users/43. A path is split by slashes into segments (the pieces between the slashes): in /users/42 the segments are users and 42.\n\nA path parameter is a named placeholder for one segment. Write a colon and a name: the pattern /users/:id matches /users/42 and /users/abc, and inside the handler c.Param(\"id\") returns whatever text was in that segment. c.Param always returns a string, even when the text looks like a number, so convert it yourself with strconv.Atoi (topic 5). If the conversion fails, the client sent bad input, so answer 400 (Bad Request) and return.\n\nA :param matches exactly one segment. The pattern /users/:id does not match /users/1/x, because that path has an extra segment; Gin answers 404 for it.\n\nA catch-all wildcard starts with a star: /files/*filepath matches everything after /files, however many segments that is. The value returned by c.Param(\"filepath\") includes the leading slash, so /files/docs/report.pdf gives \"/docs/report.pdf\". A catch-all must be the last part of the pattern.\n\nYou met the same idea in topic 21: net/http writes {id} for one segment and {path...} for the rest. Gin spells them :id and *path, and reads them with c.Param instead of r.PathValue.\n\nSetup for all examples in this topic: use the folder from topic 26 (it has go.mod and Gin installed), or make a new empty folder, open a terminal in it and run `go mod init example.com/routing` then `go get github.com/gin-gonic/gin@v1.12.0`. Save each example as its own file in that folder. Run one file at a time with `go run params.go` (naming the file makes Go compile only that file), and stop the server with Ctrl+C before starting the next. The examples call gin.SetMode(gin.ReleaseMode) and gin.New() so the server prints nothing itself; you read the results from curl in a second terminal. On Windows PowerShell, type curl.exe instead of curl, because plain curl is an alias for a different command there.",
      "analogy": "Think of an apartment block address: \"Flat :number\". The building and street are fixed, only the flat number changes, so one address template covers every flat (the :id parameter, one segment). A wildcard is a delivery note saying \"deliver to everything past this front door\": it covers any hallway, stairs and flat behind that door (the *filepath catch-all).",
      "code": [
        {
          "language": "go",
          "filename": "params.go",
          "source": "package main\n\nimport (\n\t\"log\"\n\t\"net/http\"\n\t\"strconv\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\n\tr.GET(\"/users/:id\", func(c *gin.Context) {\n\t\tid, err := strconv.Atoi(c.Param(\"id\"))\n\t\tif err != nil {\n\t\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": \"id must be a number\"})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusOK, gin.H{\"id\": id})\n\t})\n\n\tr.GET(\"/files/*filepath\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"path\": c.Param(\"filepath\")})\n\t})\n\n\tif err := r.Run(\":8080\"); err != nil {\n\t\tlog.Fatal(err)\n\t}\n}\n",
          "output": "",
          "explanation": "The server prints nothing because release mode is on and gin.New() has no logger. It waits for requests on port 8080. The first route converts the :id text to an int and replies 400 with a JSON error if that fails. The second route returns the catch-all value unchanged, leading slash included."
        },
        {
          "language": "bash",
          "filename": "params-curl.sh",
          "source": "curl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/users/42\"\ncurl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/users/abc\"\ncurl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/files/docs/report.pdf\"\ncurl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/users/1/x\"\n",
          "output": "{\"id\":42} -> 200\n{\"error\":\"id must be a number\"} -> 400\n{\"path\":\"/docs/report.pdf\"} -> 200\n404 page not found -> 404",
          "explanation": "Run these in a second terminal while the server is running. -s hides curl's progress bar, and -w appends the HTTP status code after the body. The last request has two segments after /users, so the :id pattern does not match and Gin's default 404 text appears."
        }
      ],
      "productionNote": "Path parameters carry resource IDs (/orders/1017) and catch-all wildcards suit static-file style paths (/files/*filepath). Always treat the text as untrusted input: parse it, check it, and answer 400 for bad values. Never join a catch-all value into a file-system path without cleaning it first, because it can contain ../ pieces (../ means 'go up one folder').",
      "commonMistakes": [
        "Forgetting that c.Param returns a string: using it where an int is needed gives a compile error (the compiler refuses mismatched types) until you convert it with strconv.Atoi.",
        "Expecting the *wildcard value to have no leading slash. For /files/*filepath and the URL /files/a/b.txt the value is \"/a/b.txt\", not \"a/b.txt\".",
        "Expecting /users/:id to match /users/1/x. A :param covers one segment only; use a *wildcard for 'the rest of the path'."
      ],
      "sources": [
        {
          "title": "Gin docs: Parameters in path",
          "url": "https://gin-gonic.com/en/docs/routing/param-in-path/"
        },
        {
          "title": "pkg.go.dev: gin Context.Param",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.Param"
        }
      ]
    },
    {
      "id": "query-strings",
      "title": "Query strings (Query, DefaultQuery)",
      "explanation": "A query string is the part of a URL after a question mark: /search?q=go&page=2. It is a list of key=value pairs joined by &. Unlike path parameters, query values are optional extras: the path /search still reaches your handler even when the query string is missing.\n\nc.Query(\"q\") returns the value for the key q as a string, or an empty string \"\" if the key is not there. c.DefaultQuery(\"page\", \"1\") does the same but returns your fallback (\"1\") when the key is missing.\n\nThere is one catch with c.Query: a missing key and a key with an empty value (/search?q=) both give \"\". When the difference matters, use c.GetQuery(\"q\"). It returns two values, the text and a bool, using the comma-ok pattern from topic 7: ok is true if the key was present, even when its value is empty.\n\nA key can repeat: ?tag=a&tag=b. c.QueryArray(\"tag\") returns all the values as a slice of strings, here [a b].\n\nEvery query value is text. If you need a number, convert it with strconv.Atoi and handle the error, as you did for path parameters. Topic 28 shows binding, which converts and validates for you.\n\nIn the JSON output, gin.H is a map, and encoding/json writes map keys in sorted order, so the keys come out alphabetically (page before q).",
      "analogy": "A query string is like notes clipped to a letter. The letter (the path) is delivered whether or not notes are clipped on; each note is optional extra instruction. A missing note is different from a note that is clipped on but blank, which is exactly the Query versus GetQuery difference.",
      "code": [
        {
          "language": "go",
          "filename": "search.go",
          "source": "package main\n\nimport (\n\t\"log\"\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\n\tr.GET(\"/search\", func(c *gin.Context) {\n\t\tq := c.Query(\"q\")\n\t\tpage := c.DefaultQuery(\"page\", \"1\")\n\t\tc.JSON(http.StatusOK, gin.H{\"q\": q, \"page\": page})\n\t})\n\n\tr.GET(\"/check\", func(c *gin.Context) {\n\t\tvalue, ok := c.GetQuery(\"q\")\n\t\tc.JSON(http.StatusOK, gin.H{\"value\": value, \"present\": ok})\n\t})\n\n\tr.GET(\"/filter\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"tags\": c.QueryArray(\"tag\")})\n\t})\n\n\tif err := r.Run(\":8080\"); err != nil {\n\t\tlog.Fatal(err)\n\t}\n}\n",
          "output": "",
          "explanation": "Again the server itself prints nothing. /search uses Query and DefaultQuery, /check uses GetQuery to tell missing from empty, and /filter uses QueryArray to collect repeated keys."
        },
        {
          "language": "bash",
          "filename": "search-curl.sh",
          "source": "curl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/search?q=gin\"\ncurl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/search?q=gin&page=3\"\ncurl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/check?q=\"\ncurl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/check\"\ncurl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/filter?tag=a&tag=b\"\n",
          "output": "{\"page\":\"1\",\"q\":\"gin\"} -> 200\n{\"page\":\"3\",\"q\":\"gin\"} -> 200\n{\"present\":true,\"value\":\"\"} -> 200\n{\"present\":false,\"value\":\"\"} -> 200\n{\"tags\":[\"a\",\"b\"]} -> 200",
          "explanation": "Keep the URLs in double quotes: an unquoted & would make the shell treat the rest of the line as a separate command. Note that page comes back as the string \"1\", not the number 1. The /check pair shows GetQuery telling an empty value (present true) apart from a missing key (present false)."
        }
      ],
      "productionNote": "Query strings carry filters, sort order and pagination (topic 32 builds limit/offset paging on them). Treat every value as untrusted text: parse numbers with strconv, return 400 on a parse error, and set sensible upper limits (for example a maximum page size) so a client cannot request a million rows.",
      "commonMistakes": [
        "Using c.Query when 'key absent' and 'key present but empty' must be handled differently. Use c.GetQuery and check ok.",
        "Using a numeric query value without checking the conversion error. strconv.Atoi(\"abc\") fails, and ignoring that error silently gives 0.",
        "Forgetting the quotes around a URL containing & in the terminal, so the shell cuts the URL at the & and the second parameter never arrives."
      ],
      "sources": [
        {
          "title": "Gin docs: Query string parameters",
          "url": "https://gin-gonic.com/en/docs/routing/querystring-param/"
        },
        {
          "title": "pkg.go.dev: gin Context.DefaultQuery",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.DefaultQuery"
        }
      ]
    },
    {
      "id": "route-groups",
      "title": "Route groups and API versioning (/api/v1)",
      "explanation": "Most APIs have many routes that share a start: /api/v1/users, /api/v1/orders, /api/v1/products. Typing the prefix (the shared beginning of a path) on every route is repetitive and easy to get wrong. A route group fixes that: v1 := r.Group(\"/api/v1\") returns a group, and v1.GET(\"/users\", handler) registers the route /api/v1/users. Groups have the same GET, POST, PUT, PATCH and DELETE methods as the engine r.\n\nYou will often see the group's routes wrapped in curly braces. That block is plain Go, only a visual hint; it does not limit anything. What really puts a route in the group is calling the method on the group variable (v1), not on r.\n\nGroups can nest: admin := v1.Group(\"/admin\") makes routes start with /api/v1/admin. A group can also take middleware (a function that runs before your handler, for example r.Group(\"/admin\", someMiddleware)) so one rule protects a whole area. Topic 29 covers middleware in detail.\n\nGroups also support API versioning. When you must change the response shape in a way that would break existing clients, you publish it as /api/v2 while /api/v1 keeps working unchanged. Clients then upgrade when they are ready.",
      "analogy": "A building directory: \"Floor 1 - Accounts\", \"Floor 2 - Billing\". Every office on a floor shares the floor's prefix, and you only write the office name once inside it. A nested group is a wing of that floor, and two versions of an API are two floors that both stay open while customers move upstairs at their own pace.",
      "code": [
        {
          "language": "go",
          "filename": "groups.go",
          "source": "package main\n\nimport (\n\t\"log\"\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\n\tv1 := r.Group(\"/api/v1\")\n\t{\n\t\tv1.GET(\"/users\", func(c *gin.Context) {\n\t\t\tc.JSON(http.StatusOK, gin.H{\"version\": \"v1\", \"users\": []string{\"Ada\"}})\n\t\t})\n\n\t\tadmin := v1.Group(\"/admin\")\n\t\tadmin.GET(\"/stats\", func(c *gin.Context) {\n\t\t\tc.JSON(http.StatusOK, gin.H{\"area\": \"admin\"})\n\t\t})\n\t}\n\n\tv2 := r.Group(\"/api/v2\")\n\t{\n\t\tv2.GET(\"/users\", func(c *gin.Context) {\n\t\t\tc.JSON(http.StatusOK, gin.H{\n\t\t\t\t\"version\": \"v2\",\n\t\t\t\t\"users\":   []gin.H{{\"id\": 1, \"name\": \"Ada\"}},\n\t\t\t})\n\t\t})\n\t}\n\n\tif err := r.Run(\":8080\"); err != nil {\n\t\tlog.Fatal(err)\n\t}\n}\n",
          "output": "",
          "explanation": "v1 returns users as plain names, v2 returns them as objects with an id. Both are live at the same time. The admin group is nested inside v1, so its route is /api/v1/admin/stats. The server prints nothing at start-up."
        },
        {
          "language": "bash",
          "filename": "groups-curl.sh",
          "source": "curl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/api/v1/users\"\ncurl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/api/v2/users\"\ncurl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/api/v1/admin/stats\"\ncurl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/users\"\n",
          "output": "{\"users\":[\"Ada\"],\"version\":\"v1\"} -> 200\n{\"users\":[{\"id\":1,\"name\":\"Ada\"}],\"version\":\"v2\"} -> 200\n{\"area\":\"admin\"} -> 200\n404 page not found -> 404",
          "explanation": "Both versions answer side by side. Keys are sorted alphabetically in the JSON, so users comes before version. The bare /users path does not exist: only the grouped paths were registered."
        }
      ],
      "productionNote": "Public APIs are usually versioned (/api/v1) from day one, because changing a response shape later without a new version breaks every client. Groups also keep public and admin areas apart so you can attach authentication to the admin group only (topic 31).",
      "commonMistakes": [
        "Writing the group prefix and the route path without thinking about slashes. Gin joins them with path.Join, so Group(\"/api/v1/\") plus GET(\"/users\") still gives /api/v1/users, but keep the prefix without a trailing slash and every route path with a leading slash so the full path is easy to read.",
        "Thinking the { } block scopes the routes. It is only formatting; routes belong to a group because you called the method on the group variable, and calling r.GET inside the block would register a route on the root instead."
      ],
      "sources": [
        {
          "title": "Gin docs: Grouping routes",
          "url": "https://gin-gonic.com/en/docs/routing/grouping-routes/"
        },
        {
          "title": "pkg.go.dev: gin RouterGroup.Group",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#RouterGroup.Group"
        }
      ]
    },
    {
      "id": "not-found-and-method-not-allowed",
      "title": "NoRoute and 404/405 handling",
      "explanation": "Two things can go wrong with a request's address. Status 404 (Not Found) means no route matches the path. Status 405 (Method Not Allowed) means the path exists but not for that HTTP method, for example DELETE sent to a path that only has a GET route.\n\nBy default Gin answers an unknown path with the plain text 404 page not found. A JSON API client expecting JSON gets text and may fail to parse it. r.NoRoute(handler) registers your own handler for every unmatched path, so you can reply with JSON and the 404 status.\n\nBy default Gin does not produce 405 at all. The engine field r.HandleMethodNotAllowed is false, so a wrong method on a known path also gets 404. Set r.HandleMethodNotAllowed = true and Gin answers 405 with the text 405 method not allowed. r.NoMethod(handler) lets you replace that text with JSON, the same way NoRoute does for 404.\n\nOne more default: r.RedirectTrailingSlash is true. If you register /users and a client asks for /users/, Gin redirects to /users instead of failing: with status 301 for GET requests and 307 for other methods. (The reverse also works: a route registered with a trailing slash is reached from the path without it.) A redirect is a reply that tells the client to repeat the request at another address.",
      "analogy": "A post office. An address that does not exist gets a \"no such address\" slip (404). A real address where the service you chose is not accepted, say a parcel sent to a letters-only box, gets a \"wrong service\" slip (405). NoRoute and NoMethod are you printing your own slips so every customer gets the same readable format.",
      "code": [
        {
          "language": "go",
          "filename": "notfound.go",
          "source": "package main\n\nimport (\n\t\"log\"\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.New()\n\tr.HandleMethodNotAllowed = true\n\n\tr.NoRoute(func(c *gin.Context) {\n\t\tc.JSON(http.StatusNotFound, gin.H{\"error\": \"not found\"})\n\t})\n\tr.NoMethod(func(c *gin.Context) {\n\t\tc.JSON(http.StatusMethodNotAllowed, gin.H{\"error\": \"method not allowed\"})\n\t})\n\n\tr.GET(\"/ping\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"message\": \"pong\"})\n\t})\n\n\tif err := r.Run(\":8080\"); err != nil {\n\t\tlog.Fatal(err)\n\t}\n}\n",
          "output": "",
          "explanation": "Only GET /ping is registered. NoRoute handles every other path. Because HandleMethodNotAllowed is true, a wrong method on /ping goes to the NoMethod handler instead of NoRoute."
        },
        {
          "language": "bash",
          "filename": "notfound-curl.sh",
          "source": "curl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/ping\"\ncurl -s -w \" -> %{http_code}\\n\" \"http://localhost:8080/nope\"\ncurl -s -w \" -> %{http_code}\\n\" -X DELETE \"http://localhost:8080/ping\"\ncurl -s -o /dev/null -w \"%{http_code}\\n\" \"http://localhost:8080/ping/\"\n",
          "output": "{\"message\":\"pong\"} -> 200\n{\"error\":\"not found\"} -> 404\n{\"error\":\"method not allowed\"} -> 405\n301",
          "explanation": "-X DELETE chooses the HTTP method. The last request asks for /ping/ with a trailing slash: Gin answers a GET with a 301 redirect to /ping. -o /dev/null throws the body away so only the status prints (on PowerShell use -o NUL with curl.exe). Delete the line r.HandleMethodNotAllowed = true and the DELETE request would return 404 with the NoRoute JSON instead."
        }
      ],
      "productionNote": "API clients parse every response, so register NoRoute and NoMethod to return the same JSON error shape as the rest of the API. Topic 30 designs that shared error shape. Keep HandleMethodNotAllowed on in APIs: 405 tells a developer 'right path, wrong method', which is more helpful than a misleading 404.",
      "commonMistakes": [
        "Expecting 405 without setting r.HandleMethodNotAllowed = true. By default a wrong method on a known path returns 404.",
        "Leaving the default text 404 body in a JSON API, so clients that call a JSON parser on the reply fail with a confusing parse error."
      ],
      "sources": [
        {
          "title": "pkg.go.dev: gin Engine.NoRoute",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Engine.NoRoute"
        },
        {
          "title": "pkg.go.dev: gin Engine (HandleMethodNotAllowed, RedirectTrailingSlash)",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Engine"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "A route is registered as r.GET(\"/files/*filepath\", ...). A client requests /files/a/b.txt. What does c.Param(\"filepath\") return?",
      "options": [
        "a/b.txt",
        "/a/b.txt",
        "b.txt",
        "/files/a/b.txt"
      ],
      "answerIndex": 1,
      "explanation": "The catch-all captures everything after /files, and the captured value keeps its leading slash, so the result is \"/a/b.txt\"."
    },
    {
      "question": "A request arrives at /check?q= (the key q is present with an empty value). Which call lets you tell this apart from a request to /check with no query string at all?",
      "options": [
        "c.Query(\"q\"), because it returns nil when the key is missing",
        "c.DefaultQuery(\"q\", \"\"), because it returns an error when the key is missing",
        "c.GetQuery(\"q\"), because its second return value is true only when the key is present",
        "c.Param(\"q\"), because it reads query keys"
      ],
      "answerIndex": 2,
      "explanation": "c.Query returns \"\" in both cases. c.GetQuery returns the value plus an ok bool, which is true for ?q= and false when the key is absent."
    },
    {
      "question": "With v1 := r.Group(\"/api/v1\"), what is the full path of the route registered by v1.GET(\"/users\", handler)?",
      "options": [
        "/users",
        "/api/v1/users",
        "/api/users/v1",
        "/v1/users"
      ],
      "answerIndex": 1,
      "explanation": "A group prepends its prefix to each route registered on it, so the final path is /api/v1/users."
    },
    {
      "question": "Only GET /ping is registered, and r.HandleMethodNotAllowed has not been changed. What status does Gin return for DELETE /ping?",
      "options": [
        "405",
        "200",
        "500",
        "404"
      ],
      "answerIndex": 3,
      "explanation": "HandleMethodNotAllowed defaults to false, so Gin treats the wrong method as an unmatched route and returns 404. Setting it to true gives 405."
    },
    {
      "question": "Which request does the pattern /users/:id match?",
      "options": [
        "/users/42",
        "/users/42/orders",
        "/users",
        "/people/42"
      ],
      "answerIndex": 0,
      "explanation": "A :param matches exactly one segment. /users/42/orders has an extra segment, /users has none, and /people/42 has a different first segment."
    }
  ]
});
