# LEARN — Programming Language Course Generator

**Invocation:**

| Message | Does |
|---|---|
| `@LEARN.md <language>` (e.g. `@LEARN.md python`) | Start a course. Add the word `grill` (`@LEARN.md python grill`) to be interviewed first (see Optional skills). |
| `@LEARN.md <SLUG>` | Resume that course at its next step (after every `/clear`, in every mode). |
| `@LEARN.md extend <SLUG> <addition>` | Add topics to a finished course (see Extend course). |
| `@LEARN.md refresh <SLUG>` | Re-check a finished course against a newer VERSION (see Refresh course). |
| `@LEARN.md audit <SLUG> [topic slugs] [accuracy\|clarity]` | Re-review finished topics without rewriting them (see Audit course). |

- `LANG` = the language named in the message. If none is named, ask once, then proceed.
- `SLUG` = lowercase kebab-case of LANG, with symbols spelled out (`C#` → `csharp`, `C++` → `cpp`, `Node.js` → `nodejs`).
- `VERSION` = the latest **LTS** release of LANG, **verified at run time** (Phase 1 step 0), never from memory alone. State it in every output.
  - LTS only: if the project publishes LTS lines (Node.js, Java, .NET…), use the newest LTS, never a newer non-LTS "current" release. If it has no LTS concept (Python, Go, Rust…), use the latest stable release. The same rule applies to every tool and library in VERSION.
- LANG may name a toolchain too (e.g. "python with uv"). Verify each tool's version; VERSION lists all of them (e.g. `Python 3.15.2 + uv 0.13.7`).
- **Never inspect or depend on the local machine's toolchain.** Content states the VERSION it needs and the learner installs it manually. Code is not executed (see Phase 5).

`./DESIGN.md` is the design spec for all output UI. It is applied through `tools/app-template/` (Phase 4).

---

## Sessions (one per phase group)

Context grows with every turn, and every call re-reads it. So each phase group runs in its **own session**:

| Session | Work | Ends with |
|---|---|---|
| A | Phase 0 + 1 | Gate 1 |
| B | Phase 2 | Gate 2 |
| C | Phase 3 + 4 + 5 + Finish | Finish report |

- **First action of every session** (fresh runs included): record this session's id in `SLUG/plans/sessions.txt`. The id is in env var `CLAUDE_CODE_SESSION_ID`. In bash: `mkdir -p SLUG/plans && echo "$CLAUDE_CODE_SESSION_ID" >> SLUG/plans/sessions.txt`. The token report reads this file.
- At a gate, show the gate summary and stop. When the user approves:
  - record the approval (`Approved:` line);
  - tell the user: "Run `/clear`, then `@LEARN.md <SLUG>` to continue." (always the SLUG, in every mode)
  - Then end the turn.

  RESUME picks up from the status columns. If the user insists on continuing in the same session, that is allowed.
- Read only what the current phase needs. Never read generated topic data into the main session; scripts and subagents report summaries.

## Approval gates (mandatory)

After every planning step, **stop and wait for the user's response**. Do not continue on silence or assumption.
- Gate 1: after Phase 1 (topic list).
- Gate 2: after Phase 2 (all plans).
- On RESUME: if the next phase follows a gate not yet approved, show what is ready and wait.
- Record approval in the `Approved:` header line of `TOPIC_SUBTOPIC_LIST.md`: flip `✗` → `✓` per gate.

---

## Model routing (mandatory)

| Work | Model | How |
|---|---|---|
| Planning and orchestration (topic list, per-topic plans, coordination) | Opus | Main session. If the main session is not Opus, tell the user to run `/model opus` and stop. |
| Content generation (topic data) | Sonnet | agent type `learn-author` |
| Factual accuracy review | Sonnet | agent type `learn-accuracy`. Never the author. Only after scripted checks pass. |
| Clarity review | Haiku | agent type `learn-clarity`. Only after scripted checks pass. |
| Fixes | Sonnet | agent type `learn-fixer` |
| Version lookup, DESIGN.md checklist | Haiku | general agent with `model: "haiku"` |

