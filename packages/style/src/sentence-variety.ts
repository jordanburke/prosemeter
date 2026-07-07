/**
 * sentence-variety — rewards a healthy spread of sentence lengths. Scores the coefficient of
 * variation (stddev / mean) of per-sentence word counts with the band strategy, and flags long runs
 * of same-length sentences (monotone rhythm). CoV lives on a 0–1 scale, so it uses a steeper band
 * constant than the grade dimensions. Skipped for documents with too few sentences to assess.
 */

import type { DimensionProvider, DimensionResult, Finding, ParsedDocument, Severity } from "@prosemeter/core"
import { band } from "@prosemeter/core"
import { None, Some, Try } from "functype"
import type { Nodes as NlcstNode, Sentence } from "nlcst"
import { toString as nlcstToString } from "nlcst-to-string"
import { visit } from "unist-util-visit"

const RULE = "sentence-variety"
// Calibration constants (frozen in the Phase 4 calibration pass):
const BAND_LO = 0.4
const BAND_HI = 0.9
const KB = 8
const MIN_SENTENCES = 4
const RUN_LENGTH = 4
const RUN_TOLERANCE = 1
const MAX_EXCERPT = 90

const truncate = (text: string): string => {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length <= MAX_EXCERPT ? clean : `${clean.slice(0, MAX_EXCERPT - 1)}…`
}

const locOf = (sentence: Sentence): Finding["loc"] => {
  const pos = sentence.position
  if (pos?.start?.offset === undefined) return None()
  return Some({ line: pos.start.line, column: pos.start.column, offset: pos.start.offset, length: 0 })
}

type Counted = { readonly words: number; readonly node: Sentence }

const collectSentences = (doc: ParsedDocument): ReadonlyArray<Counted> => {
  const sentences: Array<Counted> = []
  visit(doc.nlcst, "SentenceNode", (node: NlcstNode) => {
    const sentence = node as Sentence
    let words = 0
    visit(sentence, "WordNode", () => {
      words += 1
    })
    if (words > 0) sentences.push({ words, node: sentence })
  })
  return sentences
}

const coefficientOfVariation = (lengths: ReadonlyArray<number>): number => {
  const mean = lengths.reduce((sum, n) => sum + n, 0) / lengths.length
  if (mean === 0) return 0
  const variance = lengths.reduce((sum, n) => sum + (n - mean) ** 2, 0) / lengths.length
  return Math.sqrt(variance) / mean
}

const monotoneRunFindings = (sentences: ReadonlyArray<Counted>, severity: Severity): ReadonlyArray<Finding> => {
  const findings: Array<Finding> = []
  let runStart = 0
  for (let i = 1; i <= sentences.length; i += 1) {
    const prev = sentences[i - 1]
    const cur = sentences[i]
    const continues = cur !== undefined && prev !== undefined && Math.abs(cur.words - prev.words) <= RUN_TOLERANCE
    if (!continues) {
      const runLength = i - runStart
      const anchor = sentences[runStart]
      if (runLength >= RUN_LENGTH && anchor !== undefined) {
        findings.push({
          rule: RULE,
          dimension: "sentence-variety",
          severity,
          message: `${runLength} consecutive sentences are about the same length (~${anchor.words} words).`,
          hint: "Vary sentence length — mix short and long sentences to improve rhythm.",
          loc: locOf(anchor.node),
          excerpt: truncate(nlcstToString(anchor.node)),
        })
      }
      runStart = i
    }
  }
  return findings
}

export const sentenceVarietyProvider: DimensionProvider = {
  id: "sentence-variety",
  defaultWeight: 0.05,
  evaluate: (doc, settings) =>
    Try((): DimensionResult => {
      const severity: Severity | "off" = settings.severities.get(RULE) ?? "warn"
      if (severity === "off") {
        return {
          id: "sentence-variety",
          score: 0,
          weight: settings.weight,
          detail: `skipped: rule "${RULE}" disabled`,
          findings: [],
          skipped: Some(`rule "${RULE}" disabled`),
        }
      }

      const sentences = collectSentences(doc)
      if (sentences.length < MIN_SENTENCES) {
        return {
          id: "sentence-variety",
          score: 0,
          weight: settings.weight,
          detail: `skipped: too few sentences for variety (${sentences.length} < ${MIN_SENTENCES})`,
          findings: [],
          skipped: Some(`too few sentences for variety (< ${MIN_SENTENCES})`),
        }
      }

      const cov = coefficientOfVariation(sentences.map((s) => s.words))
      return {
        id: "sentence-variety",
        score: band(cov, BAND_LO, BAND_HI, KB),
        weight: settings.weight,
        detail: `sentence-length variation ${cov.toFixed(2)} vs band ${BAND_LO}–${BAND_HI}`,
        findings: monotoneRunFindings(sentences, severity),
        skipped: None(),
      }
    }),
}
