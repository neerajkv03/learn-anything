# 33. Authentication Basics
Version: Python 3.15.2 + uv 0.13.7 + FastAPI 0.162.5 + pwdlib 0.3.1 + PyJWT 2.15.1
Prerequisites: 19-stdlib-essentials, 30-fastapi-dependencies, 32-fastapi-structure

## Learning goals
- After this topic, learner can explain authentication vs authorization and 401 vs 403.
- After this topic, learner can read a bearer token with `OAuth2PasswordBearer`.
- After this topic, learner can hash and verify passwords with pwdlib (Argon2).
- After this topic, learner can create and verify JWTs with PyJWT, including expiry.
- After this topic, learner can build a `/token` login endpoint and a current-user dependency.

(Output format: request → status + exact JSON body; tokens vary, so show them as `<token>`.)

## Sub-topics
### Authentication vs authorization
- Concept: Authentication (authn) = proving who you are. Authorization (authz) = what you're allowed to do. 401 Unauthorized = not authenticated (missing/bad credentials, despite the name); 403 Forbidden = authenticated but not allowed. Never store plain passwords; always HTTPS in production.
- Analogy: Hotel: showing ID at reception = authentication; your key card opening only your room = authorization.
- Code example: `authz.py` — `users = {"ada": {"role": "admin"}, "bob": {"role": "viewer"}}`; `def can_delete(username: str | None) -> str:` `if username not in users: return "401 Unauthorized (who are you?)"`; `if users[username]["role"] != "admin": return "403 Forbidden (not allowed)"`; `return "200 OK"`; `for name in ("ada", "bob", None): print(can_delete(name))`; output `200 OK\n403 Forbidden (not allowed)\n401 Unauthorized (who are you?)`.
- Production use: Login + roles/permissions in every multi-user system.
- Common mistakes: Returning 403 for "not logged in"; checking only authn and forgetting authz (any user can delete anything).
- Sources: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Authentication ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/401

### OAuth2PasswordBearer and the Authorization header
- Concept: Token = string the client sends instead of a password on every request: header `Authorization: Bearer <token>`. `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")` = dependency that extracts the token; missing → 401 `{"detail":"Not authenticated"}` with `WWW-Authenticate: Bearer` header. `tokenUrl` = where clients log in (used by /docs "Authorize" button). OAuth2 = standard for these flows (gloss only).
- Analogy: A wristband at a festival: shown at every gate instead of your ticket and ID.
- Code example: `main.py` — `from typing import Annotated`; `from fastapi import Depends, FastAPI`; `from fastapi.security import OAuth2PasswordBearer`; `app = FastAPI()`; `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")`; `@app.get("/items/") def read_items(token: Annotated[str, Depends(oauth2_scheme)]) -> dict[str, str]: return {"token": token}`; output: `GET /items/` header `Authorization: Bearer abc123` → `200` `{"token":"abc123"}`; no header → `401` `{"detail":"Not authenticated"}`.
- Production use: Standard for SPAs, mobile apps and service-to-service APIs.
- Common mistakes: Sending the token without the `Bearer ` prefix; putting tokens in URLs.
- Sources: https://fastapi.tiangolo.com/tutorial/security/first-steps/

### Password hashing (pwdlib)
- Concept: Hash = one-way scramble: can check a password, can't reverse it. Salt = random extra per hash, so same password → different hashes. Argon2 = recommended slow password hash. `uv add "pwdlib[argon2]"`; `password_hash = PasswordHash.recommended()`; `.hash(pw)`, `.verify(pw, hashed)` → bool. Store only the hash.
- Analogy: A meat grinder: easy to turn steak into mince, impossible to turn mince back; you check a steak by grinding it the same way and comparing.
- Code example: `hashing.py` — `from pwdlib import PasswordHash`; `password_hash = PasswordHash.recommended()`; `hashed = password_hash.hash("s3cret")`; `print(hashed.startswith("$argon2id$"))`; `print(password_hash.verify("s3cret", hashed))`; `print(password_hash.verify("wrong", hashed))`; `print(hashed == password_hash.hash("s3cret"))`; output `True\nTrue\nFalse\nFalse`. Explain last line: random salt.
- Production use: User signup/login storage.
- Common mistakes: Storing plain or fast-hashed (MD5/SHA-256) passwords; comparing hashes with `==` instead of `verify`.
- Sources: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/#hash-and-verify-the-passwords ; https://frankie567.github.io/pwdlib/ ; https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

