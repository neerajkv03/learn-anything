export const meta = {
  name: 'learn-course-pipeline',
  description: 'LEARN.md Phases 3+5: write each topic, review accuracy + clarity, fix, re-verify (max 2 rounds)',
  whenToUse: 'LEARN.md Phase 3-5 after Gate 2, once per batch (≤6 topics if authoring, ≤12 review-only). args: {slug, version, topics: [topic slugs to verify], author?: [subset to write first; default = topics], reviewers?: [accuracy | clarity] (default = both)}',
  phases: [
    { title: 'Author', detail: 'learn-author (sonnet), one per topic' },
    { title: 'Review', detail: 'learn-accuracy (sonnet, ≤3 topics) + learn-clarity (haiku, ≤6 topics)' },
    { title: 'Fix', detail: 'learn-fixer, one per failing topic (haiku if clarity-only issues, else sonnet)' },
    { title: 'Re-verify', detail: 'only the reported issues, max 2 rounds' },
  ],
}

// Run via Workflow({scriptPath: "tools/course-pipeline.js", args: {...}}). Agent rules live in .claude/agents/learn-*.md.
const { slug, version } = args
const topics = args.topics
const author = new Set(args.author || topics)
if (!slug || !version || !Array.isArray(topics) || !topics.length) throw new Error('args: {slug, version, topics: [...]} required')
// LEARN.md batches: ~15–20 agents per run. Review-only runs use ~half the agents per topic.
const max = author.size ? 6 : 12
if (topics.length > max) throw new Error(`batch too big: ${topics.length} topics (max ${max}${author.size ? ' when authoring' : ' review-only'}); split into batches`)

// LEARN.md: max 4 agents running at once.
let active = 0
const waiting = []
const limit = async (fn) => {
  while (active >= 4) await new Promise((r) => waiting.push(r))
  active++
  try { return await fn() } finally { active--; const next = waiting.shift(); if (next) next() }
}
const run = (type, model, phase, task, body, schema) => limit(() => agent(
  `LEDGER: ${phase} | ${task}\nSLUG=${slug}\nVERSION=${version}\n${body}\nFollow your agent instructions.`,
  { agentType: type, model, phase: phase.replace(/^Phase \d /, ''), label: `${type}:${task}`, schema }))

const AUTHOR = { type: 'object', properties: { ok: { type: 'boolean' }, note: { type: 'string' } }, required: ['ok'] }
const REVIEW = {
  type: 'object',
  properties: { topics: { type: 'array', items: { type: 'object', properties: {
    slug: { type: 'string' }, pass: { type: 'boolean' }, issues: { type: 'array', items: { type: 'string' } },
  }, required: ['slug', 'pass', 'issues'] } } },
  required: ['topics'],
}
const FIX = { type: 'object', properties: { fixed: { type: 'array', items: { type: 'string' } }, skipped: { type: 'array', items: { type: 'string' } } }, required: ['fixed', 'skipped'] }

const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))
const range = (g) => g.length > 1 ? `${g[0].slice(0, 2)}–${g[g.length - 1].slice(0, 2)}` : g[0]

