---
kind: eval-artifact
run: 5
variant: F
replicate: r5
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Why did the build break when another team added a package?

Two copies of the same library now live in your dependency tree, and something in your code assumes there is only one.

The new package asked for a different version of a library you already use. Your package manager could not satisfy both requests with one copy, so it installed both. Each package gets the version it asked for, nested under its own folder. That usually works. It breaks when the two copies have to agree about something.

Three things break in practice.

The type checker breaks first. TypeScript sees two declarations of the same type from two different files. It treats them as unrelated types, even when they are identical, so passing a value from one to the other fails to compile. The error usually reads like "Type X is not assignable to type X", which looks absurd until you know why.

Shared state breaks second. Some libraries keep a module-level registry — React keeps hook state, a validation library keeps a schema cache, a logger keeps handlers. Two copies mean two registries. Code that registers with one copy and reads from the other finds nothing.

Bundle size breaks third, and only in production. You now ship both copies to the browser.

## How do I fix it?

Force one copy, then check that one copy actually works.

Start by finding out what you have. Run `npm ls <library>` or `pnpm why <library>`. It prints every package that asked for the library and which version each got. That tells you whether the two ranges overlap at all.

If they overlap, the fix is cheap. Delete the lockfile entry and reinstall, or run `npm dedupe`. The package manager picks one version that satisfies both ranges and collapses the tree.

If they do not overlap, you have to choose. Pin one version for the whole tree with an override — `overrides` in npm, `resolutions` in Yarn, `pnpm.overrides` in pnpm. This is a claim that the pinned version is compatible with both packages even though one of them did not say so. Test it. If the two versions cross a major release, the claim is often wrong.

The better fix, when you own the package, is a peer dependency. A peer dependency says "I use this library, but the app supplies it" rather than "install me my own." Libraries that hold shared state — React, the state manager, the validation library — should always be peers. That makes one copy the contract instead of an accident.

Ask the other team which version they need and why. If they can move to yours, that is the whole fix, and it holds without an override that someone has to maintain.
