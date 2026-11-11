# 01. Setup with uv
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: none

## Learning goals
- After this topic, learner can explain what a programming language, an interpreter, and uv are.
- After this topic, learner can install uv and use it to install Python 3.15.
- After this topic, learner can write a `.py` file and run it with `uv run`.
- After this topic, learner can open the Python REPL, try an expression, and exit.
- After this topic, learner can use `print()` with several values, `sep`, and `end`.

## Sub-topics
### What Python and uv are
- Concept: A program is a list of instructions for a computer. Python is a language for writing them; the Python interpreter reads a `.py` file and runs it line by line. uv (by Astral) is one tool that installs Python, runs scripts, and manages the extra code libraries (packages) a project needs. Define: program, interpreter, package, terminal/command line.
- Analogy: Python is the recipe language; the interpreter is the cook who follows the recipe; uv is the kitchen manager who buys the right stove (Python version) and ingredients (packages).
- Code example: `bash` — `uv --version`; representative output `uv 0.13.7`.
- Production use: Teams standardise on one tool (uv) so every developer and server uses the same Python and package versions.
- Common mistakes: Thinking uv is a different language (it is a tool for Python); typing Python code into the terminal instead of a file or REPL.
- Sources: https://docs.python.org/3/tutorial/index.html ; https://docs.astral.sh/uv/

### Installing uv
- Concept: Install uv once per machine with the official standalone installer. macOS/Linux: `curl -LsSf https://astral.sh/uv/install.sh | sh`. Windows (PowerShell): `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`. Restart the terminal, check with `uv --version`. Update later with `uv self update` (standalone installs only).
- Analogy: Installing an app store once; after that every other tool comes through it.
- Code example: `bash` — the two installer commands + `uv --version`; output `""` (varies by OS).
- Production use: CI machines and Docker images install a pinned uv version the same way.
- Common mistakes: Not restarting the terminal so `uv` is "not found"; running `uv self update` on a uv installed by another package manager (update it with that manager instead).
- Sources: https://docs.astral.sh/uv/getting-started/installation/

### Installing Python with uv
- Concept: `uv python install 3.15` downloads a managed Python. `uv python list` shows available/installed versions. uv also downloads a missing Python automatically when a command needs it. No admin rights or system Python required.
- Analogy: Ordering a specific model of tool from a catalogue instead of using whatever happens to be in the garage.
- Code example: `bash` — `uv python install 3.15` then `uv python list`; output `""`.
- Production use: Pinning an exact Python minor version so laptops and servers match.
- Common mistakes: Assuming the `python` command in the terminal is the uv-managed one (use `uv run python`); installing many versions without knowing which one a project uses.
- Sources: https://docs.astral.sh/uv/guides/install-python/ ; https://docs.astral.sh/uv/concepts/python-versions/

### Running a script with uv run
- Concept: A script is a text file ending in `.py`. `uv run hello.py` runs it with a suitable Python. `uv run --python 3.15 hello.py` requests a specific version.
- Analogy: Handing a written recipe to the cook instead of shouting instructions one at a time.
- Code example: `hello.py` — `print("Hello, world!")`; output `Hello, world!`. Plus `bash` — `uv run hello.py`.
- Production use: `uv run` is how scripts, servers, and tests are started in uv-managed projects.
- Common mistakes: Saving the file as `hello.py.txt`; running the command from a different folder than the file.
- Sources: https://docs.astral.sh/uv/guides/scripts/

### The interactive REPL
- Concept: REPL = Read-Eval-Print Loop: type one line, Python runs it and shows the result immediately. Start with `uv run python`; prompt is `>>>`. Exit with `exit()` or Ctrl+D (macOS/Linux) / Ctrl+Z then Enter (Windows). Good for experiments, not for saving work.
- Analogy: A calculator: type, press equals, see the answer — nothing is saved.
- Code example: `python` — REPL session text `>>> 2 + 3` / `5` / `>>> "py" * 3` / `'pypypy'`. Output `""` (session shown in source).
- Production use: Developers use the REPL to quickly test an idea or inspect a library before writing code.
- Common mistakes: Writing a whole program in the REPL and losing it on exit; typing `>>>` itself.
- Sources: https://docs.python.org/3/tutorial/interpreter.html

### Your first program with print
- Concept: `print()` is a built-in function (a ready-made command) that shows values. Several values are separated by a space by default; `sep=` changes the separator; `end=` changes what is printed after (default a new line). Define: function, argument, string (text in quotes).
- Analogy: A label printer: you give it items, it prints them in a row with a chosen gap, then feeds to the next line.
- Code example: `first.py` — `print("Hello", "Ada")`, `print("a", "b", "c", sep="-")`, `print("Loading", end="")`, `print("...done")`; output `Hello Ada\na-b-c\nLoading...done`.
- Production use: `print` is for scripts and quick debugging; real services use logging (topic 19).
- Common mistakes: Forgetting quotes around text; using smart/curly quotes from a word processor; `Print` with a capital P.
- Sources: https://docs.python.org/3/library/functions.html#print

## Quiz
1. Which command runs `app.py` with uv? — tests uv run
2. What does REPL stand for / what is it for? — tests REPL
3. Output of `print("a", "b", sep="-")`? — tests sep
4. Which command installs Python 3.15 with uv? — tests uv python install
