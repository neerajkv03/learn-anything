window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "17-context",
  "order": 17,
  "title": "Context",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7",
  "summary": "The context package gives every piece of concurrent work a shared way to hear \"stop now\", to know its time limit, and to read a few request-scoped facts such as a request ID. You will cancel work by hand, bound it with timeouts, pass a context through a call chain, and attach values safely.",
  "prerequisites": [
    "16-sync-patterns"
  ],
  "subtopics": [
    {
      "id": "what-context-is",
      "title": "What context.Context is",
      "explanation": "In the last two topics you started goroutines and learned to wait for them. What you could not yet do cleanly is tell running work to stop: when a user closes their browser tab, the server should abandon that request's work instead of finishing it for nobody. The standard library solves this with the package context, whose central type is context.Context.\n\ncontext.Context is an interface (a set of methods a type must have, as in topic 10). Four methods matter. Done() returns a channel that is closed when the work should stop. Err() returns nil while the work is still live, and afterwards says why it stopped. Deadline() reports the time limit, if any, as a time.Time plus a bool that says whether a limit exists. Value(key) looks up a request-scoped value (a small fact tied to one request, covered in the last sub-topic).\n\nA context is immutable: you never change one. Instead you derive a child from a parent (a new context built on top of an existing one). The child inherits everything from the parent and may add something, such as a cancel switch or a time limit. Cancelling a parent also cancels all its children, but never the other way round.\n\nEvery chain of contexts starts at a root. context.Background() returns an empty root that is never cancelled, has no deadline and holds no values. Use it in main, in tests and at the very top of a program. context.TODO() returns the same kind of empty context but signals \"I have not decided which context to use here yet\", so it is a visible placeholder while you refactor.",
      "analogy": "Think of a manager with a walkie-talkie network. Every worker on a job carries a radio tuned to the same channel. The manager can broadcast one message, \"stop now\", and every worker hears it, however many there are. Some radios also have a stamped end-of-shift time (the deadline), and a luggage-style tag clipped on (the values). Background is a radio that is switched on but has never received any message and has no end time.",
      "code": [
        {
          "language": "go",
          "filename": "bg.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n)\n\nfunc main() {\n\tctx := context.Background()\n\n\tfmt.Println(ctx.Err())\n\n\t_, hasDeadline := ctx.Deadline()\n\tfmt.Println(hasDeadline)\n\n\tfmt.Println(ctx.Done() == nil)\n\tfmt.Println(ctx)\n}\n",
          "output": "<nil>\nfalse\ntrue\ncontext.Background",
          "explanation": "To try it, create a folder, run go mod init example.com/ctx inside it, save this as bg.go and run go run . in that folder. Err() is nil because the root is never cancelled. Deadline() reports false, meaning no time limit. Done() returns a nil channel for Background, which no goroutine will ever receive from, so waiting on it blocks forever: this is how \"can never be cancelled\" is expressed. Printing the context shows its name, context.Background."
        }
      ],
      "productionNote": "Every incoming HTTP request already carries a context (topic 21 shows how to get it from the request variable r), and database and HTTP client calls accept one (topics 22 and 24). Production code therefore rarely creates a root: it receives a context from the caller and derives from it. Create context.Background() only in main, in tests, and in background jobs that have no caller.",
      "commonMistakes": [
        "Passing nil instead of a context. Many functions call methods on it and crash with a nil pointer panic. If you have no context, pass context.TODO() or context.Background().",
        "Leaving context.TODO() in finished code. It is a marker meaning \"fix me\"; replace it with a real context passed from the caller.",
        "Trying to modify a context in place. Contexts are immutable; every With... function returns a new child that you must use."
      ],
      "sources": [
        {
          "title": "Go package context",
          "url": "https://pkg.go.dev/context"
        },
        {
          "title": "Go Concurrency Patterns: Context",
          "url": "https://go.dev/blog/context"
        }
      ]
    },
    {
      "id": "with-cancel",
      "title": "WithCancel",
      "explanation": "context.WithCancel(parent) returns two things: a new child context and a cancel function. Calling cancel() closes the child's Done() channel. Anyone waiting with <-ctx.Done() wakes up, and ctx.Err() now returns context.Canceled, a ready-made error value meaning \"someone called cancel\".\n\nBecause receiving from a closed channel returns immediately (topic 15), one cancel() call wakes every goroutine that is waiting on that Done() channel, no matter how many there are. That is what makes context better than sending a message to each worker by hand.\n\nAlways write defer cancel() right after creating the context. A derived context is registered inside its parent so that cancellation can flow down; if you never call cancel, that registration (and any timer behind it) stays alive until the parent ends, which is a resource leak (memory and goroutines that are never freed). Calling cancel more than once is safe; only the first call has an effect. The go vet command has a check named lostcancel that warns when you forget.\n\nCancellation flows downward only. Cancelling a parent cancels its children; cancelling a child leaves the parent untouched.",
      "analogy": "A master off switch on an electrical circuit. Flip it and every machine wired to that circuit stops at once. A machine's own local switch (a child) only stops that machine, never the whole circuit, and the master switch (the parent) always wins.",
      "code": [
        {
          "language": "go",
          "filename": "cancel.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n)\n\nfunc main() {\n\tctx, cancel := context.WithCancel(context.Background())\n\tdefer cancel()\n\n\tstopped := make(chan struct{})\n\tgo func() {\n\t\t<-ctx.Done()\n\t\tfmt.Println(\"worker stopped:\", ctx.Err())\n\t\tclose(stopped)\n\t}()\n\n\tfmt.Println(\"cancelling\")\n\tcancel()\n\t<-stopped\n\n\tparent, cancelParent := context.WithCancel(context.Background())\n\tchild, cancelChild := context.WithCancel(parent)\n\tdefer cancelChild()\n\n\tcancelParent()\n\tfmt.Println(\"parent:\", parent.Err())\n\tfmt.Println(\"child:\", child.Err())\n}\n",
          "output": "cancelling\nworker stopped: context canceled\nparent: context canceled\nchild: context canceled",
          "explanation": "The worker goroutine blocks on <-ctx.Done() until main calls cancel(). It then prints the error and closes the stopped channel (a channel with no data, used only as a signal), so main waits for the print before moving on. The second half shows inheritance: cancelling only the parent also cancels the child. The deferred cancel calls at the end are harmless repeats."
        }
      ],
      "productionNote": "Use WithCancel to stop background workers when the program shuts down, and to abandon work as soon as a client disconnects. A typical worker is a loop with a select (topic 15) that handles both its job channel and <-ctx.Done(), and returns when Done fires.",
      "commonMistakes": [
        "Forgetting to call cancel. The context and its registration in the parent are never released, and go vet reports \"the cancel function is not used on all paths (possible context leak)\".",
        "Discarding the cancel function with _. You then have no way to stop the work or release the resources.",
        "Expecting cancel() to stop a goroutine by force. It only closes the Done channel; the goroutine must check Done() or Err() and return by itself."
      ],
      "sources": [
        {
          "title": "context.WithCancel",
          "url": "https://pkg.go.dev/context#WithCancel"
        }
      ]
    },
    {
      "id": "timeout-and-deadline",
      "title": "WithTimeout and WithDeadline",
      "explanation": "Often you do not want to cancel by hand; you want the work to stop after a time limit. context.WithTimeout(parent, d) creates a child that cancels itself after the duration d (a time.Duration, topic 13) has passed. context.WithDeadline(parent, t) does the same but takes an exact moment t (a time.Time). WithTimeout is simply WithDeadline with time.Now().Add(d).\n\nBoth return a cancel function, and you must still defer it: it releases the internal timer early if the work finishes before the limit. When the limit passes, Done() closes and Err() returns context.DeadlineExceeded. That differs from context.Canceled, so callers can tell \"timed out\" from \"someone cancelled\" using errors.Is (topic 11).\n\nA deadline can only get shorter down a chain. If a parent expires in 50 milliseconds and you derive a child with a one-hour timeout, the child still expires when the parent does. A child can tighten the limit but never extend it.\n\nA timeout does not stop code by itself. Your code has to listen: use select on ctx.Done() (as below) or check ctx.Err() in a loop.",
      "analogy": "A parking meter. You pay for a fixed time, and when it runs out you must leave, whatever you were doing. If you park in a garage whose own closing time is earlier than your ticket, the garage closing time still wins: you cannot buy more time than the parent allows.",
      "code": [
        {
          "language": "go",
          "filename": "timeout.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"errors\"\n\t\"fmt\"\n\t\"time\"\n)\n\nfunc main() {\n\tctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)\n\tdefer cancel()\n\n\tselect {\n\tcase <-time.After(time.Second):\n\t\tfmt.Println(\"finished\")\n\tcase <-ctx.Done():\n\t\tfmt.Println(ctx.Err())\n\t}\n\tfmt.Println(errors.Is(ctx.Err(), context.DeadlineExceeded))\n\n\tparent, cancelParent := context.WithTimeout(context.Background(), 50*time.Millisecond)\n\tdefer cancelParent()\n\tchild, cancelChild := context.WithTimeout(parent, time.Hour)\n\tdefer cancelChild()\n\n\tparentDeadline, _ := parent.Deadline()\n\tchildDeadline, _ := child.Deadline()\n\tfmt.Println(childDeadline.Equal(parentDeadline))\n\n\tabsolute, cancelAbs := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))\n\tdefer cancelAbs()\n\tfmt.Println(absolute.Err())\n}\n",
          "output": "context deadline exceeded\ntrue\ntrue\ncontext deadline exceeded",
          "explanation": "The select waits for whichever channel is ready first. The 50 ms context fires long before the 1 s timer, so the timeout branch runs and Err() is context deadline exceeded. Then a child with a one-hour timeout reports the same deadline as its 50 ms parent: it cannot extend it. Last, WithDeadline with a moment one second in the past is already expired, so its Err() is set immediately."
        }
      ],
      "productionNote": "Give every outgoing database or HTTP call its own timeout, derived from the request context (topics 22 and 24), so a slow dependency cannot hang your server. Choose a budget per call, not one number for everything.",
      "commonMistakes": [
        "Creating one timeout for a whole batch of calls when each call needs its own. Later calls then inherit an almost-empty budget; derive a fresh WithTimeout per call.",
        "Ignoring ctx inside a long loop. The timeout fires but the loop keeps running; check ctx.Err() on each iteration or select on Done().",
        "Comparing errors with == against the string text. Use errors.Is(err, context.DeadlineExceeded) so wrapped errors are matched too."
      ],
      "sources": [
        {
          "title": "context.WithTimeout",
          "url": "https://pkg.go.dev/context#WithTimeout"
        },
        {
          "title": "context.WithDeadline",
          "url": "https://pkg.go.dev/context#WithDeadline"
        }
      ]
    },
    {
      "id": "passing-context",
      "title": "Passing context through calls",
      "explanation": "A context only works if it reaches the code doing the work. The Go convention is strict and simple: any function that does I/O (input and output, such as reading a file, calling a network service or querying a database), waits, or may take long takes ctx context.Context as its first parameter, named ctx. Each function passes it on to the functions it calls, either unchanged or as a derived child.\n\nInside long loops, check ctx.Err() on each iteration (or select on ctx.Done()) and return the error when it is not nil. That is how cancellation actually stops your loop.\n\nDo not store a context inside a struct field. A context belongs to one call (one request), while a struct usually lives much longer, so a stored context becomes stale and hides which call it belongs to. Pass it as a parameter to each method instead.\n\nDo not call context.Background() in the middle of a call chain. That creates a fresh root that is disconnected from the caller, so cancellation and timeouts stop at that point.",
      "analogy": "A relay baton passed down the chain of runners. Every runner carries the same baton, so when the officials announce \"race cancelled\" on the baton, the message reaches every runner in turn. A runner who throws the baton away and grabs a brand new one (context.Background()) breaks the chain, and the next runners never hear the announcement.",
      "code": [
        {
          "language": "go",
          "filename": "chain.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n)\n\nfunc process(ctx context.Context, items []string) error {\n\tfor _, it := range items {\n\t\tif err := ctx.Err(); err != nil {\n\t\t\treturn err\n\t\t}\n\t\tfmt.Println(\"processed\", it)\n\t}\n\treturn nil\n}\n\nfunc main() {\n\titems := []string{\"a\", \"b\"}\n\n\tfmt.Println(process(context.Background(), items))\n\n\tctx, cancel := context.WithCancel(context.Background())\n\tcancel()\n\tfmt.Println(process(ctx, items))\n}\n",
          "output": "processed a\nprocessed b\n<nil>\ncontext canceled",
          "explanation": "process takes ctx first and checks ctx.Err() before each item. With Background, both items are processed and the function returns nil. With a context that was already cancelled, the very first check fails, nothing is processed, and the function returns context canceled to its caller."
        }
      ],
      "productionNote": "In a real service the same ctx flows from the HTTP handler to the service layer to the repository that talks to the database, so one client disconnect or timeout stops the whole chain. Reviewers expect to see ctx as the first parameter on every such function.",
      "commonMistakes": [
        "Calling context.Background() deep inside a function that already received a ctx. Cancellation and deadlines no longer reach that part of the work.",
        "Storing ctx as a struct field. It outlives the call it belonged to; pass it to each method instead.",
        "Putting ctx anywhere but first in the parameter list, which breaks the convention that tools and readers rely on."
      ],
      "sources": [
        {
          "title": "Go package context overview",
          "url": "https://pkg.go.dev/context#pkg-overview"
        },
        {
          "title": "Contexts and structs",
          "url": "https://go.dev/blog/context-and-structs"
        }
      ]
    },
    {
      "id": "context-values",
      "title": "Context values (sparingly)",
      "explanation": "context.WithValue(parent, key, val) returns a child that carries one key-value pair. Read it back with ctx.Value(key), which returns the value as type any (topic 10) or nil if the key is missing. Because of that, you convert it with a type assertion: ctx.Value(k).(string) in the comma-ok form id, ok := ... so a missing key gives ok false instead of a panic.\n\nThe key must not be a plain string. Two packages could both use the string \"id\" and overwrite each other's values. Instead, define your own unexported type (a lowercase name, topic 12), for example type requestIDKey struct{}. Only your package can create that type, so nobody else's key can ever equal yours. Wrap the get and set in small exported functions so callers never touch the key.\n\nUse values only for request-scoped data that crosses API boundaries: a request ID for logs, or the authenticated user found by middleware. Do not use them for optional function parameters or for dependencies such as a database handle or configuration; those belong in explicit parameters or struct fields, where the compiler can check them.",
      "analogy": "A luggage tag on a suitcase. The tag identifies the trip (whose bag, which flight) and travels with the bag through every handler, but it is not the luggage. You would never pack your clothes into the tag, and you would not hide required items in it either.",
      "code": [
        {
          "language": "go",
          "filename": "values.go",
          "source": "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n)\n\ntype requestIDKey struct{}\n\nfunc WithRequestID(ctx context.Context, id string) context.Context {\n\treturn context.WithValue(ctx, requestIDKey{}, id)\n}\n\nfunc RequestID(ctx context.Context) (string, bool) {\n\tid, ok := ctx.Value(requestIDKey{}).(string)\n\treturn id, ok\n}\n\nfunc main() {\n\tctx := WithRequestID(context.Background(), \"req-42\")\n\n\tid, ok := RequestID(ctx)\n\tfmt.Printf(\"%q %t\\n\", id, ok)\n\n\tid, ok = RequestID(context.Background())\n\tfmt.Printf(\"%q %t\\n\", id, ok)\n}\n",
          "output": "\"req-42\" true\n\"\" false",
          "explanation": "requestIDKey is an unexported empty struct type used only as a key. WithRequestID and RequestID hide it. The first lookup finds the value and the string assertion succeeds. On a plain Background context there is no value, Value returns nil, the assertion fails quietly with ok false, and id is the empty string."
        }
      ],
      "productionNote": "Typical uses are a request ID that your logger prints on every line (topic 23) and the authenticated user set by middleware (topic 21). Keep the list tiny; if you are unsure whether something belongs in a context, make it an ordinary parameter.",
      "commonMistakes": [
        "Using a string or int as the key. Different packages can collide, and linters such as staticcheck warn about it. Use your own unexported type.",
        "Stuffing a database handle, logger or configuration into the context. It hides dependencies and makes code hard to test; pass them explicitly.",
        "Using a one-value type assertion ctx.Value(k).(string), which panics when the value is missing. Use the comma-ok form."
      ],
      "sources": [
        {
          "title": "context.WithValue",
          "url": "https://pkg.go.dev/context#WithValue"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "What does ctx.Done() return?",
      "options": [
        "A bool that is true once the work has finished successfully",
        "A channel that is closed when the context is cancelled or times out",
        "The error explaining why the context ended",
        "A function that you call to cancel the context"
      ],
      "answerIndex": 1,
      "explanation": "Done() returns a channel. It is closed on cancellation or timeout, so receiving from it unblocks. The reason is given by Err(), and the cancel function is a separate return value of WithCancel."
    },
    {
      "question": "Why should you always write defer cancel() after WithCancel or WithTimeout?",
      "options": [
        "Without it the compiler refuses to build the program",
        "It makes the work run faster",
        "It releases the context's resources (such as the timer and its link to the parent) even when the work ends early, avoiding a leak",
        "It is required so that ctx.Err() returns nil"
      ],
      "answerIndex": 2,
      "explanation": "The context stays registered with its parent, and a timeout context holds a timer, until cancel runs. Deferring it frees those on every path. It is not a compile error to omit it, but go vet warns."
    },
    {
      "question": "A context created with WithTimeout has run out of time. What does ctx.Err() return?",
      "options": [
        "nil",
        "context.Canceled",
        "context.DeadlineExceeded",
        "io.EOF"
      ],
      "answerIndex": 2,
      "explanation": "A timeout or passed deadline gives context.DeadlineExceeded. context.Canceled is for an explicit cancel() call."
    },
    {
      "question": "Where does ctx belong in a function signature, according to Go convention?",
      "options": [
        "As the first parameter, named ctx",
        "As the last parameter",
        "As a field of the struct that owns the method",
        "As a package-level global variable"
      ],
      "answerIndex": 0,
      "explanation": "The convention is func F(ctx context.Context, other ...). Storing a context in a struct or a global ties it to the wrong lifetime."
    },
    {
      "question": "Which of these is an appropriate use of context.WithValue?",
      "options": [
        "Passing the database connection to the repository functions",
        "Passing an optional page-size setting to a function",
        "Passing the request ID that logging code needs across API boundaries",
        "Passing the program's configuration struct"
      ],
      "answerIndex": 2,
      "explanation": "Context values are for request-scoped data such as a request ID or the authenticated user. Dependencies, configuration and optional parameters should be explicit parameters or fields."
    }
  ]
});
