# 28. FastAPI First App
Version: Python 3.15.2 + uv 0.13.7 + FastAPI 0.162.5 + Uvicorn 0.54.0
Prerequisites: 13-uv-projects, 18-decorators-context-managers, 26-http-api-basics, 27-pydantic-models

## Learning goals
- After this topic, learner can create a uv project and add `fastapi[standard]`.
- After this topic, learner can write path operations with `@app.get` returning JSON.
- After this topic, learner can run an app with `fastapi dev` (development) and `fastapi run` (production).
- After this topic, learner can use `/docs` to try endpoints.
- After this topic, learner can read path and query parameters with type hints.

Format note for all FastAPI topics (28–35): example "output" = HTTP request → status + exact JSON response body. FastAPI sends compact JSON (no spaces): `{"message":"Hello World"}`. Learner sends requests from `/docs` ("Try it out") or the browser for GETs. Endpoints use plain `def` until topic 35 explains `async def`.

## Sub-topics
### Adding fastapi[standard] with uv add
- Concept: FastAPI = Python web framework for building APIs with type hints + Pydantic. `fastapi[standard]` = FastAPI plus extras: the `fastapi` command (CLI), Uvicorn (the server that runs the app — ASGI server, gloss: standard way async Python web apps talk to servers), HTTPX (used by TestClient, topic 34), and more. Square brackets = "extras" (optional add-ons); quote it in shells.
- Analogy: FastAPI is the restaurant's recipe book and kitchen rules; Uvicorn is the front door and waiters that bring customers in.
- Code example: `bash` — `uv init shop-api` / `cd shop-api` / `uv add "fastapi[standard]"`; output `""`. Then `toml` snippet of resulting `pyproject.toml` dependencies line `"fastapi[standard]>=0.162.5"`; output `""`.
- Production use: Standard way to start a FastAPI service.
- Common mistakes: Unquoted brackets (some shells, e.g. zsh, treat `[...]` as a pattern); `pip install` instead of `uv add` (not recorded in pyproject/lock).
- Sources: https://fastapi.tiangolo.com/#installation ; https://fastapi.tiangolo.com/fastapi-cli/ ; https://docs.astral.sh/uv/guides/integration/fastapi/

### Path operations (@app.get)
- Concept: `app = FastAPI()` creates the application. Path operation = method + path handled by a function; decorator (recap topic 18) `@app.get("/")` registers it. Also `@app.post`, `@app.put`, `@app.patch`, `@app.delete`. Return a dict/list/model → FastAPI converts to JSON. Return type hint documents and checks the response.
- Analogy: A reception desk directory: "questions about /, go to desk read_root".
- Code example: `main.py` — `from fastapi import FastAPI`; `app = FastAPI()`; `@app.get("/") def read_root() -> dict[str, str]: return {"message": "Hello World"}`; output: `GET /` → `200` `{"message":"Hello World"}`; `GET /missing` → `404` `{"detail":"Not Found"}`.
- Production use: Every endpoint of a FastAPI service.
- Common mistakes: Forgetting the decorator (function never reachable); two functions with the same method+path (first one wins).
- Sources: https://fastapi.tiangolo.com/tutorial/first-steps/

### Running with fastapi dev and fastapi run
- Concept: `uv run fastapi dev main.py` = development: auto-reload on file save, listens on `http://127.0.0.1:8000` (your machine only). `uv run fastapi run main.py` = production mode: no reload, listens on `0.0.0.0:8000` (reachable from other machines). Stop with Ctrl+C. Port flag `--port 8080`.
- Analogy: dev = rehearsal with the director shouting "again!" after every change; run = the live show.
- Code example: `bash` — `uv run fastapi dev main.py`; representative output lines (wording varies by version): `Serving at: http://127.0.0.1:8000` / `API docs: http://127.0.0.1:8000/docs`. Second block `uv run fastapi run main.py`; output `""`. Author: label banner as "similar to"; don't claim exact lines.
- Production use: dev for local work; run (in Docker, topic 35) for deployment.
- Common mistakes: Using `fastapi dev` in production (reload watches files, slower, binds localhost); port 8000 already in use → pick another with `--port`.
- Sources: https://fastapi.tiangolo.com/fastapi-cli/ ; https://fastapi.tiangolo.com/deployment/manually/

