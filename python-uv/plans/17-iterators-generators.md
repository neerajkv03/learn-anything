# 17. Iterators & Generators
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 16-dataclasses-enums

## Learning goals
- After this topic, learner can explain iterables vs iterators and use `iter()` / `next()`.
- After this topic, learner can write generator functions with `yield`.
- After this topic, learner can chain generators into memory-efficient pipelines.
- After this topic, learner can use key `itertools` functions: `islice`, `chain`, `batched`, `groupby`, `count`.

## Sub-topics
### The iteration protocol
- Concept: An iterable is anything you can loop over (list, str, dict, file). `iter(x)` gives an iterator; `next(it)` returns the next item and raises `StopIteration` when done. A `for` loop does this for you. Iterators are single-use.
- Analogy: A deck of cards (iterable) and the dealer's hand pulling one card at a time (iterator) — once dealt, the cards are gone.
- Code example: `protocol.py` — `colors = ["red", "green"]`; `it = iter(colors)`; `print(next(it))`; `print(next(it))`; `print(next(it, "no more"))`; output `red\ngreen\nno more`.
- Production use: Understanding why a file or generator can only be read once.
- Common mistakes: Looping over the same iterator twice and getting nothing; calling `next()` without a default and crashing on `StopIteration`.
- Sources: https://docs.python.org/3/tutorial/classes.html#iterators ; https://docs.python.org/3/glossary.html#term-iterator

### Generator functions and yield
- Concept: A function containing `yield` returns a generator: it pauses at each `yield`, remembers its place, and continues on the next request. Values are produced lazily (only when asked).
- Analogy: A bakery that bakes the next loaf only when a customer asks, instead of baking 1,000 loaves up front.
- Code example: `countdown_gen.py` — `def countdown(n: int):` `while n > 0: yield n; n -= 1`; `gen = countdown(3)`; `print(next(gen))`; `print(list(gen))`; output `3\n[2, 1]`.
- Production use: Streaming large files, paginated API results, database rows.
- Common mistakes: Using `return` instead of `yield`; expecting to re-use a finished generator.
- Sources: https://docs.python.org/3/tutorial/classes.html#generators ; https://docs.python.org/3/reference/expressions.html#yield-expressions

### Lazy pipelines
- Concept: Chain generators: each stage pulls one item at a time from the previous one, so memory stays small regardless of input size. `yield from` delegates to another iterable.
- Analogy: An assembly line: each worker passes one part along; there's never a huge pile between stations.
- Code example: `pipeline.py` — `lines = ["INFO start", "ERROR disk full", "INFO ok", "ERROR timeout"]`; `def read(source): yield from source`; `def errors(rows): for r in rows: if r.startswith("ERROR"): yield r`; `def messages(rows): for r in rows: yield r.split(" ", 1)[1]`; `for msg in messages(errors(read(lines))): print(msg)`; output `disk full\ntimeout`.
- Production use: Log processing and ETL jobs over files bigger than memory.
- Common mistakes: Calling `list()` in the middle of a pipeline (loads everything); debugging prints that consume items.
- Sources: https://docs.python.org/3/howto/functional.html#generators ; https://docs.python.org/3/reference/expressions.html#yield-expressions

### itertools essentials
- Concept: `itertools.count()` infinite counter, `islice` take first N, `chain` join iterables, `batched(it, n)` chunks of n (tuples), `groupby` groups consecutive equal keys (sort first).
- Analogy: A toolkit of conveyor-belt attachments: splitter, joiner, counter, packer.
- Code example: `itertools_demo.py` — `from itertools import batched, chain, count, groupby, islice`; `print(list(islice(count(10, 5), 3)))`; `print(list(chain([1, 2], (3,))))`; `print(list(batched(range(7), 3)))`; `words = sorted(["apple", "avocado", "banana", "blueberry", "cherry"])`; `for letter, group in groupby(words, key=lambda w: w[0]): print(letter, list(group))`; output `[10, 15, 20]\n[1, 2, 3]\n[(0, 1, 2), (3, 4, 5), (6,)]\na ['apple', 'avocado']\nb ['banana', 'blueberry']\nc ['cherry']`.
- Production use: Batching database inserts or API calls (`batched`), paging (`islice`).
- Common mistakes: `groupby` on unsorted data; `list(count())` never ends.
- Sources: https://docs.python.org/3/library/itertools.html

## Quiz
1. What does `next(it, default)` return when the iterator is exhausted? — tests next default
2. What keyword turns a function into a generator? — tests yield
3. Why sort before `groupby`? — tests groupby consecutive
4. Main benefit of a generator pipeline over lists? — tests laziness/memory
