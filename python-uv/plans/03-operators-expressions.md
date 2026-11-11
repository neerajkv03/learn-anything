# 03. Operators & Expressions
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 02-variables-types

## Learning goals
- After this topic, learner can use arithmetic operators including `//`, `%`, `**`.
- After this topic, learner can compare values and combine conditions with `and`, `or`, `not`.
- After this topic, learner can use augmented assignment (`+=` etc.).
- After this topic, learner can predict evaluation order and use parentheses for clarity.

## Sub-topics
### Arithmetic operators
- Concept: An expression is code that produces a value. Operators: `+ - * /` (true division always gives float), `//` floor division, `%` remainder, `**` power. Define operator, operand.
- Analogy: Sharing 7 sweets among 2 kids: `7 // 2` is how many each gets (3), `7 % 2` is the leftover (1).
- Code example: `arithmetic.py` — `print(7 / 2)`, `print(7 // 2)`, `print(7 % 2)`, `print(2 ** 10)`, `print(-7 // 2)`; output `3.5\n3\n1\n1024\n-4`.
- Production use: `%` for checking even/odd and pagination; `//` for splitting items into pages.
- Common mistakes: Expecting `/` to give an int; `-7 // 2` rounds down to -4, not -3.
- Sources: https://docs.python.org/3/reference/expressions.html#binary-arithmetic-operations

### Comparison operators
- Concept: `== != < > <= >=` produce bool. Chained comparisons `0 < x < 10`. `is` checks identity (same object) — use only for `None`/`True`/`False`.
- Analogy: A scale at the market telling you heavier, lighter, or equal.
- Code example: `compare.py` — `age = 20`, `print(age >= 18)`, `print(age == 21)`, `print(18 <= age < 65)`, `print("apple" < "banana")`; output `True\nFalse\nTrue\nTrue`.
- Production use: Validation rules (`0 < quantity <= stock`).
- Common mistakes: `=` instead of `==`; using `is` to compare numbers or strings.
- Sources: https://docs.python.org/3/reference/expressions.html#comparisons

### Logical operators
- Concept: `and` (both true), `or` (either true), `not` (flip). Short-circuit: Python stops as soon as the answer is known.
- Analogy: Entering a club: need ID **and** ticket; payment by cash **or** card.
- Code example: `logic.py` — `has_ticket = True`, `has_id = False`, `print(has_ticket and has_id)`, `print(has_ticket or has_id)`, `print(not has_id)`; output `False\nTrue\nTrue`.
- Production use: Permission checks (`user.is_active and user.is_admin`); short-circuit guards `if items and items[0] ...`.
- Common mistakes: Writing `&&`/`||` (other languages); `x == 1 or 2` (always truthy) instead of `x == 1 or x == 2`.
- Sources: https://docs.python.org/3/reference/expressions.html#boolean-operations

### Augmented assignment
- Concept: `x += 1` is shorthand for `x = x + 1`; also `-= *= /= //= %=`. Python has no `++`.
- Analogy: A tally counter you click to add one instead of rewriting the total.
- Code example: `augmented.py` — `score = 10`, `score += 5`, `score *= 2`, `score -= 1`, `print(score)`; output `29`.
- Production use: Counters and running totals in loops.
- Common mistakes: Writing `score++`; using `+=` on a variable never assigned.
- Sources: https://docs.python.org/3/reference/simple_stmts.html#augmented-assignment-statements

### Operator precedence
- Concept: `**` before `* / // %` before `+ -` before comparisons before `not` before `and` before `or`. Parentheses override and improve readability. `-2 ** 2` is `-4`.
- Analogy: Maths class "BODMAS" — brackets first.
- Code example: `precedence.py` — `print(2 + 3 * 4)`, `print((2 + 3) * 4)`, `print(-2 ** 2)`, `print(True or False and False)`; output `14\n20\n-4\nTrue`.
- Production use: Teams add parentheses to complex conditions so reviewers don't have to remember precedence.
- Common mistakes: Assuming left-to-right evaluation; mixing `and`/`or` without parentheses.
- Sources: https://docs.python.org/3/reference/expressions.html#operator-precedence

## Quiz
1. Output of `print(17 % 5)`? — tests remainder
2. Type of `10 / 2`? — tests true division (float 5.0)
3. Value of `2 + 3 * 2 ** 2`? — tests precedence (14)
4. Why is `x == 1 or 2` a bug? — tests logical operators
