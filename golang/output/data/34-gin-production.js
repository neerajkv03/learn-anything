window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "34-gin-production",
  "order": 34,
  "title": "Production Gin Service",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Turn a working Gin API into a service you can safely run in production. You will wrap Gin in an http.Server with timeouts and graceful shutdown, log every request as structured JSON, trust only your own proxies for client IPs, add health endpoints, load settings from environment variables, and package everything as a small Docker image.",
  "prerequisites": ["33-gin-testing", "21-http-server", "23-logging-config", "25-build-deploy"],
  "subtopics": [
    {
      "id": "http-server-graceful-shutdown",
      "title": "http.Server with Gin, timeouts and graceful shutdown",
      "explanation": "In earlier topics you started Gin with r.Run(\":8080\"). That is fine for learning, but r.Run builds a plain server with no timeouts. A slow or malicious client can open a connection and send data one byte at a time, holding it open forever. Enough of those and your service runs out of connections.\n\nA Gin engine (the value returned by gin.New) is an http.Handler, the same interface you met in the http-server topic. So you can put it inside your own http.Server and set the timeouts yourself, exactly as you did with ServeMux. The field Handler: r tells the server to send every request to Gin.\n\nThe four timeouts used here: ReadHeaderTimeout is the time a client gets to send the request headers. ReadTimeout is the time to read the whole request.\n\nWriteTimeout is the time allowed for writing the response. IdleTimeout is how long a kept-alive connection (one reused for more requests) may sit unused.\n\nGraceful shutdown means: when the process is told to stop, stop accepting new requests, let the requests already running finish, and only then exit. The operating system asks a program to stop by sending a signal. Ctrl+C sends os.Interrupt, and container platforms send SIGTERM. signal.NotifyContext returns a context that is cancelled when one of those signals arrives, so <-ctx.Done() waits for it.\n\nThe order matters. Start ListenAndServe in a goroutine. It always returns an error when the server stops; after a normal Shutdown that error is http.ErrServerClosed, which you ignore. When the signal arrives, call srv.Shutdown with a 10-second context (it waits for running requests, but gives up after 10 seconds). Only after Shutdown returns do you close the database, because running handlers may still be using it.\n\nSetup for the example: create a folder, run go mod init userapi inside it, then go get github.com/gin-gonic/gin@v1.12.0 and go get github.com/jackc/pgx/v5@v5.11.0, and save the code as main.go. sql.Open does not connect right away, so the program starts even with no database running.",
      "analogy": "Closing a shop for the night: you lock the front door so no new customers come in, you keep serving everyone already inside, and only when the last customer leaves do you turn off the lights (close the database). A hard kill is switching the lights off while customers are still at the counter.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"database/sql\"\n\t\"errors\"\n\t\"log/slog\"\n\t\"net/http\"\n\t\"os\"\n\t\"os/signal\"\n\t\"syscall\"\n\t\"time\"\n\n\t\"github.com/gin-gonic/gin\"\n\t_ \"github.com/jackc/pgx/v5/stdlib\"\n)\n\n// dropTime removes the time attribute so the output below is the same every run.\nfunc dropTime(groups []string, a slog.Attr) slog.Attr {\n\tif len(groups) == 0 && a.Key == slog.TimeKey {\n\t\treturn slog.Attr{}\n\t}\n\treturn a\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tlogger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{ReplaceAttr: dropTime}))\n\n\tdb, err := sql.Open(\"pgx\", \"postgres://app:secret@localhost:5432/app\")\n\tif err != nil {\n\t\tlogger.Error(\"open db\", \"error\", err)\n\t\tos.Exit(1)\n\t}\n\n\tr := gin.New()\n\tr.Use(gin.Recovery())\n\tr.GET(\"/slow\", func(c *gin.Context) {\n\t\ttime.Sleep(3 * time.Second)\n\t\tc.JSON(http.StatusOK, gin.H{\"status\": \"done\"})\n\t})\n\n\tsrv := &http.Server{\n\t\tAddr:              \":8080\",\n\t\tHandler:           r,\n\t\tReadHeaderTimeout: 5 * time.Second,\n\t\tReadTimeout:       10 * time.Second,\n\t\tWriteTimeout:      10 * time.Second,\n\t\tIdleTimeout:       60 * time.Second,\n\t}\n\n\tctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)\n\tdefer stop()\n\n\tgo func() {\n\t\tif err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {\n\t\t\tlogger.Error(\"listen failed\", \"error\", err)\n\t\t\tstop() // wake up main so the program exits\n\t\t}\n\t}()\n\tlogger.Info(\"server started\", \"addr\", srv.Addr)\n\n\t<-ctx.Done()\n\tlogger.Info(\"shutting down\")\n\n\tshutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)\n\tdefer cancel()\n\tif err := srv.Shutdown(shutdownCtx); err != nil {\n\t\tlogger.Error(\"shutdown failed\", \"error\", err)\n\t}\n\tdb.Close() // only after Shutdown: running handlers may still use it\n\tlogger.Info(\"server stopped\")\n}\n",
          "output": "level=INFO msg=\"server started\" addr=:8080\nlevel=INFO msg=\"shutting down\"\nlevel=INFO msg=\"server stopped\"",
          "explanation": "Run it with go run . in the project folder. In a second terminal run curl localhost:8080/slow, then press Ctrl+C in the first terminal within the 3 seconds. The curl command still receives {\"status\":\"done\"} with status 200, and only afterwards do you see shutting down and server stopped. The output shown is the log; the dropTime function (a ReplaceAttr hook, which lets you change or drop each attribute before it is written) removes the time attribute so the lines are stable. In a real service you would leave the time in."
        }
      ],
      "productionNote": "Kubernetes (a system that runs and restarts containers for you) and Docker send SIGTERM when you deploy a new version. Kubernetes waits 30 seconds by default before force-killing the process, and `docker stop` waits only 10 seconds, so keep your Shutdown timeout shorter than the limit that applies to you (or raise that limit). With graceful shutdown a rolling deploy drops no in-flight requests.",
      "commonMistakes": [
        "Using r.Run in production. It sets no timeouts, so slow clients can hold connections open forever.",
        "Closing the database before srv.Shutdown has returned. Requests still running then fail with 'sql: database is closed'.",
        "Treating http.ErrServerClosed as a failure. It is the normal result after Shutdown, so check for it and ignore it.",
        "Forgetting to call stop() when ListenAndServe fails (for example the port is already in use). The program then waits forever for a signal."
      ],
      "sources": [
        { "title": "Gin: Graceful restart or stop", "url": "https://gin-gonic.com/en/docs/server-config/graceful-restart-or-stop/" },
        { "title": "net/http: Server.Shutdown", "url": "https://pkg.go.dev/net/http#Server.Shutdown" }
      ]
    },
    {
      "id": "slog-request-logging",
      "title": "slog request-logging middleware",
      "explanation": "gin.Default() installs Gin's own text logger. For production you want one structured JSON line per request, using the log/slog package from the logging topic, so tools can search and count them. Start from gin.New(), which has no middleware, and add gin.Recovery() (it turns a panic in a handler into a 500 response instead of crashing the server) plus your own logging middleware.\n\nThe middleware records the start time, calls c.Next() so the rest of the chain runs, and then logs. After c.Next the response status is known. Log these fields: method, route, status, duration in milliseconds, request ID and client IP. The request ID comes from the X-Request-ID middleware idea from the middleware topic; here a tiny middleware copies the incoming header into the context with c.Set, and the logger reads it with c.GetString.\n\nLog the route pattern, c.FullPath(), not the raw URL path. FullPath returns the pattern you registered, such as /api/v1/users/:id. Raw paths like /api/v1/users/1, /api/v1/users/2 and so on are a different value for every user. Log search and dashboards group by field value, so a field with millions of distinct values (high cardinality) makes grouping useless and expensive, while the pattern has only one value per route. For a request that matches no route, FullPath is an empty string.\n\nChoose the log level from the status: 500 and above is Error (your bug), 400 to 499 is Warn (the client's mistake), anything else is Info. logger.Log(ctx, level, msg, args...) takes the level as a value. Finally, skip /healthz: orchestrators call it every few seconds and the lines would drown real traffic.\n\nNever log the Authorization header, cookies, or request bodies: they contain secrets and personal data.\n\nRelease mode is the production setting; it changes no output here. Make a new empty folder, run go mod init userapi and go get github.com/gin-gonic/gin@v1.12.0 in it, save the code as logmw.go, then run go run .",
      "analogy": "A flight recorder on an aircraft: every flight records the same fields in the same format, so investigators can compare any two flights or search across thousands of them. A pilot's handwritten diary, with different wording each time, cannot be searched.",
      "code": [
        {
          "language": "go",
          "filename": "logmw.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"log/slog\"\n\t\"net/http\"\n\t\"net/http/httptest\"\n\t\"os\"\n\t\"time\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nconst requestIDKey = \"request_id\"\n\nfunc dropTime(groups []string, a slog.Attr) slog.Attr {\n\tif len(groups) == 0 && a.Key == slog.TimeKey {\n\t\treturn slog.Attr{}\n\t}\n\treturn a\n}\n\nfunc requestID() gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tc.Set(requestIDKey, c.GetHeader(\"X-Request-ID\"))\n\t\tc.Next()\n\t}\n}\n\nfunc requestLogger(logger *slog.Logger) gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tif c.Request.URL.Path == \"/healthz\" {\n\t\t\tc.Next()\n\t\t\treturn\n\t\t}\n\t\tstart := time.Now()\n\t\tc.Next()\n\n\t\tstatus := c.Writer.Status()\n\t\tlevel := slog.LevelInfo\n\t\tif status >= 500 {\n\t\t\tlevel = slog.LevelError\n\t\t} else if status >= 400 {\n\t\t\tlevel = slog.LevelWarn\n\t\t}\n\t\tlogger.Log(c.Request.Context(), level, \"request\",\n\t\t\t\"method\", c.Request.Method,\n\t\t\t\"route\", c.FullPath(),\n\t\t\t\"status\", status,\n\t\t\t\"duration_ms\", time.Since(start).Milliseconds(),\n\t\t\t\"request_id\", c.GetString(requestIDKey),\n\t\t\t\"client_ip\", c.ClientIP(),\n\t\t)\n\t}\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tlogger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{ReplaceAttr: dropTime}))\n\n\tr := gin.New()\n\tr.Use(gin.Recovery(), requestID(), requestLogger(logger))\n\tr.GET(\"/healthz\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"status\": \"ok\"})\n\t})\n\tr.GET(\"/api/v1/users/:id\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"id\": c.Param(\"id\")})\n\t})\n\n\tfor _, path := range []string{\"/healthz\", \"/api/v1/users/1\", \"/nope\"} {\n\t\treq := httptest.NewRequest(http.MethodGet, path, nil)\n\t\treq.Header.Set(\"X-Request-ID\", \"abc123\")\n\t\tr.ServeHTTP(httptest.NewRecorder(), req)\n\t}\n\tfmt.Println(\"done\")\n}\n",
          "output": "{\"level\":\"INFO\",\"msg\":\"request\",\"method\":\"GET\",\"route\":\"/api/v1/users/:id\",\"status\":200,\"duration_ms\":0,\"request_id\":\"abc123\",\"client_ip\":\"192.0.2.1\"}\n{\"level\":\"WARN\",\"msg\":\"request\",\"method\":\"GET\",\"route\":\"\",\"status\":404,\"duration_ms\":0,\"request_id\":\"abc123\",\"client_ip\":\"192.0.2.1\"}\ndone",
          "explanation": "The program sends three fake requests with httptest, as in the testing topic. /healthz is skipped, so it logs nothing. The user request logs route /api/v1/users/:id, not /api/v1/users/1. The unknown path /nope logs an empty route and level WARN because the status is 404. In a real service the line also has a time key and duration_ms varies per request (here the handlers are instant so it prints 0). client_ip is 192.0.2.1 because httptest gives every request that fixed fake address."
        }
      ],
      "productionNote": "With one JSON line per request you can search by request_id to follow a single request across services, and alert on the rate of status 5xx lines. Because the route field has few distinct values, it also works as a label on metrics (counters and charts) without overloading the monitoring system.",
      "commonMistakes": [
        "Logging the Authorization header or request bodies. Tokens and passwords then sit in your log storage.",
        "Using the raw path (/users/42) instead of c.FullPath() as a log field or metric label. Each distinct ID creates a new value, so grouping and dashboards break.",
        "Reading c.Writer.Status() before c.Next(). The handler has not run yet, so the status is still the default 200.",
        "Logging /healthz on every probe, which buries the real traffic."
      ],
      "sources": [
        { "title": "log/slog package", "url": "https://pkg.go.dev/log/slog" },
        { "title": "gin: Context.FullPath", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.FullPath" }
      ]
    },
    {
      "id": "trusted-proxies-client-ip",
      "title": "SetTrustedProxies and c.ClientIP",
      "explanation": "In production your service usually sits behind a proxy: a server such as a load balancer that receives the client's request and forwards it to you. Your service then sees the proxy's address as the other end of the TCP connection (the network link between two programs), not the real user's. Proxies pass the real address in a header called X-Forwarded-For.\n\nThe problem: any client can send an X-Forwarded-For header with any value. If you believe it blindly, an attacker can pretend to be any IP address (IP spoofing) and dodge rate limits or poison audit logs (a rate limit caps how many requests one client may make; an audit log records who did what). The header should be believed only when the connection comes from a proxy you control.\n\nc.ClientIP() makes this decision using Gin's list of trusted proxies. If the direct peer is trusted, Gin reads X-Forwarded-For (skipping addresses that are themselves trusted proxies) and returns the real client. If the peer is not trusted, Gin ignores the header and returns the peer's address.\n\nBy default Gin trusts all proxies, so the header is always believed. Gin's debug mode prints a warning about this. Fix it with r.SetTrustedProxies, which returns an error.\n\nr.SetTrustedProxies(nil) trusts nobody. Use this when clients connect to your service directly. r.SetTrustedProxies([]string{\"10.0.0.0/8\"}) trusts only that range. 10.0.0.0/8 is CIDR notation (a compact way to write a block of IP addresses: the number after / says how many leading bits are fixed, so this means every address starting with 10.). Plain single addresses such as \"127.0.0.1\" also work.\n\nIf you run behind Cloudflare, Gin can also read its own header: set r.TrustedPlatform = gin.PlatformCloudflare. Details are in the Gin deployment docs.",
      "analogy": "A parcel arrives with a note saying 'this is from Alice'. You accept that note only if it was handed over by your own trusted courier. If a stranger walks up with the same note, you ignore it and record the stranger's name instead.",
      "code": [
        {
          "language": "go",
          "filename": "proxy.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"net/http\"\n\t\"net/http/httptest\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc newRouter() *gin.Engine {\n\tr := gin.New()\n\tr.GET(\"/ip\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"ip\": c.ClientIP()})\n\t})\n\treturn r\n}\n\n// call sends a request that arrives from 127.0.0.1 and claims to be 1.2.3.4.\nfunc call(r *gin.Engine) string {\n\treq := httptest.NewRequest(http.MethodGet, \"/ip\", nil)\n\treq.RemoteAddr = \"127.0.0.1:5000\"\n\treq.Header.Set(\"X-Forwarded-For\", \"1.2.3.4\")\n\trec := httptest.NewRecorder()\n\tr.ServeHTTP(rec, req)\n\treturn rec.Body.String()\n}\n\nfunc main() {\n\tgin.SetMode(gin.TestMode)\n\n\tr := newRouter()\n\tfmt.Println(\"default:\", call(r))\n\n\tr = newRouter()\n\tif err := r.SetTrustedProxies(nil); err != nil {\n\t\tpanic(err)\n\t}\n\tfmt.Println(\"trust none:\", call(r))\n\n\tr = newRouter()\n\tif err := r.SetTrustedProxies([]string{\"127.0.0.1\"}); err != nil {\n\t\tpanic(err)\n\t}\n\tfmt.Println(\"trust 127.0.0.1:\", call(r))\n}\n",
          "output": "default: {\"ip\":\"1.2.3.4\"}\ntrust none: {\"ip\":\"127.0.0.1\"}\ntrust 127.0.0.1: {\"ip\":\"1.2.3.4\"}",
          "explanation": "The same request, from 127.0.0.1 with a header claiming 1.2.3.4, gives three answers. With Gin's default (trust everyone) the forged value 1.2.3.4 is accepted. With SetTrustedProxies(nil) the header is ignored and you get the real peer, 127.0.0.1. With 127.0.0.1 listed as a trusted proxy the header is accepted, which is right if 127.0.0.1 really is your load balancer."
        }
      ],
      "productionNote": "Rate limiting, audit logs and geographic features all depend on the true client IP. Set the trusted list to exactly the address range of your own load balancer, and read it from configuration (the config sub-topic below) so staging and production can differ.",
      "commonMistakes": [
        "Leaving Gin's default trust-all setting in production. Anyone can spoof their IP by sending X-Forwarded-For.",
        "Reading the X-Forwarded-For header yourself with c.GetHeader instead of c.ClientIP(). You skip all the trust checks.",
        "Trusting a whole wide range (such as 0.0.0.0/0) just to make the warning disappear. That is the same as trusting everyone."
      ],
      "sources": [
        { "title": "gin: Engine.SetTrustedProxies", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Engine.SetTrustedProxies" },
        { "title": "Gin deployment docs", "url": "https://gin-gonic.com/en/docs/deployment/" }
      ]
    },
    {
      "id": "health-readiness",
      "title": "Health and readiness endpoints",
      "explanation": "An orchestrator (Kubernetes, Docker or a load balancer) needs to ask your service two different questions, so you provide two endpoints.\n\nLiveness, conventionally /healthz, answers 'is the process alive?'. It does no work and checks nothing external: it always returns 200 with {\"status\":\"ok\"}. If it fails, the orchestrator restarts the process.\n\nReadiness, conventionally /readyz, answers 'can you serve traffic right now?'. It checks what the service needs, here the database, with db.PingContext and a 1-second timeout (context.WithTimeout from the context topic). It returns 200 {\"status\":\"ready\"} when all is well and 503 Service Unavailable {\"status\":\"not ready\"} otherwise. If readiness fails, the orchestrator stops sending requests to this instance but does not restart it.\n\nDuring shutdown, readiness should fail first. The code below only shows the flag and its check: an atomic.Bool (from the sync-patterns topic) named shuttingDown. In a full service, the shutdown code from the first sub-topic would call shuttingDown.Store(true) when the signal arrives, wait a moment so the load balancer notices, and then call srv.Shutdown. New traffic then stops arriving before the server stops accepting connections.\n\nRegister both endpoints outside any authentication group, because the orchestrator has no token, and skip them in the request logger.\n\nThe example uses a database address pointing at port 1 where nothing listens, so you can see the failure path without stopping PostgreSQL. With a running database, /readyz returns 200 {\"status\":\"ready\"}.\n\nMake a new empty folder, run go mod init userapi and go get github.com/gin-gonic/gin@v1.12.0 and github.com/jackc/pgx/v5@v5.11.0 in it, save the code as health.go, then run go run .",
      "analogy": "'Are you awake?' versus 'are you ready to take customers?'. A shop assistant can be awake (alive) but still setting up the till (not ready). You would wake someone who is asleep, but you would not fire someone for being not ready yet; you simply send customers elsewhere for a minute.",
      "code": [
        {
          "language": "go",
          "filename": "health.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"database/sql\"\n\t\"fmt\"\n\t\"net/http\"\n\t\"net/http/httptest\"\n\t\"sync/atomic\"\n\t\"time\"\n\n\t\"github.com/gin-gonic/gin\"\n\t_ \"github.com/jackc/pgx/v5/stdlib\"\n)\n\nfunc registerHealth(r *gin.Engine, db *sql.DB, shuttingDown *atomic.Bool) {\n\tr.GET(\"/healthz\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"status\": \"ok\"})\n\t})\n\tr.GET(\"/readyz\", func(c *gin.Context) {\n\t\tif shuttingDown.Load() {\n\t\t\tc.JSON(http.StatusServiceUnavailable, gin.H{\"status\": \"not ready\"})\n\t\t\treturn\n\t\t}\n\t\tctx, cancel := context.WithTimeout(c.Request.Context(), time.Second)\n\t\tdefer cancel()\n\t\tif err := db.PingContext(ctx); err != nil {\n\t\t\tc.JSON(http.StatusServiceUnavailable, gin.H{\"status\": \"not ready\"})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusOK, gin.H{\"status\": \"ready\"})\n\t})\n}\n\nfunc main() {\n\tgin.SetMode(gin.TestMode)\n\n\t// Nothing listens on port 1, so the database is unreachable.\n\tdb, err := sql.Open(\"pgx\", \"postgres://app:secret@127.0.0.1:1/app\")\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer db.Close()\n\n\tvar shuttingDown atomic.Bool\n\tr := gin.New()\n\tregisterHealth(r, db, &shuttingDown)\n\n\tfor _, path := range []string{\"/healthz\", \"/readyz\"} {\n\t\trec := httptest.NewRecorder()\n\t\tr.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))\n\t\tfmt.Println(path, rec.Code, rec.Body.String())\n\t}\n}\n",
          "output": "/healthz 200 {\"status\":\"ok\"}\n/readyz 503 {\"status\":\"not ready\"}",
          "explanation": "With the database unreachable, /healthz still answers 200 because the process itself is fine, while /readyz answers 503 because the ping fails. Point the address at a running PostgreSQL and /readyz returns 200 {\"status\":\"ready\"}."
        }
      ],
      "productionNote": "Kubernetes liveness and readiness probes (a probe is a regular request the orchestrator sends to check the service) and load balancer health checks call these URLs every few seconds. Keep both handlers fast and cheap, and give readiness a short timeout so a hung database cannot hang the probe.",
      "commonMistakes": [
        "Checking the database in the liveness endpoint. A short database outage then makes every instance look dead, and the orchestrator restarts all of them at once.",
        "Putting health endpoints behind authentication. The orchestrator cannot log in, so it marks a healthy service as failed.",
        "Calling db.Ping without a timeout in readiness. A hung database makes the probe itself hang."
      ],
      "sources": [
        { "title": "Kubernetes: liveness, readiness and startup probes", "url": "https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/" },
        { "title": "database/sql: DB.PingContext", "url": "https://pkg.go.dev/database/sql#DB.PingContext" }
      ]
    },
    {
      "id": "config-from-env",
      "title": "Config from env",
      "explanation": "Everything that differs between your laptop, staging and production (port, database address, secrets, trusted proxies) should come from environment variables, not from code. This is the 'twelve-factor' approach to configuration, a widely used set of rules for cloud services. The same compiled program then runs unchanged everywhere.\n\nYou already know the pattern from the logging-and-config topic: a Config struct filled by a loadConfig function that returns (Config, error). Call it once at the start of main, and pass the values down. Do not call os.Getenv deep inside handlers; settings read in many places are hard to find, test and validate.\n\nThe rules used here: PORT is optional and defaults to 8080. DATABASE_URL and JWT_SECRET are required. If any required variable is missing, loadConfig collects all the missing names into one error, main prints it to standard error and exits with os.Exit(1), so the service refuses to start half-configured. TRUSTED_PROXIES is optional and is a comma-separated list such as 10.0.0.0/8,10.1.0.0/16; strings.Split turns it into a slice, and an empty value gives an empty list, which means 'trust no proxy'.\n\nYou then pass the values on: r.SetTrustedProxies(cfg.TrustedProxies), Addr: \":\" + cfg.Port, and sql.Open(\"pgx\", cfg.DatabaseURL). Gin reads GIN_MODE (release, debug or test) from the environment by itself, so you do not load it.\n\nNever print secrets. The example prints only the length of the secret. Never give JWT_SECRET a default value in code: a hard-coded default is a secret everyone can read in your repository.\n\nMake a new empty folder, run go mod init userapi in it, save the code as config.go, then run the commands in run-config.sh.",
      "analogy": "A pre-flight checklist: the pilot checks every item before takeoff, and if one is missing the plane stays on the ground. loadConfig is that checklist, and a missing variable means the service does not take off.",
      "code": [
        {
          "language": "go",
          "filename": "config.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"os\"\n\t\"strings\"\n)\n\ntype Config struct {\n\tPort           string\n\tDatabaseURL    string\n\tJWTSecret      []byte\n\tTrustedProxies []string\n}\n\nfunc loadConfig() (Config, error) {\n\tcfg := Config{Port: \"8080\"}\n\tif v := os.Getenv(\"PORT\"); v != \"\" {\n\t\tcfg.Port = v\n\t}\n\n\tvar missing []string\n\tcfg.DatabaseURL = os.Getenv(\"DATABASE_URL\")\n\tif cfg.DatabaseURL == \"\" {\n\t\tmissing = append(missing, \"DATABASE_URL\")\n\t}\n\tsecret := os.Getenv(\"JWT_SECRET\")\n\tif secret == \"\" {\n\t\tmissing = append(missing, \"JWT_SECRET\")\n\t}\n\tcfg.JWTSecret = []byte(secret)\n\n\tfor _, p := range strings.Split(os.Getenv(\"TRUSTED_PROXIES\"), \",\") {\n\t\tif p = strings.TrimSpace(p); p != \"\" {\n\t\t\tcfg.TrustedProxies = append(cfg.TrustedProxies, p)\n\t\t}\n\t}\n\n\tif len(missing) > 0 {\n\t\treturn Config{}, fmt.Errorf(\"missing %s\", strings.Join(missing, \", \"))\n\t}\n\treturn cfg, nil\n}\n\nfunc main() {\n\tcfg, err := loadConfig()\n\tif err != nil {\n\t\tfmt.Fprintln(os.Stderr, \"config:\", err)\n\t\tos.Exit(1)\n\t}\n\tfmt.Println(\"port:\", cfg.Port)\n\tfmt.Println(\"trusted proxies:\", cfg.TrustedProxies)\n\tfmt.Println(\"secret length:\", len(cfg.JWTSecret))\n}\n",
          "output": "port: 8080\ntrusted proxies: [10.0.0.0/8 10.1.0.0/16]\nsecret length: 32",
          "explanation": "This is the output when the three variables are set as in the next command and PORT is not set. Note that strings.Split on an empty string returns one empty element, which the TrimSpace and != \"\" check filters out, so an unset TRUSTED_PROXIES gives an empty list."
        },
        {
          "language": "bash",
          "filename": "run-config.sh",
          "source": "# all set: starts with the default port\nDATABASE_URL=postgres://app:secret@db:5432/app JWT_SECRET=0123456789abcdef0123456789abcdef TRUSTED_PROXIES=10.0.0.0/8,10.1.0.0/16 go run .\n\n# JWT_SECRET missing: refuses to start\nDATABASE_URL=postgres://app:secret@db:5432/app go run .\necho \"exit code: $?\"\n",
          "output": "port: 8080\ntrusted proxies: [10.0.0.0/8 10.1.0.0/16]\nsecret length: 32\nconfig: missing JWT_SECRET\nexit code: 1",
          "explanation": "The VAR=value command syntax is for bash. In PowerShell set each variable first, for example $env:JWT_SECRET = \"...\", then run go run . . The second run prints the config: line to standard error and exits with code 1. (When you use go run, go itself may also print an 'exit status 1' line.)"
        }
      ],
      "productionNote": "Because all settings come from the environment, one container image can be promoted unchanged from staging to production; only the variables differ. Orchestrators inject secrets as environment variables or files, so your code never contains them.",
      "commonMistakes": [
        "Calling os.Getenv inside handlers. Settings become scattered, untestable, and a typo is found only when a request arrives.",
        "Giving JWT_SECRET a hard-coded default 'so it works locally'. That default will eventually reach production.",
        "Logging the whole Config struct, which writes the secret and the database password into the logs.",
        "Failing on the first missing variable only. Report all missing names at once so the operator fixes them in one go."
      ],
      "sources": [
        { "title": "os: LookupEnv", "url": "https://pkg.go.dev/os#LookupEnv" },
        { "title": "The Twelve-Factor App: Config", "url": "https://12factor.net/config" }
      ]
    },
    {
      "id": "docker-image",
      "title": "Docker image",
      "explanation": "Docker packages your program and everything it needs into an image, a file that runs the same way on any machine with Docker. A Dockerfile is the recipe for building it. You met multi-stage builds and distroless images in the build-and-deploy topic; here they are applied to the Gin service.\n\nA multi-stage build uses two FROM lines. The first stage, golang:1.27, contains the Go toolchain and compiles your program. CGO_ENABLED=0 produces a fully static binary (one that needs no system C libraries), -trimpath removes your local file paths and -ldflags=\"-s -w\" strips debug symbols to make the file smaller. The second stage starts from gcr.io/distroless/static-debian12:nonroot, a tiny image with no shell and no package manager, and copies in only the finished binary. The compiler never reaches production.\n\nThe lines in the final stage: ENV GIN_MODE=release turns off Gin's debug output and slower debug behaviour. EXPOSE 8080 documents the port (it does not publish it). USER nonroot:nonroot runs the program without administrator rights, so a bug is less dangerous. ENTRYPOINT [\"/app\"] is the command that starts the container.\n\nBecause distroless has no shell, you cannot add a curl-based healthcheck inside the image. Let the orchestrator call GET /healthz from outside instead.\n\nAlso create a .dockerignore file in the project folder listing things that must not be copied into the build, such as .git, *.md, and local .env files with secrets. This makes builds faster and keeps secrets out of the image.\n\nThe example assumes your main package is in cmd/api, as in the project-layout topic. Create the folder with mkdir -p cmd/api and move your main.go into it before building. The program in cmd/api/main.go must combine this topic's pieces: the graceful-shutdown server, the request logger, SetTrustedProxies, the health endpoints and loadConfig. Combine the code from the earlier sub-topics before building the image. Save the recipe as a file named Dockerfile (no extension) in the project root.",
      "analogy": "Shipping only the finished furniture, not the workshop and tools. The build stage is the workshop with saws and wood; the final image is just the assembled chair in a plain box.",
      "code": [
        {
          "language": "docker",
          "filename": "Dockerfile",
          "source": "FROM golang:1.27 AS build\nWORKDIR /src\nCOPY go.mod go.sum ./\nRUN go mod download\nCOPY . .\nRUN CGO_ENABLED=0 go build -trimpath -ldflags=\"-s -w\" -o /app ./cmd/api\n\nFROM gcr.io/distroless/static-debian12:nonroot\nCOPY --from=build /app /app\nENV GIN_MODE=release\nEXPOSE 8080\nUSER nonroot:nonroot\nENTRYPOINT [\"/app\"]\n",
          "output": "",
          "explanation": "Copying go.mod and go.sum and running go mod download before copying the rest of the source lets Docker reuse the downloaded dependencies on later builds when only your code changed."
        },
        {
          "language": "bash",
          "filename": "build-and-run.sh",
          "source": "docker build -t userapi:1.0.0 .\ndocker run -d -p 8080:8080 -e DATABASE_URL=postgres://app:secret@db:5432/app -e JWT_SECRET=0123456789abcdef0123456789abcdef userapi:1.0.0\ncurl localhost:8080/healthz\n",
          "output": "{\"status\":\"ok\"}",
          "explanation": "docker build -t userapi:1.0.0 . builds the image and names it. docker run -d starts it in the background; -p 8080:8080 publishes container port 8080 on your machine, and each -e passes an environment variable. The curl call prints the liveness response. Build progress and the container ID that docker prints are omitted here. Here db in DATABASE_URL is the name of the database container on the same Docker network."
        }
      ],
      "productionNote": "Build the image once in your CI pipeline (the automated build-and-test system) and promote that exact image through staging to production, changing only environment variables. Tag it with a version such as 1.0.0, not just latest, so you can roll back.",
      "commonMistakes": [
        "Forgetting ENV GIN_MODE=release, so production runs in debug mode with extra output.",
        "Using localhost in DATABASE_URL inside a container. Inside the container localhost means the container itself, not your machine or the database; use the database's host name or service name.",
        "Copying secrets or .env files into the image because there is no .dockerignore.",
        "Adding a HEALTHCHECK that calls curl in a distroless image. There is no shell or curl in it, so the check always fails."
      ],
      "sources": [
        { "title": "Docker: Multi-stage builds", "url": "https://docs.docker.com/build/building/multi-stage/" },
        { "title": "Distroless images", "url": "https://github.com/GoogleContainerTools/distroless" },
        { "title": "Gin deployment docs", "url": "https://gin-gonic.com/en/docs/deployment/" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why should a production Gin service run inside your own http.Server instead of calling r.Run?",
      "options": [
        "r.Run cannot serve JSON responses",
        "http.Server lets you set timeouts and call Shutdown so running requests can finish",
        "r.Run only works in debug mode",
        "http.Server makes handlers run faster than r.Run"
      ],
      "answerIndex": 1,
      "explanation": "r.Run creates a server with no timeouts and gives you no handle to shut it down gracefully. Your own http.Server with Handler: r sets ReadHeaderTimeout, WriteTimeout and so on, and exposes Shutdown."
    },
    {
      "question": "In a request-logging middleware, why log c.FullPath() (such as /api/v1/users/:id) rather than the raw path?",
      "options": [
        "The raw path is not available after c.Next()",
        "FullPath includes the query string, which the raw path lacks",
        "The pattern has few distinct values, so logs and dashboards can group by it; raw paths create a new value per ID",
        "Gin refuses to log paths that contain numbers"
      ],
      "answerIndex": 2,
      "explanation": "Raw paths with IDs are different for every record (high cardinality), which makes grouping and metrics useless and costly. The route pattern has one value per route."
    },
    {
      "question": "What is the risk of leaving Gin's default trusted-proxy setting (trust all) in production?",
      "options": [
        "Any client can send a fake X-Forwarded-For header and make c.ClientIP() return a forged address",
        "The server refuses all requests that come through a load balancer",
        "The database connection pool is exhausted",
        "Gin stops logging request durations"
      ],
      "answerIndex": 0,
      "explanation": "With trust-all, Gin believes the X-Forwarded-For header from anyone, so attackers can spoof their IP and bypass rate limits or poison audit logs. List only your own proxies with SetTrustedProxies."
    },
    {
      "question": "Should the liveness endpoint (/healthz) check the database?",
      "options": [
        "Yes, so the orchestrator knows every dependency works",
        "Yes, but only when the request carries a valid token",
        "No, but it must return 503 during normal operation",
        "No. A database outage would make the orchestrator restart every instance; database checks belong in readiness"
      ],
      "answerIndex": 3,
      "explanation": "Liveness only says the process is alive and always returns 200. Restarting healthy processes cannot fix a database outage. Readiness (/readyz) checks the database so traffic is simply routed away."
    },
    {
      "question": "Your containerised service uses DATABASE_URL=postgres://app:secret@localhost:5432/app and cannot connect, although PostgreSQL runs on your machine. Why?",
      "options": [
        "Inside the container, localhost refers to the container itself, so you must use the database's host or service name",
        "Distroless images block all outgoing database connections",
        "PostgreSQL only accepts connections from images built with CGO_ENABLED=1",
        "GIN_MODE=release disables database access"
      ],
      "answerIndex": 0,
      "explanation": "Each container has its own network identity, so localhost inside it points to the container, where no database is running. Use the database container's service name or the real host address."
    }
  ]
});