- Agent definitions live in `.claude/agents/learn-*.md` and hold all static rules (schema, content rules, self-check list, report format). Launch prompts stay tiny. Never paste those rules into a prompt; edit the agent file instead.
- **Every subagent prompt starts with** `LEDGER: <phase> | <task>` (e.g. `LEDGER: Phase 3 content | 01-variables-types`). The token report labels agents from this line, so `agents.tsv` is not needed.
- Max 4 subagents running at once (count every running agent).
- **Phases 3 and 5 run as one Workflow** (see Phase 3). Use the Agent tool only as a fallback.
- **Every review, audit or re-review of more than 2 topics runs through the Workflow** (`author: []`), never as Agent calls from the main session. Each agent report lands in the main context and is re-read on every later call.

---

## Optional skills (use if installed)

- **caveman**: orchestrator chat and progress updates. **Never** in learner-facing text: global rule 2 wins. Gate summaries stay terse but list every topic, sub-topic and goal in full. Subagent reports are already terse by agent definition.
- **grilling** (in `.claude/skills/`; the user's `/grill-me` runs the same skill): only when the user asks for it, by the word `grill` in the invocation or `/grill-me` at a gate. Never start it unasked.
  - Where: Session A, before the topic list (new course) or before the new rows (extend). At Gate 1 it may challenge the list instead.
  - What to settle: audience, goal, toolchain, OS, depth, what to leave out.
  - Result: ≤15 terse lines of decisions in `SLUG/plans/_brief.md`. Phases 1 and 2 read it if it exists. Subagents never read it; the plans carry it.
  - Its questions stay full prose (no caveman). Its fact-finding subagents count toward the max of 4. Afterwards, continue to the gate as usual.
- **ponytail**: code in `tools/`. Never cuts a DESIGN.md checklist item, `textContent` safety, or try/catch on storage. Content code examples stay minimal but must still fully show the concept (this rule is in `learn-author`).
- Neither skill overrides approval gates, model routing or accuracy rules.

---

## Global content rules (apply to every phase)

1. **Production-relevant only.** Include the topics, sub-topics and features commonly used in production-grade LANG code. Skip trivia, deprecated, rarely used or legacy-only features.
2. **Zero-knowledge learner.** Assume no prior programming knowledge. Define every term at first use. Order from beginner to production level.
3. **Real-life analogies** for every non-trivial concept, sub-topic or term.
4. **Accuracy over volume.** Use only syntax and APIs valid for VERSION. If unsure about a fact, leave it out.
5. **All learning content is JSON** (schema in `.claude/agents/learn-author.md`).

---

## Phase 0 — Scaffold (idempotent)

1. If `./SLUG/` exists (the message may name the SLUG itself or the language) → **RESUME**:
   - Record the session id (see Sessions).
   - Read only the header lines (`Approved:`, `App:`) and the status columns in `SLUG/TOPIC_SUBTOPIC_LIST.md`.
   - Continue from the first item that is not `done`, in the correct phase. Do not regenerate finished work.
2. Otherwise create:

```
SLUG/
├── TOPIC_SUBTOPIC_LIST.md
├── TOKEN_USAGE.md          (written at Finish)
├── plans/                  (+ _taught.md, _version-notes.md, sessions.txt; _brief.md if grilled)
└── output/                 (Phase 4: copied from tools/app-template/)
    └── data/
```

---

## Phase 1 — Topic list (Opus) → `SLUG/TOPIC_SUBTOPIC_LIST.md`

0. **Verify VERSION.** Use one Haiku subagent to search and fetch the official LANG release page (e.g. python.org/downloads, nodejs.org, go.dev/dl). Use the newest LTS release, or the latest stable release if the project has no LTS (no betas, RCs or non-LTS "current" lines). Record the version, date checked and source URL in the header. If the lookup fails, tell the user and ask them to confirm VERSION before continuing.
   - **Version notes.** The same subagent also fetches the official "What's new" / release-notes page for VERSION and writes `SLUG/plans/_version-notes.md`: ≤40 terse lines per tool (new syntax and APIs, changed defaults, removals, deprecations), each with its source URL, taken only from the fetched page. Planning (Phase 2), authors and accuracy reviewers read it; it wins over model memory.

- 15–25 topics, 3–8 sub-topics each (an Extend run may go past 25).
- Ordered by dependency: each topic needs only earlier topics.
- Slug format: `NN-kebab-title` (e.g. `01-variables-types`).

Exact format:

```markdown
# <LANG> Learning Path (v<VERSION>)

Version checked: <VERSION> on <YYYY-MM-DD> via <official source URL>
Approved: list ✗ | plans ✗
App: todo | App verified: todo

| # | Topic | Slug | Sub-topics | Plan | Content | Verified |
|---|-------|------|------------|------|---------|----------|
| 01 | Variables & Types | 01-variables-types | Declaring variables; Primitive types; Type conversion | todo | todo | todo |
```

**STOP (Gate 1).** Show the list and wait for approval or edits. Add one line: "`/grill-me` stress-tests this list." On approval, tell the user to `/clear` and re-invoke.

---

## Phase 2 — Plans (Opus) → `SLUG/plans/<slug>.md` + `SLUG/plans/_taught.md`

Read `plans/_version-notes.md` first, and `plans/_brief.md` if it exists. Plans are internal notes read only by Sonnet authors. Write them **terse**: fragments, no filler prose. Keep everything concrete: name the analogy, give exact example values and exact expected output, and give the exact source URL. Never trade specificity for brevity.

One file per topic:

```markdown
# <NN>. <Topic title>
Version: <VERSION>
Prerequisites: <slugs or "none">

## Learning goals
- <learner can ...>

## Sub-topics
### <Sub-topic title>
- Concept: <what to explain>
- Analogy: <concrete idea; must cover the whole sub-topic, incl. contrasting parts>
- Code example: <filename — what it does, exact values → exact expected output>
- Production use: <where in real code>
- Common mistakes: <1-3>
- Sources: <1-3 official doc URLs, deep link to exact section>

## Quiz
1. <question idea> — tests <concept>
(3-5 questions)
```

**`_taught.md`**: one line per topic listing the terms, constructs and error names that topic **introduces**, e.g. `04-strings: str, indexing [i], slicing, f-strings, len(), .upper()/.split(), TypeError (glossed)`. Authors and reviewers use it to tell what is "already taught". Plan each topic to gloss anything it uses before the topic that teaches it.

Update the `Plan` column → `done` after each file.

**STOP (Gate 2).** Show a summary of all plans (topic, sub-topics, learning goals) and wait. Never start content generation without explicit approval. On approval, tell the user to `/clear` and re-invoke.

---

## Phase 3 + 5 — Content and verification (one Workflow)

Run Phase 4 first (it takes seconds), then call:

```
Workflow({ scriptPath: "tools/course-pipeline.js",
           args: { slug: "<SLUG>", version: "<VERSION>", topics: [<slugs not yet Verified>], author: [<slugs whose Content is not done>] } })
```

- This LEARN.md instruction is the user's opt-in to this workflow (~40–70 agents per course, max 4 running at once).
- Per group of 6 topics, the script runs:
  1. `learn-author` per topic. The author writes the file and runs `node tools/check-topic.mjs SLUG <slug>` itself.
  2. `learn-accuracy` (≤3 topics per agent) and `learn-clarity` (≤6 per agent).
  3. `learn-fixer` per failing topic.
  4. A re-verify of **only the reported issues**, each issue going back to the reviewer that raised it.
  5. Steps 3–4 repeat at most 2 rounds; anything still failing is flagged.
- It returns `{slug: {status: "done" | "flagged", issues?}}`.
- After it returns:
  1. Run `node tools/check-topic.mjs SLUG --links` (full schema + manifest + dead links).
     - Dead link → swap it for the parent doc page with one targeted edit (or a `learn-fixer` agent), then re-run.
  2. Update the `Content` and `Verified` columns in one edit: `done` or `flagged`.
- **Fallback** (Workflow tool unavailable or declined): run the same agent types with the Agent tool in the same order, max 4 at once, each prompt starting with its `LEDGER` line.
  - Launch prompts carry only `SLUG`, `VERSION`, topic slug(s) and, for fixer and re-verify, the issue list.
  - Batch reviews the same way (accuracy ≤3, clarity ≤6).
- Code is never executed. Authors trace output by hand; accuracy reviewers re-trace it.

---

## Phase 4 — Output app (copy, no agent)

1. Copy `tools/app-template/index.html`, `style.css` and `app.js` into `SLUG/output/`.
2. Write `SLUG/output/data/manifest.js`:
   ```js
   window.LANG = "<LANG>";
   window.SLUG = "<SLUG>";
   window.MANIFEST = ["01-...", "..."]; // all slugs, in order
   ```
3. Set the header to `App: done | App verified: done` (the template is already verified against DESIGN.md).

Rebuild the template only when DESIGN.md or the schema changes, or the user asks. Follow `tools/app-template/SPEC.md` for the rebuild. A rebuilt template needs its own DESIGN.md checklist review.

---

## Finish

**Token usage (always, last step):** from the repo root, run `node tools/token-usage.mjs SLUG`. It reads every session listed in `SLUG/plans/sessions.txt` (explicit ids override the file), labels agents from their `LEDGER` line, and writes `SLUG/TOKEN_USAGE.md` (by model, by phase, per agent, with a weighted cost column). If any row is `Unlabelled`, fix it and re-run. Don't edit the script per language.

Report to the user:
- LANG, VERSION, topic count
- files created
- VERSION source URL + date checked
- flagged topics + reasons; dead source links replaced
- versions the learner must install manually (VERSION), with official install links
- app status (`App verified`)
- token usage: total and weighted, main session vs subagents, top phase (from `SLUG/TOKEN_USAGE.md`)
- how to open: `SLUG/output/index.html`
- LEARN.md / agent-file changes made this run (see Self-improvement)

---

## Extend course (`@LEARN.md extend <SLUG> <addition>`)

Adds topics (e.g. a framework like FastAPI) to a finished course. It uses the same sessions, gates, model routing and Workflow. Existing topics are never regenerated.

1. **Session A (Phase 1, new rows only):**
   - Record the session id.
   - If the invocation says `grill`, run the grilling skill on the addition first (see Optional skills).
   - Verify each new tool's version (Phase 1 step 0, version notes included: append to `_version-notes.md`) and append it to VERSION and the `Version checked:` line.
   - **Drift check:** re-verify the course's existing VERSION too. If a newer LTS/stable exists, show old → new at Gate 1 and ask: **pin** (default: new topics target the course's VERSION) or **upgrade** (stop; the user runs `refresh` first, then `extend`).
   - Append the new rows, numbered after the last topic, with status `todo | todo | todo`. Use 3–8 sub-topics each, ordered by dependency on the existing topics.
   - Set `Approved: list ✗ | plans ✗`.
   - **STOP (Gate 1):** show only the new rows.
