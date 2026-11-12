# 34. Testing FastAPI Apps
Version: Python 3.15.2 + uv 0.13.7 + FastAPI 0.162.5 + SQLModel 0.0.49 + HTTPX 0.28.1
Prerequisites: 20-testing-pytest, 31-fastapi-sqlmodel, 33-fastapi-auth

## Learning goals
- After this topic, learner can call endpoints in tests with `TestClient`.
- After this topic, learner can assert status codes, JSON bodies and validation errors.
- After this topic, learner can replace dependencies in tests with `app.dependency_overrides`.
- After this topic, learner can use an isolated in-memory SQLite database per test.
- After this topic, learner can write `session` and `client` pytest fixtures with `yield`.

Layout for all examples: `main.py` (app) at project root, `tests/test_*.py`; `pyproject.toml` has `[tool.pytest.ini_options]` `pythonpath = ["."]` so tests can `from main import app` — show it once in sub-topic 1. pytest added with `uv add --dev pytest` (recap topic 20). Output for test runs = representative `uv run pytest -q` summary (`N passed`; timing varies).

## Sub-topics
### TestClient basics
- Concept: `TestClient(app)` (from `fastapi.testclient`, built on HTTPX — included in `fastapi[standard]`) sends requests to the app in memory: no server, no network. `client.get/post/patch/delete(url, json=..., params=..., headers=..., data=...)` → response with `.status_code`, `.json()`, `.headers`. Test functions are plain `def`, even for `async def` endpoints. Lifespan (topic 32) runs only with `with TestClient(app) as client:`.
- Analogy: A flight simulator: real controls, real instruments, but the plane never leaves the ground.
- Code example: `toml` — `[tool.pytest.ini_options]` / `pythonpath = ["."]`; output `""`. `main.py` — `from fastapi import FastAPI`; `app = FastAPI()`; `@app.get("/") def read_root() -> dict[str, str]: return {"message": "Hello World"}`; `tests/test_main.py` — `from fastapi.testclient import TestClient`; `from main import app`; `client = TestClient(app)`; `def test_root() -> None: response = client.get("/"); assert response.status_code == 200; assert response.json() == {"message": "Hello World"}`; `bash` `uv run pytest -q`; representative output `1 passed`.
- Production use: Fast API tests in CI (topic 24) on every push.
- Common mistakes: Starting a real server for tests; expecting lifespan startup without `with TestClient(app)`.
- Sources: https://fastapi.tiangolo.com/tutorial/testing/ ; https://fastapi.tiangolo.com/advanced/testing-events/

### Testing status codes and JSON
- Concept: Test happy path and failures: 201 + body for create, 404 + `detail`, 422 + error `loc`. Send JSON with `json=`, form data with `data=`, headers with `headers=`.
- Analogy: A checklist inspector: tries the right key, a wrong key, and no key, and writes down what each door did.
- Code example: `main.py` — items app: `ItemCreate(name: str, price: float)`; `items: dict[int, ItemCreate] = {}`; `@app.post("/items/", status_code=201) def create_item(item: ItemCreate) -> dict[str, int]: item_id = len(items) + 1; items[item_id] = item; return {"id": item_id}`; `@app.get("/items/{item_id}") def read_item(item_id: int) -> ItemCreate:` 404 `"Item not found"` if missing; `tests/test_items.py` — `def test_create_and_read()`: `r = client.post("/items/", json={"name": "Pen", "price": 1.5})`; `assert r.status_code == 201`; `item_id = r.json()["id"]`; `assert client.get(f"/items/{item_id}").json() == {"name": "Pen", "price": 1.5}`; `def test_missing_item()`: `r = client.get("/items/999")`; `assert r.status_code == 404`; `assert r.json() == {"detail": "Item not found"}`; `def test_invalid_price()`: `r = client.post("/items/", json={"name": "Pen", "price": "cheap"})`; `assert r.status_code == 422`; `assert r.json()["detail"][0]["loc"] == ["body", "price"]`; output `3 passed`.
- Production use: Regression tests for every endpoint contract.
- Common mistakes: Only testing the happy path; asserting exact `msg` text (fragile — assert `type`/`loc`); tests depending on each other's shared state (order-dependent).
- Sources: https://fastapi.tiangolo.com/tutorial/testing/#extended-testing-file

