window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "19-json",
  "order": 19,
  "title": "JSON",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "JSON is the text format almost every web API uses to exchange data. You will convert structs to JSON and back with encoding/json, control field names and omission with struct tags, decode JSON of unknown shape into a map, and stream JSON with Encoder and Decoder. You will also learn what Go 1.27 changed under the hood with encoding/json/v2.",
  "prerequisites": [
    "18-files-io"
  ],
  "subtopics": [
    {
      "id": "marshal-unmarshal",
      "title": "encoding/json Marshal and Unmarshal",
      "explanation": "JSON (JavaScript Object Notation) is a plain-text format for describing data. It is the format most web APIs, config files and message queues use. A JSON object looks like {\"name\":\"Ada\",\"age\":36}: curly braces, keys in double quotes, and values that can be strings, numbers, true/false, null, lists (arrays) or more objects.\n\nGo's standard library package encoding/json converts between Go values and JSON text. Turning a Go value into JSON is called marshalling (or serialising: flattening a value into text that can be stored or sent). json.Marshal(v) takes any value and returns the JSON as a []byte (a slice of bytes) plus an error.\n\nThe reverse is unmarshalling. json.Unmarshal(data, &v) takes JSON bytes and fills the variable v. You must pass a pointer (&v, taught in the pointers topic), because Unmarshal has to change your variable, not a copy of it. Passing a non-pointer makes Unmarshal return an error.\n\nOnly exported struct fields (names starting with a capital letter) take part. Lowercase fields are invisible to the json package and are silently skipped. To choose the JSON key name, put a struct tag after the field type. A struct tag is a small string in backticks attached to a field; json:\"name\" tells the package to use the key name. Struct tags get a deeper look in the next sub-topic.\n\nBy default, JSON keys with no matching struct field are ignored, and struct fields with no matching key keep their zero value. Matching of keys to fields is case-insensitive in encoding/json.",
      "analogy": "Marshal is packing your items into a standard shipping box with a label on each item. Unmarshal is the receiver opening the box and putting every item on the right shelf by reading its label. Items without a label (lowercase fields) never get packed, and items with no matching shelf are left out of the shelves.",
      "code": [
        {
          "language": "go",
          "filename": "basic.go",
          "source": "package main\n\nimport (\n\t\"encoding/json\"\n\t\"fmt\"\n)\n\ntype User struct {\n\tName string `json:\"name\"`\n\tAge  int    `json:\"age\"`\n}\n\nfunc main() {\n\tb, err := json.Marshal(User{Name: \"Ada\", Age: 36})\n\tif err != nil {\n\t\tfmt.Println(\"marshal failed:\", err)\n\t\treturn\n\t}\n\tfmt.Println(string(b))\n\n\tvar u User\n\terr = json.Unmarshal([]byte(`{\"name\":\"Bo\",\"age\":25,\"extra\":true}`), &u)\n\tfmt.Println(u.Name, u.Age, err)\n}\n",
          "output": "{\"name\":\"Ada\",\"age\":36}\nBo 25 <nil>",
          "explanation": "Save as basic.go inside a module folder (go mod init example.com/jsondemo) and run it with go run . . Marshal returns bytes, so string(b) converts them to printable text. Unmarshal receives &u, a pointer to the User variable. The unknown key \"extra\" is ignored and err is nil (no error)."
        }
      ],
      "productionNote": "Web APIs (programs that exchange data over HTTP, the web's request/response protocol, covered in topics 21 and 22), config files and message queues (services that pass messages between programs) all depend on Marshal and Unmarshal. Always check the returned error: Unmarshal fails on malformed JSON or on a value of the wrong type (for example a string where a number is expected).",
      "commonMistakes": [
        "Using lowercase field names (name string). The json package cannot see unexported fields, so they are silently skipped with no error.",
        "Passing a non-pointer to Unmarshal (json.Unmarshal(data, u) instead of &u). It cannot modify your variable and returns an error.",
        "Ignoring the error from Marshal or Unmarshal with _, which hides malformed input."
      ],
      "sources": [
        {
          "title": "encoding/json: Marshal",
          "url": "https://pkg.go.dev/encoding/json#Marshal"
        },
        {
          "title": "encoding/json: Unmarshal",
          "url": "https://pkg.go.dev/encoding/json#Unmarshal"
        },
        {
          "title": "The Go Blog: JSON and Go",
          "url": "https://go.dev/blog/json"
        }
      ]
    },
    {
      "id": "struct-tags",
      "title": "Struct tags (omitempty, omitzero)",
      "explanation": "A struct tag has the form json:\"name,option\". The part before the comma is the JSON key. Anything after the comma is an option. There must be no space between json: and the opening quote; json: \"name\" is silently ignored (go vet reports it).\n\nThe option omitempty leaves the key out of the output when the value is empty: false, 0, \"\", a nil pointer or interface, or a slice, map or string of length zero. A struct value, such as a time.Time, is never considered empty by omitempty.\n\nThe option omitzero (added in Go 1.24) leaves the key out when the value is the zero value of its type. For structs, that includes a zero time.Time. If the type has an IsZero() bool method, omitzero calls it to decide. Use omitzero for time.Time and other structs.\n\nThe tag json:\"-\" means the field is never encoded or decoded. Use it for secrets such as passwords.",
      "analogy": "Filling in a paper form: with omitempty or omitzero you leave a blank field off the form entirely instead of writing \"none\" in it, and json:\"-\" is a field printed on your private copy that is never photocopied for anyone else.",
      "code": [
        {
          "language": "go",
          "filename": "tags.go",
          "source": "package main\n\nimport (\n\t\"encoding/json\"\n\t\"fmt\"\n\t\"time\"\n)\n\ntype Profile struct {\n\tName     string    `json:\"name\"`\n\tEmail    string    `json:\"email,omitempty\"`\n\tJoined   time.Time `json:\"joined,omitzero\"`\n\tPassword string    `json:\"-\"`\n}\n\nfunc main() {\n\tsparse, _ := json.Marshal(Profile{Name: \"Ada\", Password: \"x\"})\n\tfmt.Println(string(sparse))\n\n\tfull, _ := json.Marshal(Profile{\n\t\tName:     \"Bo\",\n\t\tEmail:    \"bo@example.com\",\n\t\tJoined:   time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC),\n\t\tPassword: \"secret\",\n\t})\n\tfmt.Println(string(full))\n}\n",
          "output": "{\"name\":\"Ada\"}\n{\"name\":\"Bo\",\"email\":\"bo@example.com\",\"joined\":\"2024-01-02T03:04:05Z\"}",
          "explanation": "Save it as tags.go in a new folder (go mod init as before) or replace main.go with it. In the first call, Email is \"\" (dropped by omitempty), Joined is the zero time (dropped by omitzero) and Password is never written. In the second call all values are set, so email and joined appear, but Password still does not. A time.Time is written in RFC 3339 format (taught in the time topic). The errors are ignored with _ only to keep the example short."
        }
      ],
      "productionNote": "Use omitempty/omitzero for optional API fields so responses stay small and clients do not see misleading empty values. Use json:\"-\" to keep secrets (passwords, tokens) out of responses and logs. Note that omitempty also drops a legitimate 0 or false, so for a field where 0 is meaningful, use a pointer type (*int), which is dropped only when nil.",
      "commonMistakes": [
        "Expecting omitempty to drop a zero time.Time. It does not, and the output contains \"0001-01-01T00:00:00Z\". Use omitzero.",
        "Writing a space in the tag: json: \"name\". The tag is ignored and the field uses its Go name. go vet warns about this.",
        "Using omitempty on an int that can legitimately be 0, so a real 0 disappears from the output."
      ],
      "sources": [
        {
          "title": "encoding/json: Marshal (struct tag options)",
          "url": "https://pkg.go.dev/encoding/json#Marshal"
        },
        {
          "title": "Go 1.24 release notes (omitzero)",
          "url": "https://go.dev/doc/go1.24"
        }
      ]
    },
    {
      "id": "unknown-json-map",
      "title": "Decoding unknown JSON into map[string]any",
      "explanation": "Sometimes you do not know the shape of the JSON ahead of time, for example a webhook (a message another service sends to your server) whose fields vary. You can unmarshal into a map[string]any: a map with string keys and values of any type (any is the empty interface, taught in the interfaces topic).\n\nThe package picks Go types for each JSON value. A JSON object becomes map[string]any, an array becomes []any, a string becomes string, true/false becomes bool, null becomes nil, and every number becomes float64, even if it looks like an integer.\n\nTo use a value you need a type assertion (taught in the interfaces topic). Use the comma-ok form, such as tags, ok := m[\"tags\"].([]any), which sets ok to false instead of panicking when the type does not match. The single-value form m[\"id\"].(int) panics because the stored value is a float64, not an int.\n\nIf you know the shape, prefer a struct. A map gives you no compile-time checks and needs assertions everywhere.",
      "analogy": "An unlabelled moving box. Before you use anything, you have to open it and check what each item is, and you may find something different from what you expected.",
      "code": [
        {
          "language": "go",
          "filename": "dyn.go",
          "source": "package main\n\nimport (\n\t\"encoding/json\"\n\t\"fmt\"\n)\n\nfunc main() {\n\tdata := []byte(`{\"id\":7,\"tags\":[\"a\",\"b\"]}`)\n\n\tvar m map[string]any\n\tif err := json.Unmarshal(data, &m); err != nil {\n\t\tfmt.Println(\"bad json:\", err)\n\t\treturn\n\t}\n\n\tfmt.Printf(\"%T %v\\n\", m[\"id\"], m[\"id\"])\n\n\ttags, ok := m[\"tags\"].([]any)\n\tfmt.Println(ok, len(tags), tags[0])\n\n\tid, ok := m[\"id\"].(int)\n\tfmt.Println(id, ok)\n}\n",
          "output": "float64 7\ntrue 2 a\n0 false",
          "explanation": "Save it as dyn.go in a new folder (go mod init as before) or replace main.go with it. The number 7 arrives as float64, printed by %v as 7. The tags array arrives as []any with two items; tags[0] is the string \"a\". The assertion to int fails safely because the comma-ok form returns the zero value 0 and false. Without the ok variable it would panic."
        }
      ],
      "productionNote": "Maps are useful for webhooks with varying shapes and for proxies that pass data through. As soon as a field matters to your logic, decode into a struct instead. Large integers (such as 64-bit IDs) can lose precision as float64, which is another reason to use a struct with an int64 field.",
      "commonMistakes": [
        "Asserting m[\"id\"].(int). JSON numbers are float64, so this panics (a runtime crash) with an interface conversion error.",
        "Using map[string]any when the shape is known, giving up type checking for no benefit.",
        "Indexing into a value without checking the assertion succeeded, for example tags[0] when tags is nil because ok was false."
      ],
      "sources": [
        {
          "title": "encoding/json: Unmarshal",
          "url": "https://pkg.go.dev/encoding/json#Unmarshal"
        },
        {
          "title": "The Go Blog: JSON and Go (generic JSON with interface{})",
          "url": "https://go.dev/blog/json#generic-json-with-interface"
        }
      ]
    },
    {
      "id": "encoder-decoder",
      "title": "Streaming with Encoder and Decoder",
      "explanation": "Marshal and Unmarshal work on a whole []byte held in memory. When data comes from or goes to a file, network connection or web request body (HTTP, taught in topic 21), use the streaming types instead. They work with the io.Writer and io.Reader interfaces from the files topic.\n\njson.NewEncoder(w) wraps any io.Writer. Its Encode(v) method writes the JSON for v followed by a newline, and returns an error.\n\njson.NewDecoder(r) wraps any io.Reader. Its Decode(&v) method reads the next JSON value from the stream into v. Call it repeatedly to read a sequence of values; when the input is finished it returns io.EOF (end of file).\n\nA Decoder can be made strict. Calling dec.DisallowUnknownFields() before Decode makes it return an error if the JSON contains a key that has no matching struct field. This catches typos and unexpected input.\n\nIn this example, strings.NewReader(s) turns a string into an io.Reader so the decoder has something to read without needing a file.",
      "analogy": "Marshal and Unmarshal hand over one sealed box at a time. An Encoder and Decoder are a conveyor belt: boxes are processed one by one as they arrive, so you never need room for the whole delivery at once.",
      "code": [
        {
          "language": "go",
          "filename": "stream.go",
          "source": "package main\n\nimport (\n\t\"encoding/json\"\n\t\"errors\"\n\t\"fmt\"\n\t\"io\"\n\t\"os\"\n\t\"strings\"\n)\n\ntype User struct {\n\tName string `json:\"name\"`\n\tAge  int    `json:\"age\"`\n}\n\nfunc main() {\n\tenc := json.NewEncoder(os.Stdout)\n\tif err := enc.Encode(User{Name: \"Ada\", Age: 36}); err != nil {\n\t\tfmt.Println(\"encode failed:\", err)\n\t}\n\n\tinput := `{\"name\":\"A\",\"age\":1}` + \"\\n\" + `{\"name\":\"B\",\"age\":2}`\n\tdec := json.NewDecoder(strings.NewReader(input))\n\tfor {\n\t\tvar u User\n\t\terr := dec.Decode(&u)\n\t\tif errors.Is(err, io.EOF) {\n\t\t\tbreak\n\t\t}\n\t\tif err != nil {\n\t\t\tfmt.Println(\"decode failed:\", err)\n\t\t\tbreak\n\t\t}\n\t\tfmt.Println(u.Name, u.Age)\n\t}\n\n\tstrict := json.NewDecoder(strings.NewReader(`{\"name\":\"Cy\",\"age\":40,\"x\":1}`))\n\tstrict.DisallowUnknownFields()\n\tvar u User\n\terr := strict.Decode(&u)\n\tfmt.Println(err != nil && strings.Contains(err.Error(), \"unknown field\"))\n}\n",
          "output": "{\"name\":\"Ada\",\"age\":36}\nA 1\nB 2\ntrue",
          "explanation": "Save it as stream.go in a new folder (go mod init as before) or replace main.go with it. The Encoder writes straight to os.Stdout (an io.Writer) and adds a newline. The first Decoder reads two JSON values in a loop and stops at io.EOF. The strict Decoder rejects the unknown key \"x\"; the program prints only whether the error message mentions an unknown field."
        }
      ],
      "productionNote": "In web handlers (topic 21) you decode straight from the request body with json.NewDecoder(r.Body).Decode(&v) and encode straight to the ResponseWriter. Use DisallowUnknownFields for strict public APIs. Always limit how much of an untrusted body you read (for example with http.MaxBytesReader) so a huge request cannot exhaust memory.",
      "commonMistakes": [
        "Reading a whole body with io.ReadAll and then calling Unmarshal without a size limit. It works, but an attacker can send gigabytes.",
        "Ignoring the error from Decode, which leaves your struct half-filled or empty.",
        "Forgetting that Encode appends a newline, then comparing its output to a string without one.",
        "Treating io.EOF as a failure when decoding a sequence. It simply means there is no more input."
      ],
      "sources": [
        {
          "title": "encoding/json: Encoder",
          "url": "https://pkg.go.dev/encoding/json#Encoder"
        },
        {
          "title": "encoding/json: Decoder.DisallowUnknownFields",
          "url": "https://pkg.go.dev/encoding/json#Decoder.DisallowUnknownFields"
        }
      ]
    },
    {
      "id": "json-v2-note",
      "title": "json/v2 note",
      "explanation": "Go 1.27 adds two new packages. encoding/json/v2 is a redesigned JSON package. Its Marshal and Unmarshal functions accept extra Options (settings passed as additional arguments) and use stricter defaults: they reject invalid UTF-8 text and reject objects that repeat the same key (duplicate names). encoding/json/jsontext is a low-level package for reading and writing JSON one token at a time (a token is one piece such as a brace, a key or a value).\n\nThe package you have used in this topic, encoding/json, is unchanged for you as a user. In Go 1.27 it is implemented on top of v2, but it keeps its familiar v1 behaviour, so existing code behaves the same. If you must switch off the new implementation, build with the environment variable (a named setting the operating system passes to a program) GOEXPERIMENT=nojsonv2.\n\nThis course keeps using encoding/json. Check the package page on pkg.go.dev for the exact v2 API before using it in a project.",
      "analogy": "A familiar car model that now has a new engine under the hood: it drives exactly the same, so you notice nothing. Next to it, a new model line (v2) is on sale with stricter safety defaults, which you only get by choosing that model on purpose.",
      "code": [
        {
          "language": "bash",
          "filename": "optout.sh",
          "source": "# build and run with the new json implementation switched off\nGOEXPERIMENT=nojsonv2 go run .",
          "output": "",
          "explanation": "This is only needed if you hit a problem you believe comes from the new implementation. On PowerShell, set the variable first: $env:GOEXPERIMENT = \"nojsonv2\"; go run . . It prints whatever your program prints, so nothing extra appears here."
        }
      ],
      "productionNote": "Use v2 when you want stricter decoding of untrusted input. Do not assume that encoding/json now rejects duplicate keys or invalid UTF-8 just because it is backed by v2; it keeps v1 behaviour. Test before switching a service to v2.",
      "commonMistakes": [
        "Assuming encoding/json now has v2 behaviour, such as rejecting duplicate keys. It still follows v1 behaviour.",
        "Importing encoding/json/v2 from copied code without reading its API: its functions take Options and differ from v1 in details."
      ],
      "sources": [
        {
          "title": "Go 1.27 release notes",
          "url": "https://go.dev/doc/go1.27"
        },
        {
          "title": "encoding/json/v2 package",
          "url": "https://pkg.go.dev/encoding/json/v2"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Given type User struct { Name string `json:\"name\"`; Age int `json:\"age\"` }, what does json.Marshal(User{Name: \"Ada\", Age: 36}) produce as text?",
      "options": [
        "{\"Name\":\"Ada\",\"Age\":36}",
        "{\"name\":\"Ada\",\"age\":36}",
        "name=Ada&age=36",
        "[\"Ada\",36]"
      ],
      "answerIndex": 1,
      "explanation": "The struct tags set the JSON keys to lowercase name and age. Without tags the keys would be the Go field names, and Marshal always produces a JSON object for a struct, not a list or a query string."
    },
    {
      "question": "A struct field is declared as Joined time.Time with the tag json:\"joined,omitzero\" and holds the zero time. What happens when it is marshalled, and what would omitempty have done?",
      "options": [
        "omitzero drops the key; omitempty would still write \"0001-01-01T00:00:00Z\"",
        "Both drop the key",
        "Neither drops the key",
        "omitzero writes null; omitempty drops the key"
      ],
      "answerIndex": 0,
      "explanation": "omitzero skips zero values including zero structs such as time.Time. omitempty never treats a struct as empty, so the zero time is written out."
    },
    {
      "question": "After json.Unmarshal into a map[string]any of {\"id\":7}, what is the Go type of m[\"id\"]?",
      "options": [
        "float64",
        "int",
        "string",
        "uint"
      ],
      "answerIndex": 0,
      "explanation": "Every JSON number decoded into an any becomes float64. That is why m[\"id\"].(int) panics, and why the comma-ok form returns false."
    },
    {
      "question": "How do you make decoding fail when the JSON contains a key that has no matching struct field?",
      "options": [
        "Add json:\"-\" to every field",
        "Pass a non-pointer to Unmarshal",
        "Use omitempty on all fields",
        "Create a Decoder with json.NewDecoder and call DisallowUnknownFields() before Decode"
      ],
      "answerIndex": 3,
      "explanation": "A Decoder's DisallowUnknownFields method makes Decode return an error for unmatched keys. The other options either hide fields, cause a different error, or only affect encoding."
    },
    {
      "question": "What did Go 1.27 change for encoding/json?",
      "options": [
        "It was removed and replaced by encoding/json/v2",
        "It now rejects duplicate keys and invalid UTF-8 by default",
        "It is now implemented on top of the new v2 code while keeping its v1 behaviour",
        "It no longer supports struct tags"
      ],
      "answerIndex": 2,
      "explanation": "encoding/json is backed by v2 internally but keeps v1 behaviour, so existing programs behave the same. The stricter defaults belong to encoding/json/v2 itself."
    }
  ]
});