2. **Session B (Phase 2, new rows only):**
   - If `plans/_taught.md` is missing, build it first, one line per existing topic, from the existing plans. Never read topic data for this.
   - Then write the new plans, and append their `_taught.md` lines. Prerequisites may name any earlier slug.
   - A plan that needs a library not version-checked in Session A: verify it (Phase 1 step 0) and append it to VERSION and `Version checked:` before Gate 2.
   - **STOP (Gate 2).**
3. **Session C:**
   - Phase 4 step 2 only: append the new slugs to `MANIFEST`. Update `window.LANG` if the addition changes the course name. Do not re-copy the app template.
   - Run `node tools/check-topic.mjs SLUG --set-version "<VERSION>"` so existing topics show the full new VERSION string (script edit; never read the data).
   - Then run the Workflow with `topics` and `author` set to the new slugs only.
   - Then Finish. The token report covers every session in `sessions.txt`, old ones included.
4. **Existing topics:** only change them if the user asks (e.g. a forward pointer to the new section). Use `learn-fixer` with a targeted issue list. Never use `learn-author`.

---

## Audit course (`@LEARN.md audit <SLUG> [topic slugs] [accuracy|clarity]`)

Re-reviews finished topics. No new topics, no plans, no author agents. One session.

1. Record the session id.
2. Run the Workflow with `topics` = the named slugs (default: all), `author: []`, and `reviewers` if the user named one. The script reviews, fixes and re-verifies as in Phase 3 + 5.
3. Then the link check, the `Verified` column update and Finish, as in Phase 3 + 5.

