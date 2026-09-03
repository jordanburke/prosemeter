/**
 * Score the CLEAR corpus with prosemeter and correlate against human readability judgments.
 *
 * The only external validation in `eval/`. Everything else here scores text this repository
 * generated, judged by a model; CLEAR carries `BT_easiness`, a Bradley-Terry fit over pairwise
 * difficulty judgments from ~1800 teachers.
 *
 * The corpus ships its own pre-computed formula columns, which is what makes this trustworthy:
 * running the same correlation over CLEAR's own Flesch-Kincaid must reproduce the published
 * -0.517. It prints that check first. If it drifts, the harness is wrong, not prosemeter.
 *
 * Usage: pnpm build && node eval/clear-correlate.mjs clear.jsonl
 * See LIB_RPT_clear-corpus-validation_2026-08-29.md.
 */

import { readFileSync } from "node:fs"

import { score } from "../packages/prosemeter/dist/index.js"

const path = process.argv[2]
if (path === undefined) {
  console.error("usage: node eval/clear-correlate.mjs <clear.jsonl>   (see clear-export.py)")
  process.exit(2)
}

/**
 * The median grade and the five formulas behind it are only in `grade-band`'s detail string —
 * no public API returns them. That is itself a finding of the report; this regex is the
 * workaround, and it should be deleted once the median is exported properly.
 */
const DETAIL =
  /pooled grade ([-\d.]+) vs band [^(]*\(FK ([-\d.]+), Fog ([-\d.]+), SMOG ([-\d.]+), CL ([-\d.]+), ARI ([-\d.]+)\); Flesch Reading Ease ([-\d.]+)/

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length

const pearson = (xs, ys) => {
  const mx = mean(xs)
  const my = mean(ys)
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0)
  const dx = Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0))
  const dy = Math.sqrt(ys.reduce((a, y) => a + (y - my) ** 2, 0))
  return num / (dx * dy)
}

/** Average ranks for ties, so Spearman is not distorted by the many equal band scores. */
const ranks = (v) => {
  const order = [...v.keys()].sort((a, b) => v[a] - v[b])
  const out = Array(v.length)
  for (let i = 0; i < order.length; ) {
    let j = i
    while (j + 1 < order.length && v[order[j + 1]] === v[order[i]]) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[order[k]] = avg
    i = j + 1
  }
  return out
}

const spearman = (xs, ys) => pearson(ranks(xs), ranks(ys))

