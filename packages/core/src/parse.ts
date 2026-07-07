/**
 * Parse once, share everywhere.
 *
 *   raw string
 *     → remark-parse (+ remark-frontmatter, remark-gfm)   → mdast
 *     → mdast-util-to-nlcst (parse-english)                → nlcst (positions preserved)
 *     → prose plaintext + document stats
 *
 * Every scorer reads the resulting `ParsedDocument`, so trees and prose extraction are identical
 * across dimensions. Building the nlcst tree with `mdast-util-to-nlcst` (what the remark→retext
 * bridge uses internally) keeps every nlcst position mapped back to the original markdown source,
 * so findings report real `file:line:col` locations.
 */

import { Either } from "functype"
import type { Nodes as MdastNode, Root as MdastRoot } from "mdast"
import { toNlcst } from "mdast-util-to-nlcst"
import { toString as mdastToString } from "mdast-util-to-string"
import type { Nodes as NlcstNode, Root as NlcstRoot } from "nlcst"
import { toString as nlcstToString } from "nlcst-to-string"
import { ParseEnglish } from "parse-english"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { syllable } from "syllable"
import { unified } from "unified"
import { visit } from "unist-util-visit"
import { VFile } from "vfile"

import type { DocumentFormat, DocumentStats, ParsedDocument, ParseError } from "./types"

const markdownProcessor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml", "toml"]).use(remarkGfm)

/** A capitalized word is treated as a likely proper noun and excluded from the complex-word count. */
const isLikelyProperNoun = (word: string): boolean => /^[A-Z]/.test(word)

const countLetters = (text: string): number => (text.match(/[A-Za-z0-9]/g) ?? []).length

const proseStats = (
  nlcst: NlcstRoot,
): Pick<DocumentStats, "words" | "sentences" | "paragraphs" | "characters" | "syllables" | "complexWords"> => {
  const acc = { words: 0, sentences: 0, paragraphs: 0, characters: 0, syllables: 0, complexWords: 0 }
  visit(nlcst, (node: NlcstNode) => {
    if (node.type === "WordNode") {
      const text = nlcstToString(node)
      const syl = syllable(text)
      acc.words += 1
      acc.syllables += syl
      acc.characters += countLetters(text)
      if (syl >= 3 && !isLikelyProperNoun(text)) acc.complexWords += 1
    } else if (node.type === "SentenceNode") {
      acc.sentences += 1
    } else if (node.type === "ParagraphNode") {
      acc.paragraphs += 1
    }
  })
  return acc
}

const structureStats = (mdast: MdastRoot): Pick<DocumentStats, "headings" | "codeBlocks" | "links" | "listItems"> => {
  const headings: Array<{ depth: number; text: string; line: number }> = []
  const acc = { codeBlocks: 0, links: 0, listItems: 0 }
  visit(mdast, (node: MdastNode) => {
    switch (node.type) {
      case "heading":
        headings.push({ depth: node.depth, text: mdastToString(node), line: node.position?.start.line ?? 0 })
        break
      case "code":
        acc.codeBlocks += 1
        break
      case "link":
      case "linkReference":
        acc.links += 1
        break
      case "listItem":
        acc.listItems += 1
        break
      default:
        break
    }
  })
  return { headings, ...acc }
}

const computeStats = (mdast: MdastRoot, nlcst: NlcstRoot): DocumentStats => ({
  ...proseStats(nlcst),
  ...structureStats(mdast),
})

/**
 * Parse raw text into a `ParsedDocument`. Empty/whitespace-only input and prose-free input are
 * distinct `Left` errors — never a vacuous full-marks score (they drive CLI exit code 2).
 */
export const parse = (raw: string, format?: DocumentFormat): Either<ParseError, ParsedDocument> => {
  if (raw.trim().length === 0) {
    return Either.left<ParseError, ParsedDocument>({ kind: "empty", message: "Input is empty or whitespace only." })
  }

  const file = new VFile({ value: raw })
  const mdast = markdownProcessor.parse(file) as MdastRoot
  const nlcst = toNlcst(mdast, file, ParseEnglish) as NlcstRoot
  const stats = computeStats(mdast, nlcst)

  if (stats.words === 0) {
    return Either.left<ParseError, ParsedDocument>({
      kind: "no-prose",
      message: "Document contains no analyzable prose (only code, front matter, or markup).",
    })
  }

  return Either.right<ParseError, ParsedDocument>({
    raw,
    format: format ?? "markdown",
    mdast,
    nlcst,
    plaintext: nlcstToString(nlcst),
    stats,
  })
}
