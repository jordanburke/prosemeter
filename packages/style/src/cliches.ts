/**
 * In-house cliché detection (doctrine rule 2 fallback). `retext-cliches` is unmaintained (last
 * published 2022, pre-unified-11), so this ports a curated high-signal subset of write-good's cliché
 * list (MIT) as a clearly-marked in-house rule module. Each cliché is matched case-insensitively at
 * word boundaries against each sentence, and reported at the sentence's source location.
 *
 * Rule name for profile severity lookup: "cliches".
 */

import type { DimensionId, Finding, ParsedDocument, Severity } from "@prosemeter/core"
import { None, Some } from "functype"
import type { Nodes as NlcstNode, Sentence } from "nlcst"
import { toString as nlcstToString } from "nlcst-to-string"
import { visit } from "unist-util-visit"

export const CLICHES: ReadonlyArray<string> = [
  "at the end of the day",
  "think outside the box",
  "low-hanging fruit",
  "move the needle",
  "boil the ocean",
  "circle back",
  "touch base",
  "on the same page",
  "hit the ground running",
  "push the envelope",
  "raise the bar",
  "best of both worlds",
  "win-win",
  "game changer",
  "paradigm shift",
  "core competency",
  "value add",
  "bang for your buck",
  "back to the drawing board",
  "when all is said and done",
  "needless to say",
  "for all intents and purposes",
  "in this day and age",
  "each and every",
  "first and foremost",
  "last but not least",
  "few and far between",
  "tip of the iceberg",
  "the fact of the matter",
  "only time will tell",
  "at this point in time",
  "in the final analysis",
  "a level playing field",
  "the bottom line",
  "cutting edge",
  "state of the art",
  "outside the box",
  "run it up the flagpole",
  "take it to the next level",
  "going forward",
  "at a loss for words",
  "avoid like the plague",
  "back against the wall",
  "ballpark figure",
  "beyond a shadow of a doubt",
  "calm before the storm",
  "dead as a doornail",
  "easier said than done",
  "explore all options",
  "give 110 percent",
  "grass is always greener",
  "in a nutshell",
  "it goes without saying",
  "leave no stone unturned",
  "make a long story short",
  "no pain no gain",
  "plenty of fish in the sea",
  "read between the lines",
  "the whole nine yards",
  "time will tell",
  "when push comes to shove",
]

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const CLICHE_PATTERNS: ReadonlyArray<{ readonly phrase: string; readonly re: RegExp }> = CLICHES.map((phrase) => ({
  phrase,
  re: new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i"),
}))

const locOf = (sentence: Sentence): Finding["loc"] => {
  const pos = sentence.position
  if (pos?.start?.offset === undefined) return None()
  return Some({ line: pos.start.line, column: pos.start.column, offset: pos.start.offset, length: 0 })
}

/** Scan each sentence for clichés, returning a finding per cliché occurrence. */
export const findCliches = (
  doc: ParsedDocument,
  dimension: DimensionId,
  severity: Severity,
): ReadonlyArray<Finding> => {
  const findings: Array<Finding> = []
  visit(doc.nlcst, "SentenceNode", (node: NlcstNode) => {
    const sentence = node as Sentence
    const text = nlcstToString(sentence)
    for (const { phrase, re } of CLICHE_PATTERNS) {
      if (re.test(text)) {
        findings.push({
          rule: "cliches",
          dimension,
          severity,
          message: `Cliché: "${phrase}".`,
          hint: `Replace the cliché "${phrase}" with specific, original wording.`,
          loc: locOf(sentence),
          excerpt: phrase,
        })
      }
    }
  })
  return findings
}
