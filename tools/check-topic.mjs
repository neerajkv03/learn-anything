// Scripted checks for course data (LEARN.md Phase 3 self-check + Phase 5 step 1).
// Usage: node tools/check-topic.mjs <SLUG> [topic-slug ...] [--links] [--set-version "<VERSION>"]
//   no topic slugs = check every file in <SLUG>/output/data; --links = also fetch every source URL.
//   --set-version = first rewrite the top-level "version" of the target topics (extend / refresh), then check.
// Prints one line per issue, "ok <file>" per clean file. Exit 1 if any issue.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (+process.versions.node.split(".")[0] < 20) { console.error(`Node 20+ required (found ${process.version}); --links needs fetch`); process.exit(1); }
const args = process.argv.slice(2);
const links = args.includes("--links");
const sv = args.indexOf("--set-version");
const setVersion = sv < 0 ? null : args.splice(sv, 2)[1];
if (sv >= 0 && !setVersion) { console.error("--set-version needs a value"); process.exit(1); }
const [slug, ...only] = args.filter((a) => a !== "--links");
if (!slug) { console.error("usage: node tools/check-topic.mjs <SLUG> [topic-slug ...] [--links] [--set-version \"<VERSION>\"]"); process.exit(1); }
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(repo, slug, "output", "data");
const issues = [];
const bad = (f, msg) => issues.push(`${f}: ${msg}`);

// manifest
let manifest = [];
try {
  const w = {};
  new Function("window", fs.readFileSync(path.join(dir, "manifest.js"), "utf8"))(w);
  manifest = w.MANIFEST || [];
  if (!w.LANG) bad("manifest.js", "window.LANG missing");
  if (!w.SLUG) bad("manifest.js", "window.SLUG missing");
} catch (e) { bad("manifest.js", "unreadable: " + e.message); }

// load + parse every data file (cross-checks need all of them)
const PRE = "window.TOPICS = window.TOPICS || [];";
const topics = {};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".js") && f !== "manifest.js")) {
  const s = fs.readFileSync(path.join(dir, f), "utf8").trim();
  const i = s.indexOf("window.TOPICS.push(");
  if (!s.startsWith(PRE) || i < 0) { bad(f, `must start with "${PRE}" then "window.TOPICS.push("`); continue; }
  if (!/\}\s*\);$/.test(s)) { bad(f, 'must end with "});"'); continue; }
  const id = f.slice(0, -3);
  try { topics[id] = JSON.parse(s.slice(i + 19, s.lastIndexOf(")"))); } catch (e) { bad(f, "payload not strict JSON: " + e.message); continue; }
  if (setVersion && topics[id].version !== setVersion && (!only.length || only.includes(id))) {
    topics[id].version = setVersion;
    fs.writeFileSync(path.join(dir, f), `${PRE}\nwindow.TOPICS.push(${JSON.stringify(topics[id], null, 2)});\n`);
  }
}
const targets = only.length ? only : [...new Set([...manifest, ...Object.keys(topics)])];

const str = (v) => typeof v === "string" && v.trim() !== "";
const need = (f, o, keys, where) => keys.forEach((k) => { if (!str(o?.[k])) bad(f, `${where}.${k} missing/empty`); });
// whole-course runs only: every topic must state the same VERSION (extend / refresh drift)
const versions = [...new Set(Object.values(topics).map((t) => t.version))];
if (!only.length && versions.length > 1) bad("manifest.js", `topics state ${versions.length} different versions (${versions.join(" | ")}); run --set-version "<VERSION>"`);
const orders = {};
Object.entries(topics).forEach(([id, t]) => (orders[t.order] ??= []).push(id));

for (const id of targets) {
  const f = id + ".js", t = topics[id];
  if (!manifest.includes(id)) bad(f, "slug not in manifest.js");
  if (!t) { if (!issues.some((x) => x.startsWith(f))) bad(f, "file missing"); continue; }
  if (t.id !== id) bad(f, `id "${t.id}" != filename`);
  if (!Number.isInteger(t.order)) bad(f, "order not integer");
  else if (orders[t.order].length > 1) bad(f, `order ${t.order} shared with ${orders[t.order].join(", ")}`);
  need(f, t, ["title", "version", "summary"], "topic");
  if (!Array.isArray(t.prerequisites)) bad(f, "prerequisites not an array");
  // manifest order, not loaded files: parallel authors may not have written the prerequisite yet
  else t.prerequisites.forEach((p) => { const pi = manifest.indexOf(p); if (pi < 0 || pi >= manifest.indexOf(id)) bad(f, `prerequisite "${p}" not an earlier topic in manifest.js`); });
  if (!Array.isArray(t.subtopics) || !t.subtopics.length) bad(f, "no subtopics");
  const subIds = new Set();
  (t.subtopics || []).forEach((s, n) => {
    const w = `subtopics[${n}](${s.id})`;
    need(f, s, ["id", "title", "explanation", "analogy", "productionNote"], w);
    if (subIds.has(s.id)) bad(f, `${w} duplicate id`); subIds.add(s.id);
    if (!Array.isArray(s.code) || !s.code.length) bad(f, `${w}.code empty`);
    (s.code || []).forEach((c, k) => {
      need(f, c, ["language", "filename", "source", "explanation"], `${w}.code[${k}]`);
      if (typeof c.output !== "string") bad(f, `${w}.code[${k}].output must be a string ("" if none)`);
    });
    if (!Array.isArray(s.commonMistakes) || !s.commonMistakes.length || !s.commonMistakes.every(str)) bad(f, `${w}.commonMistakes empty`);
    const src = (s.sources || []).filter((x) => str(x?.title) && /^https:\/\//.test(x?.url || ""));
    if (!src.length) bad(f, `${w}.sources needs >=1 {title, https url}`);
  });
  if (!Array.isArray(t.quiz) || !t.quiz.length) bad(f, "quiz empty");
  (t.quiz || []).forEach((q, n) => {
    need(f, q, ["question", "explanation"], `quiz[${n}]`);
    if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every(str)) bad(f, `quiz[${n}] needs >=2 non-empty options`);
    else if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= q.options.length) bad(f, `quiz[${n}].answerIndex out of range`);
  });
  const ai = (t.quiz || []).map((q) => q.answerIndex);
  if (ai.length >= 3 && new Set(ai).size === 1) bad(f, `quiz answerIndex all ${ai[0]}; vary it`);
}

if (links) {
  const urls = new Map();
  for (const id of targets) for (const s of topics[id]?.subtopics || []) for (const x of s.sources || [])
    if (/^https:\/\//.test(x.url || "")) (urls.get(x.url) || urls.set(x.url, []).get(x.url)).push(`${id}.js ${s.id}`);
  const list = [...urls.keys()];
  const probe = async (u) => {
    try {
      const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "user-agent": "Mozilla/5.0 (link check)" } });
      if (r.status >= 400) urls.get(u).forEach((w) => bad(w, `dead link ${r.status} ${u}`));
    } catch (e) { urls.get(u).forEach((w) => bad(w, `dead link (${e.name}) ${u}`)); }
  };
  for (let i = 0; i < list.length; i += 4) await Promise.all(list.slice(i, i + 4).map(probe));
}

for (const id of targets) if (!issues.some((x) => x.startsWith(id + ".js"))) console.log(`ok ${id}.js`);
issues.forEach((x) => console.log("ISSUE " + x));
process.exit(issues.length ? 1 : 0);
