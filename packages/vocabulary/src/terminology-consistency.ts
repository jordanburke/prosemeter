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

/**
 * Does this form carry casing that means something — a brand or camelCase term like `GitHub`?
 *
 * An internal capital alone is not enough, and assuming it was produced this rule's worst false
 * positives. `/[A-Z]/.test("INSERT".slice(1))` is true, so every ALL-CAPS word qualified as
 * "brand-like", and the rule then flagged the SQL keyword `INSERT` against the ordinary verb
 * `insert`. Measured across 604 corpus documents, every sampled finding was of exactly this shape:
 * INSERT/insert, DELETE/delete, UPDATE/Update.
 *
 * ALL-CAPS is a different signal from mixed case. It marks an acronym, a keyword, or emphasis —
 * none of which is an inconsistent spelling of the lowercase word beside it. So a form qualifies
 * only when it has an internal capital *and* is not entirely uppercase.
 *
 * `GitHub` still qualifies, so `GitHub` vs `Github` is still caught. `API` vs `api` is no longer
 * flagged, which is the deliberate cost: it is occasionally a real inconsistency, and it is far
 * more often a keyword sitting next to a common word.
 */
const stripPlural = (word: string): string => (word.length > 2 && word.endsWith("s") ? word.slice(0, -1) : word)

const hasMeaningfulCase = (word: string): boolean => {
  // The plural `s` is stripped first, or `UPDATEs` and `GETs` read as mixed case and survive the
  // all-caps test — which is exactly what they did on the first pass at this fix.
  const stem = stripPlural(word)
  return /[A-Z]/.test(stem.slice(1)) && stem !== stem.toUpperCase()
}

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
    // Only flag concepts where some variant carries meaningful casing (a brand like "GitHub"), so
    // sentence-initial capitalization ("the" vs "The") is never mistaken for an inconsistency, and
    // neither is an ALL-CAPS keyword beside its lowercase homograph.
    if (![...forms.keys()].some(hasMeaningfulCase)) continue
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
