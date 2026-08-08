---
kind: eval-artifact
run: 2
variant: Ep
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because the package manager can no longer pick one version of that shared library, and something in your tree now gets a version it wasn't compiled against.

Here's the mechanic. Package A asks for `lib@^1.4`, the new package B asks for `lib@^2.0`. Those ranges don't overlap, so the resolver installs both copies. Now you have two `lib` modules in memory with two separate copies of every class and type. A type from one copy is not the same type as the "same" type from the other, so TypeScript rejects the assignment and `instanceof` checks fail at runtime.

Run `pnpm why lib` to see who pulled in each version. That tells you which of the two is the odd one out.

Then pick a fix:

1. **Align the ranges.** Upgrade whichever package still wants v1 to a release that accepts v2. This is the right fix when it exists, because it leaves one copy in the tree.
2. **Make it a peer dependency.** If the library carries shared state or identity checks, the packages that use it should declare it in `peerDependencies` and let your app own the version. This stops the problem coming back next time.
3. **Force one version.** Add a `pnpm.overrides` entry pinning `lib` to a single version. Only do this once you've checked the v1 consumer actually works against v2 — an override silences the resolver, not the incompatibility.

Avoid the fourth option, which is deleting the lockfile and hoping. That reshuffles unrelated packages and hides which change caused the break.

One caveat on the override route. If the library keeps module-level state — a registry, a singleton client, a React context — duplicate copies break in ways that no type error warns you about, so the override is doing real work and you must verify it. If the library is stateless and the two majors are compatible in practice, the override is cheap.
