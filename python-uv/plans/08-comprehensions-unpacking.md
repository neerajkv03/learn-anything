# 08. Comprehensions & Unpacking
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 07-collections

## Learning goals
- After this topic, learner can build lists with comprehensions, with and without a filter.
- After this topic, learner can write dict and set comprehensions.
- After this topic, learner can use generator expressions with `sum`, `any`, `all`, `max`.
- After this topic, learner can unpack sequences, including `*rest` and `**` dict merging.
- After this topic, learner can sort data with `sorted(..., key=..., reverse=...)`.

## Sub-topics
### List comprehensions
- Concept: `[expression for item in iterable if condition]` builds a new list in one readable line. Equivalent to a loop with `append`.
- Analogy: A factory conveyor: each item passes a quality check (`if`), then gets stamped (expression).
- Code example: `list_comp.py` — `nums = [1, 2, 3, 4, 5, 6]`, `squares = [n * n for n in nums]`, `evens = [n for n in nums if n % 2 == 0]`, `print(squares)`, `print(evens)`; output `[1, 4, 9, 16, 25, 36]\n[2, 4, 6]`.
- Production use: Transforming query results, extracting fields: `[u.email for u in users]`.
- Common mistakes: Cramming complex logic/nesting into one comprehension; using a comprehension only for side effects (printing).
- Sources: https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions

### Dict and set comprehensions
- Concept: `{k: v for ...}` and `{x for ...}`.
- Analogy: Building an index card box from a pile of notes in one pass.
- Code example: `dict_set_comp.py` — `words = ["apple", "kiwi", "banana", "kiwi"]`, `lengths = {w: len(w) for w in words}`, `print(lengths)`, `first_letters = {w[0] for w in words}`, `print(sorted(first_letters))`; output `{'apple': 5, 'kiwi': 4, 'banana': 6}\n['a', 'b', 'k']`.
- Production use: Building lookup tables by ID: `{u.id: u for u in users}`.
- Common mistakes: Duplicate keys silently overwrite; confusing `{x for ...}` (set) with a dict.
- Sources: https://docs.python.org/3/tutorial/datastructures.html#dictionaries ; https://docs.python.org/3/tutorial/datastructures.html#sets

### Generator expressions
- Concept: `(expr for x in items)` produces values one at a time without building a list — saves memory. Pass directly to `sum`, `any`, `all`, `max`, `min`.
- Analogy: A tap vs a bucket: you get water as you need it instead of filling a bucket first.
- Code example: `genexpr.py` — `prices = [120, 45, 300, 80]`, `print(sum(p for p in prices if p > 50))`, `print(any(p > 250 for p in prices))`, `print(all(p > 0 for p in prices))`, `print(max(len(str(p)) for p in prices))`; output `500\nTrue\nTrue\n3`.
- Production use: Aggregating over large files or database cursors without loading everything.
- Common mistakes: A generator can be used only once; `[...]` inside `sum()` creates an unneeded list.
- Sources: https://docs.python.org/3/reference/expressions.html#generator-expressions ; https://docs.python.org/3/library/functions.html#any

### Unpacking and star-unpacking
- Concept: `a, b = b, a` swap; `first, *rest = items`; `*` spreads a list into another, `**` merges dicts (`{**defaults, **overrides}`); `|` also merges dicts. Count must match unless `*` is used.
- Analogy: Unpacking a suitcase: shirts here, the rest of the clothes in one pile.
- Code example: `unpack.py` — `a, b = 1, 2`, `a, b = b, a`, `print(a, b)`, `first, *rest = [10, 20, 30]`, `print(first, rest)`, `combined = [*rest, 40]`, `print(combined)`, `defaults = {"debug": False, "port": 8000}`, `config = {**defaults, "port": 9000}`, `print(config)`; output `2 1\n10 [20, 30]\n[20, 30, 40]\n{'debug': False, 'port': 9000}`.
- Production use: Merging config layers; splitting header row from data rows.
- Common mistakes: `ValueError: too many values to unpack`; merge order (later wins).
- Sources: https://docs.python.org/3/tutorial/datastructures.html#tuples-and-sequences ; https://peps.python.org/pep-3132/ ; https://peps.python.org/pep-0448/

### Sorting with key functions
- Concept: `sorted(items, key=..., reverse=True)` returns a new list; `key` is a function applied to each item to decide order (`len`, `str.lower`). Sorting is stable. A `lambda` is a tiny unnamed function (fully covered in topic 09).
- Analogy: Sorting students by height instead of by name — you choose what to measure.
- Code example: `sorting.py` — `names = ["bob", "Alice", "Carol"]`, `print(sorted(names))`, `print(sorted(names, key=str.lower))`, `people = [("Ada", 36), ("Linus", 28), ("Grace", 45)]`, `print(sorted(people, key=lambda p: p[1], reverse=True))`; output `['Alice', 'Carol', 'bob']\n['Alice', 'bob', 'Carol']\n[('Grace', 45), ('Ada', 36), ('Linus', 28)]` (uppercase letters sort before lowercase by default).
- Production use: Ordering results by date, price, or name for display.
- Common mistakes: Calling the key function (`key=len()`); expecting `sorted` to change the original.
- Sources: https://docs.python.org/3/howto/sorting.html ; https://docs.python.org/3/library/functions.html#sorted

## Quiz
1. Output of `[x * 2 for x in range(3)]`? — tests list comprehension
2. Why use a generator expression in `sum(...)`? — tests memory/laziness
3. After `first, *rest = [1, 2, 3]`, what is `rest`? — tests star-unpacking
4. `{**{"a": 1}, **{"a": 2}}` gives? — tests merge order
