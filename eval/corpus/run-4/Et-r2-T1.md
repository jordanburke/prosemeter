---
kind: eval-artifact
run: 4
variant: Et
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Two copies of that library are now in your tree, and your code is talking to the wrong one.

The new package asks for a version range that does not overlap with what your package asks for. Your package manager cannot pick one version that satisfies both, so it installs both. One lands at the top of `node_modules`, the other lands nested under the package that needed it.

That is fine for a plain utility library. It breaks when the library holds state or identity — a React copy, a context object, a class you `instanceof`, a singleton registry. Two copies mean two registries, and a value made by one fails the check in the other. The `instanceof` failures and "invalid hook call" errors both come from this.

**Find it first.** Run `pnpm why <library>` (or `npm ls <library>`). That prints every dependent and the version each one asked for. If you see two versions, you have your answer.

**Then pick a fix:**

- **Bump the loser.** If one dependent can move to a range that overlaps, upgrade it. Cleanest option.
- **Force one version.** Add a `pnpm.overrides` entry (or `resolutions` for yarn) pinning the library to a single version. Fast, but you are overriding a stated requirement — test the package you overrode.
- **Make it a peer dependency.** If your own package publishes and the library must be a singleton, declare it as a peer so the consumer supplies exactly one copy.

Reach for the override when you need the build back today. Reach for the bump when you want it to stay fixed.
