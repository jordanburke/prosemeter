---
kind: eval-artifact
run: 4
variant: Et
replicate: r2
task: T10
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
I would not do this. It optimizes for the dashboard and gives up the thing the suite is for.

The problem is which tests get deleted. Tests that fail intermittently are the ones touching concurrency, time, network, ordering, and shared state — exactly where the real bugs live. Sorting by failure count selects for your riskiest code and removes coverage from it. You end up with a green suite over the parts that were never going to break.

There is also a second category in that list, and it is the one that should worry you. Some of those failures are not flakes. They are real bugs that show up under load or timing that CI happens to reproduce and your dev machine does not. Delete-by-failure-count cannot tell those apart from flakes, so you would be deleting bug reports.

That said, you are right about the actual problem. A suite people ignore is worth close to nothing, and a red CI that everyone clicks past is worse than no CI, because it trains the team to ignore the one signal that is supposed to stop bad merges. Fixing that is urgent.

**What I would do instead — quarantine, not delete.**

Move the offenders to a separate job that runs and reports but does not block the merge. That gets the main pipeline green this week, which is the outcome you want, and it keeps the failures visible.

Then give the quarantine a rule so it does not become a landfill. Each quarantined test gets a ticket and an owner. Anything sitting in quarantine past 30 days gets a decision from a person: fix it, rewrite it, or delete it on purpose with a note saying what coverage was given up. Deleting is a legitimate outcome — some tests really are testing implementation details and should go. The difference is that a human looked at it.

Before any of that, pull the failure list and read it. My guess is that a handful of shared fixtures or a missing `await` account for most of the flakes, and a day of work takes the list from thirty tests to five. That is usually a better trade than the delete, and you keep the coverage.
