/**
 * The results panel, as pure functions over a `ScoreResultJSON`.
 *
 * Shared deliberately between two callers: the Astro frontmatter, which renders the first result at
 * build time so the page works with JavaScript disabled, and the client script, which re-renders
 * from worker messages. One implementation means the static HTML and the live update cannot drift.
 *
 * Mirrors `packages/prosemeter/src/cli/format.ts` — same severity order, same `detail` strings,
 * same grouping — so the site and the CLI describe a document the same way.
 */

import type { ScoreResultJSON } from "prosemeter"

const SEVERITY_RANK: Readonly<Record<string, number>> = { error: 0, warn: 1, info: 2 }

export const pct = (score: number): number => Math.round(score * 100)

export type Row = {
  readonly id: string
  readonly score: number
  readonly weight: number
  readonly detail: string
  readonly skipped: string | null
  /** How many composite points this dimension is losing. The ordering key. */
  readonly cost: number
  readonly findings: ScoreResultJSON["dimensions"][number]["findings"]
}

/**
 * Dimensions ordered by what they are costing, not by engine order or alphabetically.
 *
 * `weight × (1 − score)` is the number of composite points this dimension gives up, so the row at
 * the top is the one worth fixing first. The ordering is the advice.
 *
 * Skipped and zero-weight dimensions sink to the bottom: they cost nothing by construction, and a
 * profile that switched one off is making a statement rather than reporting a problem.
 */
export const rows = (result: ScoreResultJSON): ReadonlyArray<Row> =>
  result.dimensions
    .map((d) => ({
      id: d.id,
      score: d.score,
      weight: d.weight,
      detail: d.detail,
      skipped: d.skipped,
      findings: d.findings,
      cost: d.skipped !== null || d.weight === 0 ? -1 : d.weight * (1 - d.score),
    }))
    .sort((a, b) => b.cost - a.cost)

/** Rows carrying real signal, split from the ones that are perfect or switched off. */
export const partition = (all: ReadonlyArray<Row>) => ({
  costing: all.filter((r) => r.cost > 0),
  clean: all.filter((r) => r.cost === 0),
  inactive: all.filter((r) => r.cost < 0),
})

export type FindingGroup = {
  readonly dimension: string
  readonly findings: ReadonlyArray<ScoreResultJSON["dimensions"][number]["findings"][number]>
}

export const findingGroups = (result: ScoreResultJSON): ReadonlyArray<FindingGroup> =>
  rows(result)
    .filter((d) => d.findings.length > 0)
    .map((d) => ({
      dimension: d.id,
      findings: [...d.findings].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)),
    }))

export const totalFindings = (result: ScoreResultJSON): number =>
  result.dimensions.reduce((n, d) => n + d.findings.length, 0)

const escape = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** Inline `code` spans in a message or hint. The engine writes them with backticks. */
const ticks = (s: string): string => escape(s).replace(/`([^`]+)`/g, "<code>$1</code>")

const bar = (score: number): string => {
  const filled = Math.round(score * 10)
  return `<span class="bar" aria-hidden="true">${"▮".repeat(filled)}${"▯".repeat(10 - filled)}</span>`
}

const rowHtml = (r: Row): string => {
  if (r.skipped !== null || r.weight === 0) {
    const why = r.weight === 0 ? "disabled by profile" : (r.skipped ?? "skipped")
    return `<tr class="inactive"><th scope="row">${escape(r.id)}</th><td class="num">—</td><td class="detail">${escape(why)}</td></tr>`
  }
  return (
    `<tr><th scope="row">${escape(r.id)}</th>` +
    `<td class="num">${bar(r.score)}<b>${pct(r.score)}</b></td>` +
    `<td class="detail">${escape(r.detail)}</td></tr>`
  )
}

/**
 * The whole panel as one HTML string.
 *
 * There is no dial, donut, or count-up. prosemeter's own guidance calls reading the composite "the
 * most common way to misuse the tool" — the dimensions carry the signal and the composite averages
 * it away. So the composite gets one line at the same weight as the word count, and the dimension
 * table is the thing that fills the screen.
 */
export const panelHtml = (result: ScoreResultJSON, threshold: number, ms?: number): string => {
  const all = rows(result)
  const { costing, clean, inactive } = partition(all)
  const groups = findingGroups(result)
  const passes = result.score >= threshold
  const words = (result.stats as { words?: number }).words ?? 0

  const head =
    `<p class="headline"><b>${result.score}</b><span class="of">/100</span>` +
    // "floor", matching the CLI and the MCP tool. Measured: no single dimension can fail one.
    `<span class="sep">·</span>floor ${threshold}` +
    `<span class="verdict ${passes ? "pass" : "fail"}">${passes ? "passes" : "below"}</span>` +
    `<span class="sep">·</span>${words} words` +
    (ms === undefined ? "" : `<span class="sep">·</span>scored in ${Math.max(1, Math.round(ms))} ms`) +
    // Which engine produced the number. Dimension defaults move between releases and the scores move
    // with them, so a screenshot without a version cannot be compared to a later one.
    `<span class="sep">·</span><span class="ver">v${escape(result.version)}</span>` +
    `</p>`

  const table =
    `<table class="dims"><caption class="sr-only">Dimension scores, worst first</caption><tbody>` +
    costing.map(rowHtml).join("") +
    (clean.length === 0
      ? ""
      : `<tr class="clean-summary"><th scope="row" colspan="3">` +
        `<details><summary>${clean.length} dimension${clean.length === 1 ? "" : "s"} at 100</summary>` +
        `<table class="dims nested"><tbody>${clean.map(rowHtml).join("")}</tbody></table>` +
        `</details></th></tr>`) +
    inactive.map(rowHtml).join("") +
    `</tbody></table>`

  const findings =
    groups.length === 0
      ? `<p class="no-findings">No findings. Every rule this profile enables is satisfied.</p>`
      : groups
          .map(
            (g) =>
              `<section class="fgroup"><h4>${escape(g.dimension)}</h4>` +
              g.findings
                .map((f) => {
                  const at = f.loc === null ? "" : `${f.loc.line}:${f.loc.column}`
                  const data = f.loc === null ? "" : ` data-offset="${f.loc.offset}" data-length="${f.loc.length}"`
                  return (
                    `<button type="button" class="finding"${data}>` +
                    `<span class="at">${at}</span>` +
                    `<span class="msg">${ticks(f.message)}</span>` +
                    `<span class="hint">→ ${ticks(f.hint)}</span>` +
                    `</button>`
                  )
                })
                .join("") +
              `</section>`,
          )
          .join("")

  return `${head}${table}<div class="findings"><h3>Findings</h3>${findings}</div>`
}
