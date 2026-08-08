---
kind: eval-artifact
run: 4
variant: Et
replicate: r1
task: T10
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
I would not do that. You are right about the problem and wrong about the fix.

The problem is real: a suite nobody trusts is worse than no suite, because it burns attention every day and catches nothing. Getting to green matters. I am with you that far.

But deleting by failure count deletes your best tests. A test that fails intermittently is usually testing something that is actually intermittent — a race, a timeout, a shared fixture, an ordering assumption. That test is reporting a real defect in the code, badly. Delete it and the defect stays, unwatched, until it shows up in production where it costs more.

You would also be selecting for deletion by *how much a test touches*. Integration tests that cross real boundaries flake more than unit tests that touch nothing. So the policy removes your highest-coverage tests and keeps the ones asserting that a getter returns what a setter set.

**What I would do instead**

**Quarantine, do not delete.** Move repeat offenders to a separate suite that runs but does not block the merge. CI goes green today, which is the outcome you want, and you keep the signal. Most CI systems support this directly; a tag and a second job works if yours does not.

**Put a name and a date on each one.** A quarantine with no exit is a delete with extra steps. Owner, and a date by which it is fixed or gone. Review the list at whatever cadence you already meet.

**Triage before you quarantine anything.** Run the failing set twenty times and sort into three piles:

- Fails every time → the test is wrong or the code is broken. Fix one of them now. This should not be quarantined at all.
- Fails sometimes → a real race or a timing dependency. Quarantine, then fix the root cause. These are the ones worth your time.
- Fails only in CI → environment, not code. Usually shared state between parallel workers, a fixed port, or a clock assumption. Often one fix clears a dozen tests at once.

That third pile is where I would start. Flakiness clusters — a handful of causes generate most of it, and fixing them is a much better week than arguing test by test.

**Then delete deliberately.** Some tests genuinely should go: ones testing removed behavior, duplicates, tests asserting implementation details that change every refactor. Delete those on the merits, one at a time, with someone reading them. That is a real cleanup and I will help with it.

The distinction I care about is this: deleting a test because you read it and judged it worthless is engineering. Deleting it because it failed three times is deleting the smoke detector because it keeps going off.

Want to pair on the triage? An afternoon on the top ten offenders would tell us how much of this is one or two root causes.
