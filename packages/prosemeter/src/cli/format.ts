/**
 * Human-readable CLI rendering: a score header, a per-dimension table, and findings grouped by
 * dimension and sorted by severity. Plain text (no color) so it pipes and diffs cleanly.
 */

import type { ConvergenceVerdict, DeltaReport, Finding, ScoreResult } from "@prosemeter/core"

import { profiles } from "../index"

const SEVERITY_RANK: Readonly<Record<string, number>> = { error: 0, warn: 1, info: 2 }

const pct = (score: number): number => Math.round(score * 100)

const locLabel = (target: string, finding: Finding): string =>
  finding.loc.fold(
    () => target,
    (l) => `${target}:${l.line}:${l.column}`,
  )

const renderFindings = (result: ScoreResult): ReadonlyArray<string> => {
  const withFindings = result.dimensions.filter((d) => d.findings.length > 0)
  if (withFindings.length === 0) return []

  const lines: Array<string> = ["", "Findings"]
  for (const dim of withFindings) {
    lines.push(`  ${dim.id}`)
    const sorted = [...dim.findings].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9))
    for (const f of sorted) {
      lines.push(`    ${locLabel(result.target, f)}  ${f.severity}  ${f.message}`)
      lines.push(`      → ${f.hint}`)
    }
  }
  return lines
}

/**
 * The header carries the engine version, because a score is only comparable to another score
 * produced by the same scoring algorithm.
 *
 * Dimension defaults move between releases and the numbers move with them — `CLARITY_IGNORE_DEFAULT`
 * shifted the eval corpus mean from 54.1 to ~89 in 0.3.0, and `HEDGE_IGNORE_DEFAULT` moved
 * directness enough to restate a whole baseline. A pasted number with no version beside it cannot
 * be checked against anything later. The JSON output has carried `version` since the type existed;
 * this puts it on the human path too.
 */
export const renderScore = (result: ScoreResult): string => {
  const lines: Array<string> = [
    `${result.target}  ${result.score}/100  (profile: ${result.profile}, prosemeter ${result.version})`,
    "",
    "Dimensions",
  ]

  for (const d of result.dimensions) {
    const cell = d.skipped.fold(
      () => String(pct(d.score)).padStart(3),
      () => "  –",
    )
    lines.push(`  ${d.id.padEnd(22)} ${cell}  ${d.detail}`)
  }

  return [...lines, ...renderFindings(result)].join("\n")
}

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`)

export const renderDelta = (delta: DeltaReport): string => {
  const lines: Array<string> = ["", `Baseline delta: ${signed(delta.scoreDelta)} (${delta.verdict})`]
  for (const d of delta.dimensions) {
    if (d.verdict !== "unchanged") lines.push(`  ${d.id.padEnd(22)} ${signed(Math.round(d.delta))}`)
  }
  lines.push(`  resolved ${delta.findingsResolved.length}, new ${delta.findingsNew.length} finding(s)`)
  return lines.join("\n")
}

/**
 * Say *why* it converged when a threshold is what stopped it.
 *
 * `checkConvergence` treats clearing the threshold as a stop regardless of trajectory, and the CLI
 * supplies the profile's threshold when the caller passes none — so a first pass on a competent
 * draft reports `converged` with a one-entry history. Printing the verdict alone made that look
 * like a bug rather than a floor being cleared.
 */
export const renderConvergence = (
  verdict: ConvergenceVerdict,
  history: ReadonlyArray<number>,
  threshold?: number,
): string => {
  const latest = history[history.length - 1]
  const cleared = verdict === "converged" && threshold !== undefined && latest !== undefined && latest >= threshold
  const why = cleared ? `  — ${latest} ≥ floor ${threshold}; pass --threshold to change` : ""
  return `\nConvergence: ${verdict}   (history: ${history.join(" → ")})${why}`
}

export const renderProfiles = (): string => {
  const lines: Array<string> = ["Built-in profiles:", ""]
  // "floor", not "target": a threshold is only failed when several dimensions fail together.
  // See docs/LIB_ANLY_threshold-semantics_2026-08-07.md.
  for (const p of profiles()) {
    lines.push(`  ${p.name.padEnd(11)} grade ${p.gradeBand.lo}–${p.gradeBand.hi}  (floor ${p.thresholdDefault})`)
    lines.push(`              ${p.description}`)
  }
  return lines.join("\n")
}
