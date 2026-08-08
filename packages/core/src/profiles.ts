/**
 * The seven built-in profiles — pure data. A profile carries a grade band, relative weight
 * overrides, per-rule severity overrides, a suggested threshold, and free-form per-dimension
 * options. Weight overrides are *relative*: the composite renormalizes by the active-weight sum, so
 * a profile only needs to nudge the dimensions it cares about, not restate a full 1.0 distribution.
 *
 * **`thresholdDefault` is a floor, not a target.** Measured 2026-08-07: no single dimension can fail
 * a threshold on any profile — zeroing the heaviest-weighted one on an otherwise perfect document
 * leaves 76.9–81.8, above every threshold here. A threshold is only failed when several dimensions
 * fail together, so it detects catastrophic prose and nothing finer. `fixtures/passive-heavy.md`,
 * built to demonstrate one flaw, scores 95 on `plain` and 98 on `api-docs`.
 *
 * What makes a threshold bite is profile tuning, not the number: `choppy-simplistic.md` fails only
 * `chat`, whose grade-band weight of 0.24 is the anti-gaming counterweight, and that extra 0.04 is
 * the entire margin. See docs/LIB_ANLY_threshold-semantics_2026-08-07.md.
 *
 * Weights and bands here are the design's starting points; calibrate against the golden corpus and
 * then freeze (see spec §8). Do not calibrate against `fixtures/` — they are handcrafted to isolate
 * single dimensions, which is exactly what makes them useless as a calibration set.
 */

import type { Profile } from "./types"

export const PROFILES: Readonly<Record<string, Profile>> = {
  plain: {
    name: "plain",
    description: "Neutral defaults for general prose. All dimensions at their default weight.",
    gradeBand: { lo: 8, hi: 12 },
    weights: {},
    rules: {},
    thresholdDefault: 70,
    dimensionOptions: {},
  },
  readme: {
    name: "readme",
    description: "Project READMEs: structure weighted up, clichés harsh.",
    gradeBand: { lo: 8, hi: 12 },
    weights: {
      "heading-hierarchy": 0.09,
      "section-length": 0.1,
      "document-balance": 0.08,
      concision: 0.06,
    },
    rules: {},
    thresholdDefault: 75,
    dimensionOptions: {
      "section-length": { lo: 40, hi: 400 },
    },
  },
  "api-docs": {
    name: "api-docs",
    description:
      "API reference docs: terminology consistency weighted up, passive voice tolerated, high code ratio expected.",
    gradeBand: { lo: 8, hi: 13 },
    weights: {
      "terminology-consistency": 0.09,
      "acronym-definition": 0.05,
      "active-voice": 0.04,
    },
    rules: {
      "retext-passive": "warn",
    },
    thresholdDefault: 72,
    dimensionOptions: {
      "document-balance": { codePerSection: "high" },
    },
  },
  blog: {
    name: "blog",
    description: "Blog posts: sentence variety and clarity weighted up, structure relaxed.",
    gradeBand: { lo: 7, hi: 10 },
    weights: {
      "sentence-variety": 0.08,
      clarity: 0.1,
      "heading-hierarchy": 0.03,
      "section-length": 0.04,
    },
    rules: {},
    thresholdDefault: 70,
    dimensionOptions: {},
  },
  marketing: {
    name: "marketing",
    description: "Marketing copy: brevity and simplicity harsh, directness harsh, lexical diversity relaxed.",
    gradeBand: { lo: 6, hi: 9 },
    weights: {
      clarity: 0.1,
      "sentence-simplicity": 0.14,
      directness: 0.08,
      "lexical-diversity": 0.02,
    },
    rules: {},
    thresholdDefault: 72,
    dimensionOptions: {},
  },
  academic: {
    name: "academic",
    description:
      "Academic writing: passive voice and hedging tolerated, grade band high. Both dimensions weighted down.",
    gradeBand: { lo: 12, hi: 16 },
    weights: {
      "active-voice": 0.03,
      directness: 0.02,
    },
    rules: {
      "retext-passive": "off",
    },
    thresholdDefault: 68,
    dimensionOptions: {},
  },
  chat: {
    name: "chat",
    description: "Agent chat replies: jargon and wordiness harsh, document structure disabled.",
    // Floor 7 as much as ceiling 12: chopping every sentence to eight words to game the readability
    // formulas lands *below* the band and is penalized, so the counterweight is in the band itself.
    //
    // Both the weight and the bidirectionality were challenged and re-measured (2026-08-04). Over
    // 416 eval answers the dimension scores exactly 100 on 87.5% of them, which looks like a flat
    // ~24-point giveaway. Swept `direction` x `weight` against the calibration assertions anyway:
    // every alternative failed. Floor-only lets chat-jargon.md (median grade 25.8) score 100 here
    // and collapses the register spread from 44 to 21. Any weight below 0.24 lets
    // choppy-simplistic.md clear the 75 threshold. The saturation is a guard rail being satisfied,
    // not a defect. See eval/README.md, "grade-band's weight and bidirectionality".
    gradeBand: { lo: 7, hi: 12 },
    weights: {
      // Up — the three complaints. grade-band and sentence-simplicity are the jargon proxies (the
      // syllable-counting formulas track polysyllabic vocabulary); clarity and concision carry
      // wordiness.
      "grade-band": 0.24,
      "sentence-simplicity": 0.19,
      clarity: 0.17,
      concision: 0.07,
      // Left at the default weight. This was held down to 0.03 while retext-intensify's
      // context-blind weasel list made the dimension anti-signal; `HEDGE_IGNORE_DEFAULT` fixed
      // that, and it now separates the calibration pair correctly (clear 80, jargon 41).
      // Also up: the direct guard against buying grade-band with telegraphic monotone sentences.
      "sentence-variety": 0.06,
      // Off — document-shaped dimensions that a conversational turn cannot satisfy. Bold labels are
      // correct in a terminal reply, replies have no sections or link budget, and acronym-definition
      // over a 1–2 acronym denominator is a coin flip that swamps the real signal.
      "heading-hierarchy": 0,
      "section-length": 0,
      "document-balance": 0,
      "acronym-definition": 0,
    },
    rules: {},
    thresholdDefault: 75,
    dimensionOptions: {},
  },
}

export const DEFAULT_PROFILE = "plain"

export const profileNames: ReadonlyArray<string> = Object.keys(PROFILES)
