window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "16-sync-patterns",
  "order": 16,
  "title": "Synchronization & Patterns",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Goroutines that share a variable can corrupt it, which is called a data race. This topic shows how to detect races with the -race flag and how to prevent them with mutexes (locks), sync.WaitGroup (a counter that waits for goroutines to finish), sync.Once (runs setup exactly once) and atomic counters (single numbers updated in one indivisible step). It ends with the worker pool, the standard pattern for running a fixed number of goroutines over many jobs.",
  "prerequisites": [
    "15-goroutines-channels"
  ],
  "subtopics": [
    {
      "id": "race-conditions-and-race-flag",
      "title": "Race conditions and the -race flag",
      "explanation": "A data race happens when two or more goroutines touch the same variable at the same time and at least one of them writes to it. Nothing in the language stops this. The result is unpredictable: sometimes the program looks fine, sometimes values are silently lost.\n\nThe usual culprit is an innocent-looking line such as count++. It is really three steps: read the current value, add one, write the result back. If two goroutines both read 5, both compute 6 and both write 6, one of the two increments is lost.\n\nThe example below starts 1000 goroutines that each do count++. To make main wait until they are all finished, it uses a sync.WaitGroup. A WaitGroup (explained fully in sub-topic 3) is a counter: wg.Add(1) says one more goroutine is running, wg.Done() says one has finished, and wg.Wait() pauses until the counter is back to zero. The \"defer\" inside the goroutine is the same defer from the functions topic: it runs wg.Done() when the goroutine's function ends.\n\nRun it a few times. The final number is often below 1000 and changes from run to run. The exact value is not predictable, which is exactly what makes races so hard to debug.\n\nGo has a built-in race detector. Add the -race flag to go run (or to go test, which you will meet in the testing topic) and the program is compiled with extra checks. When two goroutines touch the same memory without synchronization, it prints a report that starts with WARNING: DATA RACE and shows the file and line of each conflicting access. The detector only reports races that actually happen while the program runs, so it needs code that exercises the problem. It makes the program slower and use more memory, so it is for development and tests, not for production binaries. \n\nThe race detector needs a C compiler (gcc) on Windows. If go run -race fails with a gcc or cgo error, install a C compiler such as MinGW-w64, reopen the terminal, and run the command again.\n\nMaps have a related trap. Writing to the same map from two goroutines at once is not just a lost update: the runtime detects it and crashes the whole program with fatal error: concurrent map writes (a fatal error cannot be caught with recover). Protect shared maps with a lock, as shown in the next sub-topic.",
      "analogy": "Two people update the same whiteboard number at once. Both look and read 5, both erase it and write 6. The board says 6 although it should say 7: one update is lost. The race detector is a camera that films the whiteboard and flags the moment two people reached for the marker without taking turns.",
      "code": [
        {
          "language": "go",
          "filename": "race.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"sync\"\n)\n\nfunc main() {\n\tcount := 0\n\tvar wg sync.WaitGroup\n\n\tfor range 1000 {\n\t\twg.Add(1)\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\tcount++ // read, add, write: not safe when shared\n\t\t}()\n\t}\n\n\twg.Wait()\n\tfmt.Println(count)\n}\n",
          "output": "A number that is often below 1000 and differs between runs (it can occasionally be exactly 1000)",
          "explanation": "All 1000 goroutines share the single variable count, and count++ is not one indivisible step, so increments overwrite each other. Do not rely on any particular value. The program has a bug even on the runs where it happens to print 1000."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go run -race race.go",
          "output": "==================\nWARNING: DATA RACE\nRead at 0x00c000012345 by goroutine 8:\n  main.main.func1()\n      .../race.go:16 +0x...\n\nPrevious write at 0x00c000012345 by goroutine 7:\n  main.main.func1()\n      .../race.go:16 +0x...\n...\nFound 1 data race(s)\nexit status 66",
          "explanation": "Run this in the folder that contains race.go (open a terminal there, for example with cd). The addresses, goroutine numbers and paths differ on your machine. What matters is the WARNING: DATA RACE line and the line numbers of the two conflicting accesses. In a module you can also run go run -race . for the whole package."
        }
      ],
      "productionNote": "Run your tests with go test -race ./... in CI (continuous integration, the automatic build that runs on every code change). A race that never shows up on your laptop can corrupt data under production load, and the detector finds it before release.",
      "commonMistakes": [
        "Concluding the code is fine because it worked on your machine. Races depend on timing, so a program can pass a hundred runs and fail on the hundred-and-first.",
        "Assuming a map is safe for concurrent writes. Two goroutines writing to one map crash the program with fatal error: concurrent map writes.",
        "Running -race once and never again. It reports only races that happen during that run, so use it continuously, especially in tests that run goroutines.",
        "Fixing a race by adding time.Sleep. This only changes the timing and hides the bug instead of removing it."
      ],
      "sources": [
        {
          "title": "Data Race Detector",
          "url": "https://go.dev/doc/articles/race_detector"
        },
        {
          "title": "The Go Memory Model",
          "url": "https://go.dev/ref/mem"
        }
      ]
    },
    {
      "id": "mutex-and-rwmutex",
      "title": "sync.Mutex and sync.RWMutex",
      "explanation": "A mutex (short for mutual exclusion lock) lets only one goroutine at a time run a protected section of code. In Go it is the type sync.Mutex from the standard library package sync. Its two methods are Lock, which waits until the lock is free and then takes it, and Unlock, which gives it back.\n\nThe standard pattern is to call Lock and then immediately defer Unlock. The deferred call runs when the function ends, whether it returns normally, returns early or panics, so the lock is never left taken by mistake.\n\nKeep the mutex next to the data it guards, as a field in the same struct. The struct below holds a counter n and the mutex mu that protects it. Its methods use a pointer receiver (*Counter) so that every call works on the same Counter and the same mutex. With a value receiver, each call would get a copy of the struct, including a copy of the mutex, and the lock would protect nothing. A mutex must never be copied after first use. The go vet tool (from topic 1) has a check called copylocks that warns about this.\n\nA sync.RWMutex is a mutex with two modes. Many goroutines may hold the read lock at once (RLock and RUnlock), but the write lock (Lock and Unlock) is exclusive: it waits for all readers to leave and blocks new ones while held. Use it when reads are far more frequent than writes. If reads and writes are about equally common, a plain Mutex is simpler and often just as fast.\n\nThe second example is a small cache: a map from string to int guarded by an RWMutex. Remember that the map itself is not safe for concurrent writes, so every write goes through Lock and every read through RLock.",
      "analogy": "A mutex is a single bathroom key: whoever holds the key goes in, everyone else waits outside until it is handed back. An RWMutex is a museum room: many visitors may look at the paintings at the same time, but when the restorer needs to work, the room is closed to visitors and only the restorer is inside.",
      "code": [
        {
          "language": "go",
          "filename": "safe.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"sync\"\n)\n\ntype Counter struct {\n\tmu sync.Mutex\n\tn  int\n}\n\nfunc (c *Counter) Inc() {\n\tc.mu.Lock()\n\tdefer c.mu.Unlock()\n\tc.n++\n}\n\nfunc main() {\n\tvar c Counter\n\tvar wg sync.WaitGroup\n\n\tfor range 1000 {\n\t\twg.Add(1)\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\tc.Inc()\n\t\t}()\n\t}\n\n\twg.Wait()\n\tfmt.Println(c.n)\n}\n",
          "output": "1000",
          "explanation": "Inc takes the lock, so only one goroutine at a time executes c.n++. Now no increment is lost and the result is always 1000. Reading c.n in main is safe here because wg.Wait() guarantees all goroutines have finished."
        },
        {
          "language": "go",
          "filename": "cache.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"sync\"\n)\n\ntype Cache struct {\n\tmu   sync.RWMutex\n\tdata map[string]int\n}\n\nfunc NewCache() *Cache {\n\treturn &Cache{data: map[string]int{}}\n}\n\nfunc (c *Cache) Set(key string, v int) {\n\tc.mu.Lock() // exclusive: one writer, no readers\n\tdefer c.mu.Unlock()\n\tc.data[key] = v\n}\n\nfunc (c *Cache) Get(key string) (int, bool) {\n\tc.mu.RLock() // shared: many readers at once\n\tdefer c.mu.RUnlock()\n\tv, ok := c.data[key]\n\treturn v, ok\n}\n\nfunc main() {\n\tc := NewCache()\n\tc.Set(\"a\", 1)\n\n\tv, ok := c.Get(\"a\")\n\tfmt.Println(v, ok)\n\n\t_, ok = c.Get(\"b\")\n\tfmt.Println(ok)\n}\n",
          "output": "1 true\nfalse",
          "explanation": "Set uses the exclusive write lock and Get uses the shared read lock. The comma-ok form (from the maps topic) tells us whether the key existed. Key \"b\" was never stored, so ok is false."
        }
      ],
      "productionNote": "Mutex-guarded structs are the usual way to build in-memory caches, rate-limit tables (a map of who has made how many requests) and registries of connections. Keep the locked section short: do the slow work, such as network or disk calls, before taking the lock or after releasing it.",
      "commonMistakes": [
        "Forgetting Unlock, or placing it after an early return, so the next Lock waits forever. Always write defer mu.Unlock() right after mu.Lock().",
        "Using a value receiver on a type that contains a mutex. Each call copies the mutex, so the lock protects nothing. go vet reports this as copylocks.",
        "Holding a lock while doing slow work such as a network request. Every other goroutine that needs the lock is stuck waiting.",
        "Locking twice in the same goroutine (for example a locked method calling another locked method). A Mutex does not let the goroutine that already holds it lock it again; the second Lock waits for the first forever, which is a deadlock."
      ],
      "sources": [
        {
          "title": "sync.Mutex",
          "url": "https://pkg.go.dev/sync#Mutex"
        },
        {
          "title": "sync.RWMutex",
          "url": "https://pkg.go.dev/sync#RWMutex"
        }
      ]
    },
    {
      "id": "waitgroup-and-wg-go",
      "title": "sync.WaitGroup and wg.Go",
      "explanation": "When main starts goroutines it needs a way to wait for them. If main simply ends, the program exits and unfinished goroutines are stopped. A sync.WaitGroup is a counter for exactly this job.\n\nThe classic pattern has three calls. wg.Add(1) increases the counter before starting a goroutine. wg.Done() decreases it by one, and is normally written as defer wg.Done() at the top of the goroutine. wg.Wait() blocks until the counter reaches zero.\n\nSince Go 1.25 there is a shorter form: wg.Go(f) takes a function with no parameters and no result, does the Add(1), runs f in a new goroutine, and calls Done when f returns. You no longer write the go keyword, the Add or the Done yourself, which removes the most common WaitGroup mistakes.\n\nThe first example fills a slice with squares. Each goroutine writes only to its own index, results[i], so no two goroutines touch the same memory and there is no race. The variable i is safe to use inside the function: since Go 1.22 each pass of a for loop gets its own fresh i.\n\nThe second example shows the older pattern producing the same result. You will meet it in existing code. Go 1.27 includes a go fix modernizer (an automatic code-rewriting rule run by the go fix command) named waitgroupgo that converts this older pattern into wg.Go.",
      "analogy": "A tour guide counting heads. Each tourist who leaves the bus adds one to the count, each who returns subtracts one, and the bus only drives off when the count is zero. wg.Go is a guide who writes the head count automatically every time a tourist steps off.",
      "code": [
        {
          "language": "go",
          "filename": "wg.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"sync\"\n)\n\nfunc main() {\n\tresults := make([]int, 3)\n\tvar wg sync.WaitGroup\n\n\tfor i := range 3 {\n\t\twg.Go(func() {\n\t\t\tresults[i] = i * i\n\t\t})\n\t}\n\n\twg.Wait()\n\tfmt.Println(results)\n}\n",
          "output": "[0 1 4]",
          "explanation": "make([]int, 3) creates a slice of three zeros. Three goroutines each fill one slot. wg.Wait() blocks until all three are done, so the print shows the finished slice. The goroutines may run in any order, but every slot is written by exactly one of them."
        },
        {
          "language": "go",
          "filename": "wg_classic.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"sync\"\n)\n\nfunc main() {\n\tresults := make([]int, 3)\n\tvar wg sync.WaitGroup\n\n\tfor i := range 3 {\n\t\twg.Add(1) // before the goroutine starts\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\tresults[i] = i * i\n\t\t}()\n\t}\n\n\twg.Wait()\n\tfmt.Println(results)\n}\n",
          "output": "[0 1 4]",
          "explanation": "Same behaviour as wg.go, written the older way. wg.Add(1) is called in the loop, before the go statement, so the counter is already raised when Wait runs."
        }
      ],
      "productionNote": "WaitGroup is the tool for starting several independent calls in parallel and then waiting for all of them (for example fetching from three APIs) and continue once all have finished. Give each goroutine its own result slot, or protect shared results with a mutex. A WaitGroup does not collect errors for you, so store them per goroutine too.",
      "commonMistakes": [
        "Calling wg.Add inside the goroutine. Wait in main may run first, see a counter of zero and return before the goroutine has even registered. Call Add before the go statement, or use wg.Go.",
        "Copying a WaitGroup by value, for example passing it to a function as sync.WaitGroup instead of *sync.WaitGroup. The copy has its own counter, so the original never reaches zero.",
        "Calling Done more times than Add. The counter goes negative and the program panics.",
        "Having all goroutines write to the same variable and thinking the WaitGroup protects it. A WaitGroup only waits; it does not lock anything."
      ],
      "sources": [
        {
          "title": "sync.WaitGroup",
          "url": "https://pkg.go.dev/sync#WaitGroup"
        },
        {
          "title": "sync.WaitGroup.Go",
          "url": "https://pkg.go.dev/sync#WaitGroup.Go"
        },
        {
          "title": "Go 1.27 Release Notes",
          "url": "https://go.dev/doc/go1.27"
        }
      ]
    },
    {
      "id": "sync-once",
      "title": "sync.Once and OnceValue",
      "explanation": "Sometimes setup work must happen exactly one time, even when many goroutines ask for it: loading a config file, compiling an expensive pattern, creating a client. sync.Once guarantees that. Calling once.Do(f) runs f the first time only. Every later call to Do, from any goroutine, does nothing. If a second goroutine calls Do while the first is still running f, it waits until f finishes.\n\nsync.OnceValue(f) goes one step further. You give it a function that returns a value, and it returns a new function. The first time you call that new function it runs f and remembers the result. Every later call returns the remembered result without running f again.\n\nIf your setup can fail, use sync.OnceValues, which works the same way but remembers two results, normally a value and an error. A plain Once offers no way to hand an error back, so the failure would be lost. Note that OnceValues also remembers the error, so a failed setup is not retried.\n\nThe first example calls once.Do three times and prints init once. The second creates a cached loader and calls it twice. The third uses OnceValues with strconv.Atoi (which converts a string to an int and returns an error if it cannot).",
      "analogy": "Lighting the oven's pilot flame. The first cook who arrives lights it. Every cook after that just sees the flame burning and uses it without lighting it again. OnceValue is a recipe card on the wall: the first cook works it out and writes the answer on the card, everyone else just reads the card.",
      "code": [
        {
          "language": "go",
          "filename": "once.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"sync\"\n)\n\nfunc main() {\n\tvar once sync.Once\n\tfor range 3 {\n\t\tonce.Do(func() {\n\t\t\tfmt.Println(\"init\")\n\t\t})\n\t}\n\n\tgetCfg := sync.OnceValue(func() int {\n\t\tfmt.Println(\"loading\")\n\t\treturn 42\n\t})\n\tfmt.Println(getCfg(), getCfg())\n}\n",
          "output": "init\nloading\n42 42",
          "explanation": "The loop calls once.Do three times but init prints once. getCfg() runs the inner function on its first call, which prints loading and returns 42. The second call returns the stored 42 without printing. Both calls finish before Println prints, so loading appears before 42 42."
        },
        {
          "language": "go",
          "filename": "oncevalues.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"strconv\"\n\t\"sync\"\n)\n\nfunc main() {\n\tloadPort := sync.OnceValues(func() (int, error) {\n\t\treturn strconv.Atoi(\"8080\")\n\t})\n\n\tport, err := loadPort()\n\tfmt.Println(port, err)\n\n\tport, err = loadPort() // cached: same value and same error\n\tfmt.Println(port, err)\n}\n",
          "output": "8080 <nil>\n8080 <nil>",
          "explanation": "OnceValues remembers both the number and the error. Here Atoi succeeds, so err is nil (printed as <nil>). If the text were not a number, every call would return the same stored error."
        }
      ],
      "productionNote": "Use Once, OnceValue or OnceValues for lazy singletons: values that are created on first use and then shared, such as a loaded configuration, a compiled regular expression or an expensive client object. They are safe to call from many goroutines at once.",
      "commonMistakes": [
        "Putting code that can fail inside a plain Once.Do. The error has nowhere to go and the setup is never retried. Use OnceValues to keep both the value and the error.",
        "Expecting Once to run again after a failure. It runs the function once, success or not.",
        "Copying a sync.Once after use, or creating a new Once per call. Each new Once has its own memory, so the code would run again. Share one Once (for example as a package-level variable or struct field)."
      ],
      "sources": [
        {
          "title": "sync.Once",
          "url": "https://pkg.go.dev/sync#Once"
        },
        {
          "title": "sync.OnceValue",
          "url": "https://pkg.go.dev/sync#OnceValue"
        }
      ]
    },
    {
      "id": "worker-pools",
      "title": "Worker pools",
      "explanation": "Starting one goroutine per item is easy, but with a million items it means a million goroutines, a flood of open connections or files, and a crashed service. A worker pool limits concurrency: you start a fixed number N of worker goroutines, and they all take jobs from one shared channel.\n\nThe structure has four parts. A jobs channel carries the work. N workers each loop with for n := range jobs, process an item, and send the answer on a results channel. The producer sends all jobs and then calls close(jobs), which ends each worker's range loop once the channel is empty. Finally, something must close the results channel after all workers are done, otherwise the loop that reads results never ends.\n\nIn the example, 3 workers compute the square of the numbers 1 to 5. A WaitGroup tracks the workers. A small extra goroutine waits for them and then closes results. The main goroutine reads results with range and adds them up. The order in which jobs are processed varies between runs, but the total is always the same.\n\nBoth channels are buffered with room for 5 values, so sending all five jobs never blocks the producer, even before workers pick them up.",
      "analogy": "A supermarket with 3 checkout lanes. There is one queue of customers (the jobs channel) and 3 cashiers (the workers). Each cashier takes the next customer in line. The store never needs 100 cashiers for 100 customers, and when the doors close (close(jobs)) the cashiers finish the queue and go home.",
      "code": [
        {
          "language": "go",
          "filename": "pool.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"sync\"\n)\n\nfunc main() {\n\tjobs := make(chan int, 5)\n\tresults := make(chan int, 5)\n\n\tvar wg sync.WaitGroup\n\tfor range 3 { // 3 workers\n\t\twg.Go(func() {\n\t\t\tfor n := range jobs {\n\t\t\t\tresults <- n * n\n\t\t\t}\n\t\t})\n\t}\n\n\tfor n := 1; n <= 5; n++ {\n\t\tjobs <- n\n\t}\n\tclose(jobs) // no more jobs: workers' loops will end\n\n\tgo func() {\n\t\twg.Wait()\n\t\tclose(results) // all workers done: no more results\n\t}()\n\n\tsum := 0\n\tfor r := range results {\n\t\tsum += r\n\t}\n\tfmt.Println(sum)\n}\n",
          "output": "55",
          "explanation": "The squares are 1, 4, 9, 16 and 25, and their sum is 55. Which worker handles which number, and the order the results arrive in, can change between runs, but the sum cannot. Closing results is done in its own goroutine because main is busy reading results and cannot wait at the same time."
        }
      ],
      "productionNote": "Worker pools bound parallel downloads, image processing and database batch jobs, so you never overload the network, the CPU or a database that accepts only a limited number of connections. Choose N from the limit of the resource, not from the number of items.",
      "commonMistakes": [
        "Starting one goroutine per item with no limit. With large inputs this exhausts memory, file handles or remote servers.",
        "Forgetting to close(results). The final range over results waits forever and the program stops with a deadlock error (all goroutines are asleep).",
        "Forgetting to close(jobs). Workers wait forever for more jobs and wg.Wait never returns.",
        "Closing results from a worker. Other workers may still send on it, and sending on a closed channel panics. Close it only after wg.Wait() confirms all workers are done."
      ],
      "sources": [
        {
          "title": "Go Concurrency Patterns: Pipelines and cancellation",
          "url": "https://go.dev/blog/pipelines"
        },
        {
          "title": "Effective Go: Concurrency",
          "url": "https://go.dev/doc/effective_go#concurrency"
        }
      ]
    },
    {
      "id": "atomic-types",
      "title": "atomic types",
      "explanation": "A mutex protects a whole section of code. For one simple value, such as a counter or an on/off flag, there is something lighter: an atomic operation. Atomic means indivisible: the read-modify-write happens as a single step that no other goroutine can interrupt. The package sync/atomic provides types for this.\n\natomic.Int64 holds a 64-bit integer. Its methods are Add(delta), which adds to the value and returns the new value, Load(), which reads it, and Store(v), which sets it. atomic.Bool holds a true or false flag with Load and Store. atomic.Pointer[T] holds a pointer to a value of type T (the [T] is a type parameter, as in the generics topic) and is used to swap a whole configuration in one step.\n\nAll of them also have CompareAndSwap(old, new): it sets the value to new only if it currently equals old, and returns true if it did. This is the building block for lock-free logic such as \"only the first goroutine to flip this flag does the work\".\n\nThe zero value of each type is ready to use, so var n atomic.Int64 starts at 0. Always go through the methods, never copy the variable.\n\nAtomics fit only single values. If two fields must change together to stay consistent (for example a balance and a transaction count), use a mutex, because two separate atomic operations are not one atomic step.\n\nOlder code uses plain functions such as atomic.AddInt64(&n, 1) on an ordinary int64 variable. Go 1.27 adds a go fix modernizer named atomictypes that rewrites such code to the typed style used here.",
      "analogy": "A stadium turnstile. Even when a crowd pushes through at once, each person makes exactly one click and the counter goes up by exactly one per person. There is no clipboard and no one needs to take turns writing, the mechanism itself guarantees each click counts. But a turnstile can count only one number: if you also needed to keep a guest list in step with the count, you would need a gate attendant (a mutex).",
      "code": [
        {
          "language": "go",
          "filename": "atom.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"sync\"\n\t\"sync/atomic\"\n)\n\nfunc main() {\n\tvar n atomic.Int64\n\tvar wg sync.WaitGroup\n\n\tfor range 1000 {\n\t\twg.Go(func() {\n\t\t\tn.Add(1)\n\t\t})\n\t}\n\n\twg.Wait()\n\tfmt.Println(n.Load())\n}\n",
          "output": "1000",
          "explanation": "This is the counter from race.go, fixed with an atomic type. Each Add(1) is indivisible, so no increment is lost, and no mutex is needed."
        },
        {
          "language": "go",
          "filename": "flag.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"sync/atomic\"\n)\n\nfunc main() {\n\tvar stopping atomic.Bool\n\tstopping.Store(true)\n\tfmt.Println(stopping.Load())\n\n\tvar n atomic.Int64\n\tn.Store(5)\n\tswapped := n.CompareAndSwap(5, 10) // value is 5, so it becomes 10\n\tfmt.Println(swapped, n.Load())\n\n\tswapped = n.CompareAndSwap(5, 99) // value is now 10, not 5: no change\n\tfmt.Println(swapped, n.Load())\n}\n",
          "output": "true\ntrue 10\nfalse 10",
          "explanation": "The first CompareAndSwap succeeds because the value was 5. The second fails because the value is 10, so it returns false and leaves the value alone."
        }
      ],
      "productionNote": "Atomics are typical for request counters, metrics and a \"shutting down\" flag that many goroutines check. For anything involving more than one variable, use a mutex.",
      "commonMistakes": [
        "Mixing atomic and plain access to the same variable (for example reading it directly without Load). The plain access is still a data race.",
        "Using atomics to protect several related fields. Each operation is atomic on its own, but the group of them is not, so the invariant (the rule that must always hold between the fields) can break. Use a mutex instead.",
        "Copying an atomic value after use. Pass a pointer, or keep it as a field in a struct that is passed by pointer."
      ],
      "sources": [
        {
          "title": "atomic.Int64",
          "url": "https://pkg.go.dev/sync/atomic#Int64"
        },
        {
          "title": "Go 1.27 Release Notes",
          "url": "https://go.dev/doc/go1.27"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "What is a data race?",
      "options": [
        "Two goroutines access the same variable at the same time and at least one of them writes to it, with no synchronization",
        "Two goroutines compete to finish first, and the slower one is cancelled",
        "A goroutine that never finishes because it waits on a channel",
        "A program that runs slower because it uses too many goroutines"
      ],
      "answerIndex": 0,
      "explanation": "A data race is unsynchronized concurrent access to shared memory where at least one access is a write. A goroutine stuck forever is a deadlock or leak, which is a different problem, and slowness is not a race."
    },
    {
      "question": "Why do we write defer mu.Unlock() right after mu.Lock()?",
      "options": [
        "Because Unlock must run before Lock to prepare the mutex",
        "So the lock is released however the function exits, including early returns and panics",
        "Because defer makes the locked code run in a separate goroutine",
        "Because Go refuses to compile code that calls Lock without defer"
      ],
      "answerIndex": 1,
      "explanation": "A deferred call runs when the function ends, whatever the exit path, so the lock cannot be left held by mistake. defer does not start goroutines, and the compiler does not require it."
    },
    {
      "question": "What does wg.Go(f) replace?",
      "options": [
        "Creating a channel and closing it",
        "Using a mutex around f",
        "wg.Add(1), the go statement and defer wg.Done() around f",
        "Calling wg.Wait() after the loop"
      ],
      "answerIndex": 2,
      "explanation": "wg.Go (Go 1.25+) adds one to the counter, runs f in a new goroutine and calls Done when f returns. You still need wg.Wait() to block until everything is finished."
    },
    {
      "question": "Three goroutines each call once.Do(f) on the same sync.Once. How many times does f run?",
      "options": [
        "Three times, once per goroutine",
        "Zero times, because Do only registers f",
        "Exactly once",
        "Once per CPU core"
      ],
      "answerIndex": 2,
      "explanation": "sync.Once guarantees f runs exactly one time no matter how many goroutines call Do on that Once. The others wait for the first call to finish and then continue."
    },
    {
      "question": "Why is a worker pool better than starting one goroutine per item for a very large list?",
      "options": [
        "Goroutines cannot be started in a loop",
        "A worker pool removes the need for channels",
        "It guarantees results arrive in input order",
        "It bounds concurrency to N workers, so memory, connections and downstream services are not overwhelmed"
      ],
      "answerIndex": 3,
      "explanation": "A fixed number of workers limits how much runs at once. Goroutines can be started in loops, a pool still uses channels, and result order is not guaranteed in the example."
    }
  ]
});
