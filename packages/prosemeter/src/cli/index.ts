#!/usr/bin/env node
/** prosemeter CLI entry point. */

import process from "node:process"

import { runCli } from "./run"

runCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 2
  })
