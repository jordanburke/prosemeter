/** passive-voice — flags passive constructions via retext-passive. Density-scored (k=0.5). */

import retextPassive from "retext-passive"
import { unified } from "unified"

import { retextDensityDimension } from "./retext-dimension"

export const passiveVoiceProvider = retextDensityDimension({
  id: "passive-voice",
  defaultWeight: 0.08,
  rule: "retext-passive",
  k: 0.06,
  label: "passive construction(s)",
  fallbackHint: "Rewrite in the active voice — name the actor and use an active verb.",
  buildProcessor: () => unified().use(retextPassive),
})
