---
kind: eval-artifact
run: 5
variant: F
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## What is happening?

Your build broke because two packages ask for different versions of the same library, and the tool that installs them could only pick one.

A package manager writes every dependency into a folder tree. When two packages want the same library at the same version, it stores one copy and both share it. When they want different versions, it has a choice: store two copies, or force one version on both.

Which choice you get depends on the version ranges. A range like `^2.1.0` means "any 2.x at or above 2.1.0". If one package asks for `^2.1.0` and the other asks for `^2.4.0`, both ranges overlap at 2.4.0, so the installer picks that single version and both packages share it. If one asks for `^2.1.0` and the other asks for `^3.0.0`, the ranges do not overlap, so the installer keeps two copies.

Both outcomes can break a build:

- **One shared copy.** The version moved up to satisfy the new package. Your code now runs against a library it was never tested against. This shows up as a missing function, a changed argument, or a runtime error deep inside the library.
- **Two copies.** Each package gets its own. This breaks anything that depends on the library holding one piece of shared state — a type registry, a singleton client, a class used in an `instanceof` check. An object made by copy A fails an `instanceof` check against the class from copy B, because they are two different classes that happen to share a name.

TypeScript builds fail a third way. Two copies mean two sets of type declarations. The compiler treats the same-named type from each copy as a separate type, so passing a value from one package to the other fails to typecheck.

## How do I find out which case I have?

Ask the package manager to show you the tree for that library.

```
npm ls the-library
pnpm why the-library
yarn why the-library
```

Each prints every package that asks for the library, the range each one asks for, and the version each one resolved to. One resolved version means case one. Two or more means case two.

Read the lockfile diff next. The lockfile records exactly what was installed. The commit that added the new package also changed the lockfile, and that diff names every version that moved. If a library you depend on jumped a major version there, you have your cause.

## How do I fix it?

The fix depends on which case you found.

**One shared copy, and the new version broke you.** Pin the version you need, then fix forward. Pin it with an override so both packages get the version you name — `overrides` in npm, `pnpm.overrides` in pnpm, `resolutions` in Yarn. That unblocks the build today. It also forces the new package onto a version it did not ask for, so treat it as a stopgap: read the library's changelog for the breaking change, update your own code, and drop the override.

**Two copies, and shared state broke.** You need one copy, so you need the ranges to overlap. Move your dependency up to a range the other package can also satisfy, or ask the other team to widen theirs. If neither can move, an override forces a single version, but here it is riskier — one package really will run against a major version it never expected.

**The library is meant to have one copy.** Libraries that hold shared state usually say so, and many declare themselves a peer dependency for this reason. A peer dependency means "the app supplies this, not me" — the package uses the library but does not bundle its own copy. If your library supports that and the other package does not use it, ask them to switch. That makes duplication impossible instead of merely unlikely.

Two rules keep this from recurring. Commit the lockfile, so everyone installs the same tree and a version move shows up as a reviewable diff. Read that diff when a dependency changes, because the lockfile is where a broken build announces itself a day early.
