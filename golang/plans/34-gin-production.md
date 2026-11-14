# 34. Production Gin Service
Version: Go 1.27.4 + Gin v1.12.0 + pgx v5.11.0 + PostgreSQL 18.7
Prerequisites: 33-gin-testing, 21-http-server, 23-logging-config, 25-build-deploy

## Learning goals
- learner can run Gin inside http.Server with timeouts and graceful shutdown
- learner can log every request as structured JSON with slog
- learner can configure trusted proxies so c.ClientIP is correct
- learner can add liveness and readiness endpoints
- learner can load all settings from env vars
- learner can ship the service as a small Docker image

## Sub-topics
### http.Server with Gin, timeouts and graceful shutdown
- Concept: `r.Run` has no timeouts → use topic 21 pattern with `Handler: r`: `srv := &http.Server{Addr: ":" + cfg.Port, Handler: r, ReadHeaderTimeout: 5*time.Second, ReadTimeout: 10*time.Second, WriteTimeout: 10*time.Second, IdleTimeout: 60*time.Second}`; `signal.NotifyContext(..., os.Interrupt, syscall.SIGTERM)`; ListenAndServe in goroutine (ignore http.ErrServerClosed); on signal `srv.Shutdown(ctx 10s)` then `db.Close()`.
- Analogy: closing a shop: lock the front door to new customers, serve those inside, then turn off the lights.
- Code example: main.go — start → log `server started` with `addr=:8080`; Ctrl+C during a 3s request → request completes with 200, then logs `shutting down` and `server stopped`
- Production use: Kubernetes/Docker send SIGTERM on deploy; no dropped requests.
- Common mistakes: r.Run in production (slow clients hold connections forever); closing db before Shutdown finishes.
- Sources: https://gin-gonic.com/en/docs/examples/graceful-restart-or-stop/ ; https://pkg.go.dev/net/http#Server.Shutdown

### slog request-logging middleware
- Concept: gin.New() + gin.Recovery() (or CustomRecovery, 30) + own middleware: after c.Next log `logger.Info("request", "method", c.Request.Method, "route", c.FullPath(), "status", c.Writer.Status(), "duration_ms", time.Since(start).Milliseconds(), "request_id", c.GetString(requestIDKey), "client_ip", c.ClientIP())`; FullPath = route pattern `/api/v1/users/:id` (few distinct values, good for dashboards) vs raw path; level by status (≥500 Error, ≥400 Warn); slog.NewJSONHandler (topic 23); skip /healthz.
- Analogy: a flight recorder: every flight, same fields, machine-readable.
- Code example: logmw.go — GET /api/v1/users/1 → one JSON line containing `"msg":"request"`, `"route":"/api/v1/users/:id"`, `"status":200` (time/duration vary; show keys, say values vary)
- Production use: log search by request_id, alerting on 5xx rate.
- Common mistakes: logging Authorization headers/bodies; using raw path as metric label.
- Sources: https://pkg.go.dev/log/slog ; https://pkg.go.dev/github.com/gin-gonic/gin#Context.FullPath

### SetTrustedProxies and c.ClientIP
- Concept: behind a load balancer the TCP peer is the proxy; real client IP is in `X-Forwarded-For` — but any client can fake that header; Gin trusts all proxies by default (warns in debug mode); `r.SetTrustedProxies([]string{"10.0.0.0/8"})` → only those may set it; `r.SetTrustedProxies(nil)` → trust none (direct exposure); `c.ClientIP()` then correct; `r.TrustedPlatform = gin.PlatformCloudflare` named; CIDR gloss = IP range notation.
- Analogy: only accept "this parcel is from X" notes from your own couriers, not from strangers.
- Code example: proxy.go — with SetTrustedProxies(nil): request from 127.0.0.1 with header `X-Forwarded-For: 1.2.3.4` → `{"ip":"127.0.0.1"}`; with SetTrustedProxies([]string{"127.0.0.1"}) → `{"ip":"1.2.3.4"}`
- Production use: rate limiting, audit logs, geo — all need the true IP.
- Common mistakes: leaving default trust-all (IP spoofing); trusting the header without proxy config.
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#Engine.SetTrustedProxies ; https://gin-gonic.com/en/docs/deployment/

### Health and readiness endpoints
- Concept: liveness `/healthz` = process alive → always 200 `{"status":"ok"}` (no DB); readiness `/readyz` = can serve traffic → `db.PingContext` with 1s timeout → 200 `{"status":"ready"}` or 503 `{"status":"not ready"}`; during shutdown readiness fails first (named); outside auth group; skipped by request logger.
- Analogy: "are you awake?" vs "are you ready to take customers?".
- Code example: health.go — DB up: `/readyz` → 200 `{"status":"ready"}`; PostgreSQL stopped: `/readyz` → 503 `{"status":"not ready"}`, `/healthz` still 200
- Production use: Kubernetes liveness/readiness probes, load balancer health checks.
- Common mistakes: DB check in liveness (DB blip → all pods restarted); auth-protecting health endpoints.
- Sources: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/ ; https://pkg.go.dev/database/sql#DB.PingContext

### Config from env
- Concept: `type Config struct{ Port string; DatabaseURL string; JWTSecret []byte; TrustedProxies []string }` loaded once in main by `loadConfig() (Config, error)` (topic 23 pattern): `PORT` default `8080`; `DATABASE_URL`, `JWT_SECRET` required → error lists missing names → `os.Exit(1)`; `TRUSTED_PROXIES` comma-separated → strings.Split; `GIN_MODE=release` read by Gin itself; secrets never logged.
- Analogy: a pre-flight checklist: missing item → don't take off.
- Code example: config.go — env unset JWT_SECRET → stderr `config: missing JWT_SECRET` and exit code 1; with all set → starts on `:8080`
- Production use: 12-factor config; same image for staging/prod.
- Common mistakes: reading os.Getenv deep in handlers; defaulting secrets to a hard-coded value.
- Sources: https://pkg.go.dev/os#LookupEnv ; https://12factor.net/config

### Docker image
- Concept: reuse topic 25 Dockerfile: build `FROM golang:1.27 AS build` … `RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /app ./cmd/api`; runtime `FROM gcr.io/distroless/static-debian12:nonroot`, `ENV GIN_MODE=release`, `EXPOSE 8080`, `USER nonroot:nonroot`, `ENTRYPOINT ["/app"]`; distroless has no shell → healthcheck by orchestrator hitting /healthz; `.dockerignore` named.
- Analogy: shipping only the finished furniture, not the workshop and tools.
- Code example: Dockerfile; `docker build -t userapi:1.0.0 .`; `docker run -p 8080:8080 -e DATABASE_URL=... -e JWT_SECRET=... userapi:1.0.0`; `curl localhost:8080/healthz` → `{"status":"ok"}`
- Production use: same artifact through CI → staging → prod.
- Common mistakes: forgetting GIN_MODE=release; `localhost` in DATABASE_URL inside container (points at the container itself — use host/service name).
- Sources: https://docs.docker.com/build/building/multi-stage/ ; https://github.com/GoogleContainerTools/distroless ; https://gin-gonic.com/en/docs/deployment/

## Quiz
1. Why http.Server instead of r.Run? — tests timeouts + shutdown
2. Why log c.FullPath not the raw path? — tests label cardinality
3. Risk of default trusted proxies — tests IP spoofing
4. Should liveness check the database? — tests liveness vs readiness
5. Why does localhost fail for DATABASE_URL in a container? — tests container networking
