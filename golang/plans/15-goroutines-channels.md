# 15. Goroutines & Channels
Version: Go 1.27.4
Prerequisites: 14-generics

## Learning goals
- learner can start goroutines and explain that main does not wait for them
- learner can pass values between goroutines with unbuffered channels
- learner can use buffered channels and close them correctly
- learner can range over a channel until it's closed
- learner can wait on several channels with select and timeouts

## Sub-topics
### Goroutines
- Concept: concurrency (gloss: many tasks in progress at once); `go f()` runs f in a goroutine (lightweight thread managed by Go, thousands are cheap); when main returns, the program exits and all goroutines stop; need a way to wait (channels here, WaitGroup topic 16).
- Analogy: kitchen helpers — the chef (main) hands out jobs; when the restaurant closes (main returns), everyone goes home mid-task.
- Code example: hello_go.go — `done := make(chan bool); go func() { fmt.Println("from goroutine"); done <- true }(); <-done; fmt.Println("main done")` → `from goroutine`,`main done`
- Production use: each HTTP request runs in its own goroutine (topic 21); background jobs.
- Common mistakes: `time.Sleep` to "wait" (flaky); main exiting before goroutines finish; goroutine leaks (blocked forever).
- Sources: https://go.dev/ref/spec#Go_statements ; https://go.dev/doc/effective_go#goroutines

### Unbuffered channels
- Concept: `ch := make(chan string)`; send `ch <- v`, receive `v := <-ch`; unbuffered send waits until a receiver takes it (synchronous handoff); typed; directional types `chan<-`/`<-chan` in function params.
- Analogy: relay-race baton — the runner can't let go until the next runner's hand is on it.
- Code example: ping.go — `ch := make(chan string); go func() { ch <- "ping" }(); fmt.Println(<-ch)` → `ping`
- Production use: handing results from workers back to the caller.
- Common mistakes: sending with no receiver in main → `fatal error: all goroutines are asleep - deadlock!`.
- Sources: https://go.dev/ref/spec#Channel_types ; https://go.dev/ref/spec#Send_statements ; https://go.dev/doc/effective_go#channels

### Buffered channels and close
- Concept: `make(chan int, 2)` holds up to 2 without a receiver; send blocks only when full; `close(ch)` = no more values; receive from closed+empty gives zero value, `v, ok := <-ch` → ok false; only the sender closes; send on closed → panic.
- Analogy: mailbox with 2 slots — the postman can drop 2 letters without you home; "closed" sign means no more mail ever.
- Code example: buf.go — `ch := make(chan int, 2); ch <- 1; ch <- 2; fmt.Println(len(ch), cap(ch)); close(ch); fmt.Println(<-ch, <-ch); v, ok := <-ch; fmt.Println(v, ok)` → `2 2`,`1 2`,`0 false`
- Production use: job queues, limiting in-flight work (semaphore pattern `make(chan struct{}, 10)`).
- Common mistakes: receiver closing the channel; closing twice → `panic: close of closed channel`; send after close → `panic: send on closed channel`.
- Sources: https://go.dev/ref/spec#Close ; https://go.dev/ref/spec#Receive_operator

### range over channels
- Concept: `for v := range ch` receives until ch is closed and drained; producer closes when done.
- Analogy: reading letters from the mailbox until you find the "no more mail" sign.
- Code example: rangech.go — `ch := make(chan int); go func() { for i := 1; i <= 3; i++ { ch <- i }; close(ch) }(); for v := range ch { fmt.Println(v) }` → `1`,`2`,`3`
- Production use: pipelines (generator → stage → sink), streaming results.
- Common mistakes: forgetting close → range never ends → deadlock.
- Sources: https://go.dev/ref/spec#For_range ; https://go.dev/blog/pipelines

### select
- Concept: `select { case v := <-a: … case b <- x: … case <-time.After(d): … default: … }` waits on several channel ops, runs one that's ready (random if several); `default` makes it non-blocking; timeout pattern.
- Analogy: waiter watching several tables, serving whichever raises a hand first; if nobody does by closing time, goes home (timeout).
- Code example: sel.go — `ch := make(chan string)` (nothing ever sends); `select { case m := <-ch: fmt.Println(m); case <-time.After(100 * time.Millisecond): fmt.Println("timeout") }` → `timeout`
- Production use: timeouts, cancellation with ctx.Done() (topic 17), multiplexing events.
- Common mistakes: busy loop with `default` burning CPU; `time.After` in a hot loop (allocates a timer each iteration).
- Sources: https://go.dev/ref/spec#Select_statements ; https://pkg.go.dev/time#After

## Quiz
1. What happens to goroutines when main returns? — tests program exit
2. When does an unbuffered send complete? — tests handoff
3. Receiving from a closed empty channel gives? — tests close
4. Why must the producer close before range ends? — tests range
5. How to add a timeout to a receive? — tests select
