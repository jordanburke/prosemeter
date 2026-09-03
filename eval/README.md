# eval

A harness for measuring whether a style instruction actually changes how a model writes.

The instruction is the independent variable. The prosemeter score is the dependent variable.
Hold the task set fixed, vary the instruction, generate answers, score them, compare.

This directory is not part of the published library. It is not a workspace package, it is not
built, and nothing in `packages/` imports it.

## Running it

1. Pick the tasks (`tasks.md`) and the instruction variants (`variants.md`).
2. Generate answers with whatever agent you are testing. Write each to
   `out/<variant>-<rep>-<task>.md` — for example `out/E-r2-T3.md`. The filename is the only
   thing that carries the experimental design, so the three fields must be dash-separated
   and must not themselves contain dashes.
3. Score:

```bash
pnpm build          # score.mjs imports the built bundle
node eval/score.mjs
```

`out/` is gitignored. Answers are run artifacts, not fixtures — see "Why outputs are not
committed" below.

## Generating the answers

Give each agent the style instruction followed by the tasks, and nothing else. Two rules
matter:

- **Never mention prosemeter, readability, grade level, or word count to the generating
  agent.** An agent told it is being scored on a readability formula will optimize the
  formula directly, and the run then measures nothing about the instruction.
- **Run at least two replicates per variant.** Generation is nondeterministic. Scoring is
  not. A single sample per cell is noise.

## Reading the output

Read the per-dimension columns, not the composite.

In the 2026-08-02 run the composite spanned 79.5–86.6 across seven variants while the
within-variant spread was about 15 points, so no composite gap in that run was
interpretable. The dimension columns moved 2–3x over the same data: mean length ran from
550 words down to 246, and `complexWords` as a share of total words ran from 11.1% down to
3.4%. The composite averages those effects away.

`words` and `cplxW` come from `stats`, not from a scored dimension. prosemeter scores a
document without knowing what question it answered, so it cannot tell you whether 341 words
was the right length. Track that here instead.

## Verifying correctness

**Scoring well and being right are different measurements, and this harness only does the
first one.** Before drawing any conclusion from a run, fact-check the answers with a
separate reviewer pass — one reviewer per task, reading every variant's answer to that task,
so that disagreements between variants become visible.

Instruct reviewers to judge technical correctness only, and explicitly not to penalize
brevity, terseness, omitted detail, or informal tone. Otherwise they re-measure style and
you learn nothing new.

The 2026-08-02 run found 36 of 56 answers clean across two reviewer passes, and the two
highest-scoring variants tied the control for worst accuracy. Skipping this step would have
produced a confidently wrong recommendation. See
`LIB_RPT_instruction-register-eval_2026-08-02.md`.

Reviewing with a second model is worth doing but does not do what you would expect. In this
run a Sonnet 5 pass over the identical files found one error the same-model Opus pass had
missed, and did not flag thirteen that it caught. Most of that gap was the two reviewers
using different thresholds for what counts as an error, not one of them being blind — so
**fix the threshold before comparing models**. Say explicitly whether a wrong claim offered
alongside a correct alternative counts, and whether overbroad advice counts when the answer
does not contradict itself. Without that, a cross-model pass measures the rubric rather than
the models. Take the union of passes, and treat any single pass as a floor.

## When the model changes

The instruction in `baseline.json` is an empirical claim about one model on one date. It is not
a style opinion and it does not automatically survive a model change. Instruction-following
differs across tiers, so the winning instruction can change.

**Trigger:** the session model changes, or you are about to adopt a different tier.

**What to run:** the current instruction, a no-instruction control, and one or two alternatives.
Five replicates over the six tasks. That is 15–20 agents.

**What NOT to run: the fact-checkers.** Two runs established that instruction wording moves
length and vocabulary by 2–3x and does not move factual accuracy at all. Re-running reviewers on
an instruction change measures nothing and costs the most. Accuracy is a separate system with a
separate trigger — see below.

```bash
pnpm build
node eval/score.mjs   eval/out-<new-run>          # all variants, all dimensions
node eval/compare.mjs eval/out-<new-run> E        # gate the incumbent against baseline
```