### Interactive docs (/docs)
- Concept: FastAPI generates an OpenAPI schema (machine-readable description of the API) at `/openapi.json` and two UIs: `/docs` (Swagger UI, can send requests via "Try it out") and `/redoc` (read-only). `FastAPI(title=..., version=...)` sets the doc header. Docstrings/`summary` show in docs.
- Analogy: An automatic, always-up-to-date menu with a "taste sample" button.
- Code example: `main.py` — `app = FastAPI(title="Shop API", version="1.0.0")`; `@app.get("/ping") def ping() -> dict[str, bool]: """Check the API is alive.""" return {"ok": True}`; output: `GET /ping` → `200` `{"ok":true}`; `GET /openapi.json` → JSON whose `"info"` part is `{"title":"Shop API","version":"1.0.0"}` (show only that part; rest is long).
- Production use: Sharing API contracts with frontend/mobile teams; generating clients; manual testing.
- Common mistakes: Thinking `/docs` must be written by hand; exposing docs publicly when the API is private (can be disabled with `docs_url=None` — mention only).
- Sources: https://fastapi.tiangolo.com/tutorial/first-steps/#interactive-api-docs ; https://fastapi.tiangolo.com/tutorial/metadata/

### Path parameters
- Concept: `{item_id}` in the path → function parameter of the same name; type hint converts and validates (`int`). Invalid → 422 automatically. Fixed paths must be declared before parameter paths (`/users/me` before `/users/{user_id}`), since first match wins.
- Analogy: House number on an address: the street is fixed, the number changes, and it must be a number.
- Code example: `main.py` — `@app.get("/items/{item_id}") def read_item(item_id: int) -> dict[str, int]: return {"item_id": item_id}`; output: `GET /items/42` → `200` `{"item_id":42}`; `GET /items/foo` → `422` with body containing `"type":"int_parsing"` and `"loc":["path","item_id"]` (show those fields only; full message text may vary).
- Production use: Resource ids: `/orders/{order_id}`, `/users/{username}`.
- Common mistakes: Name mismatch between `{item_id}` and parameter; declaring `/users/{user_id}` before `/users/me` (`me` → 422).
- Sources: https://fastapi.tiangolo.com/tutorial/path-params/ ; https://fastapi.tiangolo.com/tutorial/path-params/#order-matters

### Query parameters
- Concept: Function parameters not in the path become query parameters. Default value → optional; no default → required; `str | None = None` → optional, may be absent. Types converted (`"5"` → `5`, `"true"` → `True`).
- Analogy: Optional notes on an order: "extra sauce, no onions" — the order works without them.
- Code example: `main.py` — `@app.get("/items/") def list_items(skip: int = 0, limit: int = 10, q: str | None = None) -> dict[str, int | str | None]: return {"skip": skip, "limit": limit, "q": q}`; output: `GET /items/?skip=5&q=pen` → `200` `{"skip":5,"limit":10,"q":"pen"}`; `GET /items/` → `200` `{"skip":0,"limit":10,"q":null}`.
- Production use: Pagination (`skip`/`limit`), search, filters, sorting.
- Common mistakes: Forgetting a default and making the parameter required by accident; returning huge lists without a limit.
- Sources: https://fastapi.tiangolo.com/tutorial/query-params/

## Quiz
1. Which command auto-reloads on save, and which is for production? — tests fastapi dev vs run
2. What does FastAPI return for `/items/abc` when `item_id: int`? — tests path validation (422)
3. Is `limit: int = 10` a path or query parameter, required or optional? — tests query params
4. Where can you try your endpoints without writing a client? — tests /docs
5. Why must `/users/me` be declared before `/users/{user_id}`? — tests route order
