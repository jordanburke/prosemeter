/**
 * spelling-consistency — flags mixed US/UK spelling. For each spelling pair where both variants
 * appear in the document, the minority variant's occurrences are the violations (nudging toward one
 * consistent convention rather than picking a "correct" one). Density-scored (k=0.5).
 */

import type { DimensionProvider, DimensionResult, Finding } from "@prosemeter/core"
import { density } from "@prosemeter/core"
import { None, Some, Try } from "functype"

import { US_UK_PAIRS } from "./wordlists"
import { collectWords, wordLoc, type WordToken } from "./words"

const RULE = "spelling-consistency"
const K = 0.08

export const spellingConsistencyProvider: DimensionProvider = {
  id: "spelling-consistency",
  defaultWeight: 0.02,
  evaluate: (doc, settings) =>
    Try((): DimensionResult => {
      const severity = settings.severities.get(RULE) ?? "warn"
      if (severity === "off") {
        return {
          id: "spelling-consistency",
          score: 0,
          weight: settings.weight,
          detail: `skipped: rule "${RULE}" disabled`,
          findings: [],
          skipped: Some(`rule "${RULE}" disabled`),
        }
      }

      const byForm = new Map<string, Array<WordToken>>()
      for (const token of collectWords(doc.nlcst)) {
        const key = token.text.toLowerCase()
        const bucket = byForm.get(key) ?? []
        bucket.push(token)
        byForm.set(key, bucket)
      }

      const findings: Array<Finding> = []
      for (const [us, uk] of US_UK_PAIRS) {
        const usHits = byForm.get(us) ?? []
        const ukHits = byForm.get(uk) ?? []
        if (usHits.length === 0 || ukHits.length === 0) continue // no mixing
        const [minority, majorityForm] = usHits.length <= ukHits.length ? [usHits, uk] : [ukHits, us]
        for (const token of minority) {
          findings.push({
            rule: RULE,
            dimension: "spelling-consistency",
            severity,
            message: `Mixed spelling: "${token.text}" alongside "${majorityForm}".`,
            hint: `Use one convention consistently — prefer "${majorityForm}" here.`,
            loc: wordLoc(token.node),
            excerpt: token.text,
          })
        }
      }

      return {
        id: "spelling-consistency",
        score: density(findings.length, doc.stats.words, K),
        weight: settings.weight,
        detail: `${findings.length} mixed-spelling occurrence(s) / ${doc.stats.words} words`,
        findings,
        skipped: None(),
      }
    }),
}
