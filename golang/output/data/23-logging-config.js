window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "23-logging-config",
  "order": 23,
  "title": "Logging & Configuration",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Learn to write structured log lines with the standard library package log/slog, control how much is logged with levels, and switch to JSON output. Then learn to feed settings into a program from environment variables and command-line flags, and gather them into one validated Config struct (a struct that holds all settings) at startup.",
  "prerequisites": [
    "22-http-client"
  ],
  "subtopics": [
    {
      "id": "slog-structured-logging",
      "title": "log/slog structured logging",
      "explanation": "A log is a record a running program writes about what it is doing, so people can find out later what happened. Until now you used fmt.Println for this. That works on your laptop, but a real service writes thousands of lines a minute, and free-form sentences are hard to search.\n\nA structured log line has two parts: a short message that names the event, and key/value pairs (called attributes) that carry the details. Because every detail has a name, tools can answer questions like \"show all lines where port is 8080\" without guessing at sentence wording.\n\nGo's standard library has a package for this called log/slog (slog stands for structured log). You call a function named after the severity, give it the message, then pass the attributes as alternating key, value arguments: slog.Info(\"server started\", \"port\", 8080). The functions are slog.Info, slog.Warn and slog.Error, and there is slog.Debug for very detailed output.\n\nTo log a failure, pass the error as a value under a key such as \"err\": slog.Error(\"save failed\", \"err\", err). Never glue values into the message with fmt.Sprintf; keep the message constant and put the changing data in attributes.\n\nOut of the box, the default logger sends text to standard error (the stream programs use for diagnostics, separate from normal output) through Go's older log package, and it starts each line with the date and time. Because the time changes on every run, the example below calls log.SetFlags(0), which tells the log package to leave the timestamp prefix off, so the output is the same each time. The default level is Info, so slog.Debug lines are hidden until you lower the threshold (next sub-topic).\n\nTo try it, create a folder, open a terminal in it, run go mod init example.com/logdemo (from topic 01), save the code as main.go, and run go run .",
      "analogy": "A ship's logbook with fixed columns (time, level, event, details) instead of free-form diary entries. Every entry fills the same columns, so the harbour master can scan the 'details' column for one port number across a thousand pages, which is impossible with prose diary entries.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"log\"\n\t\"log/slog\"\n)\n\nfunc main() {\n\t// Turn off the log package's timestamp so this output is repeatable.\n\tlog.SetFlags(0)\n\n\tslog.Info(\"server started\", \"port\", 8080)\n\tslog.Warn(\"cache is cold\", \"entries\", 0)\n\tslog.Error(\"save failed\", \"err\", errors.New(\"disk full\"))\n\tslog.Debug(\"this is hidden at the default level\")\n\n\t// Mistake: a key with no value.\n\tslog.Info(\"odd call\", \"port\")\n}\n",
          "output": "INFO server started port=8080\nWARN cache is cold entries=0\nERROR save failed err=\"disk full\"\nINFO odd call !BADKEY=port\n",
          "explanation": "Each line is LEVEL, message, then key=value pairs. The error text contains a space, so it is quoted. The Debug call prints nothing because the default level is Info. The last call passes a key (\"port\") with no value; slog cannot pair it, so it prints !BADKEY=port instead of crashing. With a normal setup (no log.SetFlags(0)) each line would start with a date and time that differs on every run. go vet (topic 01) warns about such odd argument lists."
        }
      ],
      "productionNote": "Every service logs startup settings, each request and every error. Keep messages constant strings and put variable data in attributes so a log platform can filter and count by field. Always log errors under the same key (\"err\" is the common choice) so one search finds them all.",
      "commonMistakes": [
        "Passing an odd number of key/value arguments. The stray argument shows up as !BADKEY=... in the output and the real data is misaligned. Run go vet to catch this.",
        "Formatting values into the message, such as slog.Info(fmt.Sprintf(\"started on %d\", port)). The port is then buried in a sentence and cannot be searched as a field. Write slog.Info(\"server started\", \"port\", port) instead.",
        "Expecting slog.Debug lines to appear by default. The default level is Info, so Debug calls are silently skipped."
      ],
      "sources": [
        {
          "title": "Package log/slog",
          "url": "https://pkg.go.dev/log/slog"
        },
        {
          "title": "Structured Logging with slog (Go blog)",
          "url": "https://go.dev/blog/slog"
        }
      ]
    },
    {
      "id": "log-levels-json-handler",
      "title": "Log levels and the JSON handler",
      "explanation": "Every log line has a level that says how important it is. In increasing order of severity: Debug, Info, Warn, Error. A logger has a minimum level, and lines below it are thrown away. Set the minimum to Info and Debug calls cost almost nothing and print nothing.\n\nSo far you used the package-level functions such as slog.Info. They use a default logger. To control the format and level you create your own logger with slog.New, which takes a handler. A handler is the part that decides how a log record is written: slog.NewTextHandler writes key=value text (good for reading on your own machine), and slog.NewJSONHandler writes one JSON object per line (good for log platforms, which parse JSON automatically).\n\nBoth constructors take a destination that implements io.Writer (such as os.Stdout, topic 10) and a pointer to slog.HandlerOptions. Its Level field sets the minimum level, for example slog.LevelDebug or slog.LevelInfo. If you pass nil for the options, the level is Info.\n\nHandlerOptions also has a ReplaceAttr field: a function Go calls for every attribute before it is written, letting you change or drop it. Returning an empty slog.Attr{} drops the attribute. The example uses it to remove the time field so the output is repeatable. In real services you normally keep the time.\n\nlogger.With(\"request_id\", id) returns a new logger that adds those attributes to every line it writes. This is how you attach a request ID once and have it appear on every line for that request. Finally, slog.SetDefault(logger) makes your logger the one used by the package-level functions like slog.Info.",
      "analogy": "A volume knob. In production you turn it down to Info so only the important lines come out; while hunting a bug you turn it up to Debug and hear everything. The handler is the choice of speaker: plain text for you, JSON for the machines that listen on the other side.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"log/slog\"\n\t\"os\"\n)\n\n// dropTime removes the top-level \"time\" attribute so output is repeatable.\nfunc dropTime(groups []string, a slog.Attr) slog.Attr {\n\tif a.Key == slog.TimeKey && len(groups) == 0 {\n\t\treturn slog.Attr{}\n\t}\n\treturn a\n}\n\nfunc main() {\n\tdebugOpts := &slog.HandlerOptions{Level: slog.LevelDebug, ReplaceAttr: dropTime}\n\tlogger := slog.New(slog.NewJSONHandler(os.Stdout, debugOpts))\n\tlogger.Debug(\"cache miss\", \"key\", \"user:7\")\n\n\t// A child logger that adds request_id to every line.\n\treqLogger := logger.With(\"request_id\", \"r-42\")\n\treqLogger.Info(\"handled\", \"status\", 200)\n\n\t// Same handler, but the minimum level is Info.\n\tquietOpts := &slog.HandlerOptions{Level: slog.LevelInfo, ReplaceAttr: dropTime}\n\tquiet := slog.New(slog.NewJSONHandler(os.Stdout, quietOpts))\n\tquiet.Debug(\"cache miss\", \"key\", \"user:7\") // prints nothing\n\tquiet.Warn(\"disk almost full\", \"percent\", 91)\n\n\t// Text handler for local development, installed as the default logger.\n\ttext := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{ReplaceAttr: dropTime}))\n\tslog.SetDefault(text)\n\tslog.Info(\"ready\", \"port\", 8080)\n\tslog.Info(\"now the default\")\n}\n",
          "output": "{\"level\":\"DEBUG\",\"msg\":\"cache miss\",\"key\":\"user:7\"}\n{\"level\":\"INFO\",\"msg\":\"handled\",\"request_id\":\"r-42\",\"status\":200}\n{\"level\":\"WARN\",\"msg\":\"disk almost full\",\"percent\":91}\nlevel=INFO msg=ready port=8080\nlevel=INFO msg=\"now the default\"\n",
          "explanation": "The first logger is at Debug, so its Debug line prints as JSON. The child logger reqLogger puts request_id on its line without repeating it in the call. The quiet logger is at Info, so its Debug call prints nothing, while its Warn line prints. Finally the text handler becomes the default, so the plain slog.Info calls use key=value text. With the time attribute kept (the real-world default), every line would also contain a \"time\" field, such as \"time\":\"2026-03-14T09:30:00Z\", that varies per run."
        }
      ],
      "productionNote": "Services usually log JSON to standard output at Info and let the platform (the container runtime, and a log shipper, which is a program that copies logs off the machine) collect it. Build the logger once in main, pass it to the code that needs it or install it with slog.SetDefault, and create per-request child loggers with With. Make the level configurable (see the Config sub-topic) so you can raise it to Debug temporarily.",
      "commonMistakes": [
        "Logging secrets such as passwords, API tokens or full database URLs. Log files are copied around and read by many people; log only that a secret is set, never its value.",
        "Leaving the level at Debug in production. It produces huge volumes of noise and costs money in storage and processing.",
        "Forgetting that logger.With returns a new logger. Calling logger.With(...) and ignoring the result changes nothing."
      ],
      "sources": [
        {
          "title": "slog.NewJSONHandler",
          "url": "https://pkg.go.dev/log/slog#NewJSONHandler"
        },
        {
          "title": "slog.HandlerOptions",
          "url": "https://pkg.go.dev/log/slog#HandlerOptions"
        },
        {
          "title": "slog.Logger.With",
          "url": "https://pkg.go.dev/log/slog#Logger.With"
        }
      ]
    },
    {
      "id": "environment-variables",
      "title": "Environment variables",
      "explanation": "An environment variable is a named text setting that the operating system hands to every program it starts. Examples are PORT=9090 or DATABASE_URL=.... They let you change a program's behaviour without editing or recompiling code, and they keep secrets (passwords, tokens) out of your source files.\n\nGo reads them with the os package. os.Getenv(\"PORT\") returns the value as a string, or an empty string if the variable is not set. The problem: an empty string is also what you get when the variable is set to nothing, so you cannot tell the two cases apart.\n\nos.LookupEnv(\"PORT\") returns two values: the string and a bool (ok). ok is true if the variable exists, even if it is empty, and false if it is unset. This is the comma-ok pattern you saw with maps.\n\nA small helper that returns a default when the variable is unset is very common: getenv(key, def). It uses LookupEnv so a variable set on purpose is respected.\n\nEnvironment values are always strings. If you need a number, convert with strconv.Atoi and handle the error, because the user can set PORT=abc. The first example sets variables from inside the program with os.Setenv(key, value) (which sets a variable for the current run only) so its output is repeatable; in real programs the values come from outside.",
      "analogy": "Sticky notes on the fridge that the program reads every morning when it starts. Whoever runs the program can change the notes without touching the program. A missing note and a blank note are different things, which is exactly the Getenv versus LookupEnv difference.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"os\"\n\t\"strconv\"\n)\n\n// getenv returns the variable's value, or def if it is not set.\nfunc getenv(key, def string) string {\n\tif v, ok := os.LookupEnv(key); ok {\n\t\treturn v\n\t}\n\treturn def\n}\n\nfunc main() {\n\t// Set variables for this run only (normally they come from outside).\n\tos.Setenv(\"APP_PORT\", \"9090\")\n\tos.Setenv(\"APP_EMPTY\", \"\")\n\n\tfmt.Printf(\"%q\\n\", os.Getenv(\"APP_UNSET\"))\n\n\tv, ok := os.LookupEnv(\"APP_UNSET\")\n\tfmt.Printf(\"%q %t\\n\", v, ok)\n\n\tv, ok = os.LookupEnv(\"APP_EMPTY\")\n\tfmt.Printf(\"%q %t\\n\", v, ok)\n\n\tfmt.Println(getenv(\"APP_PORT\", \"8080\"))\n\tfmt.Println(getenv(\"APP_UNSET\", \"8080\"))\n\n\t// Values are strings: convert and check the error.\n\tport, err := strconv.Atoi(getenv(\"APP_PORT\", \"8080\"))\n\tif err != nil {\n\t\tfmt.Println(\"bad port:\", err)\n\t\treturn\n\t}\n\tfmt.Println(port + 1)\n}\n",
          "output": "\"\"\n\"\" false\n\"\" true\n9090\n8080\n9091\n",
          "explanation": "Getenv gives \"\" for an unset variable. LookupEnv adds the ok flag: false for APP_UNSET, true for APP_EMPTY even though both values are empty. getenv returns the set value 9090 for APP_PORT and the default 8080 for the unset one. Atoi turns the string \"9090\" into the int 9090, so adding 1 gives 9091."
        },
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"os\"\n)\n\nfunc getenv(key, def string) string {\n\tif v, ok := os.LookupEnv(key); ok {\n\t\treturn v\n\t}\n\treturn def\n}\n\nfunc main() {\n\tfmt.Println(getenv(\"PORT\", \"8080\"))\n}\n",
          "output": "8080",
          "explanation": "This program reads the real PORT variable. With PORT not set in your terminal, it prints the default 8080 (the output here assumes it is unset). The next two examples show how to set PORT for just one run."
        },
        {
          "language": "bash",
          "filename": "terminal-bash",
          "source": "PORT=9090 go run .",
          "output": "9090",
          "explanation": "In bash (Linux, macOS, Git Bash) put VAR=value before the command to set it for that one command only."
        },
        {
          "language": "powershell",
          "filename": "terminal-powershell",
          "source": "$env:PORT = \"9090\"; go run .",
          "output": "9090",
          "explanation": "In PowerShell on Windows, assign to $env:PORT first. Unlike bash, this stays set for the rest of that terminal session; remove it with Remove-Item Env:PORT."
        }
      ],
      "productionNote": "Containers (sealed, packaged app bundles, covered in topic 25) and cloud platforms configure services almost entirely through environment variables, the so-called twelve-factor style (a set of cloud-app rules that say to read settings from the environment). Read them in one place at startup (see the Config sub-topic), not scattered through the code, and pass secrets only this way, never in source code or version control.",
      "commonMistakes": [
        "Forgetting that environment values are strings. Convert with strconv.Atoi or strconv.ParseBool and handle the error.",
        "Using Getenv when you must distinguish unset from empty. Use LookupEnv.",
        "Calling os.Getenv all over the program. Settings then hide in random places and are hard to test; read them once at startup into a struct."
      ],
      "sources": [
        {
          "title": "os.Getenv",
          "url": "https://pkg.go.dev/os#Getenv"
        },
        {
          "title": "os.LookupEnv",
          "url": "https://pkg.go.dev/os#LookupEnv"
        }
      ]
    },
    {
      "id": "command-line-flags",
      "title": "Command-line flags with flag",
      "explanation": "A command-line flag is an option typed after the program name, such as -port=9090. The standard library package flag reads them for you.\n\nYou declare each flag before parsing. flag.Int(\"port\", 8080, \"listen port\") takes the flag name, a default value and a help text. It returns a pointer (topic 09) to an int, which flag fills in later, so you read the value as *port. Siblings exist for other types: flag.String, flag.Bool and flag.Duration (a time.Duration such as 5s or 2m, from topic 13).\n\nAfter declaring all flags, call flag.Parse() once. It reads the command line and writes the values into the pointers. Before Parse runs, the pointers still hold only the defaults.\n\nflag also gives you free behaviour. -h or -help prints a usage message listing every flag with its default and help text. A bad value, like -port=abc for an int, prints an error and the usage, and the program exits with code 2 (a non-zero exit code means failure).\n\nThere is also a form that writes into a variable you already own: flag.IntVar(&cfg.Port, \"port\", 8080, \"listen port\"). It takes a pointer to the destination as the first argument, and returns nothing. This is handy for filling a struct, as the Config sub-topic does.\n\nWith go run, put your flags after the package: go run . -port=9090. Everything after . goes to your program.",
      "analogy": "The options box on an order form: 'size: large', 'extra cheese: yes'. Each option has a name and a default (what you get if you tick nothing). The kitchen (your program) reads the form once before it starts cooking.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"flag\"\n\t\"fmt\"\n\t\"time\"\n)\n\nfunc main() {\n\tport := flag.Int(\"port\", 8080, \"listen port\")\n\ttimeout := flag.Duration(\"timeout\", 5*time.Second, \"request timeout\")\n\tverbose := flag.Bool(\"verbose\", false, \"print extra detail\")\n\n\tflag.Parse() // must run before the values are used\n\n\tfmt.Println(\"listening on\", *port)\n\tfmt.Println(\"timeout\", *timeout)\n\tif *verbose {\n\t\tfmt.Println(\"verbose mode on\")\n\t}\n}\n",
          "output": "listening on 8080\ntimeout 5s\n",
          "explanation": "Run with no flags, the defaults are used: 8080 and 5s, and verbose stays false. Note the * in front of each variable to read the value the pointer refers to. Run with flags (next blocks) to see the values change."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go run . -port=9090 -timeout=2s -verbose",
          "output": "listening on 9090\ntimeout 2s\nverbose mode on",
          "explanation": "Flags override defaults. A bool flag needs no value: naming it sets it to true."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "go run . -port=abc",
          "output": "invalid value \"abc\" for flag -port: parse error\nUsage of /tmp/go-build1234/b001/exe/main:\n  -port int\n    \tlisten port (default 8080)\n  -timeout duration\n    \trequest timeout (default 5s)\n  -verbose\n    \tprint extra detail\nexit status 2",
          "explanation": "flag rejects a value that is not an int, prints the error and the generated usage, and exits with code 2. The path after 'Usage of' is a temporary build location and differs on your machine (on Windows it ends in main.exe). The last line is added by go run."
        }
      ],
      "productionNote": "Flags suit command-line tools and let you override a setting for one run while developing. For long-running services, flags and environment variables are usually combined, with flags having the final say (see the Config sub-topic).",
      "commonMistakes": [
        "Reading a flag before flag.Parse() has been called. You get only the defaults and your command-line values are ignored.",
        "Forgetting the value is a pointer. Printing port shows a memory address; you need *port.",
        "Putting flags before the package, as in go run -port=9090 . The go command would read -port itself. Write go run . -port=9090."
      ],
      "sources": [
        {
          "title": "Package flag",
          "url": "https://pkg.go.dev/flag"
        }
      ]
    },
    {
      "id": "config-struct-pattern",
      "title": "The Config struct pattern",
      "explanation": "Real programs have many settings: port, database address, log level and more. The standard pattern collects them in one struct, builds it once in a function called load, validates it, and hands it to the rest of the program.\n\nload applies sources in a fixed order, and a later source overrides an earlier one: defaults first, then environment variables, then command-line flags. It returns (Config, error). If a required setting is missing or a value is invalid, it returns an error immediately.\n\nmain calls load first thing. On error it prints a message to standard error and calls os.Exit(1), which stops the program at once with exit code 1 (any non-zero code tells the shell and container platform that the program failed). Failing at startup is much better than failing on the first customer request.\n\nThe example below also reads LOG_LEVEL. slog.Level has a method UnmarshalText that turns text such as \"DEBUG\" or \"WARN\" into a level, or returns an error for text it does not know. The []byte(v) conversion turns the string into the byte slice that method expects.\n\nPass the Config (or just the fields a function needs) explicitly as an argument instead of storing it in a global variable. That makes functions easy to test, because a test can build any Config it likes.\n\nNever print the whole Config if it contains secrets. The example prints only db=set, not the URL itself.",
      "analogy": "A pilot's preflight checklist. Every setting is checked once on the ground, before takeoff. If something is wrong the plane never leaves the gate, instead of discovering a missing part mid-flight.",
      "code": [
        {
          "language": "go",
          "filename": "main.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"flag\"\n\t\"fmt\"\n\t\"log/slog\"\n\t\"os\"\n\t\"strconv\"\n)\n\ntype Config struct {\n\tPort        int\n\tDatabaseURL string\n\tLogLevel    slog.Level\n}\n\n// load builds the Config once: defaults, then env, then flags.\nfunc load() (Config, error) {\n\t// 1. defaults\n\tcfg := Config{Port: 8080, LogLevel: slog.LevelInfo}\n\n\t// 2. environment\n\tif v := os.Getenv(\"PORT\"); v != \"\" {\n\t\tp, err := strconv.Atoi(v)\n\t\tif err != nil {\n\t\t\treturn Config{}, fmt.Errorf(\"PORT must be a number: %w\", err)\n\t\t}\n\t\tcfg.Port = p\n\t}\n\tif v := os.Getenv(\"LOG_LEVEL\"); v != \"\" {\n\t\tif err := cfg.LogLevel.UnmarshalText([]byte(v)); err != nil {\n\t\t\treturn Config{}, fmt.Errorf(\"LOG_LEVEL: %w\", err)\n\t\t}\n\t}\n\tcfg.DatabaseURL = os.Getenv(\"DATABASE_URL\")\n\n\t// 3. flags (the env value becomes the flag's default, so a flag wins)\n\tflag.IntVar(&cfg.Port, \"port\", cfg.Port, \"listen port\")\n\tflag.Parse()\n\n\t// 4. validate\n\tif cfg.DatabaseURL == \"\" {\n\t\treturn Config{}, errors.New(\"DATABASE_URL is required\")\n\t}\n\tif cfg.Port < 1 || cfg.Port > 65535 {\n\t\treturn Config{}, fmt.Errorf(\"port %d is out of range\", cfg.Port)\n\t}\n\treturn cfg, nil\n}\n\nfunc main() {\n\tcfg, err := load()\n\tif err != nil {\n\t\tfmt.Fprintln(os.Stderr, \"config:\", err)\n\t\tos.Exit(1)\n\t}\n\t// Never print the URL itself: it may contain a password.\n\tfmt.Printf(\"port=%d db=set level=%s\\n\", cfg.Port, cfg.LogLevel)\n}\n",
          "output": "config: DATABASE_URL is required\n",
          "explanation": "This is the result when DATABASE_URL is not set: load returns the error, main prints it to standard error and exits with code 1 (go run adds the line 'exit status 1'). The next blocks show a successful run and an override. load puts the env-derived port in as the flag default, so -port wins over PORT, which wins over the built-in 8080."
        },
        {
          "language": "bash",
          "filename": "terminal-bash",
          "source": "DATABASE_URL=postgres://app:secret@localhost:5432/app go run .\nDATABASE_URL=postgres://app:secret@localhost:5432/app PORT=9000 LOG_LEVEL=debug go run . -port=7000",
          "output": "port=8080 db=set level=INFO\nport=7000 db=set level=DEBUG",
          "explanation": "First run: defaults apply except the required URL. Second run: PORT=9000 is read from the environment, but the flag -port=7000 overrides it, and LOG_LEVEL=debug is accepted case-insensitively. The URL, including its password, is never printed."
        },
        {
          "language": "powershell",
          "filename": "terminal-powershell",
          "source": "$env:DATABASE_URL = \"postgres://app:secret@localhost:5432/app\"; go run .",
          "output": "port=8080 db=set level=INFO",
          "explanation": "The same successful run in PowerShell. Remember the variable stays set in that terminal until you remove it with Remove-Item Env:DATABASE_URL."
        }
      ],
      "productionNote": "Every service's main.go starts like this: load config, build the logger from cfg.LogLevel, then wire up the rest. Validating at startup means a bad deployment crashes immediately and visibly, where an orchestrator can report it, rather than breaking at random later.",
      "commonMistakes": [
        "Failing late: reading a required setting only when the first request needs it. Validate everything in load, before the server starts.",
        "Logging the entire config, which leaks passwords and tokens from DATABASE_URL or API keys. Log only safe fields, or just whether a secret is set.",
        "Keeping the config in a global variable that any function can change. Pass the Config or its fields as arguments."
      ],
      "sources": [
        {
          "title": "flag.IntVar",
          "url": "https://pkg.go.dev/flag#IntVar"
        },
        {
          "title": "os.Exit",
          "url": "https://pkg.go.dev/os#Exit"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "Why is slog.Info(\"server started\", \"port\", 8080) better than fmt.Printf(\"server started on port %d\\n\", 8080) for a production service?",
      "options": [
        "It runs much faster because Printf is not allowed in services",
        "The port is a named attribute that tools can search and filter on, instead of being buried in a sentence",
        "It automatically encrypts the log line",
        "It stops the program from crashing when an error happens"
      ],
      "answerIndex": 1,
      "explanation": "Structured logging separates a constant message from named key/value pairs, so log tools can query fields like port directly. It has nothing to do with encryption or crash prevention."
    },
    {
      "question": "A logger is created with Level: slog.LevelInfo. What happens when you call logger.Debug(\"cache miss\", \"key\", \"user:7\")?",
      "options": [
        "It prints the line normally",
        "It prints the line but marked as a warning",
        "Nothing is printed, because Debug is below the minimum level",
        "The program stops with an error"
      ],
      "answerIndex": 2,
      "explanation": "Levels go Debug < Info < Warn < Error. Lines below the logger's minimum level are discarded silently."
    },
    {
      "question": "Why would you use os.LookupEnv instead of os.Getenv?",
      "options": [
        "LookupEnv converts the value to an int automatically",
        "LookupEnv can read variables that Getenv cannot see",
        "LookupEnv also tells you whether the variable was set at all, so unset and empty can be told apart",
        "LookupEnv is the only one that works on Windows"
      ],
      "answerIndex": 2,
      "explanation": "Both return a string, and both return \"\" for an unset variable, but LookupEnv adds an ok bool that is true when the variable exists, even if it is empty."
    },
    {
      "question": "When must flag.Parse() be called?",
      "options": [
        "After declaring the flags and before reading their values",
        "Before declaring any flags",
        "Only when the user passes -h",
        "Never, because the flag package parses automatically when the program starts"
      ],
      "answerIndex": 0,
      "explanation": "Declaring a flag only registers it. flag.Parse() reads the command line and fills in the values, so reading *port before it runs gives only the default."
    },
    {
      "question": "Where is the best place to validate required settings such as DATABASE_URL?",
      "options": [
        "Inside the first request handler that needs it",
        "Once at startup in load(), exiting with a clear error if something is wrong",
        "In every function that uses the setting, each time it is called",
        "Nowhere; a wrong value will show up eventually"
      ],
      "answerIndex": 1,
      "explanation": "Validating once at startup makes a bad deployment fail immediately and visibly, instead of breaking later on a real request."
    }
  ]
});
