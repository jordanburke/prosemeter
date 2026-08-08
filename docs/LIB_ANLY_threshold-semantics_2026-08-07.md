# What a profile threshold actually means — 2026-08-07

**Finding: thresholds are floors that catch catastrophic prose. They are not quality bars, and they
cannot be, by arithmetic.**

This was never measured. `thresholdDefault` shipped in all seven profiles, three places in the
codebase described it as a target, and nothing asserted that the deliberately-flawed fixtures fail
it.

## The arithmetic result

**No single dimension can fail a threshold on any profile.** Zero the heaviest-weighted dimension on
an otherwise perfect document and the composite still clears the bar:

| profile | threshold | heaviest dimension | weight | score if it hits 0 | fails? |
| --- | --- | --- | --- | --- | --- |
| plain | 70 | grade-band | 0.20 | 80.0 | no |
| readme | 75 | grade-band | 0.20 | 81.8 | no |
| api-docs | 72 | grade-band | 0.20 | 80.4 | no |
| blog | 70 | grade-band | 0.20 | 79.8 | no |
| marketing | 72 | grade-band | 0.20 | 81.1 | no |
| academic | 68 | grade-band | 0.20 | 77.5 | no |
| chat | 75 | grade-band | 0.24 | 76.9 | no |

That is a property of the weights, not of any document. A threshold can only be failed by **several
dimensions failing together**.

## The fixtures agree

Nine fixtures × seven profiles:

| fixture | plain | readme | api-docs | blog | marketing | academic | chat | fails |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| chat-clear | 96 | 96 | 96 | 88 | 87 | 77 | 92 | 0/7 |
| chat-jargon | 63 | 66 | 63 | 60 | 62 | 59 | 49 | **7/7** |
| choppy-simplistic | 74 | 76 | 74 | 74 | 76 | 71 | **71** | 1/7 |
| dense-academic | 64 | 68 | 65 | 60 | 63 | 59 | 47 | **7/7** |
| good-readme | 90 | 91 | 90 | 96 | 92 | 79 | 96 | 0/7 |
| mixed-spelling | 86 | 88 | 84 | 83 | 79 | 77 | 83 | 0/7 |
| passive-heavy | 95 | 95 | **98** | 87 | 84 | 85 | 95 | 0/7 |
| plaintext-sample | 80 | 80 | 80 | 87 | 86 | 69 | 88 | 0/7 |
| wall-of-text | 59 | 63 | 60 | 57 | 58 | 58 | 46 | **7/7** |

Three patterns, all consistent with the arithmetic:

**Single-axis fixtures pass everywhere.** `passive-heavy.md` — built to demonstrate passive voice —
clears all seven, scoring **98 on api-docs**. Its `active-voice` dimension scores 38, but at weight
0.08 that costs at most 4.9 composite points. `mixed-spelling.md` likewise clears all seven.

**Multi-axis fixtures fail everywhere.** `chat-jargon`, `dense-academic`, and `wall-of-text` fail all
seven, because each is bad on `grade-band` *and* `sentence-simplicity` at once.

**One fixture fails exactly one profile, and it is the profile built to catch it.**
`choppy-simplistic.md` fails only `chat` (71 against 75). `chat` raises `grade-band` to weight 0.24
specifically as the anti-gaming counterweight, and that extra 0.04 is the whole margin. **Profile
tuning is what makes a threshold bite — not the threshold number.**

## What this changes

**Not the numbers.** Raising thresholds until single-axis fixtures fail would require them around
80–85, which would fail ordinary competent prose too. Nine handcrafted fixtures are also the wrong
thing to calibrate against — `eval/README.md` warns about exactly that overfitting.

**The descriptions.** Three places said or implied "target":

- `packages/mcp/src/server.ts` — *"Target score; reaching it yields 'converged'"*
- `packages/prosemeter/src/cli/format.ts` — *"suggested threshold"* in `prosemeter profiles`
- `packages/core/src/profiles.ts` — *"a suggested threshold"* in the module doc

All three now say floor, and say what a floor can and cannot detect.

**And the CLI now says why it converged.** `renderConvergence` printed the verdict without the
reason, so a first-pass `converged` looked like a bug rather than a floor being cleared.

## The consequence for the loop

`checkConvergence` treats reaching the threshold as a stop regardless of trajectory
(`packages/core/src/loop.ts`), and the CLI supplies the profile's threshold when the caller passes
none. So `prosemeter score draft.md --baseline --save-baseline` reports `converged` on pass one for
any document that is merely *not catastrophic* — which, per the table above, is most competent first
drafts. Five of nine fixtures clear `plain`'s 70.

**That behaviour is now documented rather than changed.** Stopping at a floor is coherent — it is
what a floor is for, and `eval/` records that grinding past a plateau makes prose worse in ways the
score cannot see. What was wrong was that nothing said so.

Whether the CLI should stop defaulting the threshold is a separate design question, and this
measurement argues *against* it: removing the default makes every existing `--baseline` loop run more
passes, silently, for anyone who passed no flag.

## What this does not establish

- **Nine fixtures are not a corpus.** They are handcrafted to isolate single dimensions, which is why
  they demonstrate the arithmetic so cleanly and why they cannot calibrate anything.
- **Whether floors are the right design** is untouched here. This says what they are, not what they
  should be.
- **No threshold was changed**, and none should be without evidence from prose someone actually
  wrote.
