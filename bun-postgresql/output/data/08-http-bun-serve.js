window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "08-http-bun-serve",
  "order": 8,
  "title": "HTTP Servers with Bun.serve",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "You will start a real HTTP server with Bun.serve and read the Request that arrives (its method, URL, headers and JSON body). You will build Response objects with correct status codes, define a routes table with per-method handlers and path parameters, and return one consistent JSON shape for errors, including 404 and 500. Everything is tested with curl, a command-line program that sends HTTP requests.",
  "prerequisites": ["07-config-environment"],
  "subtopics": [
    {
      "id": "bun-serve-fetch-handler",
      "title": "Bun.serve and the fetch handler",
      "explanation": "A server is a program that waits for requests and answers them. In Bun you start one with `Bun.serve({ port, fetch })`. The `port` is a number that works like a numbered door on your computer: a client that wants to talk to your program must knock on the right door. The `fetch` property is a function (a handler: a function that handles one request). Bun calls it once for every incoming request, passing a `Request` object. The function must return a `Response` object, or a `Promise<Response>` (a Response that arrives later) if the handler is `async`.\n\n`Bun.serve` returns a `server` object. Two useful properties are `server.port` (the port it is really listening on) and `server.url` (a `URL` object, a parsed web address; printing it in a template literal gives text such as `http://localhost:3000/`, ending with a slash). The host part of that text can differ from machine to machine, so do not depend on its exact spelling.\n\nIf you leave `port` out, Bun looks at the environment variables `BUN_PORT`, then `PORT`, then `NODE_PORT`, and finally falls back to 3000. In this course you always pass the port explicitly, taken from the config object you built in the previous topic, so the port never depends on a hidden default.\n\n`port: 0` asks the operating system for any free port. That is handy in automated tests, where several servers must not collide. The `hostname` option says which network address to accept connections on; it defaults to `\"0.0.0.0\"`, which means every network interface of the machine.\n\nThe program does not exit while a server is running, because the server keeps waiting for requests. Press Ctrl+C in the terminal to stop it. The course layout keeps the server creation in `src/server.ts`, in a function `createServer(port)` that returns the server. `src/index.ts` is the entry point: it loads the config, calls `createServer` and prints the address.\n\nTo try it, open two terminals in your project folder (the folder that contains `package.json`). In the first, start the server with `bun run src/index.ts`. In the second, run the `curl` command. `curl` sends a request and prints the response body. Leave the first terminal running.",
      "analogy": "Think of a shop with a front door and a receptionist. `Bun.serve` opens the shop at an address: the port is the door number. The `fetch` function is the receptionist who greets every single visitor and hands back an answer. The server object is the shop sign, telling you where the door is. The shop stays open until the owner locks up with Ctrl+C.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/server.ts",
          "source": "export function createServer(port: number) {\n  return Bun.serve({\n    port,\n    fetch(req) {\n      return new Response(\"orders-api is running\");\n    },\n  });\n}\n",
          "output": "",
          "explanation": "createServer starts the server and returns it. The fetch handler ignores the request and answers every one with the same text. Nothing is printed by this file itself, because it only defines the function."
        },
        {
          "language": "typescript",
          "filename": "src/index.ts",
          "source": "import { config } from \"./config.ts\";\nimport { createServer } from \"./server.ts\";\n\nconst server = createServer(config.port);\nconsole.log(`listening on ${server.url}`);\n",
          "output": "listening on http://localhost:3000/",
          "explanation": "config comes from the previous topic: it was validated once at import time. This output assumes your config port is 3000. The program then keeps running and waiting for requests."
        },
        {
          "language": "bash",
          "filename": "curl-check.sh",
          "source": "curl http://localhost:3000/anything",
          "output": "orders-api is running",
          "explanation": "Run this in a second terminal while the server runs. The path /anything does not matter, because the fetch handler answers every request the same way."
        },
        {
          "language": "typescript",
          "filename": "port-zero.ts",
          "source": "const server = Bun.serve({\n  port: 0,\n  fetch() {\n    return new Response(\"hi\");\n  },\n});\n\nconsole.log(server.port > 0);\nconsole.log(server.url.protocol);\nawait server.stop();\n",
          "output": "true\nhttp:",
          "explanation": "With port 0 the operating system picks a free port, so server.port holds the real number (always above 0). server.url.protocol is the part of the address before the double slash. server.stop() shuts the server down, so this script exits by itself."
        }
      ],
      "productionNote": "Run one server per process, and put several processes behind a load balancer (a program that spreads incoming requests over several copies of your server) when you need to scale. Always pass the port explicitly from validated config instead of relying on the default chain.",
      "commonMistakes": [
        "Starting a second server on a port that is taken. Bun fails with an error whose code is EADDRINUSE (\"address already in use\"). Stop the old process with Ctrl+C or choose another port.",
        "Writing a fetch handler that forgets to return a Response (for example, calling `new Response(...)` on its own line without `return`). The handler then returns undefined and the request fails.",
        "Expecting the program to end after Bun.serve. It keeps running until you stop it, which is exactly what a server should do."
      ],
      "sources": [
        { "title": "Bun docs: HTTP server", "url": "https://bun.com/docs/api/http" },
        { "title": "Bun docs: Routing", "url": "https://bun.com/docs/runtime/http/routing" }
      ]
    },
    {
      "id": "request-and-response",
      "title": "Request and Response objects",
      "explanation": "`Request` and `Response` are web-standard classes (templates for objects) that exist in browsers and in Bun, so what you learn here applies widely. The handler receives a `Request` and returns a `Response`.\n\nA Request gives you: `req.method` (the HTTP method as text, such as `\"POST\"`), `req.url` (the full address as one string), and `req.headers`, a collection where `req.headers.get(\"content-type\")` returns the header value or `null` if it is missing. Header names are not case sensitive.\n\nThe body is the data sent with the request. `await req.json()` reads it and parses it as JSON (turns the text into a JavaScript value). `await req.text()` reads it as plain text. Both return a Promise, so you need `await`. If the text is not valid JSON, `req.json()` throws a `SyntaxError`. Topic 19 teaches how to handle that properly. A body can be read only once: after the first read it is used up.\n\nTo answer, create `new Response(body, { status, headers })`. The `status` is the numeric result code, and `headers` is an object of header names and values. The shortcut `Response.json(data, { status: 201 })` turns data into JSON text and sets the `Content-Type: application/json` header for you. The status `405` used below means \"method not allowed\".\n\nThe third example below shows the read-once rule without any server: a Response has the same body methods and a `bodyUsed` flag.",
      "analogy": "A request is a letter in an envelope. The envelope carries notes about the sender and the contents (the headers), and the letter itself (the body) can be unfolded only once: after you have read it, you cannot read it again. Your reply is another letter, and the status code is the grade stamped on top: 200 for fine, 405 for \"wrong kind of request\".",
      "code": [
        {
          "language": "typescript",
          "filename": "echo.ts",
          "source": "const server = Bun.serve({\n  port: 3000,\n  async fetch(req) {\n    if (req.method === \"POST\") {\n      const body = await req.json();\n      return Response.json(\n        { received: body, contentType: req.headers.get(\"content-type\") },\n        { status: 200 },\n      );\n    }\n    return new Response(\"send a POST\", { status: 405 });\n  },\n});\nconsole.log(`echo listening on ${server.url}`);\n",
          "output": "echo listening on http://localhost:3000/",
          "explanation": "A scratch file (not part of the course project). The handler is async because it awaits the body. POST requests get their JSON echoed back together with the Content-Type header they sent. Any other method gets the text and status 405. Start it with bun run echo.ts."
        },
        {
          "language": "bash",
          "filename": "curl-echo.sh",
          "source": "curl -X POST http://localhost:3000/ -H \"Content-Type: application/json\" -d '{\"productId\":7,\"quantity\":2}'\ncurl -s -o /dev/null -w \"%{http_code}\\n\" http://localhost:3000/",
          "output": "{\"received\":{\"productId\":7,\"quantity\":2},\"contentType\":\"application/json\"}\n405",
          "explanation": "In curl, -X sets the method, -H adds a header and -d gives the request body. In the second command, -s hides progress output, -o /dev/null throws the body away, and -w \"%{http_code}\\n\" prints only the status code. A plain GET gets 405."
        },
        {
          "language": "typescript",
          "filename": "body-once.ts",
          "source": "const res = new Response(JSON.stringify({ ok: true }), { status: 201 });\nconsole.log(res.status);\nconsole.log(res.bodyUsed);\nconsole.log(await res.json());\nconsole.log(res.bodyUsed);\n",
          "output": "201\nfalse\n{ ok: true }\ntrue",
          "explanation": "bodyUsed starts as false and becomes true after the body is read. Calling res.json() or res.text() a second time would throw an error. Read the body once, store the result in a variable and reuse the variable."
        }
      ],
      "productionNote": "Every handler in the API follows this shape: read the Request, do the work, return a Response. Keep that shape and later layers (validation, services) plug in easily.",
      "commonMistakes": [
        "Reading the body twice (for example `await req.json()` and then `await req.text()`). The second read fails because the body is already used.",
        "Forgetting `await` on `req.json()`. You then hold a Promise instead of the data.",
        "Returning a plain object like `{ ok: true }` from the handler. A handler must return a Response; use `Response.json(...)`."
      ],
      "sources": [
        { "title": "MDN: Request", "url": "https://developer.mozilla.org/en-US/docs/Web/API/Request" },
        { "title": "MDN: Response.json() static method", "url": "https://developer.mozilla.org/en-US/docs/Web/API/Response/json_static" },
        { "title": "Bun docs: HTTP server", "url": "https://bun.com/docs/api/http" }
      ]
    },
    {
      "id": "routes-object",
      "title": "The routes object and per-method handlers",
      "explanation": "One `fetch` function with a pile of `if` statements gets messy fast. Bun offers a `routes` option instead. A route is a rule that connects a path (and optionally a method) to a handler. The `routes` object uses paths as keys. The value can be a static `Response` (the same answer every time, such as `\"/health\": new Response(\"OK\")`), a handler function, or an object with one handler per HTTP method, such as `{ GET: handler, POST: handler }`.\n\nWhen several routes could match a request, Bun picks the most specific one. The order is: an exact path first (`/orders/recent`), then a path with a parameter (`/orders/:id`), then a prefix wildcard (`/orders/*`), then the global catch-all (`/*`). The `fetch` function is still there as the fallback for any request that no route matched. Always list the methods you support.\n\nTo keep a growing API readable, split routes per feature. Each file in `src/routes/` exports a plain object, and `src/server.ts` merges them with the spread syntax (`...`). In this topic the orders live in an in-memory array, which is just a variable inside your running program. Later topics replace it with PostgreSQL. The `as` in the POST handler is a type assertion, meaning you tell TypeScript to trust you about the shape. It checks nothing at runtime, so topic 19 replaces it with real validation.",
      "analogy": "A building directory in a lobby. The floor list (the routes) sends each visitor to the right office. Within an office, there are separate windows: one for \"pick up\" (GET) and one for \"drop off\" (POST), which are the per-method handlers. The most specific sign wins: if a visitor asks for \"Room 5 on floor 2\", they go there rather than to the general floor desk. Visitors who are not on any list go to the help desk, which is the fetch fallback.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/routes/health.routes.ts",
          "source": "export const healthRoutes = {\n  \"/health\": new Response(\"OK\"),\n};\n",
          "output": "",
          "explanation": "A static route: the Response is created once and returned for every request to /health."
        },
        {
          "language": "typescript",
          "filename": "src/routes/orders.routes.ts",
          "source": "type Order = {\n  id: string;\n  productId: number;\n  quantity: number;\n  status: \"pending\";\n};\n\nconst orders: Order[] = [];\nlet nextId = 1;\n\nexport const ordersRoutes = {\n  \"/orders\": {\n    GET: () => Response.json(orders),\n    POST: async (req: Request) => {\n      const body = (await req.json()) as { productId: number; quantity: number };\n      const order: Order = {\n        id: String(nextId++),\n        productId: body.productId,\n        quantity: body.quantity,\n        status: \"pending\",\n      };\n      orders.push(order);\n      return Response.json(order, { status: 201 });\n    },\n  },\n};\n",
          "output": "",
          "explanation": "One path with two handlers. POST builds an order with the next id (as text) and stores it in the array. nextId++ uses the current value and then adds one. Status 201 means Created. The data is lost when the server restarts."
        },
        {
          "language": "typescript",
          "filename": "src/server.ts",
          "source": "import { healthRoutes } from \"./routes/health.routes.ts\";\nimport { ordersRoutes } from \"./routes/orders.routes.ts\";\n\nexport function createServer(port: number) {\n  return Bun.serve({\n    port,\n    routes: { ...healthRoutes, ...ordersRoutes },\n    fetch() {\n      return new Response(\"not found\", { status: 404 });\n    },\n  });\n}\n",
          "output": "",
          "explanation": "The feature route objects are merged into one table. The fetch function now only runs for requests that match no route, and answers 404 (not found)."
        },
        {
          "language": "bash",
          "filename": "curl-routes.sh",
          "source": "curl -s -w \"\\n\" http://localhost:3000/health\ncurl -s -w \"\\n%{http_code}\\n\" -X POST http://localhost:3000/orders -H \"Content-Type: application/json\" -d '{\"productId\":7,\"quantity\":2}'\ncurl -s -w \"\\n\" http://localhost:3000/orders\ncurl -s -w \"\\n%{http_code}\\n\" http://localhost:3000/nope",
          "output": "OK\n{\"id\":\"1\",\"productId\":7,\"quantity\":2,\"status\":\"pending\"}\n201\n[{\"id\":\"1\",\"productId\":7,\"quantity\":2,\"status\":\"pending\"}]\nnot found\n404",
          "explanation": "Start the server with bun run src/index.ts first. The -w option appends a newline and the status code after each body so the output is easy to read. The last request matches no route, so the fetch fallback answers."
        },
        {
          "language": "typescript",
          "filename": "routes-precedence.ts",
          "source": "const server = Bun.serve({\n  port: 3000,\n  routes: {\n    \"/orders/recent\": new Response(\"exact\"),\n    \"/orders/:id\": (req) => new Response(`param ${req.params.id}`),\n    \"/orders/*\": new Response(\"prefix\"),\n    \"/*\": new Response(\"catch-all\"),\n  },\n});\nconsole.log(`listening on ${server.url}`);\n",
          "output": "listening on http://localhost:3000/",
          "explanation": "A scratch file that shows the precedence rule. The :id route is a parameter route, which matches exactly one path segment (the text between two slashes)."
        },
        {
          "language": "bash",
          "filename": "curl-precedence.sh",
          "source": "curl -s -w \"\\n\" http://localhost:3000/orders/recent\ncurl -s -w \"\\n\" http://localhost:3000/orders/42\ncurl -s -w \"\\n\" http://localhost:3000/orders/42/items\ncurl -s -w \"\\n\" http://localhost:3000/other",
          "output": "exact\nparam 42\nprefix\ncatch-all",
          "explanation": "/orders/recent matches an exact route, so it beats :id. /orders/42 matches the parameter route. /orders/42/items has two segments after /orders, so only the prefix wildcard fits. /other falls to the global catch-all."
        }
      ],
      "productionNote": "The routes table doubles as a readable map of your whole API: a new teammate can see every path and method in one place. Group routes per feature file and merge them in one spot.",
      "commonMistakes": [
        "Expecting data in an in-memory array to survive a restart. It does not, which is exactly why this course moves to PostgreSQL later.",
        "Trusting the `as` type assertion on request bodies. A client can send anything, and the cast does not check it.",
        "Assuming the order of keys in the routes object decides which route wins. Bun uses the specificity order (exact, parameter, prefix wildcard, catch-all), not the order you wrote them."
      ],
      "sources": [
        { "title": "Bun docs: Routing", "url": "https://bun.com/docs/runtime/http/routing" },
        { "title": "Bun docs: HTTP server", "url": "https://bun.com/docs/api/http" }
      ]
    },
    {
      "id": "path-params-query-strings",
      "title": "Path params (req.params) and query strings",
      "explanation": "Two parts of a web address carry input. A path parameter is a piece of the path itself, such as the `42` in `/orders/42`. You declare it in the route with a colon: `\"/orders/:id\"`. Inside the handler, `req.params.id` holds the value. Path params are always strings, even if they look like numbers.\n\nWhen the handler is written inline under a literal key, TypeScript knows the param names from the path.\n\nFor a handler written separately, give the request the type `BunRequest<\"/orders/:id\">`. `BunRequest` is Bun's Request type with a `params` property, and the part in angle brackets (a type parameter) tells it which path to read the names from. You import it with `import type { BunRequest } from \"bun\"`.\n\nA query string is the optional part after a `?`, made of `name=value` pairs joined with `&`, for example `?status=paid&limit=10`. Parse it with `new URL(req.url).searchParams`. Calling `.get(\"limit\")` returns a string, or `null` if that name is absent. Convert numbers yourself with `Number(...)`, and supply defaults with `??`.\n\nThe first example below runs on its own and shows these calls. The second is the updated orders routes file: `GET /orders` accepts an optional `limit` (default 20), and `GET /orders/:id` returns one order or a 404 JSON error. For a quick look, `limit=abc` becomes `NaN`, which gives an empty list; proper checks of such input come in topic 19.",
      "analogy": "A postal address. The path parameter is the flat number written in the address itself (`/orders/42`): it says which thing you want. The query string is a sticky note on the envelope with extra preferences (`?status=paid&limit=10`): how you would like the answer, and it can be left off.",
      "code": [
        {
          "language": "typescript",
          "filename": "url-demo.ts",
          "source": "const url = new URL(\"http://localhost:3000/orders?status=paid&limit=10\");\nconsole.log(url.pathname);\nconsole.log(url.searchParams.get(\"status\"));\nconsole.log(Number(url.searchParams.get(\"limit\") ?? \"20\"));\nconsole.log(url.searchParams.get(\"page\"));\n",
          "output": "/orders\npaid\n10\nnull",
          "explanation": "pathname is the path without the query. status comes back as the text paid. limit is converted to the number 10. page is not in the address, so get returns null."
        },
        {
          "language": "typescript",
          "filename": "src/routes/orders.routes.ts",
          "source": "import type { BunRequest } from \"bun\";\n\ntype Order = {\n  id: string;\n  productId: number;\n  quantity: number;\n  status: \"pending\";\n};\n\nconst orders: Order[] = [];\nlet nextId = 1;\n\nexport const ordersRoutes = {\n  \"/orders\": {\n    GET: (req: Request) => {\n      const limit = Number(new URL(req.url).searchParams.get(\"limit\") ?? \"20\");\n      return Response.json(orders.slice(0, limit));\n    },\n    POST: async (req: Request) => {\n      const body = (await req.json()) as { productId: number; quantity: number };\n      const order: Order = {\n        id: String(nextId++),\n        productId: body.productId,\n        quantity: body.quantity,\n        status: \"pending\",\n      };\n      orders.push(order);\n      return Response.json(order, { status: 201 });\n    },\n  },\n  \"/orders/:id\": {\n    GET: (req: BunRequest<\"/orders/:id\">) => {\n      const order = orders.find((o) => o.id === req.params.id);\n      if (!order) {\n        return Response.json(\n          { error: { code: \"NOT_FOUND\", message: `order ${req.params.id} not found` } },\n          { status: 404 },\n        );\n      }\n      return Response.json(order);\n    },\n  },\n};\n",
          "output": "",
          "explanation": "orders.slice(0, limit) returns the first limit items. The order ids are strings, so they are compared with req.params.id, also a string, using ===. A missing order gives a 404 with a JSON error body."
        },
        {
          "language": "bash",
          "filename": "curl-params.sh",
          "source": "curl -s -o /dev/null -X POST http://localhost:3000/orders -H \"Content-Type: application/json\" -d '{\"productId\":7,\"quantity\":2}'\ncurl -s -o /dev/null -X POST http://localhost:3000/orders -H \"Content-Type: application/json\" -d '{\"productId\":9,\"quantity\":1}'\ncurl -s -w \"\\n\" http://localhost:3000/orders/1\ncurl -s -w \"\\n%{http_code}\\n\" http://localhost:3000/orders/99\ncurl -s -w \"\\n\" \"http://localhost:3000/orders?limit=1\"",
          "output": "{\"id\":\"1\",\"productId\":7,\"quantity\":2,\"status\":\"pending\"}\n{\"error\":{\"code\":\"NOT_FOUND\",\"message\":\"order 99 not found\"}}\n404\n[{\"id\":\"1\",\"productId\":7,\"quantity\":2,\"status\":\"pending\"}]",
          "explanation": "Restart the server first so the array is empty. The first two commands create two orders and print nothing. The quotes around the last URL stop the shell from treating the ? specially. With limit=1 only the first order comes back."
        }
      ],
      "productionNote": "Real APIs use path params to identify one resource (`/orders/:id`) and query params for filtering and pagination, which topic 17 builds on.",
      "commonMistakes": [
        "Treating `req.params.id` as a number. It is always a string, so comparing it with a number using `===` never matches.",
        "Forgetting that a missing query parameter gives `null`, not an empty string or 0. Use `??` to provide a default.",
        "Forgetting to convert query values with `Number(...)` before doing arithmetic or `slice`."
      ],
      "sources": [
        { "title": "Bun docs: Routing", "url": "https://bun.com/docs/runtime/http/routing" },
        { "title": "MDN: URLSearchParams.get()", "url": "https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/get" }
      ]
    },
    {
      "id": "json-bodies-status-codes-headers",
      "title": "JSON bodies, status codes and headers",
      "explanation": "Clients (browsers, mobile apps, other servers) decide what to do from the status code before they read the body, so the codes must be stable. This course uses: 200 OK (a read or update worked), 201 Created (a new thing was made), 204 No Content (success with an empty body, used for delete), 400 Bad Request (the input is wrong, including validation failures), 401 (not logged in), 403 (logged in but not allowed), 404 (not found), 409 Conflict (clashes with existing data), and 500 (a bug on the server). The course uses 400 for validation errors rather than 422, so every bad-input case looks the same.\n\nFor errors, use one JSON shape everywhere: `{ \"error\": { \"code\": \"...\", \"message\": \"...\" } }`. The `code` is a short constant that programs can test, and `message` is text for humans. Two small helpers in `src/http.ts` make this automatic. A helper is a small function you reuse instead of repeating code. `json(data, status = 200, headers?)` builds a JSON response, and `errorResponse(status, code, message)` builds the error shape. `HeadersInit` is the built-in type meaning \"anything accepted as headers\", such as an object of name and value pairs.\n\nA 201 response should also tell the client where the new thing lives, with a `Location` header such as `Location: /orders/1`. A 204 response must have no body, so use `new Response(null, { status: 204 })`.\n\nBelow, the orders routes now use the helpers, validate the quantity, set `Location`, and add a DELETE handler. `splice(index, 1)` removes one item at that position from the array. The `findIndex` method is like `find` but returns the position, or -1 when nothing matches.",
      "analogy": "Report-card grades. The status code is the grade on the top line: a reader sees A or F before reading the teacher's comments (the body). The error shape is the school's standard comment form: every teacher fills in the same boxes, so every parent knows where to look.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/http.ts",
          "source": "export function json(\n  data: unknown,\n  status = 200,\n  headers?: HeadersInit,\n): Response {\n  return Response.json(data, { status, headers });\n}\n\nexport function errorResponse(\n  status: number,\n  code: string,\n  message: string,\n): Response {\n  return Response.json({ error: { code, message } }, { status });\n}\n",
          "output": "",
          "explanation": "json defaults to status 200 and accepts optional headers. errorResponse always produces the same error shape. unknown is the type for \"any value\" that we only pass along."
        },
        {
          "language": "typescript",
          "filename": "src/routes/orders.routes.ts",
          "source": "import type { BunRequest } from \"bun\";\nimport { errorResponse, json } from \"../http.ts\";\n\ntype Order = {\n  id: string;\n  productId: number;\n  quantity: number;\n  status: \"pending\";\n};\n\nconst orders: Order[] = [];\nlet nextId = 1;\n\nexport const ordersRoutes = {\n  \"/orders\": {\n    GET: (req: Request) => {\n      const limit = Number(new URL(req.url).searchParams.get(\"limit\") ?? \"20\");\n      return json(orders.slice(0, limit));\n    },\n    POST: async (req: Request) => {\n      const body = (await req.json()) as { productId: number; quantity: number };\n      if (!Number.isInteger(body.quantity) || body.quantity <= 0) {\n        return errorResponse(\n          400,\n          \"VALIDATION_ERROR\",\n          \"quantity must be a positive integer\",\n        );\n      }\n      const order: Order = {\n        id: String(nextId++),\n        productId: body.productId,\n        quantity: body.quantity,\n        status: \"pending\",\n      };\n      orders.push(order);\n      return json(order, 201, { Location: `/orders/${order.id}` });\n    },\n  },\n  \"/orders/:id\": {\n    GET: (req: BunRequest<\"/orders/:id\">) => {\n      const order = orders.find((o) => o.id === req.params.id);\n      if (!order) {\n        return errorResponse(404, \"NOT_FOUND\", `order ${req.params.id} not found`);\n      }\n      return json(order);\n    },\n    DELETE: (req: BunRequest<\"/orders/:id\">) => {\n      const index = orders.findIndex((o) => o.id === req.params.id);\n      if (index === -1) {\n        return errorResponse(404, \"NOT_FOUND\", `order ${req.params.id} not found`);\n      }\n      orders.splice(index, 1);\n      return new Response(null, { status: 204 });\n    },\n  },\n};\n",
          "output": "",
          "explanation": "Every handler now returns through json or errorResponse, except delete, which returns an empty 204. The 201 response carries a Location header pointing at the new order. Invalid quantity values (0, negative, 1.5, missing) give a 400 error."
        },
        {
          "language": "bash",
          "filename": "curl-status.sh",
          "source": "curl -s -w \"\\n%{http_code}\\n\" -X POST http://localhost:3000/orders -H \"Content-Type: application/json\" -d '{\"productId\":7,\"quantity\":0}'\ncurl -s -w \"\\n%{http_code}\\n\" -X POST http://localhost:3000/orders -H \"Content-Type: application/json\" -d '{\"productId\":7,\"quantity\":2}'\ncurl -s -o /dev/null -w \"%{http_code}\\n\" -X DELETE http://localhost:3000/orders/1\ncurl -s -w \"\\n%{http_code}\\n\" -X DELETE http://localhost:3000/orders/1",
          "output": "{\"error\":{\"code\":\"VALIDATION_ERROR\",\"message\":\"quantity must be a positive integer\"}}\n400\n{\"id\":\"1\",\"productId\":7,\"quantity\":2,\"status\":\"pending\"}\n201\n204\n{\"error\":{\"code\":\"NOT_FOUND\",\"message\":\"order 1 not found\"}}\n404",
          "explanation": "Restart the server first so ids start at 1. The invalid POST does not use up an id. The first delete succeeds with 204 and no body; deleting the same order again is a 404."
        }
      ],
      "productionNote": "Client code (and your own tests later) depends on the status codes and the error shape staying stable. Changing them is a breaking change, so decide once and apply it everywhere through the helpers.",
      "commonMistakes": [
        "Returning status 200 with an `{ error }` body. Clients that check only the status will think the request worked.",
        "Sending a body with a 204 response. 204 means there is no content.",
        "Giving each route its own error shape. Clients then need special code for every endpoint; use `errorResponse` everywhere."
      ],
      "sources": [
        { "title": "MDN: HTTP response status codes", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status" },
        { "title": "MDN: Location header", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Location" }
      ]
    },
    {
      "id": "not-found-and-error-handling",
      "title": "404 and fallback handling",
      "explanation": "Two situations remain. First, a request that matches no route reaches the `fetch` fallback. In a JSON API the fallback should return a JSON 404 using `errorResponse`, never an HTML page.\n\nSecond, a handler may throw an error (a bug, or an unexpected failure). Bun.serve has an `error(err)` option: a function Bun calls when a handler throws, and it must return a Response. Without it the behaviour depends on the `development` option. Development mode is on by default, and is switched off by `NODE_ENV=production` or by `development: false`. In development mode Bun shows a detailed error page for uncaught errors. With development off, an uncaught error gives a plain 500 response.\n\nIn this course the `error` handler is always present. It logs the real error on the server with `console.error`, so you can debug it, and returns a generic 500 JSON message to the client. The client must never see `err.message` or a stack trace, because those can reveal file paths, SQL text or secrets to an attacker. Topic 19 expands this into a full error mapping.\n\nThe example adds a temporary `/boom` route that always throws, so you can see the handler work. Delete that route after trying it.",
      "analogy": "A hotel front desk. A guest asks for a room that does not exist, and the desk hands over a polite card, \"no such room\" (404). If a pipe bursts in the kitchen, the manager gives guests the same standard apology notice (500). The manager does not walk guests through the plumbing (the stack trace), but the maintenance log (console.error) records exactly what broke.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/server.ts",
          "source": "import { errorResponse } from \"./http.ts\";\nimport { healthRoutes } from \"./routes/health.routes.ts\";\nimport { ordersRoutes } from \"./routes/orders.routes.ts\";\n\nexport function createServer(port: number) {\n  return Bun.serve({\n    port,\n    routes: {\n      ...healthRoutes,\n      ...ordersRoutes,\n      // temporary demo route: remove after trying the error handler\n      \"/boom\": () => {\n        throw new Error(\"boom\");\n      },\n    },\n    fetch() {\n      return errorResponse(404, \"NOT_FOUND\", \"route not found\");\n    },\n    error(err) {\n      console.error(err);\n      return errorResponse(500, \"INTERNAL\", \"internal server error\");\n    },\n  });\n}\n",
          "output": "",
          "explanation": "The fetch fallback now returns the shared JSON 404. The error function logs the real error on the server and sends a generic 500 JSON body. The /boom route exists only to trigger it."
        },
        {
          "language": "bash",
          "filename": "curl-errors.sh",
          "source": "curl -s -w \"\\n%{http_code}\\n\" http://localhost:3000/nope\ncurl -s -w \"\\n%{http_code}\\n\" http://localhost:3000/boom",
          "output": "{\"error\":{\"code\":\"NOT_FOUND\",\"message\":\"route not found\"}}\n404\n{\"error\":{\"code\":\"INTERNAL\",\"message\":\"internal server error\"}}\n500",
          "explanation": "/nope matches no route, so the fetch fallback answers with 404. /boom throws, so the error handler answers with 500. The server terminal also prints the logged Error: boom with its stack trace, which the client never sees."
        }
      ],
      "productionNote": "A JSON API must not answer with HTML error pages. Always provide both a JSON fallback and an error handler, and log the real error server-side.",
      "commonMistakes": [
        "Putting `err.message` or the stack trace into the response body. This leaks internals to anyone who can trigger the error.",
        "Forgetting the fetch fallback, so unknown paths get Bun's default response instead of your JSON 404.",
        "Leaving a demo route such as `/boom` in the code after testing."
      ],
      "sources": [
        { "title": "Bun docs: Error handling", "url": "https://bun.com/docs/runtime/http/error-handling" },
        { "title": "Bun docs: Routing", "url": "https://bun.com/docs/runtime/http/routing" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "A client sends GET /unknown and no entry in your routes object matches. Which part of Bun.serve produces the response?",
      "options": [
        "The error(err) handler",
        "The port option",
        "The fetch fallback function",
        "The per-method GET handler of the first route"
      ],
      "answerIndex": 2,
      "explanation": "The fetch function is the fallback for any request no route matched. The error handler runs only when a handler throws, and port only chooses where to listen."
    },
    {
      "question": "Your routes contain /orders/:id, /orders/* and /orders/recent. Which one answers GET /orders/recent?",
      "options": [
        "/orders/recent, because the exact path is the most specific",
        "/orders/:id, because it was declared first",
        "/orders/*, because wildcards match everything",
        "None of them; Bun throws an error because of the overlap"
      ],
      "answerIndex": 0,
      "explanation": "Bun picks exact paths first, then parameter paths, then prefix wildcards, then the global catch-all. Declaration order does not matter and overlapping routes are allowed."
    },
    {
      "question": "In a handler for /orders/:id, what type is req.params.id, and what does new URL(req.url).searchParams.get(\"limit\") return when the query has no limit?",
      "options": [
        "A number, and 0",
        "A number, and undefined",
        "A string, and an empty string",
        "A string, and null"
      ],
      "answerIndex": 3,
      "explanation": "Path params are always strings, even for /orders/42. searchParams.get returns a string when the name exists and null when it does not, so you convert with Number(...) and default with ??."
    },
    {
      "question": "A DELETE request succeeds and there is nothing to send back. Which response matches this course's convention?",
      "options": [
        "Status 200 with the body { \"error\": null }",
        "Status 204 with no body, created with new Response(null, { status: 204 })",
        "Status 404 with an empty body",
        "Status 201 with a Location header"
      ],
      "answerIndex": 1,
      "explanation": "204 No Content means success with an empty body. 200 with an error field is misleading, 404 means missing, and 201 is for creating something."
    },
    {
      "question": "Why does the error handler return a generic message such as \"internal server error\" instead of err.message?",
      "options": [
        "Because err.message is always an empty string in Bun",
        "Because HTTP forbids text in a 500 response",
        "Because the real message and stack can reveal internals such as file paths or SQL to attackers, so they are only logged on the server",
        "Because Response.json cannot serialise strings"
      ],
      "answerIndex": 2,
      "explanation": "Internal error details help attackers and mean nothing to clients. The real error is written with console.error for developers. The other options are false statements about HTTP and Bun."
    }
  ]
});
