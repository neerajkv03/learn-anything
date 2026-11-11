# 02. Variables & Types
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 01-setup-with-uv

## Learning goals
- After this topic, learner can create variables, reassign them, and follow naming rules (snake_case).
- After this topic, learner can tell `int`, `float`, `str`, `bool`, and `None` apart and check a value's type with `type()`.
- After this topic, learner can convert between types with `int()`, `float()`, `str()`, `bool()` and know when conversion fails.
- After this topic, learner can write comments.

## Sub-topics
### Variables and assignment
- Concept: A variable is a name that refers to a value. `=` means "assign", not "equals". Names can be reassigned to any value. Naming: letters, digits, `_`, can't start with a digit, case-sensitive; convention `snake_case`; ALL_CAPS for constants by convention. Multiple assignment `x, y = 1, 2`.
- Analogy: A sticky-note label stuck on a box; you can peel the label off and stick it on a different box.
- Code example: `variables.py` — `city = "Pune"`, `count = 3`, `print(city, count)`, `count = count + 1`, `print(count)`, `x, y = 10, 20`, `print(x, y)`; output `Pune 3\n4\n10 20`.
- Production use: Clear descriptive names (`order_total`, `MAX_RETRIES`) are the first thing code reviewers check.
- Common mistakes: Using a variable before assigning it (`NameError`); names like `l`, `x1` that say nothing; mixing up `=` and `==`.
- Sources: https://docs.python.org/3/tutorial/introduction.html#using-python-as-a-calculator ; https://peps.python.org/pep-0008/#naming-conventions

### Numbers (int, float)
- Concept: `int` = whole numbers, any size. `float` = numbers with a decimal point, stored approximately. Underscores for readability `1_000_000`. Floats can be inexact: `0.1 + 0.2` prints `0.30000000000000004`.
- Analogy: `int` is counting whole apples; `float` is measuring water with a ruler that has limited markings.
- Code example: `numbers.py` — `population = 1_400_000_000`, `print(population)`, `price = 19.99`, `print(type(price))`, `print(0.1 + 0.2)`, `print(2 ** 100)`; output `1400000000\n<class 'float'>\n0.30000000000000004\n1267650600228229401496703205376`.
- Production use: Money uses `decimal.Decimal` or integer cents, never float, to avoid rounding errors.
- Common mistakes: Expecting `0.1 + 0.2 == 0.3` to be True; using floats for money.
- Sources: https://docs.python.org/3/library/stdtypes.html#numeric-types-int-float-complex ; https://docs.python.org/3/tutorial/floatingpoint.html

### Strings basics
- Concept: `str` = text in single or double quotes. `+` joins strings, `*` repeats, `len()` counts characters. Strings and numbers can't be added directly.
- Analogy: Beads on a string — each bead is one character, in order.
- Code example: `strings_basics.py` — `first = "Ada"`, `last = 'Lovelace'`, `full = first + " " + last`, `print(full)`, `print(len(full))`, `print("ha" * 3)`; output `Ada Lovelace\n12\nhahaha`.
- Production use: Text is everywhere: user names, log messages, file contents, API data.
- Common mistakes: `"Age: " + 30` raises `TypeError`; mismatched quotes.
- Sources: https://docs.python.org/3/tutorial/introduction.html#text

### Booleans and None
- Concept: `bool` has two values `True` and `False` (capitalised), produced by comparisons. `None` means "no value yet / nothing"; it is the only value of its type. Check with `is None`.
- Analogy: A light switch (on/off) for bool; an empty parking spot with a "reserved" sign for None.
- Code example: `bool_none.py` — `is_admin = False`, `print(is_admin)`, `print(5 > 3)`, `middle_name = None`, `print(middle_name is None)`, `print(type(None))`; output `False\nTrue\nTrue\n<class 'NoneType'>`.
- Production use: `None` marks optional data (missing database field, no result found).
- Common mistakes: Writing `true`/`false`/`none` in lowercase; using `== None` instead of `is None`.
- Sources: https://docs.python.org/3/library/stdtypes.html#boolean-type-bool ; https://docs.python.org/3/library/constants.html#None

### Type conversion
- Concept: `int("42")`, `float("3.5")`, `str(7)`, `bool(0)`. `int()` on a float truncates toward zero. Invalid text raises `ValueError`. Data from users/files arrives as text and must be converted.
- Analogy: Currency exchange: you can change rupees to dollars, but you can't exchange a bus ticket for money.
- Code example: `convert.py` — `age_text = "42"`, `age = int(age_text)`, `print(age + 1)`, `print(float("3.5") * 2)`, `print(int(9.99))`, `print(str(100) + "%")`, `print(bool(0), bool("hi"))`; output `43\n7.0\n9\n100%\nFalse True`.
- Production use: Parsing environment variables, query parameters, and CSV cells which are always strings.
- Common mistakes: `int("3.5")` raises ValueError (convert via float first); expecting `int()` to round.
- Sources: https://docs.python.org/3/library/functions.html#int ; https://docs.python.org/3/library/functions.html#float

### Comments
- Concept: `#` starts a comment; Python ignores the rest of the line. Use comments to explain *why*, not *what*. Docstrings come later (topic 09).
- Analogy: Pencil notes in the margin of a recipe — the cook ignores them, the next reader thanks you.
- Code example: `comments.py` — `# Tax rate set by finance team (2026)`, `TAX_RATE = 0.18`, `print(100 * TAX_RATE)  # 18% of 100`; output `18.0`.
- Production use: Comments explain business rules and non-obvious decisions; obvious comments are removed in review.
- Common mistakes: Commenting every line; leaving old commented-out code.
- Sources: https://docs.python.org/3/reference/lexical_analysis.html#comments

## Quiz
1. Output of `print(int(7.9))`? — tests int truncation
2. Which is a valid variable name: `2nd_place`, `second_place`, `second-place`? — tests naming rules
3. What does `"5" + 5` do? — tests str/int mixing (TypeError)
4. Correct way to check for missing value? — tests `is None`
