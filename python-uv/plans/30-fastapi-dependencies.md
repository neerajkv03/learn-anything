# 30. Dependency Injection
Version: Python 3.15.2 + uv 0.13.7 + FastAPI 0.162.5
Prerequisites: 17-iterators-generators, 29-fastapi-requests-responses

## Learning goals
- After this topic, learner can write a dependency function and inject it with `Depends`.
- After this topic, learner can write dependencies with `yield` for setup/cleanup.
- After this topic, learner can chain dependencies (sub-dependencies).
- After this topic, learner can apply dependencies to a whole app or route without using their value.

(Output format: request → status + exact JSON body.)

## Sub-topics
### What Depends does
- Concept: Dependency = a function FastAPI calls before your endpoint; its return value is passed in. Dependency injection = "declare what you need; the framework provides it". `Annotated[dict[str, int], Depends(pagination)]`; store as alias `Pagination = Annotated[...]` (plain assignment, as FastAPI docs do) to reuse. Dependency params are read from the request like endpoint params. Called once per request even if used twice (cached).
- Analogy: Surgeon's assistant hands the right instrument when asked — the surgeon doesn't fetch it.
- Code example: `main.py` — `from typing import Annotated`; `from fastapi import Depends, FastAPI`; `app = FastAPI()`; `def pagination(skip: int = 0, limit: int = 10) -> dict[str, int]: return {"skip": skip, "limit": limit}`; `Pagination = Annotated[dict[str, int], Depends(pagination)]`; `@app.get("/items/") def list_items(page: Pagination) -> dict[str, int]: return page`; `@app.get("/users/") def list_users(page: Pagination) -> dict[str, int]: return page`; output: `GET /items/?limit=2` → `200` `{"skip":0,"limit":2}`; `GET /users/?skip=4` → `200` `{"skip":4,"limit":10}`.
- Production use: DB sessions, current user, settings, pagination, permissions.
- Common mistakes: `Depends(pagination())` (calls it yourself — pass the function, no parentheses); using the PEP 695 `type X = ...` statement for dependency aliases (stick to plain assignment).
- Sources: https://fastapi.tiangolo.com/tutorial/dependencies/ ; https://fastapi.tiangolo.com/tutorial/dependencies/#share-annotated-dependencies

### Dependencies with yield
- Concept: A generator dependency (recap `yield`, topic 17): code before `yield` runs before the endpoint, yielded value is injected, code after (in `finally`) runs after the response — cleanup. Exactly one `yield`. Use for DB sessions/connections (topic 31).
- Analogy: Library loan: librarian hands you the book (yield), and when you're done it's checked back in automatically.
- Code example: `main.py` — `events: list[str] = []`; `def get_resource():` `events.append("open")`; `try: yield "resource"` `finally: events.append("close")`; `@app.get("/use") def use(res: Annotated[str, Depends(get_resource)]) -> dict[str, str]: return {"got": res}`; `@app.get("/events") def read_events() -> list[str]: return events`; output (fresh server, in order): `GET /use` → `200` `{"got":"resource"}`; then `GET /events` → `200` `["open","close"]`.
- Production use: Open DB session → yield → close; acquire lock → release.
- Common mistakes: Cleanup without `try/finally` (skipped on errors); two `yield`s.
- Sources: https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/

### Sub-dependencies
- Concept: A dependency can itself use `Depends`; FastAPI resolves the chain. `Header()` reads a header: parameter `x_token` ↔ header `X-Token` (underscores → hyphens, case-insensitive). Dependencies can raise `HTTPException`.
- Analogy: Building security: guard checks badge (token) → badge office looks up who you are (user) → you enter.
- Code example: `main.py` — `from fastapi import Depends, FastAPI, Header, HTTPException`; `def get_token(x_token: Annotated[str | None, Header()] = None) -> str: if x_token != "secret": raise HTTPException(status_code=401, detail="Invalid token"); return x_token`; `def get_user(token: Annotated[str, Depends(get_token)]) -> dict[str, str]: return {"name": "ada"}`; `@app.get("/me") def me(user: Annotated[dict[str, str], Depends(get_user)]) -> dict[str, str]: return user`; output: `GET /me` with header `X-Token: secret` → `200` `{"name":"ada"}`; `GET /me` no header → `401` `{"detail":"Invalid token"}`.
- Production use: auth token → current user → permission check.
- Common mistakes: Expecting `x_token` to match header `x_token` literally; doing auth logic inside every endpoint instead of one dependency.
- Sources: https://fastapi.tiangolo.com/tutorial/dependencies/sub-dependencies/ ; https://fastapi.tiangolo.com/tutorial/header-params/

### Router- and app-level dependencies
- Concept: When you need the check but not its value: `@app.get(..., dependencies=[Depends(verify_key)])`, `FastAPI(dependencies=[...])` for every route, `APIRouter(dependencies=[...])` for a group (routers: topic 32, gloss). Missing required header → 422.
- Analogy: A ticket check at the building entrance instead of at every room.
- Code example: `main.py` — `def verify_key(x_key: Annotated[str, Header()]) -> None: if x_key != "k1": raise HTTPException(status_code=403, detail="Bad key")`; `app = FastAPI(dependencies=[Depends(verify_key)])`; `@app.get("/ping") def ping() -> dict[str, bool]: return {"pong": True}`; output: `GET /ping` header `X-Key: k1` → `200` `{"pong":true}`; header `X-Key: nope` → `403` `{"detail":"Bad key"}`; no header → `422` (`"type":"missing"`, `"loc":["header","x-key"]`).
- Production use: API keys, rate limits, audit logging across many routes.
- Common mistakes: Expecting a return value from `dependencies=[...]` (ignored); forgetting it also protects `/docs`-called endpoints, not `/docs` itself.
- Sources: https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-in-path-operation-decorators/ ; https://fastapi.tiangolo.com/tutorial/dependencies/global-dependencies/

## Quiz
1. Why `Depends(get_user)` and not `Depends(get_user())`? — tests passing the function
2. When does the code after `yield` run? — tests yield dependencies
3. Which header does parameter `x_token` read? — tests Header conversion
4. How do you run a check on every route without adding a parameter? — tests app-level dependencies
