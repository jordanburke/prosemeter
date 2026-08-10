/**
 * Run 7 phase 1b — do either of the two cheap fixes for position bias actually work?
 *
 * Phase 1 found a pairwise judge picks whichever answer it reads first, and that only about 69% of
 * decided verdicts survive being shown the pair inverted. Two candidate mitigations, both testable
 * on the same 30 pairs with no new drafts:
 *
 *   RF   reason-first. Same prompt, except the judge must write one sentence on each answer before
 *        naming a winner. Verdict-first ordering lets the model commit before it has compared
 *        anything, and the justification then rationalises a choice already made.
 *   ABS  absolute scoring. Each answer scored alone against an anchored 1–10 rubric, never printed
 *        beside a rival, so there is no first and no second to be biased by.
 *
 * **They fail in opposite directions, and the comparison only means something if both are
 * measured.** RF can only be judged by whether order-consistency rises. ABS is immune to order by
 * construction, so its risk is the reverse: a scale that returns the same number for everything
 * cannot rank anything, and phase 1's Sonnet rater already showed what that looks like — thirty
 * reasoned ties in a row. So ABS is judged first on **spread**, and only then on agreement.
 *
 * The baseline both are measured against is phase 1's verdict-first prompt on the same pairs.
 *
 * Usage: node eval/mitigations.mjs
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const KEY = JSON.parse(readFileSync(`${HERE}prompts/run-6/judge-key.json`, "utf8"))
const KEY_FLIP = JSON.parse(readFileSync(`${HERE}prompts/run-6/judge-key-flip.json`, "utf8"))
const ABS_KEY = JSON.parse(readFileSync(`${HERE}prompts/run-6/absolute-key.json`, "utf8"))

const PAIRS = KEY.key.map((k) => k.pair)

// ---- pairwise verdicts -----------------------------------------------------------------------

// `better=` sits last in the reason-first format and mid-line in the verdict-first one, so the
// pattern anchors on the field rather than the line shape.
const VERDICT = /better=(\w+)/i
const PAIRNO = /^pair\s+(\d+)\s*:/i

const readPairwise = (dir, key) => {
  const byTask = new Map()
  for (const k of key.key) {
    if (!byTask.has(k.task)) byTask.set(k.task, [])
    byTask.get(k.task).push(k)
  }
  const out = new Map()
  for (const file of readdirSync(`${HERE}judgments/${dir}`).filter((f) => f.endsWith(".txt")).sort()) {
    const order = byTask.get(file.replace(".txt", ""))
    const lines = readFileSync(`${HERE}judgments/${dir}/${file}`, "utf8")
      .split("\n")
      .filter((l) => PAIRNO.test(l.trim()))
    if (lines.length !== order.length) throw new Error(`${dir}/${file}: ${lines.length} lines, expected ${order.length}`)
    lines.forEach((l, i) => {
      const m = VERDICT.exec(l)
      if (m === null) throw new Error(`${dir}/${file}: no better= on line ${i + 1}`)
      const said = m[1].toUpperCase()
      out.set(order[i].pair, said === "TIE" ? "tie" : said === "X" ? order[i].X : order[i].Y)
    })
  }
  return out
}

/**
 * How often does a verdict survive being shown the pair the other way round?
 *
 * Restricted to pairs both presentations decided — a tie on either side is not a reversal, and
 * counting it as one would flatter whichever prompt ties more.
 */
const consistency = (normal, flipped) => {
  const both = PAIRS.filter((p) => normal.get(p) !== "tie" && flipped.get(p) !== "tie")
  const same = both.filter((p) => normal.get(p) === flipped.get(p))
  return {
    decidedBoth: both.length,
    consistent: same.length,
    reversed: both.length - same.length,
    pct: both.length ? (100 * same.length) / both.length : NaN,
    P: same.filter((p) => normal.get(p) === "P").length,
    R: same.filter((p) => normal.get(p) === "R").length,
    ties: PAIRS.length - both.length,
  }
}

