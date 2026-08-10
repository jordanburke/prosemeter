---
slug: "judge-agreement"
run: "7"
date: "2026-08-10"
title: "The judges were reading position, not prose"
finding: "Independent judges agreed with each other barely better than chance, because presentation order decided about half their verdicts — and the signal that survives showing every pair both ways is far stronger than the raw one."
order: 8
---

# Judge agreement — run 7 phase 1, 2026-08-10

**The kill criterion fired, and the diagnosis is not the one it was written for.**

Three independent judges over the same 30 pairs agreed with each other 64% of the time, Fleiss'
kappa 0.302. The spec says stop below 65%. But the reason they disagreed turned out to be
measurable and fixable: **judges pick whichever answer they read first, about half the time
regardless of its content.** Filter to the verdicts that survive being shown the pair the other way
round, and the signal is not weak at all — it is close to unanimous.

So phase 2 does not start, and it does not start for a better reason than "preference is noise".

---

## Why phase 1 existed

Run 6 reported that prosemeter's composite picks the preferred draft 37% of the time. That number
was uninterpretable, because nobody had measured what a perfect score would be. If two judges agree
68% of the time, a metric at 65% is nearly perfect prediction of a noisy target.

Five raters, arranged as a factorial rather than five samples of one thing:

| rater | model | order | purpose |
| --- | --- | --- | --- |
| j1, j2, j3 | Opus | normal | the ceiling |
| j4 | Opus | **flipped** | position bias |
| j5 | Sonnet | normal | cross-tier stability |

j1 is run 6's preference-only pass, reused. The prompt asks preference and nothing else — run 6
established that a second question in the same prompt primes the first.

## 1. The ceiling is low

| pair | raw agreement |
| --- | --- |
| j1 vs j2 | 67% |
| j1 vs j3 | 70% |
| j2 vs j3 | 57% |
| **mean** | **64%** |

**Fleiss' kappa: 0.302.** On the conventional reading that is "fair" agreement — well above chance,
well below anything you would build a benchmark on.

Both readings of the spec's threshold fail. The spec said "below 65% chance-corrected", which was
sloppy of me: 65% and a kappa are not on the same scale. Raw is 64%, kappa is 0.30. It fires either
way, and the ambiguity is worth fixing in the spec rather than arguing about.

## 2. The cause: judges read position, not prose

The X-slot rate alone cannot show this, because the arms are not equally liked — a judge who
genuinely prefers P picks X more often on the pairs where P happens to be X, with no position effect
at all. Splitting P's win rate **by the slot P sat in** separates them. Equal columns would mean the
judgment tracks the text.

| rater | P wins when shown **first** | P wins when shown **second** |
| --- | --- | --- |
| j1 | 12/13 (92%) | 6/14 (43%) |
| j2 | 13/13 (100%) | 7/12 (58%) |
| j3 | 12/12 (100%) | 9/13 (69%) |
| j4 (flipped) | 11/13 (85%) | 10/14 (71%) |

**A judge shown the blind revision first picks it 92–100% of the time. Shown second, 43–69%.** That
is a 30-to-50 point swing driven by nothing but reading order.

Under *pure* position bias the second column would read 0%. It does not, so content matters — it is
just swamped. And because the blinding is balanced 15/15, the aggregate direction still survives:
run 6's "P beats R" is not a position artifact. What position destroyed was the reliability of any
*individual* verdict, which is exactly what a kappa measures and exactly what a metric would have to
be validated against.

## 3. Sonnet called all 30 pairs ties

Not a parse failure. Sonnet returned a reasoned tie for every pair — *"X and Y present identical
structure, examples, and conclusions, differing only in wording"* — thirty times.

Read plainly: **at this tier the two revisions are not distinguishable.** That is evidence about the
size of the effect, not about Sonnet. Whatever separates a blind revision from a findings-guided one
is small enough that a capable reader can miss it entirely.

It also means the "cross-tier agreement 20%" figure the script prints is misleading and should be
read as "decided 0 of 30", not as disagreement.

## 4. The length control came back clean

Judges picked the **longer** answer 28–37% of the time. Not a length detector — if anything they
lean shorter, consistent with run 6's finding that "fewer words" was its only directional signal.

One confound worth naming: the blind arm cut more words than the guided arm (−37.6 against −23.9),
so "prefers shorter" and "prefers the blind arm" are partly the same statement here. A corpus with
mixed contrasts would separate them.

## 5. What survives being shown both ways — and this is the result

j4 saw every pair inverted. A pair where a same-order rater and j4 name the **same arm** carries a
judgment that presentation order did not decide.

| rater vs j4 | order-consistent | reversed | involved a tie | of the consistent: P / R |
| --- | --- | --- | --- | --- |
| j1 | 15 | 9 | 6 | **14 / 1** |
| j2 | 16 | 6 | 8 | **15 / 1** |
| j3 | 16 | 6 | 8 | **16 / 0** |

About half the pairs survive. On those, **the blind revision wins 45 of 47 across the three raters.**

Run 6 reported 18–9 and called it a lean. The order-consistent subset says the lean was a strong
effect buried under order noise. **Filtering for order-consistency did not weaken run 6's
conclusion. It sharpened it.**

**The caveat that must travel with this number:** the subset is filtered, not sampled. A pair
survives when the quality gap is wide enough to beat the order effect, so the surviving set is
biased toward clear cases by construction. 45-of-47 is the win rate *among pairs with a decidable
difference* — it is not a rate over all pairs, and quoting it as one would be wrong.

## What this changes

**Phase 2 does not start as specced.** A 120-pair corpus judged the way phase 1 judged would produce
120 labels of which roughly half are position artifacts, and no metric could be honestly validated
against it.

**The protocol change, if it restarts:**

1. **Every pair judged in both orders, by the same rater.** Keep only verdicts that name the same
   arm twice. This doubles the judging cost and is not optional — it is the difference between a
   kappa of 0.30 and a usable label.
2. **Report the discard rate as a headline**, not a footnote. Half the pairs dropping out is a fact
   about the pairs, and pairs nobody can consistently rank may be the honest answer to "which is
   better".
3. **Re-scope the target.** Preference over *all* pairs is not a stable quantity at this agreement
   level. Preference over pairs with a decidable difference is, and that is a narrower and more
   honest thing for a metric to predict.

**And run 6's conclusion stands stronger.** The blind revision beats the findings-guided one, on the
verdicts that presentation order did not decide, 45 to 2.

## Limitations

- **One flipped rater.** Order-consistency is measured against j4 alone, so j4's own noise enters
  every consistency count. Two flipped raters would let the filter be majority-based.
- **30 pairs, one contrast.** Everything here is blind-vs-guided revision on six tasks.
- **Model-as-judge throughout.** No human ever read these pairs. The position effect is a known
  failure mode of model judges and may not transfer to human readers — but it also means nothing in
  runs 6 or 7 has been validated against an actual reader.
- **The spec's threshold was ambiguously written** and is amended in place rather than
  reinterpreted after the fact.

## Reproducing

```bash
node eval/judge-prompts.mjs plain          # normal order
node eval/judge-prompts.mjs plain flip     # inverted order
# judge: j2, j3 normal; j4 flipped; j5 normal on a different tier
node eval/agreement.mjs
```

Verdicts in `eval/judgments/run-7/`, summary in `eval/results/run-7-agreement.json`.
