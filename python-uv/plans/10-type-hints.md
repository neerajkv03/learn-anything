# 10. Type Hints
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 09-functions

## Learning goals
- After this topic, learner can annotate variables, parameters, and return values.
- After this topic, learner can annotate collections with built-in generics (`list[str]`, `dict[str, int]`).
- After this topic, learner can express optional and union values with `X | None`.
- After this topic, learner can declare type aliases with the `type` statement.
- After this topic, learner can run a type checker (mypy) on a file with `uvx`.

## Sub-topics
### Annotating variables and functions
- Concept: Type hints describe what types a value should have: `name: str = "Ada"`, `def area(w: float, h: float) -> float:`. Python does **not** enforce hints at run time; tools and editors use them to catch bugs early.
- Analogy: Labels on storage jars ("Sugar") — the jar won't stop you putting salt in, but anyone reading (or a checker) will notice.
- Code example: `hints.py` — `max_users: int = 100`; `def greet(name: str, times: int = 1) -> str: return ", ".join(["Hi " + name] * times)`; `print(greet("Ada", 2))`; `print(greet("Bo"))`; `print(max_users)`; output `Hi Ada, Hi Ada\nHi Bo\n100`.
- Production use: Most production Python is type-hinted; editors autocomplete from hints.
- Common mistakes: Believing hints are checked at run time; annotating `-> None` functions as returning something.
- Sources: https://docs.python.org/3/library/typing.html ; https://peps.python.org/pep-0484/

### Collection types
- Concept: Use built-in generics: `list[int]`, `dict[str, float]`, `set[str]`, `tuple[int, int]`, `tuple[str, ...]`. For read-only inputs accept broad types from `collections.abc` (e.g. `Iterable[int]`, `Mapping[str, int]`).
- Analogy: A labelled egg carton: not just "a box", but "a box of eggs".
- Code example: `collection_hints.py` — `from collections.abc import Iterable`; `def average(values: Iterable[float]) -> float: items = list(values); return sum(items) / len(items)`; `scores: dict[str, list[int]] = {"ada": [90, 80], "bo": [70]}`; `print(average(scores["ada"]))`; `point: tuple[int, int] = (3, 4)`; `print(point)`; output `85.0\n(3, 4)`.
- Production use: Function signatures in APIs and services document data shapes.
- Common mistakes: Old `typing.List`/`typing.Dict` style (deprecated aliases); `tuple[int]` meaning exactly one int.
- Sources: https://docs.python.org/3/library/stdtypes.html#types-genericalias ; https://docs.python.org/3/library/collections.abc.html

### Unions and optional values
- Concept: `int | str` = either type. `str | None` = may be missing (preferred over `Optional[str]`). Check for `None` before use (narrowing).
- Analogy: A parking spot labelled "car or motorbike"; "or empty" if nothing may be there.
- Code example: `optional.py` — `def find_user(user_id: int) -> str | None: users = {1: "Ada", 2: "Linus"}; return users.get(user_id)`; `name = find_user(3)`; `if name is None: print("not found") else: print(name.upper())`; `print(find_user(1))`; output `not found\nAda`.
- Production use: Database lookups and optional config values return `X | None`.
- Common mistakes: Calling methods on a possibly-None value; using `Optional` to mean "parameter with a default".
- Sources: https://peps.python.org/pep-0604/ ; https://docs.python.org/3/library/typing.html#typing.Optional

### Type aliases with type
- Concept: `type UserId = int` and `type Matrix = list[list[float]]` give names to complex types (Python 3.12+ `type` statement). Generic functions `def first[T](items: list[T]) -> T:` (PEP 695 syntax) — introduce briefly.
- Analogy: Calling a "two-bedroom flat with balcony" simply a "Type B unit".
- Code example: `aliases.py` — `type Point = tuple[float, float]`; `def distance(a: Point, b: Point) -> float: return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5`; `print(distance((0, 0), (3, 4)))`; `def first[T](items: list[T]) -> T: return items[0]`; `print(first(["x", "y"]))`; output `5.0\nx`.
- Production use: Domain names for types (`UserId`, `JSON`) make signatures readable.
- Common mistakes: Thinking an alias creates a new, checked type (use `NewType` for that); using old `TypeAlias` form in new code.
- Sources: https://docs.python.org/3/reference/simple_stmts.html#the-type-statement ; https://peps.python.org/pep-0695/

### Checking types with a type checker via uvx
- Concept: A type checker reads code without running it and reports type errors. `uvx mypy app.py` downloads and runs mypy in a temporary environment (uvx = `uv tool run`). In projects, add it as a dev dependency (topic 13/21).
- Analogy: A spell checker for types — it underlines mistakes before you send the letter.
- Code example: `buggy.py` — `def double(n: int) -> int: return n * 2`; `print(double("4"))` — runs and prints `44` (shows hints aren't enforced). Then `bash` — `uvx mypy buggy.py`; representative output `buggy.py:4: error: Argument 1 to "double" has incompatible type "str"; expected "int"  [arg-type]` / `Found 1 error in 1 file (checked 1 source file)`.
- Production use: CI runs a type checker on every pull request.
- Common mistakes: Ignoring checker errors with `# type: ignore` everywhere; expecting the checker to run your code.
- Sources: https://mypy.readthedocs.io/en/stable/getting_started.html ; https://docs.astral.sh/uv/guides/tools/

## Quiz
1. Does Python stop `greet(5)` when `name: str`? — tests no runtime enforcement
2. How do you hint "string or nothing"? — tests `str | None`
3. What does `uvx mypy app.py` do? — tests uvx + type checker
4. Which is the modern list hint: `List[int]` or `list[int]`? — tests built-in generics
