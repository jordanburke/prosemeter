# Instruction variants under test

Each variant is a style preamble prepended to the same four tasks. Variant A is the
control: no style instruction at all, i.e. default assistant register.

Run 6 is the exception: its arms vary what a *reviser* is shown, not what a writer is told.
See "Run 6" at the bottom.

## A — control
(no style instruction)

## B — blunt
Be concise. Avoid jargon. Write clearly.

## C — negative constraints
Follow these constraints when writing:
- No nominalizations. Write "resolve" not "perform resolution", "fails" not "experiences failure".
- No passive voice.
- Prefer one- and two-syllable words over longer ones wherever a shorter word exists.
- No sentence longer than 25 words.
- Do not open with a restatement of the question.

## D — audience framing
Write for a competent engineer who is good at their job but has never worked on this
particular subsystem. They will be annoyed by being talked down to, and equally annoyed
by having to look up words to understand you. Aim for how you would explain it out loud
to a colleague at a whiteboard.

## E — concrete rewrite rules
Write using these rules:
- Lead with the answer, then explain.
- One idea per sentence.
- Start sentences with the actor doing the thing, then the verb.
- Prefer plain Anglo-Saxon words to Latinate ones: "use" over "utilize", "start" over
  "initiate", "so" over "consequently", "because" over "insofar as".
- Cut every phrase that does not change the meaning if removed.

## E′ — E plus a qualifier carve-out (run 2)

E's five rules, plus one sentence. Tests whether E's accuracy deficit came from the
cut-every-phrase rule deleting qualifiers that were load-bearing for correctness.

- Lead with the answer, then explain.
- One idea per sentence.
- Start sentences with the actor doing the thing, then the verb.
- Prefer plain Anglo-Saxon words to Latinate ones: "use" over "utilize", "start" over
  "initiate", "so" over "consequently", "because" over "insofar as".
- Cut every phrase that does not change the meaning if removed.
- A condition or exception that changes when a claim is true is meaning — never cut it.

## F — E plus four explanation rules (run 5)

E's five rules, plus four that operate on the *document* rather than the sentence.

E is entirely sentence-level: it constrains word choice, sentence order, and sentence length. A
reply can satisfy all five and still be unreadable, because what breaks an explanation is structure
and undefined terms. Observed on 2026-08-04: a reply scoring 85 on the `chat` profile drew "I have
no idea what you're saying", and the plain rewrite that landed scored 84. The score could not see
the difference, which is the thing this arm is meant to find out how to fix — or to establish that
prosemeter cannot.

- Lead with the answer, then explain.
- One idea per sentence.
- Start sentences with the actor doing the thing, then the verb.
- Prefer plain Anglo-Saxon words to Latinate ones: "use" over "utilize", "start" over
  "initiate", "so" over "consequently", "because" over "insofar as".
- Cut every phrase that does not change the meaning if removed.
- Answer one question per section, under a heading that restates the question.
- Define a term the first time you use it, or use a plain word instead.
- Never give a number without saying what it means.
- Open with what is true, not with what you did.

**Predicted to score worse, not better, and that is the point.** Headings and defined terms add
words, and the four rules are silent on vocabulary, so `words` should rise toward the control while
`jargonPct` holds near E. If the arm reads better to a human while scoring lower, the finding is
about prosemeter's blind spot rather than about the instruction — which is exactly the failure that
prompted the rules. Read this arm against a human judgment, not against the composite.

## L — BLUF as a label (run 5)

E with rule 1 replaced by its name. Everything else is held constant, so the only variable is
whether the acronym carries the behaviour that the spelled-out sentence carries.

- Use BLUF: bottom line up front.
- One idea per sentence.
- Start sentences with the actor doing the thing, then the verb.
- Prefer plain Anglo-Saxon words to Latinate ones: "use" over "utilize", "start" over
  "initiate", "so" over "consequently", "because" over "insofar as".
- Cut every phrase that does not change the meaning if removed.

The gloss after the colon is deliberate. Testing the bare acronym would confound two questions —
whether the model knows the term and whether a label instructs as well as an instruction — and only
the second is interesting.

This matters because instruction length is a real budget. `baseline.json` records that the
176-character compression of E is indistinguishable from the full 315-character form on Sonnet 5
(230.4 vs 226.5 words) while buying 16 points of length reduction on Opus. If a label does the work
of a sentence, the rules compress further on the tier where compression has been free.

---

# Run 6 — revision arms, not instruction arms

Runs 1–5 all asked the same question: does changing the *instruction* change the first draft?
Run 6 asks the one they could not. **Does showing a reviser prosemeter's findings improve the
draft, beyond what a second look improves it anyway?**

