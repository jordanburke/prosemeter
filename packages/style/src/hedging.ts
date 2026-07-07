/** hedging — flags weasel words, hedges, and intensifiers via retext-intensify. Density-scored. */

import retextIntensify from "retext-intensify"
import { unified } from "unified"

import { retextDensityDimension } from "./retext-dimension"

export const hedgingProvider = retextDensityDimension({
  id: "hedging",
  defaultWeight: 0.05,
  rule: "retext-intensify",
  k: 0.04,
  label: "weasel/hedge word(s)",
  fallbackHint: "Cut the hedge or replace it with a concrete claim.",
  buildProcessor: () => unified().use(retextIntensify),
})
