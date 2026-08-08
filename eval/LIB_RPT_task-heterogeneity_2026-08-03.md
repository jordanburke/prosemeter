---
slug: "task-heterogeneity"
run: "4"
date: "2026-08-03"
title: "The best metric was an artifact of the task set"
finding: "Word count looked like the sharpest dial on six same-shaped tasks and stopped working on ten mixed ones. Sentence-simplicity held."
order: 4
---

# Task-heterogeneity eval (run 4) — 2026-08-03

Tests whether `words` — the harness's best instruction dial — survives a task set that is not all
one register.

T1–T6 are all the same shape: someone asks a question, the answer explains a concept. A good
explanation runs about the same length regardless of who asks, which leaves length free to move with
the instruction. Run 3 measured `words` at a variance ratio of 0.7, meaning the instruction moved it
more than the subject matter did, and the gate in `compare.mjs` leans on that.

Run 4 adds four other registers — code review, planning, diagnosis, disagreement — and re-measures.
2 variants × 10 tasks × 3 replicates = 60 answers, `claude-opus-5`, style only.

## The dial did not survive

| metric | ratio, run 3 (6 tasks) | ratio, run 4 (10 tasks) |
| --- | --- | --- |
| `words` | **0.7** | **1.3** |
| `sentence-simplicity` | 1.5 | **1.5** |
| `directness` | 1.1 | 1.7 |
| `jargon%` | 3.3 | 2.0 |
| `clarity` | 5.2 | 15.4 |

Ratio is spread-across-tasks over spread-across-variants. Below 1 means the instruction moves the
metric more than the topic does.

`words` crossed the line, 0.7 → 1.3. Natural length varies far more across these ten tasks than
across the six: the control ran 381 words on the dependency-conflict question and 675 on the
read-replica planning task. **The 0.7 was an artifact of a homogeneous task set**, and the concern
raised when it was first measured turns out to have been correct.

**`sentence-simplicity` is the stable one.** 1.5 on both sets, unchanged by the register shift. It
is the metric least sensitive to what you ask about, and on that evidence the better thing to lean
on.

`clarity` degraded from 5.2 to 15.4, which is further confirmation that it tracks subject matter.
`jargon%` improved, 3.3 → 2.0 — the wider task set dilutes any single topic's vocabulary.

## The instruction still works

| variant | words | jargon% | sentence-simplicity | directness |
| --- | --- | --- | --- | --- |
| A — no instruction | 475.3 | 11.2 | 48.7 | 44.5 |
| E — the shipped rules | 278.7 | 8.5 | 65.7 | 53.8 |

41% shorter on the wider set, against 32% on the six-task set. Every effect holds direction and
magnitude. A ratio above 1 does not mean the instruction stopped working — the variant spread is
still 196.6 words. It means **you cannot read the metric across tasks without holding the task set
fixed**, which is a different and narrower claim.

## The bug this surfaced

`compare.mjs` gated run 4 against the six-task baseline and **passed**. It compared 278.7 words on
ten tasks against 290.1 measured on six, and `sentence-simplicity` cleared its floor by 2.7 points
on luck. Nothing in the gate knew the task set had changed.

`baseline.json` has recorded `taskSet` since it was written; the gate simply never read it.
`compare.mjs` now compares the run's tasks against the baseline's and exits 2 on mismatch rather
than producing a comparison that means nothing.

## What this changes

- The gate stays valid, because it is a same-task-set comparison over time. That property is now
  enforced instead of assumed.
- Prefer `sentence-simplicity` over `words` as evidence that an instruction is landing. It is
  stable across registers; `words` is not.
- Any claim of the form "the instruction cuts length N%" is scoped to a task set. The 32% in
  `baseline.json` is a six-task figure; this run's 41% is a ten-task figure. Neither is wrong and
  they are not interchangeable.

## Addendum — how much of the instruction is load-bearing?

A 3000-character org system prompt with 2600 already used leaves 400. The shipped rules are 315
characters, so they fit — but a tightened one-line form is 176, and nobody had tested whether the
compression preserves the effect. Measured on the same ten tasks, 3 replicates:

| variant | chars | composite | sentence-simplicity | directness | words | jargon% |
| --- | --- | --- | --- | --- | --- | --- |
| A — no instruction | 0 | 84.7 | 48.7 | 44.5 | 475.3 | 11.2 |
| Et — tightened | **176** | 88.8 | **70.6** | **56.1** | 358.8 | 8.7 |
| E — as shipped | 315 | 88.5 | 65.7 | 53.8 | **278.7** | 8.5 |

**The compression costs half the length win and nothing else.** Jargon is unchanged (8.7 against
8.5). Sentence-simplicity and directness come out higher, by about five points on a single run —
suggestive, not established. Length is the clear loss: 24% below control against E's 41%.

The likely cause is `"Cut every phrase that does not change the meaning if removed"` shortening to
`"Cut phrases that do not change the meaning"`. "Every" appears to be load-bearing.

Note that by `sentence-simplicity` — the only metric stable across both task sets — the 176-character
form is at least as good as the full one. Use the full rules where they fit, because only they buy
the length reduction. The tightened form is the fallback when characters are scarce, and it gives up
a known thing rather than an unknown one.

## What this does not establish

One model. Three replicates, enough for the 2–3x effects here and not for small differences. The
four new registers are one instance each, so "planning tasks run long" rests on a single task with
n=3. And no accuracy measurement was taken.
