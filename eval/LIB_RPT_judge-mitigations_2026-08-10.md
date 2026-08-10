---
slug: "judge-mitigations"
run: "7"
date: "2026-08-10"
title: "One cheap fix for position bias did nothing; the other traded coverage for precision"
finding: "Making the judge reason before deciding changed nothing at all. Scoring each answer alone removed the bias by construction, and abstained on half the pairs it was asked about."
order: 9
---

# Two mitigations for position bias — run 7 phase 1b, 2026-08-10

**Reason-first is dead. Absolute scoring works and costs coverage.**

Phase 1 found a pairwise judge picks whichever answer it reads first, and that only about 69% of
decided verdicts survive being shown the pair inverted. Two cheap fixes, both tested on the same 30
pairs with no new drafts, 24 agent runs.

---

## Arm RF — make the judge compare before it commits

The prompt asked for the verdict and the justification on one line, **verdict first**. The
hypothesis: the model commits before it has compared anything, and the justification then
rationalises a choice already made. So require one sentence on each answer, and only then a winner.

| prompt | decided both orders | consistent | reversed | consistency |
| --- | --- | --- | --- | --- |
| verdict-first (rater 1) | 24 | 15 | 9 | 63% |
| verdict-first (rater 2) | 22 | 16 | 6 | 73% |
| verdict-first (rater 3) | 22 | 16 | 6 | 73% |
| **reason-first** | 23 | 16 | 7 | **70%** |

**Baseline mean 69%, reason-first 70%.** One point, inside a baseline that already spans 63–73%
across three raters of the identical prompt.

No effect. The hypothesis was wrong, or the intervention was too weak to test it — either way this
is not the fix, and it should not be carried forward on the grounds that it "can't hurt". It costs
tokens and buys nothing.

## Arm ABS — score each answer alone

Ten answers per task, shuffled by a hash of the filename, no arm labels, no hint that any two are
related. An anchored 1–10 rubric rather than a bare scale, because unanchored scales are where
compression comes from. Two independent raters.

**Position bias is gone by construction** — an answer is never printed beside a rival, so there is
no first and no second.

### The predicted failure appeared

| rater | range | mean | sd | distinct values used | distribution |
| --- | --- | --- | --- | --- | --- |
| A | 6–10 | 8.57 | 0.78 | 5 of 10 | 6:1 7:3 8:22 9:29 10:5 |
| B | 7–10 | 8.63 | 0.77 | 4 of 10 | 7:5 8:18 9:31 10:6 |

Four-fifths of every rating is an 8 or a 9. The two raters gave the *same* number to 36 of 60
answers.

Turn the scores back into pairwise verdicts and the cost is plain:

| rater | P | R | tie |
| --- | --- | --- | --- |
| A | 7 | 3 | **20** |
| B | 8 | 1 | **21** |

**Absolute scoring abstains on two thirds of the pairs.** Where pairwise judging produced a verdict
on 27 of 30 and was wrong about half of them, this produces a verdict on 9 or 10 and is silent on
the rest.

### But the verdicts it does give look right

The strictest labels available: 12 pairs where all three same-order raters *and* the flipped rater
named the same arm. Presentation order did not decide these and no rater dissented.

| rater | decides | agrees with gold | abstains |
| --- | --- | --- | --- |
| A | 6 of 12 | **6** | 6 |
| B | 4 of 12 | **4** | 8 |

Ten decisions, ten agreements, zero contradictions.

**This is much weaker evidence than it looks, and the reason has to travel with the number.** All 12
gold pairs favour the blind arm. A scorer that simply prefers the blind arm scores 100% here while
knowing nothing. Rater A picks the blind arm 7 times to 3 overall, so under chance-with-that-lean
the expected result on six pairs is about 70%, and observing 6 of 6 is p ≈ 0.12. **Read this as the
absence of a counterexample, not as demonstrated accuracy** — the corpus cannot supply one, because
it contains no strongly-agreed pair going the other way.

## What this means for the corpus

Both arms produced a usable conclusion, which is what the cheap experiment was for.

**Drop reason-first.** Measured, no effect, costs tokens.

**Absolute scoring is a filter, not a replacement.** It converts a coverage problem into a precision
problem — and for building a validation corpus, precision is the one you want. A benchmark of 40
pairs whose labels are trustworthy beats 120 pairs half of which are print-order artifacts.

The design that follows from both phases:

1. **Pairwise, both orders, keep only what survives.** Still the primary method. ~69% of decided
   pairs survive, and phase 1 showed the survivors carry a strong clean signal.
2. **Absolute scoring as a second, independent vote.** It fails differently from pairwise judging,
   which is the property worth having in a second opinion — position cannot fool it, and compression
   cannot fool the pairwise arm.
3. **Treat a pair as labelled only when both methods agree.** Expect roughly a third of pairs to
   qualify. Say so up front rather than discovering it at the end.

That is a much smaller corpus per unit of judging cost than the spec assumed. 120 pairs of *labels*
would need something closer to 350 pairs of judging, which changes the economics enough that the
spec's phase 2 needs re-costing rather than restarting.

## The limitation that outranks all of these

**No human has read a single pair across runs 6, 7 or 7b.** Every mitigation here was measured by
one model against another model's verdicts. Absolute scoring "agrees with gold" where the gold is
itself model-produced.

Before spending anything on phase 2, the cheapest useful thing remains a person reading ten pairs.
If a human disagrees with the order-consistent gold, none of this survives, and no amount of
additional model judging would have revealed it.

## Reproducing

```bash
node eval/judge-prompts.mjs plain reason        # reason-first, normal order
node eval/judge-prompts.mjs plain reason flip   # reason-first, inverted
node eval/absolute-prompts.mjs                  # 6 files, 60 answers, shuffled
# judge: rf, rf-flip, abs-a, abs-b
node eval/mitigations.mjs
```

Verdicts in `eval/judgments/run-7/`, summary in `eval/results/run-7-mitigations.json`.
