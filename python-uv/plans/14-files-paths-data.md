# 14. Files, Paths & Data Formats
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 13-uv-projects

## Learning goals
- After this topic, learner can build and inspect file paths with `pathlib.Path`.
- After this topic, learner can read and write text files with an explicit UTF-8 encoding.
- After this topic, learner can explain the `with` statement and why files must be closed.
- After this topic, learner can convert between Python objects and JSON.
- After this topic, learner can read and write CSV files with `csv.DictReader` / `DictWriter`.

## Sub-topics
### pathlib paths
- Concept: A path is a file's address on disk. `Path("data") / "report.txt"` joins parts portably (Windows `\` vs macOS/Linux `/`). Properties `.name`, `.stem`, `.suffix`, `.parent`; methods `.exists()`, `.mkdir(parents=True, exist_ok=True)`, `.glob("*.txt")`.
- Analogy: A postal address built from parts (country / city / street) that works in any country's format.
- Code example: `paths.py` — `from pathlib import PurePosixPath`; `p = PurePosixPath("data") / "reports" / "q3.csv"`; `print(p)`; `print(p.name, p.stem, p.suffix)`; `print(p.parent)`; `print(p.with_suffix(".json"))`; output `data/reports/q3.csv\nq3.csv q3 .csv\ndata/reports\ndata/reports/q3.json`. Explanation: real code uses `Path` (adapts to OS); `PurePosixPath` here so printed slashes are the same on every OS.
- Production use: Locating config, data, and log files relative to the project.
- Common mistakes: Building paths with string `+` and hard-coded `\`; relying on the current working directory.
- Sources: https://docs.python.org/3/library/pathlib.html

### Reading and writing text files
- Concept: `Path.write_text(text, encoding="utf-8")` and `read_text(encoding="utf-8")` for small files. Encoding = how characters become bytes; always state UTF-8. Iterate lines with `open()` for big files. Modes `"r"`, `"w"` (overwrites!), `"a"` append.
- Analogy: A notebook: "w" tears out old pages and writes fresh; "a" continues at the end.
- Code example: `notes.py` — `from pathlib import Path`; `path = Path("notes.txt")`; `path.write_text("first line\nsecond line\n", encoding="utf-8")`; `text = path.read_text(encoding="utf-8")`; `print(text.splitlines())`; `print(len(text))`; output `['first line', 'second line']\n23`.
- Production use: Reading templates, config files, and writing reports.
- Common mistakes: Omitting `encoding` (garbled characters on some systems); opening with `"w"` and wiping data.
- Sources: https://docs.python.org/3/library/pathlib.html#reading-and-writing-files ; https://docs.python.org/3/tutorial/inputoutput.html#reading-and-writing-files

### The with statement
- Concept: `with open(path, "a", encoding="utf-8") as f:` opens a resource and guarantees it's closed at the end of the block — even if an error happens. Objects that support this are context managers (more in topic 18).
- Analogy: A library book that automatically returns itself when you leave the reading room.
- Code example: `log_lines.py` — `from pathlib import Path`; `path = Path("events.log")`; `with path.open("w", encoding="utf-8") as f:` write two lines; `with path.open(encoding="utf-8") as f:` `for number, line in enumerate(f, start=1): print(number, line.rstrip())`; `print(f.closed)`; output `1 started\n2 finished\nTrue`.
- Production use: Files, database connections, locks, and network sessions are all used with `with`.
- Common mistakes: Calling `open()` without closing; using the file object after the block ended.
- Sources: https://docs.python.org/3/reference/compound_stmts.html#the-with-statement ; https://docs.python.org/3/tutorial/inputoutput.html#reading-and-writing-files

### JSON
- Concept: JSON is a text format for data exchange (APIs, config). `json.dumps(obj, indent=2)` → string; `json.loads(text)` → dict/list; `json.dump/json.load` work with files. Mapping: dict↔object, list↔array, None↔null, True↔true.
- Analogy: A universal shipping container — any system can open it and find the same contents.
- Code example: `json_demo.py` — `import json`; `order = {"id": 7, "items": ["pen", "ink"], "paid": True, "note": None}`; `text = json.dumps(order)`; `print(text)`; `data = json.loads('{"id": 8, "total": 12.5}')`; `print(data["total"] * 2)`; `print(json.dumps({"b": 1, "a": 2}, indent=2, sort_keys=True))`; output `{"id": 7, "items": ["pen", "ink"], "paid": true, "note": null}\n25.0\n{\n  "a": 2,\n  "b": 1\n}`.
- Production use: API request/response bodies, config files, message queues.
- Common mistakes: Confusing `dump` (file) with `dumps` (string); trying to serialise sets/datetimes directly (TypeError).
- Sources: https://docs.python.org/3/library/json.html

### CSV
- Concept: CSV = comma-separated rows, used by spreadsheets. `csv.DictWriter`/`DictReader` map rows to dicts by header. Open files with `newline=""` as the csv docs require. Values read back are strings.
- Analogy: A spreadsheet saved as plain text — each line a row, commas between cells.
- Code example: `csv_demo.py` — write `people.csv` with DictWriter fields `name, age` rows Ada 36, Linus 28; read with DictReader, `for row in reader: print(row["name"], int(row["age"]) + 1)`; output `Ada 37\nLinus 29`.
- Production use: Data imports/exports, reports for business teams.
- Common mistakes: Splitting lines with `.split(",")` (breaks on quoted commas); forgetting `newline=""` (blank lines on Windows); forgetting values are strings.
- Sources: https://docs.python.org/3/library/csv.html

## Quiz
1. Why pass `encoding="utf-8"`? — tests encoding
2. What does `with` guarantee? — tests context manager closing
3. Python `None` becomes what in JSON? — tests JSON mapping
4. Type of values read by `csv.DictReader`? — tests CSV strings
