window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "01-how-backends-work",
  "order": 1,
  "title": "How Backends Work",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "This topic explains what a program, a runtime, a client, a server and a backend are, and how one HTTP request and response travel between them. You also learn the JSON data format and how to run a TypeScript file with Bun. By the end you know what the course project is: an orders and users REST API (a set of web addresses a program answers) built on Bun and PostgreSQL (a database program).",
  "prerequisites": [],
  "subtopics": [
    {
      "id": "what-a-program-is",
      "title": "What a program is",
      "explanation": "A program is an ordered list of instructions that a computer follows from the top down. The text you write to describe those instructions is called source code, and it is stored in a file (a named document on your disk). Each single instruction is a statement. Whatever the program prints or returns when it runs is its output.\n\nTo run programs you use a terminal: a text window where you type commands and read the replies. In this course you will create a file, for example hello.ts, in a folder on your computer. You then open a terminal in that folder (in most code editors there is a menu item such as New Terminal, which opens it in the project folder) and type a command such as `bun run hello.ts`. Sub-topic 5 explains this command fully.\n\nThe example below has two statements. `console.log(...)` means \"print one line of text to the terminal\" (the course covers it properly in the next topic). Text inside double quotes is a string, which is a piece of text the program treats as plain characters.\n\nThe computer reads the file from the first line to the last. It never reorders or guesses. If a line is broken, for example a quote is missing, the computer stops and reports an error, which is a message saying the program cannot continue and why.",
      "analogy": "A program is a recipe card. The steps are in order, and the cook (the computer) follows them exactly, with no guessing and no skipping ahead. If the recipe has a typo the cook cannot understand, the cook stops and tells you (an error). The text on the card is the source code. The meal that comes out of the kitchen is the running program and its output.",
      "code": [
        {
          "language": "typescript",
          "filename": "hello.ts",
          "source": "console.log(\"Kitchen open\");\nconsole.log(\"Orders: 0\");\n",
          "output": "Kitchen open\nOrders: 0",
          "explanation": "Two statements, each ending with a semicolon. The computer runs the first one, then the second, so the lines appear in exactly that order. The quotes are not printed; they only mark where the text starts and ends."
        }
      ],
      "productionNote": "Every backend service is just a program that never stops: after it starts, it keeps waiting for requests instead of reaching its last line and ending. Later topics build that long-running program step by step.",
      "commonMistakes": [
        "Expecting lines to run in some order other than top to bottom. They always run in the order written (until later topics introduce ways to change that).",
        "Forgetting the quotes around text. Without quotes the computer tries to read the words as instructions and reports an error."
      ],
      "sources": [
        { "title": "MDN: What is JavaScript?", "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/What_is_JavaScript" }
      ]
    },
    {
      "id": "bun-as-a-runtime",
      "title": "Bun as a JavaScript/TypeScript runtime",
      "explanation": "JavaScript is a programming language. TypeScript is JavaScript plus type labels: small notes such as \"this value is a number\" that your code editor (the program you write code in) uses to warn you about mistakes. A runtime is a program that reads your code and carries out its instructions on your computer.\n\nBun is a runtime for JavaScript and TypeScript. It is also a package manager (a tool that downloads and installs code libraries written by other people) and a test runner (a tool that runs automatic checks on your code), all in one program. Bun runs `.ts` files directly: it removes the type labels and then runs the rest, with no separate build step. This course uses Bun 1.4.5.\n\nImportant: Bun does not check types when it runs your file. Type checking is done by your editor or by `tsc` (TypeScript's own checking command). A file that has a type mistake still runs in Bun.\n\nBun gives your code a built-in global object called `Bun`. A global object is a named bundle of ready-made features that you can use anywhere without setting anything up. For example, `Bun.version` holds the version text of the running Bun.",
      "analogy": "The language is sheet music, and the runtime is the musician who plays it. Bun is one musician who also tunes the instruments (package manager) and runs the rehearsals (test runner). A browser is a musician playing in a concert hall for web pages, while Bun is a musician in a studio, working on servers and scripts. The musician plays the notes exactly as written and never checks the sheet music, so a wrong note is still played; your editor or tsc is the proofreader who catches it.",
      "code": [
        {
          "language": "typescript",
          "filename": "runtime.ts",
          "source": "console.log(Bun.version);\n",
          "output": "1.4.5",
          "explanation": "Bun.version is the version of the Bun program running this file. On the course's Bun 1.4.5 it prints 1.4.5."
        }
      ],
      "productionNote": "In this course Bun runs the API server, the database migration scripts (files that change the database structure) and the tests, so one tool covers the whole project.",
      "commonMistakes": [
        "Thinking Bun checks types when it runs a file. It strips the type labels, so a type mistake still runs. Rely on your editor or `tsc` to catch them.",
        "Confusing JavaScript with Java. They are different languages that only share part of a name."
      ],
      "sources": [
        { "title": "Bun documentation", "url": "https://bun.com/docs" },
        { "title": "Bun: TypeScript", "url": "https://bun.com/docs/runtime/typescript" }
      ]
    },
    {
      "id": "clients-servers-http",
      "title": "Clients, servers and HTTP requests/responses",
      "explanation": "A client is a program that asks for something, such as a browser, a mobile app or the command-line tool curl. A server is a program that waits for questions and answers them. A backend is the server-side part of an application: the server program plus the database it reads and writes. A database is a program that stores data in an organised way so it survives restarts.\n\nClient and server talk using HTTP, an agreed format for messages. A request is the client's message. It has a method (the action wanted), a path (which thing it concerns), headers and sometimes a body.\n\nMethods: GET reads data, POST creates data, PATCH updates part of something, PUT replaces something completely, DELETE removes something.\n\nThe path is the part of the address after the host name, like `/orders/42`. A query string is optional extra filters after a question mark, like `?status=paid`. Headers are lines of `key: value` metadata, such as `Content-Type: application/json`, which says the body is JSON. The body is the data being sent, for example the details of a new order.\n\nThe response is the server's reply. It has a status code (a number saying how it went), headers and often a body. Common codes: 200 OK, 201 Created, 400 Bad Request (the client sent something invalid), 401 Unauthorized (the client has not proved who it is), 404 Not Found, and 500 Internal Server Error (the server failed).\n\nREST is a naming convention for APIs (an API is the set of requests a program offers to other programs). URLs name things, such as `/orders`, and the method names the action on them. The code block below is plain text, not a program. It shows a raw request and the raw response. In the raw text, `POST /orders HTTP/1.1` is the method, the path and the HTTP version. `Host` is a header naming the server. The blank line separates headers from the body.",
      "analogy": "A restaurant. The customer (client) gives the waiter an order slip: the dish is the path, the action is the method, special notes are headers, and extra details are the body. The kitchen (server) sends back a plate plus a note such as \"served\" or \"out of stock\", which is the response body and its status code. The database is the pantry that the kitchen reads from. Customers never walk into the pantry themselves.",
      "code": [
        {
          "language": "http",
          "filename": "request.txt",
          "source": "POST /orders HTTP/1.1\nHost: localhost:3000\nContent-Type: application/json\n\n{\"productId\": 7, \"quantity\": 2}\n\nHTTP/1.1 201 Created\nContent-Type: application/json\n\n{\"id\": 101, \"status\": \"pending\", \"totalCents\": 4998}\n",
          "output": "",
          "explanation": "The first part is the request: method POST, path /orders, two headers, a blank line, then a JSON body asking for 2 units of product 7. The second part is the response: status 201 Created (the order was made), a header, a blank line, then a JSON body with the new order's id, its status and its total in cents. The status code is on the first line of the response, never inside the body."
        }
      ],
      "productionNote": "Every endpoint (one method plus path that the server answers) you build from topic 08 on is exactly one request and response pair like this one.",
      "commonMistakes": [
        "Using GET to change data. GET is for reading only; use POST, PATCH, PUT or DELETE to change things.",
        "Treating 200 as the only success code. 201 means created, and other 2xx codes also mean success.",
        "Thinking the status code lives in the body. It is a separate part of the response, on the first line."
      ],
      "sources": [
        { "title": "MDN: An overview of HTTP", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview" },
        { "title": "MDN: HTTP response status codes", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status" }
      ]
    },
    {
      "id": "json-data-format",
      "title": "JSON as the data format",
      "explanation": "JSON is a text format for data that nearly every programming language can read and write. It has a small number of building blocks. An object is a group of named values written as `{ \"key\": value }`. An array is an ordered list written as `[ 1, 2, 3 ]`. Values can be strings in double quotes, numbers, `true` or `false`, or `null` (meaning \"no value\"). Topic 04 covers objects and arrays in depth.\n\nJSON is strict. Keys must be in double quotes, single quotes are not allowed, there is no trailing comma after the last item, and comments are not allowed.\n\nIn TypeScript, `JSON.stringify(value)` turns a value into JSON text, and `JSON.parse(text)` reads JSON text and gives back a value. To parse means to read text and turn it into a structure the program can use. In the example, `const` just means \"give this value a name\" (topic 02 explains it). Writing `back.status` reads the `status` entry of the object named `back`.\n\nIf the text breaks the JSON rules, `JSON.parse` throws a `SyntaxError`, which is an error raised when text does not follow the format rules.",
      "analogy": "JSON is a standard shipping form. Every courier, whatever language they speak, reads the same boxes in the same places, and the strict layout means nothing is misread. `JSON.stringify` is filling in the form, and `JSON.parse` is reading a completed form.",
      "code": [
        {
          "language": "typescript",
          "filename": "json.ts",
          "source": "const text = JSON.stringify({ id: 101, status: \"pending\", items: [7, 9] });\nconsole.log(text);\n\nconst back = JSON.parse(text);\nconsole.log(back.status);\n",
          "output": "{\"id\":101,\"status\":\"pending\",\"items\":[7,9]}\npending",
          "explanation": "stringify turns the object into one line of JSON text with no extra spaces, and that is the first line printed. parse turns the text back into an object, so back.status is the string pending, printed without quotes by console.log."
        }
      ],
      "productionNote": "Request bodies and response bodies of the API are JSON. Topic 16 also stores JSON inside the database, in a column type called JSONB.",
      "commonMistakes": [
        "Using single quotes, such as {'id': 1}. JSON needs double quotes around keys and strings.",
        "Leaving a trailing comma, such as [1, 2,]. JSON.parse then throws a SyntaxError."
      ],
      "sources": [
        { "title": "MDN: Working with JSON", "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/JSON" },
        { "title": "MDN: JSON.parse()", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse" }
      ]
    },
    {
      "id": "running-with-bun-run",
      "title": "Running a file with bun run",
      "explanation": "To run a file, first save it, for example as order-total.ts. Then open a terminal in the folder that contains the file (in most editors: New Terminal) and type `bun run order-total.ts`. The shorter `bun order-total.ts` does the same thing. The output appears in the terminal, and the program ends when its last line has run.\n\nIf the program has an error, it stops and prints a message that includes the file and line number where it went wrong.\n\nDuring development, `bun --watch order-total.ts` runs the file again every time you save a change, which saves retyping the command. Installing Bun and PostgreSQL is not covered in this course. Bun 1.4.5 and PostgreSQL 19.0 are assumed to be installed already. To check that Bun is ready, type `bun --version` in the terminal. A version number such as 1.4.5 means it works. How to install Bun and PostgreSQL is not covered here.\n\nThe example also shows how this course stores money: as whole numbers of cents (2499 means 24.99). Whole numbers avoid the rounding surprises that decimal fractions can cause.",
      "analogy": "Pressing play on a recording. `bun run` is the play button, and `--watch` is a player that restarts the recording automatically each time you edit the tape.",
      "code": [
        {
          "language": "typescript",
          "filename": "order-total.ts",
          "source": "const priceCents = 2499;\nconst quantity = 2;\nconsole.log(\"Total cents:\", priceCents * quantity);\n",
          "output": "Total cents: 4998",
          "explanation": "The two const lines name the price and the quantity. The * sign multiplies them: 2499 times 2 is 4998. console.log prints its two arguments on one line separated by a space."
        },
        {
          "language": "bash",
          "filename": "terminal",
          "source": "bun run order-total.ts\n",
          "output": "Total cents: 4998",
          "explanation": "Type this in a terminal opened in the folder that holds order-total.ts. The line after the command is what the program printed."
        }
      ],
      "productionNote": "Later you start the API with `bun run src/index.ts`, and you run database migrations with `bun run migrate` (topic 14).",
      "commonMistakes": [
        "Running the command from the wrong folder. Bun then cannot find the file and prints a file-not-found error. Open the terminal in the folder with the file, or include the path.",
        "Leaving off the .ts extension. Write the full file name, such as order-total.ts."
      ],
      "sources": [
        { "title": "Bun: bun run", "url": "https://bun.com/docs/cli/run" },
        { "title": "Bun: Watch mode", "url": "https://bun.com/docs/runtime/hot" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "A browser sends a request to a program that reads from a database and replies. Which description is correct?",
      "options": [
        "The browser is the server and the program is the client.",
        "The browser is the client and the program is the server.",
        "Both are clients because both use HTTP.",
        "The database is the client and the browser is the server."
      ],
      "answerIndex": 1,
      "explanation": "The client is the program that asks (the browser). The server is the program that answers (here, the backend that reads from the database)."
    },
    {
      "question": "Which HTTP method and status code fit \"a new order was created successfully\"?",
      "options": [
        "POST and 201",
        "GET and 200",
        "DELETE and 404",
        "PATCH and 500"
      ],
      "answerIndex": 0,
      "explanation": "POST creates data, and 201 Created reports that something new was made. GET only reads, 404 means not found, and 500 means the server failed."
    },
    {
      "question": "Is {'id': 1,} valid JSON?",
      "options": [
        "Yes, JSON allows single quotes.",
        "Yes, as long as the trailing comma is kept.",
        "No, because JSON needs double quotes and does not allow the trailing comma.",
        "No, because JSON objects cannot contain numbers."
      ],
      "answerIndex": 2,
      "explanation": "JSON requires double-quoted keys and strings and forbids trailing commas. Numbers are allowed as values."
    },
    {
      "question": "order-total.ts has priceCents = 1000 and quantity = 3, and the final line is console.log(\"Total cents:\", priceCents * quantity). What does bun run order-total.ts print?",
      "options": [
        "Total cents: 1003",
        "Total cents: 13",
        "Total cents: priceCents * quantity",
        "Total cents: 3000"
      ],
      "answerIndex": 3,
      "explanation": "1000 multiplied by 3 is 3000, and console.log prints the label, a space, then the result."
    },
    {
      "question": "A TypeScript file contains a type mistake. What does Bun do when you run it with bun run?",
      "options": [
        "It refuses to start and reports the type mistake.",
        "It strips the types and runs the file; checking types is the job of your editor or tsc.",
        "It deletes the faulty line and runs the rest.",
        "It converts the file to Java first."
      ],
      "answerIndex": 1,
      "explanation": "Bun removes type labels without checking them, so a type mistake still runs. Use your editor or tsc to find those mistakes."
    }
  ]
});
