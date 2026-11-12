# 29. Request Bodies & Responses
Version: Python 3.15.2 + uv 0.13.7 + FastAPI 0.162.5 + Pydantic 2.14.3
Prerequisites: 27-pydantic-models, 28-fastapi-first-app

## Learning goals
- After this topic, learner can accept a JSON request body as a Pydantic model.
- After this topic, learner can control and filter responses with return types / `response_model`.
- After this topic, learner can set status codes (201, 204).
- After this topic, learner can raise `HTTPException` for errors like 404.
- After this topic, learner can read FastAPI's 422 validation errors.
- After this topic, learner can add validation to path/query parameters with `Annotated` + `Path` / `Query`.

(Output format: request → status + exact JSON body, as in topic 28.)

## Sub-topics
### Request bodies with Pydantic models
- Concept: A parameter typed as a `BaseModel` → read from the JSON body, validated, converted. FastAPI decides: in path → path param; simple type → query; model → body. Can combine all three.
- Analogy: Mail-order form: the envelope address (path), checkbox options (query), and the filled-in order form inside (body).
- Code example: `main.py` — `from fastapi import FastAPI`; `from pydantic import BaseModel`; `class ItemCreate(BaseModel): name: str; price: float; tags: list[str] = []`; `app = FastAPI()`; `@app.post("/items/") def create_item(item: ItemCreate) -> ItemCreate: return item`; output: `POST /items/` body `{"name": "Pen", "price": 1.5}` → `200` `{"name":"Pen","price":1.5,"tags":[]}`.
- Production use: Create/update endpoints, form submissions from frontends.
- Common mistakes: Sending a body with GET; using `dict` instead of a model (no validation, no docs).
- Sources: https://fastapi.tiangolo.com/tutorial/body/

### response_model and return types
- Concept: Return type annotation (or `response_model=` in the decorator) validates and **filters** output: only fields of the declared model are sent. Pattern: `UserIn` (has password) inherits from `BaseUser`; return type `BaseUser` → password stripped. Use `response_model=` when the function returns something of another type (e.g. dict).
- Analogy: A mail-room filter: whatever you put in the outgoing envelope, only items on the approved list get posted.
- Code example: `main.py` — `class BaseUser(BaseModel): username: str`; `class UserIn(BaseUser): password: str`; `@app.post("/users/") def create_user(user: UserIn) -> BaseUser: return user`; output: `POST /users/` body `{"username": "ada", "password": "s3cret"}` → `200` `{"username":"ada"}`.
- Production use: Never leaking passwords, internal ids or secrets in responses.
- Common mistakes: Returning the input model with the password; no return type → everything returned is sent.
- Sources: https://fastapi.tiangolo.com/tutorial/response-model/ ; https://fastapi.tiangolo.com/tutorial/response-model/#return-type-and-data-filtering

### Status codes
- Concept: Default 200. Set in decorator: `status_code=201` for create, `status_code=204` for delete with no body. `from fastapi import status` gives names like `status.HTTP_201_CREATED` (easier to read).
- Analogy: The stamp on the receipt: "created", "done, nothing to hand back".
- Code example: `main.py` — `from fastapi import FastAPI, status`; `@app.post("/items/", status_code=status.HTTP_201_CREATED) def create_item(item: ItemCreate) -> ItemCreate: return item`; `@app.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT) def delete_item(item_id: int) -> None: return None`; output: `POST /items/` body `{"name": "Pen", "price": 1.5}` → `201` `{"name":"Pen","price":1.5,"tags":[]}`; `DELETE /items/3` → `204` (empty body).
- Production use: Correct semantics for clients and API gateways.
- Common mistakes: Returning a body with 204; always 200 for creates.
- Sources: https://fastapi.tiangolo.com/tutorial/response-status-code/

### HTTPException
- Concept: `raise HTTPException(status_code=404, detail="Item not found")` stops the function and sends `{"detail": ...}` with that status. Raise, not return. `detail` can be any JSON-able value.
- Analogy: The waiter coming back: "sorry, we're out of that" — the order stops there.
- Code example: `main.py` — `from fastapi import FastAPI, HTTPException`; `items = {1: "Pen", 2: "Ink"}`; `@app.get("/items/{item_id}") def read_item(item_id: int) -> dict[str, str]: if item_id not in items: raise HTTPException(status_code=404, detail="Item not found"); return {"name": items[item_id]}`; output: `GET /items/1` → `200` `{"name":"Pen"}`; `GET /items/9` → `404` `{"detail":"Item not found"}`.
- Production use: Not found, conflicts (409), forbidden (403) in every API.
- Common mistakes: `return HTTPException(...)` (sent as 200 / errors); leaking internal error text in `detail`.
- Sources: https://fastapi.tiangolo.com/tutorial/handling-errors/#use-httpexception

### Validation errors (422)
- Concept: Invalid input → FastAPI returns `422` automatically with `{"detail": [ ... ]}`: list of errors, each with `type`, `loc` (first part `"body"`, `"query"`, `"path"`, `"header"`), `msg`, `input`. Same error types as Pydantic (topic 27). Your function is never called.
- Analogy: Bouncer at the door: bad tickets never reach the concert hall.
- Code example: reuse `ItemCreate` endpoint; output: `POST /items/` body `{"name": "Pen", "price": "cheap"}` → `422`, first error has `"type":"float_parsing"`, `"loc":["body","price"]`; `POST /items/` body `{"price": 1}` → `422`, first error has `"type":"missing"`, `"loc":["body","name"]`. Show only `type` and `loc` (msg wording may vary).
- Production use: Frontends show field errors from `loc`; clients debug from `type`.
- Common mistakes: Writing manual checks FastAPI already does; confusing 422 (bad data) with 400.
- Sources: https://fastapi.tiangolo.com/tutorial/handling-errors/#requestvalidationerror

### Annotated with Query / Path validation
- Concept: `Annotated[int, Path(ge=1)]`, `Annotated[str | None, Query(max_length=20)] = None` add rules (same names as Pydantic `Field`: `ge`, `le`, `min_length`, `max_length`, `pattern`) and doc text (`description`). List query param: `Annotated[list[str], Query()] = []` → `?tag=a&tag=b`. `Annotated` is FastAPI's recommended style.
- Analogy: Same form boxes as before, now with printed rules on the address and options too.
- Code example: `main.py` — `from typing import Annotated`; `from fastapi import FastAPI, Path, Query`; `@app.get("/items/{item_id}") def read_item(item_id: Annotated[int, Path(ge=1)], q: Annotated[str | None, Query(max_length=20)] = None) -> dict[str, int | str | None]: return {"item_id": item_id, "q": q}`; output: `GET /items/3?q=pen` → `200` `{"item_id":3,"q":"pen"}`; `GET /items/0` → `422`, `"type":"greater_than_equal"`, `"loc":["path","item_id"]`.
- Production use: Limits on page size, id ranges, search text length.
- Common mistakes: Old style `q: str = Query(None)` (still works but not recommended); forgetting `= None` for optional query.
- Sources: https://fastapi.tiangolo.com/tutorial/query-params-str-validations/ ; https://fastapi.tiangolo.com/tutorial/path-params-numeric-validations/

## Quiz
1. How does FastAPI decide whether a parameter comes from path, query or body? — tests parameter sources
2. How do you stop a password from appearing in a response? — tests return type filtering
3. What status code and body does `raise HTTPException(404, "Item not found")` produce? — tests HTTPException
4. When is your function NOT called at all? — tests 422 validation
5. How do you limit `limit` to at most 100? — tests `Annotated[int, Query(le=100)]`
