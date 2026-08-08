---
kind: eval-artifact
run: 5
variant: F
replicate: r4
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Why did the build break?

Two packages in your tree ask for different versions of the same library, and the build can only resolve one of them into the place your code looks. The other team's new package pinned a version that clashes with what you already had. Your package manager either hoisted the wrong one to the top, or it installed both and your bundler picked one.

This is a version conflict. A version conflict means two dependents name ranges for the same library that do not overlap, so no single install satisfies both.

The break shows up in one of three shapes. The type checker fails, because the installed types no longer match the ones your code was written against. The bundle fails, because an export the old version had is gone in the new one. Or the app breaks at runtime, because two copies of the library loaded and each holds its own state — this is what bites libraries with a registry or a singleton, like React or a database driver.

## How do I see which versions are installed?

Ask the package manager to print the tree for that one library.

```
pnpm why <library>      # npm why / yarn why also work
```

The output lists every package that depends on it and the range each one asks for. Read the ranges, not just the versions. A package asking for `^2.0.0` accepts 2.9; a package asking for `~2.1.0` does not accept 2.2. That difference is usually the whole story.

## How do I fix it?

Pick the fix that matches what you found.

**Both ranges can overlap — bump the lagging one.** If your package asks for `^2.0.0` and theirs asks for `^3.0.0`, upgrade yours to `^3`. Read the library's changelog for the 2-to-3 breaks, fix them, and you are done. This is the real fix, because it leaves one version in the tree.

**The ranges cannot overlap and you need time.** Force one version for the whole tree with an override. In pnpm, add to the root `package.json`:

```json
{
  "pnpm": { "overrides": { "<library>": "3.1.0" } }
}
```

npm spells this `overrides`, yarn spells it `resolutions`. An override lies to the other package about what it got, so test the other package's paths afterward. Leave a comment saying why the override exists and what has to happen before you remove it.

**Two copies really must coexist.** Sometimes they can. If the library holds no shared state — a date formatter, a string utility — two copies cost bundle size and nothing else, and you can leave it. If the library holds shared state, two copies will break in ways that look like haunted behavior, and an override is not optional.

## What stops this next time?

Put the shared library in one place. Name it as a dependency in each package with the same range, or hold the version in a single root field the packages read. Then a bump moves everything at once, and no team can raise a version alone.

Add a check to CI that fails on a duplicated version of the libraries that hold state. `pnpm dedupe --check` covers the common case and takes a line of config.
