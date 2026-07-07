/**
 * document-balance — a coarse v1 proxy for whether a document mixes prose with supporting structure
 * (links, lists, code) at a healthy rate rather than reading as an undifferentiated block or a link
 * farm. Scores link density (links per 1000 words) against a band; profiles can raise the ceiling.
 * Skipped for plaintext. (Refinement — list/code ratios per section — is future work.)
 */

import type { DimensionProvider, DimensionResult, Finding } from "@prosemeter/core"
import { band } from "@prosemeter/core"
import { None, Some, Try } from "functype"

import { numberOption, PLAINTEXT_SKIP, skipped } from "./common"

const RULE = "document-balance"
const KB = 0.0005
const DEFAULT_MAX_LINKS_PER_1000 = 40

export const documentBalanceProvider: DimensionProvider = {
  id: "document-balance",
  defaultWeight: 0.06,
  evaluate: (doc, settings) =>
    Try((): DimensionResult => {
      const severity = settings.severities.get(RULE) ?? "warn"
      if (doc.format === "plaintext") return skipped("document-balance", settings.weight, PLAINTEXT_SKIP)
      if (severity === "off") return skipped("document-balance", settings.weight, `rule "${RULE}" disabled`)

      const { words, links } = doc.stats
      if (words === 0) return skipped("document-balance", settings.weight, "no prose to measure")

      const maxLinks = numberOption(settings.options, "maxLinksPer1000", DEFAULT_MAX_LINKS_PER_1000)
      const linksPer1000 = links / (words / 1000)
      const score = band(linksPer1000, 0, maxLinks, KB)
      const findings: Array<Finding> =
        linksPer1000 > maxLinks
          ? [
              {
                rule: RULE,
                dimension: "document-balance",
                severity,
                message: `High link density: ${linksPer1000.toFixed(0)} links per 1000 words (max ${maxLinks}).`,
                hint: "Trim links or add prose — the document reads more like a list of links than a document.",
                loc: Some({ line: 1, column: 1, offset: 0, length: 0 }),
                excerpt: "",
              },
            ]
          : []

      return {
        id: "document-balance",
        score,
        weight: settings.weight,
        detail: `${linksPer1000.toFixed(1)} links / 1000 words (max ${maxLinks}), ${doc.stats.listItems} list item(s), ${doc.stats.codeBlocks} code block(s)`,
        findings,
        skipped: None(),
      }
    }),
}
