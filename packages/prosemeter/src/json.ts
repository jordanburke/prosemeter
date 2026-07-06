/**
 * Plain-JSON projection of a `ScoreResult`. The engine models absence with functype `Option`
 * (`skipped`, `loc`), which does not serialize to clean JSON — this is the stable machine-readable
 * contract agents consume, with Options flattened to `value | null`.
 */

import type { DimensionResult, DocumentStats, Finding, ScoreResult } from "@prosemeter/core"

export type FindingJSON = {
  readonly rule: string
  readonly dimension: string
  readonly severity: string
  readonly message: string
  readonly hint: string
  readonly loc: {
    readonly line: number
    readonly column: number
    readonly offset: number
    readonly length: number
  } | null
  readonly excerpt: string
}

export type DimensionResultJSON = {
  readonly id: string
  readonly score: number
  readonly weight: number
  readonly detail: string
  readonly skipped: string | null
  readonly findings: ReadonlyArray<FindingJSON>
}

export type ScoreResultJSON = {
  readonly target: string
  readonly profile: string
  readonly score: number
  readonly stats: DocumentStats
  readonly dimensions: ReadonlyArray<DimensionResultJSON>
  readonly version: string
}

const findingToJSON = (f: Finding): FindingJSON => ({
  rule: f.rule,
  dimension: f.dimension,
  severity: f.severity,
  message: f.message,
  hint: f.hint,
  loc: f.loc.orNull(),
  excerpt: f.excerpt,
})

const dimensionToJSON = (d: DimensionResult): DimensionResultJSON => ({
  id: d.id,
  score: d.score,
  weight: d.weight,
  detail: d.detail,
  skipped: d.skipped.orNull(),
  findings: d.findings.map(findingToJSON),
})

export const toScoreResultJSON = (result: ScoreResult): ScoreResultJSON => ({
  target: result.target,
  profile: result.profile,
  score: result.score,
  stats: result.stats,
  dimensions: result.dimensions.map(dimensionToJSON),
  version: result.version,
})
