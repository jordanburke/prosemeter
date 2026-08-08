---
kind: eval-artifact
run: 4
variant: Et
replicate: r3
task: T10
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
I would not do it. The diagnosis is right and the treatment throws away the evidence.

You are correct about the real problem: a suite people ignore is worse than no suite, because it costs time and gives nothing back. That needs fixing. But "failed more than twice" selects for two very different things, and deleting the set deletes both.

**A test that fails intermittently is usually flaky.** Timing, shared state, test order, a real clock, an unmocked network call. Worth fixing, not worth blocking on.

**A test that fails intermittently is sometimes right.** It found a genuine race in your code and only loses the race some of the time. That is the single most valuable test you own, and it looks exactly like the flaky ones from the outside. Delete by failure count and you will delete it, and the race ships.

**What I would do instead — quarantine, not delete:**

1. **Tag the offenders and move them out of the blocking run.** They still execute, on a schedule, reporting to a dashboard. CI goes green today, which is the outcome you actually want.
2. **Put a name and a date on each one.** An owner and a two-week deadline. No owner means nobody looks at the dashboard and quarantine becomes a graveyard — that is the failure mode of this approach and it is worth guarding against.
3. **Triage each: flaky, or real?** Run the test alone, run it a hundred times, run the suite in reverse order. Isolation failures point at shared state. Timing failures point at sleeps or real clocks.
4. **Delete the ones that earn deletion.** Some will be testing behavior nobody needs, or asserting on implementation that changed. Deleting those is fine. Delete for a reason you can state, not for a failure count.
5. **Cap the quarantine.** If it grows past some number, that is a build-health problem and it goes on the roadmap.

**One thing I would agree with.** If the team is already ignoring CI, the suite is already deleted in practice — you just keep paying for it. Your instinct that the current state is the worst state is right. Quarantine gets you the same green board this week without losing the tests you cannot get back.

Happy to take the first pass at tagging them if you want to split it.
