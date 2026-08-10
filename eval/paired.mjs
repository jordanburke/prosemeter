/**
 * Run 6: does a findings-guided revision beat a blind one, on the same draft?
 *
 * Runs 1–5 compared *unpaired* means across arms, which works because each arm has its own 30
 * answers and the noise averages out. It does not work for a revision loop: a single draft's
 * composite moves by more than a revision does. Run 5's control arm alone spanned 81–92 — 11 points
 * of spread between answers to *the same tasks under the same instruction*. A 4-point gain on one
 * document is inside that.
 *
 * So every comparison here is paired. Each revision is compared to the exact draft it was made
 * from, and the two arms are compared to each other within the same origin draft. The unit is a
 * difference, not a level, which removes draft-to-draft variance from the denominator.
 *
 * ## What is and is not evidence
 *
 * Arm R was shown the scorer's own complaints. Movement in a dimension that produced a mark is
 * therefore close to tautological — it says the reviser can follow instructions, not that the prose
 * improved. Three readouts, in ascending order of how much they mean:
 *
 *   1. **Targeted dimensions.** Expected to move for R. Reported for completeness; not the finding.
 *   2. **Untargeted dimensions.** No mark ever pointed at these. If R's prose genuinely improved,
 *      they should hold or rise; if R merely deleted flagged words, they can fall.
 *   3. **R against P, within origin.** The one that matters. P controls for the fact that any second
 *      draft beats a first draft. If R does not beat P, the marks contributed nothing.
 *
 * Even (3) is measured by the instrument the marks came from, so a win there is necessary and not
 * sufficient. The blind pairwise judgment in the report is the independent readout.
 *
 * Usage: pnpm build && node eval/paired.mjs [run-6-corpus-dir]
 */

import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { score } from "../packages/prosemeter/dist/index.js"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const DIR = process.argv[2] ?? `${HERE}corpus/run-6`
const BASE = `${HERE}corpus/run-5`
const TARGETS = JSON.parse(readFileSync(`${HERE}prompts/run-6/targets.json`, "utf8"))

const body = (raw) => raw.replace(/^---\n[\s\S]*?\n---\n/, "")

const measure = (path, label) => {
  const raw = body(readFileSync(path, "utf8"))
  return score(raw, { profile: "chat", format: "markdown", target: label }).fold(
    (e) => {
      throw new Error(`score failed for ${label}: ${JSON.stringify(e)}`)
    },
    (r) => ({
      composite: r.score,
      words: r.stats.words,
      findings: r.dimensions.reduce((n, d) => n + d.findings.length, 0),
      dims: Object.fromEntries(
        r.dimensions.filter((d) => d.skipped.isNone()).map((d) => [d.id, Math.round(d.score * 1000) / 10]),
      ),
    }),
  )
}

const mean = (xs) => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length)
const col = (x, w = 6) => (Number.isNaN(x) ? "-".padStart(w) : (x >= 0 ? "+" : "") + x.toFixed(1)).padStart(w)

/**
 * Exact two-sided sign test. Ties are dropped, which is the standard treatment and is honest here:
 * a revision that leaves the composite untouched is evidence for neither arm.
 *
 * A sign test rather than a t-test because n is 30, these are bounded scores with no reason to be
 * normal, and the question is directional — did it improve — not by how much.
 */
const signTest = (deltas) => {
  const up = deltas.filter((d) => d > 0).length
  const down = deltas.filter((d) => d < 0).length
  const n = up + down
  if (n === 0) return { up, down, ties: deltas.length, p: 1 }
  let pmf = Math.pow(0.5, n)
  const tail = (k) => {
    // Sum P(X <= k) for X ~ Binomial(n, 0.5), iterating the pmf to avoid large factorials.
    let p = 0
    let term = pmf
    for (let i = 0; i <= k; i++) {
      p += term
      term = (term * (n - i)) / (i + 1)
    }
    return p
  }
  const k = Math.min(up, down)
  return { up, down, ties: deltas.length - n, p: Math.min(1, 2 * tail(k)) }
}

const p4 = (p) => (p < 0.0001 ? "<0.0001" : p.toFixed(4))

// ---------------------------------------------------------------------------------------------

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".md"))
  .sort()
if (files.length === 0) {
  console.error(`no answers in ${DIR} — generate them from eval/prompts/run-6/ first`)
  process.exit(2)
}

const ARMS = [...new Set(files.map((f) => f.split("-")[0]))].sort()
const byPair = new Map(TARGETS.pairs.map((p) => [`${p.replicate}-${p.task}`, p]))

