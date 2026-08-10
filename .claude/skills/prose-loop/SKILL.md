---
name: prose-loop
description: Score a draft with prosemeter, revise from the findings, and stop when the score stops improving. Use when writing or editing prose that has a quality bar — READMEs, docs, blog posts, reports, release notes, long chat replies — or when asked to make writing clearer, shorter, or less jargon-heavy.
---

# prose-loop

Revise prose against a measurement instead of a hunch.

prosemeter scores a document 0–100 against a named profile. It returns findings with locations
and fix hints. This skill is the loop around it: score, revise from the findings, re-score, stop.

## The loop

1. **Score the draft.** MCP: `score_text` (inline) or `score_file` (on disk).
   CLI: `prosemeter score draft.md --profile <name> --json`.
2. **Read the per-dimension scores and findings.** Not the composite — see below.
3. **Revise** the specific spans the findings point at. Each finding carries a `hint`.
4. **Re-score**, then `compare_baseline` (current vs. previous result) to see which findings
   resolved and which are new. Also look at what it *doesn't* report: findings in the current result
   that are absent from `findingsNew` persisted from last pass. Those are the ones the revision
   walked past — attend to them before polishing anything else.
5. **Stop** when `check_convergence` returns anything but `improving` — `plateaued`,
   `oscillating`, `regressing`, or `converged` all mean stop. On `regressing`, go back to the best
   earlier draft instead of pushing the latest one further.

Two or three passes is normal. Do not grind: past the plateau the score moves on noise and
the prose gets worse in ways the score cannot see.

## What a rising score is evidence of

**The findings are the useful part of this loop. The score going up is not.**

This was measured directly. Thirty drafts were each revised twice — once with the findings shown,
once blind, with the same instructions otherwise. The findings-guided revision scored **4.3
composite points higher on 29 of 30 drafts**. A blind reader, shown both with the labels hidden,
then preferred the *blind* revision.

The gain never left the dimensions the findings pointed at. Across the five dimensions no finding
touched, the two revisions differed by at most 0.4 points. A finding says "fix this span"; fixing
that span moves the dimension it came from. That is the loop working, and it is not the same claim
as "the document improved".

So:

- **Act on findings with a location and a hint.** Those name a span and a change, and the edit is
  a normal editorial edit whether or not you re-score afterwards.
- **Do not treat the composite as a progress bar.** "81 to 84" is not evidence the draft is better.
  Check that the dimension you targeted moved, and read what the revision did to the sentence.
- **Prefer the earlier draft when the win is small and confined to one dimension.** A four-point
  gain concentrated in `directness` is what deleting hedges looks like.

`eval/LIB_RPT_revision-loop_2026-08-10.md`.

**`converged` does not mean "done".** It means the score cleared a floor, and the floor is low by
construction: no single dimension can fail a profile's default threshold, so it detects catastrophic
prose and nothing finer. Measured — five of nine calibration fixtures clear `plain`'s 70, including
one built to be bad.

Where the verdict comes from differs by surface, and this trips people up:

- **MCP `check_convergence`** takes `threshold` as an optional argument. Omit it and a first call
  returns `improving`, because one score is not a trend.
- **The CLI** supplies the active profile's floor when you pass no `--threshold`, so
  `prosemeter score draft.md --baseline --save-baseline` can report `converged` on the *first* pass
  for a competent draft. It now prints the reason when that happens.

Either way, treat a first-call verdict as a default rather than as evidence, and read the dimensions.
See `docs/LIB_ANLY_threshold-semantics_2026-08-07.md`.

CLI equivalent, which keeps the history for you:

```bash
prosemeter score draft.md --profile readme --baseline --save-baseline --json
```

## Read the dimensions, not the composite

**This is the most common way to misuse the tool.** The composite is a weighted average, so it
averages the real effects away.

Measured on 56 answers across seven writing-instruction variants: the composite spanned
79.5–86.6. The spread within a single variant was about 15 points, so no composite gap in that
run meant anything. Over the same data the dimensions moved 2–3x. Mean length ran 550 words down
to 246. Complex words as a share of total ran 11.1% down to 3.4%.

So: name the dimension that is low, fix the thing it names, and check that dimension moved.
"The score went from 81 to 84" is not a finding.

## Four failure modes with teeth

