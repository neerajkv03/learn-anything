# 15. Classes & Objects
Version: Python 3.15.2 + uv 0.13.7
Prerequisites: 14-files-paths-data

## Learning goals
- After this topic, learner can define a class and create instances (objects).
- After this topic, learner can initialise attributes in `__init__` and explain `self`.
- After this topic, learner can write instance methods, class methods, and static methods.
- After this topic, learner can use `@property` for computed or validated attributes.
- After this topic, learner can use inheritance with `super()` and implement `__repr__`, `__eq__`, `__len__`.

## Sub-topics
### Classes and instances
- Concept: A class is a blueprint; an instance (object) is one thing built from it. Every value in Python is an object. `class Dog:` then `rex = Dog()`. `isinstance(rex, Dog)`. Class names use CapWords.
- Analogy: A cookie cutter (class) and the cookies (instances) — same shape, each its own cookie.
- Code example: `dog.py` — `class Dog: species = "Canis familiaris"`; `rex = Dog()`; `fido = Dog()`; `print(rex.species)`; `print(isinstance(rex, Dog))`; `print(rex is fido)`; output `Canis familiaris\nTrue\nFalse`.
- Production use: Modelling domain objects (User, Order, Invoice), clients, and services.
- Common mistakes: Forgetting `()` when creating an instance; creating classes for things that should be plain functions.
- Sources: https://docs.python.org/3/tutorial/classes.html#a-first-look-at-classes

### __init__ and attributes
- Concept: `__init__(self, ...)` runs when an instance is created; `self` is the instance itself; `self.name = name` stores an attribute (data per object). Class attributes are shared; instance attributes are per object.
- Analogy: Filling in a new employee form on their first day — every employee gets their own form.
- Code example: `account.py` — `class Account: def __init__(self, owner: str, balance: float = 0.0) -> None: self.owner = owner; self.balance = balance`; `a = Account("Ada", 50)`; `b = Account("Bo")`; `print(a.owner, a.balance)`; `print(b.owner, b.balance)`; output `Ada 50\nBo 0.0`.
- Production use: Objects carry their own state (connection settings, user data).
- Common mistakes: Forgetting `self` as first parameter; writing `owner = owner` without `self.`; shared mutable class attributes (`items = []` at class level).
- Sources: https://docs.python.org/3/tutorial/classes.html#class-objects ; https://docs.python.org/3/tutorial/classes.html#class-and-instance-variables

### Methods
- Concept: Functions defined in a class; called `obj.method()` (Python passes `self`). `@classmethod` gets the class (`cls`) — used for alternative constructors; `@staticmethod` gets neither — a helper grouped with the class.
- Analogy: Buttons on a microwave: each button acts on that specific microwave.
- Code example: `methods.py` — `class Account:` `__init__(owner, balance=0.0)`; `def deposit(self, amount: float) -> None: self.balance += amount`; `@classmethod def from_text(cls, text: str) -> "Account": owner, amount = text.split(":"); return cls(owner, float(amount))`; `@staticmethod def is_valid_amount(amount: float) -> bool: return amount > 0`; usage: `acc = Account.from_text("Ada:100")`; `acc.deposit(25)`; `print(acc.owner, acc.balance)`; `print(Account.is_valid_amount(-5))`; output `Ada 125.0\nFalse`.
- Production use: Alternative constructors like `from_json`, `from_row`.
- Common mistakes: Calling a method without parentheses; forgetting `self.` when using attributes inside methods.
- Sources: https://docs.python.org/3/tutorial/classes.html#method-objects ; https://docs.python.org/3/library/functions.html#classmethod

### Properties
- Concept: `@property` exposes a method as an attribute (computed value); `@x.setter` adds validation on assignment. Leading underscore `_balance` = "internal, don't touch" by convention.
- Analogy: A car's fuel gauge: you read a number, but behind it is a sensor doing work.
- Code example: `temperature.py` — `class Temperature:` `__init__(self, celsius)` sets `self.celsius = celsius` (goes through setter); `@property def celsius(self) -> float: return self._celsius`; `@celsius.setter def celsius(self, value: float) -> None: if value < -273.15: raise ValueError("below absolute zero"); self._celsius = value`; `@property def fahrenheit(self) -> float: return self._celsius * 9 / 5 + 32`; `t = Temperature(25)`; `print(t.fahrenheit)`; `t.celsius = 100`; `print(t.fahrenheit)`; output `77.0\n212.0`.
- Production use: Validating values and keeping a stable public interface while internals change.
- Common mistakes: Heavy/slow work inside a property; infinite recursion by assigning `self.celsius` inside its own setter.
- Sources: https://docs.python.org/3/library/functions.html#property

### Inheritance and super()
- Concept: `class Admin(User):` reuses and extends a parent class. Override methods; call the parent version with `super()`. Prefer shallow hierarchies; composition (having an object as an attribute) is often simpler.
- Analogy: A new phone model keeps everything from the last one and adds a better camera.
- Code example: `inheritance.py` — `class User: def __init__(self, name: str) -> None: self.name = name` / `def permissions(self) -> list[str]: return ["read"]`; `class Admin(User): def permissions(self) -> list[str]: return super().permissions() + ["write", "delete"]`; `print(User("Bo").permissions())`; `print(Admin("Ada").permissions())`; `print(isinstance(Admin("Ada"), User))`; output `['read']\n['read', 'write', 'delete']\nTrue`.
- Production use: Framework base classes (e.g. custom exceptions, web views) are extended this way.
- Common mistakes: Deep inheritance chains; forgetting to call `super().__init__()` when overriding `__init__`.
- Sources: https://docs.python.org/3/tutorial/classes.html#inheritance ; https://docs.python.org/3/library/functions.html#super

### Special methods (__repr__, __eq__, __len__)
- Concept: "Dunder" (double underscore) methods let objects work with built-in operations: `__repr__` (developer-friendly text), `__str__` (user-friendly), `__eq__` (`==`), `__len__` (`len()`), `__lt__` (`<`).
- Analogy: Standard plugs: if your appliance has the standard plug, it fits every socket in the house.
- Code example: `cart.py` — `class Cart: def __init__(self) -> None: self.items: list[str] = []`; `def add(self, item: str) -> None: self.items.append(item)`; `def __len__(self) -> int: return len(self.items)`; `def __repr__(self) -> str: return f"Cart({self.items!r})"`; `def __eq__(self, other: object) -> bool: return isinstance(other, Cart) and self.items == other.items`; usage: `a = Cart(); a.add("pen")`; `b = Cart(); b.add("pen")`; `print(len(a))`; `print(a)`; `print(a == b)`; output `1\nCart(['pen'])\nTrue`.
- Production use: Good `__repr__` makes logs and debugging readable.
- Common mistakes: Defining `__eq__` that crashes on other types; confusing `__str__` and `__repr__`.
- Sources: https://docs.python.org/3/reference/datamodel.html#special-method-names

## Quiz
1. What is `self`? — tests instance reference
2. When does `__init__` run? — tests constructor
3. What does `@property` let you do? — tests properties
4. Which method controls what `len(obj)` returns? — tests __len__
5. What does `super().method()` call? — tests inheritance
