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
- **Split every metric's variance by task as well as by variant.** The ratio is what tells you
  whether a metric is an instruction dial at all. Measured over run 3's 90 answers:

  | metric | by variant | by task | ratio |
  | --- | --- | --- | --- |
  | `words` | 140.2 | 99.8 | **0.7** |
  | `sentence-simplicity` | 19.7 | 29.6 | 1.5 |
  | `jargon%` | 2.1 | 6.8 | 3.3 |
  | `clarity` | 2.3 | 12.0 | 5.2 |

  Below 1 means the instruction moves it more than the subject matter does. Only `words` clears
  that; `sentence-simplicity` is close enough to use. Read `jargon%` only across a fixed task set.
- A dimension that does not move across variants may be broken rather than uninformative. This list
  used to claim clarity was an unresponsive dial, on the evidence that it sat at 51–61 across every
  variant including the control. It was instead counting domain nouns — `retext-simplify` flags
  `effect`, `request`, `render`, `function`, and `component` as wordy. `CLARITY_IGNORE_DEFAULT`
  (0.3.0) fixed the dimension: corpus mean 54.1 → ~89, topic:writing ratio 165:1 → 5:1.
- **Clarity is a good document check and a bad instruction dial.** With the dimension fixed and a
  control in hand, it scores 88.4 uninstructed and 89.1 under the shipped rules — 0.7 points apart,
  against 12 points across tasks. Keep it in the profile, where it correctly flags padding. Do not
  use it to choose between prompts.
- Instruction wording does not reach factual accuracy. Two runs, one targeted mechanism test,
  no effect.
- Task difficulty dominates instruction wording for accuracy — broad-clean spanned 3/15 to 14/15
  by task against 15/30 to 21/30 by variant.
- Trap tasks must come from observed failures. Tasks picked by reasoning about which qualifiers
  *ought* to be load-bearing passed 5/5 for every variant and discriminated nothing.
- Never tell the generating agent it is being scored.

## Accuracy has a separate trigger

Accuracy is not instruction-driven, so it does not belong in the instruction loop. Check it when
the **model** changes, not when the instruction does, and check it with the rubric in
`RUBRIC.md` pasted verbatim, both counts emitted. Expect a rubric-relative number: run 2 scored
84/90 strict and 56/90 broad over identical answers.

The recurring errors that survived every instruction — "never retry a 4xx" without the 429
exception, Square's idempotency key being a body field, the dependency-hoisting misconception —
are recall failures, not style failures. If they matter, put the fact in context or add a check.
No preamble will fix them.

## Why outputs are not committed

The answers are evidence about what an instruction produced. Editing them to fix errors
destroys exactly the property that makes them evidence, so they cannot be cleaned up and
kept. Committing them unedited would instead park 19 known-wrong technical explanations in
the repo where they read as reference material.

Accuracy findings live in `accuracy-<date>.json` — the claims, why they are wrong, and which
files they came from — which preserves the result without preserving the errors.
