# 22. HTTP Clients
Version: Go 1.27.4
Prerequisites: 21-http-server

## Learning goals
- learner can create a reusable http.Client with a timeout
- learner can build requests bound to a context
- learner can read, limit and close response bodies
- learner can send and receive JSON
- learner can treat non-2xx status codes as errors

## Sub-topics
### http.Client and timeouts
- Concept: `client := &http.Client{Timeout: 10 * time.Second}` created once and reused (keeps connections alive); `http.Get` / `http.DefaultClient` have no timeout → a slow server can hang you forever.
- Analogy: hiring one courier company on contract with a delivery deadline, instead of a random stranger with no deadline for each parcel.
- Code example: client.go — `client := &http.Client{Timeout: 10 * time.Second}`; `resp, err := client.Get("http://localhost:8080/hello")` against topic 21's server; print `resp.StatusCode` → `200`
- Production use: one client per service dependency, shared across goroutines (safe for concurrent use).
- Common mistakes: new Client per request; no timeout.
- Sources: https://pkg.go.dev/net/http#Client ; https://pkg.go.dev/net/http#hdr-Clients_and_Transports

### Requests with context
- Concept: `req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)`; `resp, err := client.Do(req)`; ctx cancel/timeout aborts the call (topic 17); pass the incoming request's ctx when calling from a handler.
- Analogy: phone call with a kitchen timer — when it rings, you hang up wherever the conversation is.
- Code example: ctxreq.go — ctx with 2s timeout; GET localhost:8080/hello → status `200`; against an unreachable port (`localhost:9`) the printed error contains `connect` / `refused` (say exact text varies by OS)
- Production use: request-scoped deadlines propagate to downstream calls.
- Common mistakes: `http.NewRequest` (no ctx) inside handlers; ignoring the error from NewRequestWithContext.
- Sources: https://pkg.go.dev/net/http#NewRequestWithContext ; https://pkg.go.dev/net/http#Client.Do

### Reading and closing response bodies
- Concept: after err == nil always `defer resp.Body.Close()`; read with `io.ReadAll(io.LimitReader(resp.Body, 1<<20))` to cap size; Go 1.27: closing an HTTP/1 body drains unread content (up to a limit) so the connection can be reused (per https://go.dev/doc/go1.27).
- Analogy: hang up the phone when done so the line is free for the next caller.
- Code example: body.go — read /hello body → `fmt.Printf("%q\n", body)` → `"hello\n"`
- Production use: avoiding connection/file-descriptor leaks under load.
- Common mistakes: forgetting Close; closing before checking err (resp is nil → panic); unbounded ReadAll.
- Sources: https://pkg.go.dev/net/http#Response ; https://pkg.go.dev/io#LimitReader ; https://go.dev/doc/go1.27

### Sending JSON
- Concept: `b, _ := json.Marshal(in)`; `req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))`; `req.Header.Set("Content-Type", "application/json")`; decode response with `json.NewDecoder(resp.Body).Decode(&out)`.
- Analogy: filling a standard order form, sealing it in an envelope labelled "JSON inside", and reading the receipt that comes back.
- Code example: post.go — POST `{"name":"Ada"}` to topic 21's `localhost:8080/users` → status `201`, decoded `out.ID, out.Name` → `1 Ada`
- Production use: calling internal services, payment/webhook APIs.
- Common mistakes: missing Content-Type; reusing a consumed body reader on retry.
- Sources: https://pkg.go.dev/net/http#Request ; https://pkg.go.dev/encoding/json#NewDecoder

### Checking status codes
- Concept: `client.Do` returns err only for transport problems; 404/500 come back with err == nil; check `resp.StatusCode` (constants `http.StatusOK`, `http.StatusCreated`), `resp.Status` = "404 Not Found"; read a small part of the error body for messages; retry only idempotent requests on 5xx (concept only).
- Analogy: courier delivered the parcel successfully (no transport error) — but the letter inside says "rejected".
- Code example: status.go — GET localhost:8080/nope (no route) → `if resp.StatusCode != http.StatusOK { return fmt.Errorf("unexpected status: %s", resp.Status) }` → error prints `unexpected status: 404 Not Found`
- Production use: mapping upstream errors to your own error types (topic 11).
- Common mistakes: decoding an error page as success JSON; treating only 200 as success when 201/204 are valid.
- Sources: https://pkg.go.dev/net/http#pkg-constants ; https://pkg.go.dev/net/http#Response

## Quiz
1. Why not use http.Get in production? — tests timeouts
2. How do you attach a deadline to one request? — tests context
3. What must you always do with resp.Body? — tests Close
4. Header needed when POSTing JSON — tests Content-Type
5. Does a 404 produce a non-nil err from Do? — tests status codes
