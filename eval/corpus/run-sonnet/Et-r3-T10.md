---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r3
task: T10
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
I'd push back on this. Deleting the tests fixes the color of the CI badge, not the reason people stopped trusting it.

A test that fails more than twice a month is telling you one of two things: either it caught a real bug twice, or it's flaky — and those need opposite responses. Delete it and you lose that signal either way. If it's catching real bugs, you've just removed your only warning for that code path. If it's flaky, the underlying cause (race condition, shared state, timing dependency, bad test isolation) is still sitting in the suite or the code, and deleting the test hides it instead of fixing it.

The actual goal — "the team stops ignoring CI" — needs the suite to be trustworthy, not green. Green-by-deletion gets you a false trust that breaks the first time a deleted test would have caught something real, and then you're back to square one with less coverage than before.

What I'd do instead:

1. **Triage, don't delete.** For each repeat-failing test, spend ten minutes deciding: real bug, flaky test, or bad test. That alone will resolve most of them.
2. **Quarantine flaky tests**, don't drop them — move them to a non-blocking job so they don't gate merges, but keep them visible so someone still has to fix or retire them on purpose.
3. **File one ticket per test** with the failure pattern, not a bulk cleanup. Bulk deletion is how real bugs slip through unnoticed.
4. **Fix the top offenders first.** A handful of tests probably account for most of the noise — start there instead of a blanket rule.

Happy to pair on triage if that helps move it faster.
