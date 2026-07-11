# prosemeter

[![CI](https://github.com/jordanburke/prosemeter/actions/workflows/ci.yml/badge.svg)](https://github.com/jordanburke/prosemeter/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A deterministic scoring and feedback-loop layer for prose.

Agents close the loop on code with ease. Compilers, linters, and tests hand back
clear, machine-readable signals. Prose has no such signal. An agent that writes a
README or a report gets no objective answer to three questions: is this draft
better than the last one, what should I fix, and when should I stop.

prosemeter answers all three. It scores a document from zero to one hundred
against a named profile. It returns findings with locations and fix hints. It
compares a draft to a baseline and reports a convergence verdict. That is
everything an agent needs to revise, measure, and terminate.

The scoring path is deterministic. The same input always yields the same output.
There are no model calls, no network, and no randomness. That is what makes it
usable as a fitness function.

## Install

```bash
pnpm add prosemeter
```

The bundle ships a library and a command-line tool. An MCP server ships
separately as `@prosemeter/mcp`.

## Command line

Score a file and print a report:

```bash
prosemeter score README.md --profile readme
```

Read a draft from standard input, which is handy for agents:

```bash
cat draft.md | prosemeter score - --profile blog --json
```

The tool exits zero on success, one when the score falls below `--threshold`,
and two when the input is empty or the configuration is invalid. That contract
makes it easy to gate a document in continuous integration.

## Library

```ts
import { score, compareBaseline, checkConvergence } from "prosemeter"

const result = score(draft, { profile: "readme" })

result.map((current) => {
  const delta = compareBaseline(current, previous)
  const verdict = checkConvergence([62, 71, 74, 74.5], { threshold: 80 })
  return { delta, verdict }
})
```

`score` returns an `Either` so parse and configuration errors stay explicit. A
`ScoreResult` carries the composite score, per-dimension scores, and findings.

## The loop

The loop is the point. A score alone is not enough, so the contract keeps every
piece an agent needs to iterate:

1. Score the draft.
2. Revise it using the findings and their hints.
3. Score again, then compare against the previous result.
4. Repeat while the convergence check returns `improving`. Stop on anything else.

The convergence verdict is the stop condition. It reads a score history and
returns `improving`, `plateaued`, `oscillating`, `regressing`, or `converged`. An
agent revises while the trend climbs and stops on anything else. The distinct
stop reasons let a harness attach policy: `regressing` (a sustained decline) is a
cue to revert to the highest-scoring prior draft rather than continue from the
latest. One caveat: when a `threshold` is supplied, meeting it reports
`converged` even if the last few steps declined — above the floor is a stop
signal regardless of trajectory.

`checkConvergenceDetailed` adds a `churning` flag: given per-dimension score
histories, it reports which dimensions oscillate or regress under a flat
composite — the signature of an agent buying one dimension by selling another
rather than converging on a better document.

## What it is, and what it isn't

A deterministic prose metric is a proxy, and any agent optimizing a proxy will
find its seams — chopping every sentence to eight words to move a grade formula,
say. prosemeter's profiles-and-bands design blunts the worst of this: targets are
bands, not monotonic goals, so there is no single number to run away with. But
the honest framing matters more than any guardrail. prosemeter is a floor and a
loop terminator, not a quality oracle. It tells an agent whether a draft cleared
the objective bar and when to stop iterating; it does not tell you the prose is
good. Pair it with human or LLM review for the last mile.

If you know [Vale](https://vale.sh), the obvious question is "isn't this just
that?" Vale produces findings. prosemeter produces findings *plus* a composite
score, a baseline delta, and a convergence verdict — the pieces an agent needs to
revise, measure, and terminate. The score and the loop are the difference.

## MCP server

The MCP server exposes the same engine to any client that speaks the Model
Context Protocol. It offers five tools: `score_text`, `score_file`,
`compare_baseline`, `check_convergence`, and `list_profiles`. Each description
teaches the loop, so an agent learns how to use the tools together.

```bash
prosemeter-mcp
```

Point your client at that binary. The server runs over standard input and
output.

## Profiles

A profile tunes the scoring for a kind of document. It sets a target reading
grade, weights the dimensions, and adjusts individual rules. Six profiles ship
built in: `plain`, `readme`, `api-docs`, `blog`, `marketing`, and `academic`.
List them with `prosemeter profiles`. A `prosemeter.config.json` file can extend
any profile with your own weights, bands, and terminology.

## How scoring works

The engine parses each document once and shares the result with every check.
Fifteen dimensions across four areas contribute to the score: readability,
style, structure, and vocabulary. Each dimension maps its raw signal to a value
between zero and one, and the composite is a weighted average. A skipped
dimension redistributes its weight, so the score stays a proper average.

Style rules come from the retext ecosystem rather than a private reimplementation.
Readability uses the standard grade formulas. The design favors small, honest
checks over clever ones.

## Packages

prosemeter is a small monorepo. The `prosemeter` bundle is the batteries-included
entry point. `@prosemeter/core` holds the engine, and four scorer packages supply
the dimensions. `@prosemeter/mcp` wraps the bundle for MCP clients.

## License

MIT
