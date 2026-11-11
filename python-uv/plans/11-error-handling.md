# 11. Error Handling
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 10-type-hints

## Learning goals
- After this topic, learner can read a traceback and name common exceptions.
- After this topic, learner can handle errors with `try / except / else / finally`, catching specific exceptions.
- After this topic, learner can raise exceptions with helpful messages.
- After this topic, learner can define custom exception classes for their own code.
- After this topic, learner can chain exceptions with `raise ... from ...`.

## Sub-topics
### What exceptions are
- Concept: An exception is Python's signal that something went wrong at run time. Unhandled, it stops the program and prints a traceback (the chain of calls, last line = error type + message). Common: `ValueError`, `TypeError`, `KeyError`, `IndexError`, `ZeroDivisionError`, `FileNotFoundError`.
- Analogy: A smoke alarm: it interrupts everything and tells you which room has the problem.
- Code example: `traceback_demo.py` — a short script that triggers `int("abc")`; output `""` (traceback goes to stderr, not stdout); explanation shows the last traceback line `ValueError: invalid literal for int() with base 10: 'abc'`.
- Production use: Reading tracebacks from logs is the first step in debugging production incidents.
- Common mistakes: Reading only the top of the traceback (the cause is at the bottom); confusing syntax errors (before running) with exceptions (while running).
- Sources: https://docs.python.org/3/tutorial/errors.html ; https://docs.python.org/3/library/exceptions.html

### try / except / else / finally
- Concept: `try` runs risky code; `except SomeError as e` handles that error; `else` runs only if no error; `finally` always runs (cleanup). Catch the most specific exception possible. Several types: `except (A, B):`.
- Analogy: A trapeze artist with a safety net (except) and a crew that always tidies the ring afterwards (finally).
- Code example: `safe_divide.py` — `def parse_and_divide(a: str, b: str) -> None:` try `result = int(a) / int(b)`; `except ValueError: print("not a number")`; `except ZeroDivisionError: print("cannot divide by zero")`; `else: print(f"result={result}")`; `finally: print("done")`. Calls with ("10","2"), ("10","0"), ("x","1"); output `result=5.0\ndone\ncannot divide by zero\ndone\nnot a number\ndone`.
- Production use: Handling bad input, missing files, and failed network calls without crashing a whole service.
- Common mistakes: Bare `except:` or `except Exception: pass` hiding real bugs; too much code inside `try`.
- Sources: https://docs.python.org/3/tutorial/errors.html#handling-exceptions ; https://docs.python.org/3/reference/compound_stmts.html#the-try-statement

### Raising exceptions
- Concept: `raise ValueError("message")` signals a problem to the caller. Validate inputs early ("fail fast"). Re-raise with bare `raise` inside except.
- Analogy: A referee blowing the whistle: play stops, and the reason is announced.
- Code example: `withdraw.py` — `def withdraw(balance: float, amount: float) -> float:` if `amount <= 0: raise ValueError("amount must be positive")`; if `amount > balance: raise ValueError("insufficient funds")`; `return balance - amount`. `print(withdraw(100, 30))`; try `withdraw(100, 500)` except ValueError as e: `print(f"Error: {e}")`; output `70\nError: insufficient funds`.
- Production use: Validation at function and API boundaries.
- Common mistakes: Returning error codes/strings instead of raising; vague messages ("error").
- Sources: https://docs.python.org/3/tutorial/errors.html#raising-exceptions

### Custom exception classes
- Concept: `class PaymentError(Exception): pass` — named errors for your domain; subclass hierarchies let callers catch a whole family. Classes are covered fully in topic 15; here only the one-line pattern.
- Analogy: Hospital colour codes — a specific code tells staff exactly what kind of emergency.
- Code example: `custom_errors.py` — `class AppError(Exception): """Base error for this app."""`; `class NotFoundError(AppError): pass`; `def get_order(order_id: int) -> str: raise NotFoundError(f"order {order_id} not found")`; try/except AppError as e: `print(type(e).__name__, "-", e)`; output `NotFoundError - order 42 not found`.
- Production use: Libraries expose a base exception so users can catch everything from that library.
- Common mistakes: Inheriting from `BaseException` (catches Ctrl+C); creating dozens of unused exception types.
- Sources: https://docs.python.org/3/tutorial/errors.html#user-defined-exceptions

### Exception chaining
- Concept: `raise NewError("...") from err` keeps the original cause visible in the traceback (`__cause__`). Used when translating low-level errors to domain errors.
- Analogy: A doctor's referral letter: the new diagnosis plus the original test result attached.
- Code example: `chaining.py` — `class ConfigError(Exception): pass`; `def load_port(text: str) -> int:` try `return int(text)` except ValueError as err: `raise ConfigError(f"bad port: {text!r}") from err`; try `load_port("eighty")` except ConfigError as e: `print(e)`; `print(type(e.__cause__).__name__)`; output `bad port: 'eighty'\nValueError`.
- Production use: Service layers wrap database/driver errors in domain errors without losing the root cause.
- Common mistakes: Raising a new error without `from` (cause shown as "During handling..." confusion); swallowing the original error.
- Sources: https://docs.python.org/3/tutorial/errors.html#exception-chaining

## Quiz
1. When does an `else` block after `try` run? — tests else
2. Why avoid `except Exception: pass`? — tests swallowing errors
3. What does `raise X from err` preserve? — tests chaining
4. Which exception does `{"a": 1}["b"]` raise? — tests KeyError
