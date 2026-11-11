# 19. Standard Library Essentials
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 18-decorators-context-managers

## Learning goals
- After this topic, learner can count and group data with `Counter`, `defaultdict`, and `deque`.
- After this topic, learner can create, format, and do arithmetic with timezone-aware datetimes using `zoneinfo`.
- After this topic, learner can configure `logging` with levels and use loggers instead of `print`.
- After this topic, learner can build a command-line interface with `argparse`.
- After this topic, learner can cache expensive function results with `functools.cache` / `lru_cache`.

## Sub-topics
### collections (Counter, defaultdict, deque)
- Concept: `Counter` counts items (`most_common`); `defaultdict(list)` creates a default value for missing keys; `deque` is a double-ended queue with fast add/remove at both ends and optional `maxlen`.
- Analogy: Counter = a tally sheet; defaultdict = a filing cabinet that makes a new folder the first time you file under a new name; deque = a queue at a ticket counter where people can join or leave at either end.
- Code example: `collections_demo.py` — `from collections import Counter, defaultdict, deque`; `votes = ["py", "go", "py", "rs", "py", "go"]`; `print(Counter(votes).most_common(2))`; `by_letter = defaultdict(list)`; `for w in ["apple", "avocado", "banana"]: by_letter[w[0]].append(w)`; `print(dict(by_letter))`; `recent = deque(maxlen=3)`; `for n in range(5): recent.append(n)`; `print(list(recent))`; output `[('py', 3), ('go', 2)]\n{'a': ['apple', 'avocado'], 'b': ['banana']}\n[2, 3, 4]`.
- Production use: Metrics counting, grouping records, keeping the last N events.
- Common mistakes: `defaultdict(list())` instead of `defaultdict(list)`; using a list as a queue with `pop(0)` (slow).
- Sources: https://docs.python.org/3/library/collections.html

### datetime and zoneinfo
- Concept: `datetime` represents a date and time; `timedelta` a duration. Timezone-aware datetimes carry a `ZoneInfo("Asia/Kolkata")`. Store/compare in UTC, convert for display. Format with `strftime`/f-string specs, parse ISO strings with `fromisoformat`. Examples use fixed dates (never `now()`) so output is predictable.
- Analogy: A meeting time is useless without the city: "3 pm" in Mumbai isn't "3 pm" in London.
- Code example: `dates.py` — `from datetime import datetime, timedelta, UTC`; `from zoneinfo import ZoneInfo`; `meeting = datetime(2026, 11, 11, 9, 30, tzinfo=UTC)`; `print(meeting.isoformat())`; `print(meeting.astimezone(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m-%d %H:%M"))`; `print((meeting + timedelta(days=7)).date())`; `parsed = datetime.fromisoformat("2026-12-25T10:00:00+00:00")`; `print((parsed - meeting).days)`; output `2026-11-11T09:30:00+00:00\n2026-11-11 15:00\n2026-11-18\n44`.
- Production use: Timestamps in databases (UTC), scheduling, expiry times.
- Common mistakes: Naive datetimes (no timezone) mixed with aware ones (TypeError); on Windows, `zoneinfo` may need the `tzdata` package (`uv add tzdata`).
- Sources: https://docs.python.org/3/library/datetime.html ; https://docs.python.org/3/library/zoneinfo.html

### logging
- Concept: `logging` records what a program does, with levels DEBUG < INFO < WARNING < ERROR < CRITICAL. `logger = logging.getLogger(__name__)` per module; configure once at program start with `logging.basicConfig(level=..., format=...)`. Use `%s` placeholders (`logger.info("user %s", uid)`). `logger.exception()` logs the traceback.
- Analogy: A ship's logbook with entries marked routine, warning, or emergency.
- Code example: `log_demo.py` — `import logging`, `import sys`; `logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s", stream=sys.stdout)`; `logger = logging.getLogger("orders")`; `logger.debug("hidden")`; `logger.info("order %s created", 42)`; `logger.warning("stock low: %d left", 3)`; output `INFO orders: order 42 created\nWARNING orders: stock low: 3 left`. Explanation: `stream=sys.stdout` used here only so the output shows below; default is stderr. No timestamps in the format to keep the output stable.
- Production use: Every service logs to stdout/files collected by monitoring tools; levels filter noise.
- Common mistakes: Using `print` in services; f-strings in log calls (formatted even when filtered); calling `basicConfig` in library code.
- Sources: https://docs.python.org/3/howto/logging.html ; https://docs.python.org/3/library/logging.html

### argparse command-line tools
- Concept: A CLI (command-line interface) program takes options when run: `uv run greet.py Ada --times 2`. `argparse.ArgumentParser` declares positional arguments, options with types/defaults, flags (`action="store_true"`), and auto-generates `--help`. `parse_args(list)` can be given a list for testing.
- Analogy: An order form at a counter: required fields, optional boxes, and instructions printed on the back (`--help`).
- Code example: `greet.py` — `import argparse`; `def main(argv: list[str] | None = None) -> None:` parser with `name`, `--times` (int, default 1), `--shout` (store_true); build message; print. `if __name__ == "__main__": main(["Ada", "--times", "2", "--shout"])` — note in explanation real code calls `main()` to read the terminal; output `HELLO, ADA!\nHELLO, ADA!`.
- Production use: Admin scripts, data migration tools, internal utilities.
- Common mistakes: Forgetting `type=int` (value stays a string); parsing `sys.argv` by hand.
- Sources: https://docs.python.org/3/library/argparse.html ; https://docs.python.org/3/howto/argparse.html

### functools caching
- Concept: `@functools.cache` remembers results for arguments already seen (memoisation); `@lru_cache(maxsize=128)` keeps only the most recent N. Arguments must be hashable. `cache_info()` shows hits/misses.
- Analogy: Writing an answer on a sticky note so you don't redo the sum next time someone asks.
- Code example: `cache_demo.py` — `from functools import cache`; `@cache def fib(n: int) -> int: return n if n < 2 else fib(n - 1) + fib(n - 2)`; `print(fib(80))`; `print(fib.cache_info().currsize)`; output `23416728348467685\n81`.
- Production use: Caching config lookups, pure expensive computations.
- Common mistakes: Caching functions whose results change over time (stale data); unbounded `cache` on unlimited inputs (memory growth); list arguments (TypeError: unhashable).
- Sources: https://docs.python.org/3/library/functools.html#functools.cache ; https://docs.python.org/3/library/functools.html#functools.lru_cache

## Quiz
1. Which tool counts occurrences in a list? — tests Counter
2. Why store timestamps in UTC? — tests timezone handling
3. Which log level is hidden when level is INFO? — tests logging levels
4. In argparse, how do you get an integer option? — tests type=int
5. What does `@cache` do for repeated calls with the same argument? — tests memoisation
