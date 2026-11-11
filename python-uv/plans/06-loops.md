# 06. Loops
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 05-control-flow

## Learning goals
- After this topic, learner can loop over strings and ranges with `for`.
- After this topic, learner can write a `while` loop with a correct stop condition.
- After this topic, learner can exit or skip iterations with `break` and `continue`.
- After this topic, learner can use `enumerate` and `zip` instead of manual index counting.

## Sub-topics
### for loops and range
- Concept: `for item in collection:` repeats the block once per item. Iteration = one pass. `range(stop)`, `range(start, stop, step)`; stop excluded.
- Analogy: A teacher calling each name on the attendance register, one by one.
- Code example: `for_range.py` — `for ch in "abc": print(ch)`, `for i in range(1, 10, 3): print(i)`; output `a\nb\nc\n1\n4\n7`.
- Production use: Processing each record in a file, each order in a batch.
- Common mistakes: Expecting `range(5)` to include 5; modifying a list while looping over it.
- Sources: https://docs.python.org/3/tutorial/controlflow.html#for-statements ; https://docs.python.org/3/tutorial/controlflow.html#the-range-function

### while loops
- Concept: `while condition:` repeats while the condition stays true; something inside must change it, or it loops forever (stop with Ctrl+C).
- Analogy: Keep stirring the soup while it's not boiling.
- Code example: `countdown.py` — `n = 3`, `while n > 0: print(n); n -= 1`, `print("Liftoff!")`; output `3\n2\n1\nLiftoff!`.
- Production use: Retry loops with a max attempt count; polling until a job finishes.
- Common mistakes: Forgetting to update the variable (infinite loop); using `while` where `for` over a collection is clearer.
- Sources: https://docs.python.org/3/reference/compound_stmts.html#the-while-statement

### break and continue
- Concept: `break` exits the loop immediately; `continue` skips to the next iteration.
- Analogy: Searching drawers for your keys: `break` = stop when found; `continue` = skip a drawer that's locked.
- Code example: `break_continue.py` — `for n in range(1, 10):` if `n % 2 == 0: continue`; if `n > 6: break`; print(n); output `1\n3\n5`.
- Production use: Stop scanning once a match is found; skip invalid rows.
- Common mistakes: `break` only exits the innermost loop; overusing `continue` making logic hard to follow.
- Sources: https://docs.python.org/3/reference/simple_stmts.html#the-break-statement ; https://docs.python.org/3/reference/simple_stmts.html#the-continue-statement

### enumerate and zip
- Concept: `enumerate(items, start=1)` gives (number, item) pairs. `zip(a, b)` walks two sequences together, stopping at the shortest; `zip(..., strict=True)` raises an error if lengths differ. Tuple unpacking in the `for` line.
- Analogy: `enumerate` = numbered race bibs; `zip` = pairing left and right shoes from two piles.
- Code example: `enum_zip.py` — `names = ["Ada", "Linus", "Grace"]`, `scores = [90, 85, 95]`, `for i, name in enumerate(names, start=1): print(i, name)`, `for name, score in zip(names, scores): print(f"{name}: {score}")`; output `1 Ada\n2 Linus\n3 Grace\nAda: 90\nLinus: 85\nGrace: 95`.
- Production use: Line numbers in error reports; combining parallel columns of data.
- Common mistakes: `for i in range(len(items))` instead of enumerate; silent data loss when zip lengths differ (use `strict=True`).
- Sources: https://docs.python.org/3/library/functions.html#enumerate ; https://docs.python.org/3/library/functions.html#zip

## Quiz
1. How many times does `for i in range(2, 8, 2)` run? — tests range (3)
2. What does `continue` do? — tests continue
3. What happens if a while condition never becomes False? — tests infinite loops
4. Output of `list(zip([1, 2, 3], "ab"))`? — tests zip shortest