const rows = readFileSync(path, "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l))

const scored = []
const unparsed = []
const t0 = Date.now()
for (const r of rows) {
  score(r.text, { profile: "plain" }).map((v) => {
    const dim = (id) => v.dimensions.find((d) => d.id === id)
    const m = DETAIL.exec(dim("grade-band").detail ?? "")
    if (m === null) {
      unparsed.push({ id: r.id, words: r.text.split(/\s+/).length, detail: dim("grade-band").detail })
      return v
    }
    scored.push({
      ...r,
      pmMedian: +m[1],
      pmFk: +m[2],
      pmFog: +m[3],
      pmSmog: +m[4],
      pmCl: +m[5],
      pmAri: +m[6],
      pmFre: +m[7],
      pmBand: dim("grade-band").score,
      composite: v.score,
      sentenceSimplicity: dim("sentence-simplicity")?.score ?? null,
      lexicalDiversity: dim("lexical-diversity")?.score ?? null,
      clarity: dim("clarity")?.score ?? null,
    })
    return v
  })
}

const table = (title, entries) => {
  console.log(`\n${title}`)
  console.log(`${"predictor".padEnd(34)}${"r".padStart(9)}${"rho".padStart(9)}${"R^2".padStart(8)}`)
  console.log("-".repeat(60))
  for (const [label, key] of entries) {
    const pairs = scored.filter((s) => s[key] !== null && s[key] !== undefined)
    const xs = pairs.map((s) => s[key])
    const ys = pairs.map((s) => s.bt)
    const r = pearson(xs, ys)
    console.log(`${label.padEnd(34)}${r.toFixed(3).padStart(9)}${spearman(xs, ys).toFixed(3).padStart(9)}${(r * r).toFixed(3).padStart(8)}`)
  }
}

console.log(`n = ${scored.length} of ${rows.length}  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
if (unparsed.length > 0) {
  // Never assume a dropped row was too short. The first version of this script captured the median
  // as [\d.]+ and silently dropped three 149-168 word excerpts whose median grade was negative,
  // then reported them as below the 30-word floor. Print what was actually dropped and why.
  console.log(`dropped ${unparsed.length}:`)
  for (const u of unparsed) console.log(`  id ${u.id}  ${u.words} words  ${u.detail?.slice(0, 60)}`)
}

const clearFk = pearson(scored.map((s) => s.fk), scored.map((s) => s.bt))
console.log(`\nharness check — CLEAR's own Flesch-Kincaid: ${clearFk.toFixed(3)}  (published -0.517)`)
if (Math.abs(clearFk - -0.517) > 0.02) console.log("  WARNING: drifted from the published value; suspect this harness, not prosemeter")

table("Baselines computed by the corpus itself", [
  ["Flesch-Kincaid", "fk"],
  ["Flesch Reading Ease", "fre"],
  ["ARI", "ari"],
  ["SMOG", "smog"],
  ["Dale-Chall", "dc"],
  ["CAREC", "carec"],
])

table("prosemeter's own grade formulas (all internal)", [
  ["SMOG", "pmSmog"],
  ["Gunning Fog", "pmFog"],
  ["Flesch-Kincaid", "pmFk"],
  ["median-of-five (what grade-band uses)", "pmMedian"],
  ["ARI", "pmAri"],
  ["Coleman-Liau", "pmCl"],
  ["Flesch Reading Ease", "pmFre"],
])

table("prosemeter, what the API returns", [
  ["grade-band SCORE (shipped)", "pmBand"],
  ["COMPOSITE (shipped)", "composite"],
  ["sentence-simplicity", "sentenceSimplicity"],
  ["clarity", "clarity"],
  ["lexical-diversity", "lexicalDiversity"],
])

const perfect = scored.filter((s) => s.pmBand >= 0.999)
const bts = perfect.map((s) => s.bt)
console.log(`\ngrade-band scores exactly 1.0 on ${perfect.length}/${scored.length} (${((100 * perfect.length) / scored.length).toFixed(1)}%)`)
console.log(`  their BT_easiness spans ${Math.min(...bts).toFixed(2)} to ${Math.max(...bts).toFixed(2)}, against a corpus range of ${Math.min(...scored.map((s) => s.bt)).toFixed(2)} to ${Math.max(...scored.map((s) => s.bt)).toFixed(2)}`)

/**
 * The band is bidirectional, so a near-zero correlation against a monotone ease score is close to a
 * tautology of the design rather than a measurement. Split by side and the designed signal appears.
 * Do not compare these r's to the full-corpus figure — the subsets are range-restricted.
 */
console.log("\ngrade-band split by side of the band (plain, 8-12)")
const below = scored.filter((s) => s.pmMedian < 8)
const inside = scored.filter((s) => s.pmMedian >= 8 && s.pmMedian <= 12)
const above = scored.filter((s) => s.pmMedian > 12)
for (const [label, grp] of [["below band", below], ["in band", inside], ["above band", above]]) {
  const r = grp.length > 2 ? pearson(grp.map((g) => g.pmBand), grp.map((g) => g.bt)) : Number.NaN
  console.log(`  ${label.padEnd(12)} n=${String(grp.length).padStart(4)}  mean BT ${mean(grp.map((g) => g.bt)).toFixed(2).padStart(6)}   band score vs BT ${Number.isNaN(r) ? "  n/a" : (r >= 0 ? "+" : "") + r.toFixed(3)}`)
}

const ci95 = (xs) => {
  const m = mean(xs)
  const sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
  return 1.96 * (sd / Math.sqrt(xs.length))
}

console.log("\nIs the composite ordered in human ease?")
const byComposite = [...scored].sort((a, b) => a.composite - b.composite)
const per = Math.floor(byComposite.length / 10)
for (let i = 0; i < 10; i++) {
  const chunk = byComposite.slice(i * per, (i + 1) * per)
  const bt = chunk.map((c) => c.bt)
  console.log(`  decile ${String(i + 1).padStart(2)}: composite ${mean(chunk.map((c) => c.composite)).toFixed(1).padStart(5)}   BT_easiness ${mean(bt).toFixed(3).padStart(6)} +/- ${ci95(bt).toFixed(3)}`)
}
const pooled = byComposite.slice(2 * per)
console.log(`  deciles 3-10 pooled: n=${pooled.length}  r=${pearson(pooled.map((p) => p.composite), pooled.map((p) => p.bt)).toFixed(4)}`)

console.log("\nImplementation agreement against the corpus's independent computation")
let over2 = 0
let over5 = 0
for (const [label, a, b] of [["Flesch-Kincaid", "pmFk", "fk"], ["Flesch Reading Ease", "pmFre", "fre"], ["ARI", "pmAri", "ari"], ["SMOG", "pmSmog", "smog"]]) {
  const pairs = scored.filter((s) => s[b] !== null && s[b] !== undefined)
  const diffs = pairs.map((s) => s[a] - s[b])
  const r = pearson(pairs.map((s) => s[a]), pairs.map((s) => s[b]))
  console.log(`  ${label.padEnd(22)} r=${r.toFixed(4)}  mean diff ${mean(diffs) >= 0 ? "+" : ""}${mean(diffs).toFixed(2)}  max|diff| ${Math.max(...diffs.map(Math.abs)).toFixed(1)}`)
  if (a === "pmFk") {
    over2 = diffs.filter((d) => Math.abs(d) > 2).length
    over5 = diffs.filter((d) => Math.abs(d) > 5).length
  }
}
console.log(`  FK differs by >2 grades on ${over2}/${scored.length} (${((100 * over2) / scored.length).toFixed(1)}%), by >5 on ${over5} (${((100 * over5) / scored.length).toFixed(2)}%)`)

/**
 * Where the offset comes from. FK and Flesch Reading Ease are both linear in the same two
 * quantities, so each row's pair of scores solves exactly for the words-per-sentence and
 * syllables-per-word each implementation saw:
 *   FK  = 0.39*ASL + 11.8*ASW - 15.59
 *   FRE = 206.835 - 1.015*ASL - 84.6*ASW
 * Attributing the whole offset to segmentation without this is a guess; the split is about even.
 */
const solve = (fk, fre) => {
  const c1 = fk + 15.59
  const c2 = 206.835 - fre
  const det = 0.39 * 84.6 - 11.8 * 1.015
  return { asl: (c1 * 84.6 - 11.8 * c2) / det, asw: (0.39 * c2 - 1.015 * c1) / det }
}
const decomp = scored.filter((s) => s.fk !== null && s.fre !== null).map((s) => {
  const p = solve(s.pmFk, s.pmFre)
  const c = solve(s.fk, s.fre)
  return { dAsl: p.asl - c.asl, dAsw: p.asw - c.asw }
})
const dAsl = mean(decomp.map((d) => d.dAsl))
const dAsw = mean(decomp.map((d) => d.dAsw))
console.log("\nWhere the Flesch-Kincaid offset comes from")
console.log(`  words per sentence:   ${dAsl >= 0 ? "+" : ""}${dAsl.toFixed(2)}  -> ${(0.39 * dAsl).toFixed(3)} grades`)
console.log(`  syllables per word:   ${dAsw >= 0 ? "+" : ""}${dAsw.toFixed(3)}  -> ${(11.8 * dAsw).toFixed(3)} grades`)
console.log(`  (sums to ${(0.39 * dAsl + 11.8 * dAsw).toFixed(3)} of the observed mean offset)`)
