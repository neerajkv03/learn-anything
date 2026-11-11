# 22. Concurrency & asyncio
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 21-code-quality

## Learning goals
- After this topic, learner can explain concurrency vs parallelism and I/O-bound vs CPU-bound work.
- After this topic, learner can run I/O-bound tasks in threads with `ThreadPoolExecutor`.
- After this topic, learner can run CPU-bound tasks in processes with `ProcessPoolExecutor` (with the `__main__` guard).
- After this topic, learner can write coroutines with `async def` / `await` and run them with `asyncio.run`.
- After this topic, learner can run tasks concurrently with `asyncio.gather` and `asyncio.TaskGroup`.

## Sub-topics
### Concurrency vs parallelism
- Concept: Concurrency = making progress on several tasks by switching while one waits; parallelism = literally running at the same time on several CPU cores. I/O-bound = mostly waiting (network, disk); CPU-bound = mostly computing. Standard CPython has a GIL (Global Interpreter Lock) that lets only one thread run Python code at a time, so threads help I/O-bound work, processes help CPU-bound work. A free-threaded build (no GIL) is officially supported but optional — mention only as "exists, check docs".
- Analogy: One chef juggling three pans while each simmers (concurrency) vs three chefs each cooking one dish (parallelism).
- Code example: `bash`-free conceptual `python` example `kinds.py` — `tasks = {"download file": "I/O-bound", "resize image": "CPU-bound", "query database": "I/O-bound"}`; loop print `f"{task}: {kind}"`; output `download file: I/O-bound\nresize image: CPU-bound\nquery database: I/O-bound`.
- Production use: Choosing the right model is the first design decision for web servers, scrapers, and data jobs.
- Common mistakes: Using threads to speed up pure computation on a GIL build; adding concurrency where simple sequential code is fast enough.
- Sources: https://docs.python.org/3/library/concurrency.html ; https://docs.python.org/3/glossary.html#term-global-interpreter-lock ; https://docs.python.org/3/howto/free-threading-python.html

### Threads with concurrent.futures
- Concept: `ThreadPoolExecutor(max_workers=4)` runs functions in a pool of threads; `executor.map(func, items)` returns results **in input order** (deterministic). Use `with` so threads are cleaned up. Shared mutable data needs a `threading.Lock`.
- Analogy: A call centre with four operators taking calls from one queue.
- Code example: `threads.py` — `import time`; `from concurrent.futures import ThreadPoolExecutor`; `def fetch(page: int) -> str: time.sleep(0.1); return f"page {page} ok"` (sleep simulates waiting for a network); `with ThreadPoolExecutor(max_workers=3) as pool: for result in pool.map(fetch, [1, 2, 3]): print(result)`; output `page 1 ok\npage 2 ok\npage 3 ok`. Explanation: total ~0.1 s instead of 0.3 s; don't print timings (they vary).
- Production use: Many concurrent HTTP calls or file reads in scripts and batch jobs.
- Common mistakes: Printing from many threads and expecting a fixed order (use `map` results); unprotected shared counters (race conditions).
- Sources: https://docs.python.org/3/library/concurrent.futures.html#threadpoolexecutor

### Processes for CPU-bound work
- Concept: `ProcessPoolExecutor` runs work in separate processes (each with its own interpreter), so CPU-bound work uses several cores. Arguments/results are copied between processes (must be picklable). The `if __name__ == "__main__":` guard is required (processes re-import the main module on Windows/macOS).
- Analogy: Hiring extra kitchens instead of extra hands in one kitchen — more capacity, but ingredients must be shipped over.
- Code example: `processes.py` — `from concurrent.futures import ProcessPoolExecutor`; `def count_primes(limit: int) -> int: return sum(1 for n in range(2, limit) if all(n % d for d in range(2, int(n ** 0.5) + 1)))`; `def main() -> None: with ProcessPoolExecutor() as pool: print(list(pool.map(count_primes, [10, 100, 1000])))`; guard; output `[4, 25, 168]`.
- Production use: Image processing, data crunching, report generation.
- Common mistakes: Missing `__main__` guard (crash or endless spawning); sending huge objects between processes (slow).
- Sources: https://docs.python.org/3/library/concurrent.futures.html#processpoolexecutor ; https://docs.python.org/3/library/multiprocessing.html#the-spawn-and-forkserver-start-methods

### async and await
- Concept: `async def` defines a coroutine (a function that can pause). `await` pauses it until another awaitable finishes, letting the event loop (the scheduler) run other coroutines meanwhile. `asyncio.run(main())` starts the loop. Calling an async function without `await` just creates a coroutine object — nothing runs. `asyncio.sleep` (not `time.sleep`) in async code.
- Analogy: A waiter who takes an order, and while the kitchen cooks, serves other tables instead of standing still.
- Code example: `async_basics.py` — `import asyncio`; `async def brew(drink: str) -> str: await asyncio.sleep(0.1); return f"{drink} ready"`; `async def main() -> None: print(await brew("tea"))`; `asyncio.run(main())`; output `tea ready`.
- Production use: Async web frameworks (FastAPI), high-concurrency network clients, websockets.
- Common mistakes: Forgetting `await` (coroutine never runs, warning shown); calling blocking code like `time.sleep` or `requests` inside async functions.
- Sources: https://docs.python.org/3/library/asyncio-task.html#coroutines ; https://docs.python.org/3/library/asyncio-runner.html#asyncio.run

### asyncio.gather and TaskGroup
- Concept: `await asyncio.gather(a(), b(), c())` runs coroutines concurrently and returns results in argument order. `async with asyncio.TaskGroup() as tg: t = tg.create_task(...)` (3.11+) is the structured, safer approach: if one task fails, the others are cancelled and errors are raised together (`ExceptionGroup`). `asyncio.timeout(seconds)` limits waiting.
- Analogy: A team leader who sends everyone out together and waits until all report back — and recalls the team if one hits trouble.
- Code example: `gather_taskgroup.py` — `import asyncio`; `async def fetch(name: str, delay: float) -> str: await asyncio.sleep(delay); return f"{name} done"`; `async def main() -> None: results = await asyncio.gather(fetch("a", 0.2), fetch("b", 0.1)); print(results); async with asyncio.TaskGroup() as tg: t1 = tg.create_task(fetch("x", 0.1)); t2 = tg.create_task(fetch("y", 0.05)); print(t1.result(), t2.result())`; `asyncio.run(main())`; output `['a done', 'b done']\nx done y done`.
- Production use: Calling several services in parallel per web request; fan-out/fan-in jobs.
- Common mistakes: Awaiting tasks one by one in a loop (sequential, not concurrent); fire-and-forget tasks with no reference (can be garbage collected).
- Sources: https://docs.python.org/3/library/asyncio-task.html#running-tasks-concurrently ; https://docs.python.org/3/library/asyncio-task.html#task-groups

## Quiz
1. Threads or processes for CPU-heavy work on standard CPython? — tests GIL implications
2. What happens if you call an async function without `await`? — tests coroutine objects
3. In what order does `asyncio.gather` return results? — tests gather ordering
4. Why is the `__main__` guard required with `ProcessPoolExecutor`? — tests process spawning
5. Which should you use inside async code: `time.sleep` or `asyncio.sleep`? — tests blocking calls
