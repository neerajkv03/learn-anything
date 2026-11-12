# 25. SQLite with sqlite3
Version: Python 3.15.2 + uv 0.13.7 + SQLite 3.54.1
Prerequisites: 11-error-handling, 14-files-paths-data, 18-decorators-context-managers

## Learning goals
- After this topic, learner can explain what a database, a table, a row and SQL are.
- After this topic, learner can open a SQLite database with `sqlite3.connect` and create tables.
- After this topic, learner can insert and query rows (`execute`, `executemany`, `fetchone`, `fetchall`).
- After this topic, learner can always pass values with `?` / `:name` placeholders and explain SQL injection.
- After this topic, learner can group changes in a transaction with `with con:` (commit / rollback).
- After this topic, learner can read rows by column name with `sqlite3.Row` and close connections properly.

## Sub-topics
### What a database and SQL are
- Concept: Database = organised, permanent store of data. Relational DB = tables (like spreadsheets): columns (named, typed fields), rows (records). SQL (Structured Query Language) = language for asking a DB to create, read, change, delete data. SQLite = whole database in one file, no server, built into Python as `sqlite3` (stdlib, no `uv add`). Python ships its own SQLite library; its version can differ from SQLite 3.54.1 — check with `sqlite3.sqlite_version` (don't print it in example: varies). Keywords written UPPERCASE by convention.
- Analogy: A database is a filing cabinet; each table is a drawer of identical index cards (rows); each card has the same printed boxes (columns); SQL is the request slip you hand the clerk.
- Code example: `sql_intro.py` — `import sqlite3`; `con = sqlite3.connect(":memory:")` (":memory:" = temporary DB in RAM, gone when program ends); `print(con.execute("SELECT 1 + 2").fetchone())`; `print(con.execute("SELECT upper('hi')").fetchone())`; `con.close()`; output `(3,)\n('HI',)`. Explain: each row comes back as a tuple.
- Production use: Local app data, desktop/mobile apps, prototypes, small/medium web apps, caches, tests.
- Common mistakes: Thinking SQLite needs a server or install; confusing a table (structure) with a row (one record).
- Sources: https://docs.python.org/3/library/sqlite3.html#tutorial ; https://www.sqlite.org/about.html ; https://www.sqlite.org/lang_select.html

### Connecting and creating tables
- Concept: `sqlite3.connect("library.db")` opens the file, creating it if missing; returns a Connection. `CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY, title TEXT NOT NULL, year INTEGER)`. `INTEGER PRIMARY KEY` = unique row id, filled in automatically. `NOT NULL` = value required. Main SQLite types: INTEGER, REAL, TEXT, BLOB, NULL (= Python `None`). `sqlite_master` = built-in table listing tables.
- Analogy: Connecting = unlocking the cabinet (a new cabinet is built if none exists); CREATE TABLE = printing the blank card template for a new drawer.
- Code example: `create_table.py` — `import sqlite3`; `con = sqlite3.connect(":memory:")`; `con.execute("CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY, title TEXT NOT NULL, year INTEGER)")`; `names = [row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'")]`; `print(names)`; `con.close()`; output `['books']`. Explanation: swap `":memory:"` for `"library.db"` to keep data in a file.
- Production use: Schema setup at app startup; migration scripts.
- Common mistakes: Re-running `CREATE TABLE` without `IF NOT EXISTS` → `sqlite3.OperationalError: table books already exists`; misspelled file name silently creates a new empty DB.
- Sources: https://docs.python.org/3/library/sqlite3.html#sqlite3.connect ; https://www.sqlite.org/lang_createtable.html ; https://www.sqlite.org/datatype3.html

### Inserting and querying rows
- Concept: `INSERT INTO books (title, year) VALUES (?, ?)` adds rows; `?` = placeholder filled from a tuple (why: next sub-topic). `cur.lastrowid` = id of new row. `executemany(sql, list_of_tuples)` inserts many. `SELECT cols FROM table WHERE condition ORDER BY col`. Iterate the cursor, or `fetchone()` (one row or `None`) / `fetchall()` (list). Cursor = pointer over results returned by `execute`.
- Analogy: INSERT = filing new cards; SELECT … WHERE … ORDER BY = asking the clerk "cards after 1900, sorted by year".
- Code example: `books.py` — `import sqlite3`; `con = sqlite3.connect(":memory:")`; create `books` table as above; `cur = con.execute("INSERT INTO books (title, year) VALUES (?, ?)", ("Dune", 1965))`; `print(cur.lastrowid)`; `con.executemany("INSERT INTO books (title, year) VALUES (?, ?)", [("Emma", 1815), ("Ulysses", 1922)])`; `for row in con.execute("SELECT id, title FROM books WHERE year > 1900 ORDER BY year"): print(row)`; `print(con.execute("SELECT COUNT(*) FROM books").fetchone()[0])`; `con.close()`; output `1\n(3, 'Ulysses')\n(1, 'Dune')\n3`.
- Production use: Every CRUD (Create, Read, Update, Delete) feature of an app.
- Common mistakes: Expecting rows in insert order without `ORDER BY` (order not guaranteed); calling `fetchone()[0]` when no row matched (`None` → TypeError).
- Sources: https://docs.python.org/3/library/sqlite3.html#sqlite3.Cursor.fetchone ; https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.executemany ; https://www.sqlite.org/lang_insert.html

### Parameterized queries and SQL injection
- Concept: Never build SQL with f-strings/`+` from user input. SQL injection = attacker types text that changes the query's meaning. Placeholders: `?` (qmark, tuple) or `:name` (named, dict). Single value still needs a tuple: `(name,)`. Placeholders work for values only, not table/column names.
- Analogy: Filling a form box vs. letting a stranger rewrite the form: a placeholder is a sealed box — whatever is written inside stays a value, never an instruction.
- Code example: `injection.py` — `import sqlite3`; `con = sqlite3.connect(":memory:")`; `con.execute("CREATE TABLE users (name TEXT, is_admin INTEGER)")`; `con.executemany("INSERT INTO users VALUES (?, ?)", [("ada", 1), ("bob", 0)])`; `name = "nobody' OR '1'='1"`; unsafe: `print(con.execute(f"SELECT name FROM users WHERE name = '{name}' ORDER BY name").fetchall())`; safe: `print(con.execute("SELECT name FROM users WHERE name = ? ORDER BY name", (name,)).fetchall())`; named: `print(con.execute("SELECT name FROM users WHERE is_admin = :flag", {"flag": 1}).fetchall())`; `con.close()`; output `[('ada',), ('bob',)]\n[]\n[('ada',)]`. Explain unsafe query became `WHERE name = 'nobody' OR '1'='1'` (always true). Mark unsafe line with comment `# NEVER do this`.
- Production use: Every query with user-supplied values (login forms, search boxes, API parameters).
- Common mistakes: `(name)` instead of `(name,)` (a string, not a tuple → wrong number of bindings error); f-string SQL "just for a quick script".
- Sources: https://docs.python.org/3/library/sqlite3.html#sqlite3-placeholders ; https://owasp.org/www-community/attacks/SQL_Injection

### Transactions (commit / rollback)
- Concept: Transaction = group of changes that all succeed or all fail (atomic). With default settings, `sqlite3` starts a transaction automatically before INSERT/UPDATE/DELETE; changes are only saved by `con.commit()`; `con.rollback()` undoes them. `with con:` commits if the block succeeds, rolls back if it raises. `with con:` does NOT close the connection. `CHECK (balance >= 0)` = rule the DB enforces; breaking it raises `sqlite3.IntegrityError`. Don't cover the `autocommit` parameter beyond one sentence ("Python 3.12+ also has an `autocommit` option; this course uses the default").
- Analogy: Bank transfer: money leaves one account and arrives in the other, or neither happens — never half.
- Code example: `transfer.py` — `import sqlite3`; `con = sqlite3.connect(":memory:")`; `con.execute("CREATE TABLE accounts (name TEXT PRIMARY KEY, balance INTEGER CHECK (balance >= 0))")`; `with con: con.executemany("INSERT INTO accounts VALUES (?, ?)", [("ada", 100), ("bob", 50)])`; `def transfer(src: str, dst: str, amount: int) -> None:` `with con:` `con.execute("UPDATE accounts SET balance = balance + ? WHERE name = ?", (amount, dst))` then `con.execute("UPDATE accounts SET balance = balance - ? WHERE name = ?", (amount, src))`; `transfer("ada", "bob", 30)`; `print(con.execute("SELECT name, balance FROM accounts ORDER BY name").fetchall())`; `try: transfer("bob", "ada", 500)` `except sqlite3.IntegrityError as e: print("rolled back:", type(e).__name__)`; print balances again; `con.close()`; output `[('ada', 70), ('bob', 80)]\nrolled back: IntegrityError\n[('ada', 70), ('bob', 80)]`. Explain: ada's +500 was undone because bob's −500 failed.
- Production use: Orders + stock updates, payments, any multi-step change.
- Common mistakes: Forgetting to commit (changes vanish on close); assuming `with con:` closes the connection.
- Sources: https://docs.python.org/3/library/sqlite3.html#sqlite3-connection-context-manager ; https://docs.python.org/3/library/sqlite3.html#transaction-control ; https://www.sqlite.org/lang_transaction.html

### Row factories and closing connections
- Concept: `con.row_factory = sqlite3.Row` makes rows readable by column name (`row["title"]`) and index; `dict(row)` converts. Close connections with `con.close()` or `contextlib.closing(...)` in a `with`. Order: commit, then close.
- Analogy: Plain tuple rows = a card with unlabeled boxes (remember position); `sqlite3.Row` = boxes with printed labels. Closing = locking the cabinet when you leave.
- Code example: `rows.py` — `import sqlite3`; `from contextlib import closing`; `with closing(sqlite3.connect(":memory:")) as con:` `con.row_factory = sqlite3.Row`; `con.execute("CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT)")`; `con.execute("INSERT INTO books (title) VALUES (?)", ("Dune",))`; `row = con.execute("SELECT id, title FROM books").fetchone()`; `print(row["title"], row[0])`; `print(dict(row))`; output `Dune 1\n{'id': 1, 'title': 'Dune'}`.
- Production use: Turning rows into dicts/objects for APIs; resource cleanup in long-running servers.
- Common mistakes: Leaving connections open (file locks, "database is locked"); setting `row_factory` after the query was already run.
- Sources: https://docs.python.org/3/library/sqlite3.html#sqlite3.Row ; https://docs.python.org/3/library/sqlite3.html#how-to-create-and-use-row-factories ; https://docs.python.org/3/library/contextlib.html#contextlib.closing

## Quiz
1. Why is an f-string with user input dangerous in a SQL query? — tests SQL injection
2. What does `with con:` do on success, on exception — and does it close? — tests transactions
3. How do you pass a single value to `?` correctly? — tests `(value,)` tuple
4. What does `INTEGER PRIMARY KEY` give you? — tests auto ids / lastrowid
5. How do you read a column by name? — tests `sqlite3.Row`
