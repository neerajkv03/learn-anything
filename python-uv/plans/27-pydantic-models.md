# 27. Pydantic Models
Version: Python 3.15.2 + uv 0.13.7 + Pydantic 2.14.3
Prerequisites: 10-type-hints, 11-error-handling, 15-classes-objects, 26-http-api-basics

## Learning goals
- After this topic, learner can define a Pydantic model with typed fields and defaults.
- After this topic, learner can catch `ValidationError` and read its errors (`loc`, `type`).
- After this topic, learner can add constraints with `Field()` (and the `Annotated` form).
- After this topic, learner can nest models and validate dicts with `model_validate`.
- After this topic, learner can convert models to dicts/JSON with `model_dump` / `model_dump_json`.

## Sub-topics
### BaseModel and typed fields
- Concept: Pydantic = third-party library that checks and converts data using type hints. Install `uv add pydantic` (FastAPI installs it too). Subclass `BaseModel`; each annotated attribute is a field; default = optional field. Default (lax) mode converts sensible inputs (`"2"` → `2` for int). Like a dataclass (topic 16) but validates.
- Analogy: Airport check-in desk: checks your passport fields are present and right, fixes small formatting things, refuses bad documents.
- Code example: `user_model.py` — `from pydantic import BaseModel`; `class User(BaseModel): id: int; name: str; active: bool = True`; `u = User(id=1, name="Ada")`; `print(u)`; `print(u.name)`; `print(User(id="2", name="Bob").id + 1)`; output `id=1 name='Ada' active=True\nAda\n3`. Show `uv add pydantic` + `uv run user_model.py` in a bash block, output `""`.
- Production use: API request/response schemas, config files, parsing external data.
- Common mistakes: Positional arguments `User(1, "Ada")` (fields are keyword-only → TypeError); expecting no conversion (use strict mode only when needed, just mention).
- Sources: https://docs.pydantic.dev/latest/concepts/models/#basic-model-usage ; https://docs.pydantic.dev/latest/concepts/conversion_table/

### Validation and ValidationError
- Concept: Bad data raises `pydantic.ValidationError` with all problems at once. `e.error_count()`, `e.errors()` → list of dicts with `loc` (where, tuple), `msg` (human text), `type` (machine code like `int_parsing`, `missing`), `input`.
- Analogy: A form checker that hands back the whole form with every wrong box circled, not just the first.
- Code example: `validation.py` — `from pydantic import BaseModel, ValidationError`; `class User(BaseModel): id: int; name: str`; `try: User(id="abc", name="Ada")` `except ValidationError as e: print(e.error_count()); err = e.errors()[0]; print(err["loc"], err["type"])`; `try: User(id=1)` `except ValidationError as e: err = e.errors()[0]; print(err["loc"], err["type"])`; output `1\n('id',) int_parsing\n('name',) missing`. Don't print `msg` (wording may change).
- Production use: Returning clear 422 errors in APIs (FastAPI does this automatically, topic 29).
- Common mistakes: Catching bare `Exception` and hiding details; relying on exact `msg` text instead of `type`.
- Sources: https://docs.pydantic.dev/latest/errors/validation_errors/ ; https://docs.pydantic.dev/latest/api/pydantic_core/#pydantic_core.ValidationError

