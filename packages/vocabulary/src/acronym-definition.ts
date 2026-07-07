/**
 * acronym-definition — flags acronyms used without ever being defined. An acronym (2+ capitals, not
 * in the allowlist) counts as defined if it appears parenthetically somewhere ("Full Name (ACRO)").
 * Ratio-scored: defined / total distinct acronyms. The allowlist is profile-extendable.
 */

import type { DimensionProvider, DimensionResult, Finding } from "@prosemeter/core"
import { ratio } from "@prosemeter/core"
import { None, Some, Try } from "functype"

import { ACRONYM_ALLOWLIST } from "./wordlists"
import { collectWords, wordLoc } from "./words"

const RULE = "acronym-definition"
const ACRONYM = /^[A-Z]{2,}s?$/

const base = (token: string): string => (token.endsWith("s") ? token.slice(0, -1) : token)

export const acronymDefinitionProvider: DimensionProvider = {
  id: "acronym-definition",
  defaultWeight: 0.03,
  evaluate: (doc, settings) =>
    Try((): DimensionResult => {
      const severity = settings.severities.get(RULE) ?? "warn"
      if (severity === "off") {
        return {
          id: "acronym-definition",
          score: 0,
          weight: settings.weight,
          detail: `skipped: rule "${RULE}" disabled`,
          findings: [],
          skipped: Some(`rule "${RULE}" disabled`),
        }
      }

      const extra = Array.isArray(settings.options["allowlist"])
        ? (settings.options["allowlist"] as ReadonlyArray<unknown>).filter((x): x is string => typeof x === "string")
        : []
      const allowlist = new Set([...ACRONYM_ALLOWLIST, ...extra].map((a) => a.toUpperCase()))

      // First occurrence of each distinct acronym base.
      const firstSeen = new Map<string, ReturnType<typeof collectWords>[number]>()
      for (const token of collectWords(doc.nlcst)) {
        if (!ACRONYM.test(token.text)) continue
        const acr = base(token.text).toUpperCase()
        if (allowlist.has(acr)) continue
        if (!firstSeen.has(acr)) firstSeen.set(acr, token)
      }

      const acronyms = [...firstSeen.keys()]
      if (acronyms.length === 0) {
        return {
          id: "acronym-definition",
          score: 1,
          weight: settings.weight,
          detail: "no undefined-prone acronyms",
          findings: [],
          skipped: None(),
        }
      }

      const isDefined = (acr: string): boolean => new RegExp(`\\(${acr}s?\\)`).test(doc.raw)
      const undefinedAcronyms = acronyms.filter((a) => !isDefined(a))

      const findings: Array<Finding> = undefinedAcronyms.map((acr) => {
        const token = firstSeen.get(acr)
        return {
          rule: RULE,
          dimension: "acronym-definition",
          severity,
          message: `Acronym "${acr}" is used without a definition.`,
          hint: `Expand "${acr}" on first use, e.g. "Full Name (${acr})".`,
          loc: token === undefined ? None() : wordLoc(token.node),
          excerpt: acr,
        }
      })

      return {
        id: "acronym-definition",
        score: ratio((acronyms.length - undefinedAcronyms.length) / acronyms.length),
        weight: settings.weight,
        detail: `${acronyms.length - undefinedAcronyms.length}/${acronyms.length} acronyms defined`,
        findings,
        skipped: None(),
      }
    }),
}
