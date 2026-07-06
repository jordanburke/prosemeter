/**
 * Human-readable CLI rendering: a score header, a per-dimension table, and findings grouped by
 * dimension and sorted by severity. Plain text (no color) so it pipes and diffs cleanly.
 */

import type { Finding, ScoreResult } from "@prosemeter/core"

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

export const renderScore = (result: ScoreResult): string => {
  const lines: Array<string> = [`${result.target}  ${result.score}/100  (profile: ${result.profile})`, "", "Dimensions"]

  for (const d of result.dimensions) {
    const cell = d.skipped.fold(
      () => String(pct(d.score)).padStart(3),
      () => "  –",
    )
    lines.push(`  ${d.id.padEnd(22)} ${cell}  ${d.detail}`)
  }

  return [...lines, ...renderFindings(result)].join("\n")
}

export const renderProfiles = (): string => {
  const lines: Array<string> = ["Built-in profiles:", ""]
  for (const p of profiles()) {
    lines.push(
      `  ${p.name.padEnd(11)} grade ${p.gradeBand.lo}–${p.gradeBand.hi}  (suggested threshold ${p.thresholdDefault})`,
    )
    lines.push(`              ${p.description}`)
  }
  return lines.join("\n")
}
