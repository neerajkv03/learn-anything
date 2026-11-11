# 07. Collections
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 06-loops

## Learning goals
- After this topic, learner can create, index, modify, and loop over lists.
- After this topic, learner can use tuples for fixed groups of values and unpack them.
- After this topic, learner can store and look up key-value data in dictionaries, including `.get()` and `.items()`.
- After this topic, learner can use sets for uniqueness and membership.
- After this topic, learner can choose the right collection for a task.

## Sub-topics
### Lists
- Concept: Ordered, changeable (mutable) sequence `[a, b, c]`. Index/slice like strings. `append`, `extend`, `insert`, `pop`, `remove`, `len`, `in`, `sort()` vs `sorted()`. Define mutable.
- Analogy: A shopping list on a whiteboard — ordered, and you can add, cross out, or reorder items.
- Code example: `lists.py` — `tasks = ["write", "test"]`, `tasks.append("deploy")`, `tasks.insert(0, "plan")`, `print(tasks)`, `done = tasks.pop(0)`, `print(done, tasks)`, `print(len(tasks), "test" in tasks)`, `nums = [3, 1, 2]`, `nums.sort()`, `print(nums)`; output `['plan', 'write', 'test', 'deploy']\nplan ['write', 'test', 'deploy']\n3 True\n[1, 2, 3]`.
- Production use: Batches of records, queues of work, results from a database query.
- Common mistakes: `x = nums.sort()` gives `None`; `b = a` doesn't copy (both names see changes — use `a.copy()`).
- Sources: https://docs.python.org/3/tutorial/datastructures.html#more-on-lists

### Tuples
- Concept: Ordered, unchangeable (immutable) sequence `(a, b)`. Used for fixed records (coordinates, RGB) and multiple return values. Single item needs comma `(5,)`. Unpacking `x, y = point`.
- Analogy: A sealed envelope with a fixed set of documents — you can read them but not swap one out.
- Code example: `tuples.py` — `point = (3, 4)`, `x, y = point`, `print(x, y)`, `print(point[0])`, `rgb = (255, 128, 0)`, `print(len(rgb))`, `single = (5,)`, `print(type(single).__name__)`; output `3 4\n3\n3\ntuple`.
- Production use: Returning several values from a function; dictionary keys made of several parts.
- Common mistakes: `(5)` is just the int 5; trying `point[0] = 1` (`TypeError`).
- Sources: https://docs.python.org/3/tutorial/datastructures.html#tuples-and-sequences

### Dictionaries
- Concept: Key → value mapping `{"name": "Ada"}`. Keys unique and immutable (str, int, tuple). Look up `d[key]` (KeyError if missing) vs `d.get(key, default)`. Add/update by assignment, `del`, `in` checks keys, `.keys() .values() .items()`. Keep insertion order.
- Analogy: A phone book: look up a name (key) to find a number (value).
- Code example: `dicts.py` — `user = {"name": "Ada", "age": 36}`, `user["email"] = "ada@example.com"`, `user["age"] += 1`, `print(user["name"], user["age"])`, `print(user.get("phone", "n/a"))`, `for key, value in user.items(): print(f"{key}={value}")`; output `Ada 37\nn/a\nname=Ada\nage=37\nemail=ada@example.com`.
- Production use: JSON data, configuration, caching, counting, lookup tables.
- Common mistakes: `KeyError` from `d["missing"]`; using a list as a key; expecting `in` to check values.
- Sources: https://docs.python.org/3/tutorial/datastructures.html#dictionaries ; https://docs.python.org/3/library/stdtypes.html#mapping-types-dict

### Sets
- Concept: Unordered collection of unique items `{1, 2}`; empty set is `set()` (not `{}`). Fast membership `in`. Operations `|` union, `&` intersection, `-` difference. Order not guaranteed — print sorted for stable output.
- Analogy: A guest list at a party — each name appears once, order doesn't matter.
- Code example: `sets.py` — `tags = ["python", "uv", "python", "web"]`, `unique = set(tags)`, `print(len(unique))`, `print(sorted(unique))`, `backend = {"python", "go"}`, `print(sorted(unique & backend))`, `print("uv" in unique)`; output `3\n['python', 'uv', 'web']\n['python']\nTrue`.
- Production use: De-duplicating IDs; fast "have we seen this?" checks; comparing permission sets.
- Common mistakes: `{}` creates an empty dict; relying on set print order.
- Sources: https://docs.python.org/3/tutorial/datastructures.html#sets

### Choosing the right collection
- Concept: list = ordered, changeable, duplicates allowed; tuple = fixed record; dict = look up by key; set = uniqueness/membership. Membership in a list scans every item; in a set/dict it's near-instant.
- Analogy: Toolbox: you don't use a hammer for screws — pick by job.
- Code example: `choose.py` — `allowed = {"admin", "editor"}`, `role = "editor"`, `print(role in allowed)`, `prices = {"apple": 30, "banana": 10}`, `print(prices["banana"])`, `history = ["login", "view", "view"]`, `print(history.count("view"))`; output `True\n10\n2`.
- Production use: Choosing correctly avoids slow code at scale (set lookups vs list scans).
- Common mistakes: List of pairs instead of a dict for lookups; using list membership on huge data.
- Sources: https://docs.python.org/3/tutorial/datastructures.html ; https://wiki.python.org/moin/TimeComplexity

## Quiz
1. Which collection removes duplicates automatically? — tests set
2. What does `{}` create? — tests empty dict vs set
3. `d.get("x", 0)` when "x" is missing returns? — tests dict get
4. Why can't a list be a dict key? — tests mutability/hashability
5. Output of `nums = [3,1]; print(nums.sort())`? — tests in-place sort returns None
