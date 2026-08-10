/**
 * Run 7 phase 1 — how much do independent judges agree about which draft is better?
 *
 * **This number bounds everything downstream.** Run 6 reported that the composite picks the
 * preferred draft 37% of the time and had no idea what a perfect score would have been. If two
 * judges agree with each other 68% of the time, a metric hitting 65% is nearly perfect prediction
 * of a noisy target, and 37% means something quite different from what it looks like.
 *
 * Five raters over the same 30 pairs, arranged as a factorial rather than five samples of one
 * thing, so the sources of disagreement separate:
 *
 *   j1, j2, j3   Opus, normal presentation order   → the ceiling
 *   j4-flip      Opus, X and Y swapped             → position bias
 *   j5-sonnet    Sonnet, normal order              → cross-tier stability
 *
 * j1 is run 6's preference-only pass, reused rather than regenerated — it was produced by the same
 * prompt under the same conditions, and discarding it would cost an agent run for nothing.
 *
 * ## Three things get measured before any metric is scored against this
 *
 * 1. **Raw and chance-corrected agreement.** Raw percentage flatters itself when one option is
 *    common: three raters who always say "P" agree 100% and have learned nothing. Fleiss' kappa
 *    subtracts the agreement you would expect from the marginal rates alone.
 * 2. **The length control.** If judges pick the longer answer 70% of the time, this corpus is a
 *    length benchmark wearing a preference label, and every result built on it has to be read
 *    stratified by length. Run 6 hinted at this from the other side — "fewer words" was its only
 *    directional signal.
 * 3. **Position bias.** The blinding is balanced 15/15, so a judge with no slot preference should
 *    pick the X-slot answer about half the time. j4 sees every pair inverted; a judge tracking the
 *    text rather than the slot should return the same *arm*, not the same letter.
 *
 * Usage: node eval/agreement.mjs
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const KEY = JSON.parse(readFileSync(`${HERE}prompts/run-6/judge-key.json`, "utf8"))
const KEY_FLIP = JSON.parse(readFileSync(`${HERE}prompts/run-6/judge-key-flip.json`, "utf8"))
const SIX = JSON.parse(readFileSync(`${HERE}results/run-6.json`, "utf8"))

const RATERS = [
  { id: "j1", dir: "run-6-plain", key: KEY, model: "opus", order: "normal" },
  { id: "j2", dir: "run-7/j2", key: KEY, model: "opus", order: "normal" },
  { id: "j3", dir: "run-7/j3", key: KEY, model: "opus", order: "normal" },
  { id: "j4", dir: "run-7/j4-flip", key: KEY_FLIP, model: "opus", order: "flipped" },
  { id: "j5", dir: "run-7/j5-sonnet", key: KEY, model: "sonnet", order: "normal" },
]

const LINE = /^pair\s+(\d+):\s*better=(\w+)\s*\|/i

/** Verdicts as {pair: "P"|"R"|"tie"}, unblinded through that rater's own key. */
const read = (rater) => {
  const byTask = new Map()
  for (const k of rater.key.key) {
    if (!byTask.has(k.task)) byTask.set(k.task, [])
    byTask.get(k.task).push(k)
  }
  const out = new Map()
  const slot = new Map()
  for (const file of readdirSync(`${HERE}judgments/${rater.dir}`).filter((f) => f.endsWith(".txt")).sort()) {
    const task = file.replace(".txt", "")
    const order = byTask.get(task)
    const lines = readFileSync(`${HERE}judgments/${rater.dir}/${file}`, "utf8")
      .split("\n")
      .map((l) => LINE.exec(l.trim()))
      .filter((m) => m !== null)
    if (lines.length !== order.length) throw new Error(`${rater.id}/${file}: ${lines.length} verdicts, expected ${order.length}`)
    lines.forEach((m, i) => {
      const k = order[i]
      const said = m[2].toUpperCase()
      out.set(k.pair, said === "TIE" ? "tie" : said === "X" ? k.X : k.Y)
      slot.set(k.pair, said === "TIE" ? "tie" : said)
    })
  }
  return { verdicts: out, slots: slot }
}

const data = Object.fromEntries(RATERS.map((r) => [r.id, read(r)]))
const PAIRS = [...KEY.key.map((k) => k.pair)]

// ---- agreement -------------------------------------------------------------------------------

const pairwise = (a, b) => {
  let same = 0
  for (const p of PAIRS) if (data[a].verdicts.get(p) === data[b].verdicts.get(p)) same++
  return (100 * same) / PAIRS.length
}

/**
 * Fleiss' kappa over the raters given. 0 is chance, 1 is perfect.
 *
 * Categories are the three a judge can return. Ties are a real verdict here, not missing data — a
 * judge saying "these are equally good" is information, and dropping it would inflate agreement
 * among the remaining raters.
 */