const rows = files.map((file) => {
  const [arm, rep, task] = file.replace(".md", "").split("-")
  const key = `${rep}-${task}`
  const pair = byPair.get(key)
  if (pair === undefined) throw new Error(`${file} has no origin in targets.json`)
  const before = measure(`${BASE}/${pair.origin}`, pair.origin)
  const after = measure(`${DIR}/${file}`, file)
  return { arm, key, task, pair, before, after }
})

const ver = score("x.", { profile: "chat", format: "markdown", target: "v" }).fold(
  () => "unknown",
  (r) => r.version,
)
console.log(`run 6 — ${rows.length} revisions of ${TARGETS.pairs.length} drafts, prosemeter ${ver}`)
console.log(`base: ${TARGETS.base}`)
if (ver !== TARGETS.prosemeterVersion) {
  console.log(`NOTE: marks were generated on ${TARGETS.prosemeterVersion}; scoring on ${ver}`)
}

console.log(`\n## 1. Each arm against the draft it revised (paired)\n`)
console.log("arm   n   Δcomposite   improved   p        Δwords    Δfindings")
for (const arm of ARMS) {
  const rs = rows.filter((r) => r.arm === arm)
  const d = rs.map((r) => r.after.composite - r.before.composite)
  const st = signTest(d)
  console.log(
    `${arm.padEnd(4)} ${String(rs.length).padStart(2)}  ${col(mean(d), 10)}   ${String(st.up).padStart(2)}/${st.up + st.down}` +
      `      ${p4(st.p).padEnd(8)} ${col(mean(rs.map((r) => r.after.words - r.before.words)), 8)}` +
      `  ${col(mean(rs.map((r) => r.after.findings - r.before.findings)), 9)}`,
  )
}

console.log(`\n## 2. Dimensions, split by whether a mark ever pointed at them\n`)
const targetedFor = (pair, dim) => pair.targeted.includes(dim)
console.log("dimension                arm   Δ when marked   Δ when unmarked")
for (const dim of TARGETS.activeDimensions) {
  for (const arm of ARMS) {
    const rs = rows.filter((r) => r.arm === arm && r.before.dims[dim] !== undefined)
    const marked = rs.filter((r) => targetedFor(r.pair, dim)).map((r) => r.after.dims[dim] - r.before.dims[dim])
    const un = rs.filter((r) => !targetedFor(r.pair, dim)).map((r) => r.after.dims[dim] - r.before.dims[dim])
    const cell = (xs) => (xs.length === 0 ? "     —    " : `${col(mean(xs))} (n=${String(xs.length).padStart(2)})`)
    console.log(`${dim.padEnd(24)} ${arm.padEnd(4)}  ${cell(marked)}      ${cell(un)}`)
  }
}

console.log(`\n## 3. R against P, within the same origin draft — the readout that matters\n`)
if (!ARMS.includes("P") || !ARMS.includes("R")) {
  console.log("(needs both arms)")
} else {
  const keys = [...new Set(rows.map((r) => r.key))].sort()
  const contrasts = keys
    .map((k) => {
      const p = rows.find((r) => r.arm === "P" && r.key === k)
      const r = rows.find((x) => x.arm === "R" && x.key === k)
      return p && r ? { k, d: r.after.composite - p.after.composite, task: p.task } : null
    })
    .filter((x) => x !== null)
  const st = signTest(contrasts.map((c) => c.d))
  console.log(`mean R − P composite: ${col(mean(contrasts.map((c) => c.d)))}`)
  console.log(`R higher on ${st.up} of ${st.up + st.down} drafts (${st.ties} tied), sign test p = ${p4(st.p)}`)

  const tasks = [...new Set(contrasts.map((c) => c.task))].sort()
  console.log(`\nby task: ` + tasks.map((t) => `${t} ${col(mean(contrasts.filter((c) => c.task === t).map((c) => c.d)), 5)}`).join("  "))

  for (const dim of TARGETS.activeDimensions) {
    const ds = keys
      .map((k) => {
        const p = rows.find((r) => r.arm === "P" && r.key === k)
        const r = rows.find((x) => x.arm === "R" && x.key === k)
        return p && r && p.after.dims[dim] !== undefined && r.after.dims[dim] !== undefined
          ? r.after.dims[dim] - p.after.dims[dim]
          : null
      })
      .filter((x) => x !== null)
    if (ds.length > 0) console.log(`  ${dim.padEnd(24)} ${col(mean(ds))}`)
  }
}
