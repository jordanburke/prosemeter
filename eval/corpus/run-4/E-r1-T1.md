---
kind: eval-artifact
run: 4
variant: E
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two copies of the same library now sit in the tree, and the type definitions from one copy don't match the other.

The new package pinned a version your package can't share. The package manager solved that by installing both: one hoisted at the root, one nested under the new package. At runtime you get two module instances, so `instanceof` checks fail and singletons stop being single. At compile time TypeScript sees two sets of declarations for the same names and calls them incompatible.

To confirm it, run `pnpm why <library>`. That prints every dependent and the version each one asked for. If you see two version numbers, that's your answer.

Three ways to fix it, best first:

1. **Align the ranges.** Bump whichever package is behind so both land on one version. This is the real fix and it usually takes one line.
2. **Add a `pnpm.overrides` entry** in the root `package.json` forcing a single version. Do this when you can't move fast on the upgrade. Read the library's changelog first, because you are overriding someone's declared constraint.
3. **Make it a peer dependency** if the library is meant to be shared state, like a React or a logger. Peers push the version choice up to the app and stop the duplicate from ever being installed.

Avoid deleting the lockfile and reinstalling. That shuffles the hoisting and may hide the conflict on your machine while CI still breaks.
