/**
 * sentence-complexity — per-sentence flagging of hard-to-read sentences.
 *
 * In-house rule module (doctrine rule 2): for each sentence we compute the same five-formula median
 * grade used at the document level and flag any sentence whose grade sits above the profile band's
 * top. Density-scored so it's length-fair. Each flagged sentence becomes a finding with its text,
 * location, and a concrete "N words, grade ~G — split or simplify" hint.
 */

import type { DimensionProvider, DimensionResult, Finding, Severity } from "@prosemeter/core"
import { density } from "@prosemeter/core"
import { None, Some, Try } from "functype"
import type { Nodes as NlcstNode, Sentence } from "nlcst"
import { toString as nlcstToString } from "nlcst-to-string"
import { syllable } from "syllable"
import { visit } from "unist-util-visit"

import { gradeBreakdown } from "./formulas"

const RULE = "sentence-length"
const K = 0.6
/** Short sentences skew per-sentence grade formulas, so only longer sentences are eligible. */
const MIN_SENTENCE_WORDS = 8
const MAX_EXCERPT = 120

const isLikelyProperNoun = (word: string): boolean => /^[A-Z]/.test(word)
const countLetters = (text: string): number => (text.match(/[A-Za-z0-9]/g) ?? []).length

const truncate = (text: string): string => {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length <= MAX_EXCERPT ? clean : `${clean.slice(0, MAX_EXCERPT - 1)}…`
}

type SentenceCounts = { words: number; syllables: number; complexWords: number; characters: number }

const sentenceCounts = (sentence: Sentence): SentenceCounts => {
  const acc: SentenceCounts = { words: 0, syllables: 0, complexWords: 0, characters: 0 }
  visit(sentence, "WordNode", (word: NlcstNode) => {
    const text = nlcstToString(word)
    const syl = syllable(text)
    acc.words += 1
    acc.syllables += syl
    acc.characters += countLetters(text)
    if (syl >= 3 && !isLikelyProperNoun(text)) acc.complexWords += 1
  })
  return acc
}

const locOf = (sentence: Sentence): Finding["loc"] => {
  const pos = sentence.position
  if (pos?.start?.offset === undefined || pos.end?.offset === undefined) return None()
  return Some({
    line: pos.start.line,
    column: pos.start.column,
    offset: pos.start.offset,
    length: pos.end.offset - pos.start.offset,
  })
}

// Median of the same five grade formulas used at the document level, over a single sentence.
const sentenceGrade = (c: SentenceCounts): number =>
  gradeBreakdown({
    sentence: 1,
    word: c.words,
    syllable: c.syllables,
    complexWords: c.complexWords,
    characters: c.characters,
  }).median

export const sentenceComplexityProvider: DimensionProvider = {
  id: "sentence-complexity",
  defaultWeight: 0.1,
  evaluate: (doc, settings) =>
    Try((): DimensionResult => {
      const severity = (settings.severities.get(RULE) ?? "warn") as Severity | "off"
      if (severity === "off") {
        return {
          id: "sentence-complexity",
          score: 0,
          weight: settings.weight,
          detail: `skipped: rule "${RULE}" disabled`,
          findings: [],
          skipped: Some(`rule "${RULE}" disabled`),
        }
      }

      const hi = settings.gradeBand.hi
      const findings: Array<Finding> = []

      visit(doc.nlcst, "SentenceNode", (sentence: NlcstNode) => {
        const node = sentence as Sentence
        const counts = sentenceCounts(node)
        if (counts.words < MIN_SENTENCE_WORDS) return
        const grade = sentenceGrade(counts)
        if (grade <= hi) return
        const rounded = Math.round(grade)
        findings.push({
          rule: RULE,
          dimension: "sentence-complexity",
          severity,
          message: `Sentence reads at ~grade ${rounded}, above the target band top of ${hi}.`,
          hint: `${counts.words} words, grade ~${rounded} — split or simplify.`,
          loc: locOf(node),
          excerpt: truncate(nlcstToString(node)),
        })
      })

      return {
        id: "sentence-complexity",
        score: density(findings.length, doc.stats.words, K),
        weight: settings.weight,
        detail: `${findings.length} hard sentence${findings.length === 1 ? "" : "s"} / ${doc.stats.words} words`,
        findings,
        skipped: None(),
      }
    }),
}
