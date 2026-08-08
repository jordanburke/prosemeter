/**
 * Aggregate prosemeter scores over a run of generated answers.
 *
 * Reads `out/<variant>-<rep>-<task>.md`, scores each against the `chat` profile, and prints
 * per-variant means plus the within-variant spread. The spread matters: composite differences
 * smaller than it are not interpretable at these sample sizes, which is why the per-dimension
 * columns — not the composite — are the thing to read.
 *
 * Usage: pnpm build && node eval/score.mjs [dir]   (default ./out)
 */

import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { score } from "../packages/prosemeter/dist/index.js"

const DIR = process.argv[2] ?? fileURLToPath(new URL("./out", import.meta.url))

const dimScore = (result, id) => {
  const d = result.dimensions.find((x) => x.id === id)
  return d && d.skipped.isNone() ? d.score * 100 : null
}

const rows = readdirSync(DIR)
  .filter((f) => f.endsWith(".md"))
  .map((file) => {
    const [variant, rep, task] = file.replace(".md", "").split("-")
    const raw = readFileSync(`${DIR}/${file}`, "utf8")
    return score(raw, { profile: "chat", format: "markdown", target: file }).fold(
      (err) => {
        throw new Error(`score failed for ${file}: ${JSON.stringify(err)}`)
      },
      (r) => ({
        variant,
        rep,
        task,
        version: r.version,
        total: r.score,
        grade: dimScore(r, "grade-band"),
        cplx: dimScore(r, "sentence-simplicity"),
        clarity: dimScore(r, "clarity"),
        variety: dimScore(r, "sentence-variety"),
        words: r.stats.words,
        cplxWords: r.stats.complexWords,
      }),
    )
  })

const mean = (xs) => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length)
const col = (x) => (Number.isNaN(x) ? "    -" : x.toFixed(1).padStart(5))
const defined = (rs, k) => rs.map((r) => r[k]).filter((x) => x !== null && !Number.isNaN(x))

const variants = [...new Set(rows.map((r) => r.variant))].sort()
const tasks = [...new Set(rows.map((r) => r.task))].sort()

/**
 * Every number below is produced by one scoring algorithm, so the version belongs on the run.
 * `LIB_RPT_*` reports get pasted from this output and read months later, and dimension defaults
 * move between releases — 0.3.0's `CLARITY_IGNORE_DEFAULT` moved the corpus clarity mean by 35
 * points. A table with no version beside it cannot be compared to a later one.
 */
const versions = [...new Set(rows.map((r) => r.version))].sort()
const stamp = versions.length === 1 ? versions[0] : `MIXED (${versions.join(", ")})`

console.log(
  `${rows.length} answers, ${variants.length} variants, ${tasks.length} tasks — scored by prosemeter ${stamp}\n`,
)
console.log("variant   n  total  grade   cplx   clar variety  words  cplxW  jargon%")
for (const v of variants) {
  const rs = rows.filter((r) => r.variant === v)
  const jargonPct = mean(rs.map((r) => (100 * r.cplxWords) / r.words))
  console.log(
    `${v.padEnd(8)} ${String(rs.length).padStart(2)} ${col(mean(defined(rs, "total")))} ` +
      `${col(mean(defined(rs, "grade")))} ${col(mean(defined(rs, "cplx")))} ${col(mean(defined(rs, "clarity")))} ` +
      `${col(mean(defined(rs, "variety")))} ${col(mean(defined(rs, "words")))} ` +
      `${col(mean(defined(rs, "cplxWords")))} ${col(jargonPct)}`,
  )
}

console.log("\nwithin-variant spread (composite, all cells sorted):")
for (const v of variants) {
  const ts = rows
    .filter((r) => r.variant === v)
    .map((r) => r.total)
    .sort((a, b) => a - b)
  console.log(`  ${v}  ${ts[0]}..${ts[ts.length - 1]}  [${ts.join(", ")}]`)
}

console.log("\ncomposite by task (rows = variant, averaged over reps):")
console.log("        " + tasks.map((t) => t.padStart(7)).join(""))
for (const v of variants) {
  const cells = tasks.map((t) =>
    col(mean(rows.filter((r) => r.variant === v && r.task === t).map((r) => r.total))).padStart(7),
  )
  console.log(`  ${v.padEnd(4)}  ` + cells.join(""))
}
