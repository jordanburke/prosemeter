---
kind: eval-artifact
run: 1
variant: F
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus"
  error: "Offers 'picks one and hopes for the best' as a resolver branch. That describes bundler-level dedupe, not package-manager resolution."
---
Your build broke because two packages now ask for different versions of the same library, and only one version can win.

Here's what's happening. Your package manager tries to install one copy of a shared dependency near the top of the tree. When two packages want incompatible ranges, it either installs two copies in nested folders or picks one and hopes for the best. If it installs two copies, you get duplicate code, bigger bundles, and the classic "instance A is not an instance of class A" error. If it picks one, the package expecting the other version breaks at build or at runtime.

**Find out which it is first.** Run `pnpm why <library>` (or `npm ls <library>`). That prints every package asking for it and which version each one got.

Then pick a fix based on what you see:

1. **Bump the lagging package.** If the older consumer has a newer release that accepts the new range, upgrade it. This is the right fix and the one to try first.
2. **Ask the other team to widen their range.** If they pinned an exact version for no strong reason, a caret range often solves it outright.
3. **Force one version with an override.** Add a `pnpm.overrides` or `resolutions` entry in the root `package.json`. This works when the versions are actually compatible and someone just declared them too narrowly. Leave a comment saying why, because overrides are easy to forget and hard to debug later.
4. **Make the library a peer dependency.** If the library holds shared state, like React or a client instance, two copies are always a bug. Peer deps push the choice up to the app and stop the duplication.

One warning on overrides. They silence the error without proving the code works. Run the tests for both packages after you add one.
