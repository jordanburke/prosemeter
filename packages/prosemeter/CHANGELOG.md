# prosemeter

## 0.4.2

### Patch Changes

- Updated dependencies [84ddfc5]
  - @prosemeter/style@0.4.2
  - @prosemeter/core@0.4.2
  - @prosemeter/readability@0.4.2
  - @prosemeter/structure@0.4.2
  - @prosemeter/vocabulary@0.4.2

## 0.4.1

### Patch Changes

- 8296001: Describe `thresholdDefault` as the floor it is, and say why the loop converged

  Measured, never asserted before: **no single dimension can fail a threshold on any
  profile.** Zero the heaviest-weighted dimension on an otherwise perfect document
  and the composite still lands at 76.9–81.8, above every threshold (68–75). A
  threshold is only failed when several dimensions fail together.

  The fixtures agree. `passive-heavy.md`, built to demonstrate one flaw, scores 95
  on `plain` and 98 on `api-docs`; its `active-voice` sits at 38 but weight 0.08
  caps the damage at 4.9 points. Five of nine fixtures clear `plain`'s 70. The only
  fixture that fails exactly one profile is `choppy-simplistic.md` on `chat`, whose
  grade-band weight of 0.24 is the anti-gaming counterweight — profile tuning is
  what makes a threshold bite, not the number.

  No threshold changed. Three descriptions did:

  - The MCP `check_convergence` tool said "Target score; reaching it yields
    'converged'". It now says floor, and that reaching it means "not catastrophic"
    rather than "done".
  - `prosemeter profiles` said "suggested threshold"; it now says "floor".
  - `packages/core/src/profiles.ts` carries the measurement and a warning not to
    calibrate against `fixtures/`, which are handcrafted to isolate single
    dimensions and so are useless as a calibration set.

  The CLI also now says _why_ it converged when the floor is what stopped it:

      Convergence: converged   (history: 90)  — 90 ≥ floor 70; pass --threshold to change

  `checkConvergence` treats clearing the threshold as a stop regardless of
  trajectory, and the CLI supplies the profile's floor when the caller passes none,
  so a first pass on a competent draft converges immediately. Printing the verdict
  alone made that look like a bug rather than a floor being cleared. Behaviour is
  unchanged; only the explanation is new.

  Full measurement in docs/LIB_ANLY_threshold-semantics_2026-08-07.md.

- Updated dependencies [8296001]
  - @prosemeter/core@0.4.1
  - @prosemeter/readability@0.4.1
  - @prosemeter/structure@0.4.1
  - @prosemeter/style@0.4.1
  - @prosemeter/vocabulary@0.4.1

## 0.4.0

### Minor Changes

- e630112: Make the root export browser-safe; move baseline persistence to `prosemeter/baseline`

  `loadBaseline`, `saveBaseline`, and `DEFAULT_BASELINE_PATH` are no longer exported
  from the package root. They live at a new `prosemeter/baseline` subpath:

  ```ts
  import { loadBaseline, saveBaseline } from "prosemeter/baseline"
  ```

  **Why.** The root export re-exported them as values, which put `./baseline` —
  and with it `node:fs` and `node:path` — into the entry's module graph. The bundler
  emitted `score` and `loadBaseline` into the same chunk, so `import { score } from
"prosemeter"` pulled a Node built-in into any browser bundle. `score` is now
  reachable without it: three modules, zero `node:` specifiers.

  `BaselineFile` is still exported as a type from the root, which emits no runtime
  code. The CLI is unaffected — it always imported from the relative path.

  All six library packages also declare `"sideEffects": false`, so bundlers can
  tree-shake unused dimensions.

### Patch Changes

- Updated dependencies [e630112]
  - @prosemeter/core@0.4.0
  - @prosemeter/readability@0.4.0
  - @prosemeter/structure@0.4.0
  - @prosemeter/style@0.4.0
  - @prosemeter/vocabulary@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [11548e4]
- Updated dependencies [8145374]
  - @prosemeter/readability@0.3.2
  - @prosemeter/style@0.3.2
  - @prosemeter/core@0.3.2
  - @prosemeter/structure@0.3.2
  - @prosemeter/vocabulary@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [8dc595d]
  - @prosemeter/style@0.3.1
  - @prosemeter/core@0.3.1
  - @prosemeter/readability@0.3.1
  - @prosemeter/structure@0.3.1
  - @prosemeter/vocabulary@0.3.1

## 0.3.0

### Minor Changes