`compare.mjs` exits 1 on regression. A regression means the instruction stopped landing on this
model — re-read `score.mjs` output and adopt whichever variant now wins, then update
`baseline.json` with the new model, date, and means.

Always include the control arm. The committed baseline has no control on the six-task set, so
its deltas mix task sets. A within-run control fixes that.

## What does not need re-testing

These came out of the 2026-08-02 runs and are properties of the method, not of the model. Do not
spend agents re-deriving them:

- Read per-dimension columns, never the composite. The composite averages the real effects away.
- **Split every metric's variance by task as well as by variant**, and know that the ratio depends
  on the task set. Measured twice:

  | metric | 6 tasks, all explain-a-concept | 10 tasks, mixed registers |
  | --- | --- | --- |
  | `words` | **0.7** | 1.3 |
  | `sentence-simplicity` | 1.5 | **1.5** |
  | `directness` | 1.1 | 1.7 |
  | `jargon%` | 3.3 | 2.0 |
  | `clarity` | 5.2 | 15.4 |

  Below 1 means the instruction moves the metric more than the topic does. `words` looked like the
  best dial on the homogeneous set and crossed the line on the mixed one — natural length varies far
  more when the registers differ (control: 381 words explaining a dependency conflict, 675 planning
  a read replica). **`sentence-simplicity` is the stable one**, unchanged across both, and the better
  thing to lean on. A ratio above 1 does not mean the instruction stopped working; it means the
  metric cannot be read across tasks without holding the task set fixed.
- **Hold the task set fixed when gating.** `compare.mjs` enforces this — it exits 2 if the run's
  tasks differ from `baseline.taskSet`. Before that check existed it silently compared a ten-task
  run against a six-task baseline and passed. Any "cuts length N%" claim is scoped to a task set:
  32% on six tasks, 41% on ten, both correct and not interchangeable.
- A dimension that does not move across variants may be broken rather than uninformative. This list
  used to claim clarity was an unresponsive dial, on the evidence that it sat at 51–61 across every
  variant including the control. It was instead counting domain nouns — `retext-simplify` flags
  `effect`, `request`, `render`, `function`, and `component` as wordy. `CLARITY_IGNORE_DEFAULT`
  (0.3.0) fixed the dimension: corpus mean 54.1 → ~89, topic:writing ratio 165:1 → 5:1.
- **Clarity is a good document check and a bad instruction dial.** With the dimension fixed and a
  control in hand, it scores 88.4 uninstructed and 89.1 under the shipped rules — 0.7 points apart,
  against 12 points across tasks. Keep it in the profile, where it correctly flags padding. Do not
  use it to choose between prompts.
