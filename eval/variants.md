# Instruction variants under test

Each variant is a style preamble prepended to the same four tasks. Variant A is the
control: no style instruction at all, i.e. default assistant register.

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
