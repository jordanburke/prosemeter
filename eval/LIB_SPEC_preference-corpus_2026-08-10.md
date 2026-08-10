# Run 7 — build the measuring stick before building the metric

> **AMENDED 2026-08-10, after phase 1 ran.** The kill criterion fired: three judges agreed 64% raw,
> Fleiss' kappa 0.302. Phase 2 does **not** start as written below. The cause was diagnosed and is
> fixable — judges pick whichever answer they read first, 92–100% of the time when the blind arm led
> against 43–69% when it did not — so the amendments in "What phase 1 changed" at the bottom are
> binding on any restart. See `LIB_RPT_judge-agreement_2026-08-10.md`.

**Every dimension prosemeter ships was added because it seemed like it should matter. None has ever
been asked whether a reader prefers the writing it rewards.** Run 6 asked, on 27 decided pairs, and
the answer was no: the composite picked the preferred draft 10 times out of 27, against 50% for a
coin.

Run 7 does not add a metric. It builds the thing a metric would have to be validated against, and
finds out whether that thing is stable enough to be worth predicting.

---

## The question, and the order it has to be asked in

Three questions, and the order is not negotiable, because a *no* at any step makes the next one
meaningless.

1. **Do independent readers agree with each other about which of two drafts is better?**
   If they agree 55% of the time, preference is close to noise, no metric can predict it, and the
   whole programme stops here with a useful negative.
2. **Given that ceiling, does any dimension prosemeter already ships beat chance?**
   Run 6 says no on 27 pairs of one contrast. 150 pairs across several contrasts is a real test.
3. **Does anything else beat it?** Length is the only candidate with a directional signal so far.

**Run 7 answers 1 and 2 and stops.** Question 3 is run 8, and only if question 1 clears its bar.

## Why the ceiling has to come first

A metric that predicts preference 65% of the time sounds mediocre and might be excellent — if two
humans only agree with each other 68% of the time, 65% is nearly perfect prediction of a noisy
target.

Without the ceiling, every number in question 2 is uninterpretable. Run 6 reported "37%" with no
idea what 100% would have been.

**This is the single most important thing run 7 produces**, more than any metric result.

---

## Phase 1 — the agreement ceiling

**Pairs:** the 30 run-6 pairs, already generated, already blinded, already judged once.

**Judges:** three per pair, independent contexts, plus a fourth pass on a different model tier.

**Prompt:** preference only. Run 6 established that asking a second question in the same prompt
primes the first — preference for the blind arm went 24–1 with an overconfidence question attached
and 18–9 without, on the same 30 pairs. `judge-prompts.mjs plain` already emits the clean form.

**Outputs:**

| measure | why |
| --- | --- |
| pairwise agreement between judges | the ceiling every metric is scored against |
| agreement across model tiers | whether "preference" is a property of the text or of the reader |
| how often the judge picks the **longer** answer | see below |
| how often the judge picks the answer in the **X** slot | position bias check; blinding is balanced 15/15, so this should sit near 50% |

### The length control is not optional

If a judge picks the longer answer 70% of the time, the judge is a length detector and every
preference number in this spec is really a length number. Run 6 hints at this from the other side —
"fewer words" was the only metric pointing the right way, 63% plain and 76% primed.

Measure it before interpreting anything. If the length rate is far from 50%, report every subsequent
result *stratified by which answer was longer*, or the corpus is a length benchmark wearing a
preference label.

### Kill criterion, stated now

**Ambiguity found when it fired, and fixed here:** the sentence below said "below 65%
chance-corrected", but 65% and a kappa are not on the same scale. It should read: stop if raw mean
pairwise agreement is below 65% **or** Fleiss' kappa is below 0.60. Phase 1 returned 64% and 0.302
and fires on both.

**If mean pairwise judge agreement is below 65%, run 7 stops after phase 1** and the finding is
written up as "preference between two competent drafts is not a stable enough target for a
deterministic metric". That is a real result and it saves everything downstream.

Chance agreement on a three-way choice with ties is not 50% — compute Krippendorff's α or Cohen's κ
alongside the raw rate, and read the chance-corrected number.

