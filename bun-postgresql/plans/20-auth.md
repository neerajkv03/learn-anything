# 20. Authentication & Authorization
Version: Bun 1.4.5 + PostgreSQL 19.0
Prerequisites: 19-validation-errors

## Learning goals
- Learner can hash and verify passwords with `Bun.password` and explain why hashing ≠ encryption.
- Learner can build signup and login endpoints that avoid account enumeration.
- Learner can implement opaque session tokens stored hashed in a `sessions` table, sent in an HttpOnly cookie, with logout.
- Learner can sign and verify an HS256 JWT with Web Crypto and compare sessions vs JWTs.
- Learner can protect routes (`requireUser`) and enforce ownership on orders.

## Sub-topics
### Password hashing with Bun.password
- Concept: authentication = who are you; authorization = what may you do. Never store passwords; store a slow, salted one-way hash. `await Bun.password.hash(pw)` → argon2 (docs example argon2id) string with algorithm, params and random salt embedded (`$argon2id$v=19$m=...`); same password → different hash each time (salt). `await Bun.password.verify(pw, hash)` → true/false, detects algorithm from hash. Options `{ algorithm: "argon2id", memoryCost, timeCost }` or bcrypt `cost`; 1.4: argon2 memoryCost must be ≥ 8 and invalid costs throw (version notes). Async versions don't block the server; avoid `hashSync` in handlers. Password policy: 8-128 chars (cap prevents abuse).
- Analogy: meat grinder — easy to turn steak into mince, impossible to turn mince back into steak; to check a steak you grind it the same way and compare. Salt = a secret spice added per customer so two identical steaks give different mince.
- Code example: `hash-demo.ts` — `const h1 = await Bun.password.hash("correct horse"); const h2 = await Bun.password.hash("correct horse"); console.log(h1.startsWith("$argon2"), h1 === h2); console.log(await Bun.password.verify("correct horse", h1), await Bun.password.verify("wrong", h1));` → `true false` / `true false`.
- Production use: users.password_hash column (11).
- Common mistakes: fast hashes (sha256) for passwords; logging passwords; comparing hashes with `===` instead of `verify`.
- Sources: https://bun.com/docs/api/hashing ; https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

### Signup & login flows
- Concept: signup: validate (email format simple check, lowercase+trim; name 1-100; password 8-128) → hash → insert; 23505 on email → 409 `EMAIL_TAKEN` (catch in auth service, 19). Login: find user by email; if missing, still run `verify` against a precomputed dummy hash (equal timing) → same 401 `INVALID_CREDENTIALS` message for unknown email and wrong password (no account enumeration). Return safe user (no password_hash, 04 rest destructuring). Rate limiting mentioned as needed in production (outside course scope — one line).
- Analogy: hotel key desk — the clerk says "those details don't match" whether the room doesn't exist or the name is wrong, so strangers can't probe which rooms are occupied.
- Code example: `src/services/auth.service.ts` `signup`/`login`; curl: `curl -X POST .../auth/signup -H "Content-Type: application/json" -d '{"email":" Dee@Example.com ","name":"Dee","password":"s3cure-pass"}'` → `201` `{"id":"4","email":"dee@example.com","name":"Dee"}`; repeat → `409` `{"error":{"code":"EMAIL_TAKEN","message":"email already registered"}}` (ConflictError with code override); login wrong password → `401` `{"error":{"code":"INVALID_CREDENTIALS","message":"invalid email or password"}}`; login unknown email → identical 401 body.
- Production use: account creation and sign-in.
- Common mistakes: different messages for "no such user" vs "wrong password"; case-sensitive email duplicates.
- Sources: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html ; https://bun.com/docs/api/hashing

