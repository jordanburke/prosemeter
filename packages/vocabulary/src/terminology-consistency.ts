/**
 * terminology-consistency — flags the same concept written inconsistently. Detects case variants of
 * a notable term ("GitHub" vs "Github") by grouping non-sentence-initial words and, when a profile
 * or config supplies a term map, flags any configured variant. Density-scored (k=0.8).
 *
 * Hyphenation variants ("front-end" vs "frontend") are left to the config term map: parse-english
 * splits hyphenated words into separate tokens, so automatic detection is unreliable.
 */

import type { DimensionProvider, DimensionResult, Finding, Severity } from "@prosemeter/core"
import { density } from "@prosemeter/core"
import { None, Some, Try } from "functype"

import { collectWords, wordLoc, type WordToken } from "./words"

const RULE = "terminology-consistency"
const K = 0.1

/** An internal (non-first-letter) capital marks a brand / camelCase term whose casing is meaningful. */
const hasInternalCapital = (word: string): boolean => /[A-Z]/.test(word.slice(1))

const caseVariantFindings = (words: ReadonlyArray<WordToken>, severity: Severity): ReadonlyArray<Finding> => {
  const groups = new Map<string, Map<string, Array<WordToken>>>()
  for (const token of words) {
    if (token.text.length < 2) continue
    const key = token.text.toLowerCase()
    const forms = groups.get(key) ?? new Map<string, Array<WordToken>>()
    const bucket = forms.get(token.text) ?? []
    bucket.push(token)
    forms.set(token.text, bucket)
    groups.set(key, forms)
  }

  const findings: Array<Finding> = []
  for (const forms of groups.values()) {
    if (forms.size < 2) continue
    // Only flag concepts where some variant has an internal capital (a brand like "GitHub"), so
    // sentence-initial capitalization ("the" vs "The") is never mistaken for an inconsistency.
    if (![...forms.keys()].some(hasInternalCapital)) continue
    const canonical = [...forms.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0]
    if (canonical === undefined) continue
    for (const [form, tokens] of forms) {
      if (form === canonical) continue
      for (const token of tokens) {
        findings.push({
          rule: RULE,
          dimension: "terminology-consistency",
          severity,
          message: `"${form}" is inconsistent with "${canonical}" used elsewhere.`,
          hint: `Use "${canonical}" consistently throughout.`,
          loc: wordLoc(token.node),
          excerpt: form,
        })
      }
    }
  }
  return findings
}

const termMapFindings = (
  words: ReadonlyArray<WordToken>,
  options: Readonly<Record<string, unknown>>,
  severity: Severity,
): ReadonlyArray<Finding> => {
  const terms = options["terms"]
  if (terms === null || typeof terms !== "object") return []

  const variantToCanonical = new Map<string, string>()
  for (const [canonical, variants] of Object.entries(terms as Record<string, unknown>)) {
    if (!Array.isArray(variants)) continue
    for (const variant of variants) {
      if (typeof variant === "string") variantToCanonical.set(variant.toLowerCase(), canonical)
    }
  }
  if (variantToCanonical.size === 0) return []

  const findings: Array<Finding> = []
  for (const token of words) {
    const canonical = variantToCanonical.get(token.text.toLowerCase())
    if (canonical !== undefined && token.text !== canonical) {
      findings.push({
        rule: RULE,
        dimension: "terminology-consistency",
        severity,
        message: `"${token.text}" should be "${canonical}".`,
        hint: `Use the preferred term "${canonical}".`,
        loc: wordLoc(token.node),
        excerpt: token.text,
      })
    }
  }
  return findings
}

export const terminologyConsistencyProvider: DimensionProvider = {
  id: "terminology-consistency",
  defaultWeight: 0.05,
  evaluate: (doc, settings) =>
    Try((): DimensionResult => {
      const severity = settings.severities.get(RULE) ?? "warn"
      if (severity === "off") {
        return {
          id: "terminology-consistency",
          score: 0,
          weight: settings.weight,
          detail: `skipped: rule "${RULE}" disabled`,
          findings: [],
          skipped: Some(`rule "${RULE}" disabled`),
        }
      }

      const words = collectWords(doc.nlcst)
      const findings = [...caseVariantFindings(words, severity), ...termMapFindings(words, settings.options, severity)]

      return {
        id: "terminology-consistency",
        score: density(findings.length, doc.stats.words, K),
        weight: settings.weight,
        detail: `${findings.length} inconsistent term use(s) / ${doc.stats.words} words`,
        findings,
        skipped: None(),
      }
    }),
}
