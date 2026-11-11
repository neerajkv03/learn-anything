# 21. Code Quality Tooling
Version: Python 3.15.2 + uv 0.13.7 (Ruff and mypy: latest, installed by uv)
Prerequisites: 20-testing-pytest

## Learning goals
- After this topic, learner can lint code with Ruff and auto-fix safe issues.
- After this topic, learner can format code with `ruff format` and check formatting in CI.
- After this topic, learner can run a type checker across a whole project as a dev dependency.
- After this topic, learner can choose between `uvx`, `uv tool install`, and project dev dependencies.
- After this topic, learner can configure Ruff, mypy, and pytest in `pyproject.toml`.

## Sub-topics
### Linting with Ruff
- Concept: A linter reads code without running it and flags likely bugs and style problems (unused imports, undefined names). Ruff (by Astral, same team as uv) is a very fast linter. `uv run ruff check .`; `--fix` applies safe fixes.
- Analogy: A proof-reader marking errors in red before the book goes to print.
- Code example: `messy.py` — `import os`, `import sys` (unused `os`); `def total(items): return sum(items)`; `print(total([1, 2]))`; output `3`. Then `bash` — `uv run ruff check messy.py`; representative output `messy.py:1:8: F401 [*] `os` imported but unused` / `Found 1 error.` / `[*] 1 fixable with the `--fix` option.` (exact layout varies by Ruff version).
- Production use: Lint runs in CI and pre-commit; PRs must pass.
- Common mistakes: Silencing rules with `# noqa` instead of fixing; enabling every rule at once on an old codebase.
- Sources: https://docs.astral.sh/ruff/linter/ ; https://docs.astral.sh/ruff/rules/

### Formatting with Ruff
- Concept: A formatter rewrites code layout (spacing, quotes, line breaks) to one consistent style, so reviews focus on logic. `uv run ruff format .`; `ruff format --check` fails if files need formatting (for CI).
- Analogy: A uniform: everyone looks the same, so you notice what actually matters.
- Code example: `before.py` — `x=[1,2 ,3]` / `def f( a ):return a*2` / `print(f(x[0]))`; output `2`. `after.py` — same code formatted (`x = [1, 2, 3]`, `def f(a):` / `    return a * 2`, two blank lines rules); output `2`. `bash` — `uv run ruff format .`; output `""`.
- Production use: Formatting is automatic and non-negotiable in most teams.
- Common mistakes: Mixing two formatters (e.g. Black and Ruff) with different settings; manually arguing about style.
- Sources: https://docs.astral.sh/ruff/formatter/

### Type checking in a project
- Concept: In a project, add the checker as a dev dependency so everyone uses the same version: `uv add --dev mypy`, run `uv run mypy src/` (or `.`). Strictness can grow over time (`strict = true`).
- Analogy: Every inspector on the team uses the same edition of the rulebook.
- Code example: `bash` — `uv add --dev mypy ruff` then `uv run mypy .`; representative output `Success: no issues found in 3 source files`.
- Production use: CI job: `uv run ruff check`, `uv run ruff format --check`, `uv run mypy`, `uv run pytest`.
- Common mistakes: Running a globally installed checker with a different version than CI; turning on strict mode on day one for a large legacy codebase.
- Sources: https://mypy.readthedocs.io/en/stable/getting_started.html ; https://mypy.readthedocs.io/en/stable/existing_code.html

### uvx vs uv tool install
- Concept: `uvx ruff check` (alias of `uv tool run`) runs a tool in a temporary, cached environment — good for one-off use. `uv tool install ruff` installs a tool permanently on your PATH, isolated from projects. Project dev dependencies pin the version for the team. Rule: project checks → dev dependency; personal utilities → `uv tool install`; try-once → `uvx`.
- Analogy: Renting a tool for a day (uvx), buying one for your own garage (tool install), or the company-issued kit everyone shares (dev dependency).
- Code example: `bash` — `uvx ruff --version`, `uv tool install ruff`, `uv tool list`, `uv tool upgrade ruff`; output `""`.
- Production use: CI uses project dev dependencies (pinned in `uv.lock`) for reproducible results.
- Common mistakes: Expecting `uvx` tools to see the project's installed packages (use `uv run` for that); using different Ruff versions locally and in CI.
- Sources: https://docs.astral.sh/uv/guides/tools/ ; https://docs.astral.sh/uv/concepts/tools/

### Configuring tools in pyproject.toml
- Concept: Ruff: `[tool.ruff]` (`line-length`, `target-version`), `[tool.ruff.lint]` (`select = ["E", "F", "I", "B", "UP"]`); mypy: `[tool.mypy]` (`strict = true`); pytest: `[tool.pytest.ini_options]`. One file = one source of truth.
- Analogy: One house rulebook pinned on the fridge instead of notes scattered across rooms.
- Code example: `pyproject.toml` (`toml`) — `[tool.ruff]` `line-length = 100` / `[tool.ruff.lint]` `select = ["E", "F", "I", "B", "UP"]` / `[tool.mypy]` `strict = true` / `[tool.pytest.ini_options]` `testpaths = ["tests"]`; output `""`.
- Production use: Shared, versioned tool config reviewed like code.
- Common mistakes: Config in several files (`setup.cfg`, `.flake8`) that conflict; `target-version` not matching `requires-python`.
- Sources: https://docs.astral.sh/ruff/configuration/ ; https://mypy.readthedocs.io/en/stable/config_file.html

## Quiz
1. Difference between a linter and a formatter? — tests linting vs formatting
2. What does `ruff format --check` do in CI? — tests format check
3. When is `uvx` the right choice? — tests uvx vs tool install vs dev dep
4. Where do you configure Ruff in a uv project? — tests pyproject config
