---
slug: "bluf-as-a-label"
run: "5"
date: "2026-08-08"
title: "Naming a technique instructs better than spelling it out"
finding: "Swapping one rule for the label BLUF cut 38% off the control against the sentence's 31%, and tied it on every other dimension."
order: 6
---

# BLUF as a label, and four rules for explanations — run 5, 2026-08-08

**Two findings. Naming a technique instructs at least as well as spelling it out, and compresses
harder. The four explanation rules cost 19% more words for a vocabulary gain prosemeter can barely
see — which is the outcome that was predicted in advance, and the reason they still need a human
verdict.**

Four arms, six tasks (T1–T6), five replicates, n=30 per arm, 120 answers. `claude-opus-5`, scored
by prosemeter 0.4.2 against the `chat` profile.

| arm | instruction |
| --- | --- |
| A | none — control |
| E | the five shipped rules |
| F | E plus four explanation rules |
| L | E with rule 1 replaced by "Use BLUF: bottom line up front" |

## Results

| arm | words (sd) | vs control | jargon% | sentence-simplicity | grade-band | clarity | composite |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 655.5 (83) | — | 10.7 | 52.7 | 100.0 | 76.6 | 84.8 |
| E | 454.5 (62) | **−30.7%** | 8.9 | 68.2 | 99.2 | 89.1 | 89.6 |
| F | 540.0 (104) | −17.6% | **8.0** | 67.2 | 99.3 | 86.7 | 89.1 |
| L | 406.7 (81) | **−38.0%** | 8.5 | 67.4 | 98.2 | 90.1 | 89.8 |

The composite column is there to be dismissed. E, F, and L span 89.1–89.8 against within-arm
spreads of 12 to 16 points, so no composite difference in this run is interpretable. Every finding
below comes from the dimension columns.

## L — the label carries the sentence, and then some

**Replacing "Lead with the answer, then explain" with "Use BLUF: bottom line up front" did not
weaken the instruction. It shortened the output by a further 10.5%.**

L cuts 38.0% off the control against E's 30.7%. The 47.8-word gap between them is about 2.7 times
its standard error, so it is unlikely to be sampling noise — though it is one model on one day.

On everything else the two are indistinguishable:

| | E | L |
| --- | --- | --- |
| jargon% | 8.9 | 8.5 |
| sentence-simplicity | 68.2 | 67.4 |
| grade-band | 99.2 | 98.2 |
| clarity | 89.1 | 90.1 |

Only rule 1 differed; rules 2–5 were held constant. So the length difference is attributable to the
swap rather than to a rewritten instruction.

The gloss after the colon was deliberate. A bare acronym would have confounded "does the model know
the term" with "does a label instruct as well as an instruction", and only the second is
interesting.

**What this does not show.** That labels beat sentences in general. One label was tested, for a
technique with a widely-known name and a one-line gloss. A label for something the model has no
prior for is a different experiment.

## F — the prediction held, including the part that matters

`variants.md` recorded before the run: *"Predicted to score worse, not better… `words` should rise
toward the control while `jargonPct` holds near E."*

Both happened. F adds 85.5 words over E (+18.8%) and gives back a third of E's length cut. Its
jargon is the lowest of any arm at 8.0 — 0.9 points under E, against a control of 10.7.

Sentence-simplicity is flat across all three instructed arms (67.2–68.2), which is expected: the
four rules operate on document structure, and sentence-simplicity counts hard sentences.

**The composite cannot separate F from E, and that is the finding, not a failure of the run.** The
four rules exist because a reply scoring 85 on this profile drew "I have no idea what you're
saying", and the rewrite that landed scored 84. This run reproduces that blind spot on 30 fresh
answers rather than on one anecdote: the arm built to fix a legibility failure moves the composite
by −0.5.

So F cannot be adopted or rejected on this evidence. What the scores establish is its **price** —
19% more words — and that the price does not buy a vocabulary regression. Whether it buys legibility
is a human judgment, and the answers are on disk to make that judgment against.

## The control moved 50%, and that is a harness confound

The control arm ran 655.5 words. Run 3's control, on the identical six tasks and the same model
name, ran 437.9.

**Relative effects survive it intact.** E cuts 30.7% here against 32.0% in run 3. Control jargon is
10.7 in both runs, to the decimal. So the shift is specifically in length and it moved every arm
together.

The likely cause is the generation harness, not the model: these answers were written by Claude Code
subagents holding tools and writing files, where earlier runs used a different setup. That is a
difference in generation conditions, and it means **absolute numbers from run 5 are not comparable
to run 2, 3, or 4.** Within-run comparisons are unaffected, which is the entire reason
`eval/README.md` insists on a control arm in every run.

### `compare.mjs` fired a false regression, and the control is what exposed it

```
words   baseline 290.1   observed 454.5   +164.4   REGRESSED (> 360)
```

The gate is correct on its own terms and wrong about the world. Its tolerance is an absolute word
count calibrated against a 437.9-word control; when the whole population shifts up 50%, an
unchanged instruction trips it.

**No tolerance was widened in response.** Widening it would destroy what the gate is for — catching
a drift back toward uninstructed length — and this run gives no evidence the instruction stopped
working. The fix, if one is wanted, is for the gate to compare against a within-run control instead
of a stored absolute, which is a design change that needs its own justification.

Recorded here so the next run that trips this recognises it rather than re-deriving it.

## Reproducing

```bash
pnpm build
node eval/score.mjs   eval/out-run5
node eval/compare.mjs eval/out-run5 E
```

Answers are gitignored — see "Why outputs are not committed" in `eval/README.md`.

## What this run does not establish

- **Nothing about factual accuracy.** No reviewer pass was run, per the standing finding that
  instruction wording moves length and vocabulary 2–3x and moves correctness not at all.
- **Nothing about whether F reads better**, which is the only question F was written to answer.
- **Nothing about other models.** Ranking has transferred to Sonnet 5 before; magnitude has not.
