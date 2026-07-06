/**
 * section-length — words per section vs a target band (profile-dependent, e.g. readme [40, 400]).
 * Scores the average per-section band; flags "wall of text" sections that exceed the band top with
 * no list or code break. Band constant is small because section lengths live on a hundreds scale.
 * Skipped for plaintext.
 */

import type { DimensionProvider, DimensionResult, Finding } from "@prosemeter/core"
import { band } from "@prosemeter/core"
import { None, Try } from "functype"

import { lineFinding, numberOption, PLAINTEXT_SKIP, skipped } from "./common"
import { sections } from "./sections"

const RULE = "section-length"
// Calibrated (Phase 4): steep enough that a long unbroken section (a "wall of text") is penalized.
const KB = 0.0002
const DEFAULT_LO = 40
const DEFAULT_HI = 500

/** Word-weighted average so a small preamble section can't dilute a genuine wall-of-text section. */
const weightedAverage = (items: ReadonlyArray<{ score: number; weight: number }>): number => {
  const total = items.reduce((sum, i) => sum + i.weight, 0)
  return total === 0 ? 1 : items.reduce((sum, i) => sum + i.score * i.weight, 0) / total
}

export const sectionLengthProvider: DimensionProvider = {
  id: "section-length",
  defaultWeight: 0.07,
  evaluate: (doc, settings) =>
    Try((): DimensionResult => {
      const severity = settings.severities.get(RULE) ?? "warn"
      if (doc.format === "plaintext") return skipped("section-length", settings.weight, PLAINTEXT_SKIP)
      if (severity === "off") return skipped("section-length", settings.weight, `rule "${RULE}" disabled`)

      const lo = numberOption(settings.options, "lo", DEFAULT_LO)
      const hi = numberOption(settings.options, "hi", DEFAULT_HI)
      const secs = sections(doc.mdast)
      if (secs.length === 0) return skipped("section-length", settings.weight, "no sections to measure")

      const findings: Array<Finding> = []
      for (const s of secs) {
        if (s.words > hi && s.listItems === 0 && s.codeBlocks === 0) {
          findings.push(
            lineFinding(
              "section-length",
              RULE,
              severity,
              `Wall of text: ${s.words} words with no list or code break (band ${lo}–${hi}).`,
              "Break this section into subsections, or add lists / examples.",
              s.line,
              s.heading === undefined ? "" : "",
            ),
          )
        }
      }

      const score = weightedAverage(
        secs.map((s) => ({ score: band(s.words, lo, hi, KB), weight: Math.max(s.words, 1) })),
      )
      const median = [...secs.map((s) => s.words)].sort((a, b) => a - b)[Math.floor(secs.length / 2)] ?? 0
      return {
        id: "section-length",
        score,
        weight: settings.weight,
        detail: `${secs.length} section(s), median ${median} words vs band ${lo}–${hi}`,
        findings,
        skipped: None(),
      }
    }),
}
