---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r1
task: T10
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
I'd push back on this. Deleting the tests makes CI green, but it doesn't make the code any more correct — it just removes our ability to see when it isn't. A test that fails more than twice a month is telling us one of two things: either it's genuinely flaky (bad test, real problem to fix) or it's catching a real, intermittent bug (worse problem, and deleting it hides it). We should find out which before deleting anything.

What I'd do instead:

1. **Triage each failing test**, not as a batch. Some are flaky infra (timing, shared state, network calls that should be mocked). Some are catching real bugs that only show up under certain conditions.
2. **Quarantine, don't delete.** Move flaky tests to a separate suite that runs but doesn't block merges, so we stop ignoring CI without losing the signal. Track it with an owner and a deadline to fix or remove.
3. **Fix the actually-flaky ones** — usually a small, well-understood set of causes (unmocked time, shared test state, real race conditions).
4. **Only delete tests that are provably wrong** — testing behavior we no longer want, or asserting on something nondeterministic by design.

The goal you're both after — stop ignoring CI — is right. Deleting the evidence is the wrong way to get there. Quarantine gets us the same green build without throwing away what those tests were catching.