const fleiss = (ids) => {
  const cats = ["P", "R", "tie"]
  const n = ids.length
  if (n < 2) return NaN
  let sumP = 0
  const catTotals = Object.fromEntries(cats.map((c) => [c, 0]))
  for (const p of PAIRS) {
    const counts = Object.fromEntries(cats.map((c) => [c, 0]))
    for (const id of ids) counts[data[id].verdicts.get(p)]++
    for (const c of cats) catTotals[c] += counts[c]
    sumP += (cats.reduce((s, c) => s + counts[c] * counts[c], 0) - n) / (n * (n - 1))
  }
  const pBar = sumP / PAIRS.length
  const total = PAIRS.length * n
  const pe = cats.reduce((s, c) => s + Math.pow(catTotals[c] / total, 2), 0)
  return (pBar - pe) / (1 - pe)
}

const majority = (ids) =>
  new Map(
    PAIRS.map((p) => {
      const counts = { P: 0, R: 0, tie: 0 }
      for (const id of ids) counts[data[id].verdicts.get(p)]++
      const top = Math.max(counts.P, counts.R, counts.tie)
      const winners = ["P", "R", "tie"].filter((c) => counts[c] === top)
      return [p, winners.length === 1 ? winners[0] : "tie"]
    }),
  )

const CEILING = ["j1", "j2", "j3"]
const maj = majority(CEILING)
const agreeWithMajority = (id) => {
  let same = 0
  for (const p of PAIRS) if (data[id].verdicts.get(p) === maj.get(p)) same++
  return (100 * same) / PAIRS.length
}

// ---- controls --------------------------------------------------------------------------------

const at = (v, k) => SIX.answers.find((a) => a.variant === v && `${a.replicate}-${a.task}` === k)
const longer = new Map(PAIRS.map((p) => [p, (at("R", p)?.stats.words ?? 0) > (at("P", p)?.stats.words ?? 0) ? "R" : "P"]))

const lengthRate = (id) => {
  let hit = 0, n = 0
  for (const p of PAIRS) {
    const v = data[id].verdicts.get(p)
    if (v === "tie") continue
    n++
    if (v === longer.get(p)) hit++
  }
  return { hit, n, pct: n ? (100 * hit) / n : NaN }
}

const slotRate = (id) => {
  let x = 0, n = 0
  for (const p of PAIRS) {
    const s = data[id].slots.get(p)
    if (s === "tie") continue
    n++
    if (s === "X") x++
  }
  return { x, n, pct: n ? (100 * x) / n : NaN }
}

const pct = (x) => (Number.isNaN(x) ? "   -" : x.toFixed(0).padStart(3) + "%")

/**
 * Does a rater's arm preference depend on which slot the arm sat in?
 *
 * The X-slot rate alone cannot answer this, because the arms are not evenly liked — a judge who
 * genuinely prefers P will pick X more often on the pairs where P happens to be X, with no position
 * effect at all. Splitting P's win rate by P's slot separates the two: under pure content
 * preference the two columns match, and under pure position preference they read 100% and 0%.
 */
const bySlot = (id, key) => {
  const pFirst = new Map(key.key.map((k) => [k.pair, k.X === "P"]))
  const take = (first) => {
    const ps = PAIRS.filter((p) => pFirst.get(p) === first && data[id].verdicts.get(p) !== "tie")
    const won = ps.filter((p) => data[id].verdicts.get(p) === "P").length
    return { won, n: ps.length, pct: ps.length ? (100 * won) / ps.length : NaN }
  }
  return { shownFirst: take(true), shownSecond: take(false) }
}

/**
 * Verdicts that survive being shown the other way round.
 *
 * j4 saw every pair inverted. A pair where a same-order rater and j4 name the *same arm* carries a
 * judgment that presentation order did not decide; a pair where they name different arms carries
 * one that it did. This is the subset a preference corpus would have to be built from.
 *
 * It is a filtered subset, not a random sample — pairs survive when the quality gap is wide enough
 * to beat the order effect, so the surviving set is biased toward clear cases. That is the intent,
 * and it is also the reason the surviving win rate must not be quoted as a rate over all pairs.
 */
const orderConsistent = (id) => {
  const both = PAIRS.filter((p) => data[id].verdicts.get(p) !== "tie" && data.j4.verdicts.get(p) !== "tie")
  const same = both.filter((p) => data[id].verdicts.get(p) === data.j4.verdicts.get(p))
  return {
    consistent: same.length,
    reversed: both.length - same.length,
    involvedTie: PAIRS.length - both.length,
    P: same.filter((p) => data[id].verdicts.get(p) === "P").length,
    R: same.filter((p) => data[id].verdicts.get(p) === "R").length,
  }
}

