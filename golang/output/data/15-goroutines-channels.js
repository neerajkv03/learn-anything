window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "15-goroutines-channels",
  "order": 15,
  "title": "Goroutines & Channels",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7",
  "summary": "Go makes it cheap to run many tasks at once. A goroutine is a task started with the go keyword, and a channel is a typed pipe that goroutines use to hand values to each other. You will also learn to close channels, loop over them, and wait on several of them with select, including timeouts.",
  "prerequisites": [
    "14-generics"
  ],
  "subtopics": [
    {
      "id": "goroutines",
      "title": "Goroutines",
      "explanation": "Concurrency means having many tasks in progress at the same time (they may take turns on one processor core or run truly in parallel on several cores; Go decides). A goroutine is Go's unit of concurrency: a function call that runs independently of the code that started it. It is a lightweight thread managed by the Go runtime (the part of every Go program that schedules goroutines), so a program can have thousands of them cheaply.\n\nYou start a goroutine by putting the keyword go in front of a function call. This is called a go statement. The call returns immediately and the current code keeps running, while the called function runs on its own in the background. Any arguments to the call are evaluated right away, in the caller.\n\nThe most important rule: when the main function returns, the whole program exits and every other goroutine is stopped on the spot, even if it has not finished. main does not wait for goroutines. So you need a way to wait for them. In this topic we wait using a channel. A channel is a typed pipe between goroutines (the next sub-topic covers it fully). In the example, done <- true sends the value true into the channel, and <-done receives a value from it. The receive pauses (blocks) main until something has been sent.\n\nThe tempting alternative is time.Sleep (pause for a fixed duration) to give the goroutine time to finish. Do not do this: you are guessing how long the work takes, so the program is either slow or flaky. Topic 16 adds sync.WaitGroup, the standard tool for waiting on many goroutines.",
      "analogy": "A restaurant kitchen. The chef (main) hands out jobs to helpers (goroutines) and carries on cooking. The chef does not automatically wait for them. When the restaurant closes (main returns), everyone goes home immediately, even if a helper is halfway through a dish. To be sure a job is finished, the chef needs a signal, such as a helper ringing a bell (a channel message) when the dish is ready.",
      "code": [
        {
          "language": "go",
          "filename": "hello_go.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tdone := make(chan bool)\n\n\tgo func() {\n\t\tfmt.Println(\"from goroutine\")\n\t\tdone <- true\n\t}()\n\n\t<-done\n\tfmt.Println(\"main done\")\n}\n",
          "output": "from goroutine\nmain done",
          "explanation": "go func() { ... }() starts an anonymous function (a function without a name, from topic 4) as a goroutine; the trailing () calls it. Main then reaches <-done and blocks. The goroutine prints, then sends true. That releases main, which prints its last line. Because main waits for the signal, the output order is always the same. Run it with go run hello_go.go inside the folder that contains the file."
        }
      ],
      "productionNote": "In real services you rarely start goroutines by hand for requests: the net/http server (topic 21) runs each incoming request in its own goroutine for you. You start goroutines yourself for background work such as sending emails, polling, or processing a queue. Always decide how each goroutine will stop, and who waits for it.",
      "commonMistakes": [
        "Using time.Sleep to wait for a goroutine. It is a guess, so the program is flaky or needlessly slow. Wait with a channel or sync.WaitGroup instead.",
        "Letting main return before the goroutines finish. The program exits and their work is silently lost.",
        "Goroutine leaks: a goroutine blocked forever (for example waiting to receive from a channel nobody will ever send to) is never cleaned up and wastes memory for the life of the program."
      ],
      "sources": [
        {
          "title": "The Go Programming Language Specification: Go statements",
          "url": "https://go.dev/ref/spec#Go_statements"
        },
        {
          "title": "Effective Go: Goroutines",
          "url": "https://go.dev/doc/effective_go#goroutines"
        }
      ]
    },
    {
      "id": "unbuffered-channels",
      "title": "Unbuffered channels",
      "explanation": "A channel is a typed pipe that lets one goroutine send values to another. The type says what can travel through it: chan string carries strings, chan int carries integers. You create one with make, as you did for slices and maps: ch := make(chan string).\n\nTwo operators use it. The send statement ch <- v puts the value v into the channel. The receive expression <-ch takes a value out, and you can use it like any value, for example v := <-ch or fmt.Println(<-ch).\n\nA channel made with make(chan T) and no size is unbuffered: it has no storage at all. A send waits (blocks) until another goroutine is ready to receive, and a receive waits until another goroutine sends. The two meet at the same moment and the value is handed over directly. This is a synchronous handoff, and it is also why channels can be used for waiting, as you saw in the previous sub-topic.\n\nIn function parameters you can restrict what a function may do with a channel. chan<- int is send-only and <-chan int is receive-only (directional channel types). The compiler then rejects a misuse, such as receiving from a send-only channel. A normal chan int converts to either automatically when you pass it in.",
      "analogy": "A relay race. The runner holding the baton (the sender) cannot let go until the next runner's hand is actually on it (the receiver). Neither can finish their part alone: the handoff happens at one shared moment. Directional types are like giving one runner the 'only hand over' role and the other the 'only take' role.",
      "code": [
        {
          "language": "go",
          "filename": "ping.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tch := make(chan string)\n\n\tgo func() {\n\t\tch <- \"ping\"\n\t}()\n\n\tfmt.Println(<-ch)\n}\n",
          "output": "ping",
          "explanation": "main blocks on <-ch until the goroutine sends \"ping\". The value is handed over and printed. The send runs in a goroutine because an unbuffered send from main itself, with nobody receiving, would never complete."
        },
        {
          "language": "go",
          "filename": "square.go",
          "source": "package main\n\nimport \"fmt\"\n\n// square sends n*n into out. out is send-only here.\nfunc square(n int, out chan<- int) {\n\tout <- n * n\n}\n\nfunc main() {\n\tresults := make(chan int)\n\n\tgo square(4, results)\n\n\tfmt.Println(<-results)\n}\n",
          "output": "16",
          "explanation": "go square(4, results) starts the existing function as a goroutine; arguments are evaluated immediately. The parameter type chan<- int promises the function only sends. Main receives the result, which is how a worker hands its answer back to the caller."
        }
      ],
      "productionNote": "Channels are the usual way for a worker goroutine to return a result (or an error) to whoever started it. Prefer directional types in function signatures: they document intent and let the compiler catch mistakes. Choose the simplest tool: if goroutines only share data, a mutex (topic 16) can be clearer than channels.",
      "commonMistakes": [
        "Sending on an unbuffered channel in main with no other goroutine receiving. Nothing can ever complete the handoff, so Go stops the program with fatal error: all goroutines are asleep - deadlock! (a deadlock means every goroutine is blocked waiting on another).",
        "Receiving from a channel nobody will ever send to, which blocks forever and causes the same deadlock or a goroutine leak.",
        "Trying to send a value of the wrong type. A chan string only accepts strings, and the compiler reports a type mismatch."
      ],
      "sources": [
        {
          "title": "Go Specification: Channel types",
          "url": "https://go.dev/ref/spec#Channel_types"
        },
        {
          "title": "Go Specification: Send statements",
          "url": "https://go.dev/ref/spec#Send_statements"
        },
        {
          "title": "Effective Go: Channels",
          "url": "https://go.dev/doc/effective_go#channels"
        }
      ]
    },
    {
      "id": "buffered-channels-close",
      "title": "Buffered channels and close",
      "explanation": "A buffered channel has a small queue (the buffer) inside it. make(chan int, 2) creates a channel that can hold up to 2 values with no receiver present. A send only blocks when the buffer is full, and a receive only blocks when it is empty. The built-in len(ch) gives how many values are waiting and cap(ch) gives the buffer size.\n\nThe sender can announce that no more values will ever come with close(ch). After closing, values already in the buffer can still be received. Once the channel is closed and empty, a receive returns immediately with the zero value of the type (0 for int). To tell a real zero from 'closed', use the two-value form v, ok := <-ch: ok is true for a real value and false when the channel is closed and drained (the same comma-ok idea as with maps).\n\nThe rule is: only the sender closes a channel, never the receiver. Closing is optional; you only need it when receivers must learn that the stream ended. Breaking the rules causes a panic (a runtime crash): sending on a closed channel panics with send on closed channel, and closing an already closed channel panics with close of closed channel.",
      "analogy": "A mailbox with 2 slots. The postman can drop 2 letters even if you are not home, but the third has to wait until you empty it. Closing the channel is putting up a 'no more mail, ever' sign: you can still collect the letters already inside, and after that you only find an empty box. Only the postman puts up the sign, never the person collecting. Posting a letter after the sign is up is an error.",
      "code": [
        {
          "language": "go",
          "filename": "buf.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tch := make(chan int, 2)\n\tch <- 1\n\tch <- 2\n\tfmt.Println(len(ch), cap(ch))\n\n\tclose(ch)\n\tfmt.Println(<-ch, <-ch)\n\n\tv, ok := <-ch\n\tfmt.Println(v, ok)\n}\n",
          "output": "2 2\n1 2\n0 false",
          "explanation": "Both sends succeed at once because the buffer has room, so no goroutine is needed. len is 2 and cap is 2. After close, the two buffered values still come out in order (1 then 2). The third receive finds the channel closed and empty, so it returns the zero value 0 and ok is false."
        },
        {
          "language": "go",
          "filename": "semaphore.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\t// A buffered channel as a limit: at most 2 tokens at once.\n\tslots := make(chan struct{}, 2)\n\n\tslots <- struct{}{} // take a slot\n\tslots <- struct{}{} // take another slot\n\tfmt.Println(\"slots in use:\", len(slots))\n\n\t<-slots // give one slot back\n\tfmt.Println(\"slots in use:\", len(slots))\n}\n",
          "output": "slots in use: 2\nslots in use: 1",
          "explanation": "struct{} is the empty struct (from topic 7), which holds no data, so it is a free token. The buffer size is the limit. Taking a slot is a send; giving it back is a receive. A third send without giving one back would block. This is the semaphore pattern: a counter that limits how much work runs at once."
        }
      ],
      "productionNote": "Buffered channels act as job queues between a producer and workers. The make(chan struct{}, N) pattern limits in-flight work, for example at most 10 simultaneous downloads. Do not use a big buffer just to make a blocking bug go away; it only hides it until the buffer fills.",
      "commonMistakes": [
        "Closing a channel from the receiving side. The sender may still send and will then panic. The sender closes.",
        "Closing the same channel twice, which panics with close of closed channel.",
        "Sending after close, which panics with send on closed channel.",
        "Treating a received 0 as a real value when the channel may be closed. Use v, ok := <-ch when it matters."
      ],
      "sources": [
        {
          "title": "Go Specification: Close",
          "url": "https://go.dev/ref/spec#Close"
        },
        {
          "title": "Go Specification: Receive operator",
          "url": "https://go.dev/ref/spec#Receive_operator"
        }
      ]
    },
    {
      "id": "range-over-channels",
      "title": "range over channels",
      "explanation": "Receiving a known number of values is easy, but often the receiver does not know how many will come. Use for v := range ch. It receives values one by one and runs the loop body for each, and the loop ends when the channel is closed and all its values have been received.\n\nThis means the producer (the goroutine sending) must close the channel when it has nothing more to send. If it never closes, the range loop waits forever for another value, and if no other goroutine can still send, Go reports a deadlock.\n\nChaining this idea gives a pipeline: one goroutine produces values, the next stage transforms them, and the final stage consumes them. Each stage receives from an input channel with range, sends to an output channel, and closes its output when its input is finished. The second example shows a generator stage and a squaring stage. Return types such as <-chan int mean 'you can only receive from what I give you'.",
      "analogy": "Collecting letters from your mailbox until you see the 'no more mail' sign. You keep opening it as long as letters arrive, and you stop only when the postman has put up the sign. If he never puts it up, you stand at the mailbox forever.",
      "code": [
        {
          "language": "go",
          "filename": "rangech.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tch := make(chan int)\n\n\tgo func() {\n\t\tfor i := 1; i <= 3; i++ {\n\t\t\tch <- i\n\t\t}\n\t\tclose(ch)\n\t}()\n\n\tfor v := range ch {\n\t\tfmt.Println(v)\n\t}\n}\n",
          "output": "1\n2\n3",
          "explanation": "The goroutine sends 1, 2, 3 (each send waits for main to receive), then closes the channel. Main's range loop prints each value and exits when it sees the channel closed. Remove close(ch) and the program deadlocks after printing 3."
        },
        {
          "language": "go",
          "filename": "pipeline.go",
          "source": "package main\n\nimport \"fmt\"\n\n// gen sends each number, then closes its output.\nfunc gen(nums ...int) <-chan int {\n\tout := make(chan int)\n\tgo func() {\n\t\tfor _, n := range nums {\n\t\t\tout <- n\n\t\t}\n\t\tclose(out)\n\t}()\n\treturn out\n}\n\n// square reads from in, sends squares, then closes its output.\nfunc square(in <-chan int) <-chan int {\n\tout := make(chan int)\n\tgo func() {\n\t\tfor n := range in {\n\t\t\tout <- n * n\n\t\t}\n\t\tclose(out)\n\t}()\n\treturn out\n}\n\nfunc main() {\n\tfor v := range square(gen(1, 2, 3)) {\n\t\tfmt.Println(v)\n\t}\n}\n",
          "output": "1\n4\n9",
          "explanation": "gen creates the channel, starts a goroutine to fill it, and returns the channel immediately. square does the same with gen's output as input. Closing at each stage passes the 'finished' signal down the chain, so main's loop ends cleanly. The order is fixed because each stage handles one value at a time in sequence."
        }
      ],
      "productionNote": "Pipelines (generator, stage, sink) suit streaming data such as reading lines, transforming them and writing results, without holding everything in memory. In larger programs add cancellation with context (topic 17) so stages can stop early instead of leaking when the consumer gives up.",
      "commonMistakes": [
        "Forgetting close in the producer. The range loop never ends and the program deadlocks or the goroutine leaks.",
        "Closing the channel from the consumer side of the loop, which risks a send-on-closed panic in the producer.",
        "Breaking out of the loop early without telling the producer, which leaves the producer blocked on a send forever."
      ],
      "sources": [
        {
          "title": "Go Specification: For statements with range clause",
          "url": "https://go.dev/ref/spec#For_range"
        },
        {
          "title": "Go Blog: Go Concurrency Patterns: Pipelines and cancellation",
          "url": "https://go.dev/blog/pipelines"
        }
      ]
    },
    {
      "id": "select",
      "title": "select",
      "explanation": "select waits on several channel operations at once and runs the case whose operation is ready. Its syntax looks like a switch: each case is a send or a receive, such as case v := <-a: or case b <- x:. If several cases are ready at the same moment, Go picks one at random, so never rely on an order.\n\nA default case runs immediately if no other case is ready. That makes select non-blocking: you try the operation, and if it cannot happen right now you do something else instead of waiting.\n\nA timeout is built with time.After(d) (from topic 13), which returns a channel that receives one value after the duration d has passed. Adding case <-time.After(...) means: wait for the real event, but give up after d.",
      "analogy": "A waiter watching several tables. Whichever table raises a hand first gets served. If two raise hands together, the waiter picks one. A default case is the waiter glancing around and, if nobody is waving, going to polish glasses instead of standing there. A timeout is closing time: if no table has called by then, the waiter goes home.",
      "code": [
        {
          "language": "go",
          "filename": "sel.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"time\"\n)\n\nfunc main() {\n\tch := make(chan string) // nothing ever sends on it\n\n\tselect {\n\tcase m := <-ch:\n\t\tfmt.Println(m)\n\tcase <-time.After(100 * time.Millisecond):\n\t\tfmt.Println(\"timeout\")\n\t}\n}\n",
          "output": "timeout",
          "explanation": "The first case can never be ready, because nobody sends on ch. After 100 milliseconds the channel from time.After delivers a value, so the second case runs and prints timeout. Without that case the program would deadlock."
        },
        {
          "language": "go",
          "filename": "nonblocking.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tch := make(chan int, 1)\n\n\tselect {\n\tcase v := <-ch:\n\t\tfmt.Println(\"got\", v)\n\tdefault:\n\t\tfmt.Println(\"no value\")\n\t}\n\n\tch <- 7\n\n\tselect {\n\tcase v := <-ch:\n\t\tfmt.Println(\"got\", v)\n\tdefault:\n\t\tfmt.Println(\"no value\")\n\t}\n}\n",
          "output": "no value\ngot 7",
          "explanation": "The first select finds the buffer empty, so no receive is ready and default runs without waiting. After ch <- 7 the buffer holds a value, so the receive case is ready and wins over default."
        }
      ],
      "productionNote": "select is how Go code handles timeouts, cancellation and multiplexing (listening to several event sources). In real services the common form is case <-ctx.Done(), which fires when a request is cancelled (topic 17). For a timeout, prefer context.WithTimeout at API boundaries and use time.After for simple local waits.",
      "commonMistakes": [
        "Putting select with a default case inside a for loop with nothing else to wait for. It spins and burns 100% of a CPU core. Remove default so the select blocks, or wait on a channel.",
        "Calling time.After inside a hot loop. Each iteration creates a new timer. Create one timer outside the loop (time.NewTimer, topic 13) and reuse it.",
        "Assuming cases are checked top to bottom. When several are ready, Go chooses randomly."
      ],
      "sources": [
        {
          "title": "Go Specification: Select statements",
          "url": "https://go.dev/ref/spec#Select_statements"
        },
        {
          "title": "time package: After",
          "url": "https://pkg.go.dev/time#After"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "What happens to goroutines that are still running when main returns?",
      "options": [
        "They are stopped immediately when the program exits",
        "The program waits for all of them to finish first",
        "They keep running in the background after the program ends",
        "They are paused and resume the next time the program runs"
      ],
      "answerIndex": 0,
      "explanation": "Returning from main ends the whole program and every other goroutine with it. Waiting must be arranged explicitly with a channel or sync.WaitGroup."
    },
    {
      "question": "When does a send on an unbuffered channel (ch <- v) complete?",
      "options": [
        "Immediately, the value is stored in a queue",
        "Only when another goroutine receives the value",
        "After one second, so receivers have time to prepare",
        "When the channel is closed"
      ],
      "answerIndex": 1,
      "explanation": "An unbuffered channel has no storage, so the send waits until a receiver takes the value. That is the synchronous handoff."
    },
    {
      "question": "What does a receive return from a channel that is closed and empty?",
      "options": [
        "It panics",
        "It blocks forever",
        "The zero value of the element type, immediately (and ok is false with v, ok := <-ch)",
        "The last value that was sent"
      ],
      "answerIndex": 2,
      "explanation": "Receiving from a closed, drained channel never blocks and never panics. It yields the zero value, and the second result ok is false so you can detect the close."
    },
    {
      "question": "A for v := range ch loop never ends and the program deadlocks. What is the most likely cause?",
      "options": [
        "The receiver closed the channel too early",
        "The channel's element type is int instead of string",
        "The channel is buffered",
        "The producer never called close(ch)"
      ],
      "answerIndex": 3,
      "explanation": "range stops only when the channel is closed and drained. If the producer forgets to close, the loop waits forever for another value."
    },
    {
      "question": "How do you give up on a receive from ch after 2 seconds?",
      "options": [
        "Call time.Sleep(2 * time.Second) before the receive",
        "Use select with case v := <-ch and case <-time.After(2 * time.Second)",
        "Close ch from the receiver after 2 seconds",
        "Make ch buffered with size 2"
      ],
      "answerIndex": 1,
      "explanation": "select waits on both the real channel and the timer channel from time.After and runs whichever is ready first, so the timer case acts as the timeout."
    }
  ]
});