- **A dimension that sits at 100 for most documents is not thereby useless.** `grade-band` scores
  exactly 100 on 87.5% of the 416 eval answers (sd 8.0, against `sentence-simplicity`'s 19.0) while
  carrying the `chat` profile's largest weight, 0.24. That looks like a flat ~24-point giveaway that
  compresses the composite — dropping it widens the corpus spread from sd 4.10 to 4.80.

  It was swept anyway, `direction` × `weight`, against the three calibration assertions in
  `packages/prosemeter/test/corpus.spec.ts`. **Every alternative failed:**

  | config | clear | jargon | spread | choppy | verdict |
  | --- | --- | --- | --- | --- | --- |
  | both, 0.24 (shipped) | 92 | 48 | **44** | **71** | pass |
  | both, 0.15 | 91 | 52 | 39 | 78 | choppy passes the threshold |
  | floor-only, 0.24 | 92 | 70 | 21 | 71 | jargon scores 100 at grade 25.8 |
  | floor-only, 0.10 | 91 | 66 | 25 | 82 | both failures at once |

  The lesson generalizes past this dimension: **the eval corpus is 416 answers written by an agent
  asked to write clearly, so it is not a sample of bad writing.** Only 2 of 416 read above grade 12.
  The ceiling looked redundant because nothing in the population hit it. Do not conclude a guard rail
  is dead weight from a corpus that never touches it — check the adversarial fixtures, which is what
  they are for.
- Instruction wording does not reach factual accuracy. Two runs, one targeted mechanism test,
  no effect.
- **A composite rise after a revision is not evidence the document improved.** Run 6 showed a
  reviser the findings and gained 4.3 composite points on a blind revision of the same draft, 29 of
  30 — and lost the blind reader preference. The entire gain sat in the dimensions the findings
  came from; the five never-marked dimensions moved by at most 0.1. The loop moves what it measures.
  See `LIB_RPT_revision-loop_2026-08-10.md`.
- **Ask a judge one question at a time.** Run 6's first judging prompt asked "which is better" and
  "is either overconfident" together, and the second primed the first: preference for the blind arm
  went 24–1. The same 30 pairs, same blinding, preference-only, came out 18–9 at p = 0.12. A
  two-question judging prompt measures the second question twice.
- Task difficulty dominates instruction wording for accuracy — broad-clean spanned 3/15 to 14/15
  by task against 15/30 to 21/30 by variant.
- Trap tasks must come from observed failures. Tasks picked by reasoning about which qualifiers
  *ought* to be load-bearing passed 5/5 for every variant and discriminated nothing.
- Never tell the generating agent it is being scored.
- **Pool grade formulas by mean over the strong ones, not by median over all five.** Against 4,724
  human-rated CLEAR excerpts the median scored −0.528; the mean of SMOG, Gunning Fog and
  Flesch-Kincaid reaches −0.560, because Coleman-Liau (−0.479) and ARI (−0.497) are the weakest two
  and a median lets them pull the result down. Williams' t = −14.09 on the dependent correlations, so
  the gain is not sampling noise. **Shipped in 0.5.0**; `eval/clear-sweep.mjs` re-runs the comparison.
- **SMOG is the strongest single estimator (−0.575) and cannot be used alone.** Its constant floors
  it near grade 3.1, so it cannot express how extreme telegraphic prose is — on SMOG alone
  `choppy-simplistic.md` scored exactly at the `chat` threshold instead of below it. A better
  correlation is not automatically a better dimension; check the adversarial fixtures.
- **Do not read the near-zero correlation of a band score as failure.** `grade-band` scores 0.070
  against human ease, which is close to a tautology: the band is bidirectional, so its two
  directions cancel against a monotone target. Split by side it behaves as designed — below band
  −0.246, above band +0.266, group means perfectly ordered. What is wrong is narrower and
  survives the correction: 40.7% of documents score exactly 1.0 while spanning nearly the whole
  human difficulty range, so the composite inherits no ordering from the dimension for two fifths
  of documents, and the median grade underneath it is not exported at all.
- **The composite has no ordering above its bottom fifth.** Pooled over composite deciles 3–10,
  r = −0.008 on 3,780 documents. Deciles 1–2 climb steeply — that is the floor, and it works.
  Deciles 3–6 are significantly *anti*-ordered (disjoint 95% CIs), so "flat" understates it. The
  README's "floor, not a quality oracle" framing is now measured rather than asserted.
- **`sentence-simplicity` is the dimension that tracks human readers**, at 0.486 against
  `lexical-diversity`'s 0.014. That is a second, unrelated reason to lean on it — the first was its
  stable variance ratio across task sets.
- **prosemeter reads about half a grade harder than the reference implementation**, and the cause is
  an even split between sentence segmentation (+0.285 grades) and syllable counting (+0.279).
  Diagnosing it from example texts alone points only at segmentation, because the >2-grade tail is
  sentence-length dominated while the mean offset is not. Bands are tuned in grade units, so fix
  both before retuning any band.
- **Do not validate readability against Vale.** Vale's readability check computes grade level from
  the same five formulas `grade-band` uses, so agreement measures implementation, not correctness.
  Validate against a corpus with human labels. See
  `LIB_RPT_clear-corpus-validation_2026-08-29.md`.

## Run 6 measures the revision loop, and needs a different design

Runs 1–5 all vary the instruction and score the first draft. That answers "which prompt should I
use" and cannot answer "does the score/revise/stop loop in `.claude/skills/prose-loop/` improve a
document". Run 6 does the second one.

**Two things make it a different experiment, not another arm.**

*It has to be paired.* An unpaired arm comparison works in runs 1–5 because each arm has 30 answers
and draft-to-draft noise averages out. A revision moves one document, and one document's composite
moves less than two answers to the same task differ — run 5's control arm spanned 81–92. So every
comparison in `paired.mjs` is a difference against the exact draft it came from, sign-tested over
30 drafts rather than t-tested over means.

*It needs a placebo.* A second draft beats a first draft because the model re-reads its own output.
Arm P revises with no findings shown; arm R revises with them. Only R−P attributes anything to the
tool.

**And it knowingly bends the never-tell-the-agent rule above.** Arm R is shown the scorer's own
complaints, so movement in a marked dimension is close to tautological. Three mitigations, all
decided before any answer existed: the prompt shows no score, dimension, rule id or threshold —
only line, observation, suggestion; `prompts/run-6/targets.json` records which dimensions each
draft was marked on, so marked and never-marked dimensions are reported separately; and the report
carries a blind pairwise judgment, which is the only readout prosemeter cannot influence.

Five of the eleven active dimensions were marked on none of the 30 drafts. Those are the
generalization test — see `variants.md` for the predictions and the kill criteria.

```bash
pnpm build
node eval/revise-prompts.mjs               # 60 prompts + the pre-registration
# generate: one agent per (arm, replicate), six tasks each, as in runs 1–5
node eval/paired.mjs eval/corpus/run-6
```

## Run 7 is specced but not run

`LIB_SPEC_preference-corpus_2026-08-10.md` specs the follow-on: build a preference corpus and use it
to ask, for the first time, whether any shipped dimension predicts which of two drafts a reader
prefers. Phase 1 measures the judge-agreement ceiling and stops the whole programme if it is below
65% — without that ceiling, every prediction rate is uninterpretable, which is the flaw in run 6's
"37%".

## Accuracy has a separate trigger

Accuracy is not instruction-driven, so it does not belong in the instruction loop. Check it when
the **model** changes, not when the instruction does, and check it with the rubric in
`RUBRIC.md` pasted verbatim, both counts emitted. Expect a rubric-relative number: run 2 scored
84/90 strict and 56/90 broad over identical answers.

The recurring errors that survived every instruction — "never retry a 4xx" without the 429
exception, Square's idempotency key being a body field, the dependency-hoisting misconception —
are recall failures, not style failures. If they matter, put the fact in context or add a check.
No preamble will fix them.

## The corpus is committed, and marked

`eval/corpus/` holds all 596 answers across seven runs. `eval/results/run-*.json` holds every
score for them, stamped with the engine version that produced it.

**This reverses an earlier policy, and the reason is worth keeping.** The answers used to be
gitignored, on the argument that committing them would park known-wrong technical explanations
in the repo where they read as reference material. That argument was sound about the risk and
wrong about the tradeoff:

- **Scores freeze at the version that produced them; answers do not.** On 2026-08-08 the
  question "did the engine change, or did the instruction stop landing?" was settled by
  re-scoring run 2 at 0.4.2 against means recorded on 0.3.0. All four gated metrics reproduced
  to the decimal. That check was only possible because run 2's prose happened to still exist on
  one machine, where it existed nowhere else.
- **The corpus is 1.28 MB.** Storage was never the constraint.
- **The errors were already labelled.** `accuracy-2026-08-02.json` records file, severity, and
  the specific wrong claim for 20 answers. Committing the prose turns that into an annotated
  dataset rather than unmarked reference material — the opposite of what the policy feared.

So the marking is the whole safeguard, and it is per-file rather than per-directory. Every
answer's front matter names its run, variant, replicate, task and model, and says in its own text
that it is experiment output that was never fact-checked. The 20 reviewed-and-wrong answers carry
the finding inline.

**Front matter does not change a score** — verified across 15 answers on every dimension before
the migration, and the corpus reproduces the published per-variant means exactly. If that ever
stops being true, the annotations become a confound and this decision has to be revisited.

Answers are still never edited. Fixing an error would destroy the property that makes the answer
evidence.

See `eval/corpus/README.md`. `eval/migrate-corpus.mjs` is the one-time migration that produced it.