// ---- report ----------------------------------------------------------------------------------

console.log(`run 7 phase 1 — ${PAIRS.length} pairs, ${RATERS.length} raters\n`)

console.log("rater  model   order      P    R   tie   picks longer   picks X slot")
for (const r of RATERS) {
  const vs = PAIRS.map((p) => data[r.id].verdicts.get(p))
  const c = (x) => String(vs.filter((v) => v === x).length).padStart(3)
  const l = lengthRate(r.id), s = slotRate(r.id)
  console.log(
    `${r.id.padEnd(6)} ${r.model.padEnd(7)} ${r.order.padEnd(9)} ${c("P")}  ${c("R")}   ${c("tie")}` +
      `      ${pct(l.pct)} (${l.n})       ${pct(s.pct)} (${s.n})`,
  )
}

console.log(`\n## The ceiling — three Opus raters, same presentation order\n`)
console.log("pairwise raw agreement:")
for (const [a, b] of [["j1", "j2"], ["j1", "j3"], ["j2", "j3"]]) console.log(`  ${a} vs ${b}   ${pct(pairwise(a, b))}`)
const raw = [["j1", "j2"], ["j1", "j3"], ["j2", "j3"]].map(([a, b]) => pairwise(a, b))
const meanRaw = raw.reduce((x, y) => x + y, 0) / raw.length
console.log(`  mean       ${pct(meanRaw)}`)
console.log(`\nFleiss' kappa (chance-corrected, 3 categories): ${fleiss(CEILING).toFixed(3)}`)

console.log(`\n## Against the three-rater majority\n`)
for (const r of RATERS) console.log(`  ${r.id.padEnd(4)} ${r.model.padEnd(7)} ${r.order.padEnd(9)} ${pct(agreeWithMajority(r.id))}`)

console.log(`\n## Controls\n`)
console.log(`position bias — j4 saw every pair inverted. It agrees with the majority ${pct(agreeWithMajority("j4"))},`)
console.log(`  against ${pct(meanRaw)} mean agreement between same-order raters. A gap here is slot preference, not opinion.`)
console.log(`\ncross-tier — j5 (Sonnet) agrees with the Opus majority ${pct(agreeWithMajority("j5"))}.`)

console.log(`\n## Position dependence — P's win rate, split by the slot P sat in\n`)
console.log("rater   P shown first     P shown second")
for (const r of RATERS.filter((r) => r.model === "opus")) {
  const b = bySlot(r.id, r.key)
  const f = (x) => `${x.won}/${x.n} (${Number.isNaN(x.pct) ? "-" : x.pct.toFixed(0)}%)`
  console.log(`${r.id.padEnd(7)} ${f(b.shownFirst).padEnd(17)} ${f(b.shownSecond)}`)
}
console.log(`\nEqual columns would mean the judgment tracks the text. These do not.`)

console.log(`\n## Verdicts that survive both presentation orders\n`)
console.log("rater   consistent  reversed  involved a tie     of the consistent: P / R")
for (const id of CEILING) {
  const o = orderConsistent(id)
  console.log(
    `${id.padEnd(7)} ${String(o.consistent).padStart(10)} ${String(o.reversed).padStart(9)} ${String(o.involvedTie).padStart(15)}` +
      `           ${o.P} / ${o.R}`,
  )
}

const KILL = 65
console.log(`\n## Kill criterion\n`)
console.log(`Spec: stop if chance-corrected agreement is below ${KILL}% — see LIB_SPEC_preference-corpus_2026-08-10.md.`)
console.log(`Raw mean ${pct(meanRaw)}, Fleiss' kappa ${fleiss(CEILING).toFixed(3)}.`)

writeFileSync(
  `${HERE}results/run-7-agreement.json`,
  JSON.stringify(
    {
      run: "7",
      phase: 1,
      pairs: PAIRS.length,
      raters: RATERS.map((r) => ({
        ...{ id: r.id, model: r.model, order: r.order },
        verdicts: Object.fromEntries(PAIRS.map((p) => [p, data[r.id].verdicts.get(p)])),
        picksLonger: lengthRate(r.id),
        picksXSlot: slotRate(r.id),
        agreesWithMajority: agreeWithMajority(r.id),
      })),
      ceiling: { raters: CEILING, meanPairwiseRaw: meanRaw, fleissKappa: fleiss(CEILING) },
      positionDependence: Object.fromEntries(RATERS.filter((r) => r.model === "opus").map((r) => [r.id, bySlot(r.id, r.key)])),
      orderConsistent: Object.fromEntries(CEILING.map((id) => [id, orderConsistent(id)])),
      majority: Object.fromEntries(PAIRS.map((p) => [p, maj.get(p)])),
    },
    null,
    2,
  ) + "\n",
)
