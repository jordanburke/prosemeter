---
"@prosemeter/style": patch
---

`directness` findings now lead with checking the hedge rather than cutting it

The fix hint on a weasel/hedge finding used to read "Cut the hedge or replace it with a concrete
claim." It now reads "If the claim holds only under a condition, name the condition. If it does
not, cut the hedge."

Measured, not stylistic. In `eval/`'s run 6, a reviser handed these marks did the first half of the
old hint and skipped the second: `directness` was its largest movement by a factor of two and a
half, and on tasks where a qualifier decides correctness it produced "usually beats memoization" →
"beats memoization outright" and "almost certainly missing" → "the other half is missing". A judge
asked to look called the revision overconfident on 9 of 10 such pairs.

No score changes — `fallbackHint` is not an input to any dimension. Only the hint string moves.
