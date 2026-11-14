window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "13-time",
  "order": 13,
  "title": "Time & Dates",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Learn how Go represents a moment in time (time.Time) and a length of time (time.Duration). You will convert between time zones while storing UTC (the standard world reference time, with no daylight-saving shifts) and format dates with Go's reference layout (a sample date written in the shape you want), and use timers and tickers to run things later or repeatedly.",
  "prerequisites": [
    "12-packages-modules"
  ],
  "subtopics": [
    {
      "id": "time-time-and-now",
      "title": "time.Time and time.Now",
      "explanation": "Go's standard library package `time` (a package is a folder of related code you bring in with `import \"time\"`) gives you the type `time.Time`. A `time.Time` value is one exact instant: a date, a clock time down to the nanosecond (one billionth of a second), and a time zone attached for display.\n\n`time.Now()` returns the current instant. To build a specific instant yourself, call `time.Date(year, month, day, hour, minute, second, nanosecond, location)`. The month is a constant such as `time.March` (a named integer type, like the `Weekday` type you met in the variables topic), and the location is a time zone such as `time.UTC` (UTC is the world reference time, with no daylight-saving shifts).\n\nA `time.Time` has methods (functions attached to a value) to read its parts: `t.Year()`, `t.Month()` and `t.Weekday()`. Printing a month or weekday gives its English name, for example `March` or `Saturday`.\n\nTo compare two instants use `t.Before(u)`, `t.After(u)` and `t.Equal(u)`. Each returns a `bool`. Prefer `Equal` over `==`. A `time.Time` also stores which location it is displayed in, and values from `time.Now()` carry a hidden monotonic clock reading (a steadily increasing counter used to measure elapsed time reliably, even if the system clock is adjusted). `==` compares all of those hidden parts, so two values for the very same instant can be `!=`. `Equal` compares only the instant.\n\nThe zero value of `time.Time` (what `var zero time.Time` gives you) is January 1 of year 1, not 'no time'. Use `t.IsZero()` to check whether a value was never set.\n\nThe example below uses `time.FixedZone(name, offsetInSeconds)`, which builds a location with a constant offset from UTC. Here 15:00 in a zone 5 hours 30 minutes ahead of UTC is the same instant as 09:30 UTC.",
      "analogy": "A postmark stamped on a letter records one exact moment. People in different cities read that same moment off their own local clocks, but the moment itself never changes. Comparing two postmarks with `Equal` asks 'same moment?', while `==` would ask 'same moment, written on the same city's clock, with the same hidden stamp details?'.",
      "code": [
        {
          "language": "go",
          "filename": "when.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"time\"\n)\n\nfunc main() {\n\tt := time.Date(2026, time.March, 14, 9, 30, 0, 0, time.UTC)\n\tfmt.Println(t.Year(), t.Month(), t.Weekday())\n\n\tnext := time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC)\n\tfmt.Println(t.Before(next), t.After(next))\n\n\t// Same instant, written on a clock 5h30m ahead of UTC.\n\tist := time.FixedZone(\"IST\", 5*60*60+30*60)\n\tsame := time.Date(2026, time.March, 14, 15, 0, 0, 0, ist)\n\tfmt.Println(t == same, t.Equal(same))\n\n\tvar zero time.Time\n\tfmt.Println(zero.IsZero(), zero.Year())\n\n\tfmt.Println(time.Now().After(t))\n}\n",
          "output": "2026 March Saturday\ntrue false\nfalse true\ntrue 1\ntrue\n",
          "explanation": "To try it, save the code as when.go in an empty folder, open a terminal in that folder, run `go mod init example.com/when` once, then `go run .`. Line 1 prints the parts of the date. Line 2 shows March 14 is before March 15 and not after it. Line 3 shows the key point: `t` and `same` are the same instant, yet `==` says false because their locations differ, while `Equal` says true. Line 4 shows the zero value is year 1 and `IsZero` detects it. The last line calls `time.Now()`, whose value changes every run, so the program prints only a comparison whose answer is stable."
        }
      ],
      "productionNote": "Use `time.Now()` for created_at timestamps and compare against a stored expiry with `time.Now().After(expiresAt)`. Always compare instants with `Before`, `After` or `Equal`, never with `==`, and check optional timestamps (such as a database column that may be missing) with `IsZero`.",
      "commonMistakes": [
        "Comparing times with `==`. It also compares the location and the hidden monotonic clock reading, so the same instant can compare as not equal. Use `t.Equal(u)`.",
        "Forgetting that the zero `time.Time{}` is year 1, not 'nothing'. Printing it or doing math on it gives surprising results. Check with `IsZero()`.",
        "Passing a plain number for the month, such as `time.Date(2026, 3, ...)`. It compiles because untyped constants convert, but using the named constants like `time.March` is clearer and avoids mixing up month and day."
      ],
      "sources": [
        {
          "title": "time.Time (Go standard library)",
          "url": "https://pkg.go.dev/time#Time"
        },
        {
          "title": "time.Date (Go standard library)",
          "url": "https://pkg.go.dev/time#Date"
        }
      ]
    },
    {
      "id": "durations",
      "title": "Durations",
      "explanation": "A `time.Duration` is a length of time, stored as a count of nanoseconds in an `int64` (a 64-bit whole number). The package gives you named constants to build one: `time.Nanosecond`, `time.Microsecond`, `time.Millisecond`, `time.Second`, `time.Minute` and `time.Hour`. Multiply a constant by a number: `90 * time.Minute`.\n\nPrinting a duration gives a readable form such as `1h30m0s`. Methods like `d.Seconds()`, `d.Minutes()` and `d.Hours()` return the length as a `float64`.\n\nTo move a moment, use `t.Add(d)`, which returns a new `time.Time` (the original is not changed). To find the gap between two moments, use `later.Sub(earlier)`, which returns a `Duration`. `time.Since(start)` is shorthand for `time.Now().Sub(start)` and is the standard way to measure how long something took.\n\nIn the example, `t2.Format(\"15:04\")` turns a time into text showing hours and minutes. The next sub-topic explains how `Format` works.\n\nDurations are typed, so Go will not let you multiply a `Duration` by an ordinary `int` variable. Convert first: `time.Duration(n) * time.Second`. A bare number is also accepted where a `Duration` is expected, which is a trap: `time.Duration(5)` is 5 nanoseconds, not 5 seconds.",
      "analogy": "A duration is a stopwatch reading: it says how long something lasted, but not when. A time.Time is the wall clock: it says what moment it is. `Sub` reads two wall clocks and gives you the stopwatch reading between them. `Add` starts from a wall-clock moment and winds forward by a stopwatch reading.",
      "code": [
        {
          "language": "go",
          "filename": "dur.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"time\"\n)\n\nfunc main() {\n\td := 90 * time.Minute\n\tfmt.Println(d)\n\tfmt.Println(d.Minutes(), d.Hours())\n\n\tt := time.Date(2026, time.March, 14, 9, 30, 0, 0, time.UTC)\n\tt2 := t.Add(2 * time.Hour)\n\tfmt.Println(t2.Format(\"15:04\"), t2.Sub(t))\n\n\tn := 3\n\twait := time.Duration(n) * time.Second\n\tfmt.Println(wait)\n\n\t// A bare number means nanoseconds.\n\tfmt.Println(time.Duration(5))\n\n\tstart := time.Now()\n\telapsed := time.Since(start)\n\tfmt.Println(elapsed < time.Second)\n}\n",
          "output": "1h30m0s\n90 1.5\n11:30 2h0m0s\n3s\n5ns\ntrue\n",
          "explanation": "`90 * time.Minute` prints as `1h30m0s`, and the float methods give 90 minutes and 1.5 hours. Adding 2 hours to 09:30 gives 11:30, and subtracting the original from it gives back `2h0m0s`. `n` is an ordinary `int`, so it must be converted with `time.Duration(n)` before being multiplied by `time.Second`. `time.Duration(5)` prints `5ns`, showing why a bare number is a nanosecond count. Measuring a nearly instant piece of work with `time.Since` gives well under one second, so the last line prints true."
        }
      ],
      "productionNote": "Durations are how Go code expresses timeouts and intervals (you will use them in the context and HTTP topics), and `time.Since(start)` is the usual way to log request latency. Always write units explicitly, for example `5 * time.Second`, and never pass a bare number.",
      "commonMistakes": [
        "Writing `time.Sleep(5)` and expecting five seconds. It sleeps 5 nanoseconds. Write `time.Sleep(5 * time.Second)`.",
        "Multiplying a `Duration` by an `int` variable, as in `n * time.Second`. This fails to compile with a 'mismatched types' error (the two operands have different types). Convert: `time.Duration(n) * time.Second`.",
        "Expecting `t.Add(d)` to change `t`. It returns a new `time.Time`; you must store the result."
      ],
      "sources": [
        {
          "title": "time.Duration (Go standard library)",
          "url": "https://pkg.go.dev/time#Duration"
        },
        {
          "title": "time.Time.Sub (Go standard library)",
          "url": "https://pkg.go.dev/time#Time.Sub"
        }
      ]
    },
    {
      "id": "formatting-and-parsing",
      "title": "Formatting and parsing with the reference layout",
      "explanation": "Formatting turns a `time.Time` into text. Parsing turns text back into a `time.Time`. Most languages use codes like `YYYY-MM-DD`. Go instead uses a layout: you write the specific reference moment `Mon Jan 2 15:04:05 MST 2006` in the shape you want, and Go copies that shape.\n\nThe reference moment is chosen so its numbers 1 to 7 stand for month, day, hour, minute, second, year and zone, and each code you write uses one of these numbers: `01/02 03:04:05PM '06 -0700`. So `01` is the month, `02` the day, `03` the 12-hour hour, `04` the minute, `05` the second, `06` or `2006` the year, and `-0700` the zone offset.\n\nSome common pieces: `2006` is a four-digit year, `01` is a two-digit month, `Jan` is a short month name, `02` is a two-digit day, `15` is the hour on a 24-hour clock, `03` or `3` is the hour on a 12-hour clock, and `PM` prints AM or PM. Any other characters, such as `-`, `:` or spaces, are copied as they are.\n\n`t.Format(layout)` returns a string. The package also provides ready-made layouts as constants, such as `time.RFC3339` (the internet timestamp standard, like `2026-03-14T09:30:00Z`, used by most web APIs) and `time.DateOnly` (`2006-01-02`).\n\n`time.Parse(layout, text)` returns two values: a `time.Time` and an `error` (the second value is `nil` when all went well). If the text has no zone information, the result is in UTC. Always check the error.",
      "analogy": "The layout is a fill-in example. Instead of describing a date format with abstract codes, you show Go one sample date, 'Jan 2 2006 3:04pm', written the way you want it, and Go copies that shape for any date. Parsing works in reverse: Go reads your text using the sample as a template.",
      "code": [
        {
          "language": "go",
          "filename": "fmtt.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"time\"\n)\n\nfunc main() {\n\tt := time.Date(2026, time.March, 14, 9, 30, 0, 0, time.UTC)\n\n\tfmt.Println(t.Format(\"2006-01-02 15:04\"))\n\tfmt.Println(t.Format(time.RFC3339))\n\tfmt.Println(t.Format(\"Jan 2, 2006 at 3:04PM\"))\n\n\tp, err := time.Parse(time.DateOnly, \"2026-12-25\")\n\tfmt.Println(p, err)\n\n\t_, err = time.Parse(time.DateOnly, \"25/12/2026\")\n\tfmt.Println(err != nil)\n}\n",
          "output": "2026-03-14 09:30\n2026-03-14T09:30:00Z\nMar 14, 2026 at 9:30AM\n2026-12-25 00:00:00 +0000 UTC <nil>\ntrue\n",
          "explanation": "The first layout prints year-month-day and 24-hour time. `time.RFC3339` prints the internet timestamp form, where `Z` means UTC. The third layout shows a short month name, a day without a leading zero (`2`), and a 12-hour clock with AM/PM. Parsing `2026-12-25` with `time.DateOnly` gives midnight UTC on that day and a `nil` error, so `fmt.Println(p, err)` prints the time and `<nil>`. Parsing text that does not match the layout returns a non-nil error, so `err != nil` is true."
        }
      ],
      "productionNote": "Use `time.RFC3339` for timestamps in APIs and logs, since every language can read it. When you parse user-supplied dates, always handle the returned error and show the user a clear message about the expected format.",
      "commonMistakes": [
        "Using codes from other languages, such as `YYYY-MM-DD`. Go does not recognise them and prints them literally. Use `2006-01-02`.",
        "Mixing up `15` and `03`. `15` is the 24-hour hour; `03` is the 12-hour hour and usually needs `PM` too.",
        "Ignoring the error from `time.Parse`. On bad input you get a zero `time.Time` (year 1) that silently flows into your program."
      ],
      "sources": [
        {
          "title": "time package constants (layouts)",
          "url": "https://pkg.go.dev/time#pkg-constants"
        },
        {
          "title": "time.Time.Format",
          "url": "https://pkg.go.dev/time#Time.Format"
        },
        {
          "title": "time.Parse",
          "url": "https://pkg.go.dev/time#Parse"
        }
      ]
    },
    {
      "id": "time-zones",
      "title": "Time zones",
      "explanation": "A time zone is a region's rule for what its clocks show, including daylight-saving changes. Go identifies zones by names from the IANA time zone database (a worldwide shared list), such as `Asia/Kolkata` or `America/New_York`.\n\n`time.LoadLocation(name)` returns a `*time.Location` (a pointer, as in the pointers topic) and an `error`. It fails if the name is unknown or the machine has no time zone database.\n\n`t.In(loc)` returns the same instant displayed on that location's clock. The moment does not change; only the hours and minutes shown do. `t.UTC()` converts to UTC. In a format layout, `MST` prints the zone abbreviation, such as `IST` or `EDT`.\n\nThe rule for programs: store and compare instants in UTC, and convert to a local zone only when you show them to a person.\n\nSome machines, often Windows or minimal container images, have no time zone database, so `LoadLocation` fails. Adding the blank import `import _ \"time/tzdata\"` embeds a copy of the database in your program. A blank import (the `_` name) imports a package only for its side effect of registering itself, here making the data available. It adds roughly 450 KB to the binary, so it is a good choice for programs that must work everywhere.\n\nAvoid `time.Local`. It means 'the machine's own setting', so the same program behaves differently on different servers. Also prefer zone names over fixed offsets like `+05:30`, because a fixed offset cannot know about daylight-saving changes.",
      "analogy": "One moment shown on wall clocks in different cities. A clock in Kolkata, one in New York and one in London all display different numbers, yet they all show the exact same moment. `In` swaps which city's clock face you read; the moment does not move.",
      "code": [
        {
          "language": "go",
          "filename": "tz.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"time\"\n\t_ \"time/tzdata\"\n)\n\nfunc main() {\n\tt := time.Date(2026, time.March, 14, 9, 30, 0, 0, time.UTC)\n\n\tkolkata, err := time.LoadLocation(\"Asia/Kolkata\")\n\tif err != nil {\n\t\tfmt.Println(\"load failed:\", err)\n\t\treturn\n\t}\n\tfmt.Println(t.In(kolkata).Format(\"15:04 MST\"))\n\n\tnewYork, err := time.LoadLocation(\"America/New_York\")\n\tif err != nil {\n\t\tfmt.Println(\"load failed:\", err)\n\t\treturn\n\t}\n\tfmt.Println(t.In(newYork).Format(\"15:04 MST\"))\n\n\tfmt.Println(t.In(kolkata).Equal(t))\n\tfmt.Println(t.In(kolkata).UTC().Format(time.RFC3339))\n}\n",
          "output": "15:00 IST\n05:30 EDT\ntrue\n2026-03-14T09:30:00Z\n",
          "explanation": "The blank import `_ \"time/tzdata\"` makes the program work even on a machine without a zone database. 09:30 UTC shows as 15:00 in Kolkata (5h30m ahead). New York had already switched to daylight-saving time on 8 March 2026, so it is 4 hours behind UTC and shows 05:30 EDT; this is why zone names beat fixed offsets. `Equal` confirms the converted value is still the same instant, and converting back with `UTC()` returns the original time."
        }
      ],
      "productionNote": "Store timestamps in UTC in your database and pass them around as UTC. Convert with `In` at the edge, when rendering for a user whose zone name you saved, and add `import _ \"time/tzdata\"` to programs deployed in minimal containers.",
      "commonMistakes": [
        "Relying on `time.Local`. On a server it depends on the machine's setting, so tests pass on your laptop and behave differently in production.",
        "Using fixed offsets such as `+05:30` for a region that has daylight-saving time. The offset is wrong for half of the year. Use an IANA name like `America/New_York`.",
        "Ignoring the error from `LoadLocation`. On a machine without a zone database it fails and you would continue with a nil location, which can crash your program.",
        "Storing local times in the database. Two rows from different zones can no longer be compared correctly. Store UTC."
      ],
      "sources": [
        {
          "title": "time.LoadLocation",
          "url": "https://pkg.go.dev/time#LoadLocation"
        },
        {
          "title": "time/tzdata package",
          "url": "https://pkg.go.dev/time/tzdata"
        }
      ]
    },
    {
      "id": "timers-and-tickers",
      "title": "Timers and tickers",
      "explanation": "A timer fires once after a delay. A ticker fires again and again at a fixed interval. Create them with `time.NewTimer(d)` and `time.NewTicker(d)`, where `d` is a `time.Duration`.\n\nBoth give you a channel named `C`. A channel is a pipe that carries values from one place in a program to another; you will study channels fully in the goroutines topic. For now you only need one operation: `<-ticker.C` waits (blocks) until the next value arrives, then continues. The value is the time of the tick, which we simply discard here.\n\n`time.After(d)` is a shortcut: it returns a channel that receives one value after `d`. So `<-time.After(50 * time.Millisecond)` pauses for 50 milliseconds.\n\nA ticker keeps running until you stop it, so call `defer ticker.Stop()` right after creating it (`defer` runs a call when the function returns, as in the functions topic). Stopping releases its resources. A timer also has `Stop()` if you want to cancel it before it fires.\n\nCurrent Go never delivers an old tick after you call Stop, so there is nothing extra to do here; just stop tickers you no longer need.",
      "analogy": "A timer is a kitchen timer: you set it, it rings once, done. A ticker is a metronome: it clicks again and again at the same interval until you switch it off, and a metronome left running keeps ticking forever, which is why you must call `Stop`.",
      "code": [
        {
          "language": "go",
          "filename": "tick.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"time\"\n)\n\nfunc main() {\n\tticker := time.NewTicker(100 * time.Millisecond)\n\tdefer ticker.Stop()\n\n\tfor i := range 3 {\n\t\t<-ticker.C\n\t\tfmt.Println(\"tick\", i+1)\n\t}\n\tfmt.Println(\"done\")\n\n\ttimer := time.NewTimer(50 * time.Millisecond)\n\t<-timer.C\n\tfmt.Println(\"timer fired\")\n\n\t<-time.After(50 * time.Millisecond)\n\tfmt.Println(\"after fired\")\n}\n",
          "output": "tick 1\ntick 2\ntick 3\ndone\ntimer fired\nafter fired\n",
          "explanation": "The ticker is created with a 100 millisecond interval and `defer ticker.Stop()` guarantees it is stopped when `main` returns. The loop waits on `<-ticker.C` three times and prints after each tick, then prints `done`. The timer fires once after 50 ms, and `<-timer.C` waits for it. `time.After` gives the same one-shot wait without keeping a timer variable. The text is always the same; only the pauses between lines take real time."
        }
      ],
      "productionNote": "Tickers drive periodic work such as refreshing a cache, flushing metrics or sending heartbeats. In long-running services always pair `NewTicker` with `Stop`, and prefer it over `time.Tick`, which gives you no way to stop the ticker.",
      "commonMistakes": [
        "Forgetting `defer ticker.Stop()`. In long-running code the ticker keeps running and wasting resources after you no longer need it.",
        "Using `time.Tick` in code that should be able to stop. It returns only the channel, so you have no handle to stop the underlying ticker.",
        "Passing a bare number as the interval, for example `time.NewTicker(100)`. That is 100 nanoseconds, not milliseconds. Write `100 * time.Millisecond`.",
        "Passing zero or a negative interval to `NewTicker`. It panics (stops the program with an error)."
      ],
      "sources": [
        {
          "title": "time.Ticker",
          "url": "https://pkg.go.dev/time#Ticker"
        },
        {
          "title": "time.Timer",
          "url": "https://pkg.go.dev/time#Timer"
        },
        {
          "title": "Go 1.27 release notes",
          "url": "https://go.dev/doc/go1.27"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Given `t := time.Date(2026, time.March, 14, 9, 30, 0, 0, time.UTC)`, what does `fmt.Println(t.Year(), t.Month(), t.Weekday())` print?",
      "options": [
        "2026 3 6",
        "2026 March Saturday",
        "2026 March 14",
        "26 Mar Sat"
      ],
      "answerIndex": 1,
      "explanation": "Month and Weekday print their English names, and March 14, 2026 falls on a Saturday. The output is `2026 March Saturday`."
    },
    {
      "question": "How long does `time.Sleep(5)` sleep?",
      "options": [
        "5 seconds",
        "5 milliseconds",
        "5 nanoseconds",
        "It does not compile because 5 has no unit"
      ],
      "answerIndex": 2,
      "explanation": "A `time.Duration` is a count of nanoseconds, so a bare 5 means 5 nanoseconds. Write `5 * time.Second` for five seconds."
    },
    {
      "question": "Which layout formats the date March 14, 2026 as `2026-03-14`?",
      "options": [
        "YYYY-MM-DD",
        "DD/MM/YYYY",
        "2006-01-02",
        "MM-DD-YYYY"
      ],
      "answerIndex": 2,
      "explanation": "Layouts are written with the reference date (year 2006, month 01, day 02). YYYY-MM-DD is printed literally, so it is not a layout either."
    },
    {
      "question": "Why should you store timestamps in UTC and convert to a local zone only for display?",
      "options": [
        "UTC values take less memory than local values",
        "Go cannot create times in any other zone",
        "A UTC instant is unambiguous and comparable everywhere, with no daylight-saving shifts or dependence on the server's setting",
        "Local times cannot be formatted with `Format`"
      ],
      "answerIndex": 2,
      "explanation": "UTC has no daylight-saving changes and means the same thing on every machine, so stored values compare and sort correctly. You convert with `In` when showing the time to a person."
    },
    {
      "question": "What is the difference between `time.NewTimer(d)` and `time.NewTicker(d)`?",
      "options": [
        "A timer fires once after `d`; a ticker fires repeatedly every `d` until stopped",
        "A timer measures elapsed time; a ticker returns the current date",
        "A timer must be stopped; a ticker stops itself after one tick",
        "They are the same, but a ticker accepts a `Duration` and a timer accepts an `int`"
      ],
      "answerIndex": 0,
      "explanation": "A timer is one-shot, like a kitchen timer. A ticker repeats at the interval, like a metronome, so you should call `Stop` on it when you are done."
    }
  ]
});
