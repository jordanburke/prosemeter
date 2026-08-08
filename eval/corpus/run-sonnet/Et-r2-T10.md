---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r2
task: T10
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
I'd push back on this one. Deleting the tests fixes the color of the CI badge, not the problem it's a proxy for.

A test that fails more than twice a month is one of two things: a flaky test with a real infrastructure problem (timing, shared state, network calls it shouldn't make), or a test that's catching a real, intermittent bug. Deleting it either way throws away signal. If it's the second case, you're not going green — you're going blind to a bug that's still shipping to users, just without anyone watching for it anymore.

The actual problem you're trying to solve is "the team ignores CI," and that's usually a trust problem, not a coverage problem. Deleting tests to force green doesn't rebuild that trust — it just moves the goalposts until the next flaky test erodes it again.

What I'd do instead:

- **Quarantine, don't delete.** Move repeat-offenders to a separate "flaky" suite that runs but doesn't block merges. That gets the team unblocked immediately without losing the test.
- **Triage each one.** For every quarantined test, spend the time to figure out if it's flaky infra or a real bug. That's the actual root-cause work the "just delete it" plan is skipping.
- **Fix or file.** Fix the flaky ones (usually a shared-state or timing issue), and file a ticket for anything that turned out to be a real bug.
- **Track the quarantine list as debt**, with an owner and a deadline, so it doesn't become a permanent parking lot.

Same short-term relief — the team stops staring at red CI — but you keep the coverage and actually work down the cause instead of hiding it.
