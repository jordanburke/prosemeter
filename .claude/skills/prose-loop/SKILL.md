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
   resolved and which are new.
5. **Stop** when `check_convergence` returns anything but `improving` — `plateaued`,
   `oscillating`, `regressing`, or `converged` all mean stop. On `regressing`, go back to the best
   earlier draft instead of pushing the latest one further.

Two or three passes is normal. Do not grind: past the plateau the score moves on noise and
the prose gets worse in ways the score cannot see.

`check_convergence` always returns `improving` on the first call, because one score is not a
trend. Treat that verdict as a default, not as evidence.

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

The measured claims above come from `eval/` in this repo: 236 scored answers across four runs on
`claude-opus-5`, 2026-08-02 and 2026-08-03, plus a Sonnet 5 transfer check.

Two limits worth stating:

- **The numbers are model-specific.** A Sonnet 5 run reproduced the ranking at a third of the
  size. Its no-instruction baseline was already 258.6 words against Opus's 475.3. Ranking
  transfers; effect size does not.
- **None of this improves factual accuracy.** Two runs and one targeted test found the same
  thing: wording moves length and vocabulary 2–3x, and moves correctness not at all. A high score
  is not a correctness signal. Verify facts separately.

`eval/README.md` records the method and the list of things that do not need re-testing.
