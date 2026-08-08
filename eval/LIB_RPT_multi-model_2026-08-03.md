---
slug: "multi-model"
run: "sonnet"
date: "2026-08-03"
title: "Does the winning instruction survive a change of model?"
finding: "The ranking transfers to Sonnet 5; the effect size does not. Its uninstructed output is already a third shorter, so there is less to win."
order: 5
---

# Multi-model check (Sonnet) — 2026-08-03

Every figure in `baseline.json` was measured on `claude-opus-5`. This tests whether the shipped
instruction transfers to `claude-sonnet-5`, using the same ten tasks and the same three arms:
no instruction, the 315-character rules, and the 176-character compression.

3 variants × 10 tasks × 3 replicates per model. Style only.

## Result

| model | variant | composite | grade | sentence-simplicity | directness | words | jargon% |
| --- | --- | --- | --- | --- | --- | --- | --- |
| opus | A — none | 84.7 | 100.0 | 48.7 | 44.5 | **475.3** | 11.2 |
| opus | Et — 176 chars | 88.8 | 96.8 | 70.6 | 56.1 | 358.8 | 8.7 |
| opus | E — 315 chars | 88.5 | 98.8 | 65.7 | 53.8 | 278.7 | 8.5 |
| sonnet | A — none | 85.3 | 99.3 | 45.4 | 48.0 | **258.6** | 11.7 |
| sonnet | Et — 176 chars | 86.3 | 98.6 | 50.2 | 48.4 | 230.4 | 10.5 |
| sonnet | E — 315 chars | 87.3 | 99.9 | 52.2 | 47.2 | 226.5 | 10.2 |

## The ranking transfers; the magnitude does not

| effect against that model's own control | words | jargon | sentence-simplicity |
| --- | --- | --- | --- |
| opus, E | **−41%** | −2.7 pt | **+17.0** |
| opus, Et | −25% | −2.5 pt | +21.9 |
| sonnet, E | −12% | −1.5 pt | +6.8 |
| sonnet, Et | −11% | −1.2 pt | +4.8 |

Direction holds on every axis for both models, so nothing in the rules is wrong on Sonnet. The
effect is about a third the size.

**Sonnet writes short without being asked.** Its uninstructed output runs 258.6 words against
Opus's 475.3 — shorter than *instructed* Opus. There is far less headroom for a length instruction
to work in, which accounts for most of the gap.

**The instruction does not close the quality gap.** Instructed Sonnet reaches 10.2% jargon and 52.2
sentence-simplicity; instructed Opus reaches 8.5% and 65.7. On sentence structure, instructed Sonnet
is barely past *uninstructed* Opus. Applying the rules does not make one tier write like the other.

## What follows for deployment

**The character budget is tier-dependent.** On Sonnet the 176-character form is indistinguishable
from the 315-character one — 230.4 against 226.5 words, 10.5 against 10.2 jargon. The extra 139
characters buy nothing there. On Opus they buy 16 points of length reduction. Spend accordingly.

**The verbosity complaint is substantially an Opus problem.** A control of 475 words against
Sonnet's 259 says the rules are a corrective for a tier that over-writes, not a universal
improvement.

## What this does not establish

Three replicates, one run. The composite gaps on Sonnet (85.3 → 87.3) are small enough to be noise;
the length and sentence-simplicity effects are not. Both models generated under a Claude Code system
prompt, so some of Sonnet's terseness may be that rather than the model. Haiku is untested, and on
this trend would have even less headroom. No accuracy measurement was taken.