Never launch the reviewers by hand from the main session, and never read topic data into it.

---

## Refresh course (`@LEARN.md refresh <SLUG>`)

Re-checks a finished course against a newer VERSION. No new topics, no plans, no author agents.

1. **Session A:**
   - Record the session id.
   - Verify every tool in VERSION (Phase 1 step 0). Nothing newer → tell the user and stop.
   - Append what changed between the old and new versions to `plans/_version-notes.md` under `## <old> → <new>`.
   - **STOP (Gate 1):** show old → new per tool, plus the notes. Change nothing before approval.
   - On approval, in this order:
     1. Update the title and `Version checked:` line.
     2. Run `node tools/check-topic.mjs SLUG --set-version "<VERSION>"`.
     3. Set every `Verified` cell → `todo`.
     4. Tell the user to `/clear` and send `@LEARN.md <SLUG>`.
2. **Session C** (RESUME sees Content `done`, Verified `todo`): run the Workflow with `topics` = all slugs, `author: []`, `reviewers: ["accuracy"]`. Then the link check and Finish, as in Phase 3 + 5.

---

## Self-improvement (standing authorization from user)

The orchestrator may edit this file, `.claude/agents/learn-*.md` and `tools/*` whenever a session reveals a better rule. There is no need to ask first; always report it.

