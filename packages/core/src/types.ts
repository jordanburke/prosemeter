/**
 * The prosemeter type contracts — the shape of every value that flows between the engine, the
 * scorer packages, and the output formats. Scorer packages depend only on these types plus the
 * scoring helpers; they never see aggregation, profiles, or CLI concerns.
 */

import type { Option, Try } from "functype"
import type { Root as MdastRoot } from "mdast"
import type { Root as NlcstRoot } from "nlcst"

export type DocumentFormat = "markdown" | "plaintext"

/** Document-wide counts, computed once by the parser and shared by every dimension. */
export type DocumentStats = {
  readonly words: number
  readonly sentences: number
  readonly paragraphs: number
  /** Letters and digits only — the "character" input Coleman-Liau and ARI expect. */
  readonly characters: number
  readonly syllables: number
  /** Words of 3+ syllables, excluding likely proper nouns (Gunning Fog / SMOG convention). */
  readonly complexWords: number
  readonly headings: ReadonlyArray<{ readonly depth: number; readonly text: string; readonly line: number }>
  readonly codeBlocks: number
  readonly links: number
  readonly listItems: number
}

/**
 * A parsed document — the single source of truth every scorer reads. Core owns the parse so all
 * scorers see identical trees and identical prose extraction.
 */
export type ParsedDocument = {
  readonly raw: string
  readonly format: DocumentFormat
  /** mdast tree (front matter, code, links intact) — structure scorers walk this. */
  readonly mdast: MdastRoot
  /** nlcst tree of prose content, with positions mapped back to the original source. */
  readonly nlcst: NlcstRoot
  /** Prose only: front matter stripped, code excluded, URLs excluded, heading text kept. */
  readonly plaintext: string
  readonly stats: DocumentStats
}

export type ParseErrorKind = "empty" | "no-prose"

export type ParseError = {
  readonly kind: ParseErrorKind
  readonly message: string
}

export type DimensionId = string

export type Severity = "info" | "warn" | "error"

/** A single actionable problem. `hint` (what to DO) is required — this is the agent-facing payload. */
export type Finding = {
  readonly rule: string
  readonly dimension: DimensionId
  readonly severity: Severity
  /** What is wrong. */
  readonly message: string
  /** What to do about it — required, agent-facing. */
  readonly hint: string
  readonly loc: Option<{
    readonly line: number
    readonly column: number
    readonly offset: number
    readonly length: number
  }>
  /** The offending text, truncated to <= 120 chars. */
  readonly excerpt: string
}

export type DimensionResult = {
  readonly id: DimensionId
  /** Normalized dimension score, 0.0–1.0. */
  readonly score: number
  /** Effective weight after profile overrides and renormalization. */
  readonly weight: number
  /** Human-readable detail, e.g. "median grade 14.2 vs band 8–12". */
  readonly detail: string
  readonly findings: ReadonlyArray<Finding>
  /** Present when the dimension could not run; its weight redistributes to the others. */
  readonly skipped: Option<string>
}

/**
 * Per-dimension configuration handed to a provider at evaluation time: the resolved effective
 * weight, the profile grade band, severity overrides for this dimension's rules, and free-form
 * settings a specific dimension understands (e.g. band bounds, term maps).
 */
export type DimensionSettings = {
  readonly weight: number
  readonly gradeBand: GradeBand
  readonly severities: ReadonlyMap<string, Severity | "off">
  readonly options: Readonly<Record<string, unknown>>
}

export type GradeBand = { readonly lo: number; readonly hi: number }

/** What scorer packages implement. `evaluate` is pure and synchronous over a parsed document. */
export type DimensionProvider = {
  readonly id: DimensionId
  readonly defaultWeight: number
  readonly evaluate: (doc: ParsedDocument, settings: DimensionSettings) => Try<DimensionResult>
}

/** A profile is pure data — no behavior. */
export type Profile = {
  readonly name: string
  readonly description: string
  readonly gradeBand: GradeBand
  /** Overrides `defaultWeight` per dimension; a weight of 0 disables the dimension. */
  readonly weights: Readonly<Partial<Record<DimensionId, number>>>
  /** Per-rule severity overrides; "off" disables the rule. */
  readonly rules: Readonly<Partial<Record<string, Severity | "off">>>
  /** Suggested `--threshold` for this profile. */
  readonly thresholdDefault: number
  /** Free-form per-dimension option overrides (e.g. section-length band bounds). */
  readonly dimensionOptions: Readonly<Partial<Record<DimensionId, Readonly<Record<string, unknown>>>>>
}

/** The JSON contract — deliberately parallels functype-eval's ScoreResult. */
export type ScoreResult = {
  readonly target: string
  readonly profile: string
  readonly score: number
  readonly stats: DocumentStats
  readonly dimensions: ReadonlyArray<DimensionResult>
  /** prosemeter version that produced this — a baseline compatibility check reads it. */
  readonly version: string
}

export type Verdict = "improved" | "regressed" | "unchanged"

export type DeltaReport = {
  readonly scoreDelta: number
  readonly verdict: Verdict
  readonly dimensions: ReadonlyArray<{
    readonly id: DimensionId
    readonly delta: number
    readonly verdict: Verdict
  }>
  /** Findings in the baseline that are gone from the current result. */
  readonly findingsResolved: ReadonlyArray<Finding>
  /** Findings in the current result that were not in the baseline. */
  readonly findingsNew: ReadonlyArray<Finding>
}

export type ConvergenceVerdict = "improving" | "plateaued" | "oscillating" | "regressing" | "converged"

/** One dimension's score trajectory (0–1 scores, oldest first), aligned with the composite history. */
export type DimensionHistory = {
  readonly id: DimensionId
  readonly history: ReadonlyArray<number>
}

/**
 * A convergence verdict plus which dimensions are churning under a flat composite. `churning` is
 * informational — a flat composite is still a stop signal; the flag says *why* it stalled (dimensions
 * trading against each other rather than converging). Empty for every non-`plateaued` verdict.
 */
export type ConvergenceReport = {
  readonly verdict: ConvergenceVerdict
  readonly churning: ReadonlyArray<DimensionId>
}
