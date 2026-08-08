/**
 * One-time migration: `eval/out*` -> `eval/corpus/<run>/`, with every answer explicitly marked.
 *
 * The answers were gitignored on the reasoning that committing them would park known-wrong
 * technical explanations in the repo where they read as reference material. The marking below is
 * what makes committing them safe: every file says in its own front matter that it is experiment
 * output, and the twenty answers a reviewer found errors in carry the error and its severity.
 *
 * Front matter does not change a score. Verified before writing this: 15 answers scored identically
 * with and without a front-matter block, across composite, word count, complex-word count and every
 * dimension. That property is what lets the corpus be annotated and still be re-scorable evidence.
 *
 * Run once, from the repo root: node eval/migrate-corpus.mjs
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs"

const RUNS = [
  { dir: "out", run: 1, date: "2026-08-02", model: "claude-opus-5", note: "4 tasks, 7 variants" },
  { dir: "out-run2", run: 2, date: "2026-08-02", model: "claude-opus-5", note: "trap tasks added" },
  { dir: "out-run3", run: 3, date: "2026-08-03", model: "claude-opus-5", note: "control arm added" },
  { dir: "out-run4", run: 4, date: "2026-08-03", model: "claude-opus-5", note: "10 tasks, mixed registers" },
  { dir: "out-sonnet", run: "sonnet", date: "2026-08-03", model: "claude-sonnet-5", note: "model transfer check" },
  { dir: "out-run5", run: 5, date: "2026-08-08", model: "claude-opus-5", note: "BLUF label + explanation rules" },
]

/** Reviewer-found errors, keyed `<variant>-<rep>-<task>`. Only run 1 was fact-checked. */
const errorsForRun = (run) => {
  if (run !== 1) return new Map()
  const d = JSON.parse(readFileSync("eval/accuracy-2026-08-02.json", "utf8"))
  return new Map((d.filesWithErrors ?? []).map((e) => [e.file, e]))
}

/** YAML-safe single-line scalar. The error text contains colons and quotes. */
const yaml = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ").trim()}"`

let total = 0
let annotated = 0

for (const { dir, run, date, model, note } of RUNS) {
  const src = `eval/${dir}`
  if (!existsSync(src)) {
    console.log(`skip ${src} — not present`)
    continue
  }
  const dest = `eval/corpus/run-${run}`
  mkdirSync(dest, { recursive: true })
  const errors = errorsForRun(run)

  for (const file of readdirSync(src).filter((f) => f.endsWith(".md"))) {
    const [variant, rep, task] = file.replace(".md", "").split("-")
    const key = `${variant}-${rep}-${task}`
    const err = errors.get(key)

    const fm = [
      "---",
      "kind: eval-artifact",
      `run: ${run}`,
      `variant: ${variant}`,
      `replicate: ${rep}`,
      `task: ${task}`,
      `model: ${model}`,
      `generated: ${date}`,
      `note: ${yaml(note)}`,
      "warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.",
      ...(err
        ? [
            "reviewerFinding:",
            `  severity: ${err.severity}`,
            `  foundBy: ${yaml(err.foundBy)}`,
            `  error: ${yaml(err.error)}`,
          ]
        : []),
      "---",
      "",
    ].join("\n")

    writeFileSync(`${dest}/${file}`, fm + readFileSync(`${src}/${file}`, "utf8"))
    total++
    if (err) annotated++
  }
  console.log(`${src} -> ${dest}  (${readdirSync(dest).length} files)`)
}

console.log(`\n${total} answers written, ${annotated} carrying a reviewer finding.`)
