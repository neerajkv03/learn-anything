# 13. uv Projects & Dependencies
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 12-modules-imports

## Learning goals
- After this topic, learner can create a project with `uv init` and describe each generated file.
- After this topic, learner can read and edit the `[project]` table in `pyproject.toml`.
- After this topic, learner can add and remove third-party packages with `uv add` / `uv remove` and explain the virtual environment (`.venv`).
- After this topic, learner can explain `uv.lock`, commit it, and reproduce an environment with `uv sync`.
- After this topic, learner can separate dev-only tools into dependency groups and pin the Python version.

## Sub-topics
### uv init
- Concept: A project is a folder uv manages as one unit. `uv init hello-app` creates `pyproject.toml`, `.python-version`, `README.md`, `main.py`, `.gitignore` (and a git repo). First `uv run` also creates `.venv/` (the project's private Python environment) and `uv.lock`. `uv init --package` creates an installable package in `src/`; `--lib` for a library.
- Analogy: Opening a new shop with a ready-made starter kit: sign, cash register, and stock list in place.
- Code example: `bash` — `uv init hello-app`, `cd hello-app`, `uv run main.py`; representative output `Hello from hello-app!`. Second example `main.py` (generated) — `def main():` / `print("Hello from hello-app!")` / guard; output `Hello from hello-app!`.
- Production use: Every new service or tool starts from `uv init`, giving a standard layout teams recognise.
- Common mistakes: Running `uv init` inside an existing project folder by accident; deleting `.python-version`/`pyproject.toml` thinking they're clutter.
- Sources: https://docs.astral.sh/uv/guides/projects/ ; https://docs.astral.sh/uv/concepts/projects/init/

### pyproject.toml
- Concept: The standard project file (TOML format = simple `key = value` config with `[sections]`). `[project]`: `name`, `version`, `description`, `readme`, `requires-python`, `dependencies`. Tools (ruff, pytest, mypy) also read their settings from `[tool.*]` tables here.
- Analogy: The shop's licence and inventory sheet: name, opening date, and the suppliers it relies on.
- Code example: `pyproject.toml` (language `toml`) — `[project]` / `name = "hello-app"` / `version = "0.1.0"` / `description = "Add your description here"` / `readme = "README.md"` / `requires-python = ">=3.15"` / `dependencies = []`; output `""`.
- Production use: One file declares metadata, dependencies, and tool config for the whole repo.
- Common mistakes: Editing dependencies by hand and forgetting to re-lock (prefer `uv add`); invalid TOML (missing quotes).
- Sources: https://docs.astral.sh/uv/concepts/projects/layout/ ; https://packaging.python.org/en/latest/guides/writing-pyproject-toml/

### uv add and uv remove
- Concept: A package (dependency) is code someone else published to PyPI (the Python Package Index). `uv add httpx` adds it to `dependencies`, updates `uv.lock`, and installs it into `.venv`. Version constraints: `uv add "httpx>=0.27"`. `uv remove httpx` undoes it. `uv tree` shows the dependency tree.
- Analogy: Adding a supplier to the shop's contract list — the order form, the warehouse, and the paperwork update together.
- Code example: `bash` — `uv add httpx`, `uv remove httpx`; output `""`. Plus `toml` snippet showing `dependencies = ["httpx>=0.28.1"]` with explanation that uv writes a lower bound for the version it resolved (exact number will vary).
- Production use: All dependency changes go through `uv add/remove` so pyproject and lockfile never drift.
- Common mistakes: Using `pip install` inside a uv project (not recorded in pyproject/lock); committing `.venv/`.
- Sources: https://docs.astral.sh/uv/concepts/projects/dependencies/ ; https://docs.astral.sh/uv/guides/projects/#managing-dependencies

### uv.lock and uv sync
- Concept: `uv.lock` records the exact version (and hashes) of every package, including dependencies of dependencies, for all platforms. Commit it. `uv sync` makes `.venv` match the lockfile exactly; `uv run` syncs automatically. `uv lock --upgrade-package httpx` upgrades one package deliberately.
- Analogy: A photo of the exact shelf arrangement, so any branch can rebuild the shop identically.
- Code example: `bash` — `git clone ...` (placeholder), `uv sync`, `uv run main.py`; and `uv lock --upgrade-package httpx`; output `""`.
- Production use: Reproducible builds — laptops, CI, and servers install identical versions.
- Common mistakes: Not committing `uv.lock`; editing it by hand (it is generated); upgrading everything at once without testing.
- Sources: https://docs.astral.sh/uv/concepts/projects/sync/ ; https://docs.astral.sh/uv/concepts/projects/layout/#the-lockfile

### Dependency groups (dev dependencies)
- Concept: Tools needed only while developing (test runner, linter) go in groups (PEP 735): `uv add --dev pytest` writes `[dependency-groups] dev = [...]`; custom: `uv add --group lint ruff`. The `dev` group is installed by default; `uv sync --no-dev` skips it for production.
- Analogy: Workshop tools stay in the workshop; only the finished furniture is delivered to the customer.
- Code example: `bash` — `uv add --dev pytest`; `toml` — `[dependency-groups]` / `dev = ["pytest>=8.4"]` (representative lower bound); `bash` — `uv sync --no-dev`; outputs `""`.
- Production use: Production images install only runtime dependencies — smaller and safer.
- Common mistakes: Putting pytest in runtime `dependencies`; forgetting `--no-dev` in production builds.
- Sources: https://docs.astral.sh/uv/concepts/projects/dependencies/#development-dependencies ; https://peps.python.org/pep-0735/

### Pinning Python with .python-version
- Concept: `uv python pin 3.15` writes `.python-version`; uv uses that version for the project. `requires-python` in pyproject states which versions the project supports. Both should agree.
- Analogy: A sign on the workshop door: "All work here uses tool model 3.15."
- Code example: `bash` — `uv python pin 3.15`, `uv run python --version`; representative output `Python 3.15.2`. `check_version.py` — `import sys` / `print(sys.version_info[:2] >= (3, 15))`; output `True`.
- Production use: Team, CI, and Docker image all use the same Python minor version.
- Common mistakes: Pin and `requires-python` disagree; pinning a full patch version unnecessarily.
- Sources: https://docs.astral.sh/uv/concepts/python-versions/#project-python-versions ; https://docs.astral.sh/uv/reference/cli/#uv-python-pin

## Quiz
1. Which file records exact versions of all packages? — tests uv.lock
2. What does `uv sync` do? — tests sync
3. Where does `uv add --dev pytest` put pytest? — tests dependency groups
4. Should `.venv/` be committed to git? — tests venv understanding
5. What command creates a new project? — tests uv init