Each of these is a mistake made and measured while building this, not a style opinion.

### Do not chase brevity past dropping a condition

Cutting an exception that changes when a claim is true makes the answer wrong, not shorter.
"Never retry a 4xx" is shorter than "never retry a 4xx except 429", and false.

The score cannot detect this. prosemeter measures prose, not truth. Brevity dimensions will
happily reward the wrong sentence.

**And a `directness` finding is the sharpest way to walk into it.** That dimension flags hedges —
`usually`, `almost`, `appears`, `may` — by naming the exact word. A reviser handed those marks
deletes them: measured, `directness` moved 27 points against a blind revision, more than twice any
other dimension. On tasks where a qualifier decides correctness, that produced "usually beats
memoization" → "beats memoization outright" and "almost certainly missing" → "the other half is
missing". A judge asked to look called the revision overconfident on 9 of 10 such pairs.

When a hedge is flagged, decide which kind it is before touching it:

| the claim | do this |
| --- | --- |
| true only under a condition | **name the condition.** That satisfies the dimension too — a stated condition is a concrete claim |
| true unconditionally, hedged out of habit | cut the word |
| you do not know which | leave it, and say so |

The hint now leads with that check. Findings generated by older versions lead with "cut".

### Too simple is penalised too

`grade-band` is bidirectional. It has a floor as well as a ceiling, and telegraphic prose falls
through the floor.

Demonstrated: a rewrite scored composite 83 while `grade-band` crashed to 41 at reading grade
4.6. The composite looked fine. The prose read like a children's book about database indexes.
Check the band, not just the direction of travel.

### `clarity` is a document check, not a target

`clarity` scores 88.4 on uninstructed prose and 89.1 under tuned writing rules — 0.7 points
apart, against 12 points of movement across topics. It tracks subject matter more than it tracks
writing quality.

Keep it on: it correctly flags padding when padding is there. Do not set out to raise it, and do
not read a low `clarity` as "this writing is unclear" without looking at the findings.

### Naming better words beats asking for fewer

"Avoid jargon" does not reduce jargon (10.3% against a 11.2% no-instruction control). Naming the
swap does. "Use over utilize, start over initiate, so over consequently" moved it to 8.5%. When
you revise, make the swap the finding names instead of resolving to be simpler.

## Picking a profile

| profile | grade band | for |
| --- | --- | --- |
| `plain` | 8–12 | general prose, neutral defaults |
| `readme` | 8–12 | project READMEs — structure weighted up, clichés harsh |
| `api-docs` | 8–13 | reference docs — terminology consistency up, passive tolerated |
| `blog` | 7–10 | posts — sentence variety and clarity up, structure relaxed |
| `marketing` | 6–9 | copy — brevity, simplicity, directness all harsh |
| `academic` | 12–16 | papers — passive and hedging tolerated, band high |
| `chat` | 7–12 | **conversational replies** — jargon and wordiness harsh |

`chat` zeroes `heading-hierarchy`, `section-length`, `document-balance`, and
`acronym-definition`, because a chat reply has no document structure to score. Use it for agent
replies and messages; using `readme` on a chat reply penalises the absence of headings it should
never have had.

`list_profiles` (MCP) or `prosemeter profiles` (CLI) prints the live list with thresholds.

## Scope of the evidence

The measured claims above come from `eval/` in this repo: 596 scored answers across seven runs on
`claude-opus-5`, 2026-08-02 to 2026-08-10, plus a Sonnet 5 transfer check.

Three limits worth stating:

- **The numbers are model-specific.** A Sonnet 5 run reproduced the ranking at a third of the
  size. Its no-instruction baseline was already 258.6 words against Opus's 475.3. Ranking
  transfers; effect size does not.
- **None of this improves factual accuracy.** Two runs and one targeted test found the same
  thing: wording moves length and vocabulary 2–3x, and moves correctness not at all. A high score
  is not a correctness signal. Verify facts separately.
- **The reader preference behind the run-6 result was judged by a model, not a person.** Model
  judges have a large position bias — shown the same pair the other way round, the same judge
  reverses about a third of its decided verdicts, so the numbers here come from the verdicts that
  survived both orders. No human has read the pairs. Treat "read better" as the best available
  evidence rather than a settled fact.

`eval/README.md` records the method and the list of things that do not need re-testing.
