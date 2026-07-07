#!/usr/bin/env node
/** prosemeter-mcp CLI entry — the MCP server binary. */

import process from "node:process"

import { main } from "./index"
import { VERSION } from "./version"

const args = process.argv.slice(2)

if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write(`${VERSION}\n`)
  process.exit(0)
}

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(`prosemeter-mcp ${VERSION} — deterministic prose scoring over MCP

Usage: prosemeter-mcp

Starts an MCP server on stdio exposing:
  score_text        score prose passed inline
  score_file        score a document on disk
  compare_baseline  diff a current ScoreResult against a previous one
  check_convergence classify a score history (improving | plateaued | oscillating | converged)
  list_profiles     list the built-in scoring profiles

Point your MCP client (e.g. Claude Code) at this binary.
`)
  process.exit(0)
}

main().catch((error: unknown) => {
  process.stderr.write(`[prosemeter-mcp] fatal: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
