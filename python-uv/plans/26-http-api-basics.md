# 26. HTTP & Web API Basics
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 14-files-paths-data, 16-dataclasses-enums

## Learning goals
- After this topic, learner can describe client, server, request and response.
- After this topic, learner can pick the right HTTP method for an action.
- After this topic, learner can read common status codes (2xx/4xx/5xx) with `http.HTTPStatus`.
- After this topic, learner can split a URL into path and query string with `urllib.parse`.
- After this topic, learner can explain JSON bodies and headers like `Content-Type`.
- After this topic, learner can design REST-style paths for a resource.

## Sub-topics
### Clients, servers, requests and responses
- Concept: Web API (Application Programming Interface) = a program other programs talk to over the network. Client (browser, app, script) sends a request; server receives it, runs code, sends a response. HTTP (HyperText Transfer Protocol) = the rules for that conversation. Request = method + URL + headers + optional body. Response = status code + headers + optional body. All examples here are offline simulations (no network).
- Analogy: Restaurant: customer (client) orders from the waiter, kitchen (server) prepares, waiter returns the dish or "sorry, not on the menu".
- Code example: `fake_server.py` — `def server(method: str, path: str) -> tuple[int, dict[str, str]]:` `if method == "GET" and path == "/hello": return 200, {"message": "hi"}`; `return 404, {"detail": "Not Found"}`; `print(server("GET", "/hello"))`; `print(server("GET", "/nope"))`; output `(200, {'message': 'hi'})\n(404, {'detail': 'Not Found'})`. Note: FastAPI answers unknown paths with exactly `{"detail": "Not Found"}`.
- Production use: Every web/mobile app talks to backends this way; services talk to each other this way.
- Common mistakes: Thinking the browser is the only client; mixing up the request (what you send) and the response (what you get back).
- Sources: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Messages

### HTTP methods
- Concept: Method = verb saying what to do. GET read (no body, no change), POST create, PUT replace whole thing, PATCH change some fields, DELETE remove. Safe = doesn't change data (GET). Idempotent = repeating gives same result (GET, PUT, DELETE; not POST).
- Analogy: Library desk: GET = look at a book, POST = donate a new book, PUT = swap the book for a new edition, PATCH = fix a typo on one page, DELETE = remove it from the shelf.
- Code example: `methods.py` — `actions = {"GET": "read", "POST": "create", "PUT": "replace", "PATCH": "update part", "DELETE": "remove"}`; `for method, action in actions.items(): print(f"{method} -> {action}")`; output `GET -> read\nPOST -> create\nPUT -> replace\nPATCH -> update part\nDELETE -> remove`.
- Production use: Every API route is a method + path pair.
- Common mistakes: Changing data with GET (crawlers/prefetch can trigger it); using POST for everything.
- Sources: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods ; https://www.rfc-editor.org/rfc/rfc9110#name-methods

### Status codes
- Concept: Three-digit number summarising the result. 2xx success (200 OK, 201 Created, 204 No Content), 4xx client's fault (400 Bad Request, 401 not logged in, 403 not allowed, 404 Not Found, 422 data failed validation — FastAPI uses it), 5xx server's fault (500 Internal Server Error). `http.HTTPStatus` (stdlib enum) gives names and phrases.
- Analogy: Parcel tracking stamps: "delivered", "wrong address — your mistake", "depot on fire — our mistake".
- Code example: `status_codes.py` — `from http import HTTPStatus`; `for code in (200, 201, 204, 400, 401, 403, 404, 500): print(code, HTTPStatus(code).phrase)`; `print(HTTPStatus.NOT_FOUND.value)`; `print(HTTPStatus(404).is_client_error)`; output `200 OK\n201 Created\n204 No Content\n400 Bad Request\n401 Unauthorized\n403 Forbidden\n404 Not Found\n500 Internal Server Error\n404\nTrue`. Do NOT put 422 in the code (its enum name/phrase changed across Python versions); mention it in prose only.
- Production use: Clients branch on status codes; monitoring alerts on 5xx rates.
- Common mistakes: Returning 200 with an error message in the body; using 500 for bad user input (should be 4xx).
- Sources: https://docs.python.org/3/library/http.html#http.HTTPStatus ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status

