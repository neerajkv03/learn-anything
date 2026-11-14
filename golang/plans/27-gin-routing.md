# 27. Routing in Gin
Version: Go 1.27.4 + Gin v1.12.0
Prerequisites: 26-gin-basics

## Learning goals
- learner can read path parameters (:id) and catch-all wildcards (*path)
- learner can read query strings with and without defaults
- learner can group routes under a shared prefix like /api/v1
- learner can customise 404 and enable 405 responses

## Sub-topics
### Path parameters (:id and *wildcard)
- Concept: `/users/:id` matches one segment, `c.Param("id")` returns string (convert with strconv.Atoi, topic 5; bad → 400); `/files/*filepath` catch-all matches rest, value includes leading `/`; one segment only for :param (`/users/1/x` doesn't match `/users/:id`); compare net/http `{id}` / `{path...}` (topic 21).
- Analogy: apartment address "Flat :number" — the building is fixed, the flat number varies; *wildcard = "deliver to everything past this door".
- Code example: params.go — `GET /users/:id`: `/users/42` → `{"id":42}`; `/users/abc` → 400 `{"error":"id must be a number"}`; `GET /files/*filepath`: `/files/docs/report.pdf` → `{"path":"/docs/report.pdf"}`
- Production use: resource IDs, static-file style paths.
- Common mistakes: forgetting Param returns string; expecting no leading slash in *wildcard value.
- Sources: https://gin-gonic.com/en/docs/examples/param-in-path/ ; https://pkg.go.dev/github.com/gin-gonic/gin#Context.Param

### Query strings (Query, DefaultQuery)
- Concept: `?q=go&page=2`; `c.Query("q")` → "" if missing; `c.DefaultQuery("page", "1")`; `c.GetQuery("q")` → (value, ok) to tell missing from empty (comma-ok, topic 7); `c.QueryArray("tag")` for `?tag=a&tag=b` → `[a b]`; values are strings — convert + validate (binding in 28 does this for you).
- Analogy: notes clipped to a letter: optional, the letter (path) still arrives without them.
- Code example: search.go — GET /search: `/search?q=gin` → `{"page":"1","q":"gin"}` (gin.H keys sorted in JSON output — encoding/json sorts map keys); `/search?q=gin&page=3` → `{"page":"3","q":"gin"}`; `/search?tag=a&tag=b` with QueryArray → `{"tags":["a","b"]}`
- Production use: filters, sort, pagination (topic 32).
- Common mistakes: using Query when "absent" vs "empty" matters; trusting numeric query values without parsing errors.
- Sources: https://gin-gonic.com/en/docs/examples/querystring-param/ ; https://pkg.go.dev/github.com/gin-gonic/gin#Context.DefaultQuery

### Route groups and API versioning (/api/v1)
- Concept: `v1 := r.Group("/api/v1")` then `v1.GET("/users", ...)` → `/api/v1/users`; `{ }` block after group is only visual (plain Go block); nested groups; group-level middleware preview (`r.Group("/admin", mw)`, detail in 29); versioning: new incompatible API → `/api/v2` while v1 keeps working.
- Analogy: departments on a floor: "Floor 1 — Accounts" — every office inside shares the floor prefix.
- Code example: groups.go — v1 GET /users → `{"version":"v1","users":["Ada"]}`; v2 GET /users → `{"version":"v2","users":[{"id":1,"name":"Ada"}]}`; curl `/api/v1/users` and `/api/v2/users` show both
- Production use: versioned public APIs; separate admin/public groups.
- Common mistakes: trailing slash mismatch (`/api/v1/` + `/users` → double slash pattern); thinking `{}` scopes routes (it doesn't, the group variable does).
- Sources: https://gin-gonic.com/en/docs/examples/grouping-routes/ ; https://pkg.go.dev/github.com/gin-gonic/gin#RouterGroup.Group

### NoRoute and 404/405 handling
- Concept: unknown path → default 404 body `404 page not found` (text); `r.NoRoute(handler)` → JSON 404; wrong method on known path → 404 by default because `r.HandleMethodNotAllowed` is false; set it true → 405 `405 method not allowed` + `r.NoMethod(handler)` for JSON; RedirectTrailingSlash default true: `/users/` → redirect to `/users` (301 for GET, 307 other methods).
- Analogy: post office: unknown address → "no such address" slip (404); right address but parcel type not accepted → "wrong service" (405).
- Code example: notfound.go — NoRoute → `GET /nope` → 404 `{"error":"not found"}`; with HandleMethodNotAllowed=true + NoMethod → `DELETE /ping` (only GET registered) → 405 `{"error":"method not allowed"}`
- Production use: consistent JSON errors for API clients (topic 30 builds the shape).
- Common mistakes: expecting 405 without setting HandleMethodNotAllowed; HTML/text 404 bodies breaking JSON clients.
- Sources: https://pkg.go.dev/github.com/gin-gonic/gin#Engine.NoRoute ; https://pkg.go.dev/github.com/gin-gonic/gin#Engine (fields HandleMethodNotAllowed, RedirectTrailingSlash)

## Quiz
1. Value of c.Param("filepath") for /files/a/b.txt with /files/*filepath — tests wildcard leading slash
2. Query vs GetQuery — tests missing vs empty
3. Final path of v1.GET("/users") with Group("/api/v1") — tests groups
4. Status for wrong method by default — tests HandleMethodNotAllowed
