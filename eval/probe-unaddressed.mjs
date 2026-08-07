/**
 * Probe: which sections did a revision leave unaddressed?
 *
 * "Unaddressed" means the section still carries findings that were already there last pass —
 * nothing resolved, nothing new. The scorer flagged it, the revision walked past it.
 *
 * `compareBaseline` computes *resolved* and *new* findings and stops there. The set it never names
 * is the intersection: findings present in both drafts. Those are the ones an agent skipped, and
 * they are invisible in the delta report even though every `ScoreResult` contains them.
 *
 * This is a pure function over two `ScoreResultJSON`s. It needs no source text, no new API, and no
 * change to the baseline file — `stats.headings` carries every heading with its line, and every
 * finding carries `loc.line`, so findings bucket into sections from data the loop already has.
 *
 * Finding identity is `packages/core/src/loop.ts`'s own `findingKey`: rule, dimension, and the
 * normalized excerpt. Location-independent on purpose, so edits that shift line numbers elsewhere
 * do not churn the sets.
 *
 * Not a dimension, not built, not published. It exists so the proposal in
 * `docs/LIB_SPEC_unaddressed-sections_2026-08-07.md` can be re-run and argued with.
 *
 * Usage:
 *   prosemeter score prev.md --profile plain --json > prev.json
 *   prosemeter score curr.md --profile plain --json > curr.json
 *   node eval/probe-unaddressed.mjs prev.json curr.json
 */

import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

/** Mirrors `findingKey` in packages/core/src/loop.ts. Keep the two in step. */
const findingKey = (f) => `${f.rule} ${f.dimension} ${f.excerpt.trim().replace(/\s+/g, " ").toLowerCase()}`

const allFindings = (result) => result.dimensions.flatMap((d) => d.findings)

/**
 * Assign each finding to the last heading at or above its line.
 *
 * Findings without a `loc` — a document-level dimension like `grade-band` emits none, but others
 * can — fall into a `null` bucket rather than being silently dropped or misattributed to section 1.
 */
const bucket = (result) => {
  const heads = [...(result.stats.headings ?? [])].sort((a, b) => a.line - b.line)
  const out = new Map(heads.map((h) => [h.text, []]))
  out.set(null, [])

  for (const f of allFindings(result)) {
    if (!f.loc) {
      out.get(null).push(f)
      continue
    }
    let owner = null
    for (const h of heads) {
      if (h.line <= f.loc.line) owner = h.text
      else break
    }
    out.get(owner).push(f)
  }
  return out
}

/**
 * Per-section resolved / new / persisted counts, and the verdict that matters.
 *
 * A section is `unaddressed` when it still carries findings and nothing about them changed. That is
 * a narrower and more useful claim than "the bytes did not change": it fires only where the scorer
 * has something actionable to say, so an agent that reads a clean section and moves on is not
 * trapped by it.
 */
export const unaddressed = (baseline, current) => {
  const before = bucket(baseline)
  const after = bucket(current)
  const beforeKeys = new Set(allFindings(baseline).map(findingKey))
  const afterKeys = new Set(allFindings(current).map(findingKey))

  const rows = []
  for (const [section, findings] of after) {
    const prior = before.get(section) ?? []
    const persisted = findings.filter((f) => beforeKeys.has(findingKey(f)))
    const fresh = findings.filter((f) => !beforeKeys.has(findingKey(f)))
    const resolved = prior.filter((f) => !afterKeys.has(findingKey(f)))
    if (findings.length === 0 && resolved.length === 0) continue

    rows.push({
      section: section ?? "(document level)",
      findings: findings.length,
      persisted: persisted.length,
      new: fresh.length,
      resolved: resolved.length,
      state:
        persisted.length > 0 && fresh.length === 0 && resolved.length === 0
          ? "unaddressed"
          : persisted.length > 0
            ? "partly addressed"
            : "addressed",
    })
  }

  const blocked = rows.filter((r) => r.state === "unaddressed")
  return { rows, unaddressed: blocked.map((r) => r.section), clear: blocked.length === 0 }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const [a, b] = process.argv.slice(2)
  if (!a || !b) {
    console.error("usage: node eval/probe-unaddressed.mjs <baseline.json> <current.json>")
    console.error("  each file is `prosemeter score <doc> --json` output")
    process.exit(2)
  }

  const read = (p) => {
    const j = JSON.parse(readFileSync(p, "utf8"))
    return j.result ?? j
  }
  const result = unaddressed(read(a), read(b))

  console.log("section".padEnd(40) + "findings".padStart(9) + "kept".padStart(6) + "new".padStart(5) + "fixed".padStart(7) + "  state")
  for (const r of result.rows) {
    console.log(
      r.section.slice(0, 39).padEnd(40) +
        String(r.findings).padStart(9) +
        String(r.persisted).padStart(6) +
        String(r.new).padStart(5) +
        String(r.resolved).padStart(7) +
        "  " +
        r.state,
    )
  }
  console.log(
    result.clear
      ? "\nEvery section with findings saw some change. Nothing was walked past."
      : `\n${result.unaddressed.length} section(s) unaddressed: ${result.unaddressed.join(" · ")}`,
  )
}
