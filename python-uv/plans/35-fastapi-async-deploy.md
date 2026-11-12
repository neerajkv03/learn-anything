# 35. Async & Deployment
Version: Python 3.15.2 + uv 0.13.7 + FastAPI 0.162.5 + Uvicorn 0.54.0 + SQLite 3.54.1
Prerequisites: 22-concurrency-asyncio, 24-production-workflow, 25-sqlite-sqlite3, 34-fastapi-testing

## Learning goals
- After this topic, learner can choose between `async def` and `def` endpoints correctly.
- After this topic, learner can run FastAPI in production with `fastapi run` and workers.
- After this topic, learner can build a Docker image for a uv + FastAPI app.
- After this topic, learner can run SQLite safely in production (WAL, single writer, volume, backups).
- After this topic, learner can add a health-check endpoint and Docker `HEALTHCHECK`.

(Output format: request → status + exact JSON body; shell commands → `""`.)

## Sub-topics
### async def vs def endpoints
- Concept: Recap topic 22. `async def` endpoint runs on the event loop — must only `await` non-blocking calls; one blocking call (`time.sleep`, sync DB, `requests`) freezes every request. Plain `def` endpoint runs in a thread pool — safe for blocking code. Rule: library has async API you `await` → `async def`; otherwise (e.g. SQLModel `Session`, which is sync) → `def`. Both are fast enough for most apps.
- Analogy: A single super-fast waiter (event loop) who must never stand waiting at one table, vs. a team of waiters (thread pool) who can each wait at a table.
- Code example: `main.py` — `import asyncio`; `import time`; `from fastapi import FastAPI`; `app = FastAPI()`; `@app.get("/sync") def sync_endpoint() -> dict[str, str]: time.sleep(0.1); return {"kind": "def"}`  (comment: blocking is OK in def); `@app.get("/async") async def async_endpoint() -> dict[str, str]: await asyncio.sleep(0.1); return {"kind": "async"}`; output: `GET /sync` → `200` `{"kind":"def"}`; `GET /async` → `200` `{"kind":"async"}`. Mention the bad version in prose: `time.sleep` inside `async def` blocks everyone.
- Production use: High-concurrency endpoints calling other APIs (async HTTP clients) vs. CRUD with sync DB sessions.
- Common mistakes: `async def` + blocking DB/HTTP calls; forgetting `await` (gets a coroutine object, recap topic 22).
- Sources: https://fastapi.tiangolo.com/async/#in-a-hurry ; https://fastapi.tiangolo.com/async/#path-operation-functions

### fastapi run and workers
- Concept: `uv run fastapi run main.py` = production server (Uvicorn), host `0.0.0.0`, port 8000, no reload. `--port 80`, `--workers 4` = 4 separate processes (recap processes, topic 22) to use more CPU cores; each worker has its own memory (module-level dicts/caches not shared). In containers/Kubernetes, usually 1 worker per container and scale containers instead. Behind a reverse proxy/HTTPS terminator (gloss: server in front that handles HTTPS), use `--proxy-headers` — mention only.
- Analogy: Opening more identical checkout counters — each with its own cash drawer.
- Code example: `bash` — `uv run fastapi run main.py --port 8000 --workers 4`; output `""`.
- Production use: VMs and containers serving real traffic.
- Common mistakes: Storing state in memory with several workers (each worker sees different data — use the DB); using `fastapi dev` in production.
- Sources: https://fastapi.tiangolo.com/deployment/server-workers/ ; https://fastapi.tiangolo.com/deployment/manually/

