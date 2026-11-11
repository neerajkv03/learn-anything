# 04. Strings in Depth
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 02-variables-types, 03-operators-expressions

## Learning goals
- After this topic, learner can index and slice strings, including negative indexes.
- After this topic, learner can use common methods: `strip`, `lower/upper`, `split`, `join`, `replace`, `startswith`, `in`.
- After this topic, learner can format output with f-strings and format specs.
- After this topic, learner can use escape sequences, raw strings, and triple-quoted strings, and explain immutability.

## Sub-topics
### Indexing and slicing
- Concept: Characters are numbered from 0; negative indexes count from the end. Slice `s[start:stop:step]`, stop excluded. Out-of-range index → `IndexError`; slices never error.
- Analogy: Seats in a cinema row numbered from 0; a slice is "seats 2 up to (not including) 5".
- Code example: `slicing.py` — `word = "Python"`, `print(word[0])`, `print(word[-1])`, `print(word[0:3])`, `print(word[2:])`, `print(word[::-1])`; output `P\nn\nPyt\nthon\nnohtyP`.
- Production use: Taking prefixes/suffixes of IDs, trimming fixed-width data.
- Common mistakes: Off-by-one (stop is excluded); `word[6]` on a 6-letter word.
- Sources: https://docs.python.org/3/tutorial/introduction.html#text

### Common string methods
- Concept: A method is a function attached to a value, called with a dot. `strip()`, `lower()`, `upper()`, `title()`, `split()`, `"sep".join(list)`, `replace()`, `startswith()`, `endswith()`, `find()`, `in` operator. Methods return new strings.
- Analogy: A Swiss Army knife — one object, many small tools.
- Code example: `methods.py` — `raw = "  Alice@Example.COM  "`, `email = raw.strip().lower()`, `print(email)`, `print(email.split("@"))`, `print("-".join(["2026", "11", "11"]))`, `print(email.replace("example", "corp"))`, `print("@" in email, email.endswith(".com"))`; output `alice@example.com\n['alice', 'example.com']\n2026-11-11\nalice@corp.com\nTrue True`.
- Production use: Normalising user input (emails, usernames) before saving or comparing.
- Common mistakes: Calling `s.strip()` and expecting `s` to change; `join` called on the list instead of the separator.
- Sources: https://docs.python.org/3/library/stdtypes.html#string-methods

### f-strings and formatting
- Concept: `f"Hello {name}"` inserts values. Format specs after `:` — `{price:.2f}`, `{n:,}`, `{pct:.1%}`, `{name:>10}`. `{x=}` for debugging prints `x=value`.
- Analogy: A form letter with blanks the printer fills in automatically.
- Code example: `fstrings.py` — `name = "Ada"`, `price = 1234.5`, `ratio = 0.256`, `print(f"Hi {name}!")`, `print(f"Total: {price:,.2f}")`, `print(f"Done: {ratio:.1%}")`, `print(f"[{name:>6}]")`, `print(f"{price=}")`; output `Hi Ada!\nTotal: 1,234.50\nDone: 25.6%\n[   Ada]\nprice=1234.5`.
- Production use: Building messages and reports; note logging prefers `%s` placeholders (topic 19).
- Common mistakes: Forgetting the `f` prefix; using f-strings to build SQL queries (SQL injection risk — use parameters).
- Sources: https://docs.python.org/3/tutorial/inputoutput.html#formatted-string-literals ; https://docs.python.org/3/library/string.html#format-specification-mini-language

### Escapes and multiline strings
- Concept: Backslash escapes: `\n` newline, `\t` tab, `\\` backslash, `\"` quote. Raw strings `r"..."` keep backslashes (Windows paths, regex). Triple quotes `"""..."""` span lines.
- Analogy: Special codes on a typewriter: a key that means "go to next line" instead of printing a letter.
- Code example: `escapes.py` — `print("Name:\tAda")`, `print("Line1\nLine2")`, `print(r"C:\new\table")`, `msg = """Dear user,\nThanks!"""` written as real multiline, `print(msg)`; output `Name:\tAda` (real tab) etc. Author must write exact output with a real tab and lines.
- Production use: Raw strings for regex patterns; triple quotes for docstrings and SQL text.
- Common mistakes: `"C:\new"` becomes a newline; forgetting raw strings can't end with a single backslash.
- Sources: https://docs.python.org/3/reference/lexical_analysis.html#string-and-bytes-literals

### Immutability
- Concept: Strings can't be changed in place; operations make new strings. `s[0] = "J"` raises `TypeError`. Build many pieces with a list + `"".join()`.
- Analogy: Words carved in stone — to change one letter, you carve a new stone.
- Code example: `immutable.py` — `name = "python"`, `fixed = "P" + name[1:]`, `print(name)`, `print(fixed)`, `parts = ["a", "b", "c"]`, `print("".join(parts))`; output `python\nPython\nabc`.
- Production use: Safe to share strings between functions and threads; `join` for efficient building.
- Common mistakes: Trying to assign to an index; repeated `+=` in large loops instead of `join`.
- Sources: https://docs.python.org/3/library/stdtypes.html#text-sequence-type-str

## Quiz
1. Output of `"Python"[1:4]`? — tests slicing
2. After `s = " hi "; s.strip()`, what is `s`? — tests immutability/return value
3. What does `f"{3.14159:.2f}"` produce? — tests format spec
4. Why use `r"C:\new"`? — tests raw strings