### Session tokens in a sessions table & cookies
- Concept: on login create random token (32 bytes from `crypto.getRandomValues`, base64url) → store only its SHA-256 hash (`new Bun.CryptoHasher("sha256").update(token).digest("hex")`) in `sessions` (DB leak doesn't reveal usable tokens) → send raw token in cookie. Migration `0006_create_sessions.sql`: `CREATE TABLE sessions (token_hash text PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()); CREATE INDEX sessions_user_id_idx ON sessions (user_id);`. Cookie flags: `HttpOnly` (JS can't read → XSS-safe), `Secure` (HTTPS only), `SameSite=Lax` (CSRF mitigation), `Path=/`, `Max-Age=604800` (7 days). Set via explicit `Set-Cookie` header string (covers SameSite; Bun's `req.cookies.set` documents only maxAge/httpOnly/secure/path). Read via `req.cookies.get("session")` (documented). Lookup: `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ${hash} AND s.expires_at > now()`. Logout: delete row + `Set-Cookie: session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`. Local dev over plain http: browsers may drop `Secure` cookies except on localhost — note; curl ignores it.
- Analogy: cloakroom ticket — you get a numbered ticket (token), the cloakroom keeps a matching stub (hash) and your coat (session); lose the ticket = lose access; staff can tear up the stub to end it (logout/revoke).
- Code example: login response headers: `Set-Cookie: session=<43-char base64url token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800` (32 bytes → 43 base64url chars, no padding); `curl -c jar.txt` login then `curl -b jar.txt http://localhost:3000/auth/me` → `{"id":"4","email":"dee@example.com","name":"Dee"}`; after logout `/auth/me` → `401` `{"error":{"code":"UNAUTHORIZED","message":"login required"}}`.
- Production use: server-side sessions = instantly revocable.
- Common mistakes: storing raw tokens; cookies without HttpOnly; never expiring sessions.
- Sources: https://bun.com/docs/runtime/http/cookies ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie ; https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

### JWTs: signing & verifying with HMAC, sessions vs JWT trade-offs
- Concept: JWT = `header.payload.signature`, each base64url; HS256 = HMAC-SHA256 over `header.payload` with a secret (`config.jwtSecret`, ≥32 chars, 07). Payload is readable by anyone (signed, not encrypted) — no secrets inside. Claims: `sub` (user id), `iat`, `exp` (seconds since epoch). Implement with Web Crypto: `crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])`, `crypto.subtle.sign("HMAC", key, data)`, verify with `crypto.subtle.verify` (constant-time comparison). Check header alg === "HS256" and `exp > now`. Trade-offs: JWT = no DB lookup, but can't revoke before exp (needs short exp + refresh tokens / denylist); sessions = revocable, one indexed query. Course default: sessions for the browser API; JWT for service-to-service/mobile (concept + utility only).
- Analogy: festival wristband with a tamper-proof seal (JWT) — staff check the seal, no guest list lookup, but you can't take it back until the festival ends; vs guest list at the door (sessions) — slower, but names can be crossed off anytime.
- Code example: `src/auth/jwt.ts` `signJwt(payload, secret)` / `verifyJwt(token, secret): Promise<Payload | null>`; header part always `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9` (base64url of `{"alg":"HS256","typ":"JWT"}`); `const t = await signJwt({ sub: "4", exp: Math.floor(Date.now() / 1000) + 900 }, secret); console.log(t.split(".").length, (await verifyJwt(t, secret))?.sub);` → `3 4`; tampered token (change one payload char) → `null`; expired (`exp` in past) → `null`. Base64url via `Buffer.from(...).toString("base64url")`.
- Production use: API tokens for other services; understanding third-party auth.
- Common mistakes: accepting `alg: none` / not checking alg; storing JWTs in localStorage; long-lived JWTs without revocation plan; comparing signatures with `===`.
- Sources: https://datatracker.ietf.org/doc/html/rfc7519 ; https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign ; https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify

### Protecting routes & checking ownership
- Concept: `requireUser(req)` in `src/auth/require-user.ts` (built with deps via factory, 18): read cookie → hash → lookup → return `AuthUser` or throw UnauthorizedError (401). Replace 18's `X-User-Id` header everywhere. Ownership (authorization): service filters by `user_id = ${user.id}`; another user's order → 404 NOT_FOUND (don't reveal existence; state choice vs 403). Roles (admin) mentioned only.
- Analogy: apartment building — key fob gets you through the front door (401 check), but your key only opens your own flat (ownership); trying a neighbour's door looks the same as a door that doesn't exist.
- Code example: `"/orders/:id": { GET: handle(async (req: BunRequest<"/orders/:id">) => { const user = await requireUser(req); const order = await ordersService.getOrder(user.id, req.params.id); return json(order); }) }`; Ben (user 2) requests Asha's order 1 → `404` `{"error":{"code":"NOT_FOUND","message":"order 1 not found"}}`; no cookie → `401` `{"error":{"code":"UNAUTHORIZED","message":"login required"}}`.
- Production use: every non-public endpoint.
- Common mistakes: checking login but not ownership (IDOR — gloss: guessing other people's ids); trusting user id sent by client.
- Sources: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html ; https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/

## Quiz
1. Why does hashing the same password twice give different strings? — tests salts
2. Why the same 401 message for unknown email and wrong password? — tests enumeration
3. Why store the SHA-256 of the session token, not the token itself? — tests session storage
4. Can a JWT be revoked before `exp` without extra infrastructure? — tests JWT trade-offs
5. Ben asks for Asha's order: 401, 403 or 404 in this course, and why? — tests ownership
