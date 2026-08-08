/**
 * Emit a run's scores as JSON, one record per answer.
 *
 * This is the durable half of an experiment. The answers in `corpus/` say what an instruction
 * produced; this says what prosemeter made of them, at a stated version. Committing both means a
 * later question — "did the engine change, or did the instruction stop landing?" — can be answered
 * by re-running rather than by archaeology.
 *
 * Every record carries the engine version, because a score is only comparable to another score from
 * the same scoring algorithm. Re-emitting after an upgrade produces a second file rather than
 * overwriting the first: the point is to keep both and diff them.
 *
 * Usage: node eval/emit-results.mjs <corpus-dir> [outfile]
 *   node eval/emit-results.mjs eval/corpus/run-5
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs"
import { basename } from "node:path"

import { score } from "../packages/prosemeter/dist/index.js"

const dir = process.argv[2]
if (!dir) {
  console.error("usage: node eval/emit-results.mjs <corpus-dir> [outfile]")
  process.exit(2)
}

/**
 * Front matter is metadata about the artifact, not part of the measurement — but it is worth
 * carrying, so a result record is self-describing without opening the answer.
 *
 * Flat keys only, and the leading indent is stripped rather than modelled: `reviewerFinding` nests
 * `severity`/`error` one level and nothing here nests further. A real YAML parser would be a
 * dependency for a file this script wrote itself.
 */
const frontMatter = (raw) => {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(raw)
  if (m === null) return {}
  const out = {}
  for (const line of m[1].split("\n")) {
    const kv = /^\s*([a-zA-Z]+):\s*(.*)$/.exec(line)
    if (kv !== null && kv[2] !== "") out[kv[1]] = kv[2].replace(/^"|"$/g, "")
  }
  return out
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".md"))
  .sort()

const answers = files.map((file) => {
  const raw = readFileSync(`${dir}/${file}`, "utf8")
  const [variant, rep, task] = file.replace(".md", "").split("-")
  const fm = frontMatter(raw)
  return score(raw, { profile: "chat", format: "markdown", target: file }).fold(
    (e) => {
      throw new Error(`score failed for ${file}: ${JSON.stringify(e)}`)
    },
    (r) => ({
      file,
      variant,
      replicate: rep,
      task,
      composite: r.score,
      dimensions: Object.fromEntries(
        r.dimensions.map((d) => [d.id, d.skipped.fold(() => Math.round(d.score * 1000) / 10, () => null)]),
      ),
      stats: r.stats,
      // Carried through so a record is self-describing without opening the answer.
      reviewerFinding: fm.severity === undefined ? null : { severity: fm.severity, error: fm.error ?? null },
    }),
  )
})

const first = readFileSync(`${dir}/${files[0]}`, "utf8")
const meta = frontMatter(first)
const engineVersion = score(first, { profile: "chat", format: "markdown", target: files[0] }).fold(
  () => "unknown",
  (r) => r.version,
)

const out = {
  run: meta.run ?? basename(dir),
  generated: meta.generated ?? null,
  model: meta.model ?? null,
  note: meta.note ?? null,
  profile: "chat",
  prosemeterVersion: engineVersion,
  corpus: dir,
  n: answers.length,
  variants: [...new Set(answers.map((a) => a.variant))].sort(),
  tasks: [...new Set(answers.map((a) => a.task))].sort(),
  answers,
}

const outfile = process.argv[3] ?? `eval/results/run-${out.run}.json`
mkdirSync("eval/results", { recursive: true })
writeFileSync(outfile, JSON.stringify(out, null, 2) + "\n")
console.log(`${outfile}  —  ${out.n} answers, ${out.variants.length} variants, prosemeter ${engineVersion}`)
