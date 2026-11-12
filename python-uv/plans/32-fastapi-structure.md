# 32. Structuring FastAPI Apps
Version: Python 3.15.2 + uv 0.13.7 + FastAPI 0.162.5 + pydantic-settings 2.16.2
Prerequisites: 12-modules-imports, 22-concurrency-asyncio, 24-production-workflow, 31-fastapi-sqlmodel

## Learning goals
- After this topic, learner can split an app into packages with `APIRouter` and `include_router`.
- After this topic, learner can run startup/shutdown code with a lifespan function.
- After this topic, learner can load settings from environment variables / `.env` with pydantic-settings.
- After this topic, learner can allow a browser frontend with `CORSMiddleware`.
- After this topic, learner can run small jobs after the response with `BackgroundTasks`.

(Output format: request → status + exact JSON body.)

## Sub-topics
### APIRouter and multi-file layout
- Concept: `APIRouter(prefix="/items", tags=["items"])` = mini-app holding related routes; `app.include_router(router)` plugs it in. Layout: `app/__init__.py`, `app/main.py`, `app/routers/__init__.py`, `app/routers/items.py` (recap packages, topic 12). Run `uv run fastapi dev app/main.py`. `tags` group endpoints in `/docs`.
- Analogy: Department store: each department (router) runs its own counters; the store directory (main) lists departments.
- Code example: `text` layout block; `app/routers/items.py` — `from fastapi import APIRouter`; `router = APIRouter(prefix="/items", tags=["items"])`; `@router.get("/") def list_items() -> list[str]: return ["pen", "ink"]`; `app/main.py` — `from fastapi import FastAPI`; `from app.routers import items`; `app = FastAPI()`; `app.include_router(items.router)`; output: `GET /items/` → `200` `["pen","ink"]`.
- Production use: Every app beyond a few endpoints: users, orders, auth routers.
- Common mistakes: Repeating the prefix in route paths (`/items/items/`); circular imports between routers and main (keep shared things like engine in their own module, e.g. `app/db.py`).
- Sources: https://fastapi.tiangolo.com/tutorial/bigger-applications/

### Lifespan events (startup / shutdown)
- Concept: Lifespan = async context manager (recap `asynccontextmanager`, topics 18/22): code before `yield` runs once at startup (create tables, open pools, load models), after `yield` at shutdown. `FastAPI(lifespan=lifespan)`. Replaces deprecated `@app.on_event("startup")`. Must be `async def` even if body is sync.
- Analogy: Opening and closing a shop: unlock and switch on lights before the first customer; lock up after the last.
- Code example: `main.py` — `from contextlib import asynccontextmanager`; `from fastapi import FastAPI`; `resources: dict[str, str] = {}`; `@asynccontextmanager async def lifespan(app: FastAPI):` `resources["greeting"] = "loaded at startup"`; `print("startup")`; `yield`; `print("shutdown")`; `resources.clear()`; `app = FastAPI(lifespan=lifespan)`; `@app.get("/") def root() -> dict[str, str]: return {"greeting": resources["greeting"]}`; output: terminal prints `startup` when server starts and `shutdown` on Ctrl+C; `GET /` → `200` `{"greeting":"loaded at startup"}`. Note: in topic 31's app, move `SQLModel.metadata.create_all(engine)` here.
- Production use: Creating tables, warming caches, closing HTTP clients/DB pools cleanly.
- Common mistakes: Heavy work at module import instead of lifespan; using deprecated `on_event` alongside lifespan (on_event ignored).
- Sources: https://fastapi.tiangolo.com/advanced/events/

