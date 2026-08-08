---
slug: "qualifier-carveout"
run: "2"
date: "2026-08-02"
title: "Does cutting words cut the qualifiers that carry meaning?"
finding: "No. Adding a rule that protects load-bearing exceptions did not improve accuracy, and cost 9 points of sentence-simplicity."
order: 2
---

# Qualifier carve-out eval (run 2) — 2026-08-02

Tests whether E's accuracy deficit in run 1 came from its "cut every phrase that does not
change the meaning" rule deleting qualifiers that were load-bearing for correctness.

E′ is E plus one sentence: *"A condition or exception that changes when a claim is true is
meaning — never cut it."* G is E plus a prefer-short-words rule, carried forward because it
led run 1 on accuracy at 7/8.

3 variants × 6 tasks × 5 replicates = 90 answers, all on `claude-opus-5`. T5 and T6 are new
trap tasks. `RUBRIC.md` was pasted verbatim into every reviewer prompt, and every reviewer
emitted both a strict and a broad count.

## Result

| variant | composite | cplx | words | jargon% | strict clean | broad clean |
| --- | --- | --- | --- | --- | --- | --- |
| E | 83.6 | 69.2 | 290 | 8.7 | 27/30 | 20/30 |
| E′ | 81.8 | 60.3 | 314 | 9.0 | 29/30 | 21/30 |
| G | 83.5 | 74.6 | 356 | 7.1 | 28/30 | **15/30** |

**E′ failed both arms of the success criterion.** It did not hold E's style — sentence
complexity fell 69.2 → 60.3, under the ≥70 bar, and length rose 8%. Adding conditions back
lengthens sentences, which is mechanically unsurprising. And it did not move accuracy: one
file better on broad, two on strict, out of thirty.

## What this establishes

**The qualifier-deletion hypothesis is not supported.** E′ was told explicitly never to cut a
condition that changes when a claim is true. It then wrote "do not retry on 4xx" without the
429 exception in **4 of 5 replicates** (Ep-r1 through Ep-r4 on T3). The instruction failed on
the exact failure mode it was written to fix.

**So the 4xx error is generative, not compressive.** If the qualifier were being cut during
compression, an instruction to preserve qualifiers would recover it. It did not. The likelier
mechanism is that "4xx means client error, don't retry" is a strong learned pattern emitted
wrong at generation time — the qualifier was never in hand to cut. A style instruction cannot
fix a recall failure, and no amount of prompt tuning in this direction will.

**Run 1's variant-level accuracy differences were noise.** G scored 7/8 clean in run 1 and
15/30 broad clean here — worst of the three, a complete inversion at higher n. Every
conclusion drawn from run 1's 8-answer cells was unsupported, including the one that motivated
this experiment. Run 1 said so at the time; this confirms it.

**Task difficulty dominates instruction wording.** Broad-clean by task spans 3/15 (T3) to
14/15 (T5). Broad-clean by variant spans 15/30 to 21/30. Which topic you ask about predicts
accuracy far more than how you instruct the writing.

**The rubric is the largest single lever on the reported number.** Strict 84/90 (93%) against
broad 56/90 (62%) over identical answers. Emitting both counts rather than picking one was
correct — a single accuracy figure is close to meaningless without the rubric attached to it.

## The traps did not work

T5 and T6 passed 5/5 for all three variants. The T3 trap applied to only 4 of 15 answers and
failed all 4, identically across variants. Zero discrimination.

The mistake was choosing trap tasks by reasoning about which qualifiers *ought* to be
load-bearing rather than by observing what the model actually gets wrong. Both new tasks named
`React.memo` and excluded per-user caching every time. Pick trap tasks from observed failures.

The T3 trap did work as designed — it fired only when the claim was made and caught every
instance — but it inherits its target from a known error, which is the point and also the
limit.

## What to do with this

Stop tuning instructions for accuracy. Two runs now show instruction wording moving length
and vocabulary by 2–3x and accuracy not at all, and the one mechanism specific enough to test
came back negative. The remaining accuracy variance is task difficulty and model recall,
neither of which a style preamble reaches.

Instructions still control length and register reliably, and that was the original complaint.
Pick on style, verify separately, and treat the two as unrelated systems.

## What this does not establish

One model throughout, generation and review both. Five replicates resolves 2–3x effects and
would not resolve a 10% accuracy difference. The strict/broad gap means "accuracy" here is a
rubric-relative quantity, not an absolute one. And a negative result on one carve-out sentence
does not prove no instruction could reach accuracy — only that this one, aimed directly at the
observed mechanism, did not.
