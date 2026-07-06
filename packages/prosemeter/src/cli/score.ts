/**
 * The `score` command. Reads each target (file or `-` for stdin), scores it with every built-in
 * dimension, and prints human or `--json` output. With `--baseline` / `--save-baseline` it diffs
 * against a stored baseline and reports the convergence verdict — the agent's stop signal.
 *
 * Exit codes: 0 pass · 1 below `--threshold` · 2 no/empty input, unreadable/invalid config or
 * baseline, or nothing scored. Baseline operations require a single target.
 */

import { existsSync, readFileSync } from "node:fs"
import { extname } from "node:path"
import process from "node:process"
import { parseArgs } from "node:util"

import type { ConfigError, DeltaReport, DocumentFormat, ScoreError, ScoreResult, UserConfig } from "@prosemeter/core"

import type { BaselineFile } from "../baseline"
import { DEFAULT_BASELINE_PATH, loadBaseline, saveBaseline } from "../baseline"
import {
  checkConvergence,
  compareBaseline,
  fromScoreResultJSON,
  resolveConfig,
  score,
  toDeltaReportJSON,
  toScoreResultJSON,
} from "../index"
import { renderConvergence, renderDelta, renderScore } from "./format"

const err = (message: string): void => {
  process.stderr.write(`${message}\n`)
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e))

const readStdin = async (): Promise<string> => {
  const chunks: Array<Buffer> = []
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString("utf8")
}

const resolveFormat = (target: string, override: string | undefined): DocumentFormat => {
  if (override === "md") return "markdown"
  if (override === "text") return "plaintext"
  if (target === "-") return "markdown"
  const ext = extname(target).toLowerCase()
  return ext === ".md" || ext === ".markdown" ? "markdown" : "plaintext"
}

const meanScore = (results: ReadonlyArray<ScoreResult>): number =>
  Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)

const reportScoreError = (target: string, error: ScoreError): void => {
  if (error.kind === "parse") err(`${target}: ${error.error.message}`)
  else err(`${target}: invalid configuration`)
}

type Values = {
  profile?: string
  config?: string
  json?: boolean
  threshold?: string
  format?: string
  baseline?: boolean
  "save-baseline"?: boolean
  "baseline-file"?: string
}

export const scoreCommand = async (argv: ReadonlyArray<string>): Promise<number> => {
  let values: Values
  let positionals: ReadonlyArray<string>
  try {
    const parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        profile: { type: "string" },
        config: { type: "string" },
        json: { type: "boolean", default: false },
        threshold: { type: "string" },
        format: { type: "string" },
        baseline: { type: "boolean", default: false },
        "save-baseline": { type: "boolean", default: false },
        "baseline-file": { type: "string" },
      },
    })
    values = parsed.values
    positionals = parsed.positionals
  } catch (parseError) {
    err(msg(parseError))
    return 2
  }

  if (values.format !== undefined && values.format !== "md" && values.format !== "text") {
    err(`Invalid --format "${values.format}" (expected md|text).`)
    return 2
  }

  const threshold = values.threshold === undefined ? undefined : Number(values.threshold)
  if (threshold !== undefined && Number.isNaN(threshold)) {
    err(`Invalid --threshold "${values.threshold}" (expected a number).`)
    return 2
  }

  const configPath = values.config ?? (existsSync("prosemeter.config.json") ? "prosemeter.config.json" : undefined)
  let userConfig: UserConfig = {}
  if (configPath !== undefined) {
    try {
      userConfig = JSON.parse(readFileSync(configPath, "utf8")) as UserConfig
    } catch (readError) {
      err(`Could not read config ${configPath}: ${msg(readError)}`)
      return 2
    }
  }

  const resolved = resolveConfig(values.profile, userConfig)
  const configErrors: ReadonlyArray<ConfigError> = resolved.fold(
    (errs) => errs.toArray(),
    () => [] as ReadonlyArray<ConfigError>,
  )
  if (configErrors.length > 0) {
    err("Invalid configuration:")
    configErrors.forEach((e) => err(`  - ${e.message}`))
    return 2
  }
  const convergenceTarget =
    threshold ??
    resolved.fold(
      () => 70,
      (r) => r.threshold,
    )

  if (positionals.length === 0) {
    err("No input. Pass one or more file paths, or - to read stdin.")
    return 2
  }

  const wantsBaseline = values.baseline === true || values["save-baseline"] === true
  if (wantsBaseline && positionals.length > 1) {
    err("--baseline and --save-baseline require a single target.")
    return 2
  }

  const results: Array<ScoreResult> = []
  for (const target of positionals) {
    const isStdin = target === "-"
    if (!isStdin && !existsSync(target)) {
      err(`Not found: ${target}`)
      continue
    }
    const text = isStdin ? await readStdin() : readFileSync(target, "utf8")
    const label = isStdin ? "<stdin>" : target
    score(text, {
      profile: values.profile,
      config: userConfig,
      format: resolveFormat(target, values.format),
      target: label,
    }).fold(
      (scoreError) => reportScoreError(label, scoreError),
      (result) => results.push(result),
    )
  }

  if (results.length === 0) return 2

  const current = results[0]
  let delta: DeltaReport | undefined
  let convergence:
    { verdict: ReturnType<typeof checkConvergence>; history: ReadonlyArray<number>; threshold: number } | undefined

  if (wantsBaseline && current !== undefined) {
    const baselinePath = values["baseline-file"] ?? DEFAULT_BASELINE_PATH
    let prior: BaselineFile | undefined
    try {
      prior = loadBaseline(baselinePath)
    } catch (loadError) {
      err(`Could not read baseline ${baselinePath}: ${msg(loadError)}`)
      return 2
    }
    const priorHistory = prior?.history ?? []
    const history = [...priorHistory, current.score]
    convergence = {
      verdict: checkConvergence(history, { threshold: convergenceTarget }),
      history,
      threshold: convergenceTarget,
    }

    if (values.baseline === true && prior !== undefined) {
      delta = compareBaseline(current, fromScoreResultJSON(prior.result))
    }
    if (values["save-baseline"] === true) {
      try {
        saveBaseline(baselinePath, current, priorHistory)
      } catch (saveError) {
        err(`Could not write baseline ${baselinePath}: ${msg(saveError)}`)
        return 2
      }
    }
  }

  const mean = meanScore(results)

  if (values.json === true) {
    if (results.length === 1 && current !== undefined) {
      const payload = {
        ...toScoreResultJSON(current),
        ...(delta !== undefined ? { delta: toDeltaReportJSON(delta) } : {}),
        ...(convergence !== undefined ? { convergence } : {}),
      }
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
    } else {
      process.stdout.write(`${JSON.stringify({ results: results.map(toScoreResultJSON), mean }, null, 2)}\n`)
    }
  } else {
    const single = results.length === 1 && current !== undefined
    const body = single
      ? `${renderScore(current)}${delta !== undefined ? renderDelta(delta) : ""}${convergence !== undefined ? renderConvergence(convergence.verdict, convergence.history) : ""}`
      : results.map(renderScore).join("\n\n")
    process.stdout.write(`${body}\n`)
    if (results.length > 1) process.stdout.write(`\nMean: ${mean}/100 across ${results.length} files\n`)
  }

  if (threshold !== undefined && mean < threshold) {
    if (values.json !== true) err(`\nBelow threshold: ${mean} < ${threshold}`)
    return 1
  }
  return 0
}
