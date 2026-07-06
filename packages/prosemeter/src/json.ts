/**
 * Plain-JSON projection of engine values. The engine models absence with functype `Option`
 * (`skipped`, `loc`), which does not serialize to clean JSON — these are the stable machine-readable
 * contracts agents consume, with Options flattened to `value | null`. `fromScoreResultJSON` is the
 * inverse, used to rehydrate a stored baseline for diffing.
 */

import type { DeltaReport, DimensionResult, DocumentStats, Finding, ScoreResult, Verdict } from "@prosemeter/core"
import { None, Some } from "functype"

export type Loc = { readonly line: number; readonly column: number; readonly offset: number; readonly length: number }

export type FindingJSON = {
  readonly rule: string
  readonly dimension: string
  readonly severity: string
  readonly message: string
  readonly hint: string
  readonly loc: Loc | null
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

export type DeltaReportJSON = {
  readonly scoreDelta: number
  readonly verdict: Verdict
  readonly dimensions: ReadonlyArray<{ readonly id: string; readonly delta: number; readonly verdict: Verdict }>
  readonly findingsResolved: ReadonlyArray<FindingJSON>
  readonly findingsNew: ReadonlyArray<FindingJSON>
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

export const toDeltaReportJSON = (delta: DeltaReport): DeltaReportJSON => ({
  scoreDelta: delta.scoreDelta,
  verdict: delta.verdict,
  dimensions: delta.dimensions.map((d) => ({ id: d.id, delta: d.delta, verdict: d.verdict })),
  findingsResolved: delta.findingsResolved.map(findingToJSON),
  findingsNew: delta.findingsNew.map(findingToJSON),
})

const findingFromJSON = (f: FindingJSON): Finding => ({
  rule: f.rule,
  dimension: f.dimension,
  severity: f.severity === "info" || f.severity === "warn" || f.severity === "error" ? f.severity : "warn",
  message: f.message,
  hint: f.hint,
  loc: f.loc === null ? None() : Some(f.loc),
  excerpt: f.excerpt,
})

/** Rehydrate a stored baseline `ScoreResultJSON` into a `ScoreResult` for `compareBaseline`. */
export const fromScoreResultJSON = (json: ScoreResultJSON): ScoreResult => ({
  target: json.target,
  profile: json.profile,
  score: json.score,
  stats: json.stats,
  version: json.version,
  dimensions: json.dimensions.map((d) => ({
    id: d.id,
    score: d.score,
    weight: d.weight,
    detail: d.detail,
    skipped: d.skipped === null ? None() : Some(d.skipped),
    findings: d.findings.map(findingFromJSON),
  })),
})
