/**
 * The `score` command. Reads each target (file or `-` for stdin), scores it with every built-in
 * dimension, and prints human or `--json` output. Exit codes: 0 pass · 1 below `--threshold` · 2
 * no/empty input, unreadable/invalid config, or nothing scored.
 */

import { existsSync, readFileSync } from "node:fs"
import { extname } from "node:path"
import process from "node:process"
import { parseArgs } from "node:util"

import type { ConfigError, DocumentFormat, ScoreError, ScoreResult, UserConfig } from "@prosemeter/core"

import { resolveConfig, score, toScoreResultJSON } from "../index"
import { renderScore } from "./format"

const err = (message: string): void => {
  process.stderr.write(`${message}\n`)
}

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
  else
    err(
      `${target}: invalid configuration (${error.errors
        .toArray()
        .map((e) => e.context.field)
        .join(", ")})`,
    )
}

export const scoreCommand = async (argv: ReadonlyArray<string>): Promise<number> => {
  let values: { profile?: string; config?: string; json?: boolean; threshold?: string; format?: string }
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
      },
    })
    values = parsed.values
    positionals = parsed.positionals
  } catch (parseError) {
    err(parseError instanceof Error ? parseError.message : String(parseError))
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
      err(`Could not read config ${configPath}: ${readError instanceof Error ? readError.message : String(readError)}`)
      return 2
    }
  }

  const configErrors: ReadonlyArray<ConfigError> = resolveConfig(values.profile, userConfig).fold(
    (errs) => errs.toArray(),
    () => [] as ReadonlyArray<ConfigError>,
  )
  if (configErrors.length > 0) {
    err("Invalid configuration:")
    configErrors.forEach((e) => err(`  - ${e.message}`))
    return 2
  }

  if (positionals.length === 0) {
    err("No input. Pass one or more file paths, or - to read stdin.")
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

  const mean = meanScore(results)

  if (values.json === true) {
    const payload =
      results.length === 1
        ? toScoreResultJSON(results[0] as ScoreResult)
        : { results: results.map(toScoreResultJSON), mean }
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
  } else {
    process.stdout.write(`${results.map(renderScore).join("\n\n")}\n`)
    if (results.length > 1) process.stdout.write(`\nMean: ${mean}/100 across ${results.length} files\n`)
  }

  if (threshold !== undefined && mean < threshold) {
    if (values.json !== true) err(`\nBelow threshold: ${mean} < ${threshold}`)
    return 1
  }
  return 0
}
