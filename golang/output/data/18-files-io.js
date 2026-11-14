window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "18-files-io",
  "order": 18,
  "title": "Files & I/O",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Learn Go's two small streaming interfaces, io.Reader and io.Writer, and how io.Copy joins any source to any destination. Then read and write files, process them line by line, build portable file paths, and bake static files into your compiled program with embed.",
  "prerequisites": [
    "17-context"
  ],
  "subtopics": [
    {
      "id": "reader-writer",
      "title": "io.Reader and io.Writer",
      "explanation": "Almost everything in Go that moves bytes (a byte is one small number from 0 to 255) uses two tiny interfaces from the io package. An interface, as you saw earlier, is a list of methods; any type that has those methods satisfies it automatically.\n\nAn io.Reader has one method: Read(p []byte) (n int, err error). You hand Read a slice of bytes (a buffer, meaning a chunk of memory to fill). Read copies up to len(p) bytes of data into it and reports in n how many bytes it actually stored. An io.Writer has one method: Write(p []byte) (n int, err error). It takes bytes and sends them somewhere.\n\nFiles, network connections, in-memory buffers and HTTP request and response bodies all implement these interfaces. That is why one function that accepts an io.Reader works with all of them.\n\nWhen a Reader has no more data, Read returns the special error value io.EOF (short for end of file). It is not a failure. It is the normal signal that the data ended, so a loop that reads should stop quietly on io.EOF and only treat other errors as problems.\n\nOne rule about Read: it may return n greater than 0 and a non-nil error in the same call. Always process the n bytes first, then look at the error.\n\nio.Copy(dst, src) joins the two interfaces. It reads from src (a Reader) and writes to dst (a Writer) in small pieces until the source reports io.EOF, so the whole data never has to fit in memory. It returns the number of bytes copied and an error. In the examples, strings.NewReader(s) turns a string into a Reader, and os.Stdout (your terminal's output) is a Writer.",
      "analogy": "Think of taps and sinks. A Reader is any tap that can pour out water (a file, a network socket, a string). A Writer is any sink that can receive it (a file, the terminal, a network socket). io.Copy is the hose: it fits any tap to any sink and lets the water flow until the tap runs dry (io.EOF), without ever holding all the water in a bucket.",
      "code": [
        {
          "language": "go",
          "filename": "copy.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"io\"\n\t\"os\"\n\t\"strings\"\n)\n\nfunc main() {\n\tsrc := strings.NewReader(\"hello\\n\") // a Reader over a string\n\tn, err := io.Copy(os.Stdout, src)    // os.Stdout is a Writer\n\tif err != nil {\n\t\tfmt.Println(\"copy failed:\", err)\n\t\treturn\n\t}\n\tfmt.Println(\"copied\", n, \"bytes\")\n}\n",
          "output": "hello\ncopied 6 bytes",
          "explanation": "To run it, create a folder, run go mod init demo inside it, save this as copy.go, and run go run . in that folder. io.Copy pulls bytes from the string reader and pushes them to the terminal. The 6 counts h, e, l, l, o and the newline."
        },
        {
          "language": "go",
          "filename": "readloop.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"io\"\n\t\"strings\"\n)\n\nfunc main() {\n\tr := strings.NewReader(\"hello\\n\")\n\tbuf := make([]byte, 4) // room for 4 bytes per Read\n\tfor {\n\t\tn, err := r.Read(buf)\n\t\tif n > 0 { // use the bytes before looking at err\n\t\t\tfmt.Printf(\"read %d: %q\\n\", n, buf[:n])\n\t\t}\n\t\tif err == io.EOF {\n\t\t\tfmt.Println(\"end of data\")\n\t\t\tbreak\n\t\t}\n\t\tif err != nil {\n\t\t\tfmt.Println(\"error:\", err)\n\t\t\tbreak\n\t\t}\n\t}\n}\n",
          "output": "read 4: \"hell\"\nread 2: \"o\\n\"\nend of data",
          "explanation": "This is roughly what io.Copy does for you. The buffer holds 4 bytes, so the six bytes arrive in two reads (4, then 2). The third Read returns 0 bytes and io.EOF, which we treat as a normal end, not an error. %q prints the bytes as a quoted string with the newline shown as \\n."
        }
      ],
      "productionNote": "Prefer accepting an io.Reader or io.Writer parameter over a filename or a []byte. Then the same function can process a file, an HTTP upload or a test string. Use io.Copy to stream large uploads and downloads straight from one place to another without loading them into memory.",
      "commonMistakes": [
        "Treating io.EOF as a failure. It only means the data ended normally; compare against it and stop the loop without reporting an error.",
        "Ignoring n when err is not nil. A Read call can return some bytes and an error together, so use buf[:n] first and handle the error afterwards.",
        "Assuming Read fills the whole buffer. It may return fewer bytes than len(p), so always slice with buf[:n]."
      ],
      "sources": [
        {
          "title": "io.Reader (pkg.go.dev)",
          "url": "https://pkg.go.dev/io#Reader"
        },
        {
          "title": "io.Copy (pkg.go.dev)",
          "url": "https://pkg.go.dev/io#Copy"
        }
      ]
    },
    {
      "id": "os-files",
      "title": "Reading and writing files with os",
      "explanation": "The os package talks to the operating system. For small files the simplest tools handle the whole file in one call.\n\nos.WriteFile(name, data, 0o644) creates the file (or replaces its contents) and writes the bytes in data. The third argument is the permission bits, which say who may do what with the file. 0o644 is an octal number (the 0o prefix means base 8): 6 means the owner can read and write, and each 4 means the group and everyone else can only read. On Windows these bits are mostly ignored.\n\nos.ReadFile(name) reads the entire file and returns its contents as a []byte plus an error. Convert it with string(data) to print it.\n\nWhen a file does not exist, the error wraps the sentinel value os.ErrNotExist. Use errors.Is(err, os.ErrNotExist) to detect that case.\n\nFor big files, or when you want to work piece by piece, open the file instead. os.Create(name) makes (or empties) a file and opens it for writing. os.Open(name) opens an existing file for reading. Both return a *os.File (a pointer to an open file handle) and an error. A *os.File is both an io.Reader and an io.Writer, so it works with io.Copy and fmt.Fprintln.\n\nAn open file holds a resource owned by the operating system, so you must call f.Close() when done, usually with defer f.Close() right after checking the open error. For files you wrote to, the Close error matters: buffered data may only be flushed at that moment, so a failed Close can mean lost data. Check it instead of deferring it blindly.",
      "analogy": "A filing cabinet. os.ReadFile is photocopying the whole folder in one go and carrying the copy back. os.Open is pulling the drawer out and reading page by page, and Close is pushing the drawer shut so the next person can use it.",
      "code": [
        {
          "language": "go",
          "filename": "files.go",
          "source": "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n\t\"os\"\n)\n\nfunc main() {\n\terr := os.WriteFile(\"notes.txt\", []byte(\"line 1\\nline 2\\n\"), 0o644)\n\tif err != nil {\n\t\tfmt.Println(\"write failed:\", err)\n\t\treturn\n\t}\n\n\tdata, err := os.ReadFile(\"notes.txt\")\n\tif err != nil {\n\t\tfmt.Println(\"read failed:\", err)\n\t\treturn\n\t}\n\tfmt.Print(string(data))\n\n\t_, err = os.ReadFile(\"missing.txt\")\n\tfmt.Println(errors.Is(err, os.ErrNotExist))\n}\n",
          "output": "line 1\nline 2\ntrue",
          "explanation": "The file notes.txt is created in the folder where you run go run . . The last read targets a file that was never created, so the error matches os.ErrNotExist and errors.Is reports true."
        },
        {
          "language": "go",
          "filename": "stream.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"io\"\n\t\"os\"\n)\n\nfunc writeReport(name string) error {\n\tf, err := os.Create(name)\n\tif err != nil {\n\t\treturn err\n\t}\n\t_, err = fmt.Fprintln(f, \"total: 3\")\n\tif err != nil {\n\t\tf.Close() // already failing; the write error is the one to report\n\t\treturn err\n\t}\n\treturn f.Close() // the Close error matters after writing\n}\n\nfunc main() {\n\tif err := writeReport(\"report.txt\"); err != nil {\n\t\tfmt.Println(\"write failed:\", err)\n\t\treturn\n\t}\n\n\tf, err := os.Open(\"report.txt\")\n\tif err != nil {\n\t\tfmt.Println(\"open failed:\", err)\n\t\treturn\n\t}\n\tdefer f.Close()\n\n\tif _, err := io.Copy(os.Stdout, f); err != nil {\n\t\tfmt.Println(\"copy failed:\", err)\n\t}\n}\n",
          "output": "total: 3",
          "explanation": "writeReport creates the file, writes one line with fmt.Fprintln (which accepts any io.Writer, including a *os.File), and returns the result of Close. main then opens the file for reading, defers the Close, and streams it to the terminal with io.Copy."
        }
      ],
      "productionNote": "Use os.ReadFile and os.WriteFile for config files and small exports. For large files, stream with os.Open and io.Copy or a scanner. For temporary files, use os.CreateTemp so names never clash. Always check the Close error on files you wrote.",
      "commonMistakes": [
        "Calling os.ReadFile on a huge file. It loads everything into memory at once, so stream big files instead.",
        "Forgetting to Close an opened file. Each open file uses an operating system resource, and a program that leaks them eventually fails with a too many open files error.",
        "Ignoring the Close error after writing. Data may be flushed only at Close, so a failure there can silently lose data.",
        "Checking the open error after using the file, or deferring Close before checking the error. If Open failed, f is nil and there is nothing to close."
      ],
      "sources": [
        {
          "title": "os.ReadFile (pkg.go.dev)",
          "url": "https://pkg.go.dev/os#ReadFile"
        },
        {
          "title": "os.WriteFile (pkg.go.dev)",
          "url": "https://pkg.go.dev/os#WriteFile"
        },
        {
          "title": "os.Open (pkg.go.dev)",
          "url": "https://pkg.go.dev/os#Open"
        }
      ]
    },
    {
      "id": "bufio-scanner",
      "title": "bufio.Scanner",
      "explanation": "Often you want to handle a text file one line at a time, such as a log file with millions of lines. The bufio package (buffered I/O: it reads big chunks and hands out small pieces efficiently) provides bufio.Scanner for this.\n\nCreate one with scanner := bufio.NewScanner(f), where f is any io.Reader, such as an open file. Then loop: scanner.Scan() moves to the next line and returns true, or false when there are no more lines or an error occurred. Inside the loop, scanner.Text() returns the current line as a string, without the trailing newline.\n\nAfter the loop, always check scanner.Err(). A false from Scan does not tell you whether the file simply ended or something went wrong. Err returns nil for a normal end and the real error otherwise.\n\nBy default the scanner refuses lines longer than 64 KiB (KiB is a kibibyte, 1024 bytes; MiB is 1024 KiB) (bufio.MaxScanTokenSize, 65536 bytes). Such a line stops the scan, and scanner.Err() returns bufio.Scanner: token too long. If you expect long lines, call scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024) before the first Scan. That gives an initial buffer and a new maximum line size of 1 MiB.",
      "analogy": "Reading a book with your finger under one line at a time. Each Scan moves your finger down a line, Text is what you read under it, and Err is asking yourself afterwards whether you stopped because the book ended or because the page was torn.",
      "code": [
        {
          "language": "go",
          "filename": "lines.go",
          "source": "package main\n\nimport (\n\t\"bufio\"\n\t\"fmt\"\n\t\"os\"\n)\n\nfunc main() {\n\t// Create the input so this example runs by itself.\n\tif err := os.WriteFile(\"notes.txt\", []byte(\"line 1\\nline 2\\n\"), 0o644); err != nil {\n\t\tfmt.Println(\"write failed:\", err)\n\t\treturn\n\t}\n\n\tf, err := os.Open(\"notes.txt\")\n\tif err != nil {\n\t\tfmt.Println(\"open failed:\", err)\n\t\treturn\n\t}\n\tdefer f.Close()\n\n\tscanner := bufio.NewScanner(f)\n\t// Allow lines up to 1 MiB instead of the default 64 KiB.\n\tscanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)\n\n\tn := 0\n\tfor scanner.Scan() {\n\t\tn++\n\t\tfmt.Printf(\"%d: %s\\n\", n, scanner.Text())\n\t}\n\tif err := scanner.Err(); err != nil {\n\t\tfmt.Println(\"scan failed:\", err)\n\t}\n}\n",
          "output": "1: line 1\n2: line 2",
          "explanation": "The loop runs once per line. The counter n is our own; the scanner does not number lines. After the loop, scanner.Err() is nil here, so nothing more is printed."
        }
      ],
      "productionNote": "Scanner is the standard tool for log processing, simple line-based formats and reading standard input. It streams, so memory use stays small even for gigabyte files. If a line can be arbitrarily long, either raise the limit with scanner.Buffer or read with bufio.Reader instead.",
      "commonMistakes": [
        "Skipping scanner.Err() after the loop. A read failure or an over-long line then looks exactly like a normal end of file, and you silently process partial data.",
        "Hitting bufio.Scanner: token too long on lines over 64 KiB and not realising why the loop stopped early. Raise the limit with scanner.Buffer.",
        "Keeping the result of scanner.Text() is safe, but the slice from scanner.Bytes() (the raw bytes of the line, not a string) is not: the next Scan overwrites its contents. Copy it if you need it later."
      ],
      "sources": [
        {
          "title": "bufio.Scanner (pkg.go.dev)",
          "url": "https://pkg.go.dev/bufio#Scanner"
        }
      ]
    },
    {
      "id": "filepath",
      "title": "Paths with path/filepath",
      "explanation": "A path is the text that names a file's location, like data/2026/report.csv. Windows separates folders with a backslash (\\), while macOS and Linux use a forward slash (/). Writing the separator by hand makes your program break on the other system.\n\nThe path/filepath package builds and takes apart paths using the separator of the operating system the program runs on. filepath.Join(\"data\", \"2026\", \"report.csv\") glues the parts with the right separator and cleans up doubled separators.\n\nTo take paths apart: filepath.Base(p) gives the last element (the file name), filepath.Dir(p) gives everything before it, and filepath.Ext(p) gives the extension including the dot, such as .csv. filepath.Abs(p) turns a relative path into a full one starting from the current directory.\n\nTo visit every file and folder under a directory, use filepath.WalkDir(root, fn). It calls your function fn once for each entry, in lexical (alphabetical) order. The function receives the path, a fs.DirEntry (an io/fs type describing one entry, with methods like IsDir), and an error. Return nil to continue, or an error to stop. Folders are visited before their contents.\n\nThe similarly named path package is only for slash-separated paths such as URLs. Do not use it for files on disk.\n\nSecurity warning: if part of a path comes from a user, a name like ../../etc/passwd can climb out of your intended folder. This is called path traversal. Go 1.24 added os.Root, which opens a directory and lets you only access files inside it. This course only names it; read the os.Root documentation when you accept file names from users.",
      "analogy": "Writing a postal address in the local country's format. The place is the same, but one country writes the street first and another puts the number first, with different punctuation. filepath.Join writes the address in the format of the country your program is currently in.",
      "code": [
        {
          "language": "go",
          "filename": "paths.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"path/filepath\"\n)\n\nfunc main() {\n\tp := filepath.Join(\"data\", \"2026\", \"report.csv\")\n\tfmt.Println(p, filepath.Base(p), filepath.Ext(p))\n\tfmt.Println(filepath.Dir(p))\n}\n",
          "output": "data/2026/report.csv report.csv .csv\ndata/2026",
          "explanation": "This output is from macOS or Linux. On Windows the separator is a backslash, so the program prints data\\2026\\report.csv report.csv .csv and then data\\2026. The code is identical on both."
        },
        {
          "language": "go",
          "filename": "walk.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"io/fs\"\n\t\"os\"\n\t\"path/filepath\"\n)\n\nfunc main() {\n\t// Build a small tree: tree/a.txt and tree/sub/b.txt\n\tif err := os.MkdirAll(filepath.Join(\"tree\", \"sub\"), 0o755); err != nil {\n\t\tfmt.Println(\"mkdir failed:\", err)\n\t\treturn\n\t}\n\tdefer os.RemoveAll(\"tree\") // clean up afterwards\n\tos.WriteFile(filepath.Join(\"tree\", \"a.txt\"), []byte(\"a\"), 0o644)\n\tos.WriteFile(filepath.Join(\"tree\", \"sub\", \"b.txt\"), []byte(\"b\"), 0o644)\n\n\terr := filepath.WalkDir(\"tree\", func(path string, d fs.DirEntry, err error) error {\n\t\tif err != nil {\n\t\t\treturn err\n\t\t}\n\t\tfmt.Println(filepath.ToSlash(path)) // same output on every OS\n\t\treturn nil\n\t})\n\tif err != nil {\n\t\tfmt.Println(\"walk failed:\", err)\n\t}\n}\n",
          "output": "tree\ntree/a.txt\ntree/sub\ntree/sub/b.txt",
          "explanation": "os.MkdirAll creates a folder and any missing parent folders (0o755 lets everyone enter and read it, only the owner write). os.RemoveAll deletes the tree on exit. WalkDir visits the folder, then its entries in alphabetical order. filepath.ToSlash converts the OS separator to / so the printed output is the same on Windows."
        }
      ],
      "productionNote": "Always build paths with filepath.Join so tools work on Windows, macOS and Linux. For upload directories and any user-supplied file names, never join the name blindly. Use os.Root (Go 1.24 and later) to confine access to one directory, and read its documentation before relying on it.",
      "commonMistakes": [
        "Building paths with string concatenation such as dir + \"/\" + name. It hard-codes the separator and skips cleaning; use filepath.Join.",
        "Using the path package for files on disk. It always uses forward slashes, so it is wrong on Windows. It is meant for URL-style paths.",
        "Joining an untrusted name straight into a directory path. Input like ../secret escapes the folder (path traversal). Validate it, or use os.Root."
      ],
      "sources": [
        {
          "title": "filepath.Join (pkg.go.dev)",
          "url": "https://pkg.go.dev/path/filepath#Join"
        },
        {
          "title": "filepath.WalkDir (pkg.go.dev)",
          "url": "https://pkg.go.dev/path/filepath#WalkDir"
        },
        {
          "title": "os.Root (pkg.go.dev)",
          "url": "https://pkg.go.dev/os#Root"
        }
      ]
    },
    {
      "id": "embed",
      "title": "embed for static files",
      "explanation": "A compiled Go program is normally a single executable, but if it needs a template, a SQL file or a web page at run time, you would have to ship those files next to it. The embed package lets the compiler pack the files inside the executable instead.\n\nYou ask for it with a special comment called a directive: //go:embed followed by a file name. It must sit immediately before a package-level variable declaration (declared outside any function). The variable type decides how you get the data: string for text, []byte for raw bytes, or embed.FS for a read-only virtual folder of many files.\n\nFor string and []byte, the file needs the embed package imported only for its side effect. This is a blank import: writing _ before the import path, as in import _ \"embed\", imports a package without using any of its names. When you use the embed.FS type, you import embed normally.\n\nPatterns can match several files, such as //go:embed static/*. With an embed.FS you read files with its ReadFile(name) method, using forward slashes in names.\n\nThe files are copied at build time, so changing the file afterwards does not change an already built program. Rebuild or go run again to pick up changes.\n\nSetup for the example: in a new folder run go mod init demo, create hello.txt containing the single line Hello from a file! and save the code as embed.go in the same folder.",
      "analogy": "Packing the files inside the suitcase with the program. Instead of leaving notes at the hotel and hoping they are still there, everything the program needs travels in the suitcase and cannot be left behind.",
      "code": [
        {
          "language": "go",
          "filename": "embed.go",
          "source": "package main\n\nimport (\n\t_ \"embed\"\n\t\"fmt\"\n)\n\n//go:embed hello.txt\nvar greeting string\n\nfunc main() {\n\tfmt.Print(greeting)\n}\n",
          "output": "Hello from a file!",
          "explanation": "hello.txt holds Hello from a file! followed by a newline, which Print outputs as is. The directive has no space after //. The compiler reads hello.txt during the build and stores its text in greeting."
        },
        {
          "language": "go",
          "filename": "static.go",
          "source": "package main\n\nimport (\n\t\"embed\"\n\t\"fmt\"\n)\n\n//go:embed static/*\nvar static embed.FS\n\nfunc main() {\n\tdata, err := static.ReadFile(\"static/app.txt\")\n\tif err != nil {\n\t\tfmt.Println(\"read failed:\", err)\n\t\treturn\n\t}\n\tfmt.Print(string(data))\n}\n",
          "output": "app v1",
          "explanation": "Setup: in a separate new folder, run go mod init demo, create a folder named static, and put a file app.txt in it containing app v1 and a newline. The pattern static/* embeds every file in that folder, and static.ReadFile reads one of them from inside the binary."
        }
      ],
      "productionNote": "Embedding is the usual way to ship HTML templates, static web assets and SQL migration files in a single-binary deployment. A later topic uses it for database migrations. Keep embedded files small enough that the binary stays reasonable in size.",
      "commonMistakes": [
        "Writing // go:embed with a space. The comment is then an ordinary comment and the directive is ignored, so the variable stays empty.",
        "Putting another statement or declaration between the directive and the var. Only blank lines and // comments may separate them, so keep the directive directly above the var.",
        "Using .. in a pattern, such as ../config.txt. Embedded files must be in the package's own folder or below it.",
        "Declaring the variable inside a function. Embed variables must be at package level."
      ],
      "sources": [
        {
          "title": "embed package (pkg.go.dev)",
          "url": "https://pkg.go.dev/embed"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "What does io.Copy(dst, src) do?",
      "options": [
        "It reads from any io.Reader and writes to any io.Writer until the reader reports io.EOF",
        "It copies one file to another file only, and fails for anything that is not a file",
        "It loads the whole source into memory and then writes it out in one piece",
        "It renames the source so that it becomes the destination"
      ],
      "answerIndex": 0,
      "explanation": "io.Copy connects any Reader to any Writer and streams the data in chunks until the end, so files, network connections, buffers and HTTP bodies can all be joined."
    },
    {
      "question": "How do you check that os.ReadFile failed because the file does not exist?",
      "options": [
        "Compare err to the string \"not found\"",
        "Check that the returned data has length 0",
        "errors.Is(err, os.ErrNotExist)",
        "Call os.Exists(name) after the failure"
      ],
      "answerIndex": 2,
      "explanation": "The error from a missing file wraps os.ErrNotExist, and errors.Is looks through wrapping to find it. An empty file also gives length 0, so length is not a reliable test."
    },
    {
      "question": "What must you check after a for scanner.Scan() loop finishes?",
      "options": [
        "scanner.Err(), because Scan returns false both at the normal end and on an error",
        "scanner.Close(), because the scanner must be closed to flush its buffer",
        "scanner.Len(), because it tells how many lines were read",
        "Nothing, because Scan panics if anything goes wrong"
      ],
      "answerIndex": 0,
      "explanation": "A false from Scan does not say why the loop ended. scanner.Err() returns nil for a normal end of input and the real error (such as token too long) otherwise."
    },
    {
      "question": "Why use filepath.Join(\"data\", \"report.csv\") instead of \"data\" + \"/\" + \"report.csv\"?",
      "options": [
        "Join is faster because it avoids allocating a string",
        "Join uses the correct separator for the operating system and cleans the result",
        "Join checks that the file exists before returning the path",
        "Join encrypts the path so users cannot guess it"
      ],
      "answerIndex": 1,
      "explanation": "filepath.Join picks the separator of the OS the program runs on (backslash on Windows, slash elsewhere) and tidies doubled separators. It does not touch the disk."
    },
    {
      "question": "Which line correctly embeds hello.txt into a string variable greeting?",
      "options": [
        "// go:embed hello.txt (with a space after //), then var greeting string",
        "//go:embed hello.txt, directly above var greeting string at package level",
        "var greeting string = embed(\"hello.txt\") inside func main",
        "//go:embed ../hello.txt, directly above var greeting string"
      ],
      "answerIndex": 1,
      "explanation": "The directive has no space after //, sits before a package-level variable declaration, and names a file in the package folder or below. A space after //, a declaration inside a function, or .. in the path breaks it."
    }
  ]
});
