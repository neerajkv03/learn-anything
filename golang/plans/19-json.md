# 19. JSON
Version: Go 1.27.4
Prerequisites: 18-files-io

## Learning goals
- learner can convert structs to and from JSON
- learner can control field names and omission with struct tags
- learner can decode unknown JSON into map[string]any
- learner can stream JSON with Encoder and Decoder
- learner can explain what Go 1.27's encoding/json/v2 changes

## Sub-topics
### encoding/json Marshal and Unmarshal
- Concept: JSON (gloss: text format for data used by web APIs); `json.Marshal(v)` → []byte; `json.Unmarshal(data, &v)` fills a struct; only exported fields; unknown JSON fields ignored by default.
- Analogy: packing items into a standard shipping box (Marshal) and unpacking them back on the shelves by label (Unmarshal).
- Code example: basic.go — `type User struct { Name string \`json:"name"\`; Age int \`json:"age"\` }`; `b, _ := json.Marshal(User{Name: "Ada", Age: 36}); fmt.Println(string(b))` → `{"name":"Ada","age":36}`; `var u User; err := json.Unmarshal([]byte(\`{"name":"Bo","age":25}\`), &u); fmt.Println(u.Name, u.Age, err)` → `Bo 25 <nil>`
- Production use: REST APIs (topics 21, 22), config files, message queues.
- Common mistakes: lowercase fields silently skipped; passing a non-pointer to Unmarshal (error).
- Sources: https://pkg.go.dev/encoding/json#Marshal ; https://pkg.go.dev/encoding/json#Unmarshal ; https://go.dev/blog/json

### Struct tags (omitempty, omitzero)
- Concept: tag syntax `json:"name,opt"`; `omitempty` skips false, 0, "", nil, empty slice/map; `omitzero` (Go 1.24+, confirmed https://go.dev/doc/go1.24) skips zero values incl. zero structs like `time.Time{}` (or when `IsZero()` reports true); `json:"-"` never encodes.
- Analogy: leaving blank fields off the form entirely instead of writing "none".
- Code example: tags.go — `type Profile struct { Name string \`json:"name"\`; Email string \`json:"email,omitempty"\`; Joined time.Time \`json:"joined,omitzero"\`; Password string \`json:"-"\` }`; `json.Marshal(Profile{Name: "Ada", Password: "x"})` → `{"name":"Ada"}`
- Production use: optional API fields, hiding secrets.
- Common mistakes: expecting omitempty to drop a zero time.Time (it doesn't — use omitzero); space in tag `json: "name"` breaks it (vet structtag warns).
- Sources: https://pkg.go.dev/encoding/json#Marshal ; https://go.dev/doc/go1.24

### Decoding unknown JSON into map[string]any
- Concept: `var m map[string]any; json.Unmarshal(data, &m)`; JSON numbers → float64, arrays → []any, objects → map[string]any; access needs type assertions (topic 10).
- Analogy: unlabelled moving box — you must open it and check each item before using it.
- Code example: dyn.go — data `{"id":7,"tags":["a","b"]}`; `fmt.Printf("%T %v\n", m["id"], m["id"])` → `float64 7`; `tags := m["tags"].([]any); fmt.Println(len(tags))` → `2`
- Production use: webhooks with varying shapes, pass-through proxies.
- Common mistakes: asserting `m["id"].(int)` → panic; using maps where a struct is known.
- Sources: https://pkg.go.dev/encoding/json#Unmarshal ; https://go.dev/blog/json#generic-json-with-interface

### Streaming with Encoder and Decoder
- Concept: `json.NewEncoder(w).Encode(v)` writes to any io.Writer + newline; `json.NewDecoder(r).Decode(&v)` reads from any io.Reader; `dec.DisallowUnknownFields()` for strict input; used directly on HTTP bodies.
- Analogy: conveyor belt of boxes vs one box handed over — process items as they arrive.
- Code example: stream.go — `json.NewEncoder(os.Stdout).Encode(User{Name: "Ada", Age: 36})` → `{"name":"Ada","age":36}`; decoder over `strings.NewReader(\`{"name":"Cy","age":40,"x":1}\`)` with DisallowUnknownFields → err printed contains `unknown field "x"`
- Production use: HTTP handlers (topic 21), large files.
- Common mistakes: reading the body with io.ReadAll then Unmarshal (fine but unbounded — limit size); ignoring Decode errors.
- Sources: https://pkg.go.dev/encoding/json#Encoder ; https://pkg.go.dev/encoding/json#Decoder.DisallowUnknownFields

### json/v2 note
- Concept: Go 1.27 adds `encoding/json/v2` (Marshal/Unmarshal with variadic Options; rejects invalid UTF-8 and duplicate names by default) and `encoding/json/jsontext` (low-level tokens); `encoding/json` is now backed by v2 while keeping v1 behaviour (opt-out `GOEXPERIMENT=nojsonv2`) — all per https://go.dev/doc/go1.27. Course keeps `encoding/json`; concept only, no v2 code unless the author confirms exact API on pkg.go.dev/encoding/json/v2.
- Analogy: same car model with a new engine under the hood — drives the same; a new model line (v2) has stricter safety defaults.
- Code example: none required; optional import line `import jsonv2 "encoding/json/v2"` only if confirmed
- Production use: stricter decoding of untrusted input with v2.
- Common mistakes: assuming v2 behaviour (duplicate-key rejection) from encoding/json.
- Sources: https://go.dev/doc/go1.27 ; https://pkg.go.dev/encoding/json/v2

## Quiz
1. Output of Marshal on the User struct — tests tags
2. omitempty vs omitzero for time.Time — tests omitzero
3. Type of a JSON number in map[string]any — tests float64
4. How to reject unknown fields — tests Decoder
5. What did Go 1.27 change for encoding/json? — tests v2 note
