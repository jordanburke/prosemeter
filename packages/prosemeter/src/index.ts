/**
 * prosemeter — the batteries-included library. `score` wires the built-in providers into the core
 * engine and stamps the real package version; `compareBaseline`, `checkConvergence`, and `profiles`
 * complete the agent loop contract.
 *
 *   const scored = score(text, { profile: "readme" })   // Either<ScoreError, ScoreResult>
 *   scored.map((result) => compareBaseline(result, previous))
 *   const verdict = checkConvergence([62, 71, 74, 74.5], { threshold: 80 })
 */

import type { RunScoreOptions } from "@prosemeter/core"
import { profileNames, PROFILES, runScore } from "@prosemeter/core"

import { builtinProviders } from "./providers"
import { VERSION } from "./version"

export type ScoreOptions = Omit<RunScoreOptions, "version">

/** Score prose with every built-in dimension. Synchronous and deterministic. */
export const score = (text: string, options: ScoreOptions = {}) =>
  runScore(text, builtinProviders, { ...options, version: VERSION })

export type ProfileSummary = {
  readonly name: string
  readonly description: string
  readonly gradeBand: { readonly lo: number; readonly hi: number }
  readonly thresholdDefault: number
}

/** Summaries of the built-in profiles, for `prosemeter profiles` and the MCP `list_profiles` tool. */
export const profiles = (): ReadonlyArray<ProfileSummary> =>
  profileNames.flatMap((name) => {
    const p = PROFILES[name]
    return p === undefined
      ? []
      : [{ name: p.name, description: p.description, gradeBand: p.gradeBand, thresholdDefault: p.thresholdDefault }]
  })

export type { BaselineFile } from "./baseline"
export { DEFAULT_BASELINE_PATH, loadBaseline, saveBaseline } from "./baseline"
export type { DeltaReportJSON, DimensionResultJSON, FindingJSON, Loc, ScoreResultJSON } from "./json"
export { fromScoreResultJSON, toDeltaReportJSON, toScoreResultJSON } from "./json"
export { builtinProviders } from "./providers"
export { VERSION } from "./version"

// Re-export the loop contract and the shared types so consumers need only depend on `prosemeter`.
export type {
  ConvergenceOptions,
  ConvergenceVerdict,
  DeltaReport,
  DimensionResult,
  DocumentStats,
  Finding,
  ScoreError,
  ScoreResult,
  Severity,
  UserConfig,
  Verdict,
} from "@prosemeter/core"
export { checkConvergence, compareBaseline, resolveConfig } from "@prosemeter/core"
