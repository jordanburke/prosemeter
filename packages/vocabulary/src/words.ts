/**
 * Word extraction shared by the vocabulary dimensions. Walks the nlcst tree and yields each word
 * with its original casing, a sentence-initial flag (so capitalization at a sentence start isn't
 * mistaken for an inconsistent variant), and its source location.
 */

import type { Finding } from "@prosemeter/core"
import { None, Some } from "functype"
import type { Nodes as NlcstNode, Sentence, Word } from "nlcst"
import { toString as nlcstToString } from "nlcst-to-string"
import { visit } from "unist-util-visit"

export type WordToken = {
  readonly text: string
  readonly sentenceInitial: boolean
  readonly node: Word
}

export const collectWords = (root: NlcstNode): ReadonlyArray<WordToken> => {
  const tokens: Array<WordToken> = []
  visit(root, "SentenceNode", (node: NlcstNode) => {
    const sentence = node as Sentence
    let first = true
    visit(sentence, "WordNode", (wordNode: NlcstNode) => {
      const word = wordNode as Word
      tokens.push({ text: nlcstToString(word), sentenceInitial: first, node: word })
      first = false
    })
  })
  return tokens
}

export const wordLoc = (word: Word): Finding["loc"] => {
  const pos = word.position
  if (pos?.start?.offset === undefined) return None()
  return Some({
    line: pos.start.line,
    column: pos.start.column,
    offset: pos.start.offset,
    length: typeof pos.end?.offset === "number" ? pos.end.offset - pos.start.offset : 0,
  })
}
