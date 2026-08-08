/**
 * Diff a run against the committed baseline and exit non-zero on regression.
 *
 * This is the recurring check. It is deterministic end to end: the only nondeterminism is
 * generation, which happens before this script runs. There are no LLM judges, so there is no
 * rubric to drift.
 *
 * It checks style only. Two runs established that instruction wording moves length and
 * vocabulary by 2-3x and does not move factual accuracy at all, so re-running fact-checkers on
 * an instruction change measures nothing. Accuracy is a separate system — see README.
 *
 * Usage: pnpm build && node eval/compare.mjs <dir> [variant]     (variant defaults to E)
 */

import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { score } from "../packages/prosemeter/dist/index.js"

const dir = process.argv[2]
const variant = process.argv[3] ?? "E"
if (!dir) {
  console.error("usage: node eval/compare.mjs <dir> [variant]")
  process.exit(2)
}

const baseline = JSON.parse(readFileSync(fileURLToPath(new URL("./baseline.json", import.meta.url)), "utf8"))

const dimScore = (r, id) => {
  const d = r.dimensions.find((x) => x.id === id)
  return d && d.skipped.isNone() ? d.score * 100 : null
}

const rows = readdirSync(dir)
  .filter((f) => f.endsWith(".md") && f.split("-")[0] === variant)
  .map((file) => {
    const raw = readFileSync(`${dir}/${file}`, "utf8")
    return score(raw, { profile: "chat", format: "markdown", target: file }).fold(
      (e) => {
        throw new Error(`score failed for ${file}: ${JSON.stringify(e)}`)
      },
      (r) => ({
        version: r.version,
        composite: r.score,
        gradeBand: dimScore(r, "grade-band"),
        sentenceSimplicity: dimScore(r, "sentence-simplicity"),
        words: r.stats.words,
        jargonPct: (100 * r.stats.complexWords) / r.stats.words,
      }),
    )
  })

if (rows.length === 0) {
  console.error(`no answers for variant "${variant}" in ${dir}`)
  process.exit(2)
}

/**
 * The baseline means are specific to the task set they were measured on, because natural length and
 * register vary by task. Run 4 demonstrated the hazard: the same instruction scored words 278.7 on a
 * ten-task set against a baseline of 290.1 taken on six, and the gate passed — comparing across task
 * sets by accident. Sentence-simplicity cleared its floor by 2.7 points in that run purely on luck.
 */
const observedTasks = [...new Set(readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.split("-")[2]?.replace(".md", "")))]
const expected = [...(baseline.taskSet ?? [])].sort()
const actual = [...observedTasks].sort()
if (expected.length > 0 && (expected.length !== actual.length || expected.some((t, i) => t !== actual[i]))) {
  console.error(`task set mismatch — the baseline is not comparable to this run.`)
  console.error(`  baseline: ${expected.join(", ")}`)
  console.error(`  this run: ${actual.join(", ")}`)
  console.error(`Re-baseline on this task set, or run the gate against the recorded one.`)
  process.exit(2)
}

const mean = (k) => {
  const xs = rows.map((r) => r[k]).filter((x) => x !== null && !Number.isNaN(x))
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

const observed = {
  composite: mean("composite"),
  gradeBand: mean("gradeBand"),
  sentenceSimplicity: mean("sentenceSimplicity"),
  words: mean("words"),
  jargonPct: mean("jargonPct"),
}

/**
 * Report the scoring version, and say so loudly when it is not the one the baseline was taken on.
 *
 * This is a note, not a gate. The gated metrics come from `readability` and from `stats`, and the
 * releases since 0.3.0 changed `style` — so re-scoring run 2's E arm at 0.4.2 reproduced words,
 * jargonPct, sentenceSimplicity and gradeBand to the decimal, while the ungated composite moved
 * 89.4 → 90.2. Failing on a version difference would block every run after any patch release for a
 * drift the gate cannot see anyway.
 *
 * What it buys is the diagnosis. When a metric does move, the first question is whether the
 * instruction stopped landing or the scoring algorithm changed underneath it, and those have
 * opposite remedies. Without the version printed here that question needs archaeology.
 */
const versions = [...new Set(rows.map((r) => r.version))].sort()
const scoredBy = versions.length === 1 ? versions[0] : `MIXED (${versions.join(", ")})`
const takenOn = baseline.prosemeterVersion

console.log(`variant ${variant}, n=${rows.length}, vs baseline (${baseline.instruction} on ${baseline.model}, ${baseline.date})`)
console.log(`scored by prosemeter ${scoredBy}; baseline means taken on ${takenOn ?? "an unrecorded version"}`)
if (takenOn !== undefined && scoredBy !== takenOn) {
  console.log(`  note: scoring version differs. A moved metric may be the engine, not the instruction.`)
}
console.log()
console.log("metric                 baseline  observed     delta  verdict")

const failures = []
for (const [metric, tol] of Object.entries(baseline.tolerances)) {
  if (metric === "note") continue
  const base = baseline.means[metric]
  const obs = observed[metric]
  const breached = (tol.max !== undefined && obs > tol.max) || (tol.min !== undefined && obs < tol.min)
  if (breached) failures.push({ metric, obs, tol })
  const bound = tol.max !== undefined ? `> ${tol.max}` : `< ${tol.min}`
  console.log(
    `${metric.padEnd(22)} ${base.toFixed(1).padStart(8)} ${obs.toFixed(1).padStart(9)} ` +
      `${(obs - base >= 0 ? "+" : "") + (obs - base).toFixed(1)}`.padStart(10) +
      `  ${breached ? `REGRESSED (${bound})` : "ok"}`,
  )
}
console.log(`${"composite".padEnd(22)} ${baseline.means.composite.toFixed(1).padStart(8)} ${observed.composite.toFixed(1).padStart(9)}  (not gated — see README)`)

if (failures.length > 0) {
  console.log(`\n${failures.length} regression(s). The instruction is not landing the same way on this model.`)
  console.log("Re-run the variant sweep before adopting: the winning instruction may have changed.")
  process.exit(1)
}
console.log("\nNo regression. The instruction still lands.")
