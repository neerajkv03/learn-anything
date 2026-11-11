# 24. Production Workflow
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 23-scripts-packaging

## Learning goals
- After this topic, learner can choose between `uv sync --locked` and `--frozen` for reproducible installs.
- After this topic, learner can write a GitHub Actions CI workflow that installs uv, syncs, lints, type-checks, and tests.
- After this topic, learner can write a Dockerfile that uses uv with layer caching and no dev dependencies.
- After this topic, learner can read configuration and secrets from environment variables with safe defaults.
- After this topic, learner can structure a multi-package repo with uv workspaces.

## Sub-topics
### Reproducible installs (uv sync --locked / --frozen)
- Concept: `uv sync --locked` fails if `uv.lock` doesn't match `pyproject.toml` (catches forgotten re-locks) — use in CI. `uv sync --frozen` installs from the lockfile without checking it against pyproject — use in Docker build steps where pyproject may not be copied yet. `--no-dev` skips dev groups. `uv lock --check` (or `uv lock --locked`) just verifies.
- Analogy: A builder who refuses to start if the blueprint and the materials list disagree (`--locked`) vs one who trusts the materials list blindly (`--frozen`).
- Code example: `bash` — `uv sync --locked`, `uv sync --frozen --no-dev`; output `""`.
- Production use: Guarantees the tested environment is the deployed environment.
- Common mistakes: Plain `uv sync` in CI (silently re-locks); using `--frozen` everywhere and missing out-of-date locks.
- Sources: https://docs.astral.sh/uv/concepts/projects/sync/ ; https://docs.astral.sh/uv/reference/cli/#uv-sync

### uv in CI
- Concept: CI (continuous integration) runs checks automatically on every push/PR. GitHub Actions: `astral-sh/setup-uv` installs uv (with caching), then `uv sync --locked`, `uv run ruff check`, `uv run ruff format --check`, `uv run mypy .`, `uv run pytest`. Pin uv version for reproducibility.
- Analogy: An automatic quality gate at the factory exit: every product is checked, every time, the same way.
- Code example: `.github/workflows/ci.yml` (language `yaml`) — `name: CI` / `on: [push, pull_request]` / job `test` on `ubuntu-latest` with steps `actions/checkout@v5`, `astral-sh/setup-uv@v7` with `version: "0.13.7"` and `enable-cache: true`, `uv python install`, `uv sync --locked`, lint/format/type/test runs; output `""`. Explanation: action major versions change over time — check the linked docs for current ones.
- Production use: Branch protection requires CI to pass before merge.
- Common mistakes: Not using `--locked`; not caching; different Python version in CI than `.python-version`.
- Sources: https://docs.astral.sh/uv/guides/integration/github/ ; https://github.com/astral-sh/setup-uv

### uv in Docker
- Concept: Docker packages an app with its environment into an image. Pattern: copy the `uv` binary from `ghcr.io/astral-sh/uv:<version>`; set `UV_COMPILE_BYTECODE=1`, `UV_LINK_MODE=copy`; install dependencies first (`uv sync --locked --no-install-project --no-dev` with cache/bind mounts) so the layer is cached; then copy the code and `uv sync --locked --no-dev`; run with `.venv/bin/` on PATH. Add `.venv` to `.dockerignore`.
- Analogy: Packing a moving truck: heavy furniture (dependencies) first, rarely moved; small boxes (your code) last, easy to swap.
- Code example: `Dockerfile` (language `docker`) — `FROM python:3.15-slim` / `COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /uvx /bin/` / `WORKDIR /app` / `ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy` / `RUN --mount=type=cache,target=/root/.cache/uv --mount=type=bind,source=uv.lock,target=uv.lock --mount=type=bind,source=pyproject.toml,target=pyproject.toml uv sync --locked --no-install-project --no-dev` / `COPY . /app` / `RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev` / `ENV PATH="/app/.venv/bin:$PATH"` / `CMD ["python", "main.py"]`; output `""`. `.dockerignore` (`text`) — `.venv`; output `""`.
- Production use: Container deployments on Kubernetes, cloud runners, etc.
- Common mistakes: Copying the local `.venv` into the image; installing dev dependencies in production; copying all code before installing dependencies (cache busted on every change).
- Sources: https://docs.astral.sh/uv/guides/integration/docker/

### Environment variables and configuration
- Concept: Config that differs per environment (database URL, debug flag) and secrets (API keys) come from environment variables (key=value settings given to a process by the OS), not hard-coded in code. `os.environ.get("NAME", default)`; `os.environ["NAME"]` when required (fail fast). Convert types explicitly. `uv run --env-file .env main.py` loads a `.env` file in development; never commit `.env` with secrets.
- Analogy: A hotel room: the building (code) is the same; the guest's preferences card (env vars) changes per stay.
- Code example: `settings.py` — `import os`; `from dataclasses import dataclass`; `@dataclass(frozen=True) class Settings: debug: bool; port: int; db_url: str`; `def load_settings() -> Settings: return Settings(debug=os.environ.get("APP_DEBUG", "false").lower() == "true", port=int(os.environ.get("APP_PORT", "8000")), db_url=os.environ.get("APP_DB_URL", "sqlite:///local.db"))`; `os.environ["APP_PORT"] = "9000"` (simulates the environment for the demo); `print(load_settings())`; output `Settings(debug=False, port=9000, db_url='sqlite:///local.db')` (assumes `APP_DEBUG` and `APP_DB_URL` are not set).
- Production use: Twelve-factor apps; secrets injected by the platform (Kubernetes secrets, CI secrets).
- Common mistakes: Committing secrets; forgetting env values are strings (`"false"` is truthy); reading env vars all over the code instead of one settings module.
- Sources: https://docs.python.org/3/library/os.html#os.environ ; https://docs.astral.sh/uv/reference/cli/#uv-run ; https://12factor.net/config

### Workspaces for multi-package repos
- Concept: A workspace is one repo with several related packages sharing one `uv.lock`. Root `pyproject.toml`: `[tool.uv.workspace] members = ["packages/*"]`; depend on a sibling via `[tool.uv.sources] core = { workspace = true }`. `uv run --package api ...` targets one member. Use when packages are developed together; separate repos when they're released independently.
- Analogy: An apartment building: separate flats (packages), one shared foundation and utility meter (lockfile).
- Code example: root `pyproject.toml` (`toml`) — `[project]` name `platform` ... `dependencies = ["api", "core"]` / `[tool.uv.sources]` `api = { workspace = true }` / `core = { workspace = true }` / `[tool.uv.workspace]` `members = ["packages/*"]`; output `""`. `bash` — `uv run --package api pytest`; output `""`.
- Production use: Monorepos with a shared core library plus several services.
- Common mistakes: Using a workspace for unrelated projects needing different dependency versions (one lockfile forces compatible versions); forgetting `workspace = true` (uv looks on PyPI instead).
- Sources: https://docs.astral.sh/uv/concepts/projects/workspaces/

## Quiz
1. Which flag makes `uv sync` fail if the lockfile is out of date? — tests --locked
2. Why install dependencies before copying code in a Dockerfile? — tests layer caching
3. What is wrong with `if os.environ.get("DEBUG", "false"):`? — tests env strings truthiness
4. What do workspace members share? — tests workspaces (one lockfile)
5. Should `.env` with secrets be committed? — tests secret handling
