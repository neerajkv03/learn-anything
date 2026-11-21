# learn — course generator kit

Portable kit: `LEARN.md`, `CHANGELOG.md`, `DESIGN.md`, `CLAUDE.md`, `.claude/`, `tools/`. Copy it into a fresh folder to start new courses.

- `@LEARN.md <language>` runs the course generator (asks 5–10 intake questions first); `@LEARN.md <language>: <description>` adds free-text context that steers intake, topics and plans; `@LEARN.md <SLUG>` resumes; `extend <SLUG> <addition>` adds topics; `refresh <SLUG>` re-checks against a newer version; `audit <SLUG>` re-reviews finished topics. VERSION is always the newest LTS (latest stable if no LTS exists). LEARN.md is the process; follow it exactly. Each phase group runs in its own session (`/clear` between gates).
- After any plan (LEARN.md gates, task plans, design proposals): stop and wait for the user's explicit approval before implementing.
- `DESIGN.md` is the user's portable design spec: propose edits, apply only on approval.
- Skills allowed here: the ones in `.claude/skills/`, plus caveman and ponytail. Never invoke any other plugin skill or plugin MCP tool (figma, codesign, design, design-skills, cowork…) in this project, even if it is listed. `.claude/settings.json` turns those plugins off; a new unrelated plugin gets added there as `"<name>@<marketplace>": false` (`@synced` for claude.ai-synced ones).
- Claude Code setup stays project-level (`.claude/`, this file). Never edit global `~/.claude` config.
- Self-improvement: you may edit `LEARN.md`, `.claude/agents/learn-*.md` and `tools/*` from session lessons without asking. Log each change in `CHANGELOG.md` and report it.
- Subagents launched by LEARN.md use `.claude/agents/learn-*.md`; their rules live there, not in prompts.
- `.claude/skills/` holds 2 skills copied from superpowers 7.0.0 (MIT): verification-before-completion, writing-skills (trimmed to `SKILL.md` + `testing-skills-with-subagents.md`; use it when editing agent files). The plugin itself stays off here, because its other skills (brainstorming, writing-plans…) clash with LEARN.md's gates and phases.
- `.claude/skills/` also holds grill-me + grilling from mattpocock/skills (MIT, `LICENSE-mattpocock.txt`). `/grill-me` starts a relentless interview to stress-test a plan. In LEARN.md it is opt-in: `@LEARN.md <language> grill`, or `/grill-me` at Gate 1.
- `.claude/skills/` also holds karpathy-guidelines from multica-ai/andrej-karpathy-skills (MIT, `LICENSE-karpathy-skills.txt`): coding-behavior rules (think first, simplicity, surgical changes, verifiable goals). Auto-loads on code work (`tools/`, app-template), or `/karpathy-guidelines`.
- Tools (Node, no deps):
  - `tools/check-topic.mjs`: validate course data.
  - `tools/course-pipeline.js`: Workflow script for Phases 3+5.
  - `tools/token-usage.mjs`: token report.
  - `tools/app-template/`: verified app, copied into each course; `SPEC.md` for rebuilds.
- Generated courses live in `<slug>/`. Never regenerate finished work unless the user asks.
