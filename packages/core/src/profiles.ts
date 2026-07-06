/**
 * The six built-in profiles — pure data. A profile carries a grade band, relative weight overrides,
 * per-rule severity overrides, a suggested threshold, and free-form per-dimension options. Weight
 * overrides are *relative*: the composite renormalizes by the active-weight sum, so a profile only
 * needs to nudge the dimensions it cares about, not restate a full 1.0 distribution.
 *
 * Weights and bands here are the design's starting points; calibrate against the golden corpus and
 * then freeze (see spec §8).
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
      redundancy: 0.06,
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
      "passive-voice": 0.04,
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
    description: "Marketing copy: brevity and simplicity harsh, hedging harsh, lexical diversity relaxed.",
    gradeBand: { lo: 6, hi: 9 },
    weights: {
      clarity: 0.1,
      "sentence-complexity": 0.14,
      hedging: 0.08,
      "lexical-diversity": 0.02,
    },
    rules: {},
    thresholdDefault: 72,
    dimensionOptions: {},
  },
  academic: {
    name: "academic",
    description: "Academic writing: passive voice and hedging tolerated, grade band high.",
    gradeBand: { lo: 12, hi: 16 },
    weights: {
      "passive-voice": 0.03,
      hedging: 0.02,
    },
    rules: {
      "retext-passive": "off",
    },
    thresholdDefault: 68,
    dimensionOptions: {},
  },
}

export const DEFAULT_PROFILE = "plain"

export const profileNames: ReadonlyArray<string> = Object.keys(PROFILES)