### JWT access tokens (PyJWT)
- Concept: JWT (JSON Web Token) = `header.payload.signature` (3 parts, 2 dots), signed with a secret key so it can't be altered; payload is readable by anyone (not encrypted — no secrets inside). Claims: `sub` (subject = username, must be a string), `exp` (expiry time). `uv add pyjwt`; `jwt.encode(payload, SECRET_KEY, algorithm="HS256")`, `jwt.decode(token, SECRET_KEY, algorithms=["HS256"])`. Errors: `jwt.InvalidSignatureError`, `jwt.ExpiredSignatureError` (both subclasses of `jwt.InvalidTokenError`). Secret from env (topic 32), generate with `uv run python -c "import secrets; print(secrets.token_hex(32))"`.
- Analogy: A concert wristband with a tamper-proof hologram and printed date: anyone can read it, only the organiser can make a valid one, and it stops working after the date.
- Code example: `tokens.py` — `from datetime import datetime, timedelta, timezone`; `import jwt`; `SECRET_KEY = "dev-only-secret-key-change-me-0123456789"` (comment: load from env in real apps; ≥32 chars); `payload = {"sub": "ada", "exp": datetime.now(timezone.utc) + timedelta(minutes=30)}`; `token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")`; `print(token.count("."))`; `print(jwt.decode(token, SECRET_KEY, algorithms=["HS256"])["sub"])`; `try: jwt.decode(token, "another-secret-key-of-enough-length-000", algorithms=["HS256"])` `except jwt.InvalidTokenError as e: print(type(e).__name__)`; `old = jwt.encode({"sub": "ada", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}, SECRET_KEY, algorithm="HS256")`; `try: jwt.decode(old, SECRET_KEY, algorithms=["HS256"])` `except jwt.InvalidTokenError as e: print(type(e).__name__)`; output `2\nada\nInvalidSignatureError\nExpiredSignatureError`.
- Production use: Stateless login tokens for APIs.
- Common mistakes: Putting passwords/secrets in the payload; omitting `algorithms=[...]` in decode; hard-coding the secret key.
- Sources: https://pyjwt.readthedocs.io/en/stable/usage.html ; https://pyjwt.readthedocs.io/en/stable/api.html#exceptions ; https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/

### Current-user dependency
- Concept: Full flow: `POST /token` with form fields `username`, `password` (`OAuth2PasswordRequestForm` — form data, needs python-multipart, included in `fastapi[standard]`) → verify hash → return `{"access_token": token, "token_type": "bearer"}`. `get_current_user(token = Depends(oauth2_scheme))` decodes JWT → user, else 401 `{"detail":"Could not validate credentials"}` with `WWW-Authenticate: Bearer`. Protected endpoints depend on it (`CurrentUser = Annotated[dict[str, str], Depends(get_current_user)]`). Try it via /docs "Authorize".
- Analogy: Reception checks your ID once and gives a wristband (/token); every gate scans the wristband to know who you are (current user).
- Code example: `main.py` — imports (`datetime`, `timedelta`, `timezone`, `Annotated`, `jwt`, `Depends`, `FastAPI`, `HTTPException`, `status`, `OAuth2PasswordBearer`, `OAuth2PasswordRequestForm`, `PasswordHash`); `SECRET_KEY` as above; `password_hash = PasswordHash.recommended()`; `users_db = {"ada": {"username": "ada", "hashed_password": password_hash.hash("s3cret")}}`; `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")`; `@app.post("/token") def login(form: Annotated[OAuth2PasswordRequestForm, Depends()]) -> dict[str, str]:` user lookup; if missing or `not password_hash.verify(form.password, user["hashed_password"])`: raise 401 `"Incorrect username or password"` with `headers={"WWW-Authenticate": "Bearer"}`; encode `{"sub": user["username"], "exp": now + 30 min}`; return token dict; `def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> dict[str, str]:` `try: username = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])["sub"]` `except jwt.InvalidTokenError: raise HTTPException(401, "Could not validate credentials", headers=...)`; look up user or same 401; `@app.get("/users/me") def me(user: Annotated[dict[str, str], Depends(get_current_user)]) -> dict[str, str]: return {"username": user["username"]}`; output: `POST /token` form `username=ada&password=s3cret` → `200` `{"access_token":"<token>","token_type":"bearer"}`; wrong password → `401` `{"detail":"Incorrect username or password"}`; `GET /users/me` with `Authorization: Bearer <token>` → `200` `{"username":"ada"}`; with `Bearer garbage` → `401` `{"detail":"Could not validate credentials"}`.
- Production use: Login for web/mobile APIs; role checks build on the current user.
- Common mistakes: Different error messages for "no such user" vs "wrong password" (helps attackers guess usernames); returning the hashed password from `/users/me`.
- Sources: https://fastapi.tiangolo.com/tutorial/security/simple-oauth2/ ; https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/ ; https://fastapi.tiangolo.com/tutorial/security/get-current-user/

## Quiz
1. Logged in but not allowed — 401 or 403? — tests authn vs authz
2. Why does hashing the same password twice give different results? — tests salt
3. Can anyone read a JWT's payload? What stops them changing it? — tests signing
4. What header carries the token, in what format? — tests Bearer header
5. What happens when a token's `exp` is in the past? — tests ExpiredSignatureError → 401
