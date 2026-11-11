# 18. Decorators & Context Managers
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 17-iterators-generators

## Learning goals
- After this topic, learner can pass functions as values and return them from other functions.
- After this topic, learner can explain closures (inner functions remembering outer variables).
- After this topic, learner can write and apply a decorator with `@`, including one that takes arguments.
- After this topic, learner can preserve function metadata with `functools.wraps`.
- After this topic, learner can write context managers with `contextlib.contextmanager` and use `contextlib.suppress`.

## Sub-topics
### Functions as objects
- Concept: Functions are values: assign them to names, store them in dicts, pass them to other functions (higher-order functions), return them.
- Analogy: A recipe card can be photocopied, handed to a friend, or filed — the card itself is a thing.
- Code example: `first_class.py` — `def shout(text: str) -> str: return text.upper()`; `def whisper(text: str) -> str: return text.lower()`; `actions = {"loud": shout, "quiet": whisper}`; `print(actions["loud"]("Hello"))`; `def apply(func, value): return func(value)`; `print(apply(whisper, "HeLLo"))`; output `HELLO\nhello`.
- Production use: Dispatch tables, callbacks, strategy selection.
- Common mistakes: Calling the function when passing it (`apply(shout(), ...)`).
- Sources: https://docs.python.org/3/glossary.html#term-function ; https://docs.python.org/3/howto/functional.html

### Closures
- Concept: An inner function remembers variables from the function it was created in, even after that outer function has returned. `nonlocal` lets the inner function reassign them.
- Analogy: A backpack packed at home: the hiker carries those supplies wherever they go.
- Code example: `closures.py` — `def make_multiplier(factor: int): def multiply(x: int) -> int: return x * factor; return multiply`; `double = make_multiplier(2)`; `triple = make_multiplier(3)`; `print(double(5), triple(5))`; `def make_counter(): count = 0; def increment() -> int: nonlocal count; count += 1; return count; return increment`; `c = make_counter()`; `c(); c()`; `print(c())`; output `10 15\n3`.
- Production use: Configured callbacks, decorators (next sub-topic).
- Common mistakes: Forgetting `nonlocal` → `UnboundLocalError`; closures in loops capturing the last value.
- Sources: https://docs.python.org/3/reference/executionmodel.html#naming-and-binding ; https://docs.python.org/3/reference/simple_stmts.html#the-nonlocal-statement

### Writing decorators
- Concept: A decorator is a function that takes a function and returns a new function that adds behaviour around it. `@decorator` above `def` is shorthand for `func = decorator(func)`. Use `*args, **kwargs` to forward arguments. Decorators with arguments add one more outer layer.
- Analogy: Gift wrapping: the gift is unchanged, but the wrapping adds something around it.
- Code example: `decorators.py` — `def log_calls(func): def wrapper(*args, **kwargs): print(f"calling {func.__name__}{args}"); result = func(*args, **kwargs); print(f"{func.__name__} returned {result}"); return result; return wrapper`; `@log_calls def add(a: int, b: int) -> int: return a + b`; `add(2, 3)`; second example `def repeat(times: int):` decorator factory; `@repeat(2) def hello(): print("hello")`; `hello()`; output `calling add(2, 3)\nadd returned 5\nhello\nhello`.
- Production use: Logging, retries, caching, authentication checks, web framework routes (`@app.get("/")`).
- Common mistakes: Forgetting to `return wrapper` or to return the result; writing `@log_calls()` for a decorator without arguments.
- Sources: https://docs.python.org/3/glossary.html#term-decorator ; https://peps.python.org/pep-0318/

### functools.wraps
- Concept: Without `@functools.wraps(func)`, the wrapper hides the original function's name and docstring (breaks debugging, docs, and some frameworks). Always use it.
- Analogy: Keeping the original label visible on a wrapped gift so everyone knows what's inside.
- Code example: `wraps_demo.py` — two decorators `plain` (no wraps) and `proper` (with `@wraps(func)`); apply to `def greet(): """Say hi."""`; print `__name__` and `__doc__` for each; output `wrapper None\ngreet Say hi.`.
- Production use: Standard in every production decorator.
- Common mistakes: Applying `@wraps` to the outer function instead of the inner wrapper.
- Sources: https://docs.python.org/3/library/functools.html#functools.wraps

### Context managers with contextlib
- Concept: A context manager sets something up before a `with` block and tears it down after, even on error. `@contextlib.contextmanager` turns a generator into one: code before `yield` = setup, after = cleanup (in `try/finally`). `contextlib.suppress(FileNotFoundError)` ignores a specific error.
- Analogy: A hotel key card: activated at check-in, automatically deactivated at check-out.
- Code example: `ctx.py` — `from contextlib import contextmanager, suppress`; `@contextmanager def section(name: str): print(f"<{name}>"); try: yield; finally: print(f"</{name}>")`; `with section("report"): print("body")`; `with suppress(KeyError): {}["missing"]`; `print("still running")`; output `<report>\nbody\n</report>\nstill running`.
- Production use: Database transactions, temporary settings, timing blocks, acquiring locks.
- Common mistakes: Missing `try/finally` so cleanup skips on error; yielding more than once.
- Sources: https://docs.python.org/3/library/contextlib.html

## Quiz
1. `@log_calls` above `def f` is shorthand for? — tests decorator syntax
2. What problem does `functools.wraps` solve? — tests wraps
3. What keyword lets an inner function reassign an outer variable? — tests nonlocal
4. In a `@contextmanager` generator, where does cleanup code go? — tests contextmanager