### Docker image with uv
- Concept: Builds on topic 24's Dockerfile pattern: uv binary from `ghcr.io/astral-sh/uv:0.13.7`, install deps first (cached layer), then copy code and `uv sync --locked --no-dev`, put `/app/.venv/bin` on `PATH`, then `CMD` in exec (JSON list) form so stop signals reach the server. One worker per container.
- Analogy: A shipping container with the shop already set up inside — unload it anywhere and open for business.
- Code example: `Dockerfile` (language `docker`) — `FROM python:3.15-slim` / `COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /uvx /bin/` / `WORKDIR /app` / `ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy` / `RUN --mount=type=cache,target=/root/.cache/uv --mount=type=bind,source=uv.lock,target=uv.lock --mount=type=bind,source=pyproject.toml,target=pyproject.toml uv sync --locked --no-install-project --no-dev` / `COPY . /app` / `RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev` / `ENV PATH="/app/.venv/bin:$PATH"` / `CMD ["fastapi", "run", "app/main.py", "--port", "80"]`; output `""`. `bash` — `docker build -t shop-api .` / `docker run -p 8000:80 shop-api`; output `""`; then `GET http://127.0.0.1:8000/docs` works.
- Production use: Standard deployment unit for cloud platforms.
- Common mistakes: Shell-form `CMD fastapi run ...` (signals not forwarded, slow shutdown); copying local `.venv` into the image (add to `.dockerignore`).
- Sources: https://fastapi.tiangolo.com/deployment/docker/ ; https://docs.astral.sh/uv/guides/integration/docker/ ; https://docs.astral.sh/uv/guides/integration/fastapi/#deployment

### SQLite in production (WAL, single writer, backups)
- Concept: SQLite handles many readers but one writer at a time. WAL (Write-Ahead Logging) mode (`PRAGMA journal_mode=WAL`, persistent, set once) lets readers continue while a write happens. `timeout` (sqlite3 `connect(..., timeout=5)`) waits for the lock instead of failing with "database is locked". In Docker, keep the DB file on a volume (`docker run -v shop-data:/app/data ...`) or it's lost with the container. Backups: `con.backup(target)` (safe while in use) — not copying the file mid-write. Good for one server; move to a server DB (e.g. PostgreSQL) for many app servers or heavy concurrent writes. Note: `:memory:` DBs can't use WAL, so example uses a temp folder.
- Analogy: A notebook many people can read at once but only one can write in; WAL = writer drafts on a side sheet so readers aren't blocked, then it's copied in.
- Code example: `sqlite_prod.py` — `import sqlite3`; `import tempfile`; `from pathlib import Path`; `with tempfile.TemporaryDirectory() as folder:` `con = sqlite3.connect(Path(folder) / "app.db", timeout=5)`; `print(con.execute("PRAGMA journal_mode=WAL").fetchone()[0])`; `con.execute("CREATE TABLE notes (body TEXT)")`; `with con: con.execute("INSERT INTO notes VALUES (?)", ("hi",))`; `backup = sqlite3.connect(Path(folder) / "backup.db")`; `con.backup(backup)`; `print(backup.execute("SELECT body FROM notes").fetchall())`; `backup.close()`; `con.close()`; output `wal\n[('hi',)]`. Explain: close connections before the temp folder is deleted (Windows can't delete open files).
- Production use: Small/medium single-server apps, internal tools, edge apps.
- Common mistakes: No volume in Docker (data lost on redeploy); running several replicas writing to one SQLite file on a network share.
- Sources: https://www.sqlite.org/wal.html ; https://www.sqlite.org/whentouse.html ; https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.backup

### Health-check endpoint
- Concept: `/health` = cheap endpoint returning `{"status": "ok"}`; load balancers/orchestrators call it to know the app is alive and restart or stop routing if not. Docker `HEALTHCHECK` runs a command periodically; slim images have no `curl`, so use Python's `urllib.request`. Keep it fast, no auth.
- Analogy: A nurse checking a pulse every few minutes.
- Code example: `main.py` — `@app.get("/health") def health() -> dict[str, str]: return {"status": "ok"}`; output `GET /health` → `200` `{"status":"ok"}`. `Dockerfile` addition (language `docker`): `HEALTHCHECK --interval=30s --timeout=3s CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:80/health')"]`; output `""`. Explain: `urlopen` raises on errors → non-zero exit → unhealthy.
- Production use: Docker, Kubernetes probes, cloud load balancers, uptime monitors.
- Common mistakes: Slow health checks that query everything; protecting `/health` with auth (probes fail).
- Sources: https://docs.docker.com/reference/dockerfile/#healthcheck ; https://docs.python.org/3/library/urllib.request.html#urllib.request.urlopen

## Quiz
1. Your endpoint uses a sync SQLModel `Session` — `def` or `async def`? — tests async choice
2. Why might an in-memory counter show different values with `--workers 4`? — tests per-process memory
3. Why use exec-form `CMD [...]` in a Dockerfile? — tests signals
4. What does WAL mode improve, and what limit remains? — tests SQLite concurrency
5. Why not use `curl` in a slim image's HEALTHCHECK? — tests health checks
