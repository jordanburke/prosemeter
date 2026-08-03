---
"@prosemeter/style": minor
---

Stop `clarity` flagging software terms of art, and share the ignore-list resolution between the two
retext dimensions.

`retext-simplify` targets bureaucratic English, where `effect` is a verb ("effect change") and
`component` is a vague stand-in for `part`. Software prose uses these as terms of art, and the
plugin's suggested replacements are wrong rather than simpler:

| flagged | retext-simplify wants |
| --- | --- |
| `effect` | choose, pick, result |
| `component` | part |
| `interface` | meet, work with |
| `function` | act, role, work |
| `request` | ask |
| `render` | give, make |

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