That question needs a different design, because the effect is on one document and a single
document's composite moves by less than the gap between two answers to the same task. Run 5's
control arm spanned 81–92 on six tasks under one instruction. Everything in run 6 is therefore
paired: a revision is compared to the exact draft it came from, and the arms are compared to each
other within the same origin draft.

**Base drafts:** run 5 arm A — 30 answers, 6 tasks × 5 replicates, no style instruction. The
control rather than a tuned arm, for two reasons. It is the state a draft is actually in before
anyone tunes a prompt, and it carries the most findings (11–40 per draft, median 24), so it is the
friendliest case the hypothesis will get. A guided pass that cannot win here will not win anywhere.

## P — blind revision

The draft, the question it answered, and:

> Revise it. Return your best version.

**P is not a throwaway.** A second draft beats a first draft for reasons that have nothing to do
with prosemeter — the model re-reads its own output with the question in front of it. Without P,
run 6 would measure "revision helps" and hand the credit to the tool.

## R — findings-guided revision

Byte-identical to P except for one block: the marks, one per finding, as line number + message +
hint. Generated by `revise-prompts.mjs` from one template, so the arms cannot drift.

The prompt **never names prosemeter, and never shows a score, a dimension, a rule id, a severity,
a threshold, or a verdict.** A mark reads like an editor's margin note. This is not decoration:
`README.md` forbids telling a generating agent it is being scored, because an agent told that
optimizes the formula. R bends the rule as far as the question allows and no further.

## What would count, decided before any answer exists

The composite is not the readout, and R beating its own origin draft is not the readout either —
R was shown the scorer's complaints, so movement in a marked dimension says the reviser can follow
instructions.

`prompts/run-6/targets.json` records, per draft, which dimensions produced a mark. Five of the
eleven active dimensions were never marked on any of the 30 drafts — `concision`, `grade-band`,
`lexical-diversity`, `paragraph-length`, `spelling-consistency`. Those are the generalization test.

**The finding is R against P, within origin, sign-tested over 30 drafts.**

### Predictions, stated in advance

1. Both arms beat their origin on composite. P by a little, R by more.
2. R's gain concentrates in `directness`, `clarity` and `sentence-simplicity` — the three
   dimensions that produced almost every mark.
3. **R does not beat P on the five never-marked dimensions.** If it does, the marks improved the
   prose rather than the measured spots, which is the strong result.
4. Word count falls in both arms, further in R, because most marks are "cut this word".

### Kill criteria

- If R does not beat P on composite at p < 0.05, the loop has no measured benefit on this corpus
  and `prose-loop`'s claim needs weakening. **This is a real possible outcome and the run ships
  either way.**
- If R beats P on composite while *falling* on the never-marked dimensions, the loop is trading
  unmeasured prose for measured prose — a worse outcome than no effect, and one that would argue
  for changing what the skill tells agents to do.

### The independent readout

Every number above comes from the instrument whose own complaints arm R was shown, so a win is
necessary and not sufficient. The report pairs it with a blind pairwise judgment — a judge shown
two revisions of one draft in random order, with no arm labels and no scores, asked which answers
the question better. That is the only measurement here that prosemeter cannot influence.

## Deferred

An arm **S** — "list the three biggest problems with this draft, then revise" — would separate
"structured second look" from "second look", and is the obvious next question if R beats P. Left
out to keep run 6 at 60 generations.

## Outcome — run 6 ran on 2026-08-10

Recorded here so the predictions above stay readable against what happened. Full report:
`LIB_RPT_revision-loop_2026-08-10.md`.

| prediction | outcome |
| --- | --- |
| 1. Both arms beat their origin, R by more | **Held.** P +2.4, R +6.7 composite, both p < 0.0001 |
| 2. R's gain concentrates in directness, clarity, sentence-simplicity | **Held.** Those three are +27.0, +6.9, +10.9 against P |
| 3. R does not beat P on the five never-marked dimensions | **Held.** Largest is +0.1; the loop moves only what it marked |
| 4. Words fall in both arms, further in R | **Wrong.** Words fell further in the *blind* arm, −37.6 against −23.9 |

Neither kill criterion fired. **The run still does not support the loop**, because what sank it was
the readout neither criterion named — R lost the blind reader preference it gained 4.3 composite
points to win. Kill criteria can only fire on outcomes you thought of in advance.

The independent readout also caught the harness. The first judging prompt asked about preference
and overconfidence together, and asking primed the preference: P won 24–1. Re-asked with every word
about caveats removed, the same 30 pairs came out 18–9, p = 0.12, and the trap tasks flipped from
0–10 to 5–4. **Quote the plain pass.** What survives it is P beating R 14–4 on the explain tasks
(p = 0.031), and R never winning the aggregate despite the score saying it should.