### Overriding dependencies
- Concept: `app.dependency_overrides[original] = replacement` makes FastAPI call the replacement in tests (fake user, fake settings, test DB). Key = the original function object. Reset with `app.dependency_overrides.clear()` after the test.
- Analogy: A stunt double: same scene, same script, different person for the risky part.
- Code example: `main.py` — `def get_current_user() -> dict[str, str]: raise HTTPException(status_code=401, detail="Not authenticated")` (stand-in for topic 33's real one); `@app.get("/users/me") def me(user: Annotated[dict[str, str], Depends(get_current_user)]) -> dict[str, str]: return user`; `tests/test_me.py` — `def fake_user() -> dict[str, str]: return {"username": "test-user"}`; `def test_me_with_override() -> None: app.dependency_overrides[get_current_user] = fake_user; response = client.get("/users/me"); app.dependency_overrides.clear(); assert response.json() == {"username": "test-user"}`; `def test_me_without_login() -> None: assert client.get("/users/me").status_code == 401`; output `2 passed`.
- Production use: Testing protected endpoints without real tokens; swapping external services for fakes.
- Common mistakes: Overriding with the function called (`fake_user()`) instead of the function; forgetting to clear (override leaks into other tests).
- Sources: https://fastapi.tiangolo.com/advanced/testing-dependencies/

### In-memory SQLite test database
- Concept: Tests must not touch the real `database.db`. Test engine: `create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)` — in-memory, fresh each time; `StaticPool` (from `sqlmodel.pool` / SQLAlchemy) = reuse one connection so every session sees the same in-memory DB. `SQLModel.metadata.create_all(test_engine)`, then override `get_session`.
- Analogy: A sandbox copy of the shop: break anything, it's thrown away after.
- Code example: `tests/test_db.py` — (uses topic 31 `main.py` with `Hero`, `HeroCreate`, `get_session`) `from fastapi.testclient import TestClient`; `from sqlmodel import Session, SQLModel, create_engine`; `from sqlmodel.pool import StaticPool`; `from main import app, get_session`; `engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)`; `SQLModel.metadata.create_all(engine)`; `def get_session_override(): with Session(engine) as session: yield session`; `app.dependency_overrides[get_session] = get_session_override`; `client = TestClient(app)`; `def test_create_hero() -> None: r = client.post("/heroes/", json={"name": "Ada", "secret_name": "Countess"}); assert r.status_code == 200; data = r.json(); assert data["name"] == "Ada"; assert data["id"] == 1; assert "secret_name" not in data`; output `1 passed`. Note: module-level override here; next sub-topic moves it into fixtures (cleaner).
- Production use: Fast isolated DB tests without a database server.
- Common mistakes: Missing `StaticPool` → `no such table` (each connection gets its own empty memory DB); testing against the dev database file.
- Sources: https://sqlmodel.tiangolo.com/tutorial/fastapi/tests/#configure-the-in-memory-database ; https://docs.sqlalchemy.org/en/20/core/pooling.html#sqlalchemy.pool.StaticPool

### Fixtures for client and session
- Concept: pytest fixtures with `yield` (recap topic 20): `session` fixture builds a fresh in-memory DB per test; `client` fixture takes `session`, overrides `get_session` to return it, yields `TestClient`, then clears overrides. Tests can add rows directly through `session` then call the API. `@pytest.fixture(name="session")` lets the function have a different name. Put shared fixtures in `tests/conftest.py`.
- Analogy: A stage crew that sets up a fresh set before every scene and strikes it after.
- Code example: `tests/conftest.py` — `import pytest`; `from fastapi.testclient import TestClient`; `from sqlmodel import Session, SQLModel, create_engine`; `from sqlmodel.pool import StaticPool`; `from main import app, get_session`; `@pytest.fixture(name="session") def session_fixture():` `engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)`; `SQLModel.metadata.create_all(engine)`; `with Session(engine) as session: yield session`; `@pytest.fixture(name="client") def client_fixture(session: Session):` `def get_session_override(): return session`; `app.dependency_overrides[get_session] = get_session_override`; `client = TestClient(app)`; `yield client`; `app.dependency_overrides.clear()`; `tests/test_heroes.py` — `from main import Hero`; `def test_read_heroes(session: Session, client: TestClient) -> None:` `session.add(Hero(name="Ada", secret_name="Countess"))`; `session.add(Hero(name="Bob", secret_name="Builder"))`; `session.commit()`; `data = client.get("/heroes/").json()`; `assert [h["name"] for h in data] == ["Ada", "Bob"]`; `def test_read_missing(client: TestClient) -> None: assert client.get("/heroes/1").status_code == 404`; output `2 passed`. Explain second test sees an empty DB (fresh fixture).
- Production use: Standard FastAPI + SQLModel test setup.
- Common mistakes: Sharing one DB across tests (order-dependent failures); not clearing overrides.
- Sources: https://sqlmodel.tiangolo.com/tutorial/fastapi/tests/#pytest-fixtures ; https://docs.pytest.org/en/stable/how-to/fixtures.html#yield-fixtures-recommended

## Quiz
1. Does `TestClient` need a running server? — tests in-memory requests
2. How do you make a protected endpoint return a fake user in a test? — tests dependency_overrides
3. Why `StaticPool` with `sqlite://`? — tests in-memory DB sharing
4. Why clear `app.dependency_overrides` after each test? — tests isolation
5. When does lifespan code run under TestClient? — tests `with TestClient(app)`
