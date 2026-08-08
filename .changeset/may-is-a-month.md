---
"@prosemeter/style": patch
---

directness: stop flagging "May" the month as a hedge

The upstream `hedges` list carries lowercase `may` and retext-intensify matches
case-insensitively, so every date in a changelog or a timeline drew *"Cut the
hedge or replace it with a concrete claim."*

`HEDGE_IGNORE_DEFAULT` cannot express this. Lowercase `may` genuinely hedges —
"this may fail" — and stays flagged. The word is a violation in one syntactic role
and not in another, which is a decision about the surrounding source rather than
about the word.

So `retextDensityDimension` gains an optional `dropFinding` hook, applied **before**
the count. `score` and `detail` both derive from `findings.length`, so a filter
applied downstream would report a score counting findings it no longer shows.

The rule is deliberately narrow: capitalised `May` followed by a digit.
Sentence-initial "May we suggest" keeps its flag, because no digit follows. Bare
"In May we shipped it" keeps its flag too — under-filtering is the safer error.
No other month name appears in the `fillers`/`hedges`/`weasels` union.

`clarity` and `concision` are untouched by construction: the hook is opt-in and
only `directness` supplies one.
