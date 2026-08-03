# Instruction register eval — 2026-08-02

Seven style instructions, four tasks, two replicates: 56 generated answers, scored with the
`chat` profile and independently fact-checked.

## What was tested

Four explain-a-concept questions (`tasks.md`) held fixed across seven instruction variants
(`variants.md`): a no-instruction control (A), blunt guidance (B), negative constraints (C),
audience framing (D), concrete rewrite rules (E), and two single-rule additions on top of E
(F adds a 25-word sentence cap, G adds a prefer-short-words rule).

Generating agents were told the instruction and the tasks. They were not told that anything
would be scored.

## Scores

| variant | total | grade | cplx | clarity | words | jargon% | clean |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A control | 79.5 | 100.0 | 46.5 | 54.5 | 550 | 11.1 | 4/8 |
| B blunt | 81.8 | 100.0 | 60.9 | 51.4 | 321 | 9.2 | 6/8 |
| C constraints | 80.4 | 57.6 | 97.4 | 59.6 | 246 | 3.4 | 6/8 |
| D framing | 79.8 | 100.0 | 46.6 | 56.8 | 529 | 10.3 | 5/8 |
| E rules | 85.3 | 98.3 | 72.2 | 59.5 | 343 | 8.5 | 4/8 |
| F = E + 25-word cap | 86.6 | 96.6 | 79.8 | 61.4 | 341 | 8.1 | 4/8 |
| G = E + short words | 83.6 | 94.8 | 76.5 | 51.9 | 337 | 6.8 | 7/8 |

`grade` is the `grade-band` dimension score, not a reading grade. 100 means the document's
median reading grade sat inside the profile band of 7–12; the score falls off with squared
distance in **either** direction. `jargon%` is `stats.complexWords / stats.words`. `clean` is
the count of that variant's eight answers with no technical error.

## Findings

**Read dimensions, not the composite.** Composites spanned 79.5–86.6 while within-variant
spread was roughly 15 points, so no composite gap here is interpretable. The dimension
columns moved 2–3x over the same data.

**Length is the most responsive lever.** Control wrote 550 words per answer; C wrote 246.
Instructions cut length far more reliably than they cut vocabulary.

**Audience framing did nothing.** D — "explain it to a competent engineer at a whiteboard" —
landed at 79.8 against the control's 79.5, 529 words against 550, 10.3% jargon against 11.1%.
It is indistinguishable from giving no style instruction at all. This is the clearest
negative result in the run.

**Negative constraints overshot, and the band caught it.** C produced the best vocabulary
numbers in the run and the worst `grade-band` score, at 57.6 — its median reading grade was
5.1, *below* the band floor of 7. Reading C's output against the control confirmed real
content loss: C dropped the random-I/O and page-split explanations from the index answer
entirely. Note that the metric flagged the right file for an adjacent reason. It measured
reading grade; the actual defect was missing content.

**Clarity never moved.** 51–61 across all seven variants including the control. No
instruction touched it. It is not a responsive dial and should not be used as a target.

**The highest-scoring variants were among the least accurate.** E and F scored best on
prosemeter and tied the control at 4/8 clean. G, dismissed on score alone as a bad trade,
was the most accurate at 7/8.

## The accuracy result

Two independent fact-checking passes over the same 56 answers, four reviewers each, one per
task, each reading all 14 answers to their task. Reviewers judged technical correctness only
and were explicitly told not to penalize brevity, terseness, or omitted detail. Prompts were
byte-identical across passes; only the model varied. Full findings in
`accuracy-2026-08-02.json`.

| pass | model | clean | T1 | T2 | T3 | T4 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `claude-opus-5` (same as generator) | 37/56 | 6/14 | 12/14 | 6/14 | 13/14 |
| 2 | `claude-sonnet-5` | 49/56 | 13/14 | 14/14 | 10/14 | 12/14 |
| union | — | **36/56** | | | | |

Six files were flagged by both passes, thirteen by Opus alone, one by Sonnet alone.

**Most of the gap is threshold, not blindness.** The two passes applied different criteria for
what counts as an error:

- Opus flagged any factually wrong claim, including a wrong branch offered alongside a correct
  one — "it either hoists one version and gives it to both, or nests two copies", where the
  first branch never happens.
