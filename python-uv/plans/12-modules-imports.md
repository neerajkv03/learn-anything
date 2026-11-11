# 12. Modules & Imports
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 11-error-handling

## Learning goals
- After this topic, learner can import whole modules and specific names, with aliases.
- After this topic, learner can split code into their own module files and import them.
- After this topic, learner can use `if __name__ == "__main__":` to make a file both importable and runnable.
- After this topic, learner can organise modules into a package with `__init__.py`.
- After this topic, learner can find and use common standard-library modules.

## Sub-topics
### import and from-import
- Concept: A module is a `.py` file of reusable code. `import math` then `math.sqrt`; `from math import sqrt`; alias `import datetime as dt`. Imports go at the top of the file. Avoid `from x import *`.
- Analogy: Borrowing a specific book from the library (from-import) vs borrowing the whole shelf and saying "shelf, page 3" (import).
- Code example: `imports.py` — `import math`; `from statistics import mean`; `import json as js`; `print(math.sqrt(16))`; `print(mean([2, 4, 6]))`; `print(js.dumps({"ok": True}))`; output `4.0\n4\n{"ok": true}`.
- Production use: Clear imports let tools detect unused code and dependencies.
- Common mistakes: Naming your own file `math.py` or `json.py` (shadows the standard module); `import *` polluting names.
- Sources: https://docs.python.org/3/tutorial/modules.html ; https://docs.python.org/3/reference/simple_stmts.html#the-import-statement

### Writing your own module
- Concept: Any `.py` file in the same folder can be imported by its name (without `.py`). Module code runs once on first import.
- Analogy: Writing your own recipe card and filing it so other recipes can say "see card: sauce".
- Code example: two-file example shown as two `code` entries: `pricing.py` — `TAX = 0.18` / `def with_tax(amount: float) -> float: return round(amount * (1 + TAX), 2)`, output `""`; `shop.py` — `from pricing import with_tax` / `print(with_tax(100))`, output `118.0`. Explanation: both files in same folder, run `uv run shop.py`.
- Production use: Codebases split into modules by responsibility (db, api, models).
- Common mistakes: Circular imports (a imports b, b imports a); running from a different folder so the import fails.
- Sources: https://docs.python.org/3/tutorial/modules.html#more-on-modules

### if __name__ == "__main__"
- Concept: `__name__` is `"__main__"` when a file is run directly, and the module name when imported. Guard script-only code so importing doesn't trigger it. Common pattern: `def main() -> None:` + guard.
- Analogy: A demo button on a kitchen gadget: pressed when you test it alone, not when it's built into a bigger appliance.
- Code example: `tool.py` — `def main() -> None: print("running as script")`; `print(f"module name: {__name__}")`; `if __name__ == "__main__": main()`; output `module name: __main__\nrunning as script`.
- Production use: Every CLI/script entry file uses a `main()` + guard.
- Common mistakes: Top-level code with side effects (DB connections) running on import; misspelling `"__main__"`.
- Sources: https://docs.python.org/3/library/__main__.html

### Packages and __init__.py
- Concept: A package is a folder of modules with an `__init__.py` file. Import with dots: `from shop.pricing import with_tax`. Relative imports inside the package: `from .pricing import with_tax`. `src/` layout introduced in topic 13.
- Analogy: A filing cabinet (package) with labelled drawers (modules).
- Code example: `bash`/text layout block (language `text`): `shop/__init__.py`, `shop/pricing.py`, `main.py`; plus `main.py` — `from shop.pricing import with_tax` / `print(with_tax(50))`; output `59.0`.
- Production use: All non-trivial projects are packages; `__init__.py` defines the public API.
- Common mistakes: Running a module inside a package directly (`python shop/pricing.py`) breaks relative imports — use `python -m shop.pricing`; heavy code in `__init__.py`.
- Sources: https://docs.python.org/3/tutorial/modules.html#packages

### Standard library tour
- Concept: The standard library ("batteries included") ships with Python: `math`, `random`, `datetime`, `pathlib`, `json`, `csv`, `collections`, `itertools`, `functools`, `logging`, `argparse`, `re`, `os`, `sys`, `subprocess`, `unittest`. Check stdlib before adding a package.
- Analogy: A furnished flat — check the cupboards before buying new plates.
- Code example: `stdlib_tour.py` — `import re`, `import sys`, `import textwrap` (one per line); `print(sys.version_info >= (3, 15))`, `print(re.findall(r"\d+", "order 12, item 7"))`, `print(textwrap.shorten("Python makes everyday tasks simple", width=20))`; output `True\n['12', '7']\nPython makes [...]`.
- Production use: Fewer third-party dependencies = smaller attack surface and less upgrade work.
- Common mistakes: Installing a package for something stdlib already does; re-implementing JSON/CSV parsing by hand.
- Sources: https://docs.python.org/3/library/index.html ; https://docs.python.org/3/tutorial/stdlib.html

## Quiz
1. What is `__name__` when a file is run directly? — tests __main__
2. Why is a file named `json.py` in your project a problem? — tests shadowing
3. What makes a folder a regular package? — tests __init__.py
4. Difference between `import math` and `from math import sqrt`? — tests import styles