const base = { normal: readPairwise("run-6-plain", KEY), flipped: readPairwise("run-7/j4-flip", KEY_FLIP) }
const rf = { normal: readPairwise("run-7/rf", KEY), flipped: readPairwise("run-7/rf-flip", KEY_FLIP) }

// Phase 1's other two same-order raters, for the baseline consistency range.
const baseAlt = ["run-7/j2", "run-7/j3"].map((d) => consistency(readPairwise(d, KEY), base.flipped))

// ---- absolute scores -------------------------------------------------------------------------

const SCORE = /^answer\s+(\d+)\s*:\s*score=(\d+)/i

const readAbsolute = (dir) => {
  const out = new Map()
  for (const file of readdirSync(`${HERE}judgments/${dir}`).filter((f) => f.endsWith(".txt")).sort()) {
    const task = file.replace(".txt", "")
    const rows = ABS_KEY.key.filter((k) => k.task === task)
    const lines = readFileSync(`${HERE}judgments/${dir}/${file}`, "utf8")
      .split("\n")
      .map((l) => SCORE.exec(l.trim()))
      .filter((m) => m !== null)
    if (lines.length !== rows.length) throw new Error(`${dir}/${file}: ${lines.length} scores, expected ${rows.length}`)
    lines.forEach((m) => {
      const row = rows.find((r) => r.label === Number(m[1]))
      if (row === undefined) throw new Error(`${dir}/${file}: no key row for answer ${m[1]}`)
      out.set(row.file, Number(m[2]))
    })
  }
  return out
}

const absA = readAbsolute("run-7/abs-a")
const absB = readAbsolute("run-7/abs-b")

const spread = (m) => {
  const xs = [...m.values()]
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) * (x - mean), 0) / xs.length)
  const hist = {}
  for (const x of xs) hist[x] = (hist[x] ?? 0) + 1
  return { n: xs.length, min: Math.min(...xs), max: Math.max(...xs), mean, sd, distinct: Object.keys(hist).length, hist }
}

/** Absolute scores turned back into a pairwise verdict, so they can be compared like for like. */
const absVerdicts = (m) =>
  new Map(
    PAIRS.map((p) => {
      const [rep, task] = p.split("-")
      const pv = m.get(`P-${rep}-${task}.md`)
      const rv = m.get(`R-${rep}-${task}.md`)
      return [p, pv === rv ? "tie" : pv > rv ? "P" : "R"]
    }),
  )

const pct = (x) => (Number.isNaN(x) ? "  -" : x.toFixed(0).padStart(3) + "%")

// ---- report ------------------------------------------------------------------------------------

console.log(`run 7 phase 1b — two mitigations for position bias, ${PAIRS.length} pairs\n`)

console.log("## Arm RF — reason before verdict\n")
console.log("prompt          decided both   consistent   reversed   consistency   of consistent: P / R")
const rows = [
  ["verdict-first", consistency(base.normal, base.flipped)],
  ...baseAlt.map((c, i) => [`  (rater ${i + 2})`, c]),
  ["reason-first", consistency(rf.normal, rf.flipped)],
]
for (const [label, c] of rows) {
  console.log(
    `${label.padEnd(15)} ${String(c.decidedBoth).padStart(12)} ${String(c.consistent).padStart(12)} ${String(c.reversed).padStart(10)}` +
      `   ${pct(c.pct).padStart(11)}          ${c.P} / ${c.R}`,
  )
}
const baseMean = [consistency(base.normal, base.flipped), ...baseAlt].reduce((s, c) => s + c.pct, 0) / 3
const rfC = consistency(rf.normal, rf.flipped)
console.log(`\nbaseline mean ${pct(baseMean)} → reason-first ${pct(rfC.pct)}   (${(rfC.pct - baseMean >= 0 ? "+" : "") + (rfC.pct - baseMean).toFixed(0)} points)`)

