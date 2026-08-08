# @prosemeter/readability

## 0.4.3

## 0.4.2

## 0.4.1

## 0.4.0

## 0.3.2

### Patch Changes

- 11548e4: grade-band: add an optional `direction` to enforce one side of the band

  `dimensionOptions: { "grade-band": { direction: "floor" | "ceiling" } }` scores only
  the simplistic or only the hard side; the unenforced side scores 1 at any distance.
  Default stays `both`, and no built-in profile sets it.

  It is for callers scoring a pre-filtered corpus, where one side can never fire. The
  built-in profiles keep both sides: measured against the calibration fixtures,
  floor-only lets a document at median reading grade 25.8 score a perfect 100 and
  collapses the chat register spread from 44 points to 21.

## 0.3.1

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

## 0.2.0
