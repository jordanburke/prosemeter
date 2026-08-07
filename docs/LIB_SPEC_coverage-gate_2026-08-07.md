# Coverage gate — a proposal

**Status: proposal, not built.** The evidence below is real and reproducible with
`eval/probe-coverage.mjs`. Nothing in `packages/` implements this.

## The problem

`check_convergence` reads one thing: a list of composite scores over time. It cannot distinguish a
revision that reworked every section from one that reworked a third of them, because both produce
the same *shape* of number.

So the loop stops on the wrong signal. An agent revises part of a document, the composite rises and
then flattens, `check_convergence` returns `converged`, and the untouched sections are never
mentioned — not because the tool judged them fine, but because it never knew they existed.

Observed on a 2,716-word company profile revised through three drafts: composite 74 → 81 → 82,
verdict `improving` → `converged`. A human reviewer put coverage at roughly 40%. The score had no
way to see that, and reported the document settled.

## Why the composite structurally cannot see this

Two mechanisms, and they compound.

**Dilution.** The composite is a weighted average over the whole document. Improving eight of
thirteen sections moves it nearly as far as improving all thirteen, because the five skipped ones are
averaged in alongside.

**Saturation.** On that same document, measured with `eval/probe-coverage.mjs` and the CLI:

| | v1 | v2 | change |
| --- | --- | --- | --- |
| **composite** | 74 | **82** | +8 |
| grade-band | 65 | **100** | +35 |
| clarity | 73 | 81 | +8 |
| sentence-simplicity | 29 | **26** | **−3** |
| directness | 64 | 64 | 0 |

Holding `grade-band` at its v1 value, v2 scores 74.5 rather than 81.6 — so **one dimension supplied
7.1 of the 8 points**, and it is now pinned at 100 with nowhere left to go.

A third pass could fix every remaining section and barely move the composite. At that point "the
number stopped rising" and "the work is done" have come apart completely, which is exactly when the
loop declares itself finished.

Two related notes from the same measurement, because they explain why the composite is not
recoverable by re-weighting:

- **The two sentence dimensions fought.** Hard sentences went 84 → 100 while `grade-band` improved
  35 points. Splitting long sentences lowers the *median* reading grade and raises the *count* of
  sentences still above the per-sentence cutoff. The same edits move the two dimensions in opposite
  directions.
- **`directness` did not move at all** — 39 hedge words in both drafts. Useful as a control: it
  proves this revision cut no hedges, which is the class of edit the loop is known to over-reward.

## The measure

Count sections reached, not points gained. No prose judgement; only *did this get looked at*.

`eval/probe-coverage.mjs` splits both drafts on markdown headings, matches sections by heading, and
compares each pair:

```
section                                   words   similarity  state
TL;DR                                       220        87.0%  rewritten
Key Findings                                208        87.3%  rewritten
1. Company overview                         308        98.9%  touched
8. Recent news (2024–2026)                   87       100.0%  untouched
...
12 of 13 sections reached  (92% coverage)
untouched: 8. Recent news (2024–2026)
```

**Similarity** is Ratcliff/Obershelp character overlap, the same measure Python's `difflib` reports.
1.0 means byte-identical.

Three states:

- **untouched** — byte-identical. The revision never reached it.
- **touched** — changed, similarity at or above 0.9.
- **rewritten** — changed, similarity below 0.9.

Only *untouched* affects the coverage ratio. The touched/rewritten split is reporting colour, not a
gate.

## The stop condition it implies

The loop's terminating condition becomes an **and**, not an **or**:

> Stop when `check_convergence` leaves `improving` **and** every section has been reached at least
> once.

- Score plateaus with sections untouched → keep going. The plateau is an artifact of coverage.
- All sections reached and the score plateaus → now stop.

## Two decisions that mattered more than expected

**Untouched means byte-identical, not "similar enough."** A 0.999 threshold silently rounded a real
one-character edit in §3 back to untouched. A revision that changed a semicolon to a full stop *did*
reach that section.

**Structural headings are excluded.** A document title, or a heading with nothing under it but the
next heading, can never be revised — counting them drags coverage down for free. Sections under 10
words of body are skipped. This moved the reported figure on the reference pair from 12/15 (80%) to
12/13 (92%); the numerator never changed.

## What it would take to ship

Not a dimension. Folding this into the composite would repeat the mistake the composite already
makes — averaging a different *kind* of measurement into one number.

It needs the **previous draft's text**, which nothing in the current API carries. `compareBaseline`
takes two `ScoreResult`s, and a `ScoreResult` holds statistics, not source. So either the baseline
file grows a copy of the text it scored, or coverage becomes a separate call that takes two
documents.

Sketch, deliberately thin:

```ts
const cov = coverage(previousText, currentText)
// { reached: 12, total: 13, ratio: 0.92, untouched: ["8. Recent news"] }
```

reported beside the convergence verdict rather than inside it, so a harness can require both.

## Open questions

- **Section splitting is naive.** Markdown headings only. It works for structured documents, which
  is where partial-coverage revisions happen, and exits with a clear error when a document has no
  headings rather than inventing one. An essay with no headings cannot be measured this way at all.
- **Renamed headings read as one drop plus one addition.** The reference pair had none. A revision
  that retitles a section it also rewrote would report both, which overstates churn.
- **The 0.9 rewritten threshold is one observation, not a calibration.** On the reference pair the
  gap was clean — four sections between 87% and 89%, eight between 93% and 100%, nothing between.
  That is suggestive and nothing more.
- **"Touched" is not "improved."** A section can change and get worse. Coverage is a floor: it stops
  you declaring victory on work you never did. It says nothing about the work you did.
- **Never run at scale.** One labelled pair. The 40%-coverage session that motivated this is
  described in a review, not reproduced here — its drafts were not kept.
- **Sub-section granularity is untested.** A 432-word section can be half-revised and still read as
  *touched*. Whether paragraph-level coverage is better or just noisier is unknown.

## Why this is worth more than another dimension

The existing fifteen dimensions all answer the same question: *is this prose any good?* They are
correlated, they saturate, and on this document one of them accounted for 89% of the movement.

This answers a different question: *did you finish?* It is the only candidate so far that would have
stopped the loop terminating at 40% coverage — and unlike the prose dimensions, it cannot be gamed,
because the thing it counts is the thing you were supposed to do.
