/**
 * Factory for a single-plugin, density-scored style dimension (passive-voice, clarity, hedging).
 * Each maps its plugin's messages to findings and scores by violation density; when the dimension's
 * rule is turned off in the profile, it is skipped so a disabled check never inflates the score.
 */

import type { DimensionId, DimensionProvider, DimensionResult } from "@prosemeter/core"
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
  readonly buildProcessor: () => RetextProcessor
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

      const findings = collectMessages(doc, config.buildProcessor()).map((m) =>
        messageToFinding(m, config.id, severity, config.fallbackHint),
      )

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
