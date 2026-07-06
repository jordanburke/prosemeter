/**
 * paragraph-length — sentences per paragraph vs a band (~[1, 6]). Scores the average per-paragraph
 * band; flags paragraphs over 8 sentences with a split hint. Uses the nlcst tree so paragraph and
 * sentence boundaries match the rest of the engine. Skipped for plaintext.
 */

import type { DimensionProvider, DimensionResult, Finding } from "@prosemeter/core"
import { band } from "@prosemeter/core"
import { None, Some, Try } from "functype"
import type { Nodes as NlcstNode, Paragraph } from "nlcst"
import { visit } from "unist-util-visit"

import { PLAINTEXT_SKIP, skipped } from "./common"

const RULE = "paragraph-length"
const BAND_LO = 1
const BAND_HI = 6
const KB = 0.04
const SPLIT_THRESHOLD = 8

/** Average the per-paragraph band scores weighted by sentence count, so a short heading-paragraph
 * (which nlcst also models as a 1-sentence paragraph) can't dilute a genuine wall-of-text paragraph. */
const weightedAverage = (items: ReadonlyArray<{ score: number; weight: number }>): number => {
  const total = items.reduce((sum, i) => sum + i.weight, 0)
  return total === 0 ? 1 : items.reduce((sum, i) => sum + i.score * i.weight, 0) / total
}

export const paragraphLengthProvider: DimensionProvider = {
  id: "paragraph-length",
  defaultWeight: 0.06,
  evaluate: (doc, settings) =>
    Try((): DimensionResult => {
      const severity = settings.severities.get(RULE) ?? "warn"
      if (doc.format === "plaintext") return skipped("paragraph-length", settings.weight, PLAINTEXT_SKIP)
      if (severity === "off") return skipped("paragraph-length", settings.weight, `rule "${RULE}" disabled`)

      const counts: Array<{ sentences: number; node: Paragraph }> = []
      visit(doc.nlcst, "ParagraphNode", (node: NlcstNode) => {
        const paragraph = node as Paragraph
        let sentences = 0
        visit(paragraph, "SentenceNode", () => {
          sentences += 1
        })
        if (sentences > 0) counts.push({ sentences, node: paragraph })
      })

      if (counts.length === 0) return skipped("paragraph-length", settings.weight, "no paragraphs to measure")

      const findings: Array<Finding> = counts
        .filter((c) => c.sentences > SPLIT_THRESHOLD)
        .map((c) => ({
          rule: RULE,
          dimension: "paragraph-length",
          severity,
          message: `Paragraph runs ${c.sentences} sentences (band ${BAND_LO}–${BAND_HI}).`,
          hint: "Split this paragraph — one idea per paragraph reads better.",
          loc:
            c.node.position?.start.offset === undefined
              ? None()
              : Some({
                  line: c.node.position.start.line,
                  column: c.node.position.start.column,
                  offset: c.node.position.start.offset,
                  length: 0,
                }),
          excerpt: "",
        }))

      const score = weightedAverage(
        counts.map((c) => ({ score: band(c.sentences, BAND_LO, BAND_HI, KB), weight: c.sentences })),
      )
      return {
        id: "paragraph-length",
        score,
        weight: settings.weight,
        detail: `${counts.length} paragraph(s) vs band ${BAND_LO}–${BAND_HI} sentences`,
        findings,
        skipped: None(),
      }
    }),
}
