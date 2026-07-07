/** clarity — flags wordy phrases via retext-simplify, folding its simpler alternative into the hint. */

import retextSimplify from "retext-simplify"
import { unified } from "unified"

import { retextDensityDimension } from "./retext-dimension"

export const clarityProvider = retextDensityDimension({
  id: "clarity",
  defaultWeight: 0.08,
  rule: "retext-simplify",
  k: 0.06,
  label: "wordy phrase(s)",
  fallbackHint: "Simplify or remove this phrase.",
  buildProcessor: () => unified().use(retextSimplify),
})
