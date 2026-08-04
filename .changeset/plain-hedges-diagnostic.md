---
"@prosemeter/style": patch
---

directness: stop flagging technical nouns and plain verbs as hedges

The upstream `hedges` list carries `diagnostic`, a technical noun with no hedging
sense. It fired three times on one calibration fixture ("diagnostic procedure",
"the resultant diagnostic").

A sweep over 22 markdown files produced 61 distinct flags. Nine met the bar of
"wrong in every context, not just the one that surfaced it":

- `diagnostic` — technical noun and adjective
- `found`, `say`, `says`, `start`, `understand`, `understands` — plain verbs.
  Three of these were inflection gaps: `started`, `understood`, and `noticed`
  were already ignored while `start`, `understand`, and `found` were not.
- `try` — `retext-simplify` recommends it as the replacement for `endeavor`, so
  flagging it made clarity and directness contradict each other on one word.

Genuine hedges are untouched: `probable`, `substantially`, `likely`, `somewhat`,
`appears`, `suggests`, `some`, `most`, and `rather` all still flag.

On `fixtures/chat-jargon.md` the dimension goes 49 to 71 as the three
`diagnostic` false positives clear, leaving `substantially` and `probable`.
