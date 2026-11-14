window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "22-http-client",
  "order": 22,
  "title": "HTTP Clients",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7",
  "summary": "Topic 21 showed how to receive HTTP requests. This topic shows the other side: sending requests to other servers with Go's net/http package. You will build a reusable client with a timeout, tie each request to a context, read and close response bodies safely, send and receive JSON, and treat non-2xx status codes as errors.",
  "prerequisites": [
    "21-http-server"
  ],
  "subtopics": [
    {
      "id": "client-and-timeouts",
      "title": "http.Client and timeouts",
      "explanation": "An HTTP client is the program that sends a request and waits for the response. In Go it is a value of type http.Client from the net/http package. A client does two jobs: it sends requests, and it keeps a pool of open network connections so the next request to the same server can reuse one instead of opening a new connection each time.\n\nBecause of that pool, you should create a client once and reuse it, not build a new one for every request. An http.Client is safe to share between many goroutines at the same time.\n\nThe field you must set is Timeout. It is a time.Duration (topic 13) that limits the whole exchange: connecting, sending, waiting, and reading the body. If the limit passes, the call returns an error instead of waiting.\n\nThe shortcut http.Get(url) and the shared value http.DefaultClient have Timeout 0, which means no limit at all. A server that accepts your connection and then never answers would make your program wait forever. So in real code always build your own client: `client := &http.Client{Timeout: 10 * time.Second}`.\n\nThe example is self-contained so you can run it anywhere. It starts a tiny test server inside your own program using httptest.NewServer, a helper from the standard library package net/http/httptest. It listens on a free port chosen by the operating system, and srv.URL holds its address. You could instead point the client at topic 21's server on localhost:8080; the client code would be identical.\n\nTo run it: create a folder, run `go mod init clientdemo` inside it, save the code as client.go, and run `go run .`.",
      "analogy": "Think of hiring one courier company on a contract with a delivery deadline, instead of flagging down a random stranger for each parcel with no deadline. The company keeps its vans (connections) ready and reuses them, and the contract says that if a parcel is not delivered in time, you hear about it rather than waiting for ever. http.Get is the stranger with no deadline; your own http.Client is the contracted company.",
      "code": [
        {
          "language": "go",
          "filename": "client.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"net/http\"\n\t\"net/http/httptest\"\n\t\"time\"\n)\n\nfunc main() {\n\tmux := http.NewServeMux()\n\tmux.HandleFunc(\"GET /hello\", func(w http.ResponseWriter, r *http.Request) {\n\t\tfmt.Fprintf(w, \"hello\\n\")\n\t})\n\tsrv := httptest.NewServer(mux)\n\tdefer srv.Close()\n\n\tfmt.Println(\"default client timeout:\", http.DefaultClient.Timeout)\n\n\tclient := &http.Client{Timeout: 10 * time.Second}\n\tresp, err := client.Get(srv.URL + \"/hello\")\n\tif err != nil {\n\t\tfmt.Println(\"request failed:\", err)\n\t\treturn\n\t}\n\tdefer resp.Body.Close()\n\tfmt.Println(resp.StatusCode)\n}\n",
          "output": "default client timeout: 0s\n200",
          "explanation": "The first Println shows that http.DefaultClient has a timeout of 0s, meaning it waits forever. Then we create our own client with a 10 second timeout, send a GET request with client.Get, check the error, and print the status code 200. The deferred resp.Body.Close() is explained in the sub-topic on response bodies."
        }
      ],
      "productionNote": "Create one client per service you call (for example one for the payments API, one for an internal user service) and share it across goroutines. Pick a timeout that matches what that service should need, and never ship code that relies on http.Get or http.DefaultClient.",
      "commonMistakes": [
        "Creating a new http.Client for every request, which throws away the connection pool and is slower under load.",
        "Leaving Timeout unset (or using http.Get), so one unresponsive server can freeze your goroutine for ever.",
        "Forgetting that Timeout covers reading the body too, then being surprised by errors when downloading large responses; use a longer client timeout or a per-request context for those."
      ],
      "sources": [
        {
          "title": "net/http: type Client",
          "url": "https://pkg.go.dev/net/http#Client"
        },
        {
          "title": "net/http: Clients and Transports",
          "url": "https://pkg.go.dev/net/http#hdr-Clients_and_Transports"
        }
      ]
    },
    {
      "id": "requests-with-context",
      "title": "Requests with context",
      "explanation": "Client.Timeout is one limit for every call. Often you need a different limit for one particular call, or you need to cancel a call because the user went away. For that, build the request yourself and attach a context (topic 17).\n\nhttp.NewRequestWithContext(ctx, http.MethodGet, url, nil) returns a request value (*http.Request) and an error. The error is non-nil if, for example, the URL cannot be parsed, so check it. The last argument is the request body; nil means no body. http.MethodGet is a constant holding the text \"GET\".\n\nThen client.Do(req) sends it and returns the response and an error. If the context is cancelled or its deadline passes while the call is running, Do stops waiting and returns an error that wraps context.DeadlineExceeded or context.Canceled. You can test for them with errors.Is (topic 11).\n\nInside an HTTP handler (topic 21), pass r.Context() as the parent. Then if the caller of your server disconnects, the downstream call you made is cancelled too, and deadlines flow down the whole chain.\n\nThe example below shows three outcomes with one helper function: a normal success, a deadline of 50 milliseconds against a server that never answers, and a connection to port 9 where nothing is listening. A connection error message differs between operating systems, for example \"connect: connection refused\" on Linux and macOS and \"connectex: ...\" on Windows, so the code only checks that the text contains \"connect\".",
      "analogy": "It is a phone call with a kitchen timer next to you. You start the call and set the timer; when it rings, you hang up wherever the conversation is, even in mid-sentence. If the person never picks up at all (nothing is listening on that port), you also find out quickly and move on. Cancelling the context is the timer ringing, or you deciding to hang up early.",
      "code": [
        {
          "language": "go",
          "filename": "ctxreq.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"errors\"\n\t\"fmt\"\n\t\"net/http\"\n\t\"net/http/httptest\"\n\t\"strings\"\n\t\"time\"\n)\n\nfunc get(ctx context.Context, client *http.Client, url string) (int, error) {\n\treq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)\n\tif err != nil {\n\t\treturn 0, err\n\t}\n\tresp, err := client.Do(req)\n\tif err != nil {\n\t\treturn 0, err\n\t}\n\tdefer resp.Body.Close()\n\treturn resp.StatusCode, nil\n}\n\nfunc main() {\n\tmux := http.NewServeMux()\n\tmux.HandleFunc(\"GET /hello\", func(w http.ResponseWriter, r *http.Request) {\n\t\tfmt.Fprintf(w, \"hello\\n\")\n\t})\n\tmux.HandleFunc(\"GET /slow\", func(w http.ResponseWriter, r *http.Request) {\n\t\t<-r.Context().Done() // never answers; waits until the client gives up\n\t})\n\tsrv := httptest.NewServer(mux)\n\tdefer srv.Close()\n\n\tclient := &http.Client{Timeout: 10 * time.Second}\n\n\tctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)\n\tdefer cancel()\n\tstatus, err := get(ctx, client, srv.URL+\"/hello\")\n\tfmt.Println(\"status:\", status, err)\n\n\tslowCtx, cancelSlow := context.WithTimeout(context.Background(), 50*time.Millisecond)\n\tdefer cancelSlow()\n\t_, err = get(slowCtx, client, srv.URL+\"/slow\")\n\tfmt.Println(\"deadline exceeded:\", errors.Is(err, context.DeadlineExceeded))\n\n\t_, err = get(ctx, client, \"http://localhost:9/hello\")\n\tfmt.Println(\"connect error:\", strings.Contains(err.Error(), \"connect\"))\n}\n",
          "output": "status: 200 <nil>\ndeadline exceeded: true\nconnect error: true",
          "explanation": "Replace main.go with this code (or use a new folder); a folder can hold only one main().\n\nThe helper get builds a request bound to ctx, sends it, and returns the status code. The first call succeeds. The second call hits /slow, whose handler just waits, so after 50 milliseconds the context expires and Do returns an error wrapping context.DeadlineExceeded. The third call goes to localhost:9 where nothing listens, so the connection fails immediately with an operating-system specific message that contains the word connect."
        }
      ],
      "productionNote": "Request-scoped deadlines should travel with the work: a handler receives r.Context(), derives a shorter timeout from it with context.WithTimeout, and uses it for every downstream HTTP call. That way a slow dependency can never hold your handler longer than you allow.",
      "commonMistakes": [
        "Using http.NewRequest (which has no context) inside a handler, so the downstream call keeps running after the caller has left.",
        "Ignoring the error returned by http.NewRequestWithContext and then using a nil request, which panics.",
        "Forgetting to call the cancel function returned by context.WithTimeout, which keeps resources alive until the timeout expires."
      ],
      "sources": [
        {
          "title": "net/http: func NewRequestWithContext",
          "url": "https://pkg.go.dev/net/http#NewRequestWithContext"
        },
        {
          "title": "net/http: func (*Client) Do",
          "url": "https://pkg.go.dev/net/http#Client.Do"
        }
      ]
    },
    {
      "id": "reading-and-closing-bodies",
      "title": "Reading and closing response bodies",
      "explanation": "A response (*http.Response) has a field Body. It is an io.ReadCloser: something you can read bytes from (io.Reader, topic 18) and also close. The body is a live stream connected to the network connection, not a ready-made string.\n\nThe rule: as soon as the error from Do or Get is nil, write `defer resp.Body.Close()`. Closing releases the connection so the client can reuse it. If you forget, connections and file descriptors (the operating system's handles for open files and sockets) pile up under load and your program eventually fails to open new ones. Put the defer after the error check, because when err is not nil, resp is nil and resp.Body would crash the program with a nil pointer panic (topic 9).\n\nTo read the body, use io.ReadAll(resp.Body), which returns all the bytes. But the server decides how large the body is, and a faulty or hostile server could send gigabytes. Wrap the body in io.LimitReader(resp.Body, max) so that at most max bytes are ever read. `1<<20` means 1 shifted left 20 bits, which is 1 MiB (1,048,576 bytes) and is a common cap.\n\nGo 1.27 improves the closing step: for HTTP/1 responses (the classic version of HTTP), closing a body now drains (reads and discards) any unread content, up to a limit, so the connection can go back to the pool even if you stopped reading early. You should still read what you need and always close; do not rely on draining to hide a bug.\n\nThe example reads a small body, and a 100 byte body capped at 10 bytes. strings.Repeat(\"x\", 100) simply builds a string of 100 letters x.",
      "analogy": "A response body is a phone line that stays open until you hang up. When you are done, hang up so the line is free for the next caller; if you never hang up, new callers get a busy signal. LimitReader is telling yourself 'I will listen for at most one minute, however long the other person wants to talk'.",
      "code": [
        {
          "language": "go",
          "filename": "body.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"io\"\n\t\"net/http\"\n\t\"net/http/httptest\"\n\t\"strings\"\n\t\"time\"\n)\n\nfunc readLimited(client *http.Client, url string, max int64) (string, error) {\n\tresp, err := client.Get(url)\n\tif err != nil {\n\t\treturn \"\", err\n\t}\n\tdefer resp.Body.Close()\n\n\tdata, err := io.ReadAll(io.LimitReader(resp.Body, max))\n\tif err != nil {\n\t\treturn \"\", err\n\t}\n\treturn string(data), nil\n}\n\nfunc main() {\n\tmux := http.NewServeMux()\n\tmux.HandleFunc(\"GET /hello\", func(w http.ResponseWriter, r *http.Request) {\n\t\tfmt.Fprintf(w, \"hello\\n\")\n\t})\n\tmux.HandleFunc(\"GET /big\", func(w http.ResponseWriter, r *http.Request) {\n\t\tfmt.Fprint(w, strings.Repeat(\"x\", 100))\n\t})\n\tsrv := httptest.NewServer(mux)\n\tdefer srv.Close()\n\n\tclient := &http.Client{Timeout: 10 * time.Second}\n\n\tbody, err := readLimited(client, srv.URL+\"/hello\", 1<<20)\n\tif err != nil {\n\t\tfmt.Println(\"error:\", err)\n\t\treturn\n\t}\n\tfmt.Printf(\"%q\\n\", body)\n\n\tbody, err = readLimited(client, srv.URL+\"/big\", 10)\n\tif err != nil {\n\t\tfmt.Println(\"error:\", err)\n\t\treturn\n\t}\n\tfmt.Printf(\"%q\\n\", body)\n}\n",
          "output": "\"hello\\n\"\n\"xxxxxxxxxx\"",
          "explanation": "Replace main.go with this code (or use a new folder); a folder can hold only one main().\n\nreadLimited checks err first, then defers Close, then reads through io.LimitReader. The %q verb prints the string in quotes with the newline shown as \\n. The first call reads the whole 6 byte body. The second call asks for at most 10 bytes of a 100 byte body, so only ten x characters come back."
        }
      ],
      "productionNote": "Always cap how much you read from a remote server, and always close the body, even on error paths where you only look at the status. Leaked bodies show up in production as rising connection counts and 'too many open files' errors.",
      "commonMistakes": [
        "Forgetting resp.Body.Close(), which leaks the connection.",
        "Writing defer resp.Body.Close() before checking err: when err is non-nil, resp is nil and the program panics.",
        "Calling io.ReadAll on resp.Body with no limit, letting a misbehaving server exhaust your memory."
      ],
      "sources": [
        {
          "title": "net/http: type Response",
          "url": "https://pkg.go.dev/net/http#Response"
        },
        {
          "title": "io: func LimitReader",
          "url": "https://pkg.go.dev/io#LimitReader"
        },
        {
          "title": "Go 1.27 Release Notes",
          "url": "https://go.dev/doc/go1.27"
        }
      ]
    },
    {
      "id": "sending-json",
      "title": "Sending JSON",
      "explanation": "Most APIs you call speak JSON (topic 19). Sending JSON takes four steps.\n\nStep 1: turn your Go value into bytes with json.Marshal(in), and check its error. Step 2: wrap the bytes in a reader with bytes.NewReader(b), because a request body must be an io.Reader, and pass it as the last argument of http.NewRequestWithContext with http.MethodPost.\n\nStep 3: set the header `req.Header.Set(\"Content-Type\", \"application/json\")`. A header is a name and value sent along with the request. Content-Type tells the server how to interpret the body; without it many servers refuse the request or treat the body as plain text.\n\nStep 4: send with client.Do, check the error, defer Close, and decode the reply straight from the stream with json.NewDecoder(resp.Body).Decode(&out). Decode needs a pointer (topic 9) so it can fill your struct.\n\nThe example starts a small server with a POST /users route that reads a name and answers 201 Created with the new user. Field names in the structs are linked to the JSON keys by struct tags (topic 19).",
      "analogy": "You fill in a standard order form (your struct), seal it in an envelope labelled 'JSON inside' (the Content-Type header), hand it to the courier, and read the receipt that comes back (the decoded response). If you forget the label, the shop may not know how to read your form.",
      "code": [
        {
          "language": "go",
          "filename": "post.go",
          "source": "package main\n\nimport (\n\t\"bytes\"\n\t\"context\"\n\t\"encoding/json\"\n\t\"fmt\"\n\t\"net/http\"\n\t\"net/http/httptest\"\n\t\"time\"\n)\n\ntype NewUser struct {\n\tName string `json:\"name\"`\n}\n\ntype User struct {\n\tID   int    `json:\"id\"`\n\tName string `json:\"name\"`\n}\n\nfunc main() {\n\tmux := http.NewServeMux()\n\tmux.HandleFunc(\"POST /users\", func(w http.ResponseWriter, r *http.Request) {\n\t\tvar in NewUser\n\t\tif err := json.NewDecoder(r.Body).Decode(&in); err != nil {\n\t\t\thttp.Error(w, \"bad json\", http.StatusBadRequest)\n\t\t\treturn\n\t\t}\n\t\tw.Header().Set(\"Content-Type\", \"application/json\")\n\t\tw.WriteHeader(http.StatusCreated)\n\t\tjson.NewEncoder(w).Encode(User{ID: 1, Name: in.Name})\n\t})\n\tsrv := httptest.NewServer(mux)\n\tdefer srv.Close()\n\n\tclient := &http.Client{Timeout: 10 * time.Second}\n\tctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)\n\tdefer cancel()\n\n\tb, err := json.Marshal(NewUser{Name: \"Ada\"})\n\tif err != nil {\n\t\tfmt.Println(\"marshal failed:\", err)\n\t\treturn\n\t}\n\treq, err := http.NewRequestWithContext(ctx, http.MethodPost, srv.URL+\"/users\", bytes.NewReader(b))\n\tif err != nil {\n\t\tfmt.Println(\"bad request:\", err)\n\t\treturn\n\t}\n\treq.Header.Set(\"Content-Type\", \"application/json\")\n\n\tresp, err := client.Do(req)\n\tif err != nil {\n\t\tfmt.Println(\"request failed:\", err)\n\t\treturn\n\t}\n\tdefer resp.Body.Close()\n\n\tvar out User\n\tif err := json.NewDecoder(resp.Body).Decode(&out); err != nil {\n\t\tfmt.Println(\"decode failed:\", err)\n\t\treturn\n\t}\n\tfmt.Println(resp.StatusCode)\n\tfmt.Println(out.ID, out.Name)\n}\n",
          "output": "201\n1 Ada",
          "explanation": "Replace main.go with this code (or use a new folder); a folder can hold only one main().\n\njson.Marshal produces {\"name\":\"Ada\"}. The request carries it with the Content-Type header set. The server replies 201 and a JSON user, which Decode copies into out. The program prints the status code, then the decoded ID and name."
        }
      ],
      "productionNote": "This is the shape of nearly every call to an internal service, payment provider or webhook endpoint. Check every error along the way, and always decode through a size-limited reader (io.LimitReader) when the remote side is not fully trusted.",
      "commonMistakes": [
        "Forgetting the Content-Type: application/json header, so the server rejects or misreads the body.",
        "Retrying a request with the same bytes.Reader: the reader is already consumed after the first attempt, so build a fresh reader (bytes.NewReader(b)) for each attempt.",
        "Passing a struct value instead of a pointer to Decode, which fails because Decode must modify your variable."
      ],
      "sources": [
        {
          "title": "net/http: type Request",
          "url": "https://pkg.go.dev/net/http#Request"
        },
        {
          "title": "encoding/json: func NewDecoder",
          "url": "https://pkg.go.dev/encoding/json#NewDecoder"
        }
      ]
    },
    {
      "id": "checking-status-codes",
      "title": "Checking status codes",
      "explanation": "client.Do and client.Get return a non-nil error only for transport problems: the connection failed, the timeout passed, the context was cancelled. If the server answered at all, even with 404 Not Found or 500 Internal Server Error, err is nil and you get a normal response. Deciding whether that answer means success is your job.\n\nCheck resp.StatusCode, an int. The standard library has named constants such as http.StatusOK (200) and http.StatusCreated (201). resp.Status is the text form, for example \"404 Not Found\". Do not test only for 200: any code from 200 to 299 is success, and APIs commonly return 201 after creating something or 204 (no content) after a delete.\n\nOn a non-2xx answer, read a small part of the body (use io.LimitReader again), because servers often put an explanation there, and include it in the error you return. Never decode an error page as if it were your success JSON.\n\nA note for later: when a call fails with 5xx (the 500 to 599 server-error status codes) or a transport error you may want to retry, but only if the request is idempotent, meaning that sending it twice has the same effect as sending it once (GET is, a payment POST usually is not). Retrying is only mentioned here as a concept.\n\nIn the example, a helper checkOK turns any non-2xx response into an error value (topic 11), and main calls a route that exists and one that does not.",
      "analogy": "The courier delivered the parcel successfully, so there is no transport error. But the letter inside says 'Application rejected'. Delivery success and the content of the answer are two different things, and you have to open the letter (check the status) before you celebrate.",
      "code": [
        {
          "language": "go",
          "filename": "status.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"io\"\n\t\"net/http\"\n\t\"net/http/httptest\"\n\t\"strings\"\n\t\"time\"\n)\n\nfunc checkOK(resp *http.Response) error {\n\tif resp.StatusCode < 200 || resp.StatusCode > 299 {\n\t\tsnippet, _ := io.ReadAll(io.LimitReader(resp.Body, 512))\n\t\treturn fmt.Errorf(\"unexpected status: %s: %s\", resp.Status, strings.TrimSpace(string(snippet)))\n\t}\n\treturn nil\n}\n\nfunc fetch(client *http.Client, url string) error {\n\tresp, err := client.Get(url)\n\tif err != nil {\n\t\treturn err\n\t}\n\tdefer resp.Body.Close()\n\treturn checkOK(resp)\n}\n\nfunc main() {\n\tmux := http.NewServeMux()\n\tmux.HandleFunc(\"GET /hello\", func(w http.ResponseWriter, r *http.Request) {\n\t\tfmt.Fprintf(w, \"hello\\n\")\n\t})\n\tsrv := httptest.NewServer(mux)\n\tdefer srv.Close()\n\n\tclient := &http.Client{Timeout: 10 * time.Second}\n\n\tfmt.Println(\"hello:\", fetch(client, srv.URL+\"/hello\"))\n\tfmt.Println(fetch(client, srv.URL+\"/nope\"))\n}\n",
          "output": "hello: <nil>\nunexpected status: 404 Not Found: 404 page not found",
          "explanation": "Replace main.go with this code (or use a new folder); a folder can hold only one main().\n\nThe /hello call returns 200, so checkOK returns nil, printed as <nil>. The /nope path has no route, so the mux (topic 21) answers 404 with the body '404 page not found'. Do returned no transport error, but checkOK sees the status is outside 200-299, reads a short snippet of the body and builds an error from resp.Status and that snippet."
        }
      ],
      "productionNote": "Wrap upstream failures into your own error types (topic 11) so callers can tell 'not found' from 'upstream is down' and decide whether to show an error, retry, or give up. Treat the whole 2xx range as success unless an API says otherwise.",
      "commonMistakes": [
        "Assuming err == nil means the request succeeded, then decoding a 404 or 500 error page as if it were valid data.",
        "Treating only 200 as success and failing on valid 201 or 204 answers.",
        "Reading the whole error body without a limit instead of a short snippet."
      ],
      "sources": [
        {
          "title": "net/http: constants (status codes)",
          "url": "https://pkg.go.dev/net/http#pkg-constants"
        },
        {
          "title": "net/http: type Response",
          "url": "https://pkg.go.dev/net/http#Response"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why should production code avoid http.Get and http.DefaultClient?",
      "options": [
        "They have no timeout, so a server that never answers can make your program wait for ever",
        "They only support the GET method and cannot send POST requests",
        "They cannot read response bodies",
        "They always open a new connection and so can never reuse one"
      ],
      "answerIndex": 0,
      "explanation": "http.DefaultClient has Timeout 0, which means no limit. Build your own http.Client with a Timeout. The other options are false: the default client can use any method through Do, can read bodies, and reuses connections."
    },
    {
      "question": "How do you attach a deadline to a single request?",
      "options": [
        "Set the Content-Type header to a time value",
        "Build the request with http.NewRequestWithContext using a context from context.WithTimeout",
        "Call resp.Body.Close() before sending",
        "Use http.StatusRequestTimeout as the method"
      ],
      "answerIndex": 1,
      "explanation": "The context carries the deadline. When it expires or is cancelled, client.Do stops and returns an error wrapping context.DeadlineExceeded or context.Canceled."
    },
    {
      "question": "What must you always do with resp.Body once the error from Do is nil?",
      "options": [
        "Convert it to a string with %q",
        "Decode it as JSON, whatever it contains",
        "Close it, usually with defer resp.Body.Close(), so the connection can be reused",
        "Set its Timeout field"
      ],
      "answerIndex": 2,
      "explanation": "Not closing the body leaks the connection and file descriptors. Reading with a limit is good practice, but closing is the mandatory step."
    },
    {
      "question": "Which header should you set when you POST a JSON body?",
      "options": [
        "Accept-Language: json",
        "Content-Length: json",
        "Content-Type: application/json",
        "Host: application/json"
      ],
      "answerIndex": 2,
      "explanation": "Content-Type tells the server the body is JSON. The other headers have different, unrelated meanings."
    },
    {
      "question": "A server answers your request with 404 Not Found. What does client.Do return?",
      "options": [
        "A nil response and a non-nil error",
        "A non-nil error, and a response that must be ignored",
        "A panic, because 404 is a fatal condition",
        "A normal response and err == nil; you must check resp.StatusCode yourself"
      ],
      "answerIndex": 3,
      "explanation": "Do returns an error only for transport problems such as a failed connection or timeout. Any answer from the server, including 404 and 500, comes back with err == nil."
    }
  ]
});
