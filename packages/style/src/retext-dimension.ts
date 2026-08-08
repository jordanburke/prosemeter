/**
 * Factory for a single-plugin, density-scored style dimension (active-voice, clarity, directness).
 * Each maps its plugin's messages to findings and scores by violation density; when the dimension's
 * rule is turned off in the profile, it is skipped so a disabled check never inflates the score.
 */

import type { DimensionId, DimensionProvider, DimensionResult, Finding, ParsedDocument } from "@prosemeter/core"
import { density } from "@prosemeter/core"
import { None, Some, Try } from "functype"

import type { RetextProcessor } from "./retext-runner"
import { collectMessages, messageToFinding } from "./retext-runner"

export type RetextDimensionConfig = {
  readonly id: DimensionId
  readonly defaultWeight: number
  /** Rule name used for the profile severity lookup — the plugin's `source` (e.g. "retext-passive"). */
  readonly rule: string
  readonly k: number
  readonly label: string
  readonly fallbackHint: string
  /** Receives the profile's `dimensionOptions` entry so a plugin can be configured per profile. */
  readonly buildProcessor: (options: Readonly<Record<string, unknown>>) => RetextProcessor
  /**
   * Drop a finding the plugin should not have raised, before it is counted.
   *
   * These plugins match on the word alone. Most of the resulting false positives are fixed with an
   * ignore list, which is the right tool when a word is never a violation. This is for the case an
   * ignore list cannot express: a word that *is* a violation in one syntactic role and not in
   * another, so the decision needs the surrounding source rather than the word.
   *
   * Must run before `density` and before `detail`, both of which read `findings.length`. A filter
   * applied downstream would ship a result whose score counts findings it no longer reports.
   */
  readonly dropFinding?: (finding: Finding, doc: ParsedDocument) => boolean
}

export const retextDensityDimension = (config: RetextDimensionConfig): DimensionProvider => ({
  id: config.id,
  defaultWeight: config.defaultWeight,
  evaluate: (doc, settings) =>
    Try((): DimensionResult => {
      const severity = settings.severities.get(config.rule) ?? "warn"
      if (severity === "off") {
        return {
          id: config.id,
          score: 0,
          weight: settings.weight,
          detail: `skipped: rule "${config.rule}" disabled`,
          findings: [],
          skipped: Some(`rule "${config.rule}" disabled`),
        }
      }

      const raised = collectMessages(doc, config.buildProcessor(settings.options)).map((m) =>
        messageToFinding(m, config.id, severity, config.fallbackHint),
      )
      // Bind before narrowing so the call site needs no non-null assertion.
      const drop = config.dropFinding
      const findings = drop === undefined ? raised : raised.filter((f) => !drop(f, doc))

      return {
        id: config.id,
        score: density(findings.length, doc.stats.words, config.k),
        weight: settings.weight,
        detail: `${findings.length} ${config.label} / ${doc.stats.words} words`,
        findings,
        skipped: None(),
      }
    }),
})