- Sonnet flagged sole-cause errors and self-contradictions, and let hedged imprecision pass.

T3 demonstrates this cleanly. Sonnet flagged exactly the two files that list 429 as retryable
and then say "never retry a 4xx" — self-contradictory — and cleared the four that say "never
retry a 4xx" without mentioning 429, which are merely overbroad. Grepping the six files for
`429` confirms the split exactly. That is a consistent narrower criterion.

Eight of the thirteen Opus-only findings are explained this way. **Five are genuine misses**
that fail even Sonnet's narrower criterion: C-r1-T1 (delete the lockfile — sole advice, no
hedge, actively risky), A-r2-T1 (presents both branches, then diagnoses with the impossible
one: "Your build breaking suggests #2"), D-r2-T1 (asserts pnpm caches resolution
aggressively), A-r1-T2 ("indexes make writes slower, always"), and D-r2-T2 (composite `(a, b)`
beats separate indexes on `a` and `b`).

Neither pass dominates. Opus was broader and caught more; Sonnet found one error Opus was
blind to. The working figure is the union, 36 of 56, and it remains a floor.

Two error classes recurred across variants:

- **The hoisting misconception (T1).** Six answers claimed a package manager resolves a
  dependency to a version outside a dependent's declared range. It does not; non-overlapping
  ranges produce a nested second copy. Exactly one answer (G-r1) correctly conditioned the
  shared-copy outcome on the ranges overlapping.
- **Never-retry-4xx (T3).** Six answers told the reader never to retry a 4xx. 429 is a 4xx
  and is the canonical retry-with-backoff response. Two answers contradicted themselves
  within a sentence of each other, listing 429 as retryable and then ruling out all 4xx.

**A mechanism worth testing.** Four of the six never-retry-4xx instances came from E and F —
the variants instructed to *"cut every phrase that does not change the meaning if removed"*
and *"one idea per sentence."* Both D replicates, the most verbose variant, stated the
qualified version correctly. The same shape appears in T1, where E-r1 lost the conditional
that makes the shared-copy claim true.

The hypothesis: instructions to cut qualifying phrases cause a model to delete the qualifiers
that were load-bearing for correctness. A concision instruction cannot distinguish a hedge
from a precondition.

At eight answers per variant, 4/8 against 6/8 is well inside noise, and the counts alone
prove nothing. The mechanism is specific enough to test directly, and that is the next
experiment rather than a conclusion from this one.

## What this does not establish

**One model.** Every answer and every fact-check ran on `claude-opus-5` (verified from the
session subagent transcripts; no model override was passed and no agent definition set one).
Every conclusion here is about how Opus 5 responds to these instructions. Instruction-following
differs across model tiers, and the ranking could plausibly invert on a smaller model — blunt
guidance may carry further, and the rewrite rules may be harder to apply.

**The first fact-check used the same model as the writers, and a second pass tested that.**
Opus 5 fact-checking Opus 5 shares blind spots by construction, so a Sonnet 5 pass was run
over the identical files with identical prompts. It surfaced exactly one error the same-model
pass had missed — D-r1-T4, offering `useMemo` to stabilize a WebSocket, which has no cleanup
hook and can drop the socket without closing it. So the shared blind spot is real and, at
this sample size, small.

The larger effect was reviewer thoroughness, which varied far more than model blind spots did
and swamped the signal the second pass was run to isolate. Any future cross-model check needs
reviewer consistency pinned down first — a shared rubric, or a pass that re-examines only the
files the two passes disagree on — or it measures reviewer diligence rather than model
coverage.

Four tasks, all explain-a-concept. Nothing here transfers to code review, planning, or
debugging turns. Generating agents ran under a Claude Code system prompt rather than a chat
one, so absolute numbers are not production numbers — the ranking is the portable part. Two
replicates per variant is enough to show 2–3x dimension effects and not enough to separate
variants that land within a few points of each other.

No recommendation is issued from this run. E and F looked like the answer on score and are
not defensible on accuracy; G looks best on the two measures together and is a single run of
eight answers. The useful output is the method and the accuracy caveat, not a winning prompt.
