# 28. Binding & Validation
Version: Go 1.27.4 + Gin v1.12.0 (validator v10.30.1 via Gin)
Prerequisites: 27-gin-routing, 19-json, 11-error-handling

Gloss: binding = copying request data (JSON, query, path, form) into a Go struct; validation = checking the values follow rules. Gin uses github.com/go-playground/validator/v10 (pulled in by Gin, v10.30.1 in Gin's go.mod) for the `binding:"..."` tag.
Note to author: never quote encoding/json parse-error text (Go 1.27 encoding/json is backed by json/v2; messages changed). Validator error text below is stable.

## Learning goals
- learner can bind a JSON body into a struct and choose ShouldBindJSON over BindJSON
- learner can declare rules with binding tags
- learner can bind path, query and form values into structs
- learner can accept a file upload safely
- learner can return validation errors as clean JSON
- learner can register a custom validation rule

## Sub-topics
### ShouldBindJSON vs BindJSON
- Concept: `var in CreateUser; if err := c.ShouldBindJSON(&in); err != nil { c.JSON(400, gin.H{"error": ...}); return }`; ShouldBind* returns the error, you choose the response; Bind* (BindJSON) on error auto-aborts with 400 + sets status header → writing your own JSON afterwards logs `[WARNING] Headers were already written` and status can't change. Rule: always ShouldBind*. Body readable once (use ShouldBindBodyWith named for multi-read).
- Analogy: a form checker that hands the form back with notes (Should) vs one that rejects it at the door and slams it shut (Bind).
- Code example: create.go — `type CreateUser struct{ Name string `json:"name" binding:"required"`; Email string `json:"email" binding:"required,email"` }`; POST /users `{"name":"Ada","email":"ada@example.com"}` → 201 `{"name":"Ada","email":"ada@example.com"}`; body `{"name":"Ada"}` → 400 with error string `Key: 'CreateUser.Email' Error:Field validation for 'Email' failed on the 'required' tag`
- Production use: every JSON write endpoint.
- Common mistakes: BindJSON then c.JSON(422,...) (status stuck at 400); missing `return` after error response.
- Sources: https://gin-gonic.com/en/docs/examples/binding-and-validation/ ; https://pkg.go.dev/github.com/gin-gonic/gin#Context.ShouldBindJSON

### binding tags (required, min, max, email, oneof)
- Concept: comma-separated rules in `binding:"..."`: `required` (non-zero value — so `0`/`false`/"" fail: use pointer `*int` when 0 is valid), `min=1,max=100` (numbers: value; strings: length; slices: count), `email`, `oneof=admin user` (space-separated), `omitempty` (skip rules if empty), `gte/lte`; json tag names the JSON key, binding tag holds rules.
- Analogy: rules printed on a form: "required", "max 100 characters", "choose one: admin / user".
- Code example: tags.go — `type CreateUser struct{ Name string `json:"name" binding:"required,min=2,max=50"`; Email string `json:"email" binding:"required,email"`; Role string `json:"role" binding:"required,oneof=admin user"`; Age *int `json:"age" binding:"omitempty,gte=0,lte=150"` }`; `{"name":"A",...}` → fails on `min`; `"role":"boss"` → fails on `oneof`; valid body incl. `"age":0` → 201 (pointer lets 0 pass)
- Production use: input rules live next to the type; one place to read them.
- Common mistakes: `required` on int/bool where 0/false is valid; `oneof=admin,user` (comma splits rules, wrong).
- Sources: https://pkg.go.dev/github.com/go-playground/validator/v10#hdr-Baked_In_Validators_and_Tags ; https://gin-gonic.com/en/docs/examples/binding-and-validation/

### Binding URI, query and form data
- Concept: struct tags per source: `uri:"id"` + `c.ShouldBindUri`; `form:"page"` + `c.ShouldBindQuery` (query only); `form:"..."` + `c.ShouldBind` picks by Content-Type (form posts); default value via `form:"limit,default=20"` (accuracy reviewer: confirm on gin docs); conversion to int automatic, bad number → error.
- Analogy: same filing clerk, different in-trays (path, query, form), each labelled by tag.
- Code example: list.go — `type UserURI struct{ ID int64 `uri:"id" binding:"required,min=1"` }`: GET /users/42 → `{"id":42}`, /users/0 → 400 (min), /users/abc → 400; `type ListQuery struct{ Limit int `form:"limit,default=20" binding:"min=1,max=100"`; Sort string `form:"sort" binding:"omitempty,oneof=name id"` }`: GET /users → `{"limit":20,"sort":""}`; `?limit=500` → 400 (max)
- Production use: pagination/filter params (topic 32), resource IDs.
- Common mistakes: `json` tag on query struct (ignored — needs `form`); ShouldBindQuery for POST form body (reads only URL).
- Sources: https://gin-gonic.com/en/docs/examples/bind-uri/ ; https://gin-gonic.com/en/docs/examples/only-bind-query-string/ ; https://pkg.go.dev/github.com/gin-gonic/gin#Context.ShouldBindUri

### File uploads (multipart)
- Concept: multipart/form-data gloss (form that carries files); `fh, err := c.FormFile("avatar")` → *multipart.FileHeader (Filename, Size); `c.SaveUploadedFile(fh, dst)` (optional perm arg); never trust `fh.Filename` → `filepath.Base` + own name; limit size: `r.MaxMultipartMemory` only controls RAM vs temp disk, NOT max size → wrap body with `http.MaxBytesReader` (topic 21) in a middleware or check `fh.Size`; check type by content not extension (http.DetectContentType named).
- Analogy: parcel drop-off: weigh it, relabel with your own tracking number, never use the sender's handwritten "put me in the CEO's office".
- Code example: upload.go — POST /avatar, limit 1 MiB (`1 << 20`), save to `uploads/<id>.png` with `filepath.Join("uploads", name)`; `curl -F "avatar=@me.png" localhost:8080/avatar` → 201 `{"size":<bytes>,"saved":"uploads/1.png"}` (say size is the file's byte count); file >1 MiB → 413 `{"error":"file too large"}`
- Production use: avatars, CSV imports; production stores in object storage (S3 named) not local disk.
- Common mistakes: saving with client filename (path traversal `../../etc`); thinking MaxMultipartMemory caps size.
- Sources: https://gin-gonic.com/en/docs/examples/upload-file/single-file/ ; https://pkg.go.dev/github.com/gin-gonic/gin#Context.FormFile ; https://pkg.go.dev/net/http#MaxBytesReader

### Turning validation errors into JSON responses
- Concept: raw error string leaks Go struct names; `var ve validator.ValidationErrors; if errors.As(err, &ve)` (topic 11) → loop `fe.Field()`, `fe.Tag()`, `fe.Param()` → map to messages; other errors (bad JSON, wrong type) → generic `"invalid JSON body"`; Field() returns Go field name (`Email`) — mention mapping to json name via RegisterTagNameFunc as named option only.
- Analogy: turning an inspector's internal codes into a customer-friendly list of "fix this field".
- Code example: verrors.go — helper `func validationErrors(err error) map[string]string`; body `{"name":"A","email":"x"}` → 400 `{"errors":{"Email":"must be a valid email","Name":"must be at least 2 characters"}}` (map keys sorted in JSON); `{bad json` → 400 `{"error":"invalid JSON body"}`
- Production use: one helper shared by all handlers (topic 30 folds it into the error shape).
- Common mistakes: returning err.Error() to clients; type-asserting `err.(validator.ValidationErrors)` without ok → panic on JSON syntax errors.
- Sources: https://pkg.go.dev/github.com/go-playground/validator/v10#ValidationErrors ; https://pkg.go.dev/github.com/go-playground/validator/v10#FieldError

### Custom validators
- Concept: get Gin's validator: `if v, ok := binding.Validator.Engine().(*validator.Validate); ok { v.RegisterValidation("sku", skuRule) }` at startup (before serving); `func skuRule(fl validator.FieldLevel) bool { return strings.HasPrefix(fl.Field().String(), "SKU-") }`; imports `github.com/gin-gonic/gin/binding` + `github.com/go-playground/validator/v10` (add with `go get github.com/go-playground/validator/v10` — Go picks version Gin already needs); use as `binding:"required,sku"`.
- Analogy: adding your own stamp to the inspector's kit.
- Code example: sku.go — `type Product struct{ SKU string `json:"sku" binding:"required,sku"` }`; `{"sku":"SKU-123"}` → 201; `{"sku":"123"}` → 400, fe.Tag() → `sku`
- Production use: domain formats (SKUs, slugs, currency codes).
- Common mistakes: registering inside a handler (races, repeated); forgetting comma-ok on Engine() assertion.
- Sources: https://gin-gonic.com/en/docs/examples/custom-validators/ ; https://pkg.go.dev/github.com/go-playground/validator/v10#Validate.RegisterValidation

## Quiz
1. Why prefer ShouldBindJSON? — tests Bind auto-abort
2. Why does `binding:"required"` reject age 0? — tests zero value + pointer fix
3. Which tag for a query param field? — tests form tag
4. Does MaxMultipartMemory limit upload size? — tests upload safety
5. How to detect validation errors vs bad JSON? — tests errors.As ValidationErrors
