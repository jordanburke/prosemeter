/**
 * Baseline persistence for the agent loop. A baseline file stores the last saved `ScoreResult`
 * plus the score history — the sequence `checkConvergence` reads to decide when to stop revising.
 * Each `--save-baseline` appends the current score to that history.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import type { ScoreResult } from "@prosemeter/core"

import type { ScoreResultJSON } from "./json"
import { toScoreResultJSON } from "./json"

export const DEFAULT_BASELINE_PATH = ".prosemeter/baseline.json"

export type BaselineFile = {
  readonly result: ScoreResultJSON
  readonly history: ReadonlyArray<number>
}

/** Read a baseline file, or `undefined` if it does not exist. Throws on malformed JSON. */
export const loadBaseline = (path: string): BaselineFile | undefined => {
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, "utf8")) as BaselineFile
}

/** Write `result` and the history (prior history with `result.score` appended) to `path`. */
export const saveBaseline = (path: string, result: ScoreResult, priorHistory: ReadonlyArray<number>): BaselineFile => {
  const file: BaselineFile = { result: toScoreResultJSON(result), history: [...priorHistory, result.score] }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, "utf8")
  return file
}
