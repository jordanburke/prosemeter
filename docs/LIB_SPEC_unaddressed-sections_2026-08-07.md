# Unaddressed sections — a proposal

**Status: proposal, not built.** Reproducible with `eval/probe-unaddressed.mjs`. Nothing in
`packages/` implements this.

This replaces an earlier draft that proposed a byte-level "coverage gate" (PR #42, closed). An
adversarial review broke that design; the wreckage is recorded under "What the first attempt got
wrong," because the failures are more instructive than the proposal was.

## The gap

`compareBaseline` (`packages/core/src/loop.ts:35-52`) computes two sets of findings: **resolved**
and **new**. It never names the third one — the findings present in *both* drafts.

Those are the ones an agent walked past. They are in every `ScoreResult`, and they are invisible in
the delta report, which is the view the loop actually reads.

So the loop can report a healthy delta while an entire section sits untouched with its findings
intact. Not because the scorer missed it — the scorer flagged it every single pass — but because the
diff only shows what moved.

## The measure

A section is **unaddressed** when it still carries findings and *nothing about them changed*:
nothing resolved, nothing new.

`eval/probe-unaddressed.mjs` is a pure function over two `ScoreResultJSON`s. On the reference pair —
a 2,716-word company profile and its revision:

```
section                                  findings  kept  new  fixed  state
TL;DR                                          18    11    7      6  partly addressed
2. Technology and platform                     27    20    7      8  partly addressed
5. Leadership and team                         13    12    1      0  partly addressed
8. Recent news (2024–2026)                      3     3    0      0  unaddressed
Recommendations                                11     4    7      5  partly addressed
...
1 section(s) unaddressed: 8. Recent news (2024–2026)
```

It needs **no new API, no stored source text, and no change to the baseline file**.
`stats.headings` carries every heading with its line (`packages/core/src/types.ts:23`), every finding
carries `loc.line`, and finding identity is `loop.ts`'s existing `findingKey` — rule, dimension, and
the normalized excerpt, location-independent so unrelated edits do not churn the sets.

## Why "unaddressed" beats "unchanged"

The first draft compared *bytes*. This compares *findings*, and the difference is not cosmetic.

**It only fires where there is something to do.** A section the scorer considers clean never appears,
because the loop has no span to revise and no hint to act on. The byte-diff version flagged such
sections as unreached, which under a hard stop condition trapped an honest agent forever: read a
clean section, judge it fine, and you can never terminate.

**It resists the edits that defeated the byte-diff.** Measured, by mutating the reference pair:

| move | byte-diff | this |
| --- | --- | --- |
| rename the heading, body identical | counts as reached | **still flagged**, under the new name |
| one cosmetic whitespace edit | flips to touched | **still flagged** |
| delete the section entirely | 100% coverage | not flagged — see below |

Renaming does not help because findings are keyed on their excerpt, not their location or their
section. A cosmetic edit does not help because the finding survives it.

## The stop condition

An **and**, not an **or**:

> Stop when `check_convergence` leaves `improving` **and** no section is unaddressed.

Reported alongside the convergence verdict, not folded into it.

## What the first attempt got wrong

Kept because each error is a live hazard for anything built here.

**The motivating story did not survive the shipped defaults.** The narrative was a document going
74 → 81 → 82, `improving` then `converged`. But `plain`'s default threshold is 70, and
`checkConvergence([74], {threshold: 70})` returns **`converged`** — the loop stops at 74, before any
revision happens (`loop.ts:85`, which treats reaching the threshold as a stop regardless of
trajectory). Reproducing that narrative needs a threshold in (74, 82] or none at all, and the draft
never said which. **The failure being fixed was at least as much a threshold short-circuit as
coverage blindness**, and that is still unmeasured.

**"Cannot be gamed" was false, and the design manufactured the gaming.** A hard stop condition on
byte-difference plus a byte-identical definition of "untouched" is an instruction to make cosmetic
edits. The proposal's two decisions combined into the exploit.

**Three numbers were wrong.** `grade-band` supplied **7.05 of 7.23 unrounded points (98%)**, not
"7.1 of 8" (89%) — an unrounded numerator over a rounded denominator. The similarity distribution was
three sections below 90% and ten above 93%, not four and eight. And `directness` moved 63.5 → 64.2;
the table's flat 64 was rounding, though the underlying control holds — 39 hedge findings in both
drafts, so that revision cut none.

**Four parser bugs**, all reproduced: duplicate heading text collapses two sections into one row,
headings inside fenced code blocks become phantom sections, text before the first heading is
invisible in both directions, and renames inflate the number the gate depends on.

## What survives from the first attempt

The saturation evidence, which needed no byte-diff and is the reason a second stop signal is wanted
at all. On the reference pair, `grade-band` went 65 → 100 and supplied 98% of the composite's gain.
It is now pinned at 100, so a further pass could fix every remaining finding and barely move the
number. That is precisely when the loop declares itself finished.

Two related observations from the same measurement:

- **The sentence dimensions fight.** Hard sentences went 84 → 100 *while* `grade-band` improved 35
  points. Splitting a long sentence lowers the median reading grade and raises the count of sentences
  still above the per-sentence cutoff. Re-weighting cannot fix this; the same edits move the two in
  opposite directions.
- **`directness` is a useful control.** Unchanged findings across a revision prove no hedges were
  cut, which is the class of edit the loop is known to over-reward.

## What it would take to ship

Add **persistent findings** to `DeltaReport`, and optionally a per-section rollup.

`compareBaseline` already computes both key sets; the intersection is one filter it currently
discards. Section attribution needs only `stats.headings` and `loc.line`, both already present. No
new input, no API shape change, and `score()` stays a pure function of one document — which the
site's browser-side scorer depends on.

```ts
// existing
findingsResolved: ReadonlyArray<Finding>
findingsNew:      ReadonlyArray<Finding>
// proposed
findingsPersistent: ReadonlyArray<Finding>
```

## Open questions

- **Deleting a section still reads as addressing it.** Its findings resolve, because they are gone.
  Arguably correct — the document no longer has that problem — but a loop instructed to clear
  unaddressed sections has a destructive shortcut. Unresolved.
- **Section attribution is line-based.** A finding is assigned to the last heading at or above its
  line. Content moved between sections without changing either heading will be attributed to
  wherever it landed, which is right for revision purposes and wrong for provenance.
- **Findings without a `loc` fall into a `(document level)` bucket** rather than a section.
  `grade-band` emits none, but a dimension that emits unlocated findings would land there and never
  be attributable.
- **A section can be "partly addressed" forever.** Resolve one finding of twenty each pass and the
  gate is satisfied every time. The state distinguishes *some* change from *no* change and nothing
  finer.
- **`findingKey` uses the excerpt.** Rewriting a sentence containing a flagged phrase resolves the
  finding even if the problem persists in new words — the new instance is a *new* finding, so the
  section reads as addressed.
- **n=1.** One labelled pair, and the 40%-coverage session that motivated all of this was never
  reproduced; its drafts were not kept. **Nothing here shows that real loops terminate with real
  sections unaddressed.** The mechanism is demonstrated; the frequency is not.
- **The threshold short-circuit is the more urgent finding and is not addressed here.** A loop that
  stops on pass one because the first draft cleared the profile's default threshold has a bigger
  problem than coverage, and this proposal does not touch it.

## Why not a dimension

Not because it is "a different kind of measurement" — that is the weak form of the argument.

The strong form is type-level. A dimension is a function of one document. This is a function of a
*pair*. Folding it into the composite (`scoring.ts:41`) would make `score(text)` depend on hidden
prior state, which breaks both the contract and the browser scorer. It cannot be a normalization
strategy either — those map one document's raw signal into [0, 1] — and `skipped` is a poor fit for a
result that exists.

It belongs where `compareBaseline` already lives: pairwise, beside the score, never inside it.
