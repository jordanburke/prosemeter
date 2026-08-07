/**
 * Probe: which sections did a revision actually touch?
 *
 * `check_convergence` reads a list of composite scores and nothing else. It cannot tell a revision
 * that reworked every section from one that reworked a third of them, because both produce the same
 * *shape* of number — and the composite dilutes skipped sections across the whole document.
 *
 * This counts sections instead. No prose judgement: only "did this get looked at".
 *
 * Not a dimension, not built, not published. It exists so the proposal in
 * `docs/LIB_SPEC_coverage-gate_2026-08-07.md` can be re-run and argued with.
 *
 * Usage:
 *   node eval/probe-coverage.mjs <previous.md> <current.md>
 *   node eval/probe-coverage.mjs --json <previous.md> <current.md>
 */

import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

/**
 * Similarity below which a section counts as genuinely reworked rather than nudged.
 *
 * A judgement call, not a calibration. On the one labelled pair available (a 2,716-word company
 * profile and its revision) the gap was clean: four sections landed between 73% and 89%, eight
 * between 93% and 100%, and nothing sat between 89% and 93%. Treat it as a reporting threshold, not
 * a finding.
 */
const REWRITTEN_BELOW = 0.9

/**
 * Sections shorter than this are structural — a document title, or a heading with nothing under it
 * but the next heading. They can never be "revised", so counting them drags coverage down for free.
 */
const MIN_BODY_WORDS = 10

/**
 * Split on markdown headings. Naive on purpose: it works for structured documents, which is where
 * partial-coverage revisions happen, and reports honestly when it finds nothing to split on.
 */
export const sections = (text) => {
  const out = new Map()
  for (const part of text.split(/\n(?=#{1,6} )/)) {
    // Only a part that actually begins with a heading is a section. Without this check a document
    // with no headings at all yields one "section" named after its opening line, and the probe
    // reports 0% coverage instead of admitting it has nothing to split on.
    const first = part.split("\n", 1)[0]
    if (!/^#{1,6} /.test(first)) continue
    const head = first.replace(/^#+\s*/, "").trim()
    if (head.length > 0) out.set(head, part)
  }
  return out
}

/** Character-level overlap, 0–1. Ratcliff/Obershelp, the same measure Python's difflib reports. */
export const similarity = (a, b) => {
  if (a === b) return 1
  const matched = (x, y) => {
    if (x.length === 0 || y.length === 0) return 0
    let best = { i: 0, j: 0, n: 0 }
    let prev = new Array(y.length + 1).fill(0)
    for (let i = 0; i < x.length; i++) {
      const cur = new Array(y.length + 1).fill(0)
      for (let j = 0; j < y.length; j++) {
        if (x[i] === y[j]) {
          cur[j + 1] = prev[j] + 1
          if (cur[j + 1] > best.n) best = { i: i - cur[j + 1] + 1, j: j - cur[j + 1] + 1, n: cur[j + 1] }
        }
      }
      prev = cur
    }
    if (best.n === 0) return 0
    return (
      best.n +
      matched(x.slice(0, best.i), y.slice(0, best.j)) +
      matched(x.slice(best.i + best.n), y.slice(best.j + best.n))
    )
  }
  return (2 * matched(a, b)) / (a.length + b.length)
}

export const coverage = (previous, current) => {
  const a = sections(previous)
  const b = sections(current)

  const rows = []
  for (const [head, text] of b) {
    const before = a.get(head)
    if (before === undefined) {
      const words = text.split(/\s+/).filter(Boolean).length
      if (words >= MIN_BODY_WORDS) rows.push({ section: head, words, similarity: 0, state: "new" })
      continue
    }
    const words = text.split(/\s+/).filter(Boolean).length
    if (words < MIN_BODY_WORDS) continue
    const ratio = similarity(before, text)
    rows.push({
      section: head,
      words,
      // Untouched means byte-identical, not "similar enough". A one-character edit is an edit; a
      // 0.999 threshold silently rounded a real change in `3. Pipeline` back to untouched.
      similarity: ratio,
      state: before === text ? "untouched" : ratio < REWRITTEN_BELOW ? "rewritten" : "touched",
    })
  }

  const dropped = [...a.keys()].filter((k) => !b.has(k))
  const reached = rows.filter((r) => r.state !== "untouched").length
  return {
    rows,
    dropped,
    reached,
    total: rows.length,
    ratio: rows.length === 0 ? 0 : reached / rows.length,
    untouched: rows.filter((r) => r.state === "untouched").map((r) => r.section),
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const args = process.argv.slice(2)
  const json = args[0] === "--json"
  const [prev, cur] = json ? args.slice(1) : args

  if (!prev || !cur) {
    console.error("usage: node eval/probe-coverage.mjs [--json] <previous.md> <current.md>")
    process.exit(2)
  }

  const result = coverage(readFileSync(prev, "utf8"), readFileSync(cur, "utf8"))

  if (result.total === 0) {
    console.error(`no markdown headings found in ${cur} — nothing to split on, so coverage cannot be measured`)
    process.exit(2)
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log("section".padEnd(40) + "words".padStart(7) + "similarity".padStart(13) + "  state")
    for (const r of result.rows) {
      console.log(
        r.section.slice(0, 39).padEnd(40) +
          String(r.words).padStart(7) +
          `${(r.similarity * 100).toFixed(1)}%`.padStart(13) +
          "  " +
          r.state,
      )
    }
    console.log(
      `\n${result.reached} of ${result.total} sections reached  (${(result.ratio * 100).toFixed(0)}% coverage)`,
    )
    if (result.untouched.length > 0) console.log(`untouched: ${result.untouched.join(" · ")}`)
    if (result.dropped.length > 0) console.log(`dropped since previous: ${result.dropped.join(" · ")}`)
  }
}
