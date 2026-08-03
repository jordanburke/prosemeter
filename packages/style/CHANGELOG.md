# @prosemeter/style

## 0.3.1

### Patch Changes

- 8dc595d: Stop `directness` flagging modal verbs and ordinary verbs.

  `retext-intensify`'s weasel list carries modal verbs (`can`, `will`, `should`, `must`, `would`) and
  plain verbs (`read`, `find`) alongside genuine hedges. In technical advice the modals state
  capability, prediction, recommendation, and obligation precisely — "you can drop it", "it will
  fail", "the key must stay stable". `may`, `might` and `could` stay flagged, because those do hedge.

  Also ignored: `exactly`, `already`, `right`, `real`, `too`, `much`, `about`, which are precise in
  technical prose ("exactly one version", "the right index", "already hoisted").

  Measured over 244 answers and fixtures: flags drop from 3305 to 2080. The calibration fixtures
  separate cleanly (clear 100, jargon 49), and the dimension becomes a usable instruction signal —
  its variance ratio (spread across tasks over spread across writing styles) falls to 1.1, second
  only to word count. Before the fix it could not tell the shipped instruction from no instruction
  at all.

  Scores on this dimension rise for most documents, which moves the composite slightly.

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

- dd82e2b: Stop `clarity` flagging software terms of art, and share the ignore-list resolution between the two
  retext dimensions.

  `retext-simplify` targets bureaucratic English, where `effect` is a verb ("effect change") and
  `component` is a vague stand-in for `part`. Software prose uses these as terms of art, and the
  plugin's suggested replacements are wrong rather than simpler:

  | flagged     | retext-simplify wants |
  | ----------- | --------------------- |
  | `effect`    | choose, pick, result  |
  | `component` | part                  |
  | `interface` | meet, work with       |
  | `function`  | act, role, work       |
  | `request`   | ask                   |
  | `render`    | give, make            |

  Across 154 generated answers and fixtures the dimension emitted 973 flags, of which roughly 900 were
  domain nouns — `effect` 164, `request` 141, `render` 135, `function` 118, `component` 54.

  Because those counts track subject matter rather than writing, `clarity` behaved as a topic
  detector. Splitting its variance over the eval corpus showed the mean varying **0.3 points across
  writing-style variants and 49.6 points across tasks**. `CLARITY_IGNORE_DEFAULT` brings those to 1.9
  and 12.9, cuts total flags from 973 to 120, and raises the corpus mean from 54.1 to 90.7.

  The 120 survivors are padding in any register: the expletive constructions (`it is`, `there is`,
  `there are`), `very`, `all of`, `currently`, `frequently`, `however`, `subsequently`, and the
  genuinely bureaucratic `aforementioned`, `heretofore`, `notwithstanding`, `necessitate`.

  Scores on this dimension rise substantially for technical documents. `clarity` is weighted 0.17 in
  the `chat` profile and 0.10 in `blog` and `marketing`, so composites move with it.

  Configuration matches `directness`: `dimensionOptions.clarity.ignore` extends the list and
  `useDefaultIgnore: false` drops it. Both dimensions now resolve their ignore list through a shared
  `resolveIgnore` helper, replacing the `resolveHedgeIgnore` export added earlier in this release.

## 0.2.0
