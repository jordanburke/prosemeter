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