### Configuration from environment variables
- Concept: Recap topic 24 (env vars, never hard-code secrets). `pydantic-settings` (`uv add pydantic-settings`): `class Settings(BaseSettings)` reads fields from env vars (name match, case-insensitive) with type validation; `model_config = SettingsConfigDict(env_file=".env")` also reads a `.env` file (add `.env` to `.gitignore`). Cache one instance with `@lru_cache` (recap topic 19) in `get_settings()`, inject via `Depends(get_settings)`.
- Analogy: A thermostat reading the dial on the wall (environment) instead of having the temperature welded inside.
- Code example: `config.py` — `from functools import lru_cache`; `from pydantic_settings import BaseSettings, SettingsConfigDict`; `class Settings(BaseSettings): app_name: str = "Shop API"; debug: bool = False; database_url: str = "sqlite:///database.db"; model_config = SettingsConfigDict(env_file=".env")`; `@lru_cache def get_settings() -> Settings: return Settings()`; `.env` file content `DEBUG=true`; `main.py` — `@app.get("/info") def info(settings: Annotated[Settings, Depends(get_settings)]) -> dict[str, str | bool]: return {"app_name": settings.app_name, "debug": settings.debug}`; output: `GET /info` → `200` `{"app_name":"Shop API","debug":true}`.
- Production use: DB URLs, secret keys, feature flags per environment (dev/staging/prod).
- Common mistakes: Committing `.env` with secrets; creating `Settings()` on every request (re-reads env; use lru_cache).
- Sources: https://fastapi.tiangolo.com/advanced/settings/ ; https://docs.pydantic.dev/latest/concepts/pydantic_settings/

### CORS middleware
- Concept: Middleware = code that runs around every request/response. CORS (Cross-Origin Resource Sharing): browsers block a page from one origin (scheme+host+port, e.g. `http://localhost:5173`) reading responses from another (`http://127.0.0.1:8000`) unless the API allows it via `Access-Control-Allow-Origin` headers. Only browsers enforce it (curl/scripts ignore it). `app.add_middleware(CORSMiddleware, allow_origins=[...], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])`.
- Analogy: A guest list at the door: the browser (bouncer) only lets the page read the reply if the API put that page's origin on the list.
- Code example: `main.py` — `from fastapi.middleware.cors import CORSMiddleware`; `app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])`; `@app.get("/ping") ...` returns `{"ok": True}`; output: `GET /ping` with header `Origin: http://localhost:5173` → `200` `{"ok":true}` and response header `access-control-allow-origin: http://localhost:5173`; with `Origin: http://evil.example` → `200`, no `access-control-allow-origin` header (browser blocks the page from reading it).
- Production use: SPA/mobile web frontends on a different domain/port than the API.
- Common mistakes: `allow_origins=["*"]` together with credentials (not allowed by browsers; list exact origins); thinking CORS protects the API from non-browser clients.
- Sources: https://fastapi.tiangolo.com/tutorial/cors/ ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS

### Background tasks
- Concept: `BackgroundTasks` parameter; `background_tasks.add_task(func, *args)` runs `func` after the response is sent — client doesn't wait. For small jobs (emails, logs). Heavy/critical jobs → dedicated job queue (mention only).
- Analogy: Cashier hands you the receipt, then files the paperwork after you've left.
- Code example: `main.py` — `from fastapi import BackgroundTasks, FastAPI`; `log: list[str] = []`; `def write_log(message: str) -> None: log.append(message)`; `@app.post("/notify/{name}") def notify(name: str, background_tasks: BackgroundTasks) -> dict[str, str]: background_tasks.add_task(write_log, f"notified {name}"); return {"queued": name}`; `@app.get("/log") def read_log() -> list[str]: return log`; output: `POST /notify/ada` → `200` `{"queued":"ada"}`; then `GET /log` → `200` `["notified ada"]`.
- Production use: Welcome emails, audit logs, cache refresh after a write.
- Common mistakes: Calling the function yourself (`add_task(write_log("x"))`); using background tasks for long or must-not-lose work (lost if the server restarts).
- Sources: https://fastapi.tiangolo.com/tutorial/background-tasks/

## Quiz
1. What does `prefix="/items"` on an APIRouter do? — tests routers
2. Where should table creation go, and why not `on_event`? — tests lifespan
3. How does pydantic-settings get `debug=True` from a `.env` file containing `DEBUG=true`? — tests settings
4. Does CORS stop a Python script from calling your API? — tests CORS scope
5. When does a background task run? — tests BackgroundTasks
