/**
 * CLI dispatch. `prosemeter score <file|->` scores; `prosemeter profiles` lists profiles. Returns
 * the process exit code so the bin entry stays a thin wrapper.
 */

import process from "node:process"

import { VERSION } from "../version"
import { renderProfiles } from "./format"
import { scoreCommand } from "./score"

const HELP = `prosemeter ${VERSION} — deterministic prose scoring

Usage:
  prosemeter score <file|glob|-> [options]
  prosemeter profiles
  prosemeter --help | --version

Options (score):
  --profile <name>       plain | readme | api-docs | blog | marketing | academic  (default: plain)
  --config <path>        prosemeter.config.json (default: ./prosemeter.config.json if present)
  --json                 machine-readable ScoreResult (+ delta/convergence when applicable)
  --threshold <n>        exit 1 if the score (mean, for multiple files) is below n
  --format <md|text>     force input format (default: infer from extension; stdin defaults to md)
  --baseline             diff against the stored baseline and report the convergence verdict
  --save-baseline        write/update the baseline (result + appended score history) after scoring
  --baseline-file <path> baseline location for --baseline/--save-baseline (default: .prosemeter/baseline.json)

Baseline options require a single target. Typical agent loop:
  prosemeter score draft.md --profile readme --baseline --save-baseline --json
  # revise using findings/hints, re-run, and stop when "convergence" is no longer "improving"

Exit codes: 0 pass · 1 below threshold · 2 no/empty input or invalid config/baseline`

export const runCli = async (argv: ReadonlyArray<string>): Promise<number> => {
  const [command, ...rest] = argv

  if (command === undefined || command === "--help" || command === "-h") {
    process.stdout.write(`${HELP}\n`)
    return command === undefined ? 2 : 0
  }
  if (command === "--version" || command === "-v") {
    process.stdout.write(`${VERSION}\n`)
    return 0
  }
  if (command === "profiles") {
    process.stdout.write(`${renderProfiles()}\n`)
    return 0
  }
  if (command === "score") {
    return scoreCommand(rest)
  }

  process.stderr.write(`Unknown command "${command}".\n\n${HELP}\n`)
  return 2
}
