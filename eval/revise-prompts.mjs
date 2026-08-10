/**
 * Build the run-6 revision prompts, and pre-register what each one targets.
 *
 * Run 6 asks a different question from runs 1–5. Those varied the *instruction* and measured the
 * first draft. This varies what a reviser is *shown* and measures the second draft, paired against
 * the first. The base drafts are run 5's control arm — uninstructed default register, the state a
 * draft is actually in before anyone tunes a prompt, and the arm with the most findings to act on.
 * If a findings-guided pass cannot beat a blind pass here, it will not anywhere.
 *
 * Two arms, generated from one template so the only difference is a block of text:
 *
 *   P — blind revision. "Revise it." No marks.
 *   R — findings-guided revision. Same words plus the marks.
 *
 * P exists because a second draft is better than a first draft for reasons that have nothing to do
 * with prosemeter. Without it, this run would measure "revision helps" and attribute it to the tool.
 *
 * ## The gaming hazard, and what is done about it
 *
 * `README.md` says never to tell the generating agent it is being scored, because an agent told
 * that optimizes the formula and the run then measures nothing. Arm R breaks that rule by
 * construction — the marks it is shown *are* the scorer's own complaints. Three things narrow it:
 *
 *   1. The prompt never names prosemeter, never shows a score, a dimension, a threshold or a
 *      verdict. A mark is a line number, a sentence-level observation, and a suggestion — what an
 *      editor writes in a margin.
 *   2. `targets.json` records, per draft and before any answer exists, which dimensions produced a
 *      mark. Movement in a *targeted* dimension is close to tautological and is reported separately
 *      from movement in an untargeted one, which is the generalization test.
 *   3. The composite is not the readout. See `paired.mjs`.
 *
 * Usage: pnpm build && node eval/revise-prompts.mjs
 * Writes: eval/prompts/run-6/{P,R}-<rep>-<task>.txt  (gitignored — they embed the drafts)
 *         eval/prompts/run-6/targets.json            (committed — the pre-registration)
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { score } from "../packages/prosemeter/dist/index.js"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const BASE = `${HERE}corpus/run-5`
const OUT = `${HERE}prompts/run-6`

/** Front matter is stripped so line numbers in a mark refer to the text the reviser sees. */
const body = (raw) => raw.replace(/^---\n[\s\S]*?\n---\n/, "")

/**
 * The task text, keyed by id, lifted from `tasks.md`.
 *
 * A reviser shown a draft and no question will revise toward generic prose. The question is what
 * makes "cut this clause" answerable — the clause might be the only part that answers it.
 */
const TASKS = Object.fromEntries(
  readFileSync(`${HERE}tasks.md`, "utf8")
    .split("\n")
    .map((l) => /^(T\d+): (.+)$/.exec(l.trim()))
    .filter((m) => m !== null)
    .map((m) => [m[1], m[2]]),
)

const marks = (result) =>
  result.dimensions.flatMap((d) =>
    d.findings.map((f) => ({
      dimension: d.id,
      line: f.loc.fold(
        () => null,
        (l) => l.line,
      ),
      message: f.message,
      hint: f.hint,
    })),
  )

/**
 * One mark, as an editor would write it. No dimension name, no rule id, no severity — those are
 * scorer vocabulary, and naming them tells the reviser which dial to turn.
 */
const renderMark = (m) => {
  const at = m.line === null ? "  (whole draft)" : `  line ${String(m.line).padStart(3)}`
  return `${at}  ${m.message}\n${" ".repeat(at.length + 2)}→ ${m.hint}`
}

const prompt = (task, draft, arm, ms) => {
  const marked =
    arm === "P"
      ? "Revise it. Return your best version."
      : `An editor read the draft and marked these places. Each gives a location, what they ` +
        `flagged, and what they suggested.\n\n${ms.map(renderMark).join("\n")}\n\n` +
        `Revise it, attending to those marks. Return your best version.`

  return (
    `You are revising a draft answer to a technical question.\n\n` +
    `The question that was asked:\n\n${TASKS[task]}\n\n` +
    `The current draft:\n\n---\n${draft}\n---\n\n` +
    `${marked}\n\n` +
    `Return the revised answer and nothing else — no preamble, no summary of what you changed, ` +
    `no code fence around the whole thing.\n`
  )
}

mkdirSync(OUT, { recursive: true })

const files = readdirSync(BASE)
  .filter((f) => f.startsWith("A-") && f.endsWith(".md"))
  .sort()

let engineVersion = "unknown"
const targets = files.map((file) => {
  const [, rep, taskMd] = file.replace(".md", "").split("-")
  const task = taskMd
  const draft = body(readFileSync(`${BASE}/${file}`, "utf8"))

  const result = score(draft, { profile: "chat", format: "markdown", target: file }).fold(
    (e) => {
      throw new Error(`score failed for ${file}: ${JSON.stringify(e)}`)
    },
    (r) => r,
  )
  engineVersion = result.version

  const ms = marks(result)
  writeFileSync(`${OUT}/P-${rep}-${task}.txt`, prompt(task, draft, "P", ms))
  writeFileSync(`${OUT}/R-${rep}-${task}.txt`, prompt(task, draft, "R", ms))

  return {
    origin: file,
    replicate: rep,
    task,
    baseComposite: result.score,
    markCount: ms.length,
    /** Dimensions that produced at least one mark. Movement here is expected; elsewhere is the test. */
    targeted: [...new Set(ms.map((m) => m.dimension))].sort(),
  }
})

const allDims = [
  ...new Set(
    files.flatMap((f) =>
      score(body(readFileSync(`${BASE}/${f}`, "utf8")), { profile: "chat", format: "markdown", target: f }).fold(
        () => [],
        (r) => r.dimensions.filter((d) => d.skipped.isNone() && d.weight > 0).map((d) => d.id),
      ),
    ),
  ),
].sort()

writeFileSync(
  `${OUT}/targets.json`,
  JSON.stringify(
    {
      run: "6",
      base: "eval/corpus/run-5 arm A (control, no style instruction)",
      profile: "chat",
      prosemeterVersion: engineVersion,
      arms: { P: "blind revision — no marks shown", R: "findings-guided revision — marks shown" },
      activeDimensions: allDims,
      pairs: targets,
    },
    null,
    2,
  ) + "\n",
)

const everTargeted = [...new Set(targets.flatMap((t) => t.targeted))].sort()
const neverTargeted = allDims.filter((d) => !everTargeted.includes(d))
const marksPer = targets.map((t) => t.markCount).sort((a, b) => a - b)

console.log(`${targets.length * 2} prompts in ${OUT}  —  prosemeter ${engineVersion}`)
console.log(`marks per draft: ${marksPer[0]}..${marksPer[marksPer.length - 1]}, median ${marksPer[15]}`)
console.log(`targeted at least once: ${everTargeted.join(", ")}`)
console.log(`never targeted (the generalization test): ${neverTargeted.join(", ")}`)
