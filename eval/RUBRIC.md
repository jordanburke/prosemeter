# Fact-check rubric

Pinned. Reviewers receive this text verbatim. Do not paraphrase it into a reviewer prompt —
paste it. The 2026-08-02 run's cross-model comparison failed because two reviewers used
different unstated thresholds, and the difference accounted for 8 of 13 disagreements.

## What you are judging

Technical correctness only.

**Never penalize:** brevity, terseness, omitted detail, informal tone, missing caveats that
do not change whether a claim is true, or an answer being shorter or simpler than another.
An answer can be correct and thin. Thin is not an error.

## Two counts, both required

Every reviewer emits **both** of these. Do not pick one.

**STRICT** — an answer is strict-wrong if any of:

- It states a wrong mechanism as the sole cause, with no correct alternative offered.
- It contradicts itself on a checkable fact within the same answer.
- Its advice would break something if followed as written.
- A command, snippet, or API reference is wrong, would fail, or does something other than
  what the answer says it does.

**BROAD** — strict-wrong, plus:

- It offers a wrong branch alongside a correct one ("either X or Y happens", where X never
  happens).
- It states a rule without a qualifier that is load-bearing for the rule's truth — the
  unqualified form is false in a case a reader would plausibly hit.
- It asserts a mechanism that does not exist, even in passing.

Every strict-wrong answer is also broad-wrong. Broad is a superset.

## Reporting

For each error, give: the file, `strict` or `broad`, the exact wrong claim quoted, and why
it is wrong. If a claim is wrong only under BROAD, say which of the three broad clauses it
falls under.

Report both totals: `STRICT: <n> of <total> clean` and `BROAD: <n> of <total> clean`.

## Notes

Where answers disagree on a checkable fact, determine which is right rather than flagging
both. Verify empirically when you can — the 2026-08-02 T1 reviewer settled a dispute by
installing conflicting packages and inspecting the resulting tree, which is worth more than
recall.
