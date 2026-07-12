/**
 * Tool handlers — thin, testable wrappers over the prosemeter bundle API. Each returns the JSON
 * string the MCP tool emits, or throws `ToolError` (a user-facing message) on bad input. No scoring
 * logic lives here; that is all in the engine.
 */

import { readFileSync } from "node:fs"
import { extname } from "node:path"

import type { DimensionHistory, ScoreError, ScoreResultJSON, UserConfig } from "prosemeter"
import {
  checkConvergenceDetailed,
  compareBaseline,
  fromScoreResultJSON,
  profiles,
  score,
  toDeltaReportJSON,
  toScoreResultJSON,
} from "prosemeter"

/** A user-facing tool error (bad input, unreadable file) — surfaced to the MCP client verbatim. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ToolError"
  }
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e))

const scoreErrorMessage = (e: ScoreError): string =>
  e.kind === "parse"
    ? e.error.message
    : `Invalid configuration: ${e.errors
        .toArray()
        .map((x) => x.message)
        .join("; ")}`

const inferFormat = (path: string): "markdown" | "plaintext" => {
  const ext = extname(path).toLowerCase()
  return ext === ".md" || ext === ".markdown" ? "markdown" : "plaintext"
}

const pretty = (value: unknown): string => JSON.stringify(value, null, 2)

export type ScoreTextArgs = { text: string; profile?: string; format?: "markdown" | "plaintext" }

export const scoreTextHandler = (args: ScoreTextArgs): string =>
  score(args.text, { profile: args.profile, format: args.format, target: "<text>" }).fold(
    (err) => {
      throw new ToolError(scoreErrorMessage(err))
    },
    (result) => pretty(toScoreResultJSON(result)),
  )

export type ScoreFileArgs = { path: string; profile?: string; configPath?: string }

export const scoreFileHandler = (args: ScoreFileArgs): string => {
  let text: string
  try {
    text = readFileSync(args.path, "utf8")
  } catch (e) {
    throw new ToolError(`Cannot read file "${args.path}": ${errMsg(e)}`)
  }

  let config: UserConfig = {}
  if (args.configPath !== undefined) {
    try {
      config = JSON.parse(readFileSync(args.configPath, "utf8")) as UserConfig
    } catch (e) {
      throw new ToolError(`Cannot read config "${args.configPath}": ${errMsg(e)}`)
    }
  }

  return score(text, { profile: args.profile, config, format: inferFormat(args.path), target: args.path }).fold(
    (err) => {
      throw new ToolError(scoreErrorMessage(err))
    },
    (result) => pretty(toScoreResultJSON(result)),
  )
}

export type CompareBaselineArgs = { current: ScoreResultJSON; baseline: ScoreResultJSON }

export const compareBaselineHandler = (args: CompareBaselineArgs): string =>
  pretty(toDeltaReportJSON(compareBaseline(fromScoreResultJSON(args.current), fromScoreResultJSON(args.baseline))))

export type CheckConvergenceArgs = {
  history: ReadonlyArray<number>
  dimensions?: ReadonlyArray<DimensionHistory>
  threshold?: number
  window?: number
  epsilon?: number
}

export const checkConvergenceHandler = (args: CheckConvergenceArgs): string => {
  const { verdict, churning } = checkConvergenceDetailed(args.history, args.dimensions ?? [], {
    threshold: args.threshold,
    window: args.window,
    epsilon: args.epsilon,
  })
  const detail =
    args.history.length <= 1
      ? "not enough history yet — score at least twice before trusting a verdict (one score yields 'improving' by default)"
      : churning.length > 0
        ? `history ${args.history.join(" → ")} → ${verdict}; dimensions churning under a flat composite: ${churning.join(", ")}`
        : `history ${args.history.join(" → ")} → ${verdict}`
  return pretty({ verdict, churning, detail })
}

export const listProfilesHandler = (): string => pretty(profiles())