// One review pass over a group of topics. Issues are tagged ACC (accuracy), CLR (clarity), CHK (scripted check).
// prior = {slug: [tagged issues]} → re-verify mode: each reviewer gets only its own tags (accuracy also re-checks CHK).
// skips = {slug: [fixer skip reasons]} → shown in re-verify so the reviewer can accept or reject each skip.
// NOV = no verdict even after one retry: the topic is flagged, never sent to a fixer.
const REVIEWERS = [
  { tag: 'ACC', own: ['ACC', 'CHK'], type: 'learn-accuracy', model: 'sonnet', size: 3, name: 'accuracy' },
  { tag: 'CLR', own: ['CLR'], type: 'learn-clarity', model: 'haiku', size: 6, name: 'clarity' },
]
const review = async (group, prior, skips) => {
  const issues = Object.fromEntries(group.map((t) => [t, []]))
  const mine = (R, t) => (prior?.[t] || []).filter((x) => R.own.includes(x.slice(0, 3)))
  const job = ({ R, g }) => () => {
    const skip = (t) => skips?.[t]?.length ? `\n  Fixer skipped (judge each reason):\n  - ${skips[t].join('\n  - ')}` : ''
    const ctx = prior ? `\nRe-verify mode. Prior issues:\n${g.map((t) => `${t}:\n- ${mine(R, t).map((x) => x.slice(5)).join('\n- ')}${skip(t)}`).join('\n')}` : ''
    const phase = prior ? 'Phase 5 re-verify' : `Phase 5 ${R.name}`
    return run(R.type, R.model, phase, `${R.name} ${range(g)}`, `Topics: ${g.join(', ')}${ctx}`, REVIEW)
  }
  const jobs = []
  for (const R of REVIEWERS.filter((R) => !args.reviewers || args.reviewers.includes(R.name)))
    for (const g of chunk(prior ? group.filter((t) => mine(R, t).length) : group, R.size)) jobs.push({ R, g })
  // Fail closed: a topic passes only if its reviewer returned its exact slug with pass=true.
  // Returns the {R, g} jobs whose topics got no verdict, so the same review (full or re-verify) can be re-run.
  const collect = async (list) => {
    const out = await parallel(list.map(job))
    const missing = []
    list.forEach(({ R, g }, i) => {
      const got = Object.fromEntries((out[i]?.topics || []).map((x) => [x.slug, x]))
      const lost = g.filter((t) => !got[t])
      for (const t of g) if (got[t] && !got[t].pass) issues[t].push(...(got[t].issues?.length ? got[t].issues : ['marked fail without detail']).map((i) => `${R.tag}: ${i}`))
      if (lost.length) missing.push({ R, g: lost })
    })
    return missing
  }
  const missing = await collect(jobs)
  if (missing.length) for (const { R, g } of await collect(missing)) for (const t of g) issues[t].push(`NOV: no ${R.name} verdict after retry`)
  return issues
}
const nov = (list) => list.some((x) => x.startsWith('NOV'))

const result = {}
await pipeline(
  chunk(topics, 6),
  // Phase 3: write (topics already written are skipped). Author runs check-topic.mjs itself.
  async (group) => {
    const todo = group.filter((t) => author.has(t))
    const out = await parallel(todo.map((t) => () => run('learn-author', 'sonnet', 'Phase 3 content', t, `Topic=${t}`, AUTHOR)))
    const pre = {}
    for (const [t, r] of todo.map((t, i) => [t, out[i]])) if (!r || !r.ok) pre[t] = [`CHK: node tools/check-topic.mjs ${slug} ${t} fails: ${r ? r.note || 'see output' : 'author agent failed; file may be missing'}`]
    return pre
  },
  // Phase 5: review, then up to 2 fix → re-verify rounds per failing topic.
  async (pre, group) => {
    const first = await review(group)
    let open = {}
    for (const t of group) {
      const all = [...(pre[t] || []), ...first[t]]
      if (!all.length) result[t] = { status: 'done' }
      else if (nov(all)) result[t] = { status: 'flagged', issues: all }
      else open[t] = all
    }
    for (let round = 1; round <= 2 && Object.keys(open).length; round++) {
      const failing = Object.keys(open)
      // Clarity-only issues carry exact replacement text → Haiku; any ACC/CHK issue needs Sonnet's hand-tracing.
      const fixModel = (t) => open[t].every((x) => x.startsWith('CLR')) ? 'haiku' : 'sonnet'
      const fixes = await parallel(failing.map((t) => () => run('learn-fixer', fixModel(t),'Phase 5 fix', `${t} r${round}`, `Topic=${t}\nIssues:\n- ${open[t].join('\n- ')}`, FIX)))
      const skips = {}
      failing.forEach((t, i) => { const s = fixes[i]?.skipped || []; if (s.length) { skips[t] = s; log(`${t} r${round} skipped: ${s.join(' | ')}`) } })
      const again = await review(failing, open, skips)
      const next = {}
      for (const t of failing) {
        if (!again[t].length) result[t] = { status: 'done', rounds: round }
        else if (nov(again[t])) result[t] = { status: 'flagged', issues: again[t] }
        else next[t] = again[t]
      }
      open = next
    }
    for (const t of Object.keys(open)) result[t] = { status: 'flagged', issues: open[t] }
    log(`${range(group)}: ${group.map((t) => `${t.slice(0, 2)}=${result[t]?.status}`).join(' ')}`)
  },
)
return result