---

## Phase 2 — the corpus

**150 pairs.** 30 exist. 120 to judge.

### Contrast diversity is the whole design

If every pair is "blind revision vs guided revision", a metric can score well by detecting *that
contrast* rather than quality. The pool must mix contrast types so no single artifact carries the
benchmark. Available now, without generating a single new answer:

| source | contrast | pairs available |
| --- | --- | --- |
| run 6, P vs R | blind vs findings-guided revision | 30 |
| run 5, A vs E | no instruction vs concrete rules | 30 |
| run 5, E vs F | sentence rules vs plus-structure rules | 30 |
| run 5, E vs L | spelled-out rule vs its label | 30 |
| run 3, A vs B | no instruction vs "be concise, avoid jargon" | 30 |
| run 4, A vs E | ten mixed-register tasks | 30 |
| run-sonnet, A vs E | a different model tier | 30 |
| run 2, E vs E′ | rules vs rules plus a qualifier carve-out | 30 |

**Sample 120 from at least five of these**, stratified so no contrast is more than a quarter of the
corpus. Record the contrast type per pair — it is a covariate, and a metric that works on one
contrast and fails on the others has told you something.

The E vs L pairs deserve inclusion for a specific reason: run 5 found those two arms
indistinguishable on every dimension. If judges also call them ties, that is evidence the judgment
tracks something real. If judges split them decisively, the metrics are missing something the
readers can see.

### Judges

Three per pair. One judge per (contrast, task) batch, as in run 6, so no judge sees the same origin
draft twice.

**Budget:** 120 pairs × 3 judges ÷ 5 pairs per agent ≈ 72 agent runs, plus phase 1's ~24. Runs 1–5
each cost 20–30. This is the expensive part of run 7, and it is the part that produces the durable
asset.

### What gets committed

- `eval/preference/pairs.json` — pair id, the two answer files, contrast type, blinding assignment
- `eval/preference/verdicts.json` — every judge's raw verdict, judge id, model
- `eval/preference/README.md` — what it is, and the standing rule that pairs are never edited

The verdicts are the corpus. The answers already live in `eval/corpus/`; this file only references
them, so nothing is duplicated.

---

## Phase 3 — score every existing dimension against it

No agents. Pure computation over committed data, reusing `judge-tally.mjs`'s unblinding and sign
test.

For each of the 15 dimensions, plus the composite, plus word count:

**How often does the higher-scoring answer win the majority verdict?**

Reported three ways, and all three are needed:

1. **Raw rate** against 50%.
2. **As a fraction of the ceiling** from phase 1. This is the honest number.
3. **Decided pairs only, with the tie count beside it.** Run 6 found seven of eleven active
   dimensions scored *identically* on both drafts in over 20 of 27 pairs. A dimension that cannot
   tell two real drafts apart cannot guide a choice between them, and its 50% rate is not a
   coin-flip — it is an absence.

### The bar, pre-registered

- **A dimension beats chance** if its raw rate exceeds 50% at p < 0.05 by exact sign test over
  decided pairs.
- **A dimension is a live dial** if it additionally decides more than half the pairs, rather than
  tying.
- **Anything else is a guard, not a dial** — legitimate for catching bad prose, illegitimate as a
  revision target. `eval/README.md` already records that `grade-band` is exactly this: silent on
  87% of the corpus, and removing it let a jargon fixture score 100 at reading grade 25.8.

### What the outcomes mean

| outcome | what changes |
| --- | --- |
| Several dimensions clear both bars | they become the documented revision targets; the rest are labelled guards in the profile docs |
| Nothing clears the first bar | prosemeter is a floor detector only. `prose-loop` gets rewritten around findings-with-locations, and the composite loses its advisory role |
| Only word count clears it | say so plainly. "Shorter is better" is a finding, and a deflating one for fifteen dimensions |

Every one of those is publishable. **There is no result here that wastes the run**, which is the
property a good experiment has and the coverage-gate designs did not.

---

## Explicitly out of scope