### URLs, paths and query strings
- Concept: URL parts: scheme (`https`), host (`api.example.com`), path (`/books/7` — identifies the thing), query string after `?` (`key=value` pairs joined by `&` — options like filters, paging). Repeated keys allowed. `urllib.parse.urlsplit`, `parse_qs`, `urlencode` (spaces become `+`).
- Analogy: Postal address: city = host, street + house number = path, delivery note ("leave at back door") = query string.
- Code example: `urls.py` — `from urllib.parse import urlsplit, parse_qs, urlencode`; `parts = urlsplit("https://api.example.com/books/7?format=json&tag=py&tag=web")`; `print(parts.scheme, parts.netloc, parts.path)`; `print(parse_qs(parts.query))`; `print(urlencode({"q": "fast api", "page": 2}))`; output `https api.example.com /books/7\n{'format': ['json'], 'tag': ['py', 'web']}\nq=fast+api&page=2`.
- Production use: Routing (path → handler), pagination and search parameters.
- Common mistakes: Putting secrets in query strings (they land in logs); building query strings by hand without encoding.
- Sources: https://docs.python.org/3/library/urllib.parse.html#urllib.parse.urlsplit ; https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Web_mechanics/What_is_a_URL

### JSON bodies and headers
- Concept: Body = the data payload; APIs mostly use JSON (recap topic 14). Headers = labelled metadata: `Content-Type: application/json` (what the body is), `Accept` (what the client wants back), `Authorization` (credentials, topic 33). Header names are case-insensitive. Body is sent as bytes.
- Analogy: Parcel: the box contents = body; the shipping label (sender, "fragile", contents type) = headers.
- Code example: `json_body.py` — `import json`; `headers = {"Content-Type": "application/json", "Accept": "application/json"}`; `body = json.dumps({"title": "Dune", "year": 1965})`; `print(headers["Content-Type"])`; `print(body)`; `print(len(body.encode("utf-8")))`; `print(json.loads(body)["year"] + 1)`; output `application/json\n{"title": "Dune", "year": 1965}\n31\n1966`. Explain 31 = number of bytes (what a `Content-Length` header would say).
- Production use: Every JSON API request/response.
- Common mistakes: Sending JSON without `Content-Type: application/json`; Python `True`/`None` vs JSON `true`/`null` confusion.
- Sources: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Type

### REST resource design
- Concept: REST style = URLs name things (nouns, plural), methods say the action. Collection `/books`, single item `/books/{id}`. Typical CRUD map: GET /books list, POST /books create, GET /books/{id} read, PATCH /books/{id} update, DELETE /books/{id} delete. Nest only one level (`/authors/{id}/books`). Avoid verbs in paths (`/getBooks`).
- Analogy: A street of filing drawers: drawer label = collection, card number = id; the verb is what you do at the drawer, not written on the label.
- Code example: `routes.py` — `routes = [("GET", "/books", "list books"), ("POST", "/books", "create a book"), ("GET", "/books/{id}", "read one book"), ("PATCH", "/books/{id}", "update a book"), ("DELETE", "/books/{id}", "delete a book")]`; `for method, path, action in routes: print(f"{method:<7}{path:<12}{action}")`; output exactly `GET    /books      list books\nPOST   /books      create a book\nGET    /books/{id} read one book\nPATCH  /books/{id} update a book\nDELETE /books/{id} delete a book`. (`:<7` = pad to 7 chars, recap topic 04.)
- Production use: Public and internal APIs; consistent URLs make docs and clients simpler.
- Common mistakes: Verbs in URLs; singular/plural mixing (`/book/1` and `/books`).
- Sources: https://developer.mozilla.org/en-US/docs/Glossary/REST ; https://www.rfc-editor.org/rfc/rfc9110#name-method-definitions

## Quiz
1. Which method to change only a book's year? — tests PATCH vs PUT
2. What does 404 mean, and whose fault is a 4xx? — tests status classes
3. In `/books/7?format=json`, what is the path and what is the query string? — tests URL parts
4. What header says "the body is JSON"? — tests Content-Type
5. Why is `GET /deleteBook?id=3` bad design? — tests REST + safe methods
