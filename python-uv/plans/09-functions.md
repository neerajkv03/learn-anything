# 09. Functions
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 08-comprehensions-unpacking

## Learning goals
- After this topic, learner can define functions with `def`, return values, and write docstrings.
- After this topic, learner can use default parameter values and keyword arguments, and avoid mutable defaults.
- After this topic, learner can accept variable arguments with `*args` and `**kwargs`.
- After this topic, learner can use keyword-only (`*`) and positional-only (`/`) parameters.
- After this topic, learner can explain local vs global scope and write simple lambdas.

## Sub-topics
### Defining and returning
- Concept: A function is a named, reusable block. `def name(params):`, body indented, `return value`. No return → returns `None`. Parameters (names in def) vs arguments (values passed). Docstring = first string in the body describing the function.
- Analogy: A vending machine: put in inputs (coins + choice), get an output (snack), the inner workings hidden.
- Code example: `area.py` — `def rectangle_area(width, height):` docstring `"""Return the area of a rectangle."""`, `return width * height`; `print(rectangle_area(3, 4))`; `def greet(name): print(f"Hi {name}")`; `result = greet("Ada")`; `print(result)`; output `12\nHi Ada\nNone`.
- Production use: Every codebase is organised into small, testable functions.
- Common mistakes: Printing instead of returning; forgetting parentheses when calling; code after `return` never runs.
- Sources: https://docs.python.org/3/tutorial/controlflow.html#defining-functions

### Parameters and defaults
- Concept: Defaults `def f(x, retries=3)`; keyword arguments `f(x, retries=5)` make calls readable. Default values are created once — never use a mutable default like `[]`; use `None` then create inside.
- Analogy: Coffee order: size defaults to "medium" unless you say otherwise.
- Code example: `defaults.py` — `def connect(host, port=5432, timeout=10): return f"{host}:{port} (timeout={timeout})"`; `print(connect("db"))`; `print(connect("db", timeout=30))`; `def add_tag(tag, tags=None): if tags is None: tags = []; tags.append(tag); return tags`; `print(add_tag("a"))`; `print(add_tag("b"))`; output `db:5432 (timeout=10)\ndb:5432 (timeout=30)\n['a']\n['b']`.
- Production use: Library APIs with sensible defaults and keyword options.
- Common mistakes: `def f(items=[])` shares one list across calls; positional argument after keyword argument (SyntaxError).
- Sources: https://docs.python.org/3/tutorial/controlflow.html#default-argument-values ; https://docs.python.org/3/tutorial/controlflow.html#keyword-arguments

### *args and **kwargs
- Concept: `*args` collects extra positional arguments into a tuple; `**kwargs` collects extra keyword arguments into a dict. `*`/`**` at call site unpack.
- Analogy: A "bring anything" potluck table: any number of dishes (args), each optionally labelled (kwargs).
- Code example: `varargs.py` — `def total(*numbers): return sum(numbers)`; `print(total(1, 2, 3))`; `def describe(**info): return ", ".join(f"{k}={v}" for k, v in info.items())`; `print(describe(name="Ada", role="admin"))`; `values = [4, 5]`; `print(total(*values))`; output `6\nname=Ada, role=admin\n9`.
- Production use: Wrappers/decorators forwarding arguments; flexible logging and formatting helpers.
- Common mistakes: Overusing kwargs so callers can't tell what's accepted; forgetting `*` when passing a list.
- Sources: https://docs.python.org/3/tutorial/controlflow.html#arbitrary-argument-lists ; https://docs.python.org/3/tutorial/controlflow.html#unpacking-argument-lists

### Keyword-only and positional-only parameters
- Concept: Parameters after `*` must be passed by keyword; before `/` must be positional. Prevents confusing calls like `send(msg, True, False)`.
- Analogy: A form where some boxes must be labelled ("Signature:") so nobody puts a value in the wrong box.
- Code example: `special_params.py` — `def send(message, *, urgent=False, retries=1): return f"{message} urgent={urgent} retries={retries}"`; `print(send("hi", urgent=True))`; `def scale(value, /, factor=2): return value * factor`; `print(scale(5))`; `print(scale(5, factor=3))`; output `hi urgent=True retries=1\n10\n15`.
- Production use: Boolean flags and options are keyword-only in well-designed APIs.
- Common mistakes: Calling `send("hi", True)` → TypeError; misplacing `/` and `*`.
- Sources: https://docs.python.org/3/tutorial/controlflow.html#special-parameters

### Scope
- Concept: Names created inside a function are local and vanish after it returns. Functions can read global names; assigning to a global needs `global` (avoid — pass values and return results instead). Lookup order LEGB (Local, Enclosing, Global, Built-in).
- Analogy: What happens in a hotel room stays in the room; the lobby (global) is visible to everyone.
- Code example: `scope.py` — `rate = 0.1`; `def tax(amount): result = amount * rate; return result` (reads global `rate`); `print(tax(200))`; `counter = 0`; `def reset(): counter = 5; return counter` (creates a *local* `counter`, global untouched); `print(reset(), counter)`; output `20.0\n5 0`.
- Production use: Avoiding global mutable state makes code testable and thread-safe.
- Common mistakes: `UnboundLocalError` when assigning to a global name inside a function; relying on global variables.
- Sources: https://docs.python.org/3/tutorial/classes.html#python-scopes-and-namespaces ; https://docs.python.org/3/faq/programming.html#what-are-the-rules-for-local-and-global-variables-in-python

### Lambda
- Concept: `lambda args: expression` — a tiny unnamed function, one expression only. Best for short `key=` functions. Use `def` for anything bigger.
- Analogy: A sticky-note instruction vs a full manual.
- Code example: `lambda_demo.py` — `products = [("pen", 10), ("book", 250), ("bag", 900)]`, `cheapest = min(products, key=lambda p: p[1])`, `print(cheapest)`, `print(sorted(products, key=lambda p: -p[1])[0][0])`; output `('pen', 10)\nbag`.
- Production use: Sort keys, small callbacks.
- Common mistakes: Assigning a lambda to a name (use def); trying to put statements in a lambda.
- Sources: https://docs.python.org/3/tutorial/controlflow.html#lambda-expressions

## Quiz
1. What does a function without `return` give back? — tests None return
2. Why is `def f(x=[])` dangerous? — tests mutable default
3. In `def f(a, *, b)`, how must `b` be passed? — tests keyword-only
4. Inside `f(*args)`, what type is `args`? — tests *args tuple
