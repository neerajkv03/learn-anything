# 05. Control Flow
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 03-operators-expressions, 04-strings

## Learning goals
- After this topic, learner can branch with `if / elif / else` and correct indentation.
- After this topic, learner can predict which values are truthy or falsy.
- After this topic, learner can write a conditional expression (`a if cond else b`).
- After this topic, learner can use `match` with literal, OR, capture, and guard patterns.

## Sub-topics
### if / elif / else
- Concept: Blocks are defined by indentation (4 spaces) after a colon. Python checks conditions top to bottom and runs the first true branch only.
- Analogy: A road with signposts: take the first turning that matches your destination; `else` is the main road.
- Code example: `grade.py` — `score = 72`, if `>= 90` "A", elif `>= 70` "B", elif `>= 50` "C", else "F", print; output `B`.
- Production use: Validation and business rules (shipping cost by weight band).
- Common mistakes: Mixing tabs and spaces / wrong indentation (`IndentationError`); missing colon; ordering conditions so a broad one hides a narrow one.
- Sources: https://docs.python.org/3/tutorial/controlflow.html#if-statements

### Truthiness
- Concept: Every value is true or false in a condition. Falsy: `False`, `None`, `0`, `0.0`, `""`, empty list/dict/set/tuple. Everything else truthy. `if items:` checks "not empty".
- Analogy: A box is "true" if it has anything in it, "false" if it is empty.
- Code example: `truthy.py` — no loop (loops come in topic 06): `print(bool(0), bool(1))`, `print(bool(""), bool("hi"))`, `print(bool([]), bool([0]))`, `print(bool(None))`, then `cart = []` / `if cart: print("Checkout")` / `else: print("Cart is empty")`; output `False True\nFalse True\nFalse True\nFalse\nCart is empty`.
- Production use: Idiomatic emptiness checks; careful when `0` is a valid value (use `is None`).
- Common mistakes: `if count:` treating a legitimate 0 as missing; `if x == True`.
- Sources: https://docs.python.org/3/library/stdtypes.html#truth-value-testing

### Conditional expressions
- Concept: `value_if_true if condition else value_if_false` — a one-line choice that produces a value.
- Analogy: "Tea if it's cold, else juice" — one decision, one result.
- Code example: `ternary.py` — `items = 1`, `label = "item" if items == 1 else "items"`, `print(f"{items} {label}")`, `stock = 0`, `print("in stock" if stock else "sold out")`; output `1 item\nsold out`.
- Production use: Choosing labels, defaults, and small values inline.
- Common mistakes: Nesting several in one line (unreadable); forgetting the `else` part.
- Sources: https://docs.python.org/3/reference/expressions.html#conditional-expressions

### match statement
- Concept: `match` compares a value against patterns in `case` blocks: literals, `|` for OR, `_` wildcard, capture names, `if` guards, and simple sequence patterns. First matching case wins. Not a simple switch only — it can unpack structure.
- Analogy: Mail sorting: each letter goes into the first pigeonhole whose label fits its shape.
- Code example: `commands.py` — function-free: `command = "move north"`, `match command.split():` cases `["quit"]` → "Bye", `["move", ("north" | "south") as direction]` → f"Moving {direction}", `["move", _]` → "Unknown direction", `_` → "Unknown command"; output `Moving north`. Second example `status = 404` with cases `200`, `404 | 410`, `code if code >= 500`, `_`; output `Not found`.
- Production use: Parsing commands, handling message/event types, HTTP status handling.
- Common mistakes: Using a bare name as a constant (`case OK:` captures instead of compares — use dotted names like `Status.OK`); forgetting `case _` default.
- Sources: https://docs.python.org/3/tutorial/controlflow.html#match-statements ; https://peps.python.org/pep-0636/

## Quiz
1. Which is falsy: `"0"`, `[0]`, `0`? — tests truthiness
2. With `score = 95` and conditions ordered `>= 50` first, which branch runs? — tests first-match order
3. Output of `"even" if 7 % 2 == 0 else "odd"`? — tests conditional expression
4. What does `case _:` do in match? — tests wildcard