### Field constraints with Field()
- Concept: `Field(...)` adds rules and defaults: `min_length`, `max_length` (str/list), `gt`, `ge`, `lt`, `le` (numbers), `default`, `description`. Equivalent `Annotated[float, Field(gt=0)]` form (recap `Annotated`: gloss as "type plus extra info") — FastAPI uses it heavily.
- Analogy: Form boxes with printed rules: "max 50 letters", "must be above zero".
- Code example: `product.py` — `from typing import Annotated`; `from pydantic import BaseModel, Field, ValidationError`; `class Product(BaseModel): name: str = Field(min_length=1, max_length=50); price: float = Field(gt=0); quantity: Annotated[int, Field(ge=0)] = 0`; `print(Product(name="Pen", price=1.5))`; `try: Product(name="", price=-1)` `except ValidationError as e: print([err["type"] for err in e.errors()])`; output `name='Pen' price=1.5 quantity=0\n['string_too_short', 'greater_than']`.
- Production use: Enforcing business rules at the API boundary (positive prices, username length).
- Common mistakes: Checking these rules by hand with `if` everywhere; `Field(gt=0)` on a str field (rule doesn't fit type).
- Sources: https://docs.pydantic.dev/latest/concepts/fields/ ; https://docs.pydantic.dev/latest/api/fields/#pydantic.fields.Field

### Nested models
- Concept: A field's type can be another model or `list[Model]`; dicts are validated into objects. `Model.model_validate(dict)` validates existing data. Error `loc` shows the full path. Mutable defaults like `[]` are safe in Pydantic (copied per instance) — unlike plain classes.
- Analogy: Russian dolls checked one by one: the customer form contains an address form, each checked by its own rules.
- Code example: `nested.py` — `from pydantic import BaseModel, ValidationError`; `class Address(BaseModel): city: str; zip_code: str`; `class Customer(BaseModel): name: str; address: Address; tags: list[str] = []`; `c = Customer.model_validate({"name": "Ada", "address": {"city": "London", "zip_code": "N1"}})`; `print(c.address.city)`; `print(c.tags)`; `try: Customer.model_validate({"name": "Bob", "address": {"city": "Paris"}})` `except ValidationError as e: print(e.errors()[0]["loc"])`; output `London\n[]\n('address', 'zip_code')`.
- Production use: Orders with line items, users with addresses, JSON from other services.
- Common mistakes: Using `dict` as type and losing validation; forgetting nested errors show a path tuple.
- Sources: https://docs.pydantic.dev/latest/concepts/models/#nested-models ; https://docs.pydantic.dev/latest/concepts/models/#validating-data

### Serializing with model_dump / model_dump_json
- Concept: Serialize = turn an object into plain data. `model_dump()` → dict; `exclude_none=True`, `exclude_unset=True` (only fields the caller actually set — used for PATCH in topic 31); `model_dump(mode="json")` → JSON-safe dict; `model_dump_json()` → compact JSON string. `model_validate_json(text)` parses JSON straight into a model.
- Analogy: Packing a suitcase: `model_dump` = items laid out on the bed; `model_dump_json` = zipped suitcase ready to ship.
- Code example: `serialize.py` — `from pydantic import BaseModel`; `class Item(BaseModel): name: str; price: float; note: str | None = None`; `item = Item(name="Pen", price=1.5)`; `print(item.model_dump())`; `print(item.model_dump(exclude_none=True))`; `print(item.model_dump_json())`; `print(Item.model_validate_json('{"name": "Ink", "price": 2}').price)`; output `{'name': 'Pen', 'price': 1.5, 'note': None}\n{'name': 'Pen', 'price': 1.5}\n{"name":"Pen","price":1.5,"note":null}\n2.0`.
- Production use: Sending responses, caching, storing JSON, PATCH updates.
- Common mistakes: Using Pydantic v1 names `.dict()` / `.json()` (deprecated in v2); `json.dumps(model)` (TypeError — use `model_dump_json`).
- Sources: https://docs.pydantic.dev/latest/concepts/serialization/ ; https://docs.pydantic.dev/latest/api/base_model/#pydantic.BaseModel.model_dump

## Quiz
1. What does `User(id="7", name="Ada").id` hold, and why? — tests lax conversion
2. Which part of an error tells you where it happened? — tests `loc`
3. How do you require a price above zero? — tests `Field(gt=0)`
4. What is the difference between `model_dump()` and `model_dump_json()`? — tests serialization
5. Which option gives only the fields the caller set? — tests `exclude_unset`
