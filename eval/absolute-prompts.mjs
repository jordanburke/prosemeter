/**
 * Run 7 phase 1b — score each answer on its own, so there is no position to be biased by.
 *
 * Phase 1 found that a pairwise judge picks whichever answer it reads first, 92–100% of the time
 * against 43–69% when the same answer came second. Absolute scoring removes the failure mode by
 * construction: an answer is never printed next to a rival, so there is no first and no second.
 *
 * **The known risk is the opposite one.** Absolute ratings from a model tend to compress — nearly
 * everything lands on 7 or 8 — and a scale that returns the same number for every answer cannot
 * rank anything. Phase 1's Sonnet rater already did exactly this in pairwise form, calling all 30
 * pairs ties. So the first thing to measure is not accuracy but **spread**: if the scores do not
 * separate, the method is dead regardless of what it agrees with.
 *
 * ## Design
 *
 * One file per task, holding all ten answers for that task — five from each arm — in a
 * deterministic shuffled order, with no arm labels and no indication that any two are related. A
 * rater who noticed the pairing could reconstruct a comparison and reintroduce everything this arm
 * exists to remove.
 *
 * Two independent raters, so inter-rater agreement is measurable. Without a second rater the arm
 * would report a self-consistent scale and no evidence it means anything.
 *
 * The rubric is anchored rather than a bare 1–10. An unanchored scale is where compression comes
 * from — "rate this out of ten" invites the mode, while "a 9 does this specific thing" forces a
 * judgement about the text.
 *
 * Usage: node eval/absolute-prompts.mjs
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const CORPUS = `${HERE}corpus/run-6`
const OUT = `${HERE}prompts/run-6/absolute`

const body = (raw) => raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim()

const TASKS = Object.fromEntries(
  readFileSync(`${HERE}tasks.md`, "utf8")
    .split("\n")
    .map((l) => /^(T\d+): (.+)$/.exec(l.trim()))
    .filter((m) => m !== null)
    .map((m) => [m[1], m[2]]),
)

/** FNV-1a, matching `judge-prompts.mjs`. Deterministic so the run reproduces. */
const hash = (s) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

const RUBRIC = `Score each answer from 1 to 10 on how well it serves the person who asked.

  9-10  A reader finishes it knowing what to do and why, with nothing important missing and
        nothing they have to reread.
  7-8   Correct and usable, but something slows the reader down — a buried lead, an undefined
        term, a section that repeats another.
  5-6   The reader gets the gist and would still have to look something up, or would act on a
        claim the answer states more confidently than it should.
  3-4   Substantially unhelpful: wrong emphasis, missing the actual question, or misleading.
  1-2   A reader is worse off than before they read it.

Use the whole scale. If two answers deserve the same score, give them the same score — but do not
default to the middle. Judge each answer on its own; they are not variants of each other and are
not to be compared.`

mkdirSync(OUT, { recursive: true })

const files = readdirSync(CORPUS)
  .filter((f) => f.endsWith(".md"))
  .sort()

const byTask = new Map()
for (const f of files) {
  const [arm, rep, task] = f.replace(".md", "").split("-")
  if (!byTask.has(task)) byTask.set(task, [])
  byTask.get(task).push({ file: f, arm, rep, task })
}

const key = []
for (const [task, items] of byTask) {
  // Shuffle by hash of the filename so an arm's answers do not cluster, and the order is fixed.
  const shuffled = [...items].sort((a, b) => hash(a.file) - hash(b.file))
  const blocks = shuffled
    .map((it, i) => `## Answer ${i + 1}\n\n${body(readFileSync(`${CORPUS}/${it.file}`, "utf8"))}\n`)
    .join("\n---\n\n")

  shuffled.forEach((it, i) => key.push({ task, label: i + 1, file: it.file, arm: it.arm, replicate: it.rep }))

  writeFileSync(
    `${OUT}/${task}.txt`,
    `Below are ${shuffled.length} answers that different people wrote to the same question. Score ` +
      `each one.\n\n` +
      `The question:\n\n${TASKS[task]}\n\n${RUBRIC}\n\n` +
      `Answer for every one in exactly this format, one line each, nothing else:\n\n` +
      `answer <n>: score=<1-10> | why=<one sentence>\n\n---\n\n${blocks}`,
  )
}

writeFileSync(
  `${HERE}prompts/run-6/absolute-key.json`,
  JSON.stringify({ run: "7", phase: "1b", shuffle: "FNV-1a of filename", key }, null, 2) + "\n",
)

console.log(`${byTask.size} absolute-scoring prompts in ${OUT}  —  ${key.length} answers`)
const firstArm = [...byTask.keys()].map((t) => key.filter((k) => k.task === t)[0].arm)
console.log(`arm appearing first, by task: ${firstArm.join(" ")}  (should not be all one arm)`)
