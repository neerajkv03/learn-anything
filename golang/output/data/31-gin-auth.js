window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "31-gin-auth",
  "order": 31,
  "title": "Authentication",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Learn how to prove who is calling your Gin API (authentication) and keep everyone else out. You will guard route groups with middleware, check API keys (secret strings that identify a calling program) safely, use Gin's built-in Basic Auth (a username and password sent with every request), issue and verify JWTs (JSON Web Tokens, signed tokens that carry the user's identity), and hand the logged-in user to your handlers.",
  "prerequisites": ["30-gin-errors", "29-gin-middleware", "13-time"],
  "subtopics": [
    {
      "id": "auth-middleware-groups",
      "title": "Auth middleware on route groups",
      "explanation": "Authentication means proving who you are. Authorization means deciding what you are allowed to do once we know who you are. This topic is mostly about authentication; authorization appears lightly at the end. Every example here assumes the API is served over HTTPS (HTTP with encryption). Over plain HTTP, anything a client sends, including passwords and tokens, can be read and stolen on the network.\n\nIn Gin you do not check credentials inside every handler. You write one middleware (a function that runs before your handler, topic 29) and attach it to a route group (topic 27). Routes outside the group stay public, for example a login route and a health check that load balancers call without credentials. Routes inside the group are private.\n\nThe middleware rejects bad requests with the status code 401 Unauthorized, which really means \"not authenticated\": we do not know who you are. It uses c.AbortWithStatusJSON (topic 30) so the handler chain stops and the client receives the standard error JSON. A related code, 403 Forbidden, means \"authenticated, but not allowed to do this\". Keep them apart: 401 = who are you?, 403 = I know you, and the answer is no.\n\nA 401 response should also carry a WWW-Authenticate header. A header is a named line of metadata sent with the response. WWW-Authenticate tells the client which scheme (kind of login) the server expects, such as Bearer for tokens or Basic for username and password.\n\nSetup, done once: create an empty folder, open a terminal inside it, and run `go mod init authdemo` (topic 1), then `go get github.com/gin-gonic/gin@v1.12.0` (topic 26). Save each example below as its own file in that folder and run just that file with `go run groups.go` (use the file's own name). Running a file by name is how you run one example when the folder holds several.\n\nThe example below uses a stub (a deliberately fake placeholder) that only checks that an Authorization header exists. It is not real security; the next sub-topics replace it with real checks.",
      "analogy": "An office building. The lobby is open to everyone (public routes like /healthz). The lifts need a badge: no badge at the lift, you are stopped (401). A badge for the wrong floor gets you stopped too, but for a different reason: the guard knows who you are, you just may not go there (403).",
      "code": [
        {
          "language": "go",
          "filename": "groups.go",
          "source": "package main\n\nimport (\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\n// AuthRequired is a stub: it only checks that the header exists.\nfunc AuthRequired() gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tif c.GetHeader(\"Authorization\") == \"\" {\n\t\t\tc.Header(\"WWW-Authenticate\", \"Bearer\")\n\t\t\tc.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{\n\t\t\t\t\"error\": gin.H{\"code\": \"unauthorized\", \"message\": \"missing credentials\"},\n\t\t\t})\n\t\t\treturn\n\t\t}\n\t\tc.Next()\n\t}\n}\n\nfunc main() {\n\tr := gin.Default()\n\n\t// Public: no middleware.\n\tr.GET(\"/healthz\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"status\": \"ok\"})\n\t})\n\n\t// Private: every route in this group runs AuthRequired first.\n\tapi := r.Group(\"/api\", AuthRequired())\n\tapi.GET(\"/me\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"user\": \"someone\"})\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "r.Group(\"/api\", AuthRequired()) attaches the middleware to every route registered on api. /healthz is registered on r directly, so it never meets the middleware. When the header is missing the middleware sets WWW-Authenticate, aborts with 401 and the standard error JSON, and returns so nothing else runs. Otherwise c.Next() continues to the handler. The program prints nothing by itself (Gin's startup log goes to the terminal); try it with curl in the next block."
        },
        {
          "language": "bash",
          "filename": "try-groups.sh",
          "source": "# In a second terminal while groups.go is running.\n# -s hides progress, -w prints the status code on a new line after the body.\ncurl -s -w \"\\n%{http_code}\\n\" localhost:8080/healthz\ncurl -s -w \"\\n%{http_code}\\n\" localhost:8080/api/me\ncurl -s -w \"\\n%{http_code}\\n\" -H \"Authorization: anything\" localhost:8080/api/me\n",
          "output": "{\"status\":\"ok\"}\n200\n{\"error\":{\"code\":\"unauthorized\",\"message\":\"missing credentials\"}}\n401\n{\"user\":\"someone\"}\n200",
          "explanation": "The health check works with no header, the private route is refused without one, and the stub accepts any non-empty value."
        }
      ],
      "productionNote": "Write one auth middleware and attach it to a group, so a new route inside the group is protected automatically. Never rely on each handler remembering to check. Keep health checks and login outside the group; a load balancer (a server that spreads traffic over copies of your app) calls /healthz without credentials.",
      "commonMistakes": [
        "Attaching auth middleware globally with r.Use, which also blocks /healthz and /login, so health checks fail and nobody can log in.",
        "Returning 403 when the caller sent no credentials (should be 401), or 401 when a known user lacks permission (should be 403).",
        "Forgetting return after c.AbortWithStatusJSON inside the middleware. Abort stops later handlers, but the rest of your middleware function still runs."
      ],
      "sources": [
        { "title": "Gin docs: using middleware", "url": "https://gin-gonic.com/en/docs/middleware/using-middleware/" },
        { "title": "MDN: 401 Unauthorized", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/401" }
      ]
    },
    {
      "id": "api-key-header",
      "title": "API key header check",
      "explanation": "An API key is a long secret string that identifies a calling program, not a person. It suits service-to-service calls and webhooks (requests another system sends to you when something happens). The client sends it in a custom header, here X-API-Key. A secret is a value only the server and trusted callers know, so it comes from an environment variable (topic 23) and never from the source code.\n\nThe server reads the expected key once at startup with os.Getenv(\"API_KEY\"). If it is empty the server prints a message and exits with os.Exit(1) instead of running with no protection.\n\nThe comparison needs care. The == operator on strings stops at the first character that differs. That makes a wrong guess that matches more leading characters take very slightly longer to reject. An attacker who measures response times can recover a key one character at a time. This is a timing attack. crypto/subtle.ConstantTimeCompare compares two byte slices in the same time no matter where they differ, and returns 1 if equal, 0 otherwise. (It returns 0 at once if the lengths differ, which only reveals the length, an acceptable trade.)\n\nTo use it, convert both strings to byte slices with []byte(...). Compare the result to 1, because it returns an int, not a bool.",
      "analogy": "A combination lock that always takes exactly the same time to say \"no\", so a burglar listening at the dial cannot hear which digit was nearly right.",
      "code": [
        {
          "language": "go",
          "filename": "apikey.go",
          "source": "package main\n\nimport (\n\t\"crypto/subtle\"\n\t\"fmt\"\n\t\"net/http\"\n\t\"os\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc APIKey(want string) gin.HandlerFunc {\n\twantBytes := []byte(want)\n\treturn func(c *gin.Context) {\n\t\tgot := c.GetHeader(\"X-API-Key\")\n\t\tif subtle.ConstantTimeCompare([]byte(got), wantBytes) != 1 {\n\t\t\tc.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{\n\t\t\t\t\"error\": gin.H{\"code\": \"unauthorized\", \"message\": \"invalid API key\"},\n\t\t\t})\n\t\t\treturn\n\t\t}\n\t\tc.Next()\n\t}\n}\n\nfunc main() {\n\tkey := os.Getenv(\"API_KEY\")\n\tif key == \"\" {\n\t\tfmt.Fprintln(os.Stderr, \"API_KEY is required\")\n\t\tos.Exit(1)\n\t}\n\n\tr := gin.Default()\n\tapi := r.Group(\"/api\", APIKey(key))\n\tapi.GET(\"/reports\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"reports\": []string{}})\n\t})\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "APIKey is a middleware factory (topic 29): it takes the expected key and returns the handler. The missing-header case needs no special branch, because an empty got simply fails the comparison. []string{} (an empty slice, not nil) makes the JSON print [] instead of null."
        },
        {
          "language": "bash",
          "filename": "try-apikey.sh",
          "source": "# Terminal 1 (PowerShell: $env:API_KEY = \"k-123\"; go run apikey.go)\nAPI_KEY=k-123 go run apikey.go\n\n# Terminal 2\ncurl -s -w \"\\n%{http_code}\\n\" -H \"X-API-Key: k-123\" localhost:8080/api/reports\ncurl -s -w \"\\n%{http_code}\\n\" -H \"X-API-Key: nope\" localhost:8080/api/reports\n",
          "output": "{\"reports\":[]}\n200\n{\"error\":{\"code\":\"unauthorized\",\"message\":\"invalid API key\"}}\n401",
          "explanation": "The right key reaches the handler; any other key, or none, gets the 401 error JSON."
        }
      ],
      "productionNote": "Use API keys for internal services and webhooks, and plan for rotation (replacing a key regularly, or at once if it leaks). Accepting two keys during a switch-over lets you rotate with no downtime. Generate keys from a secure random source, and store only in environment variables or a secrets manager.",
      "commonMistakes": [
        "Sending the key in the URL query string (?key=...). URLs are written to proxy and server logs; headers are not.",
        "Comparing keys with == instead of subtle.ConstantTimeCompare, which allows a timing attack.",
        "Hard-coding the key in source code, where it ends up in version control.",
        "Starting the server when API_KEY is empty, which would accept requests that send an empty key."
      ],
      "sources": [
        { "title": "crypto/subtle.ConstantTimeCompare", "url": "https://pkg.go.dev/crypto/subtle#ConstantTimeCompare" },
        { "title": "gin.Context.GetHeader", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.GetHeader" }
      ]
    },
    {
      "id": "gin-basicauth",
      "title": "gin.BasicAuth",
      "explanation": "HTTP Basic Auth is the oldest login scheme. The client sends the header Authorization: Basic followed by base64(username:password). Base64 is just a text encoding, not encryption: anyone who sees the header can decode it. So Basic Auth must only be used over HTTPS.\n\nGin ships a ready middleware: gin.BasicAuth(gin.Accounts{\"admin\": \"s3cret\"}). gin.Accounts is a map from user name to password. If the header is missing or wrong, Gin answers 401 with a WWW-Authenticate header, which makes browsers show their login box. curl sends the header for you with -u user:password.\n\nOn success Gin stores the user name in the context under the key gin.AuthUserKey. Read it with c.MustGet(gin.AuthUserKey).(string). MustGet (topic 29) returns an any value, and .(string) is a type assertion (topic 10) that turns it into a string.\n\nThe passwords sit in plain text in a map. That is acceptable for a small internal admin page whose password comes from an environment variable. It is not acceptable for real user accounts: those need each password stored as a salted hash (a one-way scrambled form), for example with bcrypt from golang.org/x/crypto/bcrypt.\n\nIn the try-it block below, in PowerShell use curl.exe, write -o NUL instead of -o /dev/null, and replace grep with Select-String.",
      "analogy": "A door with a username-and-password keypad. It does keep strangers out, but anyone standing close enough to overhear you type the code (no HTTPS) learns it.",
      "code": [
        {
          "language": "go",
          "filename": "basic.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"net/http\"\n\t\"os\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nfunc main() {\n\tpassword := os.Getenv(\"ADMIN_PASSWORD\")\n\tif password == \"\" {\n\t\tfmt.Fprintln(os.Stderr, \"ADMIN_PASSWORD is required\")\n\t\tos.Exit(1)\n\t}\n\n\tr := gin.Default()\n\tadmin := r.Group(\"/admin\", gin.BasicAuth(gin.Accounts{\n\t\t\"admin\": password,\n\t}))\n\tadmin.GET(\"/whoami\", func(c *gin.Context) {\n\t\tuser := c.MustGet(gin.AuthUserKey).(string)\n\t\tc.JSON(http.StatusOK, gin.H{\"user\": user})\n\t})\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "The password is read from ADMIN_PASSWORD, so no credential appears in the source. gin.BasicAuth is attached to the /admin group exactly like the custom middleware before."
        },
        {
          "language": "bash",
          "filename": "try-basic.sh",
          "source": "# Terminal 1 (PowerShell: $env:ADMIN_PASSWORD = \"s3cret\"; go run basic.go)\nADMIN_PASSWORD=s3cret go run basic.go\n\n# Terminal 2\ncurl -s -w \"\\n%{http_code}\\n\" -u admin:s3cret localhost:8080/admin/whoami\ncurl -s -o /dev/null -w \"%{http_code}\\n\" -u admin:wrong localhost:8080/admin/whoami\ncurl -si -u admin:wrong localhost:8080/admin/whoami | grep -i www-authenticate\n",
          "output": "{\"user\":\"admin\"}\n200\n401\nWww-Authenticate: Basic realm=\"Authorization Required\"",
          "explanation": "Good credentials give 200 and the user name. A wrong password gives 401 with an empty body, plus the WWW-Authenticate header asking the client to log in. (-o /dev/null throws the body away; -i includes response headers.)"
        }
      ],
      "productionNote": "Basic Auth fits internal tools and metrics endpoints that sit behind a VPN (a private network) and are served over HTTPS. For end users, use tokens such as the JWTs in the next sub-topic.",
      "commonMistakes": [
        "Using Basic Auth as the login for end users; passwords travel with every request and cannot be revoked per session.",
        "Committing the account map with real passwords to source control instead of loading them from the environment.",
        "Serving Basic Auth over plain HTTP, which exposes the credentials to anyone on the network."
      ],
      "sources": [
        { "title": "Gin docs: using BasicAuth middleware", "url": "https://gin-gonic.com/en/docs/middleware/using-basicauth-middleware/" },
        { "title": "gin.BasicAuth", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#BasicAuth" }
      ]
    },
    {
      "id": "jwt-issue-verify",
      "title": "JWT issue and verify with golang-jwt/jwt v5",
      "explanation": "A JWT (JSON Web Token) is a signed string that carries claims, which are facts about the user such as their ID and when the token expires. It looks like header.payload.signature: three parts joined by dots. The header and payload are base64-encoded JSON, so anyone can read them. The signature is computed with a secret key; if anyone changes a single character the signature no longer matches and the server rejects the token. So a JWT is tamper-proof, not secret. Never put passwords or private data in it.\n\nThe server issues a token after a successful login, and the client sends it back on each request as the header Authorization: Bearer <token>. Because the token proves itself, the server needs no stored session (stateless).\n\nInstall the library in your module: go get github.com/golang-jwt/jwt/v5@v5.3.1. To issue a token, build jwt.RegisteredClaims, a struct of standard claims: Subject (who the token is about), IssuedAt and ExpiresAt. The two times are jwt.NewNumericDate(time) values built with time.Now and Add (topic 13). Then jwt.NewWithClaims(jwt.SigningMethodHS256, claims) creates the token and .SignedString(secret) produces the string. HS256 means HMAC-SHA256: signing with one shared secret []byte. Read it from JWT_SECRET and require at least 32 bytes.\n\nTo verify, call jwt.ParseWithClaims(raw, &jwt.RegisteredClaims{}, keyFunc, options...). To parse means to read and check the string. The keyFunc is a function that returns the secret the library should check the signature with.\n\nTwo options matter. jwt.WithValidMethods([]string{\"HS256\"}) accepts only the algorithm you expect. Without it, an attacker may name a different or weaker algorithm in the token's header and trick the server into checking the token the wrong way; this is called an algorithm confusion attack. jwt.WithExpirationRequired() rejects tokens that carry no expiry.\n\nA failed parse returns an error. errors.Is(err, jwt.ErrTokenExpired) (topic 11) detects specifically an expired token so you can tell the client to log in again. To pull the token out of the header use strings.CutPrefix(header, \"Bearer \"), which returns the rest of the string and true if the prefix was there.\n\nThe server below logs in a stub user and protects /api/me. The middleware stores the user ID with c.Set and the handler reads it with c.GetString (both from topic 29); the next sub-topic polishes that pattern.\n\nTerminal 2 needs a bash shell such as Git Bash. In PowerShell, run the login with curl.exe, copy the token text from the reply into $TOKEN = \"<paste token>\", then run curl.exe -H \"Authorization: Bearer $TOKEN\" localhost:8080/api/me.",
      "analogy": "A festival wristband: printed with your ID and an expiry time and sealed so it cannot be altered without tearing it. But the printing is plain; anyone can read what is on it.",
      "code": [
        {
          "language": "bash",
          "filename": "setup-jwt.sh",
          "source": "go get github.com/golang-jwt/jwt/v5@v5.3.1",
          "output": "",
          "explanation": "Adds the library to go.mod (the output varies by what Go downloads)."
        },
        {
          "language": "go",
          "filename": "jwt.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n\t\"net/http\"\n\t\"os\"\n\t\"strings\"\n\t\"time\"\n\n\t\"github.com/gin-gonic/gin\"\n\t\"github.com/golang-jwt/jwt/v5\"\n)\n\nconst userIDKey = \"userID\"\n\nfunc fail(c *gin.Context, status int, code, msg string) {\n\tc.AbortWithStatusJSON(status, gin.H{\"error\": gin.H{\"code\": code, \"message\": msg}})\n}\n\nfunc issueToken(secret []byte, userID string, ttl time.Duration) (string, error) {\n\tnow := time.Now()\n\tclaims := jwt.RegisteredClaims{\n\t\tSubject:   userID,\n\t\tIssuedAt:  jwt.NewNumericDate(now),\n\t\tExpiresAt: jwt.NewNumericDate(now.Add(ttl)),\n\t}\n\treturn jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)\n}\n\nfunc JWTAuth(secret []byte) gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\traw, ok := strings.CutPrefix(c.GetHeader(\"Authorization\"), \"Bearer \")\n\t\tif !ok {\n\t\t\tc.Header(\"WWW-Authenticate\", \"Bearer\")\n\t\t\tfail(c, http.StatusUnauthorized, \"unauthorized\", \"missing bearer token\")\n\t\t\treturn\n\t\t}\n\n\t\tclaims := &jwt.RegisteredClaims{}\n\t\t_, err := jwt.ParseWithClaims(raw, claims,\n\t\t\tfunc(t *jwt.Token) (any, error) { return secret, nil },\n\t\t\tjwt.WithValidMethods([]string{\"HS256\"}),\n\t\t\tjwt.WithExpirationRequired(),\n\t\t)\n\t\tif errors.Is(err, jwt.ErrTokenExpired) {\n\t\t\tfail(c, http.StatusUnauthorized, \"token_expired\", \"token expired\")\n\t\t\treturn\n\t\t}\n\t\tif err != nil {\n\t\t\tfail(c, http.StatusUnauthorized, \"unauthorized\", \"invalid token\")\n\t\t\treturn\n\t\t}\n\n\t\tc.Set(userIDKey, claims.Subject)\n\t\tc.Next()\n\t}\n}\n\nfunc main() {\n\tsecret := []byte(os.Getenv(\"JWT_SECRET\"))\n\tif len(secret) < 32 {\n\t\tfmt.Fprintln(os.Stderr, \"JWT_SECRET must be at least 32 bytes\")\n\t\tos.Exit(1)\n\t}\n\n\tr := gin.Default()\n\n\tr.POST(\"/login\", func(c *gin.Context) {\n\t\tvar in struct {\n\t\t\tUsername string `json:\"username\" binding:\"required\"`\n\t\t\tPassword string `json:\"password\" binding:\"required\"`\n\t\t}\n\t\tif err := c.ShouldBindJSON(&in); err != nil {\n\t\t\tfail(c, http.StatusBadRequest, \"invalid_request\", \"username and password are required\")\n\t\t\treturn\n\t\t}\n\t\t// Stub check. A real app looks the user up and compares a bcrypt hash.\n\t\tif in.Username != \"ada\" || in.Password != \"pw\" {\n\t\t\tfail(c, http.StatusUnauthorized, \"unauthorized\", \"wrong username or password\")\n\t\t\treturn\n\t\t}\n\t\ttoken, err := issueToken(secret, \"42\", 15*time.Minute)\n\t\tif err != nil {\n\t\t\tfail(c, http.StatusInternalServerError, \"internal\", \"could not issue token\")\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusOK, gin.H{\"token\": token})\n\t})\n\n\tapi := r.Group(\"/api\", JWTAuth(secret))\n\tapi.GET(\"/me\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"user_id\": c.GetString(userIDKey)})\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "issueToken signs a 15-minute token whose subject is the user ID \"42\". JWTAuth cuts the Bearer prefix, verifies signature, algorithm and expiry, and answers 401 otherwise. An expired token gets its own code, token_expired, so a client knows to log in again. On success the subject is stored with c.Set for the handler."
        },
        {
          "language": "bash",
          "filename": "try-jwt.sh",
          "source": "# Terminal 1 (PowerShell: $env:JWT_SECRET = \"...\"; go run jwt.go)\nJWT_SECRET=change-me-change-me-change-me-123456 go run jwt.go\n\n# Terminal 2: log in, keep the token, then call the private route.\nTOKEN=$(curl -s -X POST localhost:8080/login -H \"Content-Type: application/json\" -d '{\"username\":\"ada\",\"password\":\"pw\"}' | sed 's/.*\"token\":\"\\([^\"]*\\)\".*/\\1/')\ncurl -s -w \"\\n%{http_code}\\n\" -H \"Authorization: Bearer $TOKEN\" localhost:8080/api/me\ncurl -s -w \"\\n%{http_code}\\n\" localhost:8080/api/me\ncurl -s -w \"\\n%{http_code}\\n\" -H \"Authorization: Bearer ${TOKEN}x\" localhost:8080/api/me\n",
          "output": "{\"user_id\":\"42\"}\n200\n{\"error\":{\"code\":\"unauthorized\",\"message\":\"missing bearer token\"}}\n401\n{\"error\":{\"code\":\"unauthorized\",\"message\":\"invalid token\"}}\n401",
          "explanation": "The login response itself is {\"token\":\"<jwt>\"} and the token text differs on every run, so the script captures it in TOKEN. Appending a character to the token breaks it, so it is rejected."
        },
        {
          "language": "go",
          "filename": "expired.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n\t\"strings\"\n\t\"time\"\n\n\t\"github.com/golang-jwt/jwt/v5\"\n)\n\nvar secret = []byte(\"demo-secret-demo-secret-demo-1234\") // demo only: real secrets come from the environment\n\nfunc issue(ttl time.Duration) string {\n\tnow := time.Now()\n\tclaims := jwt.RegisteredClaims{\n\t\tSubject:   \"42\",\n\t\tIssuedAt:  jwt.NewNumericDate(now),\n\t\tExpiresAt: jwt.NewNumericDate(now.Add(ttl)),\n\t}\n\ts, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)\n\treturn s\n}\n\nfunc verify(raw string) (*jwt.RegisteredClaims, error) {\n\tclaims := &jwt.RegisteredClaims{}\n\t_, err := jwt.ParseWithClaims(raw, claims,\n\t\tfunc(t *jwt.Token) (any, error) { return secret, nil },\n\t\tjwt.WithValidMethods([]string{\"HS256\"}),\n\t\tjwt.WithExpirationRequired(),\n\t)\n\treturn claims, err\n}\n\nfunc main() {\n\tgood := issue(15 * time.Minute)\n\tclaims, err := verify(good)\n\tfmt.Println(\"valid token subject:\", claims.Subject, err)\n\n\t_, err = verify(issue(-1 * time.Minute))\n\tfmt.Println(\"expired:\", errors.Is(err, jwt.ErrTokenExpired))\n\n\t// Change the first character of the signature (the part after the last dot).\n\tparts := strings.Split(good, \".\")\n\tsig := []byte(parts[2])\n\tif sig[0] == 'A' {\n\t\tsig[0] = 'B'\n\t} else {\n\t\tsig[0] = 'A'\n\t}\n\tparts[2] = string(sig)\n\t_, err = verify(strings.Join(parts, \".\"))\n\tfmt.Println(\"tampered rejected:\", err != nil)\n}\n",
          "output": "valid token subject: 42 <nil>\nexpired: true\ntampered rejected: true",
          "explanation": "A standalone program (run it with go run expired.go) that shows the three outcomes without a server. A token issued with a negative lifetime is already expired when checked, and errors.Is finds jwt.ErrTokenExpired. Changing one character of the signature makes verification fail. strings.Split cuts the token at the dots and strings.Join puts it back."
        }
      ],
      "productionNote": "Use short expiries (about 15 minutes) so a stolen token stops working quickly. For longer sessions, issue a separate long-lived refresh token that can only be exchanged for new short access tokens (refresh tokens are named here, not built). Always serve over HTTPS and keep the secret in the environment, at least 32 bytes long.",
      "commonMistakes": [
        "Leaving out jwt.WithValidMethods, which allows algorithm confusion: the token chooses how it is verified.",
        "Putting secrets or personal data in the payload; it is only base64, so anyone can read it.",
        "Issuing tokens without an expiry, so a leaked token works forever.",
        "Assuming a signed token is encrypted. Signing prevents changes; it does not hide the content."
      ],
      "sources": [
        { "title": "jwt/v5: NewWithClaims example with RegisteredClaims", "url": "https://pkg.go.dev/github.com/golang-jwt/jwt/v5#example-NewWithClaims-RegisteredClaims" },
        { "title": "jwt/v5: ParseWithClaims", "url": "https://pkg.go.dev/github.com/golang-jwt/jwt/v5#ParseWithClaims" },
        { "title": "jwt/v5: WithValidMethods", "url": "https://pkg.go.dev/github.com/golang-jwt/jwt/v5#WithValidMethods" }
      ]
    },
    {
      "id": "passing-user-c-set",
      "title": "Passing the user via c.Set",
      "explanation": "Once middleware has worked out who the caller is, handlers should not repeat that work or re-read the token. The middleware stores the user ID on the request's *gin.Context with c.Set(key, value) and then calls c.Next(). A handler later in the chain reads it with c.GetString(key), which returns the string or \"\" if it is missing.\n\nName the key once as a constant so a typo cannot silently read nothing, and wrap the lookup in a tiny helper such as currentUser(c). Handlers then say currentUser(c) and never touch the key.\n\nKeep *gin.Context inside the web layer (the part of your code that handles HTTP requests). Code below Gin, such as a function that loads orders, should receive the user ID as a plain string argument (or in a context.Context, topic 17), so it can be tested and reused without Gin.\n\nThis enables authorization checks. A handler compares the owner of a record to currentUser(c) and answers 403 if they differ. The example uses a stand-in middleware that always sets user \"42\"; in a real app that is the JWT middleware from the last sub-topic.",
      "analogy": "After the badge check, the guard writes your name on a visitor sticker and puts it on your jacket. Every office downstream just reads the sticker instead of re-checking your badge.",
      "code": [
        {
          "language": "go",
          "filename": "me.go",
          "source": "package main\n\nimport (\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nconst userIDKey = \"userID\"\n\n// fakeAuth stands in for the JWT middleware: it always \"logs in\" user 42.\nfunc fakeAuth() gin.HandlerFunc {\n\treturn func(c *gin.Context) {\n\t\tc.Set(userIDKey, \"42\")\n\t\tc.Next()\n\t}\n}\n\nfunc currentUser(c *gin.Context) string {\n\treturn c.GetString(userIDKey)\n}\n\n// orderOwner is domain code: it takes plain strings, not *gin.Context.\nfunc orderOwner(orderID string) (string, bool) {\n\towners := map[string]string{\"1\": \"42\", \"2\": \"7\"}\n\towner, found := owners[orderID]\n\treturn owner, found\n}\n\nfunc main() {\n\tr := gin.Default()\n\tapi := r.Group(\"/api\", fakeAuth())\n\n\tapi.GET(\"/me\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"user_id\": currentUser(c)})\n\t})\n\n\tapi.GET(\"/orders\", func(c *gin.Context) {\n\t\tc.JSON(http.StatusOK, gin.H{\"user_id\": currentUser(c), \"orders\": []string{}})\n\t})\n\n\tapi.GET(\"/orders/:id\", func(c *gin.Context) {\n\t\towner, found := orderOwner(c.Param(\"id\"))\n\t\tif !found {\n\t\t\tc.AbortWithStatusJSON(http.StatusNotFound, gin.H{\n\t\t\t\t\"error\": gin.H{\"code\": \"not_found\", \"message\": \"order not found\"},\n\t\t\t})\n\t\t\treturn\n\t\t}\n\t\tif owner != currentUser(c) {\n\t\t\tc.AbortWithStatusJSON(http.StatusForbidden, gin.H{\n\t\t\t\t\"error\": gin.H{\"code\": \"forbidden\", \"message\": \"not your order\"},\n\t\t\t})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusOK, gin.H{\"order_id\": c.Param(\"id\")})\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "Both /me and /orders read the same key through currentUser. /orders/:id looks up the owner with orderOwner, which knows nothing about Gin, and returns 403 when the owner is not the logged-in user."
        },
        {
          "language": "bash",
          "filename": "try-me.sh",
          "source": "curl -s -w \"\\n%{http_code}\\n\" localhost:8080/api/me\ncurl -s -w \"\\n%{http_code}\\n\" localhost:8080/api/orders\ncurl -s -w \"\\n%{http_code}\\n\" localhost:8080/api/orders/1\ncurl -s -w \"\\n%{http_code}\\n\" localhost:8080/api/orders/2\n",
          "output": "{\"user_id\":\"42\"}\n200\n{\"orders\":[],\"user_id\":\"42\"}\n200\n{\"order_id\":\"1\"}\n200\n{\"error\":{\"code\":\"forbidden\",\"message\":\"not your order\"}}\n403",
          "explanation": "Gin writes map keys in alphabetical order, so orders comes before user_id. Order 2 belongs to user 7, so user 42 gets 403."
        }
      ],
      "productionNote": "Always take the user's identity from the verified token (via c.Set), never from the request body, query or a header the client can freely write. Use it for ownership checks on every record a user can reach.",
      "commonMistakes": [
        "Trusting a user_id sent in the request body or URL to decide whose data to return; any caller can send someone else's ID.",
        "Passing *gin.Context into the domain or database layer, which ties that code to Gin and makes it hard to test.",
        "Using a string literal key in several places; one typo makes GetString quietly return an empty string."
      ],
      "sources": [
        { "title": "gin.Context.Set", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.Set" },
        { "title": "gin.Context.GetString", "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.GetString" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "A request arrives for a private route with no credentials at all. Which response is correct?",
      "options": [
        "200 OK with an empty body",
        "401 Unauthorized, because the caller is not authenticated",
        "403 Forbidden, because the caller is not authenticated",
        "404 Not Found, because the route should hide itself"
      ],
      "answerIndex": 1,
      "explanation": "401 means \"we do not know who you are\" (authentication failed or missing). 403 is for a known caller who lacks permission (authorization)."
    },
    {
      "question": "Why compare API keys with subtle.ConstantTimeCompare instead of ==?",
      "options": [
        "It prevents a timing attack, where response time reveals how many leading characters were right",
        "It is the only way to compare strings in Go",
        "It encrypts the key so it cannot be logged",
        "It makes the comparison case-insensitive"
      ],
      "answerIndex": 0,
      "explanation": "== stops at the first differing character, so timing can leak the key one character at a time. ConstantTimeCompare takes the same time wherever the bytes differ."
    },
    {
      "question": "A user has a valid JWT signed with HS256. Can the client read the payload (for example the subject)?",
      "options": [
        "No, the signature encrypts the payload",
        "No, only the server holding the secret can decode it",
        "Yes, anyone can decode the base64 payload; the signature only stops changes",
        "Yes, but only if the connection uses HTTP rather than HTTPS"
      ],
      "answerIndex": 2,
      "explanation": "A JWT is signed, not encrypted. The payload is plain base64 JSON, so never put secrets in it."
    },
    {
      "question": "Why pass jwt.WithValidMethods([]string{\"HS256\"}) to ParseWithClaims?",
      "options": [
        "It makes the token expire sooner",
        "It checks that the user name is valid",
        "It compresses the token to save bandwidth",
        "It stops a token from choosing a different or weaker signing algorithm than the one you expect"
      ],
      "answerIndex": 3,
      "explanation": "Without pinning the algorithm, the token's own header can steer verification (algorithm confusion). The option accepts only the listed methods."
    },
    {
      "question": "In a handler behind the JWT middleware, where should the current user's ID come from?",
      "options": [
        "A user_id field in the JSON request body",
        "The value the middleware stored with c.Set after verifying the token, read with c.GetString",
        "A user_id query parameter in the URL",
        "A global variable that the last request wrote"
      ],
      "answerIndex": 1,
      "explanation": "Only the verified token can be trusted. Body, query and headers are chosen by the caller, who could claim to be anyone."
    }
  ]
});