- **When:** a failure repeats (the same verify issue in 2+ topics), a rule is ambiguous or contradicts another, a step wastes time or tokens, a toolchain quirk appears, or the user corrects the process.
- **How:** make the smallest edit that prevents recurrence, in the file that governs that step.
  - A review issue that repeats becomes a line in `learn-author.md`'s self-check list.
  - Keep rules general. LANG-specific facts go in that language's `SLUG/plans/` notes.
- **Never:** loosen approval gates, model routing, accuracy rules or `textContent` safety without explicit user approval. Do not regenerate finished work just because a rule changed.
- **DESIGN.md:** the user's portable design spec, also used outside this project. Propose changes to it; apply them only after approval.
- **Log:** add one line per change to the Changelog below, then mention it in the Finish report.

## Changelog

- 2026-11-11 — VERSION verified online at run time; accuracy review moved to Sonnet (Haiku keeps clarity/checklist); `App:` / `App verified:` header status; deterministic single-file code rule + `RUN_RECIPE.md` + 10 s timeout + normalized compare; quiz answer-index spread check; `Approved:` line added to template; offline Prism limit documented; Self-improvement section added.
- 2026-11-11 — Optional skills section: caveman (orchestrator/subagent reports only, never learner content) and ponytail (app + script code), used only if installed; subagents get the rule as one prompt line.
- 2026-11-11 — (user request) Code no longer executed: author writes expected output by hand, accuracy reviewer traces it; RUN_RECIPE + local toolchain checks removed, learner installs VERSION manually. Per-sub-topic `sources` (official docs) added to plan template, schema, app mapping (`ul.meta` link chips) and scripted link check. Multi-tool LANG (e.g. "python with uv") → VERSION lists each tool. Phase 4 font reference fixed (DESIGN.md now uses Rubik, not Open Sans).
- 2026-11-11 — Content authors must parse-check the `push(...)` wrapper (closing `);` dropped in 2 topics). Phase 5 reviews may batch topics per subagent (accuracy ≤3, clarity ≤6) to save tokens; reviewer still never the author.
- 2026-11-11 — (user request) Token usage step: agent ledger `SLUG/plans/agents.tsv` + `tools/token-usage.mjs` → `SLUG/TOKEN_USAGE.md`, summarised in Finish report. Max-4 limit counts all running agents.
- 2026-11-11 — Phase 3: gloss later-topic terms (error names, import, list) and jargon in productionNote/commonMistakes at first use; prose commands use the course toolchain (clarity review flagged this in 10+ topics).
- 2026-11-11 — Codeblock lang label = display name of `code.language`, not LANG (bash/TOML blocks were labelled with the course language).
- 2026-11-12 — (user request, token optimisation; python-uv run: 43M tokens, 62% orchestrator) One session per phase group + `plans/sessions.txt`. Phases 3+5 run as `tools/course-pipeline.js` Workflow (orchestrator no longer woken per agent). Project agents `.claude/agents/learn-{author,accuracy,clarity,fixer}.md` hold static rules (shared cached prefix, tiny prompts). `LEDGER:` prompt line replaces `agents.tsv`. Shared validator `tools/check-topic.mjs` (authors self-check, ≤4 calls). Phase 4 = copy verified `tools/app-template/` (spec moved to `SPEC.md`). Re-verify checks only reported issues; fixer uses targeted edits. Phase 2 adds `_taught.md` + terse plans. Author self-check list built from python-uv review findings. Token report adds weighted column. Project `.claude/settings.json` disables unused plugins (postman, superpowers).
- 2026-11-12 — (user request) Superpowers kept only as 5 project skills in `.claude/skills/` (verification-before-completion, systematic-debugging, dispatching-parallel-agents, writing-skills, diagnosing-superpowers). Plugin stays off: plugin skills can't be toggled one by one, and brainstorming/plans/TDD/worktree/review skills clash with LEARN.md's flow.
- 2026-11-12 — (user request) Extend course section + `extend <SLUG>` invocation: append topics to a finished course (new rows only, gates re-opened, `_taught.md` rebuilt if missing, manifest append, Workflow on new slugs); >25 topics allowed when extending.
- 2026-11-12 — Extend Session B: libraries first needed by a plan (python-uv: pydantic-settings, pwdlib, PyJWT) are version-verified and appended to VERSION before Gate 2.
- 2026-11-14 — (user request, token review of python-uv) Web fetching measured at 1.7% of weighted tokens: no MCP/skill added for docs. New `audit <SLUG>` invocation + Model routing rule: reviews of >2 topics run through the Workflow (`author: []`), never hand-launched from the main session (a hand-run audit took 136 main-session calls, context to 388K, 35M cache reads; the Workflow run took 14 calls, ≤90K). `learn-fixer`: all Greps in one message, all Edits in one message.
- 2026-11-12 — `tools/token-usage.mjs`: LEDGER searched across leading user messages, not only the first (Workflow harness prepends a relay message; all 31 python-uv extend agents showed as Unlabelled).
- 2026-11-14 — (user request, kit review) `tools/course-pipeline.js`: review fails closed (topic passes only if its reviewer returns its exact slug with pass=true; missing verdict or dead agent → issue); optional `reviewers` arg. `tools/*.mjs`: `fileURLToPath` (kit path with a space broke both tools).
- 2026-11-14 — (user request) VERSION = newest LTS (latest stable only when the project has no LTS). Phase 1 step 0 writes `plans/_version-notes.md` from the official release notes; planner, authors and accuracy reviewers read it. Extend: drift check (pin or upgrade) + `check-topic.mjs --set-version`; whole-course check flags mixed versions. New `refresh <SLUG>` mode (accuracy-only re-verify). Resume is always `@LEARN.md <SLUG>`.
- 2026-11-14 — (user request) Optional grilling skill: opt-in by `grill` in the invocation or `/grill-me` at Gate 1; result in `plans/_brief.md`. `programming_language/` removed (empty placeholder; Phase 0 tree is the reference). `.claude/settings.json`: allow rules for the two `node tools/...` commands.
- 2026-11-14 — (user request) Project `.claude/settings.json` also disables the claude.ai-synced plugins (`figma`, `codesign`, `design`, `design-skills`, `cowork-plugin-management`, `ux-agent-skills` as `<name>@synced`); CLAUDE.md limits skill use to `.claude/skills/` + caveman + ponytail.
