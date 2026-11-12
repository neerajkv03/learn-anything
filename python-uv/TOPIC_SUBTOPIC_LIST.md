# Python (uv) + FastAPI & SQLite Learning Path (vPython 3.15.2 + uv 0.13.7 + FastAPI 0.162.5 + Pydantic 2.14.3 + Uvicorn 0.54.0 + SQLModel 0.0.49 + HTTPX 0.28.1 + SQLite 3.54.1 + pydantic-settings 2.16.2 + pwdlib 0.3.1 + PyJWT 2.15.1)

Version checked: Python 3.15.2 + uv 0.13.7 on 2026-11-11 via https://www.python.org/downloads/ and https://github.com/astral-sh/uv/releases; FastAPI 0.162.5, Pydantic 2.14.3, Uvicorn 0.54.0, SQLModel 0.0.49, HTTPX 0.28.1 on 2026-11-12 via https://pypi.org/project/<name>/; SQLite 3.54.1 on 2026-11-12 via https://www.sqlite.org/changes.html; pydantic-settings 2.16.2, pwdlib 0.3.1, PyJWT 2.15.1 on 2026-11-12 via https://pypi.org/project/<name>/
Approved: list ✓ | plans ✓
App: done | App verified: done

| # | Topic | Slug | Sub-topics | Plan | Content | Verified |
|---|-------|------|------------|------|---------|----------|
| 01 | Setup with uv | 01-setup-with-uv | What Python and uv are; Installing uv; Installing Python with uv; Running a script with uv run; The interactive REPL; Your first program with print | done | done | done |
| 02 | Variables & Types | 02-variables-types | Variables and assignment; Numbers (int, float); Strings basics; Booleans and None; Type conversion; Comments | done | done | done |
| 03 | Operators & Expressions | 03-operators-expressions | Arithmetic operators; Comparison operators; Logical operators; Augmented assignment; Operator precedence | done | done | done |
| 04 | Strings in Depth | 04-strings | Indexing and slicing; Common string methods; f-strings and formatting; Escapes and multiline strings; Immutability | done | done | done |
| 05 | Control Flow | 05-control-flow | if / elif / else; Truthiness; Conditional expressions; match statement | done | done | done |
| 06 | Loops | 06-loops | for loops and range; while loops; break and continue; enumerate and zip | done | done | done |
| 07 | Collections | 07-collections | Lists; Tuples; Dictionaries; Sets; Choosing the right collection | done | done | done |
| 08 | Comprehensions & Unpacking | 08-comprehensions-unpacking | List comprehensions; Dict and set comprehensions; Generator expressions; Unpacking and star-unpacking; Sorting with key functions | done | done | done |
| 09 | Functions | 09-functions | Defining and returning; Parameters and defaults; *args and **kwargs; Keyword-only and positional-only parameters; Scope; Lambda | done | done | done |
| 10 | Type Hints | 10-type-hints | Annotating variables and functions; Collection types; Unions and optional values; Type aliases with type; Checking types with a type checker via uvx | done | done | done |
| 11 | Error Handling | 11-error-handling | What exceptions are; try / except / else / finally; Raising exceptions; Custom exception classes; Exception chaining | done | done | done |
| 12 | Modules & Imports | 12-modules-imports | import and from-import; Writing your own module; if __name__ == "__main__"; Packages and __init__.py; Standard library tour | done | done | done |
| 13 | uv Projects & Dependencies | 13-uv-projects | uv init; pyproject.toml; uv add and uv remove; uv.lock and uv sync; Dependency groups (dev dependencies); Pinning Python with .python-version | done | done | done |
| 14 | Files, Paths & Data Formats | 14-files-paths-data | pathlib paths; Reading and writing text files; The with statement; JSON; CSV | done | done | done |
| 15 | Classes & Objects | 15-classes-objects | Classes and instances; __init__ and attributes; Methods; Properties; Inheritance and super(); Special methods (__repr__, __eq__, __len__) | done | done | done |
| 16 | Dataclasses & Enums | 16-dataclasses-enums | @dataclass basics; Defaults and field(); Frozen dataclasses; Enum | done | done | done |
| 17 | Iterators & Generators | 17-iterators-generators | The iteration protocol; Generator functions and yield; Lazy pipelines; itertools essentials | done | done | done |
| 18 | Decorators & Context Managers | 18-decorators-context-managers | Functions as objects; Closures; Writing decorators; functools.wraps; Context managers with contextlib | done | done | done |
| 19 | Standard Library Essentials | 19-stdlib-essentials | collections (Counter, defaultdict, deque); datetime and zoneinfo; logging; argparse command-line tools; functools caching | done | done | done |
| 20 | Testing with pytest | 20-testing-pytest | Adding pytest with uv add --dev; Writing tests with assert; Fixtures; Parametrize; Testing exceptions; Running tests with uv run pytest | done | done | done |
| 21 | Code Quality Tooling | 21-code-quality | Linting with Ruff; Formatting with Ruff; Type checking in a project; uvx vs uv tool install; Configuring tools in pyproject.toml | done | done | done |
| 22 | Concurrency & asyncio | 22-concurrency-asyncio | Concurrency vs parallelism; Threads with concurrent.futures; Processes for CPU-bound work; async and await; asyncio.gather and TaskGroup | done | done | done |
| 23 | Scripts & Packaging | 23-scripts-packaging | Single-file scripts with inline metadata (PEP 723); Entry points ([project.scripts]); Building with uv build; Installing CLI tools with uv tool; Publishing with uv publish | done | done | done |
| 24 | Production Workflow | 24-production-workflow | Reproducible installs (uv sync --locked / --frozen); uv in CI; uv in Docker; Environment variables and configuration; Workspaces for multi-package repos | done | done | done |
| 25 | SQLite with sqlite3 | 25-sqlite-sqlite3 | What a database and SQL are; Connecting and creating tables; Inserting and querying rows; Parameterized queries and SQL injection; Transactions (commit / rollback); Row factories and closing connections | done | done | done |
| 26 | HTTP & Web API Basics | 26-http-api-basics | Clients, servers, requests and responses; HTTP methods; Status codes; URLs, paths and query strings; JSON bodies and headers; REST resource design | done | done | done |
| 27 | Pydantic Models | 27-pydantic-models | BaseModel and typed fields; Validation and ValidationError; Field constraints with Field(); Nested models; Serializing with model_dump / model_dump_json | done | done | done |
| 28 | FastAPI First App | 28-fastapi-first-app | Adding fastapi[standard] with uv add; Path operations (@app.get); Running with fastapi dev and fastapi run; Interactive docs (/docs); Path parameters; Query parameters | done | done | done |
| 29 | Request Bodies & Responses | 29-fastapi-requests-responses | Request bodies with Pydantic models; response_model and return types; Status codes; HTTPException; Validation errors (422); Annotated with Query / Path validation | done | done | done |
| 30 | Dependency Injection | 30-fastapi-dependencies | What Depends does; Dependencies with yield; Sub-dependencies; Router- and app-level dependencies | done | done | done |
| 31 | Databases with SQLModel | 31-fastapi-sqlmodel | SQLModel table models; Engine and SQLite URL; Session dependency with yield; Create and read endpoints; Update and delete endpoints; Separate Create / Public / Update models | done | done | done |
| 32 | Structuring FastAPI Apps | 32-fastapi-structure | APIRouter and multi-file layout; Lifespan events (startup / shutdown); Configuration from environment variables; CORS middleware; Background tasks | done | done | done |
| 33 | Authentication Basics | 33-fastapi-auth | Authentication vs authorization; OAuth2PasswordBearer and the Authorization header; Password hashing (pwdlib); JWT access tokens (PyJWT); Current-user dependency | done | done | done |
| 34 | Testing FastAPI Apps | 34-fastapi-testing | TestClient basics; Testing status codes and JSON; Overriding dependencies; In-memory SQLite test database; Fixtures for client and session | done | done | done |
| 35 | Async & Deployment | 35-fastapi-async-deploy | async def vs def endpoints; fastapi run and workers; Docker image with uv; SQLite in production (WAL, single writer, backups); Health-check endpoint | done | done | done |
