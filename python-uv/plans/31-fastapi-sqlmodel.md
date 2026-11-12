# 31. Databases with SQLModel
Version: Python 3.15.2 + uv 0.13.7 + FastAPI 0.162.5 + SQLModel 0.0.49 + SQLite 3.54.1
Prerequisites: 25-sqlite-sqlite3, 30-fastapi-dependencies

## Learning goals
- After this topic, learner can define SQLModel table models.
- After this topic, learner can create an engine for a SQLite file and create tables.
- After this topic, learner can provide a DB session per request with a `yield` dependency.
- After this topic, learner can write create/read/update/delete endpoints.
- After this topic, learner can split models into Base / table / Create / Public / Update.

(Output format: request → status + exact JSON body, assuming a fresh empty database.)

## Sub-topics
### SQLModel table models
- Concept: SQLModel = library by FastAPI's author combining Pydantic (validation) and SQLAlchemy (gloss: the most used Python database toolkit). ORM (Object-Relational Mapper) = Python classes ↔ DB tables, objects ↔ rows, no hand-written SQL. `class Hero(SQLModel, table=True)` = a table; `Field(primary_key=True)`, `Field(index=True)` (index = lookup speed-up, like a book index). `id: int | None = Field(default=None, primary_key=True)` — `None` until the DB assigns it. Table name defaults to lowercase class name. Install `uv add sqlmodel`.
- Analogy: A translator between Python and the filing cabinet: you hand it an object, it fills in a card.
- Code example: `models.py` — `from sqlmodel import Field, SQLModel`; `class Hero(SQLModel, table=True): id: int | None = Field(default=None, primary_key=True); name: str = Field(index=True); age: int | None = Field(default=None, index=True)`; `hero = Hero(name="Ada", age=36)`; `print(hero.name, hero.id)`; `print(Hero.__tablename__)`; output `Ada None\nhero`.
- Production use: Data layer of FastAPI apps.
- Common mistakes: Forgetting `table=True` (no table, just a data model); `id: int` without default (can't create objects before saving).
- Sources: https://sqlmodel.tiangolo.com/tutorial/create-db-and-table/ ; https://sqlmodel.tiangolo.com/#sql-databases-in-fastapi

### Engine and SQLite URL
- Concept: Engine = object that manages connections to one database; create once per app. SQLite URL `sqlite:///database.db` (file, relative path, three slashes); `sqlite://` = in-memory. `connect_args={"check_same_thread": False}` needed for SQLite with FastAPI (requests may run in different threads; gloss threads → topic 22). `SQLModel.metadata.create_all(engine)` creates missing tables. `Session(engine)` = one unit of work; `session.add`, `session.commit`, `session.exec(select(Hero))`. `echo=True` prints SQL (debug).
- Analogy: Engine = the phone line to the cabinet's clerk; session = one phone call where you make several requests, then say "commit" to confirm.
- Code example: `engine_demo.py` — `from sqlmodel import Field, Session, SQLModel, create_engine, select`; Hero model as above; `engine = create_engine("sqlite://")`; `SQLModel.metadata.create_all(engine)`; `with Session(engine) as session:` `session.add(Hero(name="Ada", age=36))`; `session.commit()`; `heroes = session.exec(select(Hero)).all()`; `print(len(heroes), heroes[0].name, heroes[0].id)`; output `1 Ada 1`. Explanation: real apps use `sqlite:///database.db` + `check_same_thread`.
- Production use: One engine per process, created at import/startup.
- Common mistakes: Creating an engine per request (slow); forgetting `create_all` (`no such table` error).
- Sources: https://sqlmodel.tiangolo.com/tutorial/fastapi/simple-hero-api/ ; https://sqlmodel.tiangolo.com/tutorial/select/

### Session dependency with yield
- Concept: `def get_session(): with Session(engine) as session: yield session`; `SessionDep = Annotated[Session, Depends(get_session)]` — each request gets its own session, closed afterwards (recap topic 30). Tables created at module import here with `SQLModel.metadata.create_all(engine)`; topic 32 moves this into lifespan.
- Analogy: Each customer gets their own phone call to the clerk; it hangs up when they leave.
- Code example: `main.py` — imports (`Annotated`, `Depends`, `FastAPI`, sqlmodel names); Hero model; `engine = create_engine("sqlite:///database.db", connect_args={"check_same_thread": False})`; `SQLModel.metadata.create_all(engine)`; `def get_session(): with Session(engine) as session: yield session`; `SessionDep = Annotated[Session, Depends(get_session)]`; `app = FastAPI()`; `@app.get("/heroes/") def read_heroes(session: SessionDep) -> list[Hero]: return list(session.exec(select(Hero)).all())`; output: `GET /heroes/` → `200` `[]`.
- Production use: Standard FastAPI DB pattern.
- Common mistakes: One global session shared by all requests (data leaks between requests, thread problems); forgetting `check_same_thread`.
- Sources: https://fastapi.tiangolo.com/tutorial/sql-databases/#create-a-session-dependency

### Create and read endpoints
- Concept: Create: `session.add(hero)`, `session.commit()`, `session.refresh(hero)` (reload DB-filled fields like `id`), return. Read many: `select(Hero).offset(offset).limit(limit)`. Read one: `session.get(Hero, hero_id)` → object or `None` → 404.
- Analogy: Filing a new card and getting back the stamped card number; looking up a card by its number.
- Code example: extend `main.py` — `@app.post("/heroes/") def create_hero(hero: Hero, session: SessionDep) -> Hero: session.add(hero); session.commit(); session.refresh(hero); return hero`; `read_heroes(session: SessionDep, offset: int = 0, limit: Annotated[int, Query(le=100)] = 100)` using offset/limit; `@app.get("/heroes/{hero_id}") def read_hero(hero_id: int, session: SessionDep) -> Hero: hero = session.get(Hero, hero_id); if not hero: raise HTTPException(status_code=404, detail="Hero not found"); return hero`; output: `POST /heroes/` body `{"name": "Ada", "age": 36}` → `200` `{"id":1,"name":"Ada","age":36}`; `GET /heroes/1` → `200` `{"id":1,"name":"Ada","age":36}`; `GET /heroes/9` → `404` `{"detail":"Hero not found"}`.
- Production use: Every CRUD API.
- Common mistakes: Forgetting `commit` (nothing saved); forgetting `refresh` (missing `id`); letting clients send `id` (fixed in sub-topic 6).
- Sources: https://fastapi.tiangolo.com/tutorial/sql-databases/#create-a-hero ; https://sqlmodel.tiangolo.com/tutorial/one/

### Update and delete endpoints
- Concept: PATCH with an all-optional model `HeroUpdate(SQLModel)` (`name: str | None = None`, `age: int | None = None`); `hero.model_dump(exclude_unset=True)` (recap topic 27) → only sent fields; `hero_db.sqlmodel_update(data)`; add, commit, refresh. Delete: `session.delete(hero)`, `session.commit()`, return `{"ok": True}`.
- Analogy: Correcting one box on a card with correction tape, rather than rewriting the card; shredding a card.
- Code example: extend `main.py` — `class HeroUpdate(SQLModel): name: str | None = None; age: int | None = None`; `@app.patch("/heroes/{hero_id}") def update_hero(hero_id: int, hero: HeroUpdate, session: SessionDep) -> Hero:` get or 404; `hero_db.sqlmodel_update(hero.model_dump(exclude_unset=True))`; add/commit/refresh; return; `@app.delete("/heroes/{hero_id}") def delete_hero(hero_id: int, session: SessionDep) -> dict[str, bool]:` get or 404; `session.delete(hero)`; `session.commit()`; `return {"ok": True}`; output (after creating Ada, id 1): `PATCH /heroes/1` body `{"age": 37}` → `200` `{"id":1,"name":"Ada","age":37}`; `DELETE /heroes/1` → `200` `{"ok":true}`; `GET /heroes/1` → `404` `{"detail":"Hero not found"}`.
- Production use: Edit forms, admin panels.
- Common mistakes: `model_dump()` without `exclude_unset` (overwrites fields with `None`); deleting without checking existence.
- Sources: https://sqlmodel.tiangolo.com/tutorial/fastapi/update/ ; https://sqlmodel.tiangolo.com/tutorial/fastapi/delete/

### Separate Create / Public / Update models
- Concept: Different shapes for different jobs: `HeroBase` (shared fields), `Hero(HeroBase, table=True)` (+ `id`, `secret_name`), `HeroCreate(HeroBase)` (+ `secret_name`, no id), `HeroPublic(HeroBase)` (+ `id: int`, no secret), `HeroUpdate` (all optional). Convert: `Hero.model_validate(hero_create)`. Return type `HeroPublic` filters out `secret_name`.
- Analogy: Same person, different documents: application form (Create), public ID card (Public), change-of-address form (Update), full file in the archive (table).
- Code example: `main.py` models — `class HeroBase(SQLModel): name: str = Field(index=True); age: int | None = Field(default=None, index=True)`; `class Hero(HeroBase, table=True): id: int | None = Field(default=None, primary_key=True); secret_name: str`; `class HeroPublic(HeroBase): id: int`; `class HeroCreate(HeroBase): secret_name: str`; `class HeroUpdate(SQLModel): name: str | None = None; age: int | None = None; secret_name: str | None = None`; `@app.post("/heroes/") def create_hero(hero: HeroCreate, session: SessionDep) -> HeroPublic: db_hero = Hero.model_validate(hero); session.add(db_hero); session.commit(); session.refresh(db_hero); return db_hero`; output (fresh DB): `POST /heroes/` body `{"name": "Ada", "age": 36, "secret_name": "Countess"}` → `200` `{"name":"Ada","age":36,"id":1}`. Explain field order: base fields first, then `id`.
- Production use: Hiding secrets, preventing clients from setting ids, clear docs.
- Common mistakes: One model for everything (leaks `secret_name`, lets clients set `id`); changing table model columns without migrating an existing DB file (delete dev DB or use a migration tool — mention only).
- Sources: https://fastapi.tiangolo.com/tutorial/sql-databases/#heroes-with-multiple-models ; https://sqlmodel.tiangolo.com/tutorial/fastapi/multiple-models/

## Quiz
1. Why is `id` declared as `int | None = Field(default=None, ...)`? — tests DB-assigned ids
2. What does `session.refresh(hero)` do after commit? — tests refresh
3. Why is `exclude_unset=True` needed for PATCH? — tests partial updates
4. Why have a separate `HeroPublic` model? — tests response filtering
5. Why `check_same_thread=False` with FastAPI + SQLite? — tests threads/engine setup
