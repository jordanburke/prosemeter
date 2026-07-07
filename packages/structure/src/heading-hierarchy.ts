/**
 * heading-hierarchy — flags structural heading problems: multiple H1s, skipped levels (h2→h4),
 * empty sections (a heading immediately followed by another), and bold text used as a pseudo-heading.
 * Density-scored (k=1.0). Skipped for plaintext.
 */

import type { DimensionProvider, DimensionResult, Finding } from "@prosemeter/core"
import { density } from "@prosemeter/core"
import { None, Try } from "functype"

import { lineFinding, PLAINTEXT_SKIP, skipped } from "./common"

const RULE = "heading-hierarchy"
const K = 0.15

export const headingHierarchyProvider: DimensionProvider = {
  id: "heading-hierarchy",
  defaultWeight: 0.06,
  evaluate: (doc, settings) =>
    Try((): DimensionResult => {
      const severity = settings.severities.get(RULE) ?? "warn"
      if (doc.format === "plaintext") return skipped("heading-hierarchy", settings.weight, PLAINTEXT_SKIP)
      if (severity === "off") return skipped("heading-hierarchy", settings.weight, `rule "${RULE}" disabled`)

      const findings: Array<Finding> = []
      const headings = doc.stats.headings

      // Multiple H1s.
      const h1s = headings.filter((h) => h.depth === 1)
      h1s
        .slice(1)
        .forEach((h) =>
          findings.push(
            lineFinding(
              "heading-hierarchy",
              RULE,
              severity,
              "Multiple H1 headings.",
              "Use a single H1 title; demote the rest.",
              h.line,
              h.text,
            ),
          ),
        )

      // Skipped levels (e.g. h2 -> h4).
      headings.forEach((h, i) => {
        const prev = headings[i - 1]
        if (prev !== undefined && h.depth - prev.depth > 1) {
          findings.push(
            lineFinding(
              "heading-hierarchy",
              RULE,
              severity,
              `Heading level jumps from h${prev.depth} to h${h.depth}.`,
              "Don't skip heading levels; step down one at a time.",
              h.line,
              h.text,
            ),
          )
        }
      })

      // Empty sections (heading directly followed by another heading) and bold-as-heading.
      const children = doc.mdast.children
      children.forEach((node, i) => {
        const next = children[i + 1]
        if (node.type === "heading" && next?.type === "heading" && next.depth <= node.depth) {
          findings.push(
            lineFinding(
              "heading-hierarchy",
              RULE,
              severity,
              "Empty section — heading has no content.",
              "Add content under this heading or remove it.",
              node.position?.start.line ?? 0,
              doc.stats.headings.find((h) => h.line === node.position?.start.line)?.text ?? "",
            ),
          )
        }
        if (node.type === "paragraph" && node.children.length === 1 && node.children[0]?.type === "strong") {
          findings.push(
            lineFinding(
              "heading-hierarchy",
              RULE,
              severity,
              "Bold text used as a heading.",
              "Use a real markdown heading (#) instead of bold text.",
              node.position?.start.line ?? 0,
              "",
            ),
          )
        }
      })

      return {
        id: "heading-hierarchy",
        score: density(findings.length, doc.stats.words, K),
        weight: settings.weight,
        detail: `${findings.length} heading issue${findings.length === 1 ? "" : "s"} across ${headings.length} heading(s)`,
        findings,
        skipped: None(),
      }
    }),
}
