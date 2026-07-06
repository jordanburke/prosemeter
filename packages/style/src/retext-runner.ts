/**
 * Shared retext plumbing. Core hands every scorer a position-preserving nlcst tree, so a style
 * dimension just runs a retext plugin over it synchronously (`runSync`, no re-parse) and collects
 * the vfile messages — each carries a reason, an `expected` suggestion, and a location mapped back
 * to the original markdown source. `messageToFinding` folds `expected` into the agent-facing hint.
 */

import type { DimensionId, Finding, ParsedDocument, Severity } from "@prosemeter/core"
import { None, Some } from "functype"
import type { Root as NlcstRoot } from "nlcst"
import type { Processor } from "unified"
import { VFile } from "vfile"

type RetextMessage = VFile["messages"][number]
/** A retext processor with no parser/compiler, transforming the shared nlcst tree in place. */
export type RetextProcessor = Processor<undefined, NlcstRoot, undefined, undefined, undefined>

const MAX_EXCERPT = 120

const truncate = (text: string): string => (text.length <= MAX_EXCERPT ? text : `${text.slice(0, MAX_EXCERPT - 1)}…`)

/**
 * Run a configured retext processor over the shared nlcst tree and return its messages. Each
 * dimension builds its own `unified().use(...)` processor (well-typed at the call site) and passes
 * it here, avoiding generic plugin typing.
 */
export const collectMessages = (doc: ParsedDocument, processor: RetextProcessor): ReadonlyArray<RetextMessage> => {
  const file = new VFile({ value: doc.raw })
  processor.runSync(doc.nlcst, file)
  return file.messages
}

const locOf = (m: RetextMessage): Finding["loc"] => {
  const place = m.place
  if (place === null || place === undefined) return None()
  const start = "start" in place ? place.start : place
  if (start.offset === undefined) return None()
  return Some({
    line: start.line,
    column: start.column,
    offset: start.offset,
    length: typeof m.actual === "string" ? m.actual.length : 0,
  })
}

/** Turn a retext message into a Finding, folding its `expected` suggestion into the hint. */
export const messageToFinding = (
  m: RetextMessage,
  dimension: DimensionId,
  severity: Severity,
  fallbackHint: string,
): Finding => {
  const expected = Array.isArray(m.expected) ? m.expected.filter((e): e is string => typeof e === "string") : []
  const hint =
    expected.length > 0 && typeof m.actual === "string"
      ? `Replace "${m.actual}" with "${expected.join('" or "')}".`
      : fallbackHint
  return {
    rule: m.source ?? "retext",
    dimension,
    severity,
    message: m.reason,
    hint,
    loc: locOf(m),
    excerpt: truncate(typeof m.actual === "string" ? m.actual : m.reason),
  }
}
