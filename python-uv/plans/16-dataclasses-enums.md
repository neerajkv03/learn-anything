# 16. Dataclasses & Enums
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 15-classes-objects

## Learning goals
- After this topic, learner can define data-holding classes with `@dataclass` and get `__init__`, `__repr__`, `__eq__` for free.
- After this topic, learner can set defaults safely with `field(default_factory=...)`.
- After this topic, learner can make immutable records with `frozen=True` (and know `slots=True`).
- After this topic, learner can model fixed choices with `Enum` / `StrEnum` and `auto()`.

## Sub-topics
### @dataclass basics
- Concept: `@dataclass` (a decorator — a label that adds behaviour; explained in topic 18) generates `__init__`, `__repr__`, and `__eq__` from type-annotated fields. Less boilerplate than topic 15 classes.
- Analogy: A pre-printed form: you list the field names, the printer makes the form for you.
- Code example: `point.py` — `from dataclasses import dataclass`; `@dataclass class Point: x: float; y: float`; `p = Point(1.5, 2)`; `print(p)`; `print(p == Point(1.5, 2))`; `print(p.x + p.y)`; output `Point(x=1.5, y=2)\nTrue\n3.5`.
- Production use: DTOs (data transfer objects), config objects, records read from files/APIs.
- Common mistakes: Forgetting type annotations (field ignored); non-default field after a default field (TypeError).
- Sources: https://docs.python.org/3/library/dataclasses.html

### Defaults and field()
- Concept: Simple defaults `qty: int = 1`. Mutable defaults must use `field(default_factory=list)`. `field(repr=False)` hides secrets from repr.
- Analogy: Each new customer gets a fresh empty basket, not a shared one.
- Code example: `order.py` — `from dataclasses import dataclass, field`; `@dataclass class Order: customer: str; items: list[str] = field(default_factory=list); priority: int = 1; api_key: str = field(default="", repr=False)`; `a = Order("Ada")`; `b = Order("Bo", priority=2)`; `a.items.append("pen")`; `print(a)`; `print(b)`; output `Order(customer='Ada', items=['pen'], priority=1)\nOrder(customer='Bo', items=[], priority=2)`.
- Production use: Hiding tokens from logs via `repr=False`; safe per-instance lists.
- Common mistakes: `items: list[str] = []` → ValueError at class creation; forgetting field order rules.
- Sources: https://docs.python.org/3/library/dataclasses.html#dataclasses.field ; https://docs.python.org/3/library/dataclasses.html#mutable-default-values

### Frozen dataclasses
- Concept: `@dataclass(frozen=True)` makes instances read-only (assignment raises `FrozenInstanceError`) and hashable (usable as dict keys / in sets). `dataclasses.replace(obj, field=new)` makes a modified copy. `slots=True` saves memory and blocks typo attributes.
- Analogy: A printed receipt — to change it you print a new one.
- Code example: `money.py` — `from dataclasses import dataclass, replace, FrozenInstanceError`; `@dataclass(frozen=True, slots=True) class Money: amount: int; currency: str`; `price = Money(500, "INR")`; `discounted = replace(price, amount=450)`; `print(price, discounted)`; `try: price.amount = 1 except FrozenInstanceError: print("cannot modify")`; `print(len({price, Money(500, "INR")}))`; output `Money(amount=500, currency='INR') Money(amount=450, currency='INR')\ncannot modify\n1`.
- Production use: Value objects (money, coordinates, IDs) and config that must not change.
- Common mistakes: Expecting frozen to make nested lists immutable; trying to set attributes in `__post_init__` of a frozen class directly.
- Sources: https://docs.python.org/3/library/dataclasses.html#frozen-instances ; https://docs.python.org/3/library/dataclasses.html#dataclasses.replace

### Enum
- Concept: `Enum` defines a fixed set of named constants: `class Status(Enum): PENDING = 1`. Access `Status.PENDING`, `.name`, `.value`, look up `Status(1)` or `Status["PENDING"]`, iterate members. `StrEnum` members are also strings (good for JSON/DB); `auto()` assigns values (lowercase name for StrEnum). Works well with `match`.
- Analogy: A traffic light: only red, amber, green exist — nothing else is allowed.
- Code example: `status.py` — `from enum import Enum, StrEnum, auto`; `class Color(Enum): RED = 1; GREEN = 2`; `print(Color.RED, Color.RED.name, Color.RED.value)`; `print(Color(2))`; `class Status(StrEnum): PENDING = auto(); SHIPPED = auto()`; `print(Status.SHIPPED)`; `print(Status.PENDING == "pending")`; `print([s.value for s in Status])`; output `Color.RED RED 1\nColor.GREEN\nshipped\nTrue\n['pending', 'shipped']`.
- Production use: Order states, user roles, HTTP methods — replaces "magic strings".
- Common mistakes: Comparing a plain `Enum` member to its raw value (`Color.RED == 1` is False); misspelt strings instead of enums.
- Sources: https://docs.python.org/3/library/enum.html ; https://docs.python.org/3/howto/enum.html

## Quiz
1. Which methods does `@dataclass` generate by default? — tests generated methods
2. Correct way to give a dataclass field an empty-list default? — tests default_factory
3. What happens when you assign to a frozen dataclass field? — tests FrozenInstanceError
4. Output of `print(Status.SHIPPED)` for a StrEnum with auto()? — tests StrEnum
