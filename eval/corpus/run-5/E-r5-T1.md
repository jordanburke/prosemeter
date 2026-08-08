---
kind: eval-artifact
run: 5
variant: E
replicate: r5
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for versions of the same library that cannot both be satisfied at once. The package manager had to pick, and something got a version it was not written against.

## What is happening

A package manager builds one tree from all the version ranges it is given. When two ranges overlap, it picks one copy and both packages share it. When they do not overlap, it either installs two copies at different depths or fails outright.

Two copies cause the confusing failures. Types stop matching, because a type from copy A is not the same type as the identical type from copy B. `instanceof` returns false across the boundary. Any library that keeps module-level state — a React renderer, a database driver pool, a singleton registry — now has two of that state, and each half only sees its own.

One shared copy causes the other failure. The package with the older range gets code it never ran against, and it breaks on a removed or changed API.

## How to find out which case you have

Ask the package manager to show you the tree.

```
npm ls <library>       # or pnpm why <library>, yarn why <library>
```

The output names every package that depends on it and the version each resolved to. Two lines with different versions means two copies. One line means one copy, and the breakage is a real incompatibility.

## How to fix it

Pick the fix that matches the cause.

**Widen the ranges so they overlap.** Upgrade the package with the older range to a release that accepts the new version. This is the real fix, so try it first.

**Move the library to a peer dependency.** If the library must be a singleton, its consumers should declare it as a peer, not bundle their own. The host app then installs exactly one copy and both packages use it. Renderers, ORMs, and plugin frameworks belong in this group.

**Force one version.** Every manager has an override: `overrides` in npm, `resolutions` in yarn, `pnpm.overrides` in pnpm. You are telling the manager to ignore a declared range, so you own the risk. Leave a comment saying which package you overrode and why.

**Pin the transitive version temporarily.** Do this to unblock the build today, then open a ticket for the real fix. An override with no ticket becomes permanent.

## What to avoid

Do not delete the lockfile and reinstall hoping it settles. That changes many versions at once and hides which one mattered.

Do not upgrade both packages to latest as a first move. You then debug several breaking changes instead of one.
