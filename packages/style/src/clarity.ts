/** clarity — flags wordy phrases via retext-simplify, folding its simpler alternative into the hint. */

import retextSimplify from "retext-simplify"
import { unified } from "unified"

import { resolveIgnore } from "./ignore-options"
import { retextDensityDimension } from "./retext-dimension"

/**
 * Terms retext-simplify flags whose "simpler alternative" destroys a precise technical meaning.
 *
 * The plugin targets bureaucratic English, where `effect` is a verb ("effect change" → "cause") and
 * `component` is a vague stand-in for `part`. Software prose uses these as terms of art, and the
 * suggested replacements are wrong rather than simpler: `effect` → "choose/pick/result" mangles
 * `useEffect`, `component` → "part" mangles a React component, `interface` → "meet/work with"
 * mangles a TypeScript interface, and `function` → "act/role/work" mangles a function.
 *
 * Measured cost of leaving them in: across 154 generated answers and fixtures the dimension emitted
 * 973 flags, of which roughly 900 were domain nouns — `effect` 164, `request` 141, `render` 135,
 * `function` 118, `component` 54. Because those counts track subject matter rather than writing, the
 * dimension behaved as a topic detector: over the run-2 corpus its mean varied by 0.3 points across
 * writing-style variants and by 49.6 points across tasks.
 *
 * Deliberately still flagged, because they are padding in any register: the expletive constructions
 * (`it is`, `there is`, `there are`), `very`, `all of`, `currently`, `frequently`, `numerous`,
 * `however`, `subsequently`, `consequently`, `therefore`, `perform`, `proceed`, `eliminate`,
 * `immediately`, and the genuinely bureaucratic `aforementioned`, `heretofore`, `notwithstanding`,
 * `necessitate`.
 */
export const CLARITY_IGNORE_DEFAULT: ReadonlyArray<string> = [
  // Software terms of art — the replacement changes what the sentence means.
  "effect",
  "function",
  "component",
  "interface",
  "render",
  "request",
  "type",
  "delete",
  "implement",
  "monitor",
  "option",
  "aggregate",
  "allocate",
  "enumerate",
  "forward",
  "reflect",
  // Precise qualifiers. "identical" and "equivalent" are not synonyms for "same" when comparing
  // module instances or type shapes, and "previous"/"initial"/"subsequent" carry ordering.
  "identical",
  "equivalent",
  "multiple",
  "previous",
  "previously",
  "initial",
  "subsequent",
  "accurate",
  "requirement",
  // Domain verbs and nouns. "attempt" is a noun in retry logic; "purchase" is one in payments.
  "attempt",
  "satisfy",
  "maintain",
  "remain",
  "encounter",
  "benefit",
  "purchase",
]

export const clarityProvider = retextDensityDimension({
  id: "clarity",
  defaultWeight: 0.08,
  rule: "retext-simplify",
  k: 0.06,
  label: "wordy phrase(s)",
  fallbackHint: "Simplify or remove this phrase.",
  buildProcessor: (options) =>
    unified().use(retextSimplify, { ignore: resolveIgnore(options, CLARITY_IGNORE_DEFAULT) }),
})
