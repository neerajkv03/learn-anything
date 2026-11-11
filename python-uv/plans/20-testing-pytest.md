# 20. Testing with pytest
Version: Python 3.15.2 + uv 0.13.7 (pytest: latest 8.x/9.x, installed by uv)
Prerequisites: 19-stdlib-essentials

## Learning goals
- After this topic, learner can explain why automated tests matter and add pytest as a dev dependency.
- After this topic, learner can write test functions using plain `assert`.
- After this topic, learner can share setup with fixtures, including the built-in `tmp_path`.
- After this topic, learner can run one test against many inputs with `@pytest.mark.parametrize`.
- After this topic, learner can test that code raises the right exception with `pytest.raises`.
- After this topic, learner can run and filter tests with `uv run pytest`.

## Sub-topics
### Adding pytest with uv add --dev
- Concept: A test is code that checks other code automatically. pytest is the standard Python test runner (third-party package). Add it only for development: `uv add --dev pytest`. Typical layout: code in `src/` or the project root, tests in `tests/test_*.py`.
- Analogy: A car's pre-delivery inspection checklist run on every car before it leaves the factory.
- Code example: `bash` — `uv add --dev pytest`; output `""`. `text` layout block: `pyproject.toml`, `calc.py`, `tests/test_calc.py`.
- Production use: Tests run on every commit in CI; untested code rarely passes review.
- Common mistakes: Adding pytest as a runtime dependency; test files not named `test_*.py` (not discovered).
- Sources: https://docs.pytest.org/en/stable/getting-started.html ; https://docs.astral.sh/uv/concepts/projects/dependencies/#development-dependencies

### Writing tests with assert
- Concept: Test functions start with `test_`; use plain `assert expression`. pytest rewrites asserts to show detailed values on failure. One behaviour per test; name tests after the behaviour.
- Analogy: A tasting spoon: you check one thing at a time and know exactly what's wrong.
- Code example: `calc.py` — `def add(a: int, b: int) -> int: return a + b` / `def is_even(n: int) -> bool: return n % 2 == 0`; output `""`. `test_calc.py` — `from calc import add, is_even`; `def test_add(): assert add(2, 3) == 5`; `def test_is_even(): assert is_even(4)`; `assert not is_even(7)`; output `""`.
- Production use: Unit tests for business logic form most of a test suite.
- Common mistakes: Tests that depend on each other's order; asserting on printed output instead of return values.
- Sources: https://docs.pytest.org/en/stable/how-to/assert.html

### Fixtures
- Concept: A fixture is a function marked `@pytest.fixture` that prepares data/resources; tests receive it by naming it as a parameter. `yield` fixtures run cleanup after the test. Built-in `tmp_path` gives a fresh temporary folder.
- Analogy: Stage crew setting up the set before each scene and clearing it after.
- Code example: `test_fixtures.py` — `import pytest`; `@pytest.fixture def cart() -> list[str]: return ["pen"]`; `def test_cart_starts_with_pen(cart): assert cart == ["pen"]`; `def test_write_file(tmp_path): p = tmp_path / "out.txt"; p.write_text("hi", encoding="utf-8"); assert p.read_text(encoding="utf-8") == "hi"`; output `""`.
- Production use: Database sessions, test clients, sample data shared across tests (often in `conftest.py`).
- Common mistakes: Calling a fixture directly like a function; sharing mutable state between tests via module globals.
- Sources: https://docs.pytest.org/en/stable/how-to/fixtures.html ; https://docs.pytest.org/en/stable/how-to/tmp_path.html

### Parametrize
- Concept: `@pytest.mark.parametrize("a,b,expected", [(1, 2, 3), (0, 0, 0)])` runs the same test for each case, each reported separately.
- Analogy: One exam question checked against many students' answers with the same marking scheme.
- Code example: `test_param.py` — `import pytest`; `def slugify(text: str) -> str: return "-".join(text.lower().split())`; `@pytest.mark.parametrize("text, expected", [("Hello World", "hello-world"), ("  Python  uv ", "python-uv"), ("One", "one")])` `def test_slugify(text, expected): assert slugify(text) == expected`; output `""`.
- Production use: Covering edge cases (empty input, boundaries) without copy-pasted tests.
- Common mistakes: Parameter names in the string not matching the function arguments.
- Sources: https://docs.pytest.org/en/stable/how-to/parametrize.html

### Testing exceptions
- Concept: `with pytest.raises(ValueError, match="positive"):` passes only if the block raises that exception (and the message matches the regex).
- Analogy: A fire drill: the test passes only if the alarm actually goes off.
- Code example: `test_errors.py` — `import pytest`; `def withdraw(balance: float, amount: float) -> float: if amount <= 0: raise ValueError("amount must be positive"); return balance - amount`; `def test_rejects_negative(): with pytest.raises(ValueError, match="positive"): withdraw(100, -5)`; output `""`.
- Production use: Verifying validation and error paths, which are where bugs hide.
- Common mistakes: Putting extra lines inside the `with` block; catching `Exception` instead of the specific type.
- Sources: https://docs.pytest.org/en/stable/how-to/assert.html#assertions-about-expected-exceptions ; https://docs.pytest.org/en/stable/reference/reference.html#pytest-raises

### Running tests with uv run pytest
- Concept: `uv run pytest` runs all tests in the project environment. `-q` quiet, `-k name` filter by name, `-x` stop at first failure, `path::test_name` single test. Exit code 0 = all passed (CI relies on this). Config in `[tool.pytest.ini_options]` in pyproject.toml.
- Analogy: Pressing one button to run the whole inspection line.
- Code example: `bash` — `uv run pytest -q`; representative output `.......                                                    [100%]` / `7 passed in 0.05s` (timing varies). `toml` — `[tool.pytest.ini_options]` / `testpaths = ["tests"]`; output `""`.
- Production use: Same command locally and in CI.
- Common mistakes: Running a globally installed pytest (wrong environment) instead of `uv run pytest`; ignoring failing tests.
- Sources: https://docs.pytest.org/en/stable/how-to/usage.html ; https://docs.pytest.org/en/stable/reference/customize.html#pyproject-toml

## Quiz
1. How must test files and functions be named for pytest to find them? — tests discovery
2. How does a test receive a fixture? — tests fixture injection
3. What does `pytest.raises(ValueError)` check? — tests exception testing
4. Which command runs tests in the uv project environment? — tests uv run pytest
