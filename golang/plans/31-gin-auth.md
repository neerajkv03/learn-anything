# 31. Authentication
Version: Go 1.27.4 + Gin v1.12.0 + golang-jwt/jwt v5.3.1
Prerequisites: 30-gin-errors, 29-gin-middleware, 13-time

Gloss: authentication = proving who you are; authorization = what you may do (named, light touch); secret = value only the server knows, from env (topic 23, never in code). All examples use HTTPS in production (tokens in plain HTTP can be stolen).

## Learning goals
- learner can protect a route group with auth middleware
- learner can check an API key header safely
- learner can use gin.BasicAuth
- learner can issue and verify a JWT with golang-jwt/jwt v5
- learner can pass the authenticated user to handlers

## Sub-topics
### Auth middleware on route groups
- Concept: public group (`/login`, `/healthz`) vs private group `api := r.Group("/api", AuthRequired())`; middleware rejects with 401 (not authenticated) via AbortWithStatusJSON (30); 403 = authenticated but not allowed; `WWW-Authenticate` header named.
- Analogy: office building: lobby is open, lifts need a badge (401 no badge, 403 badge for wrong floor).
- Code example: groups.go — stub `AuthRequired()` checks header `Authorization` non-empty; `GET /healthz` → 200 `{"status":"ok"}` without header; `GET /api/me` without header → 401 `{"error":{"code":"unauthorized","message":"missing credentials"}}`
- Production use: one middleware, many routes; no per-handler checks.
- Common mistakes: global auth blocking health checks; 403 vs 401 mixed up.
- Sources: https://gin-gonic.com/en/docs/examples/using-middleware/ ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/401

### API key header check
- Concept: service-to-service: header `X-API-Key`; key from env `API_KEY`; compare with `subtle.ConstantTimeCompare([]byte(got), []byte(want)) == 1` (crypto/subtle — gloss timing attack: `==` stops at first wrong char, timing leaks how much was right); empty env → refuse to start.
- Analogy: a combination lock that always takes the same time to say "no", so burglars can't hear which digit was right.
- Code example: apikey.go — API_KEY=`k-123`; `curl -H "X-API-Key: k-123" localhost:8080/api/reports` → 200 `{"reports":[]}`; wrong key → 401 `{"error":{"code":"unauthorized","message":"invalid API key"}}`
- Production use: internal services, webhooks; rotate keys.
- Common mistakes: key in query string (logged by proxies); `==` comparison; hard-coded key.
- Sources: https://pkg.go.dev/crypto/subtle#ConstantTimeCompare ; https://pkg.go.dev/github.com/gin-gonic/gin#Context.GetHeader

### gin.BasicAuth
- Concept: `gin.BasicAuth(gin.Accounts{"admin": "s3cret"})` middleware; browser/curl sends `Authorization: Basic base64(user:pass)`; missing/wrong → 401 + `WWW-Authenticate` header; user name stored under `gin.AuthUserKey` → `c.MustGet(gin.AuthUserKey).(string)`; only over HTTPS; plain-text passwords in a map → fine for an internal admin page, not for user accounts (hash with bcrypt, `golang.org/x/crypto/bcrypt` named).
- Analogy: a door with username/password keypad, but whoever overhears it (no HTTPS) learns the code.
- Code example: basic.go — group `/admin` with BasicAuth; `curl -u admin:s3cret localhost:8080/admin/whoami` → `{"user":"admin"}`; wrong password → 401
- Production use: internal tools, metrics endpoints behind VPN.
- Common mistakes: using it for end-user login; credentials committed in code (load from env).
- Sources: https://gin-gonic.com/en/docs/examples/using-basicauth-middleware/ ; https://pkg.go.dev/github.com/gin-gonic/gin#BasicAuth

### JWT issue and verify with golang-jwt/jwt v5
- Concept: JWT gloss — signed token `header.payload.signature` (base64 parts, readable by anyone, tamper-proof not secret); `go get github.com/golang-jwt/jwt/v5@v5.3.1`; issue: `claims := jwt.RegisteredClaims{Subject: "42", ExpiresAt: jwt.NewNumericDate(time.Now().Add(15*time.Minute)), IssuedAt: jwt.NewNumericDate(time.Now())}`; `tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)`; `s, err := tok.SignedString(secret)` (secret `[]byte` from env JWT_SECRET, ≥32 bytes); verify: `jwt.ParseWithClaims(s, &jwt.RegisteredClaims{}, func(t *jwt.Token) (any, error) { return secret, nil }, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())`; `errors.Is(err, jwt.ErrTokenExpired)`; client sends `Authorization: Bearer <token>`; parse with `strings.CutPrefix(h, "Bearer ")`.
- Analogy: a festival wristband: printed with your ID and expiry, sealed so it can't be altered — but anyone can read it.
- Code example: jwt.go — POST /login `{"username":"ada","password":"pw"}` (stub check) → 200 `{"token":"<jwt>"}` (value varies); `GET /api/me` with `Authorization: Bearer <that token>` → `{"user_id":"42"}`; token with 1-char changed in signature → 401; expired token (issue with `-1*time.Minute`) → 401 `{"error":{"code":"token_expired","message":"token expired"}}`
- Production use: stateless API auth; short expiry + refresh tokens (named).
- Common mistakes: no WithValidMethods (algorithm confusion); secrets/PII in payload (readable); no expiry.
- Sources: https://pkg.go.dev/github.com/golang-jwt/jwt/v5#example-NewWithClaims-RegisteredClaims ; https://pkg.go.dev/github.com/golang-jwt/jwt/v5#ParseWithClaims ; https://pkg.go.dev/github.com/golang-jwt/jwt/v5#WithValidMethods

### Passing the user via c.Set
- Concept: JWT middleware on success `c.Set(userIDKey, claims.Subject)` then c.Next; handlers `c.GetString(userIDKey)`; helper `func currentUser(c *gin.Context) string`; for code below Gin (services) pass the ID explicitly or via context (topic 17), not *gin.Context.
- Analogy: after the badge check, the guard writes your name on a visitor sticker everyone downstream can read.
- Code example: me.go — `GET /api/me` → `{"user_id":"42"}`; `GET /api/orders` handler reads same key → `{"user_id":"42","orders":[]}`
- Production use: ownership checks (`order.UserID == currentUser(c)` → else 403).
- Common mistakes: trusting a user ID from the request body instead of the token; passing *gin.Context into the domain layer.
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#Context.Set ; https://pkg.go.dev/github.com/gin-gonic/gin#Context.GetString

## Quiz
1. 401 vs 403 — tests authn vs authz
2. Why ConstantTimeCompare for API keys? — tests timing attack
3. Can a client read a JWT's payload? — tests signed not encrypted
4. Why WithValidMethods? — tests algorithm pinning
5. Where should the user ID come from in a handler? — tests c.Set from middleware
