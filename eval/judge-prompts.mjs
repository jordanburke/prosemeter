/**
 * Build the blind pairwise judging prompts for run 6.
 *
 * `paired.mjs` says arm R beats arm P on the composite. It cannot say whether R's prose is better,
 * because R was shown the scorer's own complaints and the entire composite gain sits in the
 * dimensions those complaints came from. A tool cannot be the evidence for its own effect.
 *
 * So: one judge per task, five pairs each, arms hidden behind per-pair labels X and Y, no scores,
 * no dimension names, no mention of prosemeter. The judge is asked which answer serves the person
 * who asked the question.
 *
 * ## Why overconfidence is asked about separately
 *
 * Arm R's largest movement by far is `directness` (+29 against P), and the marks that produced it
 * read "Unexpected hedge word `usually` → cut the hedge or replace it with a concrete claim". An
 * answer that deletes every hedge scores better on that dimension by construction. Whether it is
 * *truer* is the opposite question, and T5 and T6 are the trap tasks where a load-bearing qualifier
 * decides correctness — `useCallback` only helps under memoization, CDN caching only works for
 * responses that are not per-user. Deleting the qualifier there does not tighten the answer; it
 * makes it wrong.
 *
 * ## Blinding
 *
 * X/Y assignment is a deterministic hash of the pair key, not a random draw — the run must
 * reproduce, and `Math.random` would make the key unrecoverable. The mapping is written to
 * `judge-key.json` and is not shown to any judge.
 *
 * ## The `plain` variant, and why it exists
 *
 * The first pass asks two questions in one prompt: which is better, and is either overconfident.
 * Asking the second primes the first. A judge told to watch for dropped conditions may then call
 * the answer that kept them "better" for that reason, and arm R deletes conditions by construction
 * — so this prompt could hand R a loss it did not earn.
 *
 * `node eval/judge-prompts.mjs plain` writes the same 30 pairs, same blinding, with the
 * overconfidence question and every word about conditions removed. If the preference survives a
 * prompt that never mentions hedging, it is not an artifact of the question.
 *
 * ## The `flip` variant, for run 7
 *
 * `node eval/judge-prompts.mjs plain flip` emits the same 30 pairs with X and Y swapped. Run 7
 * phase 1 needs it to separate two things run 6 could not: whether judges agree with *each other*,
 * and whether they are partly agreeing with the slot an answer sat in. A judge that prefers
 * whatever is shown first will look like a judge with an opinion until you show it the other order.
 *
 * The swap is applied to the same deterministic assignment rather than re-hashed, so a flipped pair
 * is exactly the inverse of its normal-order twin and the two are directly comparable.
 *
 * Usage: node eval/judge-prompts.mjs [plain] [flip]
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const CORPUS = `${HERE}corpus/run-6`
const PLAIN = process.argv.includes("plain")
const FLIP = process.argv.includes("flip")
const OUT = `${HERE}prompts/run-6/${PLAIN ? "judge-plain" : "judge"}${FLIP ? "-flip" : ""}`

const body = (raw) => raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim()

const TASKS = Object.fromEntries(
  readFileSync(`${HERE}tasks.md`, "utf8")
    .split("\n")
    .map((l) => /^(T\d+): (.+)$/.exec(l.trim()))
    .filter((m) => m !== null)
    .map((m) => [m[1], m[2]]),
)

/** FNV-1a. Any stable hash does; this one is short and needs no dependency. */
const hash = (s) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

const pairs = [
  ...new Set(
    readdirSync(CORPUS)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(".md", "").split("-").slice(1).join("-")),
  ),
].sort()

mkdirSync(OUT, { recursive: true })

const key = []
const byTask = new Map()

for (const k of pairs) {
  const [rep, task] = k.split("-")
  // Even hash → P is X. Odd → R is X. Roughly balanced, and fixed. `flip` inverts the same
  // assignment rather than re-hashing, so a flipped pair is the exact inverse of its twin.
  const pIsX = FLIP ? hash(k) % 2 !== 0 : hash(k) % 2 === 0
  const p = body(readFileSync(`${CORPUS}/P-${k}.md`, "utf8"))
  const r = body(readFileSync(`${CORPUS}/R-${k}.md`, "utf8"))
  key.push({ pair: k, replicate: rep, task, X: pIsX ? "P" : "R", Y: pIsX ? "R" : "P" })
  if (!byTask.has(task)) byTask.set(task, [])
  byTask.get(task).push({ k, X: pIsX ? p : r, Y: pIsX ? r : p })
}

for (const [task, items] of byTask) {
  const blocks = items
    .map(
      (it, i) =>
        `## Pair ${i + 1} (id ${it.k})\n\n### Answer X\n\n${it.X}\n\n### Answer Y\n\n${it.Y}\n`,
    )
    .join("\n---\n\n")

  const head =
    `Two people each wrote an answer to the same question. Judge which answer better serves the ` +
    `person who asked.\n\n` +
    `The question, for all ${items.length} pairs below:\n\n${TASKS[task]}\n\n`

  const ask = PLAIN
    ? `Better means the reader understands the answer and can act on it. Do not reward length in ` +
      `either direction — a longer answer is not more thorough and a shorter one is not clearer. ` +
      `Judge whether the explanation lands.\n\n` +
      `Answer for every pair in exactly this format, one line each, nothing else:\n\n` +
      `pair <n>: better=<X|Y|tie> | overconfident=neither | why=<one sentence>\n\n`
    : `For each pair, judge two things separately.\n\n` +
      `**Which is better?** Better means the reader understands the answer and can act on it. ` +
      `Do not reward length in either direction — a longer answer is not more thorough and a ` +
      `shorter one is not clearer. Judge whether the explanation lands.\n\n` +
      `**Is either one overconfident?** Flag an answer that states something as unconditionally ` +
      `true when it holds only under a condition, or that drops a caveat the other answer keeps ` +
      `and needs. Judge the claim, not the tone. If neither does this, say neither — do not ` +
      `manufacture a finding.\n\n` +
      `Answer for every pair in exactly this format, one line each, nothing else:\n\n` +
      `pair <n>: better=<X|Y|tie> | overconfident=<X|Y|both|neither> | why=<one sentence>\n\n`

  // The plain arm keeps the `overconfident=neither` field so one parser reads both passes. It is a
  // constant there and carries no information — read it only from the primary pass.
  writeFileSync(`${OUT}/${task}.txt`, `${head}${ask}---\n\n${blocks}`)
}

writeFileSync(
  `${HERE}prompts/run-6/judge-key${FLIP ? "-flip" : ""}.json`,
  JSON.stringify({ run: "6", blinding: `FNV-1a of pair key${FLIP ? ", inverted" : ""}`, flipped: FLIP, key }, null, 2) + "\n",
)

const xIsP = key.filter((k) => k.X === "P").length
console.log(`${byTask.size} judge prompts in ${OUT}  —  ${pairs.length} pairs`)
console.log(`blinding balance: P is X on ${xIsP} of ${pairs.length} pairs`)