console.log(`\n## Arm ABS — score each answer alone\n`)
for (const [label, m] of [["rater A", absA], ["rater B", absB]]) {
  const s = spread(m)
  console.log(
    `${label}: n=${s.n}  range ${s.min}–${s.max}  mean ${s.mean.toFixed(2)}  sd ${s.sd.toFixed(2)}  ` +
      `${s.distinct} distinct values used of 10`,
  )
  console.log(`         ${Object.entries(s.hist).map(([k, v]) => `${k}:${v}`).join("  ")}`)
}

let same = 0
for (const f of absA.keys()) if (absA.get(f) === absB.get(f)) same++
console.log(`\ntwo raters gave the same score to ${same} of ${absA.size} answers (${Math.round((100 * same) / absA.size)}%)`)

const va = absVerdicts(absA)
const vb = absVerdicts(absB)
for (const [label, v] of [["rater A", va], ["rater B", vb]]) {
  const t = PAIRS.filter((p) => v.get(p) === "tie").length
  console.log(
    `${label} as a pairwise verdict: P ${PAIRS.filter((p) => v.get(p) === "P").length} · ` +
      `R ${PAIRS.filter((p) => v.get(p) === "R").length} · tie ${t}`,
  )
}
let agree = 0
for (const p of PAIRS) if (va.get(p) === vb.get(p)) agree++
console.log(`the two derived verdict sets agree on ${agree} of ${PAIRS.length} pairs (${Math.round((100 * agree) / PAIRS.length)}%)`)

/**
 * The strictest label set available: pairs where all three same-order raters *and* the flipped
 * rater named the same arm. Presentation order did not decide these, and no rater dissented.
 *
 * **It is degenerate, and that limits what can be concluded from it.** All 12 favour the blind arm,
 * so a scorer that simply prefers the blind arm scores 100% on it without knowing anything. Read
 * "never contradicted the gold" as the absence of a counterexample, not as demonstrated accuracy.
 */
const AGREE = JSON.parse(readFileSync(`${HERE}results/run-7-agreement.json`, "utf8"))
const ver = Object.fromEntries(AGREE.raters.map((r) => [r.id, r.verdicts]))
const gold = PAIRS.filter(
  (p) =>
    ["j1", "j2", "j3"].every((id) => ver[id][p] !== "tie") &&
    ver.j4[p] !== "tie" &&
    ["j1", "j2", "j3"].every((id) => ver[id][p] === ver.j4[p]),
)

console.log(`\n## Against the strictest labels — ${gold.length} pairs where every rater agrees in both orders\n`)
console.log(`gold composition: ${gold.filter((p) => ver.j1[p] === "P").length} P, ${gold.filter((p) => ver.j1[p] === "R").length} R`)
const goldStats = {}
for (const [label, v] of [["A", va], ["B", vb]]) {
  const decided = gold.filter((p) => v.get(p) !== "tie")
  const hit = decided.filter((p) => v.get(p) === ver.j1[p]).length
  goldStats[label] = { decided: decided.length, hit, abstained: gold.length - decided.length }
  console.log(`absolute rater ${label}: decides ${decided.length} of ${gold.length}, agrees on ${hit}, abstains on ${gold.length - decided.length}`)
}
console.log(`\nThe gold set contains no pair favouring the guided arm, so this cannot detect a scorer`)
console.log(`that simply prefers the blind arm. It is an absence of counterexamples, not accuracy.`)

writeFileSync(
  `${HERE}results/run-7-mitigations.json`,
  JSON.stringify(
    {
      run: "7",
      phase: "1b",
      pairs: PAIRS.length,
      reasonFirst: { baselineMeanConsistencyPct: baseMean, ...consistency(rf.normal, rf.flipped) },
      baselineConsistency: [consistency(base.normal, base.flipped), ...baseAlt],
      absolute: {
        raterA: spread(absA),
        raterB: spread(absB),
        identicalScores: same,
        derivedVerdictAgreement: agree,
        derived: { A: Object.fromEntries(va), B: Object.fromEntries(vb) },
        againstGold: goldStats,
      },
      gold: { pairs: gold, composition: { P: gold.filter((p) => ver.j1[p] === "P").length, R: gold.filter((p) => ver.j1[p] === "R").length } },
    },
    null,
    2,
  ) + "\n",
)
