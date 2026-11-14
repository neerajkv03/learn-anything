window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "28-gin-binding",
  "order": 28,
  "title": "Binding & Validation",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Learn how Gin copies request data (JSON bodies, path values, query strings, forms and file uploads) into Go structs and checks it against rules written in struct tags. You will return clean JSON errors instead of raw library text and add your own validation rule.",
  "prerequisites": [
    "27-gin-routing",
    "19-json",
    "11-error-handling"
  ],
  "subtopics": [
    {
      "id": "shouldbindjson-vs-bindjson",
      "title": "ShouldBindJSON vs BindJSON",
      "explanation": "Binding means copying the data of an incoming request (a JSON body, query string, path value or form) into a Go struct. Validation means checking that the copied values follow your rules, for example \"the email looks like an email\". Gin does both in one call. For the rules it uses a library (a package of ready-made code) called go-playground/validator v10, which Gin already depends on, so you do not install it for this sub-topic.\n\nTo follow along, make a new folder and set up a Go module (the unit that holds your code and its dependencies, see the packages-modules topic). Open a terminal, run the commands in the first code block below, and then create a file called main.go in that folder. In every later sub-topic you replace the contents of main.go with the new example.\n\nThe two ways to bind a JSON body are c.ShouldBindJSON and c.BindJSON. Both read the request body, decode the JSON into the struct you pass (by pointer, so Gin can fill it) and then run the rules written in the struct's `binding` tags. The difference is what happens on failure.\n\nc.ShouldBindJSON only returns the error. You decide the status code and the JSON body of the answer. c.BindJSON, on failure, immediately writes a 400 status, marks the request as aborted (later handlers in the chain do not run) and leaves you with an error you can no longer answer properly. If you then call c.JSON(422, ...), the status is already sent, so Gin cannot change it. In debug mode Gin logs `[WARNING] Headers were already written` and the client still sees 400 (with your body appended).\n\nThe rule for real code is simple: always use the ShouldBind family (ShouldBindJSON, ShouldBindUri, ShouldBindQuery, ShouldBind) and write the error response yourself. Always `return` right after sending the error response, otherwise the handler keeps running with an empty or half-filled struct.\n\nOne more fact: the request body is a stream that can be read only once. A second ShouldBindJSON on the same request fails because the body is already consumed. If you really must bind the same body to two different structs, Gin offers c.ShouldBindBodyWith, which keeps a copy of the body for you. Most handlers never need it.\n\nIn the example the struct CreateUser has two fields. The `json` tag names the JSON key; the `binding` tag lists the rules. `required` means the value must not be empty, and `email` means it must look like an email address. The error text printed here is Gin's raw text; a later sub-topic shows how to turn it into a clean, friendly message.",
      "analogy": "A form checker at a counter. ShouldBind is a clerk who hands the form back to you with notes in the margin (\"email missing\") and lets you decide what to say to the customer. Bind is a clerk who rejects the form at the door and slams it shut with a fixed \"refused\" stamp before you can say anything else.",
      "code": [
        {
          "language": "bash",
          "filename": "setup.sh",
          "source": "mkdir gin-binding\ncd gin-binding\ngo mod init example.com/ginbinding\ngo get github.com/gin-gonic/gin@v1.12.0\n",
          "output": "",
          "explanation": "Creates the folder, turns it into a module (go mod init) and adds Gin v1.12.0 as a dependency (go get). Run these once; the later sub-topics reuse the same folder and only replace main.go."
        },
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\ntype CreateUser struct {\n\tName  string `json:\"name\" binding:\"required\"`\n\tEmail string `json:\"email\" binding:\"required,email\"`\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.Default()\n\n\t// Correct: ShouldBindJSON returns the error, we choose the answer.\n\tr.POST(\"/users\", func(c *gin.Context) {\n\t\tvar in CreateUser\n\t\tif err := c.ShouldBindJSON(&in); err != nil {\n\t\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": err.Error()})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusCreated, in)\n\t})\n\n\t// Wrong, shown only for comparison: BindJSON already sent 400.\n\tr.POST(\"/users-bad\", func(c *gin.Context) {\n\t\tvar in CreateUser\n\t\tif err := c.BindJSON(&in); err != nil {\n\t\t\tc.JSON(http.StatusUnprocessableEntity, gin.H{\"error\": \"name and email are required\"})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusCreated, in)\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "We switch Gin to release mode (so it prints no startup lines) and start the server with go run . in one terminal. The program prints nothing until requests arrive. /users uses ShouldBindJSON; /users-bad uses BindJSON and then tries to answer with 422."
        },
        {
          "language": "bash",
          "filename": "try.sh",
          "source": "curl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/users -H 'Content-Type: application/json' -d '{\"name\":\"Ada\",\"email\":\"ada@example.com\"}'\ncurl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/users -H 'Content-Type: application/json' -d '{\"name\":\"Ada\"}'\ncurl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/users-bad -H 'Content-Type: application/json' -d '{\"name\":\"Ada\"}'\n",
          "output": "{\"name\":\"Ada\",\"email\":\"ada@example.com\"} [201]\n{\"error\":\"Key: 'CreateUser.Email' Error:Field validation for 'Email' failed on the 'required' tag\"} [400]\n{\"error\":\"name and email are required\"} [400]",
          "explanation": "Run these in a second terminal (Git Bash, macOS or Linux shell; in Windows PowerShell use curl.exe and adjust the quotes). The curl option -w prints the HTTP status in square brackets after the body. The first call succeeds. The second fails the `required` rule on Email and /users answers 400 with the message we chose. The third shows the problem: we asked for 422, but BindJSON had already sent 400, so the client sees 400."
        }
      ],
      "productionNote": "Use ShouldBind* in every handler that reads a request body, query, path or form, and write the error answer yourself. Handlers that read client input are the first place bad data enters your system, so binding plus validation at the edge of the handler keeps the rest of your code free of defensive checks.",
      "commonMistakes": [
        "Calling BindJSON (or Bind, BindQuery) and then c.JSON(422, ...): the 400 status is already sent, so your status is ignored and the debug log shows \"Headers were already written\".",
        "Forgetting `return` after writing the error response, so the handler carries on and creates a record from an empty struct.",
        "Passing the struct by value (`ShouldBindJSON(in)` instead of `ShouldBindJSON(&in)`): Gin needs a pointer to fill the struct, otherwise it returns an error.",
        "Calling a bind function twice on the same body: the body is read once. Use c.ShouldBindBodyWith when you really need several reads."
      ],
      "sources": [
        {
          "title": "Gin docs: Model binding and validation",
          "url": "https://gin-gonic.com/en/docs/binding/binding-and-validation/"
        },
        {
          "title": "Gin API: Context.ShouldBindJSON",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.ShouldBindJSON"
        }
      ]
    },
    {
      "id": "binding-tags",
      "title": "Binding tags: required, min, max, email, oneof",
      "explanation": "The `binding` struct tag holds a comma-separated list of rules. A struct tag is the text in backticks after a field (you met `json:\"name\"` in the JSON topic). The rules run left to right and stop at the first one that fails. The `json` tag decides the JSON key; the `binding` tag decides what values are allowed.\n\nThe most useful rules:\n\n`required` - the value must not be the zero value of its type (empty string, 0, false, nil).\n\n`min=2,max=50` - for a string this is the length, for a number the value, for a slice the number of items. `gte=0` and `lte=150` mean \"greater than or equal\" and \"less than or equal\" and also compare numbers by value.\n\n`email` - the string must look like an email address. `oneof=admin user` - the value must be one of the listed words. The words are separated by spaces, not commas, because a comma separates rules.\n\n`omitempty` - if the value is empty, skip all the remaining rules for this field.\n\nThere is one trap. `required` means \"not the zero value\", so an int field with `required` rejects 0, and a bool field with `required` rejects false, even when 0 or false is a perfectly good answer. The fix is a pointer type such as *int (pointers were covered in the pointers topic). A pointer is nil when the field was missing from the JSON and non-nil when it was sent, even if the number it points at is 0. So `*int` with `omitempty,gte=0,lte=150` means: \"optional, but if present it must be between 0 and 150\", and an explicit 0 is accepted. A missing field stays nil and is printed back as JSON null.\n\nWhen a rule fails, the error names the struct and field and the rule's tag, for example `failed on the 'min' tag`. Only the first failing rule per field is reported.",
      "analogy": "The printed rules on a paper form: \"Name: required, 2 to 50 letters\", \"Role: tick one of admin / user\", \"Age: optional, 0 to 150\". The rules sit right on the form (the struct), so everyone filling or checking it reads the same rules.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\ntype CreateUser struct {\n\tName  string `json:\"name\" binding:\"required,min=2,max=50\"`\n\tEmail string `json:\"email\" binding:\"required,email\"`\n\tRole  string `json:\"role\" binding:\"required,oneof=admin user\"`\n\tAge   *int   `json:\"age\" binding:\"omitempty,gte=0,lte=150\"`\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.Default()\n\n\tr.POST(\"/users\", func(c *gin.Context) {\n\t\tvar in CreateUser\n\t\tif err := c.ShouldBindJSON(&in); err != nil {\n\t\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": err.Error()})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusCreated, in)\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "Replace main.go with this file and restart the server with go run . . Age is a *int so that 0 is allowed while a missing age is simply nil."
        },
        {
          "language": "bash",
          "filename": "try.sh",
          "source": "curl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/users -H 'Content-Type: application/json' -d '{\"name\":\"Ada\",\"email\":\"ada@example.com\",\"role\":\"admin\",\"age\":0}'\ncurl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/users -H 'Content-Type: application/json' -d '{\"name\":\"Ada\",\"email\":\"ada@example.com\",\"role\":\"user\"}'\ncurl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/users -H 'Content-Type: application/json' -d '{\"name\":\"A\",\"email\":\"ada@example.com\",\"role\":\"admin\"}'\ncurl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/users -H 'Content-Type: application/json' -d '{\"name\":\"Ada\",\"email\":\"ada@example.com\",\"role\":\"boss\"}'\n",
          "output": "{\"name\":\"Ada\",\"email\":\"ada@example.com\",\"role\":\"admin\",\"age\":0} [201]\n{\"name\":\"Ada\",\"email\":\"ada@example.com\",\"role\":\"user\",\"age\":null} [201]\n{\"error\":\"Key: 'CreateUser.Name' Error:Field validation for 'Name' failed on the 'min' tag\"} [400]\n{\"error\":\"Key: 'CreateUser.Role' Error:Field validation for 'Role' failed on the 'oneof' tag\"} [400]",
          "explanation": "Request 1 sends age 0 and is accepted, because the pointer is non-nil. Request 2 leaves age out, so the pointer is nil and prints as null. Request 3 has a one-letter name and fails `min`. Request 4 has role \"boss\" and fails `oneof`."
        }
      ],
      "productionNote": "Keeping the input rules in the tags next to the type gives one place to read what an endpoint accepts. Bound limits (`max`) also protect you: without a maximum length, a client can send a megabyte-long name and your database or logs have to cope with it.",
      "commonMistakes": [
        "Using `required` on an int or bool where 0 or false is a valid value: 0 and false count as \"missing\". Use a pointer (*int, *bool) instead.",
        "Writing `oneof=admin,user` with a comma: the comma splits rules, so the validator reads \"user\" as a rule named user, which does not exist, and panics on the first request that validates this struct. Separate the allowed words with spaces: `oneof=admin user`.",
        "Putting the rules in the `json` tag: rules belong in the `binding` tag.",
        "Forgetting that `min` on a string counts length, not value, and that `min` on an int compares the number."
      ],
      "sources": [
        {
          "title": "validator v10: baked-in validators and tags",
          "url": "https://pkg.go.dev/github.com/go-playground/validator/v10#hdr-Baked_In_Validators_and_Tags"
        },
        {
          "title": "Gin docs: Model binding and validation",
          "url": "https://gin-gonic.com/en/docs/binding/binding-and-validation/"
        }
      ]
    },
    {
      "id": "binding-uri-query-form",
      "title": "Binding URI, query and form data",
      "explanation": "JSON bodies are only one source of input. Gin can fill a struct from other places too, and the struct tag says which place each field comes from:\n\n`uri:\"id\"` takes a path value (the `:id` part of a route like /users/:id) and is bound with c.ShouldBindUri.\n\n`form:\"limit\"` takes a value from the query string (the part after ? in the URL) and is bound with c.ShouldBindQuery. The same `form` tag also names fields of a submitted HTML form.\n\nc.ShouldBind looks at the request's Content-Type header and picks the matching binder. For a form post (Content-Type application/x-www-form-urlencoded or multipart/form-data) it reads the form fields. For a GET request it reads the query string. For JSON it reads JSON.\n\nURL values arrive as text, so Gin converts them to the field's type for you. A path value \"42\" becomes int64 42. If the conversion fails (for example \"abc\" for an int64) you get an error, just like a failed rule.\n\nA field can get a fallback value with `default=` inside the form tag: `form:\"limit,default=20\"`. If the parameter is missing, Gin fills 20 before the `binding` rules run, so `min=1,max=100` then checks the 20.\n\nRules from the previous sub-topic work the same way on every source. Note that `uri:\"id\" binding:\"required,min=1\"` rejects 0 at the `required` rule; `min` is then not checked, because rules stop at the first failure.\n\nTwo details are easy to miss. First, a `json` tag does nothing on a query struct: Gin only looks at the `form` tag. Second, ShouldBindQuery reads only the URL, never the request body, so it cannot read a posted form. For a posted form use ShouldBind.",
      "analogy": "One filing clerk with several in-trays: one tray for the path in the address, one for the query string, one for the submitted form. Each field in your struct carries a label (the tag) that tells the clerk which tray to take the value from.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\ntype UserURI struct {\n\tID int64 `uri:\"id\" binding:\"required,min=1\"`\n}\n\ntype ListQuery struct {\n\tLimit int    `form:\"limit,default=20\" binding:\"min=1,max=100\"`\n\tSort  string `form:\"sort\" binding:\"omitempty,oneof=name id\"`\n}\n\ntype Login struct {\n\tUsername string `form:\"username\" binding:\"required\"`\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.Default()\n\n\tr.GET(\"/users/:id\", func(c *gin.Context) {\n\t\tvar u UserURI\n\t\tif err := c.ShouldBindUri(&u); err != nil {\n\t\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": \"invalid id\"})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusOK, gin.H{\"id\": u.ID})\n\t})\n\n\tr.GET(\"/users\", func(c *gin.Context) {\n\t\tvar q ListQuery\n\t\tif err := c.ShouldBindQuery(&q); err != nil {\n\t\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": \"invalid query\"})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusOK, gin.H{\"limit\": q.Limit, \"sort\": q.Sort})\n\t})\n\n\tr.POST(\"/login\", func(c *gin.Context) {\n\t\tvar in Login\n\t\tif err := c.ShouldBind(&in); err != nil {\n\t\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": \"invalid form\"})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusOK, gin.H{\"user\": in.Username})\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "Three handlers, three sources: the path (ShouldBindUri), the query string (ShouldBindQuery) and a posted form (ShouldBind). gin.H is a map, so its keys come out sorted in the JSON."
        },
        {
          "language": "bash",
          "filename": "try.sh",
          "source": "curl -s -w ' [%{http_code}]\\n' localhost:8080/users/42\ncurl -s -w ' [%{http_code}]\\n' localhost:8080/users/0\ncurl -s -w ' [%{http_code}]\\n' localhost:8080/users/abc\ncurl -s -w ' [%{http_code}]\\n' localhost:8080/users\ncurl -s -w ' [%{http_code}]\\n' 'localhost:8080/users?limit=500'\ncurl -s -w ' [%{http_code}]\\n' -d 'username=ada' localhost:8080/login\ncurl -s -w ' [%{http_code}]\\n' -d 'nope=1' localhost:8080/login\n",
          "output": "{\"id\":42} [200]\n{\"error\":\"invalid id\"} [400]\n{\"error\":\"invalid id\"} [400]\n{\"limit\":20,\"sort\":\"\"} [200]\n{\"error\":\"invalid query\"} [400]\n{\"user\":\"ada\"} [200]\n{\"error\":\"invalid form\"} [400]",
          "explanation": "Path 42 is converted to a number. 0 fails the rules and \"abc\" fails the conversion; both give 400. With no query string the default 20 is used and sort stays empty. limit=500 breaks `max=100`. curl -d sends a form body (application/x-www-form-urlencoded) with a POST, and ShouldBind reads the username from it."
        }
      ],
      "productionNote": "Pagination and filter parameters (limit, offset, sort) and resource IDs are the typical users of these binders. Giving every list endpoint a query struct with a default and an upper bound means a client can never ask for a million rows in one request.",
      "commonMistakes": [
        "Putting a `json` tag on a query or form struct: it is ignored; the field needs `form:\"name\"`.",
        "Using ShouldBindQuery for a POST form: it reads only the URL, so the form fields stay empty. Use ShouldBind (or ShouldBindWith the form binder).",
        "Using `required` on a numeric query field where 0 is allowed: use a default value or a pointer.",
        "Forgetting the quotes around a URL containing ? or & in the shell: the shell may treat those characters as special."
      ],
      "sources": [
        {
          "title": "Gin docs: Bind URI",
          "url": "https://gin-gonic.com/en/docs/binding/bind-uri/"
        },
        {
          "title": "Gin docs: Only bind query string",
          "url": "https://gin-gonic.com/en/docs/binding/only-bind-query-string/"
        },
        {
          "title": "Gin API: Context.ShouldBindUri",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.ShouldBindUri"
        }
      ]
    },
    {
      "id": "file-uploads",
      "title": "File uploads (multipart)",
      "explanation": "A browser or tool uploads a file inside a request with Content-Type multipart/form-data. This format splits one request body into several named parts, where each part is either a normal form field or a file. In Gin, c.FormFile(\"avatar\") returns the file sent under the form field name \"avatar\" as a *multipart.FileHeader (the metadata of the uploaded file). It has the original filename (Filename), the size in bytes (Size) and an Open method to read the content. c.SaveUploadedFile(fh, dst) copies the file to the path dst on disk.\n\nUploads come from strangers, so treat every part of them as untrusted.\n\nFilename: the client chooses it, so it can be something like ../../etc/cron.d/job. Writing a file to a path built from it lets an attacker escape your upload folder; this attack is called path traversal. Never use the client's name as the path. Make your own name (a counter here, a UUID, a long random ID string, in real systems) and build the path with filepath.Join. If you must show the original name, clean it with filepath.Base, which keeps only the last element (../../etc/passwd becomes passwd).\n\nSize: Gin has a field r.MaxMultipartMemory (default 32 MiB, where MiB means mebibyte, 1,048,576 bytes). It does NOT limit the upload size. It only decides how much of an upload is kept in RAM; the rest is spooled (written to a temporary file on disk), and the upload still succeeds.\n\nTo enforce a maximum, wrap the body with http.MaxBytesReader (from the HTTP server topic), which makes reading fail once the limit is crossed, and also compare fh.Size to your limit. A cheap first check is c.Request.ContentLength, the size the client announced.\n\nType: the extension in the filename proves nothing. Read the first 512 bytes and pass them to http.DetectContentType, which looks at the real bytes and returns a content type label such as image/png. Reject anything else with 415 (Unsupported Media Type).\n\nThe example allows PNG files up to 1 MiB (written 1 << 20 in the code, which means 1 shifted left 20 places, i.e. 1,048,576 bytes). It checks the announced size, wraps the body, reads the file part and checks the size again, then checks the content type before saving. The body limit is slightly above the file limit because the multipart format adds some bytes of framing (the extra header text wrapped around the file); the example leaves 4096 extra bytes (4 KiB) for it.",
      "analogy": "A parcel drop-off desk. You weigh each parcel before accepting it (size limit), look inside rather than trusting the label on the outside (content check), and stick on your own tracking number instead of using the sender's handwritten \"deliver to the CEO's office\" note (your own file name).",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n\t\"log\"\n\t\"net/http\"\n\t\"os\"\n\t\"path/filepath\"\n\t\"sync/atomic\"\n\n\t\"github.com/gin-gonic/gin\"\n)\n\nconst (\n\t// The largest file we accept: 1 MiB.\n\tmaxFile = 1 << 20\n\t// The body limit leaves room for the multipart framing around the file.\n\tmaxBody = maxFile + 4096\n)\n\nvar nextID atomic.Int64\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tif err := os.MkdirAll(\"uploads\", 0o755); err != nil {\n\t\tlog.Fatal(err)\n\t}\n\tr := gin.Default()\n\tr.POST(\"/avatar\", uploadAvatar)\n\tif err := r.Run(\":8080\"); err != nil {\n\t\tlog.Fatal(err)\n\t}\n}\n\nfunc uploadAvatar(c *gin.Context) {\n\ttooLarge := func() {\n\t\tc.JSON(http.StatusRequestEntityTooLarge, gin.H{\"error\": \"file too large\"})\n\t}\n\n\t// Reject early when the client announces a huge body.\n\tif c.Request.ContentLength > maxBody {\n\t\ttooLarge()\n\t\treturn\n\t}\n\t// Backstop: reading more than maxBody bytes fails.\n\tc.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBody)\n\n\tfh, err := c.FormFile(\"avatar\")\n\tif err != nil {\n\t\tvar big *http.MaxBytesError\n\t\tif errors.As(err, &big) {\n\t\t\ttooLarge()\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": \"avatar file is required\"})\n\t\treturn\n\t}\n\tif fh.Size > maxFile {\n\t\ttooLarge()\n\t\treturn\n\t}\n\n\t// Check the real content, not the file extension.\n\tf, err := fh.Open()\n\tif err != nil {\n\t\tc.JSON(http.StatusInternalServerError, gin.H{\"error\": \"could not read upload\"})\n\t\treturn\n\t}\n\tdefer f.Close()\n\thead := make([]byte, 512)\n\tn, _ := f.Read(head)\n\tif http.DetectContentType(head[:n]) != \"image/png\" {\n\t\tc.JSON(http.StatusUnsupportedMediaType, gin.H{\"error\": \"only PNG images are accepted\"})\n\t\treturn\n\t}\n\n\t// Our own name; the client's name is never used as a path.\n\tname := fmt.Sprintf(\"%d.png\", nextID.Add(1))\n\tdst := filepath.Join(\"uploads\", name)\n\tif err := c.SaveUploadedFile(fh, dst); err != nil {\n\t\tc.JSON(http.StatusInternalServerError, gin.H{\"error\": \"could not save file\"})\n\t\treturn\n\t}\n\tc.JSON(http.StatusCreated, gin.H{\n\t\t\"original\": filepath.Base(fh.Filename),\n\t\t\"saved\":    filepath.ToSlash(dst),\n\t\t\"size\":     fh.Size,\n\t})\n}\n",
          "output": "",
          "explanation": "The server prints nothing at startup. It creates an uploads folder next to main.go. errors.As checks whether the error is the \"request body too large\" error type (*http.MaxBytesError). filepath.ToSlash only turns Windows backslashes into / so the answer looks the same everywhere."
        },
        {
          "language": "bash",
          "filename": "try.sh",
          "source": "# On Windows PowerShell, create the big file with `fsutil file createnew big.png 1049600` instead of head, and type curl.exe instead of curl in both commands.\n# any real PNG image saved as me.png in this folder\ncurl -s -w ' [%{http_code}]\\n' -F 'avatar=@me.png' localhost:8080/avatar\n\n# a file just over 1 MiB (1048576 bytes)\nhead -c 1049600 /dev/zero > big.png\ncurl -s -w ' [%{http_code}]\\n' -F 'avatar=@big.png' localhost:8080/avatar\n",
          "output": "{\"original\":\"me.png\",\"saved\":\"uploads/1.png\",\"size\":<byte count of your me.png>} [201]\n{\"error\":\"file too large\"} [413]",
          "explanation": "curl -F sends a multipart/form-data request; @me.png means \"send the contents of this file\". The size in the first answer is the real byte count of whatever PNG you used, so it differs between machines; the other values are fixed. The second file is 1,049,600 bytes (1 MiB plus 1 KiB), so it passes the body limit but fails the exact file-size check. A much larger file is stopped earlier by the ContentLength check."
        }
      ],
      "productionNote": "Local disk is fine for learning, but real services store uploads in object storage such as Amazon S3 (a service that stores files as objects, separate from your servers), because servers get replaced and several instances need the same files. Use random unique names (a UUID); the counter in this example restarts at 1 and would overwrite old files after a restart. Also set the body limit as early as possible, ideally in a middleware, so every upload route gets it.",
      "commonMistakes": [
        "Saving the file under the client-supplied `fh.Filename`: a name like ../../etc/x can write outside the upload folder (path traversal).",
        "Believing MaxMultipartMemory caps the upload size. It only chooses RAM versus temporary disk for the parts of the upload.",
        "Trusting the file extension. A file named photo.png may be anything; check the bytes with http.DetectContentType.",
        "Checking fh.Size only: by then Gin has already read the whole body. Combine it with http.MaxBytesReader so oversized bodies are cut off while reading."
      ],
      "sources": [
        {
          "title": "Gin docs: Single file upload",
          "url": "https://gin-gonic.com/en/docs/routing/upload-file/single-file/"
        },
        {
          "title": "Gin API: Context.FormFile",
          "url": "https://pkg.go.dev/github.com/gin-gonic/gin#Context.FormFile"
        },
        {
          "title": "net/http: MaxBytesReader",
          "url": "https://pkg.go.dev/net/http#MaxBytesReader"
        }
      ]
    },
    {
      "id": "validation-errors-to-json",
      "title": "Turning validation errors into JSON responses",
      "explanation": "So far we answered with err.Error(). That text contains Go internals (the struct name and field names such as CreateUser.Email) and is meant for developers, not API users. A clean API tells the client which field is wrong and why, in its own words.\n\nWhen a rule fails, the validator library returns an error of the type validator.ValidationErrors. This is a list (a slice) with one validator.FieldError per failed field. A FieldError has methods you need:\n\nfe.Field() - the Go field name (Email).\n\nfe.Tag() - the rule that failed (email, min, required).\n\nfe.Param() - the rule's argument (`2` for `min=2`).\n\nNot every binding error is a validation error. If the body is not valid JSON, or a number field gets a string, the error is a different type. So first check which kind you have with errors.As (from the error-handling topic): `var ve validator.ValidationErrors` followed by `errors.As(err, &ve)` is true only for validation failures. Do not use a plain type assertion like `err.(validator.ValidationErrors)` without the comma-ok form (`ve, ok := ...`): on any other error type it panics (crashes the request).\n\nFor non-validation errors, answer with a fixed generic message such as \"invalid JSON body\". Do not send the library's raw error text to the client.\n\nThe helper below turns the failures into a map from field name to message. It is one small function that every handler can share. The map is encoded with keys in sorted order, so the output is stable. The names in the answer are Go field names (Email, not email). If you want the JSON names, validator can be told to use them through its RegisterTagNameFunc method; we skip that here and keep the Go names.",
      "analogy": "Translating an inspector's internal codes (\"F-17, rule min, param 2\") into a customer-friendly checklist (\"Name: must be at least 2 characters\") before the customer sees the report.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"net/http\"\n\n\t\"github.com/gin-gonic/gin\"\n\t\"github.com/go-playground/validator/v10\"\n)\n\ntype CreateUser struct {\n\tName  string `json:\"name\" binding:\"required,min=2\"`\n\tEmail string `json:\"email\" binding:\"required,email\"`\n}\n\n// validationErrors returns field -> message, or nil if err is not a\n// validation error (for example broken JSON).\nfunc validationErrors(err error) map[string]string {\n\tvar ve validator.ValidationErrors\n\tif !errors.As(err, &ve) {\n\t\treturn nil\n\t}\n\tout := make(map[string]string, len(ve))\n\tfor _, fe := range ve {\n\t\tout[fe.Field()] = message(fe)\n\t}\n\treturn out\n}\n\nfunc message(fe validator.FieldError) string {\n\tswitch fe.Tag() {\n\tcase \"required\":\n\t\treturn \"is required\"\n\tcase \"email\":\n\t\treturn \"must be a valid email\"\n\tcase \"min\":\n\t\treturn \"must be at least \" + fe.Param() + \" characters\"\n\tdefault:\n\t\treturn \"is invalid\"\n\t}\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\tr := gin.Default()\n\n\tr.POST(\"/users\", func(c *gin.Context) {\n\t\tvar in CreateUser\n\t\tif err := c.ShouldBindJSON(&in); err != nil {\n\t\t\tif errs := validationErrors(err); errs != nil {\n\t\t\t\tc.JSON(http.StatusBadRequest, gin.H{\"errors\": errs})\n\t\t\t\treturn\n\t\t\t}\n\t\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": \"invalid JSON body\"})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusCreated, in)\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "This file imports the validator package directly. Before go run ., run go mod tidy once: it adds the validator to your go.mod using the version Gin already needs. The helper validationErrors is the reusable part."
        },
        {
          "language": "bash",
          "filename": "try.sh",
          "source": "curl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/users -H 'Content-Type: application/json' -d '{\"name\":\"A\",\"email\":\"x\"}'\ncurl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/users -H 'Content-Type: application/json' -d '{bad json'\ncurl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/users -H 'Content-Type: application/json' -d '{\"name\":5,\"email\":\"ada@example.com\"}'\ncurl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/users -H 'Content-Type: application/json' -d '{\"name\":\"Ada\",\"email\":\"ada@example.com\"}'\n",
          "output": "{\"errors\":{\"Email\":\"must be a valid email\",\"Name\":\"must be at least 2 characters\"}} [400]\n{\"error\":\"invalid JSON body\"} [400]\n{\"error\":\"invalid JSON body\"} [400]\n{\"name\":\"Ada\",\"email\":\"ada@example.com\"} [201]",
          "explanation": "Request 1 has two failures and both are reported at once. Requests 2 and 3 are not validation failures (broken JSON, and a number where a string is expected), so they get the generic message. Request 4 is valid."
        }
      ],
      "productionNote": "Keep one shared helper for all handlers so every endpoint reports validation problems in the same shape. A later topic on error handling folds this into the overall error format of the API. Clients (a web form, a mobile app) can then show each message next to the right input.",
      "commonMistakes": [
        "Returning err.Error() to clients: it leaks Go struct names and changes with library versions.",
        "Using `err.(validator.ValidationErrors)` without the comma-ok form: on a JSON syntax error the assertion panics.",
        "Treating every bind error as a validation error and building messages from an empty list, which sends an empty \"errors\" object for broken JSON.",
        "Building the message with fe.Param() for rules without arguments: Param() is an empty string there."
      ],
      "sources": [
        {
          "title": "validator v10: ValidationErrors",
          "url": "https://pkg.go.dev/github.com/go-playground/validator/v10#ValidationErrors"
        },
        {
          "title": "validator v10: FieldError",
          "url": "https://pkg.go.dev/github.com/go-playground/validator/v10#FieldError"
        }
      ]
    },
    {
      "id": "custom-validators",
      "title": "Custom validators",
      "explanation": "The built-in rules cover generic checks. Your domain has its own formats: a product code that must start with \"SKU-\", a slug, a currency code. A custom validator is a function you register under a rule name, after which you can use that name in `binding` tags like any built-in rule.\n\nThe rule function takes a validator.FieldLevel (an object describing the field being checked) and returns true when the value is acceptable. fl.Field() gives the value under test, and .String() reads it as a string.\n\nTo register it, you need Gin's validator instance. It is available as binding.Validator.Engine() (the binding package is github.com/gin-gonic/gin/binding). Engine() returns the value as type any (the 'accepts any value' type from topic 10), so you convert it with a type assertion to *validator.Validate and use the comma-ok form to check that it worked. Then v.RegisterValidation(\"sku\", skuRule) adds the rule named sku.\n\nRegister once at startup, in main, before the server starts. Do not register inside a handler: that code runs for every request, several at the same time, and the validator is not meant to be changed while it is in use.\n\nThe example imports the validator package directly, so run go mod tidy once to record it in go.mod (it keeps the version Gin already requires). Then the tag `binding:\"required,sku\"` means: must be non-empty, and must pass skuRule. If the check fails, the FieldError's Tag() is \"sku\", which the message helper maps to text.",
      "analogy": "Adding your own rubber stamp to the inspector's kit. The inspector already has stamps for \"required\" and \"valid email\"; you add one that checks \"starts with SKU-\", and from then on any form can say \"stamp it with sku\".",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"log\"\n\t\"net/http\"\n\t\"strings\"\n\n\t\"github.com/gin-gonic/gin\"\n\t\"github.com/gin-gonic/gin/binding\"\n\t\"github.com/go-playground/validator/v10\"\n)\n\ntype Product struct {\n\tSKU string `json:\"sku\" binding:\"required,sku\"`\n}\n\n// skuRule is true when the field starts with \"SKU-\".\nfunc skuRule(fl validator.FieldLevel) bool {\n\treturn strings.HasPrefix(fl.Field().String(), \"SKU-\")\n}\n\nfunc main() {\n\tgin.SetMode(gin.ReleaseMode)\n\n\tv, ok := binding.Validator.Engine().(*validator.Validate)\n\tif !ok {\n\t\tlog.Fatal(\"gin is not using go-playground/validator\")\n\t}\n\tif err := v.RegisterValidation(\"sku\", skuRule); err != nil {\n\t\tlog.Fatal(err)\n\t}\n\n\tr := gin.Default()\n\tr.POST(\"/products\", func(c *gin.Context) {\n\t\tvar in Product\n\t\tif err := c.ShouldBindJSON(&in); err != nil {\n\t\t\tvar ve validator.ValidationErrors\n\t\t\tif errors.As(err, &ve) {\n\t\t\t\tout := map[string]string{}\n\t\t\t\tfor _, fe := range ve {\n\t\t\t\t\tswitch fe.Tag() {\n\t\t\t\t\tcase \"required\":\n\t\t\t\t\t\tout[fe.Field()] = \"is required\"\n\t\t\t\t\tcase \"sku\":\n\t\t\t\t\t\tout[fe.Field()] = \"must start with SKU-\"\n\t\t\t\t\tdefault:\n\t\t\t\t\t\tout[fe.Field()] = \"is invalid\"\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\tc.JSON(http.StatusBadRequest, gin.H{\"errors\": out})\n\t\t\t\treturn\n\t\t\t}\n\t\t\tc.JSON(http.StatusBadRequest, gin.H{\"error\": \"invalid JSON body\"})\n\t\t\treturn\n\t\t}\n\t\tc.JSON(http.StatusCreated, in)\n\t})\n\n\tr.Run(\":8080\")\n}\n",
          "output": "",
          "explanation": "The rule is registered in main before r.Run, so it exists before the first request. log.Fatal prints the message and stops the program if the setup is wrong."
        },
        {
          "language": "bash",
          "filename": "try.sh",
          "source": "curl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/products -H 'Content-Type: application/json' -d '{\"sku\":\"SKU-123\"}'\ncurl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/products -H 'Content-Type: application/json' -d '{\"sku\":\"123\"}'\ncurl -s -w ' [%{http_code}]\\n' -X POST localhost:8080/products -H 'Content-Type: application/json' -d '{}'\n",
          "output": "{\"sku\":\"SKU-123\"} [201]\n{\"errors\":{\"SKU\":\"must start with SKU-\"}} [400]\n{\"errors\":{\"SKU\":\"is required\"}} [400]",
          "explanation": "\"SKU-123\" passes both rules. \"123\" passes required but fails sku, so Tag() is \"sku\". The empty object fails required first, and the rules stop at the first failure, so skuRule never runs."
        }
      ],
      "productionNote": "Custom rules are good for domain formats that appear on many structs (SKUs, slugs, currency codes), because the rule is written and tested once. Keep each rule a small pure function (no database calls, no network) so validation stays fast and predictable.",
      "commonMistakes": [
        "Registering the rule inside a handler: it re-registers on every request and can race with other requests using the validator.",
        "Using the type assertion on Engine() without the comma-ok form: if Gin was built with a different validator, it panics at startup.",
        "Using a rule name in a tag but never registering it: the first request that reaches that field panics with an \"undefined validation function\" message, so test the route.",
        "Doing slow work (database lookups) inside a rule function: it runs for every request."
      ],
      "sources": [
        {
          "title": "Gin docs: Custom validators",
          "url": "https://gin-gonic.com/en/docs/binding/custom-validators/"
        },
        {
          "title": "validator v10: Validate.RegisterValidation",
          "url": "https://pkg.go.dev/github.com/go-playground/validator/v10#Validate.RegisterValidation"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why should handlers use ShouldBindJSON instead of BindJSON?",
      "options": [
        "ShouldBindJSON runs faster because it skips validation",
        "On failure BindJSON already sends a 400 response and aborts, so you cannot choose your own status or body; ShouldBindJSON only returns the error",
        "BindJSON cannot read JSON bodies larger than 1 KiB",
        "ShouldBindJSON automatically retries the decoding when the body is invalid"
      ],
      "answerIndex": 1,
      "explanation": "Bind* functions write the 400 status and abort the request when binding fails. Any later c.JSON with another status cannot change the status (Gin only logs \"Headers were already written\"). ShouldBind* returns the error and leaves the response to you."
    },
    {
      "question": "A struct field is `Age int` with `binding:\"required\"`. A client sends `\"age\":0`. What happens and what is the fix?",
      "options": [
        "It is accepted, because 0 is a valid number",
        "It is accepted and Age is set to 18 by default",
        "It is rejected, because required means \"not the zero value\"; use a *int pointer (with omitempty) so a sent 0 counts as present",
        "It is rejected, and the only fix is to remove the binding tag so nothing is validated"
      ],
      "answerIndex": 2,
      "explanation": "The required rule fails for zero values (0, false, empty string). With a *int the pointer is non-nil when the client sent the field, even if it points at 0, so the value passes."
    },
    {
      "question": "Which struct tag tells Gin which query-string parameter fills a field when you use ShouldBindQuery?",
      "options": [
        "form:\"page\"",
        "json:\"page\"",
        "uri:\"page\"",
        "query-string:\"page\""
      ],
      "answerIndex": 0,
      "explanation": "Query values and posted form fields both use the form tag. The json tag is for JSON bodies and uri is for path values bound with ShouldBindUri. There is no query-string tag."
    },
    {
      "question": "Does setting r.MaxMultipartMemory limit how large an uploaded file can be?",
      "options": [
        "Yes, uploads above that size are rejected with 413 automatically",
        "Yes, but only for files with a .png extension",
        "No, it only affects the request headers, never the body",
        "No, it only decides how much of an upload is kept in RAM before spilling to temporary disk files; limit the size with http.MaxBytesReader and a check of fh.Size"
      ],
      "answerIndex": 3,
      "explanation": "MaxMultipartMemory is about memory usage, not a size cap. To enforce a limit, wrap the body with http.MaxBytesReader and/or compare fh.Size and ContentLength to your maximum."
    },
    {
      "question": "How do you tell a validation failure (a rule such as email failed) from a broken request body (for example malformed JSON) after ShouldBindJSON returns an error?",
      "options": [
        "Compare err.Error() with the text \"validation failed\"",
        "Use errors.As(err, &ve) with a variable of type validator.ValidationErrors; it is true only for rule failures",
        "Check whether the HTTP status is 400, since validation failures always use another status",
        "Call c.IsAborted(), which is true only for validation failures"
      ],
      "answerIndex": 1,
      "explanation": "Validation failures are returned as validator.ValidationErrors, so errors.As finds them. Other errors (syntax errors, wrong types) are different types and should get a generic \"invalid JSON body\" answer."
    }
  ]
});