- **New dimensions.** Run 7 builds the stick. Measuring with it, then cutting to fit, is run 8.
- **Comprehension testing.** The stronger dependent variable is whether a reader can *act* correctly
  after reading — for T5 and T6 that is a yes/no decision a correct answer and an overconfident one
  lead to differently. It is also a much larger design, and it should not be entangled with
  establishing whether simple preference is stable. Sketched below; specced separately.
- **Changing any weight, threshold or profile.** Run 7 produces evidence, not edits.

## Sketch: the decision test, for run 8 or later

Preference asks a reader which draft they liked. The thing actually worth predicting is whether the
reader ends up correct.

T5 and T6 are trap tasks where a qualifier decides the answer — `useCallback` helps only under
memoization, CDN caching works only for responses that are not per-user. Show a fresh reader **one**
draft, ask the downstream decision ("your colleague wants to do X — should they?"), score the
decision, not the recall.

**The confound to design around:** a model reader already knows the domain and can answer without
reading. Any version of this must include drafts where the answer is *absent*, with "the answer
doesn't say" as a scoreable response, or it measures the judge's prior instead of the text's
transmission.

---

## Reuse from run 6

Most of the machinery exists.

| exists | needs work |
| --- | --- |
| `judge-prompts.mjs` — blind X/Y, deterministic FNV-1a, both prompt forms | extend from one run to arbitrary pair lists |
| `judge-tally.mjs` — unblinding, tallying, exact sign test, JSON emit | majority-of-three instead of single verdict; agreement stats |
| `paired.mjs` — the sign test, validated against five known binomial values | reuse as-is |
| the preference-only prompt, and the reason it exists | reuse verbatim |

New: pair sampling with contrast stratification, agreement statistics, and the chance-corrected
agreement coefficient.

## Verification

1. Phase 1 reports agreement **and** the length-pick rate **and** the position-slot rate, before any
   metric is scored against it.
2. No pair appears twice in the corpus, and no judge sees the same origin draft twice.
3. Every rate in phase 3 is printed beside its tie count and its share of the ceiling.
4. The site's research page computes any figure it quotes from `eval/preference/`, per the standing
   rule that no number on those pages is typed by hand.


---

## What phase 1 changed

Phase 1 ran on 2026-08-10 and stopped the run. These amendments bind any restart.

### 1. Every pair is judged in both presentation orders, by the same rater

Not optional, and it doubles the judging cost. Phase 1 measured a 30-to-50 point swing in the same
rater's verdict driven by nothing but which answer was printed first. A corpus built without this
would be roughly half position artifacts.

Keep only verdicts that name the same **arm** in both orders. Phase 1's own numbers: about half the
pairs survive, and on those the signal is close to unanimous — 45 to 2 across three raters, against
a raw 18–9 before filtering.

### 2. The discard rate is a headline, not a footnote

Half the pairs failing the consistency filter is a fact about the pairs. Pairs nobody can rank the
same way twice may be the honest answer to "which is better", and burying that number would
misrepresent the corpus size.

### 3. The target is re-scoped

"Which draft does a reader prefer" is not a stable quantity at kappa 0.30. **"Which draft does a
reader prefer, among pairs with a decidable difference"** is, and it is a narrower and more honest
thing for a metric to be asked to predict. Any phase 3 rate is reported over the surviving subset,
with the discard rate beside it, and never as a rate over all pairs.

### 4. Two flipped raters, not one

Phase 1 measured order-consistency against a single flipped rater, so that rater's own noise entered
every consistency count. Two would let the filter be majority-based.

### 5. The cross-tier check needs rethinking, not repeating

Sonnet returned a reasoned tie on all 30 pairs. That is a finding about effect size — whatever
separates these drafts is small enough for a capable reader to miss entirely — but it means a
cross-tier *agreement* number cannot be computed at all. A restart should either use pairs with
wider quality gaps or drop the cross-tier arm.

### 6. Still unvalidated against a human

No human has read any pair in run 6 or run 7. Position bias is a known failure mode of model judges.
Before spending 72 agent runs on phase 2, the cheapest useful thing is a handful of pairs read by a
person — if human and model verdicts diverge, the whole approach needs rethinking rather than
rescaling.
