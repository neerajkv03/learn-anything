window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "20-auth",
  "order": 20,
  "title": "Authentication & Authorization",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Learn how a backend proves who is calling (authentication) and decides what that caller may touch (authorization). You will hash passwords with Bun.password, build signup and login endpoints, keep users signed in with hashed session tokens in an HttpOnly cookie (a cookie that page scripts cannot read), sign and verify a JWT (a signed token) with Web Crypto (the built-in, browser-standard crypto toolkit), and protect routes so users only see their own orders.",
  "prerequisites": ["19-validation-errors"],
  "subtopics": [
    {
      "id": "password-hashing",
      "title": "Password hashing with Bun.password",
      "explanation": "Two words are easy to mix up. Authentication answers \"who are you?\" (proving identity, for example with a password). Authorization answers \"what are you allowed to do?\" (for example, reading only your own orders). Authentication always comes first, because you cannot decide what someone may do before you know who they are.\n\nA backend must never store passwords themselves. If the database leaks, every user's password would leak with it, and many people reuse passwords on other sites. Instead you store a hash: the output of a one-way function (a function you can run forwards but not backwards). Hashing is not encryption. Encryption is reversible if you have the key; a good password hash has no key and no way back.\n\nA password hash must be slow on purpose, so an attacker who steals the table cannot try billions of guesses per second. It must also be salted. A salt is a random value mixed into each hash, so two users with the same password get different hashes and precomputed guess tables are useless. Fast hashes such as SHA-256 (a standard fingerprint function that runs very quickly) are the wrong tool here, because their speed helps the attacker.\n\nBun has this built in as `Bun.password`. `await Bun.password.hash(password)` returns a string (the default algorithm is argon2, a modern slow password-hashing algorithm). That string already contains the algorithm name, its settings and the random salt, for example `$argon2id$v=19$m=...`. So the only thing you store is that one string, for example in the `users.password_hash` column from topic 11.\n\n`await Bun.password.verify(password, hash)` returns `true` or `false`. It reads the algorithm and salt out of the stored string, hashes the candidate password the same way, and compares the results safely. You never compare hashes yourself with `===`.\n\nBoth functions are asynchronous (they return a Promise you `await`), so the server can keep answering other requests while the hash is computed. Bun also has blocking versions, `hashSync` and `verifySync`. Avoid them inside request handlers, because they freeze the whole server while they run.\n\nYou can pass options. For argon2 the useful ones are `algorithm` (`\"argon2id\"` is the recommended variant), `memoryCost` (memory used, in KiB) and `timeCost` (number of passes).\n\nBun also supports bcrypt, an older but still accepted algorithm, with a `cost` option.\n\nIn Bun 1.4 an argon2 `memoryCost` below 8 is rejected, and invalid cost values throw an error instead of being silently changed. Hashes made earlier with lower settings still verify. For most apps the defaults are a sound choice.\n\nFinally, set a password policy on length: at least 8 characters and at most 128. The upper limit matters, because hashing is deliberately expensive and an attacker could otherwise send megabytes of text as a password to waste your CPU.",
      "analogy": "Think of a meat grinder. It is easy to turn a steak into mince, but impossible to turn the mince back into the steak. To check a customer's steak later, you grind it the same way and compare the mince. The salt is a secret spice added per customer: two identical steaks give different mince, so someone who steals the mince cannot match it against a catalogue of ground steaks. Slow hashing is a grinder that takes a full second per steak, which is nothing for one customer and hopeless for a thief trying a billion steaks.",
      "code": [
        {
          "language": "typescript",
          "filename": "hash-demo.ts",
          "source": "const h1 = await Bun.password.hash(\"correct horse\");\nconst h2 = await Bun.password.hash(\"correct horse\");\n\n// The string starts with the algorithm name; two hashes of the same password differ (random salt).\nconsole.log(h1.startsWith(\"$argon2\"), h1 === h2);\n\n// verify() reads the salt out of the hash, so it still recognises the right password.\nconsole.log(\n  await Bun.password.verify(\"correct horse\", h1),\n  await Bun.password.verify(\"wrong\", h1),\n);",
          "output": "true false\ntrue false",
          "explanation": "Run it with `bun run hash-demo.ts`. The two hashes of the same password are different strings because each gets its own random salt, yet verify() returns true for the right password and false for the wrong one. You never store the password, only the hash string."
        },
        {
          "language": "typescript",
          "filename": "hash-options.ts",
          "source": "const strong = await Bun.password.hash(\"correct horse\", {\n  algorithm: \"argon2id\",\n  memoryCost: 19456, // KiB of memory (about 19 MiB)\n  timeCost: 2, // number of passes\n});\nconst older = await Bun.password.hash(\"correct horse\", { algorithm: \"bcrypt\", cost: 10 });\n\nconsole.log(strong.startsWith(\"$argon2id$\"), older.startsWith(\"$2\"));\n\n// verify() works out the algorithm from each hash string itself.\nconsole.log(\n  await Bun.password.verify(\"correct horse\", strong),\n  await Bun.password.verify(\"correct horse\", older),\n);",
          "output": "true true\ntrue true",
          "explanation": "The options object picks the algorithm and its cost. Notice that verify() needs no options: the settings are stored inside the hash string, so you can change your settings later and old hashes still verify."
        }
      ],
      "productionNote": "Store only the hash string in `users.password_hash`. Use the async functions in handlers, enforce the 8 to 128 character policy before hashing, and never log request bodies that contain passwords. If you later raise the cost settings, old hashes keep working because each hash records its own settings.",
      "commonMistakes": [
        "Using a fast hash such as SHA-256 for passwords. Fast is exactly what an attacker wants; use Bun.password.hash instead.",
        "Logging the request body or the password while debugging, so plain passwords end up in log files.",
        "Comparing a freshly computed hash with the stored one using `===`. Each hash has a random salt, so it never matches; call Bun.password.verify.",
        "Calling hashSync or verifySync inside a request handler, which blocks the whole server while it computes."
      ],
      "sources": [
        { "title": "Bun docs: Hashing (Bun.password)", "url": "https://bun.com/docs/api/hashing" },
        { "title": "OWASP Password Storage Cheat Sheet", "url": "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html" }
      ]
    },
    {
      "id": "signup-login",
      "title": "Signup & login flows",
      "explanation": "Signup creates an account. Steps: validate the input, hash the password, insert the row. Normalise the email first (trim spaces and lower-case it), otherwise `Dee@Example.com` and `dee@example.com` become two different accounts. Validate that the name is 1 to 100 characters and the password is 8 to 128 characters.\n\nThe `users.email` column has a UNIQUE constraint (topic 11). If the email already exists, PostgreSQL reports SQLSTATE `23505` (the error code for a unique violation). The auth service catches it and throws a `ConflictError` with the code `EMAIL_TAKEN`, so the client gets a clear `409` response. This is a deliberate trade-off: signup does reveal that an email is taken, because the person needs to know to pick another one. Login must never reveal it. The code below assumes the error classes and helpers from topic 19: `ValidationError`, `UnauthorizedError` and `ConflictError` accept a message plus an optional code override, `ValidationError` also takes a list of field errors, and `isRecord` checks that a value is a plain object. Adjust the import paths to wherever you put them. In src/errors.ts from topic 19, write `export type FieldError = { field: string; message: string };` so this import works.\n\nLogin looks up the user by email and calls `Bun.password.verify`. The important security rule is that the client must not be able to tell whether the email exists. If you answered \"no such user\" for unknown emails and \"wrong password\" for known ones, an attacker could test thousands of emails and learn which have accounts. This is called account enumeration (discovering which accounts exist by comparing responses).\n\nTwo things prevent it. First, both failures return the identical `401` response with the code `INVALID_CREDENTIALS` and the message `invalid email or password`. Second, timing: hashing is slow, so if an unknown email skipped the hash check, it would answer much faster and give itself away. So when no user is found, the service still runs `verify` against a precomputed dummy hash. That keeps the work about equal.\n\nThe service never returns the `password_hash` column. It uses rest destructuring (topic 4) to pull `password_hash` out of the row and returns the remaining fields, so the hash cannot leak into a response by accident.\n\nIn a real production system you would also add rate limiting (refusing a client that sends too many attempts); that is outside this course, but never ship a login endpoint without it. Note that login here only checks the credentials. The next sub-topic adds the session that keeps the user signed in.",
      "analogy": "Picture a hotel key desk. When a stranger asks for a room, the clerk says \"those details don't match\" whether the room doesn't exist or the name is wrong, and takes the same amount of time to check either way. A stranger therefore cannot probe the desk to learn which rooms are occupied and by whom. Checking in as a new guest is different: if the name is already in the register, the clerk says so, because the new guest needs to know to choose another.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/services/auth.service.ts",
          "source": "import { SQL } from \"bun\";\nimport { ConflictError, UnauthorizedError, ValidationError } from \"../errors.ts\";\nimport type { FieldError } from \"../errors.ts\";\nimport { isRecord } from \"../validation/common.ts\";\n\nexport type PublicUser = { id: string; email: string; name: string };\ntype UserRow = PublicUser & { password_hash: string };\n\n// Computed once when the module loads. Used to keep login timing equal for unknown emails.\nconst DUMMY_HASH = await Bun.password.hash(\"not-a-real-password\");\n\nfunction parseSignup(body: unknown): { email: string; name: string; password: string } {\n  const raw: Record<string, unknown> = isRecord(body) ? body : {};\n  const email = typeof raw.email === \"string\" ? raw.email.trim().toLowerCase() : \"\";\n  const name = typeof raw.name === \"string\" ? raw.name.trim() : \"\";\n  const password = typeof raw.password === \"string\" ? raw.password : \"\";\n\n  const details: FieldError[] = [];\n  // Simple shape check: something@something.something, no spaces.\n  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {\n    details.push({ field: \"email\", message: \"must be a valid email address\" });\n  }\n  if (name.length < 1 || name.length > 100) {\n    details.push({ field: \"name\", message: \"must be 1-100 characters\" });\n  }\n  if (password.length < 8 || password.length > 128) {\n    details.push({ field: \"password\", message: \"must be 8-128 characters\" });\n  }\n  if (details.length > 0) throw new ValidationError(\"invalid signup data\", details);\n  return { email, name, password };\n}\n\nfunction parseLogin(body: unknown): { email: string; password: string } {\n  const raw: Record<string, unknown> = isRecord(body) ? body : {};\n  const email = typeof raw.email === \"string\" ? raw.email.trim().toLowerCase() : \"\";\n  const password = typeof raw.password === \"string\" ? raw.password : \"\";\n  // Signup caps passwords at 128 characters, so a longer one can never be correct.\n  // Replace it with \"\" so we never spend time hashing huge input; it simply fails.\n  return { email, password: password.length <= 128 ? password : \"\" };\n}\n\nexport function createAuthService(db: SQL) {\n  return {\n    async signup(body: unknown): Promise<PublicUser> {\n      const { email, name, password } = parseSignup(body);\n      const passwordHash = await Bun.password.hash(password);\n      try {\n        const rows: PublicUser[] = await db`\n          INSERT INTO users (email, name, password_hash)\n          VALUES (${email}, ${name}, ${passwordHash})\n          RETURNING id, email, name`;\n        const user = rows[0];\n        if (!user) throw new Error(\"insert returned no row\");\n        return user;\n      } catch (err) {\n        if (err instanceof SQL.PostgresError && err.errno === \"23505\") {\n          throw new ConflictError(\"email already registered\", \"EMAIL_TAKEN\");\n        }\n        throw err;\n      }\n    },\n\n    async login(body: unknown): Promise<PublicUser> {\n      const { email, password } = parseLogin(body);\n      const rows: UserRow[] = await db`\n        SELECT id, email, name, password_hash FROM users WHERE email = ${email}`;\n      const row = rows[0];\n\n      // Always run verify, even for an unknown email, so both paths take similar time.\n      const matches = await Bun.password.verify(password, row?.password_hash ?? DUMMY_HASH);\n      if (!row || !matches) {\n        throw new UnauthorizedError(\"invalid email or password\", \"INVALID_CREDENTIALS\");\n      }\n\n      // Rest destructuring: `user` holds everything except password_hash.\n      const { password_hash, ...user } = row;\n      return user;\n    },\n  };\n}",
          "output": "",
          "explanation": "This file is part of the project, so it prints nothing by itself. `createAuthService(db)` is a factory (topic 18): it receives the database client and returns the two functions. In the `catch` block, `err.errno` holds the SQLSTATE code, and 23505 means the email is already taken. Both failure paths of `login` throw the exact same error, and `verify` always runs."
        },
        {
          "language": "typescript",
          "filename": "src/routes/auth.routes.ts",
          "source": "// Excerpt: the signup and login entries of the routes object.\n// json(data, status) and readJson(req) are the helpers from topics 8 and 19.\n\"/auth/signup\": {\n  POST: handle(async (req) => {\n    const user = await auth.signup(await readJson(req));\n    return json(user, 201);\n  }),\n},\n\"/auth/login\": {\n  POST: handle(async (req) => {\n    const user = await auth.login(await readJson(req));\n    return json(user); // the next sub-topic adds the session cookie here\n  }),\n},",
          "output": "",
          "explanation": "The route handlers stay thin: read the JSON body, call the service, build the response. Any error the service throws is turned into the right JSON error response by the handle() wrapper from topic 19. This is an excerpt of an object literal, so it is not a standalone file."
        },
        {
          "language": "bash",
          "filename": "signup-login.sh",
          "source": "# Start the server in one terminal: bun run src/index.ts\n# Then, in a second terminal:\ncurl -s -w \"\\n%{http_code}\\n\" -X POST http://localhost:3000/auth/signup -H \"Content-Type: application/json\" -d '{\"email\":\" Dee@Example.com \",\"name\":\"Dee\",\"password\":\"s3cure-pass\"}'\n\n# Same request again\ncurl -s -w \"\\n%{http_code}\\n\" -X POST http://localhost:3000/auth/signup -H \"Content-Type: application/json\" -d '{\"email\":\"dee@example.com\",\"name\":\"Dee\",\"password\":\"s3cure-pass\"}'\n\n# Wrong password, then unknown email\ncurl -s -w \"\\n%{http_code}\\n\" -X POST http://localhost:3000/auth/login -H \"Content-Type: application/json\" -d '{\"email\":\"dee@example.com\",\"password\":\"nope-nope\"}'\ncurl -s -w \"\\n%{http_code}\\n\" -X POST http://localhost:3000/auth/login -H \"Content-Type: application/json\" -d '{\"email\":\"ghost@example.com\",\"password\":\"nope-nope\"}'",
          "output": "{\"id\":\"4\",\"email\":\"dee@example.com\",\"name\":\"Dee\"}\n201\n{\"error\":{\"code\":\"EMAIL_TAKEN\",\"message\":\"email already registered\"}}\n409\n{\"error\":{\"code\":\"INVALID_CREDENTIALS\",\"message\":\"invalid email or password\"}}\n401\n{\"error\":{\"code\":\"INVALID_CREDENTIALS\",\"message\":\"invalid email or password\"}}\n401",
          "explanation": "The `-w` option makes curl print the status code after the body. The first request stores Dee with the email trimmed and lower-cased. Repeating it gives 409. The last two requests (a wrong password for a real user, and an unknown email) return byte-for-byte identical bodies, so a stranger learns nothing about which accounts exist."
        }
      ],
      "productionNote": "Return the same generic error for every login failure, keep `password_hash` out of every response, and put rate limiting in front of login and signup in production. Rely on the database UNIQUE constraint, not a \"check then insert\" query, to detect duplicate emails, because two simultaneous signups could both pass a check.",
      "commonMistakes": [
        "Returning different messages (or status codes) for \"no such user\" and \"wrong password\". That lets attackers list which emails have accounts.",
        "Skipping the password check when the email is unknown, which makes unknown emails answer noticeably faster.",
        "Not normalising emails, so `Dee@Example.com` and `dee@example.com` become separate accounts.",
        "Sending the whole database row back to the client, including password_hash."
      ],
      "sources": [
        { "title": "OWASP Authentication Cheat Sheet", "url": "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html" },
        { "title": "Bun docs: Hashing (Bun.password)", "url": "https://bun.com/docs/api/hashing" }
      ]
    },
    {
      "id": "sessions-cookies",
      "title": "Session tokens in a sessions table & cookies",
      "explanation": "After a successful login, the server must remember the user, because HTTP is stateless (each request stands alone). The approach used in this course is a server-side session. On login the server creates a long random string called a session token. The client sends it back on every request, and the server looks it up in the database to find out who is calling.\n\nThe token must be unguessable. Generate 32 random bytes with `crypto.getRandomValues` (the secure random source from topic 7) and encode them as base64url (text made only of letters, digits, `-` and `_`, safe in cookies and URLs). 32 bytes become exactly 43 characters.\n\nDo not store the raw token. Store its SHA-256 hash (a fixed-length fingerprint), computed with `new Bun.CryptoHasher(\"sha256\").update(token).digest(\"hex\")`. If your database leaks, the attacker gets only fingerprints, which cannot be used as tokens. A fast hash is fine here, unlike for passwords, because a token is 256 random bits and cannot be guessed or looked up in a dictionary.\n\nCreate the table with a new migration, `migrations/0006_create_sessions.sql` (run your migration runner from topic 14 afterwards). The token hash is the primary key, so lookups are fast. `ON DELETE CASCADE` removes a user's sessions automatically if the user is deleted. The index on `user_id` helps when you want to list or revoke all sessions of one user.\n\nThe server sends the raw token to the browser in a cookie, a small named value that the browser stores and automatically attaches to later requests to the same site. You set it with a `Set-Cookie` response header. Its flags matter:\n\n- `HttpOnly`: JavaScript running in the page cannot read the cookie, so an XSS attack (cross-site scripting, where an attacker gets their own script to run inside your page) cannot steal it.\n- `Secure`: the browser only sends it over HTTPS.\n- `SameSite=Lax`: the browser does not attach it to most requests started by other sites, which defends against CSRF (cross-site request forgery, where another site tricks your browser into sending a request with your cookie).\n- `Path=/`: valid for the whole site.\n- `Max-Age=604800`: expires after 604800 seconds (7 days).\n\nThe code builds the `Set-Cookie` string explicitly, so that every flag, including `SameSite`, is visible and under your control. To read the cookie on later requests, use `req.cookies.get(\"session\")`, which Bun provides on requests handled by `routes`. It returns the cookie's value, or a falsy value if the cookie is missing (so `token ? ... : ...` works).\n\nThe lookup joins `sessions` to `users` and requires `expires_at > now()`, so expired sessions are ignored. Logout deletes the row (the token stops working immediately) and sends a cookie with the same name, an empty value and `Max-Age=0`, which tells the browser to delete it.\n\nA note for local development: browsers may refuse `Secure` cookies on plain `http://` addresses. They normally treat `localhost` as an exception, so it works there, but a plain-http address such as a LAN IP may silently drop the cookie. Use HTTPS in production.",
      "analogy": "A cloakroom ticket. You hand over your coat and get a numbered ticket (the token). The cloakroom keeps only a matching stub (the hash) next to your coat (your session). Lose the ticket and you lose access. Staff can tear up the stub at any moment, so your ticket stops working (logout or revoking a session). Someone who steals the stub book from the cloakroom (the database) cannot make a working ticket from it.",
      "code": [
        {
          "language": "typescript",
          "filename": "token-demo.ts",
          "source": "// 32 random bytes -> 43 base64url characters (no padding).\nconst bytes = crypto.getRandomValues(new Uint8Array(32));\nconst token = Buffer.from(bytes).toString(\"base64url\");\n\n// Only this fingerprint goes into the database.\nconst hash = new Bun.CryptoHasher(\"sha256\").update(token).digest(\"hex\");\nconst again = new Bun.CryptoHasher(\"sha256\").update(token).digest(\"hex\");\n\nconsole.log(token.length, hash.length, hash === again);",
          "output": "43 64 true",
          "explanation": "The token text itself is random, so the demo prints only facts that never change: the token is 43 characters, the SHA-256 hex hash is 64 characters, and hashing the same token twice gives the same hash. That last fact is why a lookup by hash works."
        },
        {
          "language": "sql",
          "filename": "migrations/0006_create_sessions.sql",
          "source": "CREATE TABLE sessions (\n  token_hash text PRIMARY KEY,\n  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  expires_at timestamptz NOT NULL,\n  created_at timestamptz NOT NULL DEFAULT now()\n);\n\nCREATE INDEX sessions_user_id_idx ON sessions (user_id);",
          "output": "",
          "explanation": "Save this as a new numbered file in the migrations folder and run your migration runner (`bun run scripts/migrate.ts`). It records the file in schema_migrations so it never runs twice."
        },
        {
          "language": "typescript",
          "filename": "src/auth/sessions.ts",
          "source": "import { SQL } from \"bun\";\n\nexport type AuthUser = { id: string; email: string; name: string };\n\nconst SESSION_SECONDS = 604800; // 7 days\n\nexport function hashToken(token: string): string {\n  return new Bun.CryptoHasher(\"sha256\").update(token).digest(\"hex\");\n}\n\nexport function sessionCookie(token: string): string {\n  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`;\n}\n\nexport const clearedSessionCookie = \"session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0\";\n\nexport function createSessionService(db: SQL) {\n  return {\n    // Returns the RAW token (for the cookie). Only its hash is stored.\n    async create(userId: string): Promise<string> {\n      const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(\"base64url\");\n      await db`\n        INSERT INTO sessions (token_hash, user_id, expires_at)\n        VALUES (${hashToken(token)}, ${userId}, now() + interval '7 days')`;\n      return token;\n    },\n\n    // Returns the user for a valid, unexpired token, otherwise null.\n    async find(token: string): Promise<AuthUser | null> {\n      const rows: AuthUser[] = await db`\n        SELECT u.id, u.email, u.name\n        FROM sessions s\n        JOIN users u ON u.id = s.user_id\n        WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > now()`;\n      return rows[0] ?? null;\n    },\n\n    async remove(token: string): Promise<void> {\n      await db`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;\n    },\n  };\n}",
          "output": "",
          "explanation": "A project file that prints nothing itself. `create` stores the hash and returns the raw token. `find` compares the hash of the incoming token with the stored hashes and ignores expired rows. `remove` is logout. The 604800 seconds in the cookie and the `interval '7 days'` in SQL describe the same 7-day lifetime."
        },
        {
          "language": "typescript",
          "filename": "src/routes/auth.routes.ts",
          "source": "// Excerpt: login now creates a session; /auth/me and logout read the cookie.\n// UnauthorizedError is the topic 19 class; `sessions` comes from createSessionService(db).\n\"/auth/login\": {\n  POST: handle(async (req) => {\n    const user = await auth.login(await readJson(req));\n    const token = await sessions.create(user.id);\n    const res = json(user);\n    res.headers.append(\"Set-Cookie\", sessionCookie(token));\n    return res;\n  }),\n},\n\"/auth/me\": {\n  GET: handle(async (req: BunRequest<\"/auth/me\">) => {\n    const token = req.cookies.get(\"session\");\n    const user = token ? await sessions.find(token) : null;\n    if (!user) throw new UnauthorizedError(\"login required\");\n    return json(user);\n  }),\n},\n\"/auth/logout\": {\n  POST: handle(async (req: BunRequest<\"/auth/logout\">) => {\n    const token = req.cookies.get(\"session\");\n    if (token) await sessions.remove(token);\n    return new Response(null, { status: 204, headers: { \"Set-Cookie\": clearedSessionCookie } });\n  }),\n},",
          "output": "",
          "explanation": "Login now appends the Set-Cookie header to the response. `BunRequest` is Bun's request type that has the `cookies` property; import it with `import type { BunRequest } from \"bun\"`. Logout returns 204 (success, no body) together with the cookie that clears itself. This is an excerpt of a routes object, not a standalone file."
        },
        {
          "language": "bash",
          "filename": "session-flow.sh",
          "source": "# -c jar.txt saves cookies the server sets; -b jar.txt sends them back.\ncurl -i -s -w \"\\n\" -c jar.txt -X POST http://localhost:3000/auth/login -H \"Content-Type: application/json\" -d '{\"email\":\"dee@example.com\",\"password\":\"s3cure-pass\"}'\n\ncurl -s -w \"\\n\" -b jar.txt http://localhost:3000/auth/me\ncurl -s -w \"%{http_code}\\n\" -b jar.txt -X POST http://localhost:3000/auth/logout\ncurl -s -w \"\\n%{http_code}\\n\" -b jar.txt http://localhost:3000/auth/me",
          "output": "HTTP/1.1 200 OK\nSet-Cookie: session=<43-character token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800\nContent-Type: application/json;charset=utf-8\n\n{\"id\":\"4\",\"email\":\"dee@example.com\",\"name\":\"Dee\"}\n{\"id\":\"4\",\"email\":\"dee@example.com\",\"name\":\"Dee\"}\n204\n{\"error\":{\"code\":\"UNAUTHORIZED\",\"message\":\"login required\"}}\n401",
          "explanation": "The first command shows the login response headers (trimmed; the real token is a random 43-character string, shown here as a placeholder). The second call sends the saved cookie and gets the user. After logout the session row is gone, so the same cookie now gets a 401. The logout call has no body, so `-w \"%{http_code}\\n\"` prints just its status, 204. The `-w \"\\n\"` on the other calls adds the line break that curl omits after a body."
        }
      ],
      "productionNote": "Server-side sessions are instantly revocable: delete the row and the user is signed out everywhere that token was used. Delete expired rows from time to time (for example with a scheduled `DELETE FROM sessions WHERE expires_at < now()`), and delete all of a user's sessions after a password change. Always serve the API over HTTPS so the Secure flag works.",
      "commonMistakes": [
        "Storing the raw session token in the database. A leaked table would then hand attackers working logins; store the SHA-256 hash.",
        "Leaving out HttpOnly, so any injected script on the page can read the session cookie.",
        "Sessions that never expire. Always keep an `expires_at` and check it in the lookup.",
        "Generating tokens with Math.random or from the user id. Use crypto.getRandomValues so they cannot be predicted."
      ],
      "sources": [
        { "title": "Bun docs: Cookies", "url": "https://bun.com/docs/runtime/http/cookies" },
        { "title": "MDN: Set-Cookie header", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie" },
        { "title": "OWASP Session Management Cheat Sheet", "url": "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html" }
      ]
    },
    {
      "id": "jwt-hmac",
      "title": "JWTs: signing & verifying with HMAC, sessions vs JWT trade-offs",
      "explanation": "A JWT (JSON Web Token) is a different way to prove identity. Instead of an opaque random string that the server looks up in a database, the token itself carries the information and a signature that proves the server issued it. It is three parts joined by dots: `header.payload.signature`. Each part is base64url text. The header is JSON naming the algorithm, for example `{\"alg\":\"HS256\",\"typ\":\"JWT\"}`. The payload is JSON containing claims (facts about the token). The signature is computed over the first two parts.\n\nThe common claims are `sub` (subject, here the user id), `iat` (issued at) and `exp` (expiry).\n\nTimes are in seconds since 1 January 1970, which is what `Math.floor(Date.now() / 1000)` gives you.\n\nImportant: the payload is signed, not encrypted. Anyone holding the token can decode and read it, so never put secrets in it.\n\nHS256 means HMAC with SHA-256. HMAC (hash-based message authentication code) mixes a secret key into a hash, so only someone who knows the secret can produce a matching signature. In this course the secret is `config.jwtSecret` from topic 7, which must be at least 32 characters long.\n\nBun supports the Web Crypto API (the browser-standard `crypto.subtle` toolkit) for this. You first turn the secret text into a key with `crypto.subtle.importKey(\"raw\", ..., { name: \"HMAC\", hash: \"SHA-256\" }, false, [\"sign\", \"verify\"])`. The text-to-bytes step uses `new TextEncoder().encode(secret)`. Then `crypto.subtle.sign(\"HMAC\", key, data)` produces the signature bytes.\n\nTo check a token, split it into its three parts, look at the header, and ask `crypto.subtle.verify` whether the signature matches. Use `verify`, not `===` on strings: `verify` compares in constant time, meaning the comparison takes the same time no matter where the first difference is, so an attacker cannot learn the signature one character at a time from response timing. Before the signature check, check that the header says `alg` is exactly `HS256` (never trust the token to choose its own algorithm, and never accept `none`) and that `exp` is still in the future.\n\nThe example below does all of this in one runnable file. Those two exported functions would live in `src/auth/jwt.ts`; the lines at the bottom are the demo. The `catch {` form catches any error without naming it, and it is used because every failure just means \"invalid token\", so the function returns `null`. The `as [string, string, string]` is a type assertion (topic 5) telling TypeScript that `split(\".\")` produced exactly three strings, which the demo knows is true.\n\nSessions or JWTs? A JWT needs no database lookup, which is handy between services. But you cannot take one back before `exp` without extra machinery (very short lifetimes plus refresh tokens, meaning a second, longer-lived token that fetches new short ones, or a denylist, meaning a stored list of revoked tokens, which is a database lookup again). A session costs one indexed query but can be revoked instantly. This course uses sessions for the browser API and treats JWTs as the tool for service-to-service or mobile clients; here you only build the utility and learn the trade-offs.",
      "analogy": "A JWT is a festival wristband with a tamper-proof seal. Staff only check the seal; they do not look anyone up on a guest list. That is fast, but you cannot take the wristband back from someone until the festival ends. A session is the guest list at the door: checking it is a little slower, but a name can be crossed off at any moment and that person is out immediately.",
      "code": [
        {
          "language": "typescript",
          "filename": "jwt-demo.ts",
          "source": "type Payload = { sub: string; exp: number; iat?: number };\n\nconst encoder = new TextEncoder();\n\nfunction hmacKey(secret: string): Promise<CryptoKey> {\n  return crypto.subtle.importKey(\n    \"raw\",\n    encoder.encode(secret),\n    { name: \"HMAC\", hash: \"SHA-256\" },\n    false,\n    [\"sign\", \"verify\"],\n  );\n}\n\nfunction encodeText(text: string): string {\n  return Buffer.from(text).toString(\"base64url\");\n}\n\nfunction decodeText(part: string): string {\n  return Buffer.from(part, \"base64url\").toString(\"utf8\");\n}\n\nexport async function signJwt(payload: Payload, secret: string): Promise<string> {\n  const data = `${encodeText(JSON.stringify({ alg: \"HS256\", typ: \"JWT\" }))}.${encodeText(JSON.stringify(payload))}`;\n  const signature = await crypto.subtle.sign(\"HMAC\", await hmacKey(secret), encoder.encode(data));\n  return `${data}.${Buffer.from(signature).toString(\"base64url\")}`;\n}\n\nexport async function verifyJwt(token: string, secret: string): Promise<Payload | null> {\n  const parts = token.split(\".\");\n  if (parts.length !== 3) return null;\n  const [header, body, signature] = parts as [string, string, string];\n  try {\n    if (JSON.parse(decodeText(header))?.alg !== \"HS256\") return null;\n    const valid = await crypto.subtle.verify(\n      \"HMAC\",\n      await hmacKey(secret),\n      Buffer.from(signature, \"base64url\"),\n      encoder.encode(`${header}.${body}`),\n    );\n    if (!valid) return null;\n    const payload = JSON.parse(decodeText(body));\n    if (typeof payload?.sub !== \"string\" || typeof payload.exp !== \"number\") return null;\n    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;\n    return payload;\n  } catch {\n    return null; // malformed base64 or JSON: treat as an invalid token\n  }\n}\n\n// ---- demo ----\nconst secret = \"a-demo-secret-of-at-least-32-characters!\";\nconst now = Math.floor(Date.now() / 1000);\n\nconst token = await signJwt({ sub: \"4\", exp: now + 900 }, secret);\nconsole.log(token.split(\".\").length, (await verifyJwt(token, secret))?.sub);\n\nconst [header, body, signature] = token.split(\".\") as [string, string, string];\nconsole.log(header); // the same text for every HS256 token\nconsole.log(JSON.parse(decodeText(body)).sub); // the payload is readable by anyone\n\n// Forge a payload for user \"1\" but keep the old signature.\nconst forged = `${header}.${encodeText(JSON.stringify({ sub: \"1\", exp: now + 900 }))}.${signature}`;\nconsole.log(\"forged:\", await verifyJwt(forged, secret));\n\nconst expired = await signJwt({ sub: \"4\", exp: now - 10 }, secret);\nconsole.log(\"expired:\", await verifyJwt(expired, secret));\nconsole.log(\"wrong secret:\", await verifyJwt(token, \"another-secret-that-is-32-chars-long!\"));",
          "output": "3 4\neyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\n4\nforged: null\nexpired: null\nwrong secret: null",
          "explanation": "The header is always the same text because it is just base64url of the fixed JSON `{\"alg\":\"HS256\",\"typ\":\"JWT\"}`. Reading `sub` out of the payload needs no secret, which proves the payload is not secret. A forged payload, an expired token and a token checked with the wrong secret all give null. Run it with `bun run jwt-demo.ts`. In the project, copy only `signJwt` and `verifyJwt` (and their helpers) into src/auth/jwt.ts and pass `config.jwtSecret` as the secret."
        }
      ],
      "productionNote": "Use short-lived JWTs (minutes, not months) and plan how to revoke them (refresh tokens or a denylist) before shipping. Keep the signing secret in the environment, never in code, and rotate it if it leaks. For a normal browser-facing API, server-side sessions from the previous sub-topic are simpler and safer.",
      "commonMistakes": [
        "Accepting any `alg` the token claims (including `none`) instead of requiring exactly HS256.",
        "Storing a JWT in localStorage (browser storage readable by any script on the page) instead of an HttpOnly cookie, so an XSS attack can steal it.",
        "Issuing long-lived JWTs with no way to revoke them, so a stolen token works until it expires.",
        "Comparing signatures with `===` instead of crypto.subtle.verify, which leaks timing information.",
        "Putting private data in the payload, because the payload is only encoded, not encrypted."
      ],
      "sources": [
        { "title": "RFC 7519: JSON Web Token (JWT)", "url": "https://datatracker.ietf.org/doc/html/rfc7519" },
        { "title": "MDN: SubtleCrypto.sign()", "url": "https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign" },
        { "title": "MDN: SubtleCrypto.verify()", "url": "https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify" }
      ]
    },
    {
      "id": "protect-routes-ownership",
      "title": "Protecting routes & checking ownership",
      "explanation": "Now put sessions to work. A function `requireUser(req)` reads the session cookie, hashes it, looks the session up, and returns the signed-in user. If there is no cookie or no valid session, it throws `UnauthorizedError`, which the `handle()` wrapper turns into a `401` response. Every non-public endpoint starts with `const user = await requireUser(req)`.\n\nBecause topic 18 builds services with factories and dependency injection, `requireUser` is created by a factory too: `createRequireUser(sessions)` receives the session service and returns the function. `ReturnType<typeof createSessionService>` is a TypeScript shortcut that means \"whatever type createSessionService returns\", so the type stays correct if the factory changes. Create it once where you assemble the server (the composition root) and hand it to the route files. This replaces the insecure `X-User-Id` header placeholder from topic 18 everywhere. A client must never tell the server who it is; the server works that out from the session.\n\nLogging in is only authentication. Authorization is the second check: may this user touch this particular record? The simplest reliable pattern is to put the owner into the query. The order service takes the id of the signed-in user and filters with `WHERE id = ... AND user_id = ...`. If the order belongs to someone else, the query returns no row, and the service throws `NotFoundError`.\n\nWhy 404 and not 403 (forbidden)? A 403 would confirm that order 1 exists but belongs to someone else, which leaks information. Answering 404 for both \"does not exist\" and \"is not yours\" reveals nothing. This course chooses 404 for other users' orders. (Some APIs prefer 403; either is acceptable if applied consistently.) Larger systems also add roles, such as an `admin` role allowed to see every order; that is only mentioned here.\n\nForgetting the ownership filter is a very common real-world bug called IDOR (insecure direct object reference): a logged-in user simply guesses other ids, such as `/orders/2`, `/orders/3`, and reads other people's data. OWASP ranks this class of bug (broken object-level authorization) as the number one API risk.",
      "analogy": "An apartment building. Your key fob gets you through the front door (the 401 check: are you a resident at all?). But your key only opens your own flat (the ownership check). If you try a neighbour's door, it looks exactly like a door that does not exist, so you learn nothing about who lives where.",
      "code": [
        {
          "language": "typescript",
          "filename": "src/auth/require-user.ts",
          "source": "import type { CookieMap } from \"bun\";\nimport { UnauthorizedError } from \"../errors.ts\";\nimport type { AuthUser, createSessionService } from \"./sessions.ts\";\n\ntype SessionService = ReturnType<typeof createSessionService>;\n\nexport function createRequireUser(sessions: SessionService) {\n  // Any request that has the `cookies` map (a BunRequest) can be passed in.\n  return async function requireUser(req: { cookies: CookieMap }): Promise<AuthUser> {\n    const token = req.cookies.get(\"session\");\n    const user = token ? await sessions.find(token) : null;\n    if (!user) throw new UnauthorizedError(\"login required\");\n    return user;\n  };\n}\n\n// In the composition root (where createServer(deps) is assembled):\n//   const requireUser = createRequireUser(createSessionService(db));",
          "output": "",
          "explanation": "This is the same cookie, hash and lookup logic as /auth/me, moved into one reusable place. `/auth/me` can now just be `const user = await requireUser(req); return json(user);`. The file prints nothing itself."
        },
        {
          "language": "typescript",
          "filename": "src/routes/orders.routes.ts",
          "source": "// Excerpt of the routes object.\n\"/orders/:id\": {\n  GET: handle(async (req: BunRequest<\"/orders/:id\">) => {\n    const user = await requireUser(req);\n    const order = await ordersService.getOrder(user.id, req.params.id);\n    return json(order);\n  }),\n},\n\n// In the orders service/repository: the owner is part of the query.\n//   const rows = await db`\n//     SELECT id, status, created_at FROM orders\n//     WHERE id = ${id} AND user_id = ${userId}`;\n//   if (!rows[0]) throw new NotFoundError(`order ${id} not found`);",
          "output": "",
          "explanation": "The user id comes from the verified session (`user.id`), never from the request body, query string or a header. Passing it into the service and into the SQL `WHERE` clause means the database only ever returns rows the user owns. The exact column list in the SELECT follows your own orders code from topic 18; the important part is `AND user_id = ${userId}`."
        },
        {
          "language": "bash",
          "filename": "ownership-check.sh",
          "source": "# Ben (user 2) is logged in, with his cookie saved in ben.txt. Order 1 belongs to Asha.\ncurl -s -w \"\\n%{http_code}\\n\" -b ben.txt http://localhost:3000/orders/1\n\n# No cookie at all\ncurl -s -w \"\\n%{http_code}\\n\" http://localhost:3000/orders/1",
          "output": "{\"error\":{\"code\":\"NOT_FOUND\",\"message\":\"order 1 not found\"}}\n404\n{\"error\":{\"code\":\"UNAUTHORIZED\",\"message\":\"login required\"}}\n401",
          "explanation": "Ben is authenticated, so he gets past requireUser, but order 1 is not his, so the ownership filter finds nothing and the answer is 404. Without any cookie, requireUser itself stops the request with 401."
        }
      ],
      "productionNote": "Make requireUser the first line of every non-public handler, and make the owner part of the SQL for every per-user resource, not an `if` after loading the row. Take identity only from the session; never trust a user id sent by the client. For admin features add a role column to users and check it in a separate `requireAdmin`.",
      "commonMistakes": [
        "Checking that the user is logged in but not that the record belongs to them (IDOR: guessing other people's ids and reading their data).",
        "Trusting a user id sent by the client in a header, query string or JSON body instead of using the one from the session.",
        "Loading the row first and checking ownership afterwards in one code path but forgetting it in another. Putting `user_id` in the query keeps it in one place.",
        "Answering 403 for other people's records in some endpoints and 404 in others, which reveals which ids exist."
      ],
      "sources": [
        { "title": "OWASP Authorization Cheat Sheet", "url": "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html" },
        { "title": "OWASP API Security 2023: Broken Object Level Authorization", "url": "https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "You call Bun.password.hash(\"correct horse\") twice and get two different strings. Why?",
      "options": [
        "The function has a bug that corrupts some hashes, so you must retry until they match",
        "Each hash includes its own random salt, and verify() reads that salt back out of the string",
        "The second call encrypts the password with a key that the first call changed",
        "Bun shortens the hash differently each time to save space in the database"
      ],
      "answerIndex": 1,
      "explanation": "A salt is random data mixed into every hash, so identical passwords produce different strings. The salt (and algorithm settings) are stored inside the hash string, which is why Bun.password.verify can still check a password against it. It is not a bug, not encryption, and not shortening."
    },
    {
      "question": "Why does login return the same 401 message for an unknown email and for a wrong password?",
      "options": [
        "Because PostgreSQL cannot tell whether a row is missing or a password is wrong",
        "Because HTTP only allows one message per status code",
        "So attackers cannot learn which emails have accounts (account enumeration)",
        "To make the response smaller and faster to send"
      ],
      "answerIndex": 2,
      "explanation": "Different messages would let an attacker test email addresses and learn which ones are registered. The service also runs verify against a dummy hash for unknown emails so the response time does not give the answer away either."
    },
    {
      "question": "Why does the sessions table store the SHA-256 hash of the token instead of the token itself?",
      "options": [
        "If the database leaks, the attacker gets fingerprints that cannot be used as session cookies",
        "Because browsers refuse cookies that contain raw random bytes",
        "Because a hash makes the token expire automatically after 7 days",
        "Because the token would not fit into a text column otherwise"
      ],
      "answerIndex": 0,
      "explanation": "The browser keeps the raw token and the server keeps only its hash. Looking up a session means hashing the incoming token and matching the stored hash, but a stolen table cannot be turned back into working tokens. Expiry is handled separately by the expires_at column."
    },
    {
      "question": "Can a signed JWT be revoked before its exp time, without any extra infrastructure on the server?",
      "options": [
        "Yes, deleting the cookie in the browser revokes it everywhere",
        "Yes, changing the payload and re-sending it cancels the old token",
        "Yes, because the server remembers every token it signed",
        "No, because it is verified purely by its signature; revoking needs a denylist or short lifetimes plus refresh tokens"
      ],
      "answerIndex": 3,
      "explanation": "A JWT is checked by its signature and exp claim alone, with no database lookup. Anyone holding a copy keeps a valid token until exp. Revoking early needs extra machinery such as a denylist (which is a lookup again) or very short lifetimes. Server-side sessions can be revoked instantly by deleting the row."
    },
    {
      "question": "Ben is logged in and requests GET /orders/1, which belongs to Asha. What does this course's API return and why?",
      "options": [
        "401, because Ben's session is not valid for Asha's data",
        "404, so the response does not reveal that order 1 exists but belongs to someone else",
        "200, because any logged-in user may read any order",
        "500, because the ownership filter finds no row and crashes"
      ],
      "answerIndex": 1,
      "explanation": "Ben is authenticated, so it is not a 401. The query filters by `user_id`, finds no row and the service throws NotFoundError, which becomes a 404. A 404 looks the same as a truly missing order, so nothing leaks. Returning 200 would be the IDOR bug, and a missing row is an expected case, not a crash."
    }
  ]
});
