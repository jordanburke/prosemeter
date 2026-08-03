/**
 * redundancy — repeated words (retext-repeated-words), redundant acronyms (retext-redundant-acronyms),
 * and clichés (in-house). Each sub-check is gated by its own rule severity; the dimension is skipped
 * only when all three are off. Density-scored (k=0.4).
 */

import type { DimensionProvider, DimensionResult, Finding, Severity } from "@prosemeter/core"
import { density } from "@prosemeter/core"
import { None, Some, Try } from "functype"
import retextRedundantAcronyms from "retext-redundant-acronyms"
import retextRepeatedWords from "retext-repeated-words"
import { unified } from "unified"

import { findCliches } from "./cliches"
import { collectMessages, messageToFinding } from "./retext-runner"

const K = 0.06

export const concisionProvider: DimensionProvider = {
  id: "concision",
  defaultWeight: 0.04,
  evaluate: (doc, settings) =>
    Try((): DimensionResult => {
      const severityFor = (rule: string): Severity | "off" => settings.severities.get(rule) ?? "warn"
      const repeated = severityFor("retext-repeated-words")
      const redundant = severityFor("retext-redundant-acronyms")
      const cliche = severityFor("cliches")

      if (repeated === "off" && redundant === "off" && cliche === "off") {
        return {
          id: "concision",
          score: 0,
          weight: settings.weight,
          detail: "skipped: all concision rules disabled",
          findings: [],
          skipped: Some("all concision rules disabled"),
        }
      }

      const findings: Array<Finding> = []
      if (repeated !== "off") {
        findings.push(
          ...collectMessages(doc, unified().use(retextRepeatedWords)).map((m) =>
            messageToFinding(m, "concision", repeated, "Remove the duplicated word."),
          ),
        )
      }
      if (redundant !== "off") {
        findings.push(
          ...collectMessages(doc, unified().use(retextRedundantAcronyms)).map((m) =>
            messageToFinding(m, "concision", redundant, "Drop the redundant word next to the acronym."),
          ),
        )
      }
      if (cliche !== "off") {
        findings.push(...findCliches(doc, "concision", cliche))
      }

      return {
        id: "concision",
        score: density(findings.length, doc.stats.words, K),
        weight: settings.weight,
        detail: `${findings.length} concision issue${findings.length === 1 ? "" : "s"} (repeats, redundant acronyms, clichés) / ${doc.stats.words} words`,
        findings,
        skipped: None(),
      }
    }),
}
