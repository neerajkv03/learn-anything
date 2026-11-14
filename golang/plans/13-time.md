# 13. Time & Dates
Version: Go 1.27.4
Prerequisites: 12-packages-modules

## Learning goals
- learner can create and inspect time.Time values
- learner can do math with time.Duration
- learner can format and parse dates using the reference layout
- learner can convert between time zones and store UTC
- learner can use timers and tickers

## Sub-topics
### time.Time and time.Now
- Concept: `time.Now()` current instant; `time.Date(y, month, d, h, m, s, ns, loc)` builds one; methods Year, Month, Weekday, Before/After/Equal; compare with `Equal` not `==` (location + monotonic clock reading — gloss).
- Analogy: postmark stamped on a letter — an exact moment, readable in any city's clock.
- Code example: when.go — `t := time.Date(2026, time.March, 14, 9, 30, 0, 0, time.UTC); fmt.Println(t.Year(), t.Month(), t.Weekday())` → `2026 March Saturday`
- Production use: created_at timestamps, expiry checks.
- Common mistakes: `==` on times from different zones; zero time `time.Time{}` = year 1 (check with `IsZero`).
- Sources: https://pkg.go.dev/time#Time ; https://pkg.go.dev/time#Date

### Durations
- Concept: `time.Duration` = nanoseconds count; constants `time.Second`, `time.Minute`; `t.Add(d)`, `t2.Sub(t)`, `time.Since(start)`; prints as `1h30m0s`.
- Analogy: stopwatch reading (how long) vs wall clock (what moment).
- Code example: dur.go — `d := 90 * time.Minute; fmt.Println(d)` → `1h30m0s`; with t from above `t2 := t.Add(2 * time.Hour); fmt.Println(t2.Format("15:04"), t2.Sub(t))` → `11:30 2h0m0s`
- Production use: timeouts (topics 17, 21, 22), measuring latency `time.Since(start)`.
- Common mistakes: `time.Sleep(5)` = 5 nanoseconds; multiplying Duration by an int variable needs conversion `time.Duration(n) * time.Second`.
- Sources: https://pkg.go.dev/time#Duration ; https://pkg.go.dev/time#Time.Sub

### Formatting and parsing with the reference layout
- Concept: layouts are written using the reference moment `Mon Jan 2 15:04:05 MST 2006` (1 2 3 4 5 6 7 order: 01/02 03:04:05PM '06 -0700); `t.Format("2006-01-02 15:04")`; constants `time.RFC3339`, `time.DateOnly`; `time.Parse(layout, s)` returns (Time, error), UTC if no zone.
- Analogy: a fill-in example date — you show Go how "Jan 2 2006 3:04pm" should look, and it copies that shape.
- Code example: fmtt.go — with t: `t.Format("2006-01-02 15:04")` → `2026-03-14 09:30`; `t.Format(time.RFC3339)` → `2026-03-14T09:30:00Z`; `p, err := time.Parse(time.DateOnly, "2026-12-25"); fmt.Println(p, err)` → `2026-12-25 00:00:00 +0000 UTC <nil>`
- Production use: API timestamps in RFC 3339; parsing user dates.
- Common mistakes: `YYYY-MM-DD` layouts (printed literally); `15` vs `03` (24h vs 12h); ignoring Parse errors.
- Sources: https://pkg.go.dev/time#pkg-constants ; https://pkg.go.dev/time#Time.Format ; https://pkg.go.dev/time#Parse

### Time zones
- Concept: `time.LoadLocation("Asia/Kolkata")` (IANA names) returns (*Location, error); `t.In(loc)` same instant, different clock; store/compare in UTC, convert only for display; on machines without a tz database (often Windows, minimal containers) add `import _ "time/tzdata"`.
- Analogy: one moment shown on wall clocks in different cities — the moment doesn't change, only the clock face.
- Code example: tz.go — `loc, err := time.LoadLocation("Asia/Kolkata")`; `fmt.Println(t.In(loc).Format("15:04 MST"))` → `15:00 IST`
- Production use: store UTC in DB; show local time per user.
- Common mistakes: `time.Local` on servers (depends on machine setting); fixed offsets instead of zone names (DST).
- Sources: https://pkg.go.dev/time#LoadLocation ; https://pkg.go.dev/time/tzdata

### Timers and tickers
- Concept: `time.NewTimer(d)` fires once, `time.NewTicker(d)` repeatedly; values arrive on channel `.C` (gloss: channel = pipe where values arrive; `<-ticker.C` waits for the next one; topic 15); `defer ticker.Stop()`; `time.After(d)`; since Go 1.23 timer channels are unbuffered and Go 1.27 removed the `asynctimerchan` GODEBUG (per https://go.dev/doc/go1.27).
- Analogy: kitchen timer rings once; metronome clicks repeatedly until you switch it off.
- Code example: tick.go — `ticker := time.NewTicker(100 * time.Millisecond); defer ticker.Stop(); for i := range 3 { <-ticker.C; fmt.Println("tick", i+1) }; fmt.Println("done")` → `tick 1`,`tick 2`,`tick 3`,`done`
- Production use: periodic cache refresh, metrics flush, heartbeats.
- Common mistakes: forgetting Stop; `time.Tick` in long-lived code that should stop.
- Sources: https://pkg.go.dev/time#Ticker ; https://pkg.go.dev/time#Timer ; https://go.dev/doc/go1.27

## Quiz
1. Weekday of the example date — tests Time methods
2. What does time.Sleep(5) sleep? — tests Duration units
3. Layout for "2026-03-14" — tests reference layout
4. Why store UTC? — tests time zones
5. Timer vs ticker — tests timers
