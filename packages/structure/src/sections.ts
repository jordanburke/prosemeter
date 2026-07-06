/**
 * Split an mdast tree into sections — the content spans delimited by headings. Each section records
 * its opening heading (if any), source line, word count (code excluded), and how many list items and
 * code blocks it contains, which the structure dimensions read.
 */

import type { Heading, Root as MdastRoot, RootContent } from "mdast"
import { toString as mdastToString } from "mdast-util-to-string"

export type Section = {
  readonly heading: Heading | undefined
  readonly line: number
  readonly words: number
  readonly listItems: number
  readonly codeBlocks: number
}

const wordCount = (node: RootContent): number => {
  if (node.type === "code") return 0
  return mdastToString(node).split(/\s+/).filter(Boolean).length
}

type Mutable = { heading: Heading | undefined; line: number; words: number; listItems: number; codeBlocks: number }

const isEmpty = (s: Mutable): boolean =>
  s.heading === undefined && s.words === 0 && s.listItems === 0 && s.codeBlocks === 0

export const sections = (root: MdastRoot): ReadonlyArray<Section> => {
  const result: Array<Section> = []
  let current: Mutable = { heading: undefined, line: 1, words: 0, listItems: 0, codeBlocks: 0 }

  for (const node of root.children) {
    if (node.type === "heading") {
      if (!isEmpty(current)) result.push({ ...current })
      current = { heading: node, line: node.position?.start.line ?? 0, words: 0, listItems: 0, codeBlocks: 0 }
    } else {
      current.words += wordCount(node)
      if (node.type === "list") current.listItems += node.children.length
      if (node.type === "code") current.codeBlocks += 1
    }
  }
  if (!isEmpty(current)) result.push({ ...current })
  return result
}
