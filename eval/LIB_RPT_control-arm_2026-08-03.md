---
slug: "control-arm"
run: "3"
date: "2026-08-03"
title: "What the instruction is actually worth, against no instruction at all"
finding: "Measured within one run: the rules cut length 32%, cut jargon 2.0 points, and raise sentence-simplicity 19.7 points."
order: 3
---

# Control-arm eval (run 3) — 2026-08-03

Closes the gap left by runs 1 and 2: a no-instruction control measured on the same six tasks,
in the same run, with the fixed `clarity` and `directness` dimensions.

Three variants × 6 tasks × 5 replicates = 90 answers, all on `claude-opus-5`. Style only —
no fact-check, because two prior runs established that instruction wording does not move
factual accuracy, so accuracy has a separate trigger.

## Result

| variant | composite | grade | cplx | clarity | words | jargon% |
| --- | --- | --- | --- | --- | --- | --- |
| A — no instruction | 85.0 | 100.0 | 50.2 | 88.4 | 437.9 | 10.7 |
| B — "be concise, avoid jargon, write clearly" | 86.3 | 99.6 | 54.0 | 90.7 | 350.3 | 10.3 |
| E — the shipped rules | 89.3 | 99.3 | 69.9 | 89.1 | 297.8 | 8.7 |

**E against the control, within-run:** 32% shorter, jargon down 2.0 points, sentence-simplicity
up 19.7 points, reading grade still inside the band.

**This corrects a number that was in the shipped instruction.** The earlier "~40% shorter" claim
compared E on the six-task set against a 550-word control from the four-task set. The honest
within-run figure is 32%. `baseline.json` and the global `CLAUDE.md` entry are updated.

**E beats the obvious cheaper instruction.** B gets most of the length win (350 vs 438) and almost
none of the rest: jargon barely moves (10.3 vs 10.7) and sentence-simplicity gains 4 points against
E's 20. Telling a model to "avoid jargon" does not measurably reduce jargon; telling it which words
to prefer does.

## Which metrics are actually instruction dials

Splitting each metric's variance by variant and by task, over the same 90 answers:

| metric | spread by variant | spread by task | ratio |
| --- | --- | --- | --- |
| `words` | 140.2 | 99.8 | **0.7** |
| `sentence-simplicity` | 19.7 | 29.6 | 1.5 |
| `jargon%` | 2.1 | 6.8 | 3.3 |
| `clarity` | 2.3 | 12.0 | 5.2 |

A ratio below 1 means the instruction moves the metric more than the subject matter does. **Only
`words` clears that bar.** `sentence-simplicity` is close enough to be usable. `jargon%` is
directionally right but topic-dominated 3:1, so read it across a fixed task set or not at all.

## The clarity question, settled

Run 1 recorded clarity as "an unresponsive dial" that "should not be used as a target". That was
right by accident: the dimension was counting domain nouns, so it could not respond to anything.
0.3.0's `CLARITY_IGNORE_DEFAULT` fixed the dimension — the corpus mean moved from 54.1 to ~89 and
the topic:writing ratio fell from 165:1 to about 5:1.

With the dimension fixed and a control in hand, the answer holds for a different reason. Clarity
scores 88.4 with no instruction at all and 89.1 under the shipped rules — a 0.7-point difference,
against a 12-point spread across tasks. It cannot distinguish instructed from uninstructed writing.

**So: clarity is a good document check and a bad instruction dial.** Keep it in the profile, where
it correctly flags padding. Do not use it to choose between prompts.

## What this does not establish

One model throughout. Five replicates resolves the 2–3x effects here and would not resolve a small
difference between two similar instructions. Six tasks, all explain-a-concept — the `words` ratio
of 0.7 is specific to this task set, and a set with wider natural length variation would push it up.
No accuracy measurement was taken; nothing here speaks to correctness.
