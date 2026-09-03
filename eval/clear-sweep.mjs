/**
 * Sweep `grade-band`'s pooling statistic and band edges against human readability judgments.
 *
 * Why this can run now and could not before. `eval/README.md` records a `direction` x `weight`
 * sweep in which every alternative failed, with a caveat attached: the 416-answer eval corpus was
 * written by an agent asked to write clearly, and only 2 of 416 read above grade 12, so nothing in
 * the population ever touched the ceiling. CLEAR has ~1,500 excerpts above a 8-12 band. It is the
 * first corpus here that exercises the guard rail.
 *
 * What this sweep can and cannot settle:
 *
 * - **Pooling: yes.** "Which statistic over the five formulas best tracks human ease" is a
 *   monotone question, so a correlation answers it directly.
 * - **Band edges: no.** A band encodes a target audience. CLEAR's ground truth is teachers rating
 *   difficulty for grade 3-12 students; prosemeter's profiles target adult technical readers.
 *   CLEAR can say how much of a realistic corpus a given band admits, and cannot say which band is
 *   right for a README. Edge numbers below are descriptive only.
 *
 * Pooling is shared: `formulas.ts` feeds the same statistic to `grade-band` (per document) and to
 * `sentence-simplicity` (per sentence), so a change here moves both dimensions.
 *
 * Usage: pnpm build && node eval/clear-sweep.mjs clear.jsonl
 */

import { readFileSync } from "node:fs"

import { score } from "../packages/prosemeter/dist/index.js"

const path = process.argv[2]
if (path === undefined) {
  console.error("usage: node eval/clear-sweep.mjs <clear.jsonl>")
  process.exit(2)
}

const DETAIL =
  /pooled grade ([-\d.]+) vs band [^(]*\(FK ([-\d.]+), Fog ([-\d.]+), SMOG ([-\d.]+), CL ([-\d.]+), ARI ([-\d.]+)\)/

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const pearson = (xs, ys) => {
  const mx = mean(xs)
  const my = mean(ys)
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0)
  const dx = Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0))
  const dy = Math.sqrt(ys.reduce((a, y) => a + (y - my) ** 2, 0))
  return num / (dx * dy)
}

const med = (v) => {
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

/** Candidate pooling statistics over [FK, Fog, SMOG, CL, ARI]. */
const POOLING = {
  "median of 5 (shipped)": (f) => med([f.fk, f.fog, f.smog, f.cl, f.ari]),
  "SMOG alone": (f) => f.smog,
  "Gunning Fog alone": (f) => f.fog,
  "mean of 5": (f) => mean([f.fk, f.fog, f.smog, f.cl, f.ari]),
  "trimmed mean (drop hi+lo)": (f) => {
    const s = [f.fk, f.fog, f.smog, f.cl, f.ari].sort((a, b) => a - b)
    return mean(s.slice(1, 4))
  },
  "median of SMOG/Fog/FK": (f) => med([f.smog, f.fog, f.fk]),
  "mean of SMOG/Fog/FK": (f) => mean([f.smog, f.fog, f.fk]),
  "max of 5 (most conservative)": (f) => Math.max(f.fk, f.fog, f.smog, f.cl, f.ari),
}

const rows = readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l))
const docs = []
for (const r of rows) {
  score(r.text, { profile: "plain" }).map((v) => {
    const m = DETAIL.exec(v.dimensions.find((d) => d.id === "grade-band").detail ?? "")
    if (m !== null) docs.push({ bt: r.bt, f: { fk: +m[2], fog: +m[3], smog: +m[4], cl: +m[5], ari: +m[6] } })
    return v
  })
}

const bt = docs.map((d) => d.bt)
console.log(`n = ${docs.length}\n`)
console.log("POOLING — which statistic tracks human ease (a monotone question, so r is valid)")
console.log(`${"statistic".padEnd(30)}${"r".padStart(9)}${"R^2".padStart(8)}${"vs shipped".padStart(12)}`)
console.log("-".repeat(59))

const results = Object.entries(POOLING).map(([label, fn]) => {
  const g = docs.map((d) => fn(d.f))
  return { label, g, r: pearson(g, bt) }
})
const shipped = results.find((x) => x.label.startsWith("median of 5")).r
for (const { label, r } of [...results].sort((a, b) => Math.abs(b.r) - Math.abs(a.r))) {
  const delta = Math.abs(r) - Math.abs(shipped)
  console.log(`${label.padEnd(30)}${r.toFixed(3).padStart(9)}${(r * r).toFixed(3).padStart(8)}${(delta >= 0 ? "+" : "") + delta.toFixed(3).padStart(11)}`)
}

/** Descriptive only — see the header. How much of a realistic corpus each band admits. */
const best = [...results].sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0]
console.log(`\nBAND COVERAGE under "${best.label}" — descriptive, not a recommendation`)
console.log(`${"band".padEnd(10)}${"below".padStart(9)}${"inside".padStart(9)}${"above".padStart(9)}${"flat at 1.0".padStart(13)}`)
console.log("-".repeat(50))
for (const [lo, hi] of [[8, 12], [7, 12], [8, 11], [9, 12], [8, 13], [7, 10], [6, 9], [12, 16]]) {
  const below = best.g.filter((x) => x < lo).length
  const above = best.g.filter((x) => x > hi).length
  const inside = best.g.length - below - above
  console.log(`${`${lo}-${hi}`.padEnd(10)}${String(below).padStart(9)}${String(inside).padStart(9)}${String(above).padStart(9)}${`${((100 * inside) / best.g.length).toFixed(1)}%`.padStart(13)}`)
}
console.log("\nEvery document inside the band scores exactly 1.0, so 'inside' is the flat fraction.")
console.log("Narrowing the band cuts flatness and moves documents into the penalised region; whether")
console.log("that is correct depends on the audience the profile targets, which CLEAR cannot say.")
