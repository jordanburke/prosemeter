/**
 * The prosemeter MCP server, built on somamcp (telemetry + introspection + health for free). Five
 * tools, all thin wrappers over the bundle handlers. Every description teaches the revise/converge
 * loop so an agent knows how to use the tools together.
 */

import type { ScoreResultJSON } from "prosemeter"
import { createServer } from "somamcp"
import { z } from "zod"

import {
  checkConvergenceHandler,
  compareBaselineHandler,
  listProfilesHandler,
  scoreFileHandler,
  scoreTextHandler,
} from "./handlers"
import { VERSION } from "./version"

const PROFILE_DESC = "Target profile: plain | readme | api-docs | blog | marketing | academic (default: plain)."

const LOOP =
  "Typical agent loop: score_text → revise using the findings and hints → score_text again → compare_baseline → repeat while check_convergence returns 'improving'; stop on plateaued, oscillating, or converged."

const locSchema = z.object({ line: z.number(), column: z.number(), offset: z.number(), length: z.number() }).nullable()

const findingSchema = z.object({
  rule: z.string(),
  dimension: z.string(),
  severity: z.string(),
  message: z.string(),
  hint: z.string(),
  loc: locSchema,
  excerpt: z.string(),
})

const dimensionSchema = z.object({
  id: z.string(),
  score: z.number(),
  weight: z.number(),
  detail: z.string(),
  skipped: z.string().nullable(),
  findings: z.array(findingSchema),
})

const scoreResultSchema = z.object({
  target: z.string(),
  profile: z.string(),
  score: z.number(),
  stats: z.record(z.string(), z.unknown()),
  dimensions: z.array(dimensionSchema),
  version: z.string(),
})

export const createProsemeterServer = () => {
  const server = createServer({
    name: "prosemeter-mcp",
    version: VERSION,
    instructions: `prosemeter — a deterministic scoring + feedback-loop layer for prose (READMEs, docs, blog posts, reports).

It gives an agent an objective fitness signal for writing: a 0–100 score against a named profile, actionable findings with locations and fix hints, per-dimension baseline/delta comparison, and a convergence verdict — everything needed to revise, measure, and know when to stop.

${LOOP}

Tools:
- score_text: score prose passed inline
- score_file: score a file on disk
- compare_baseline: diff a current ScoreResult against a previous one (resolved/new findings, per-dimension deltas)
- check_convergence: classify a score history (improving | plateaued | oscillating | converged)
- list_profiles: list the built-in profiles`,
  })

  server.addTool({
    name: "score_text",
    description: `Score prose and return a ScoreResult (0–100 score, per-dimension scores, and findings with locations + fix hints). ${LOOP}`,
    parameters: z.object({
      text: z.string().describe("The prose to score (markdown or plaintext)."),
      profile: z.string().optional().describe(PROFILE_DESC),
      format: z.enum(["markdown", "plaintext"]).optional().describe("Force input format (default: markdown)."),
    }),
    execute: async (args) => scoreTextHandler(args),
  })

  server.addTool({
    name: "score_file",
    description: `Score a document on disk and return a ScoreResult. Format is inferred from the extension (.md/.markdown → markdown, else plaintext). ${LOOP}`,
    parameters: z.object({
      path: z.string().describe("Path to the document to score."),
      profile: z.string().optional().describe(PROFILE_DESC),
      configPath: z.string().optional().describe("Optional path to a prosemeter.config.json."),
    }),
    execute: async (args) => scoreFileHandler(args),
  })

  server.addTool({
    name: "compare_baseline",
    description: `Diff a current ScoreResult against a previous baseline: score delta and verdict, per-dimension deltas, and which findings were resolved or newly introduced (location-independent). Pass the ScoreResults returned by score_text/score_file. ${LOOP}`,
    parameters: z.object({
      current: scoreResultSchema.describe("The latest ScoreResult."),
      baseline: scoreResultSchema.describe("The earlier ScoreResult to compare against."),
    }),
    execute: async (args) =>
      compareBaselineHandler({
        current: args.current as unknown as ScoreResultJSON,
        baseline: args.baseline as unknown as ScoreResultJSON,
      }),
  })

  server.addTool({
    name: "check_convergence",
    description: `Classify a score history to decide whether to keep revising. Returns 'improving' (keep going), 'plateaued', 'oscillating', or 'converged' (stop). ${LOOP}`,
    parameters: z.object({
      history: z.array(z.number()).describe("Scores over time, oldest first."),
      threshold: z.number().optional().describe("Target score; reaching it yields 'converged'."),
      window: z.number().optional().describe("How many recent deltas to consider (default 3)."),
      epsilon: z.number().optional().describe("Delta magnitude treated as 'no change' (default 1)."),
    }),
    execute: async (args) => checkConvergenceHandler(args),
  })

  server.addTool({
    name: "list_profiles",
    description: "List the built-in scoring profiles with their grade bands and suggested thresholds.",
    parameters: z.object({}),
    execute: async () => listProfilesHandler(),
  })

  return server
}
