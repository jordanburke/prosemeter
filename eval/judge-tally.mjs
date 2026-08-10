/**
 * Unblind the run-6 pairwise judgments and tally them.
 *
 * This is the only readout in run 6 that prosemeter cannot influence. `paired.mjs` reports that arm
 * R gains 4.3 composite points on arm P — but R was shown the scorer's complaints and the entire
 * gain sits in the dimensions those complaints came from, so that number cannot distinguish "better
 * prose" from "did what it was told".
 *
 * Two tallies, and the second is not a footnote. `directness` is R's largest movement by a wide
 * margin, and the marks driving it say to cut hedges. T5 and T6 are the trap tasks where the hedge
 * is the correctness — `useCallback` helps only under memoization, CDN caching works only for
 * responses that are not per-user. If cutting hedges buys measured directness at the cost of true
 * statements, the loop is not improving documents and the skill needs to say so.
 *
 * ## Read both passes, and read the plain one first
 *
 * `node eval/judge-tally.mjs plain` tallies the second pass, whose prompt never mentions
 * conditions, caveats or overconfidence. **The two disagree, and the difference is the priming.**
 * Overall preference for P goes from 24–1 (p < 0.0001) to 18–9 (p = 0.12) when the question is
 * dropped, and the trap tasks flip from 10–0 to a 4–5 wash.
 *
 * So the headline "P wins" is substantially an artifact of asking. Two things survive it: P still
 * beats R 14–4 on the four explain-a-concept tasks (p = 0.031), and R does not win a blind
 * preference under either prompt despite gaining 4.3 composite points. Quote the plain pass for the
 * preference and the primary pass only for overconfidence, which the plain prompt does not ask
 * about and its output does not carry.
 *
 * Usage: node eval/judge-tally.mjs [plain]
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const KEY = JSON.parse(readFileSync(`${HERE}prompts/run-6/judge-key.json`, "utf8"))
const PLAIN = process.argv[2] === "plain"
const DIR = `${HERE}judgments/${PLAIN ? "run-6-plain" : "run-6"}`

const byTask = new Map()
for (const k of KEY.key) {
  if (!byTask.has(k.task)) byTask.set(k.task, [])
  byTask.get(k.task).push(k)
}

const LINE = /^pair\s+(\d+):\s*better=(\w+)\s*\|\s*overconfident=(\w+)\s*\|/i

const read = (dir) => {
  const out = []
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".txt")).sort()) {
    const task = file.replace(".txt", "")
    const order = byTask.get(task)
    if (order === undefined) throw new Error(`judgment for unknown task ${task}`)
    const lines = readFileSync(`${dir}/${file}`, "utf8")
      .split("\n")
      .map((l) => LINE.exec(l.trim()))
      .filter((m) => m !== null)
    if (lines.length !== order.length) {
      throw new Error(`${file}: parsed ${lines.length} verdicts, expected ${order.length}`)
    }
    lines.forEach((m, i) => {
      const k = order[i]
      // Unblind: the judge said X or Y; the key says which arm each was.
      const arm = (label) => (label === "X" ? k.X : label === "Y" ? k.Y : label)
      const oc = m[3].toLowerCase()
      out.push({
        pair: k.pair,
        task,
        better: arm(m[2].toUpperCase() === "TIE" ? "tie" : m[2].toUpperCase()),
        overconfident: oc === "neither" || oc === "both" ? oc : arm(m[3].toUpperCase()),
      })
    })
  }
  return out
}

const verdicts = read(DIR)

const signTest = (up, down) => {
  const n = up + down
  if (n === 0) return 1
  let term = Math.pow(0.5, n)
  let p = 0
  for (let i = 0; i <= Math.min(up, down); i++) {
    p += term
    term = (term * (n - i)) / (i + 1)
  }
  return Math.min(1, 2 * p)
}
const p4 = (p) => (p < 0.0001 ? "<0.0001" : p.toFixed(4))

const tally = (vs, label) => {
  const rw = vs.filter((v) => v.better === "R").length
  const pw = vs.filter((v) => v.better === "P").length
  const tie = vs.filter((v) => v.better === "tie").length
  const ocR = vs.filter((v) => v.overconfident === "R" || v.overconfident === "both").length
  const ocP = vs.filter((v) => v.overconfident === "P" || v.overconfident === "both").length
  // The plain prompt never asks about overconfidence, so its zeros are the field's default rather
  // than a finding. Saying "not asked" stops the column being read as "the judge found none".
  const oc = PLAIN ? "overconfident: not asked" : `overconfident: R ${String(ocR).padStart(2)} · P ${String(ocP).padStart(2)}`
  console.log(
    `${label.padEnd(26)} n=${String(vs.length).padStart(2)}   better: R ${String(rw).padStart(2)} · P ${String(pw).padStart(2)} · tie ${String(tie).padStart(2)}` +
      `   p=${p4(signTest(rw, pw)).padEnd(8)}   ${oc}`,
  )
}

console.log(
  `run 6 — blind pairwise judgment, ${verdicts.length} pairs, one judge per task` +
    `\n${PLAIN ? "PLAIN pass — preference only, overconfidence never asked" : "PRIMARY pass — preference and overconfidence asked together (primes the preference)"}\n`,
)
tally(verdicts, "all tasks")
console.log("")
tally(
  verdicts.filter((v) => ["T1", "T2", "T3", "T4"].includes(v.task)),
  "explain-a-concept (T1–T4)",
)
tally(
  verdicts.filter((v) => ["T5", "T6"].includes(v.task)),
  "trap tasks (T5–T6)",
)
console.log("")
for (const t of [...byTask.keys()].sort()) tally(verdicts.filter((v) => v.task === t), `  ${t}`)

/**
 * Both passes as data, so the site can quote them without a number being typed by hand.
 *
 * Written on every invocation from both directories rather than from whichever pass was printed —
 * a file that means different things depending on the flag that produced it is a trap.
 */
const summarize = (vs) => ({
  n: vs.length,
  betterR: vs.filter((v) => v.better === "R").length,
  betterP: vs.filter((v) => v.better === "P").length,
  tie: vs.filter((v) => v.better === "tie").length,
  overconfidentR: vs.filter((v) => v.overconfident === "R" || v.overconfident === "both").length,
  overconfidentP: vs.filter((v) => v.overconfident === "P" || v.overconfident === "both").length,
})

const explain = (vs) => vs.filter((v) => ["T1", "T2", "T3", "T4"].includes(v.task))
const traps = (vs) => vs.filter((v) => ["T5", "T6"].includes(v.task))
const pack = (vs) => ({ all: summarize(vs), explain: summarize(explain(vs)), traps: summarize(traps(vs)) })

const primary = read(`${HERE}judgments/run-6`)
const plain = read(`${HERE}judgments/run-6-plain`)

writeFileSync(
  `${HERE}results/run-6-judgments.json`,
  JSON.stringify(
    {
      run: "6",
      design: "blind pairwise, one judge per task, arms hidden behind a deterministic X/Y hash",
      model: "claude-opus-5",
      generated: "2026-08-10",
      passes: {
        primary: { asks: "preference and overconfidence together", note: "asking about overconfidence primes the preference — read `plain` for preference", ...pack(primary) },
        plain: { asks: "preference only", note: "overconfidence fields are a constant here and carry no information", ...pack(plain) },
      },
      verdicts: { primary, plain },
    },
    null,
    2,
  ) + "\n",
)