- fdaf4cb: Rename four dimensions so every dimension is virtue-named, and fix the hedging false-positive rate.

  **Breaking: four dimension IDs renamed.** Every dimension scores 0–100 with 100 as best, but four
  were named after the defect they detect, so `passive-voice: 100` read as "lots of passive voice"
  when it means the opposite. A reader misread `sentence-complexity: 85` as "this text is complex".
  That matters most for the agent-facing JSON, which is read fresh each session with no memory of a
  correction.

  | before                | after                 |
  | --------------------- | --------------------- |
  | `sentence-complexity` | `sentence-simplicity` |
  | `passive-voice`       | `active-voice`        |
  | `hedging`             | `directness`          |
  | `redundancy`          | `concision`           |

  Rule names are a separate namespace and are unchanged — `retext-passive`, `retext-intensify`,
  `retext-repeated-words`, and `retext-redundant-acronyms` all keep their names, because rules _are_
  defect detectors. Band-shaped dimensions (`grade-band`, `section-length`, and the rest) are
  unchanged too; `grade-band` is bidirectional, so a virtue name would misdescribe it.

  **Migration.** Update `weights` and `dimensionOptions` keys in any `prosemeter.config.json`, and
  any code reading `ScoreResult.dimensions[].id` or `Finding.dimension`. Config validation now
  rejects the old names with the replacement in the message rather than silently ignoring them:

  ```
  Validation failed: weights.hedging was renamed to "directness" in 0.3.0
  ```

  Saved baselines from 0.2.x still load, but `compareBaseline` matches dimensions by id, so
  per-dimension deltas for the four renamed dimensions will read as removed-and-added until you
  re-baseline.

  **Fix: `directness` no longer flags ordinary grammar.** `retext-intensify` matches on the word
  alone with no regard for syntactic role, and its `weasels` list carries grammar (`that` as a
  complementizer, `so` as a conjunction, `up`/`back` as phrasal-verb particles) plus plain verbs
  (`works`, `helps`, `supports`) that are only weasels under narrative-writing advice. The dimension
  ran backwards on the calibration fixtures as a result, scoring `chat-jargon` (35) above
  `chat-clear` (24) on 13 "hedges" in 160 words containing essentially none.

  `HEDGE_IGNORE_DEFAULT` filters those while keeping genuine hedges (`probably`, `might`, `seems`,
  `arguably`, `relatively`, `several`, and the intensifiers). The pair now separates correctly at 80
  against 41. Scores on the `directness` dimension will rise for most documents, which moves the
  composite slightly.

  **New: retext dimensions accept per-profile options.** `dimensionOptions.directness.ignore` adds
  words to the ignore list, and `useDefaultIgnore: false` drops the built-in list. Previously
  `retext-dimension.ts` built its plugin with no arguments, so no profile could configure it.

### Patch Changes

- Updated dependencies [fdaf4cb]
- Updated dependencies [dd82e2b]
  - @prosemeter/readability@0.3.0
  - @prosemeter/core@0.3.0
  - @prosemeter/style@0.3.0
  - @prosemeter/structure@0.3.0
  - @prosemeter/vocabulary@0.3.0

## 0.2.0

### Minor Changes

- 000a2e8: Convergence: add a `regressing` verdict and dimension-churn detection.

  `checkConvergence` now returns `regressing` for a sustained decline (≥2 significant, all-negative deltas in the window) instead of folding it into `plateaued`. The loop contract is unchanged — revise while `improving`, stop on anything else — but the stop _reason_ is now honest, so a harness can attach policy (on `regressing`, prefer reverting to the highest-scoring prior draft over continuing from the latest).

  New `checkConvergenceDetailed(history, dimensions, options)` returns `{ verdict, churning }`, where `churning` lists dimensions that oscillate or regress under a flat composite — the signature of an agent trading one dimension for another rather than converging. New `DimensionHistory` and `ConvergenceReport` types.

  The `check_convergence` MCP tool gains an optional `dimensions` parameter and now returns `{ verdict, churning, detail }` (previously `{ verdict, detail }`).

  **Behavior change — read before upgrading:** score histories that previously classified as `plateaued` for a sustained decline now classify as `regressing`. If you branch on the string `plateaued` to auto-accept or ship a draft, add a `regressing` case first — you do not want a regression to inherit accept-on-plateau behavior. TypeScript consumers with an exhaustive `switch` on `ConvergenceVerdict` will need the new case. The MCP tool's return shape changed from a bare `{ verdict, detail }` to `{ verdict, churning, detail }`; clients that read `.verdict` are unaffected.

### Patch Changes

- Updated dependencies [000a2e8]
  - @prosemeter/core@0.2.0
  - @prosemeter/readability@0.2.0
  - @prosemeter/structure@0.2.0
  - @prosemeter/style@0.2.0
  - @prosemeter/vocabulary@0.2.0
