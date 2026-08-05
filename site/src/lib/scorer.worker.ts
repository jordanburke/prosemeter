/**
 * The scorer, off the main thread.
 *
 * Three reasons, all pointing the same way:
 *
 * 1. **Bundle.** Vite emits this as a chunk the HTML never references, so the parse-english /
 *    micromark / retext graph cannot block first paint. The page ships a build-time result and
 *    only fetches this when the visitor starts interacting.
 * 2. **Jank.** `score()` is synchronous and CPU-bound — a markdown parse plus five retext passes.
 *    On a large paste that is a visible freeze on the main thread.
 * 3. **Serialization.** `score()` returns a functype `Either`, and `Finding.loc` and
 *    `DimensionResult.skipped` are `Option`s. None of those survive structured clone. The worker
 *    boundary forces `toScoreResultJSON`, which is the correct shape anyway — the same one the
 *    CLI's `--json` and the MCP `score_text` tool return.
 */

import { score, toScoreResultJSON, type ScoreResultJSON } from "prosemeter"

import { MAX_CHARS } from "./limits"

export type ScoreRequest = {
  readonly seq: number
  readonly text: string
  readonly profile: string
  readonly format: "markdown" | "plaintext"
  readonly target: string
}

export type ScoreResponse =
  | { readonly seq: number; readonly ok: true; readonly result: ScoreResultJSON; readonly ms: number }
  | { readonly seq: number; readonly ok: false; readonly error: string }

self.onmessage = (event: MessageEvent<ScoreRequest>) => {
  const { seq, text, profile, format, target } = event.data
  const started = performance.now()

  const reply = (message: ScoreResponse) => self.postMessage(message)

  try {
    score(text.slice(0, MAX_CHARS), { profile, format, target }).fold(
      (error) => reply({ seq, ok: false, error: `${error.kind}: ${"message" in error ? error.message : ""}`.trim() }),
      (result) => reply({ seq, ok: true, result: toScoreResultJSON(result), ms: performance.now() - started }),
    )
  } catch (error) {
    reply({ seq, ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
