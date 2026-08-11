/**
 * Run 7 phase 1c — build the reading pack for a human judge.
 *
 * Everything in runs 6, 7 and 7b is a model judging another model's writing, checked against a
 * third model's verdicts. Position bias is a known failure mode of model judges and phase 1
 * measured a large one here, so the "gold" label set — pairs every model rater agreed on in both
 * presentation orders — has never been checked against a person. If a human disagrees with it, no
 * amount of further model judging would have revealed that.
 *
 * ## Why these ten pairs
 *
 * Not a random sample. The 30 pairs fall into three classes after phase 1, and two of them answer
 * different questions:
 *
 *   gold (12)      every rater agreed, in both orders. All twelve favour the same arm.
 *   reversed (12)  a rater's verdict flipped when the pair was shown the other way round.
 *   tied (6)       at least one rater called it even.
 *
 * Six pairs come from `gold` and four from `reversed`. The six test whether the model gold is real:
 * a human who disagrees with those invalidates the label set every later phase would be built on.
 * The four ask what a person does where the models could not hold a position at all — if the human
 * decides them confidently, the disagreement was the models' problem rather than the pairs'.
 *
 * Sampling only `gold` would have been the mistake: every gold pair favours the same arm, so a
 * reader with any lean toward it agrees by construction and the check proves nothing.
 *
 * ## Blinding
 *
 * A fresh hash, seeded differently from `judge-prompts.mjs`, so the human's A/B assignment does not
 * line up with the X/Y the models saw. Balanced 5/5, and the key is written to a file the reading
 * pack does not reference.
 *
 * **A limitation that cannot be engineered away:** the intended reader has been party to designing
 * this experiment and knows which arm the models preferred. They do not know it per pair, which is
 * what the blinding buys. They are a partially-informed reader, and the report has to say so.
 *
 * Usage: node eval/human-pairs.mjs
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const CORPUS = `${HERE}corpus/run-6`
const AGREE = JSON.parse(readFileSync(`${HERE}results/run-7-agreement.json`, "utf8"))

const body = (raw) => raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim()

const TASKS = Object.fromEntries(
  readFileSync(`${HERE}tasks.md`, "utf8")
    .split("\n")
    .map((l) => /^(T\d+): (.+)$/.exec(l.trim()))
    .filter((m) => m !== null)
    .map((m) => [m[1], m[2]]),
)

/** FNV-1a with a different offset basis from `judge-prompts.mjs`, so the two blindings do not align. */
const hash = (s) => {
  let h = 0x9dc5811c
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

const ver = Object.fromEntries(AGREE.raters.map((r) => [r.id, r.verdicts]))
const all = Object.keys(ver.j1)
const same = (p) => ["j1", "j2", "j3"].every((id) => ver[id][p] !== "tie") && ver.j4[p] !== "tie"

const gold = all.filter((p) => same(p) && ["j1", "j2", "j3"].every((id) => ver[id][p] === ver.j4[p]))
const reversed = all.filter(
  (p) => !gold.includes(p) && ver.j4[p] !== "tie" && ["j1", "j2", "j3"].some((id) => ver[id][p] !== "tie" && ver[id][p] !== ver.j4[p]),
)

// Deterministic pick, and spread across tasks so one question does not dominate the pack.
const pick = (pool, n) => {
  const byTask = new Map()
  for (const p of [...pool].sort((a, b) => hash(a) - hash(b))) {
    const t = p.split("-")[1]
    if (!byTask.has(t)) byTask.set(t, [])
    byTask.get(t).push(p)
  }
  const out = []
  let round = 0
  while (out.length < n) {
    let added = false
    for (const [, ps] of [...byTask].sort()) {
      if (ps[round] !== undefined && out.length < n) {
        out.push(ps[round])
        added = true
      }
    }
    if (!added) break
    round++
  }
  return out
}

const selected = [...pick(gold, 6), ...pick(reversed, 4)]
// Interleave so the two classes are not in blocks — a reader who spotted the boundary would
// effectively know which half is which.
const ordered = [...selected].sort((a, b) => hash(a + "order") - hash(b + "order"))

/**
 * Slot assignment is forced to an exact 5/5 split rather than left to a per-pair coin flip.
 *
 * A hash flip is fine at n=120 and not at n=10: the first version of this landed the blind arm in
 * slot A on 3 of 10, and any position preference in the reader would then push against it for
 * reasons that have nothing to do with the prose. Phase 1 measured a 30-to-50 point position effect
 * in the model raters, so this is not a hypothetical.
 *
 * Ordering the pairs by hash and splitting the list keeps it deterministic.
 */
const slotOrder = [...ordered].sort((a, b) => hash(a + "slot") - hash(b + "slot"))
const pInSlotA = new Set(slotOrder.slice(0, Math.floor(ordered.length / 2)))

const key = []
const blocks = ordered.map((p, i) => {
  const [rep, task] = p.split("-")
  const pIsA = pInSlotA.has(p)
  const P = body(readFileSync(`${CORPUS}/P-${p}.md`, "utf8"))
  const R = body(readFileSync(`${CORPUS}/R-${p}.md`, "utf8"))
  key.push({ n: i + 1, pair: p, task, A: pIsA ? "P" : "R", B: pIsA ? "R" : "P", class: gold.includes(p) ? "gold" : "reversed" })
  return (
    `## Pair ${i + 1}\n\n**The question that was asked:**\n\n> ${TASKS[task]}\n\n` +
    `### Answer A\n\n${pIsA ? P : R}\n\n### Answer B\n\n${pIsA ? R : P}\n`
  )
})

const aIsP = key.filter((k) => k.A === "P").length

mkdirSync(`${HERE}human`, { recursive: true })
writeFileSync(
  `${HERE}human/run-7-key.json`,
  JSON.stringify({ run: "7", phase: "1c", blinding: "FNV-1a, alternate basis", key }, null, 2) + "\n",
)

writeFileSync(
  `${HERE}human/READING-PACK.md`,
  `# Ten pairs, blind\n\n` +
    `Ten questions. For each, two answers by different writers. **Which one better serves the person ` +
    `who asked?**\n\n` +
    `Better means the reader understands the answer and can act on it. Do not reward length in ` +
    `either direction — a longer answer is not more thorough and a shorter one is not clearer.\n\n` +
    `Ties are allowed and are a real answer. If two answers are genuinely equivalent, say tie rather ` +
    `than picking one.\n\n` +
    `Record ten lines in this format and nothing else:\n\n` +
    `\`\`\`\npair 1: better=<A|B|tie> | why=<one sentence>\n...\n\`\`\`\n\n` +
    `Roughly 14,000 words in total. The pairs are independent, so stopping partway is fine — ` +
    `whatever is answered can be analysed.\n\n---\n\n` +
    blocks.join("\n---\n\n"),
)

console.log(`eval/human/READING-PACK.md  —  ${ordered.length} pairs`)
console.log(`  composition: ${key.filter((k) => k.class === "gold").length} gold, ${key.filter((k) => k.class === "reversed").length} order-reversed`)
console.log(`  tasks: ${[...new Set(key.map((k) => k.task))].sort().join(", ")}`)
console.log(`  blinding balance: the blind-revision arm is Answer A on ${aIsP} of ${key.length}`)
console.log(`  key (not referenced by the pack): eval/human/run-7-key.json`)
